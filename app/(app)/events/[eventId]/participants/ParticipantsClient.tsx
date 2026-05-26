"use client";

import { useState, useTransition } from "react";
import { updateEventParticipants } from "@/lib/actions/events";
import { Avatar } from "@/components/ui/Avatar";

interface Participant {
  id: string;
  name?: string | null;
  image?: string | null;
  isMe: boolean;
  isCreator: boolean;
  hasExpenses: boolean;
}

interface Contact {
  id: string;
  name?: string | null;
  image?: string | null;
}

interface Props {
  eventId: string;
  participants: Participant[];
  available: Contact[];
}

export function ParticipantsClient({ eventId, participants, available }: Props) {
  const [isPending, startTransition] = useTransition();
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const handleRemove = (userId: string) => {
    setBlockedMsg(null);
    startTransition(async () => {
      const { blockedNames } = await updateEventParticipants(eventId, { remove: [userId] });
      if (blockedNames.length > 0) {
        setBlockedMsg(
          `${blockedNames.join(", ")} ${blockedNames.length === 1 ? "has" : "have"} expenses and cannot be removed.`
        );
      }
    });
  };

  const handleAdd = (userId: string) => {
    startTransition(async () => {
      await updateEventParticipants(eventId, { add: [userId] });
    });
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-8">
      {blockedMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {blockedMsg}
        </div>
      )}

      {/* Current participants list */}
      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {participants.map((p) => {
          const locked = p.isMe || p.isCreator || p.hasExpenses;
          const lockTitle = p.isMe
            ? "Can't remove yourself"
            : p.isCreator
            ? "Event creator can't be removed"
            : "Has expenses — cannot be removed";

          return (
            <div key={p.id} className="flex items-center gap-3 py-3.5">
              <Avatar name={p.name} image={p.image} size="md" />
              <span className="flex-1 text-base font-medium text-zinc-900 dark:text-white truncate">
                {p.name}
                {p.isMe && (
                  <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span>
                )}
              </span>
              <button
                onClick={() => handleRemove(p.id)}
                disabled={locked || isPending}
                title={locked ? lockTitle : "Remove"}
                className={[
                  "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
                  locked
                    ? "text-zinc-200 dark:text-zinc-700 cursor-not-allowed"
                    : "text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30",
                ].join(" ")}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add people */}
      {available.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400 py-1"
          >
            <span className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400 text-base font-bold shrink-0">
              +
            </span>
            Add people
          </button>

          {showAdd && (
            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {available.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={c.name} image={c.image} size="sm" />
                  <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {c.name}
                  </span>
                  <button
                    onClick={() => handleAdd(c.id)}
                    disabled={isPending}
                    className="shrink-0 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {available.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-2">
          All your contacts are already in this event.{" "}
          <a href="/people/new" className="text-brand-600 dark:text-brand-400 underline">
            Add more people
          </a>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
