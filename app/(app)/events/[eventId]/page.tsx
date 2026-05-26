import { Metadata } from "next";
import { getEvent } from "@/lib/actions/events";
import { getEventBalances } from "@/lib/actions/balances";
import { requireUser } from "@/lib/server-auth";
import { EventHeader } from "./EventHeader";
import { EventTabs } from "./EventTabs";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: { params: { eventId: string } }) {
  const [me, event, balanceSummary] = await Promise.all([
    requireUser(),
    getEvent(params.eventId),
    getEventBalances(params.eventId),
  ]);

  const members = event.participants.map((p) => ({
    id: p.userId,
    name: p.user.name,
    image: p.user.image,
  }));

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950">
      {/* Header: back + title + avatar row */}
      <EventHeader
        eventId={event.id}
        name={event.name}
        description={event.description}
        isOwner={event.createdById === me.id}
        participants={members}
        backHref="/dashboard"
      />

      {/* Tabs: Bills · Settle up · Balances */}
      <div className="flex-1 px-4 pb-8">
        <EventTabs
          eventId={params.eventId}
          currentUserId={me.id}
          members={members}
          establishments={event.establishments.map((est) => ({
            id: est.id,
            name: est.name,
            category: est.category,
            bills: est.bills.map((bill) => ({
              id: bill.id,
              createdAt: bill.createdAt.toISOString(),
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
    </div>
  );
}
