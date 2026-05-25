import { Metadata } from "next";
import Link from "next/link";
import { getMyEvents } from "@/lib/actions/events";
import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const events = await getMyEvents();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Events</h1>
        <Link href="/events/new">
          <Button size="sm" variant="primary">+ New event</Button>
        </Link>
      </div>
      {events.length === 0 ? (
        <EmptyState icon="✈️" title="No events yet" description="Create an event for a trip, dinner, or any short-term outing.">
          <Link href="/events/new"><Button variant="primary" size="md">Create first event</Button></Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={{
                id: event.id,
                groupId: "",  // standalone events don't need groupId for linking
                name: event.name,
                startDate: event.startDate ?? null,
                endDate: event.endDate ?? null,
                _count: { establishments: event._count.establishments },
                establishments: event.establishments,
              }}
              href={`/events/${event.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
