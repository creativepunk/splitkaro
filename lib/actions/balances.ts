"use server";

import { prisma } from "@/lib/prisma";
import { calculateBillBalances, type Settlement } from "@/lib/ledger";
import { requireUser } from "@/lib/server-auth";

export interface PersonBalance {
  userId: string;
  name: string | null;
  image: string | null;
  isContact: boolean;
  /** positive = they owe you; negative = you owe them */
  netCents: number;
}

export interface RichSettlement {
  fromUserId: string;
  fromName: string | null;
  toUserId: string;
  toName: string | null;
  amountCents: number;
}

export interface GlobalBalanceSummary {
  balances: PersonBalance[];
  /** Minimal set of transfers to settle all debts (includes the current user). */
  settlements: RichSettlement[];
  currentUserId: string;
}

/**
 * Compute net balances between the current user and all their contacts
 * across every event bill and every direct expense they share.
 */
export async function getGlobalBalances(): Promise<GlobalBalanceSummary> {
  const me = await requireUser();

  // Load all contacts
  const contacts = await prisma.user.findMany({
    where: { isContact: true, contactOwnerId: me.id },
    select: { id: true, name: true, image: true, isContact: true },
  });

  // netCents[userId] = how much they owe me (positive) or I owe them (negative)
  const net = new Map<string, number>();
  contacts.forEach((c) => net.set(c.id, 0));

  // ── Event bills ──────────────────────────────────────────────────────────
  const events = await prisma.event.findMany({
    where: { participants: { some: { userId: me.id } } },
    include: {
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
            payments: bill.payments.map((p) => ({
              userId: p.userId,
              amountCents: p.amountCents,
            })),
          });

          // Use settlements — cleaner
          for (const s of result.settlements) {
            if (s.toUserId === me.id && net.has(s.fromUserId)) {
              net.set(s.fromUserId, (net.get(s.fromUserId) ?? 0) + s.amountCents);
            } else if (s.fromUserId === me.id && net.has(s.toUserId)) {
              net.set(s.toUserId, (net.get(s.toUserId) ?? 0) - s.amountCents);
            }
          }
        } catch {
          // skip malformed bills
        }
      }
    }
  }

  // ── Direct expenses ──────────────────────────────────────────────────────
  // Fetch expenses where I paid OR I'm a split participant
  const directExpenses = await prisma.directExpense.findMany({
    where: {
      OR: [
        { paidById: me.id },
        { splits: { some: { userId: me.id } } },
      ],
    },
    include: { splits: true },
  });

  for (const de of directExpenses) {
    if (de.paidById === me.id) {
      // I paid — every other split participant owes me their share
      for (const split of de.splits) {
        if (split.userId === me.id) continue;
        if (!net.has(split.userId)) continue;
        const theirShare = Math.round((de.totalCents * split.numerator) / split.denominator);
        net.set(split.userId, (net.get(split.userId) ?? 0) + theirShare);
      }
    } else {
      // Someone else paid — I owe them my share
      const mySplit = de.splits.find((s) => s.userId === me.id);
      if (!mySplit) continue;
      const myOwedCents = Math.round((de.totalCents * mySplit.numerator) / mySplit.denominator);
      if (net.has(de.paidById)) {
        net.set(de.paidById, (net.get(de.paidById) ?? 0) - myOwedCents);
      }
    }
  }

  const balances: PersonBalance[] = contacts.map((c) => ({
    userId: c.id,
    name: c.name,
    image: c.image,
    isContact: c.isContact,
    netCents: net.get(c.id) ?? 0,
  }));

  // ── Greedy minimal settlements across ALL participants (contacts + me) ────
  // Sign convention for the settlement graph:
  //   amount > 0 → creditor (should RECEIVE money)
  //   amount < 0 → debtor   (should PAY money)
  //
  // net[contact] is stored from Pushpal's perspective:
  //   net[X] > 0 means X owes Pushpal → X is a DEBTOR  → settlement amount = -net[X]
  //   net[X] < 0 means Pushpal owes X → X is a CREDITOR → settlement amount = -net[X]
  // For Pushpal: amount = sum of net[X] (positive = net creditor, negative = net debtor)
  const contactNetSum = balances.reduce((s, b) => s + b.netCents, 0);

  const allParticipants: Array<{ userId: string; name: string | null; amount: number }> = [
    { userId: me.id, name: me.name, amount: contactNetSum },        // +ve = I'm owed overall
    ...balances.map((b) => ({ userId: b.userId, name: b.name, amount: -b.netCents })), // flip: +ve net from my view → they're a debtor
  ];

  const debtors = allParticipants
    .filter((p) => p.amount < 0)
    .map((p) => ({ ...p, amount: -p.amount }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = allParticipants
    .filter((p) => p.amount > 0)
    .map((p) => ({ ...p }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: RichSettlement[] = [];
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) {
    const transfer = Math.min(debtors[d].amount, creditors[c].amount);
    if (transfer > 0) {
      settlements.push({
        fromUserId: debtors[d].userId,
        fromName:   debtors[d].name,
        toUserId:   creditors[c].userId,
        toName:     creditors[c].name,
        amountCents: transfer,
      });
    }
    debtors[d].amount -= transfer;
    creditors[c].amount -= transfer;
    if (debtors[d].amount === 0) d++;
    if (creditors[c].amount === 0) c++;
  }

  return { balances, settlements, currentUserId: me.id };
}

// ── Per-event balance (for the event detail page) ──────────────────────────

export interface EventBalanceSummary {
  balances: Array<{ userId: string; name: string | null; image: string | null; netCents: number }>;
  settlements: Settlement[];
}

export async function getEventBalances(eventId: string): Promise<EventBalanceSummary> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      participants: { include: { user: { select: { id: true, name: true, image: true } } } },
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

  if (!event) return { balances: [], settlements: [] };

  const netByUser = new Map<string, number>();
  event.participants.forEach((p) => netByUser.set(p.userId, 0));

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
          payments: bill.payments.map((p) => ({ userId: p.userId, amountCents: p.amountCents })),
        });
        for (const ub of result.userBalances) {
          netByUser.set(ub.userId, (netByUser.get(ub.userId) ?? 0) + ub.netCents);
        }
      } catch { /* skip */ }
    }
  }

  const balances = event.participants.map((p) => ({
    userId: p.userId,
    name: p.user.name,
    image: p.user.image,
    netCents: netByUser.get(p.userId) ?? 0,
  }));

  const debtors = balances.filter((b) => b.netCents < 0).map((b) => ({ userId: b.userId, amount: -b.netCents })).sort((a, b) => b.amount - a.amount);
  const creditors = balances.filter((b) => b.netCents > 0).map((b) => ({ userId: b.userId, amount: b.netCents })).sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const t = Math.min(debtors[di].amount, creditors[ci].amount);
    if (t > 0) settlements.push({ fromUserId: debtors[di].userId, toUserId: creditors[ci].userId, amountCents: t });
    debtors[di].amount -= t; creditors[ci].amount -= t;
    if (debtors[di].amount === 0) di++;
    if (creditors[ci].amount === 0) ci++;
  }

  return { balances, settlements };
}
