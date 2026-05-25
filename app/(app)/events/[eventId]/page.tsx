import { Metadata } from "next";
import Link from "next/link";
import { getEvent } from "@/lib/actions/events";
import { getEventBalances } from "@/lib/actions/balances";
import { requireUser } from "@/lib/server-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BalanceSheet } from "@/components/BalanceSheet";
import { formatCents } from "@/lib/utils";
import { calculateBillBalances } from "@/lib/ledger";
import { EditEventHeader } from "./EditEventHeader";
import { EditParticipants } from "./EditParticipants";
import { getMyParticipants } from "@/lib/actions/contacts";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: { params: { eventId: string } }) {
  const [me, event, balanceSummary, allParticipants] = await Promise.all([
    requireUser(),
    getEvent(params.eventId),
    getEventBalances(params.eventId),
    getMyParticipants(),
  ]);

  const members = event.participants.map((p) => ({
    id: p.userId,
    name: p.user.name,
    image: p.user.image,
  }));

  const eventTotal = event.establishments.reduce(
    (s, est) => s + est.bills.reduce((s2, b) => s2 + b.totalCents, 0),
    0
  );

  // Compute which participant IDs have expenses — derived from already-loaded data
  const usersWithExpenses = new Set<string>();
  for (const est of event.establishments) {
    for (const bill of est.bills) {
      for (const item of bill.lineItems) {
        for (const frac of item.fractions) usersWithExpenses.add(frac.userId);
      }
      for (const pmt of bill.payments) usersWithExpenses.add(pmt.userId);
    }
  }

  const currentParticipantIds = new Set(event.participants.map((p) => p.userId));

  const participantsWithFlags = event.participants.map((p) => ({
    id: p.userId,
    name: p.user.name,
    image: p.user.image,
    isMe: p.userId === me.id,
    isCreator: p.userId === event.createdById,
    hasExpenses: usersWithExpenses.has(p.userId),
  }));

  // Contacts not yet in this event
  const availableContacts = allParticipants.filter(
    (p) => !currentParticipantIds.has(p.id) && p.id !== me.id
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-brand-600 dark:hover:text-brand-400 mb-2 block">
          ← Home
        </Link>
        <div className="flex items-start justify-between gap-3">
          <EditEventHeader
            eventId={event.id}
            name={event.name}
            description={event.description}
            isOwner={event.createdById === me.id}
          />
          {eventTotal > 0 && (
            <div className="text-right shrink-0">
              <p className="text-xs text-zinc-500">Total</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-white">{formatCents(eventTotal)}</p>
            </div>
          )}
        </div>
        <div className="mt-2">
          <EditParticipants
            eventId={event.id}
            participants={participantsWithFlags}
            available={availableContacts}
          />
        </div>
      </div>

      {/* Add bill */}
      <Link href={`/events/${params.eventId}/bills/new`}>
        <Button variant="primary" size="lg" className="w-full">
          + Add bill
        </Button>
      </Link>

      {/* Balances (only show after first bill) */}
      {eventTotal > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-zinc-900 dark:text-white">Balances</h2>
          </CardHeader>
          <CardContent>
            <BalanceSheet summary={balanceSummary} members={members} />
          </CardContent>
        </Card>
      )}

      {/* Establishments */}
      {event.establishments.length === 0 ? (
        <EmptyState
          icon="🏪"
          title="No bills yet"
          description="Add a bill for a restaurant, activity, or any expense from this event."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {event.establishments.map((est) => (
            <Card key={est.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-zinc-900 dark:text-white">{est.name}</h2>
                    {est.category && <Badge variant="default" className="mt-1">{est.category}</Badge>}
                  </div>
                  <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 shrink-0">
                    {formatCents(est.bills.reduce((s, b) => s + b.totalCents, 0))}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {est.bills.map((bill) => (
                  <BillDetail key={bill.id} bill={bill} members={members} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bill detail (inline) ────────────────────────────────────────────────────

type BillProps = {
  bill: Awaited<ReturnType<typeof getEvent>>["establishments"][number]["bills"][number];
  members: Array<{ id: string; name?: string | null; image?: string | null }>;
};

function BillDetail({ bill, members }: BillProps) {
  let settlements: ReturnType<typeof calculateBillBalances>["settlements"] = [];
  try {
    const result = calculateBillBalances({
      totalCents: bill.totalCents,
      subtotalCents: bill.subtotalCents,
      taxCents: bill.taxCents,
      tipCents: bill.tipCents,
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
    settlements = result.settlements;
  } catch { /* skip */ }

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-1">
      <div className="flex flex-col gap-1 mb-3">
        {bill.lineItems.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">
              {item.name}{item.quantity > 1 && <span className="text-zinc-400 ml-1">×{item.quantity}</span>}
            </span>
            <span className="text-zinc-500">{formatCents(item.totalCents)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3 text-xs text-zinc-400 mb-3">
        <span>Sub: {formatCents(bill.subtotalCents)}</span>
        {bill.taxCents > 0 && <span>Tax: {formatCents(bill.taxCents)}</span>}
        {bill.tipCents > 0 && <span>Tip: {formatCents(bill.tipCents)}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {bill.payments.map((p) => {
          const u = members.find((m) => m.id === p.userId);
          return (
            <div key={p.userId} className="flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              <Avatar name={u?.name} image={u?.image} size="xs" />
              {u?.name} paid {formatCents(p.amountCents)}
            </div>
          );
        })}
      </div>
      {settlements.length > 0 && (
        <div className="rounded-xl bg-brand-50 dark:bg-brand-950/30 px-3 py-2 flex flex-col gap-1">
          {settlements.map((s, i) => {
            const from = members.find((m) => m.id === s.fromUserId);
            const to = members.find((m) => m.id === s.toUserId);
            return (
              <span key={i} className="text-xs text-brand-700 dark:text-brand-300">
                {from?.name} owes {to?.name} <strong>{formatCents(s.amountCents)}</strong>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
