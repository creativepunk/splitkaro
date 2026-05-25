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
// Update event name / description
// ---------------------------------------------------------------------------

const UpdateEventSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(500).optional(),
});

export async function updateEvent(
  eventId: string,
  data: { name: string; description?: string }
) {
  const user = await requireUser();
  const parsed = UpdateEventSchema.parse(data);

  const event = await prisma.event.findFirst({
    where: { id: eventId, createdById: user.id },
    select: { id: true },
  });
  if (!event) throw new Error("Event not found or access denied");

  await prisma.event.update({
    where: { id: eventId },
    data: { name: parsed.name, description: parsed.description ?? null },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Add / remove event participants
// Returns names of participants that could NOT be removed (have expenses).
// ---------------------------------------------------------------------------

export async function updateEventParticipants(
  eventId: string,
  { add = [], remove = [] }: { add?: string[]; remove?: string[] }
): Promise<{ blockedNames: string[] }> {
  const user = await requireUser();

  const event = await prisma.event.findFirst({
    where: { id: eventId, participants: { some: { userId: user.id } } },
    select: { id: true, createdById: true },
  });
  if (!event) throw new Error("Event not found");

  // Never remove the creator or yourself from the event
  const safeRemove = remove.filter(
    (id) => id !== event.createdById && id !== user.id
  );

  let blockedNames: string[] = [];

  if (safeRemove.length > 0) {
    // Find which of the to-remove users actually have expenses in this event
    const [fractions, payments] = await Promise.all([
      prisma.itemFraction.findMany({
        where: {
          userId: { in: safeRemove },
          lineItem: { bill: { establishment: { eventId } } },
        },
        select: { userId: true, user: { select: { name: true } } },
        distinct: ["userId"],
      }),
      prisma.payment.findMany({
        where: {
          userId: { in: safeRemove },
          bill: { establishment: { eventId } },
        },
        select: { userId: true, user: { select: { name: true } } },
        distinct: ["userId"],
      }),
    ]);

    const blockedIds = new Set([
      ...fractions.map((f) => f.userId),
      ...payments.map((p) => p.userId),
    ]);

    blockedNames = [
      ...fractions.map((f) => f.user.name ?? "Unknown"),
      ...payments
        .filter((p) => !fractions.find((f) => f.userId === p.userId))
        .map((p) => p.user.name ?? "Unknown"),
    ];

    const canRemove = safeRemove.filter((id) => !blockedIds.has(id));
    if (canRemove.length > 0) {
      await prisma.eventParticipant.deleteMany({
        where: { eventId, userId: { in: canRemove } },
      });
    }
  }

  if (add.length > 0) {
    // Filter out IDs already in the event to avoid unique-constraint errors
    const existing = await prisma.eventParticipant.findMany({
      where: { eventId, userId: { in: add } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((e) => e.userId));
    const newIds = add.filter((id) => !existingIds.has(id));
    if (newIds.length > 0) {
      await prisma.eventParticipant.createMany({
        data: newIds.map((uid) => ({ eventId, userId: uid })),
      });
    }
  }

  revalidatePath(`/events/${eventId}`);
  return { blockedNames };
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
