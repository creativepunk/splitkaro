import { Metadata } from "next";
import Link from "next/link";
import { getEvent } from "@/lib/actions/events";
import { getEventBalances } from "@/lib/actions/balances";
import { requireUser } from "@/lib/server-auth";
import { formatCents } from "@/lib/utils";
import { EditEventHeader } from "./EditEventHeader";
import { EditParticipants } from "./EditParticipants";
import { EventTabs } from "./EventTabs";
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

      {/* Tabs: Bills · Balances · Settle Up */}
      <EventTabs
        eventId={params.eventId}
        members={members}
        establishments={event.establishments.map((est) => ({
          id: est.id,
          name: est.name,
          category: est.category,
          bills: est.bills.map((bill) => ({
            id: bill.id,
            totalCents: bill.totalCents,
            subtotalCents: bill.subtotalCents,
            taxCents: bill.taxCents,
            tipCents: bill.tipCents,
            gratuityCents: bill.gratuityCents,
            lineItems: bill.lineItems.map((li) => ({
              id: li.id,
              name: li.name,
              quantity: li.quantity,
              totalCents: li.totalCents,
              fractions: li.fractions.map((f) => ({
                userId: f.userId,
                numerator: f.numerator,
                denominator: f.denominator,
              })),
            })),
            payments: bill.payments.map((p) => ({
              userId: p.userId,
              amountCents: p.amountCents,
            })),
          })),
        }))}
        balanceSummary={balanceSummary}
      />
    </div>
  );
}
