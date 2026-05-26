import { Metadata } from "next";
import Link from "next/link";
import { getEvent } from "@/lib/actions/events";
import { getMyParticipants } from "@/lib/actions/contacts";
import { requireUser } from "@/lib/server-auth";
import { ParticipantsClient } from "./ParticipantsClient";

export const metadata: Metadata = { title: "Participants" };

export default async function ParticipantsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const [me, event, allParticipants] = await Promise.all([
    requireUser(),
    getEvent(params.eventId),
    getMyParticipants(),
  ]);

  const currentIds = new Set(event.participants.map((p) => p.userId));

  // Compute which users have expenses (cannot be removed)
  const usersWithExpenses = new Set<string>();
  for (const est of event.establishments) {
    for (const bill of est.bills) {
      for (const item of bill.lineItems) {
        for (const frac of item.fractions) usersWithExpenses.add(frac.userId);
      }
      for (const pmt of bill.payments) usersWithExpenses.add(pmt.userId);
    }
  }

  const participants = event.participants.map((p) => ({
    id: p.userId,
    name: p.user.name,
    image: p.user.image,
    isMe: p.userId === me.id,
    isCreator: p.userId === event.createdById,
    hasExpenses: usersWithExpenses.has(p.userId),
  }));

  const available = allParticipants.filter(
    (p) => !currentIds.has(p.id) && p.id !== me.id
  );

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Link
          href={`/events/${params.eventId}`}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 shrink-0"
          aria-label="Back"
        >
          <BackIcon />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-zinc-900 dark:text-white">
          Participants
        </h1>
      </div>

      {/* List */}
      <div className="flex-1 pt-2">
        <ParticipantsClient
          eventId={params.eventId}
          participants={participants}
          available={available}
        />
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
