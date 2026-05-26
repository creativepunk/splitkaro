"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server-auth";
import { calculateBillBalances } from "@/lib/ledger";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface EventSettlement {
  eventId: string;
  eventName: string;
  /** positive = contact owes me from this event; negative = I owe contact */
  netCents: number;
}

export interface ContactListItem {
  id: string;
  name: string | null;
  image: string | null;
  isMe: boolean;
  /** total they owe others (events + direct expenses, scoped to Pushpal's events) */
  totalOwes: number;
  /** total others owe them */
  totalOwed: number;
}

export interface ContactOtherDebt {
  /** Set for event-bill debts */
  eventId?: string;
  eventName?: string;
  /** Set for direct-expense debts */
  expenseId?: string;
  expenseDescription?: string;
  /** true  = contact owes otherPerson; false = otherPerson owes contact */
  contactOwes: boolean;
  otherPersonName: string | null;
  amountCents: number;
}

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
// Get full list data: current user + all contacts with owes/owed totals
// ---------------------------------------------------------------------------

export async function getContactListData(): Promise<ContactListItem[]> {
  const user = await requireUser();

  const contacts = await prisma.user.findMany({
    where: { isContact: true, contactOwnerId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, image: true },
  });

  const trackedIds = new Set([user.id, ...contacts.map((c) => c.id)]);

  // owes[uid] = total they owe;  owed[uid] = total owed to them
  const owes = new Map<string, number>();
  const owed  = new Map<string, number>();
  for (const id of trackedIds) { owes.set(id, 0); owed.set(id, 0); }

  // ── Events: one greedy pass per event ─────────────────────────────────
  const events = await prisma.event.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      participants: { select: { userId: true } },
      establishments: {
        include: {
          bills: {
            include: {
              lineItems: { include: { fractions: true } },
              payments: true,
            },
          },
        },
      },
    },
  });

  for (const event of events) {
    const netByUser = new Map<string, number>();
    for (const p of event.participants) netByUser.set(p.userId, 0);

    for (const est of event.establishments) {
      for (const bill of est.bills) {
        try {
          const result = calculateBillBalances({
            totalCents:    bill.totalCents,
            subtotalCents: bill.subtotalCents,
            taxCents:      bill.taxCents,
            tipCents:      bill.tipCents,
            gratuityCents: bill.gratuityCents,
            lineItems: bill.lineItems.map((li) => ({
              id: li.id, name: li.name, totalCents: li.totalCents,
              fractions: li.fractions.map((f) => ({
                userId: f.userId,
                fraction: { numerator: f.numerator, denominator: f.denominator },
              })),
            })),
            payments: bill.payments.map((p) => ({ userId: p.userId, amountCents: p.amountCents })),
          });
          for (const ub of result.userBalances) {
            netByUser.set(ub.userId, (netByUser.get(ub.userId) ?? 0) + ub.netCents);
          }
        } catch { /* skip malformed bills */ }
      }
    }

    const evDebtors = [...netByUser.entries()]
      .filter(([, n]) => n < 0).map(([uid, n]) => ({ userId: uid, amount: -n }))
      .sort((a, b) => b.amount - a.amount);
    const evCreditors = [...netByUser.entries()]
      .filter(([, n]) => n > 0).map(([uid, n]) => ({ userId: uid, amount: n }))
      .sort((a, b) => b.amount - a.amount);

    let d = 0, c = 0;
    while (d < evDebtors.length && c < evCreditors.length) {
      const transfer = Math.min(evDebtors[d].amount, evCreditors[c].amount);
      if (transfer > 0) {
        const fromId = evDebtors[d].userId;
        const toId   = evCreditors[c].userId;
        if (trackedIds.has(fromId)) owes.set(fromId, (owes.get(fromId) ?? 0) + transfer);
        if (trackedIds.has(toId))   owed.set(toId,   (owed.get(toId)   ?? 0) + transfer);
      }
      evDebtors[d].amount -= transfer;
      evCreditors[c].amount -= transfer;
      if (evDebtors[d].amount === 0) d++;
      if (evCreditors[c].amount === 0) c++;
    }
  }

  // ── Direct expenses ────────────────────────────────────────────────────
  const directExpenses = await prisma.directExpense.findMany({
    where: {
      OR: [
        { paidById: { in: [...trackedIds] } },
        { splits: { some: { userId: { in: [...trackedIds] } } } },
      ],
    },
    include: { splits: true },
  });

  for (const de of directExpenses) {
    for (const split of de.splits) {
      if (split.userId === de.paidById) continue; // skip payer's own split
      const share = Math.round((de.totalCents * split.numerator) / split.denominator);
      if (share <= 0) continue;
      // split.userId owes de.paidById
      if (trackedIds.has(split.userId)) owes.set(split.userId, (owes.get(split.userId) ?? 0) + share);
      if (trackedIds.has(de.paidById))  owed.set(de.paidById,  (owed.get(de.paidById)  ?? 0) + share);
    }
  }

  return [
    {
      id:        user.id,
      name:      user.name ?? null,
      image:     user.image ?? null,
      isMe:      true,
      totalOwes: owes.get(user.id) ?? 0,
      totalOwed: owed.get(user.id)  ?? 0,
    },
    ...contacts.map((c) => ({
      id:        c.id,
      name:      c.name,
      image:     c.image,
      isMe:      false,
      totalOwes: owes.get(c.id) ?? 0,
      totalOwed: owed.get(c.id)  ?? 0,
    })),
  ];
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

  const [sharedExpenses, sharedEvents] = await Promise.all([
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
    // Events where both me and the contact participated
    prisma.event.findMany({
      where: {
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: contactId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        participants: {
          select: {
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
        establishments: {
          select: {
            name: true,
            bills: {
              select: {
                id: true,
                createdAt: true,
                totalCents: true,
                subtotalCents: true,
                taxCents: true,
                tipCents: true,
                gratuityCents: true,
                lineItems: {
                  select: {
                    id: true,
                    name: true,
                    totalCents: true,
                    fractions: { select: { userId: true, numerator: true, denominator: true } },
                  },
                },
                payments: { select: { userId: true, amountCents: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // ── One greedy pass per shared event ────────────────────────────────────
  // Produces both the me↔contact simplified settlement (eventSettlements)
  // and the contact↔third-party settlements (othersDebts) from the same run.
  const eventSettlements: EventSettlement[] = [];
  const othersDebts: ContactOtherDebt[] = [];

  for (const event of sharedEvents) {
    // Accumulate net per participant across all bills in this event
    const netByUser = new Map<string, number>();
    for (const p of event.participants) netByUser.set(p.userId, 0);

    for (const est of event.establishments) {
      for (const bill of est.bills) {
        try {
          const result = calculateBillBalances({
            totalCents: bill.totalCents,
            subtotalCents: bill.subtotalCents,
            taxCents: bill.taxCents,
            tipCents: bill.tipCents,
            gratuityCents: bill.gratuityCents,
            lineItems: bill.lineItems.map((li) => ({
              id: li.id,
              name: li.name,
              totalCents: li.totalCents,
              fractions: li.fractions.map((f) => ({
                userId: f.userId,
                fraction: { numerator: f.numerator, denominator: f.denominator },
              })),
            })),
            payments: bill.payments,
          });
          for (const ub of result.userBalances) {
            netByUser.set(ub.userId, (netByUser.get(ub.userId) ?? 0) + ub.netCents);
          }
        } catch { /* skip malformed bills */ }
      }
    }

    // Single greedy over all event participants
    const debtors = [...netByUser.entries()]
      .filter(([, n]) => n < 0)
      .map(([uid, n]) => ({ userId: uid, amount: -n }))
      .sort((a, b) => b.amount - a.amount);
    const creditors = [...netByUser.entries()]
      .filter(([, n]) => n > 0)
      .map(([uid, n]) => ({ userId: uid, amount: n }))
      .sort((a, b) => b.amount - a.amount);

    let d = 0, c = 0;
    while (d < debtors.length && c < creditors.length) {
      const transfer = Math.min(debtors[d].amount, creditors[c].amount);
      if (transfer > 0) {
        const fromId = debtors[d].userId;
        const toId   = creditors[c].userId;
        const involvesContact = fromId === contactId || toId === contactId;
        const involvesMe      = fromId === user.id   || toId === user.id;

        if (involvesContact && involvesMe) {
          // Direct me↔contact settlement for this event
          eventSettlements.push({
            eventId:  event.id,
            eventName: event.name,
            netCents: toId === user.id ? +transfer : -transfer,
          });
        } else if (involvesContact && !involvesMe) {
          // Contact's settlement with a third party
          const otherId = fromId === contactId ? toId : fromId;
          const otherParticipant = event.participants.find((p) => p.userId === otherId);
          othersDebts.push({
            eventId:         event.id,
            eventName:       event.name,
            contactOwes:     fromId === contactId,
            otherPersonName: otherParticipant?.user.name ?? null,
            amountCents:     transfer,
          });
        }
      }
      debtors[d].amount -= transfer;
      creditors[c].amount -= transfer;
      if (debtors[d].amount === 0) d++;
      if (creditors[c].amount === 0) c++;
    }
  }

  // ── Direct expense debts between the contact and third parties ───────────
  // Case A: contact is a split participant; payer is someone other than me or contact
  // Case B: contact is the payer; split includes someone other than me or contact
  const contactDirectDebts = await prisma.directExpense.findMany({
    where: {
      OR: [
        {
          splits: { some: { userId: contactId } },
          paidById: { notIn: [user.id, contactId] },
        },
        {
          paidById: contactId,
          splits: { some: { userId: { notIn: [user.id, contactId] } } },
        },
      ],
    },
    include: {
      paidByUser: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  for (const exp of contactDirectDebts) {
    if (exp.paidById !== contactId) {
      // Case A: third party paid → contact owes payer their share
      const contactSplit = exp.splits.find((s) => s.userId === contactId);
      if (contactSplit) {
        const shareCents = Math.round(
          exp.totalCents * (contactSplit.numerator / contactSplit.denominator)
        );
        if (shareCents > 0) {
          othersDebts.push({
            expenseId: exp.id,
            expenseDescription: exp.description,
            contactOwes: true,
            otherPersonName: exp.paidByUser.name,
            amountCents: shareCents,
          });
        }
      }
    } else {
      // Case B: contact paid → each third-party split participant owes contact
      for (const split of exp.splits) {
        if (split.userId === user.id || split.userId === contactId) continue;
        const shareCents = Math.round(
          exp.totalCents * (split.numerator / split.denominator)
        );
        if (shareCents > 0) {
          othersDebts.push({
            expenseId: exp.id,
            expenseDescription: exp.description,
            contactOwes: false,
            otherPersonName: split.user.name,
            amountCents: shareCents,
          });
        }
      }
    }
  }

  return { contact, sharedExpenses, eventSettlements, othersDebts };
}
