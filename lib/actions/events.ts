"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server-auth";

// ---------------------------------------------------------------------------
// Create standalone event (no required group)
// ---------------------------------------------------------------------------

const CreateEventSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  participantIds: z.array(z.string()).min(1),
});

export async function createEvent(formData: FormData) {
  const user = await requireUser();

  // participantIds come as multiple entries named "participantIds"
  const rawParticipants = formData.getAll("participantIds").map(String);

  const parsed = CreateEventSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    participantIds: rawParticipants.length ? rawParticipants : [user.id],
  });

  // Always include the creator
  const participantIds = Array.from(new Set([user.id, ...parsed.participantIds]));

  const event = await prisma.event.create({
    data: {
      createdById: user.id,
      name: parsed.name,
      description: parsed.description,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      participants: {
        create: participantIds.map((uid) => ({ userId: uid })),
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/events/${event.id}`);
}

// ---------------------------------------------------------------------------
// Get all events where the current user is a participant
// ---------------------------------------------------------------------------

export async function getMyEvents() {
  const user = await requireUser();
  return prisma.event.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      _count: { select: { establishments: true } },
      establishments: {
        include: { bills: { select: { totalCents: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Get single event with full bill detail
// ---------------------------------------------------------------------------

export async function getEvent(eventId: string) {
  const user = await requireUser();
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      participants: { some: { userId: user.id } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      establishments: {
        include: {
          bills: {
            include: {
              lineItems: {
                include: {
                  fractions: { include: { user: { select: { id: true, name: true } } } },
                },
              },
              payments: { include: { user: { select: { id: true, name: true, image: true } } } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) redirect("/dashboard");
  return event;
}
