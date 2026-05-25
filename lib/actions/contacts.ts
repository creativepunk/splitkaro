"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server-auth";

// ---------------------------------------------------------------------------
// Add contact
// ---------------------------------------------------------------------------

const AddContactSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

export async function addContact(formData: FormData) {
  const user = await requireUser();
  const { name } = AddContactSchema.parse({ name: formData.get("name") });

  await prisma.user.create({
    data: {
      name,
      isContact: true,
      contactOwnerId: user.id,
      emailVerified: null,
    },
  });

  revalidatePath("/people");
  revalidatePath("/dashboard");
  redirect("/people");
}

// ---------------------------------------------------------------------------
// Get all contacts owned by the current user
// ---------------------------------------------------------------------------

export async function getMyContacts() {
  const user = await requireUser();
  return prisma.user.findMany({
    where: { isContact: true, contactOwnerId: user.id },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Get all "participants" available to the current user
// (themselves + their contacts)
// ---------------------------------------------------------------------------

export async function getMyParticipants() {
  const user = await requireUser();
  const [me, contacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, image: true, isContact: true },
    }),
    prisma.user.findMany({
      where: { isContact: true, contactOwnerId: user.id },
      select: { id: true, name: true, image: true, isContact: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return [me!, ...contacts];
}

// ---------------------------------------------------------------------------
// Rename contact
// ---------------------------------------------------------------------------

export async function renameContact(contactId: string, name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  await prisma.user.updateMany({
    where: { id: contactId, contactOwnerId: user.id, isContact: true },
    data: { name: trimmed },
  });

  revalidatePath(`/people/${contactId}`);
  revalidatePath("/people");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Delete contact
// ---------------------------------------------------------------------------

export async function deleteContact(contactId: string) {
  const user = await requireUser();

  // Only allow deleting contacts you own
  const contact = await prisma.user.findFirst({
    where: { id: contactId, contactOwnerId: user.id, isContact: true },
  });
  if (!contact) throw new Error("Contact not found");

  await prisma.user.delete({ where: { id: contactId } });

  revalidatePath("/people");
  revalidatePath("/dashboard");
  redirect("/people");
}

// ---------------------------------------------------------------------------
// Get single contact profile
// ---------------------------------------------------------------------------

export async function getContactProfile(contactId: string) {
  const user = await requireUser();

  const contact = await prisma.user.findFirst({
    where: { id: contactId, contactOwnerId: user.id },
  });

  if (!contact) redirect("/people");

  // Dynamically import to avoid any potential circular dependencies
  const { getGlobalBalances } = await import("./balances");

  const [{ balances }, sharedExpenses] = await Promise.all([
    getGlobalBalances(),
    prisma.directExpense.findMany({
      where: {
        OR: [
          { paidById: user.id, splits: { some: { userId: contactId } } },
          { paidById: contactId, splits: { some: { userId: user.id } } },
        ],
      },
      include: {
        paidByUser: { select: { id: true, name: true, image: true } },
        splits: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const netCents = balances.find((b) => b.userId === contactId)?.netCents ?? 0;

  return { contact, netCents, sharedExpenses };
}
