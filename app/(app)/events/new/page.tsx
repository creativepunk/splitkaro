import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createEvent } from "@/lib/actions/events";
import { getMyParticipants } from "@/lib/actions/contacts";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

export const metadata: Metadata = { title: "New Event" };

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const participants = await getMyParticipants();

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">New Event</h1>
      <p className="text-sm text-zinc-500 mb-8">
        An event tracks all bills from a trip, dinner, or outing.
      </p>

      <form action={createEvent} className="flex flex-col gap-6">
        <Input name="name" label="Event name" placeholder="e.g. Chicago Weekend Trip" required maxLength={120} />
        <Input name="description" label="Description (optional)" placeholder="A quick note…" maxLength={500} />
        <div className="grid grid-cols-2 gap-4">
          <Input name="startDate" label="Start date" type="date" />
          <Input name="endDate" label="End date" type="date" />
        </div>

        {/* Participant picker */}
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
            Who's coming?
          </label>
          {participants.length === 1 ? (
            <p className="text-sm text-zinc-400 py-2">
              Only you so far — <a href="/people/new" className="text-brand-600 underline">add people</a> to include them.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {participants.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    name="participantIds"
                    value={p.id}
                    defaultChecked
                    className="h-4 w-4 rounded accent-brand-600"
                  />
                  <Avatar name={p.name} image={p.image} size="sm" />
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.name}</span>
                  {!p.isContact && <span className="ml-auto text-xs text-zinc-400">(you)</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" size="lg" variant="primary">
          Create event
        </Button>
      </form>
    </div>
  );
}
