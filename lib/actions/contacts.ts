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

export interface BillBreakdown {
  billId: string;
  eventId: string;
  eventName: string;
  establishmentName: string;
  createdAt: Date;
  billTotalCents: number;
  itemCount: number;
  /** positive = they owe me from this bill, negative = I owe them */
  netCents: number;
  myOwedCents: number;    // my consumption share of this bill
  theirOwedCents: number; // their consumption share
  myPaidCents: number;    // how much I physically paid
  theirPaidCents: number;
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

  // Dynamically import to avoid circular deps
  const { getGlobalBalances } = await import("./balances");

  const [{ balances }, sharedExpenses, sharedEvents] = await Promise.all([
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

  // ── Compute per-bill breakdown ──────────────────────────────────────────
  const billBreakdowns: BillBreakdown[] = [];

  for (const event of sharedEvents) {
    for (const est of event.establishments) {
      for (const bill of est.bills) {
        const myInvolved =
          bill.lineItems.some((li) => li.fractions.some((f) => f.userId === user.id)) ||
          bill.payments.some((p) => p.userId === user.id);
        const theirInvolved =
          bill.lineItems.some((li) => li.fractions.some((f) => f.userId === contactId)) ||
          bill.payments.some((p) => p.userId === contactId);

        if (!myInvolved || !theirInvolved) continue;

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

          // Net between me and this contact specifically
          let netCents = 0;
          for (const s of result.settlements) {
            if (s.toUserId === user.id && s.fromUserId === contactId) {
              netCents += s.amountCents; // they owe me
            } else if (s.fromUserId === user.id && s.toUserId === contactId) {
              netCents -= s.amountCents; // I owe them
            }
          }

          const myBal = result.userBalances.find((b) => b.userId === user.id);
          const theirBal = result.userBalances.find((b) => b.userId === contactId);

          billBreakdowns.push({
            billId: bill.id,
            eventId: event.id,
            eventName: event.name,
            establishmentName: est.name,
            createdAt: bill.createdAt,
            billTotalCents: bill.totalCents,
            itemCount: bill.lineItems.length,
            netCents,
            myOwedCents: myBal?.owedCents ?? 0,
            theirOwedCents: theirBal?.owedCents ?? 0,
            myPaidCents: bill.payments.find((p) => p.userId === user.id)?.amountCents ?? 0,
            theirPaidCents: bill.payments.find((p) => p.userId === contactId)?.amountCents ?? 0,
          });
        } catch { /* skip malformed bills */ }
      }
    }
  }

  // ── Compute per-event debts between the contact and everyone else ──────
  // (settlements that don't involve me at all, or where I'm not one of the parties)
  const othersDebts: ContactOtherDebt[] = [];

  for (const event of sharedEvents) {
    // Aggregate per-user netCents across all bills in this event
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
        } catch { /* skip */ }
      }
    }

    // Greedy minimal settlements across all participants in this event
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
        const toId = creditors[c].userId;
        const involvesContact = fromId === contactId || toId === contactId;
        const involvesMe = fromId === user.id || toId === user.id;
        // Show: contact ↔ other people (whether or not I'm involved)
        if (involvesContact && !involvesMe) {
          const otherId = fromId === contactId ? toId : fromId;
          const otherParticipant = event.participants.find((p) => p.userId === otherId);
          othersDebts.push({
            eventId:   event.id,
            eventName: event.name,
            contactOwes: fromId === contactId,
            otherPersonName: otherParticipant?.user.name ?? null,
            amountCents: transfer,
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

  const netCents = balances.find((b) => b.userId === contactId)?.netCents ?? 0;

  return { contact, netCents, sharedExpenses, billBreakdowns, othersDebts };
}
