"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server-auth";

// ---------------------------------------------------------------------------
// Create group
// ---------------------------------------------------------------------------

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(80),
  emoji: z.string().max(4).default("👥"),
  memberIds: z.array(z.string()),
});

export async function createGroup(formData: FormData) {
  const user = await requireUser();
  const rawMemberIds = formData.getAll("memberIds").map(String);

  const parsed = CreateGroupSchema.parse({
    name: formData.get("name"),
    emoji: formData.get("emoji") ?? "👥",
    memberIds: rawMemberIds,
  });

  // Always include creator as owner
  const memberIds = Array.from(new Set([user.id, ...parsed.memberIds]));

  const group = await prisma.group.create({
    data: {
      name: parsed.name,
      emoji: parsed.emoji,
      members: {
        create: memberIds.map((uid) => ({
          userId: uid,
          role: uid === user.id ? "OWNER" : "MEMBER",
        })),
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}

// ---------------------------------------------------------------------------
// Fetch groups for current user
// ---------------------------------------------------------------------------

export async function getMyGroups() {
  const user = await requireUser();
  return prisma.group.findMany({
    where: { members: { some: { userId: user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, image: true } } } },
      _count: { select: { directExpenses: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Get single group
// ---------------------------------------------------------------------------

export async function getGroup(groupId: string) {
  const user = await requireUser();
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      members: { some: { userId: user.id } },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, image: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      directExpenses: {
        include: {
          paidByUser: { select: { id: true, name: true, image: true } },
          splits: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!group) redirect("/dashboard");
  return group;
}
