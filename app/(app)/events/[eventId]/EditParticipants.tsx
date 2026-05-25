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
  available: Contact[];   // contacts not yet in event
}

export function EditParticipants({ eventId, participants, available }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const handleRemove = (userId: string) => {
    setBlockedMsg(null);
    startTransition(async () => {
      const { blockedNames } = await updateEventParticipants(eventId, { remove: [userId] });
      if (blockedNames.length > 0) {
        setBlockedMsg(
          `${blockedNames.join(", ")} ${blockedNames.length === 1 ? "has" : "have"} expenses in this event and cannot be removed.`
        );
      }
    });
  };

  const handleAdd = (userId: string) => {
    setBlockedMsg(null);
    startTransition(async () => {
      await updateEventParticipants(eventId, { add: [userId] });
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Participant chips + edit toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {participants.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5"
            >
              <Avatar name={m.name} image={m.image} size="xs" />
              <span className="text-xs text-zinc-600 dark:text-zinc-300">{m.name}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => { setOpen((o) => !o); setBlockedMsg(null); }}
          className="shrink-0 text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline"
        >
          {open ? "Done" : "Edit"}
        </button>
      </div>

      {/* Editing panel */}
      {open && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 flex flex-col gap-4">

          {blockedMsg && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {blockedMsg}
            </p>
          )}

          {/* Current participants */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">In this event</p>
            <div className="flex flex-col gap-1.5">
              {participants.map((p) => {
                const locked = p.isMe || p.isCreator || p.hasExpenses;
                const lockReason = p.isMe
                  ? "Can't remove yourself"
                  : p.isCreator
                  ? "Event creator can't be removed"
                  : p.hasExpenses
                  ? "Has expenses in this event"
                  : "";
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                  >
                    <Avatar name={p.name} image={p.image} size="sm" />
                    <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">
                      {p.name}
                      {p.isMe && <span className="ml-1.5 text-xs text-zinc-400">(you)</span>}
                      {p.isCreator && !p.isMe && <span className="ml-1.5 text-xs text-zinc-400">(creator)</span>}
                    </span>
                    {p.hasExpenses && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">has expenses</span>
                    )}
                    <button
                      onClick={() => handleRemove(p.id)}
                      disabled={locked || isPending}
                      title={lockReason}
                      className={[
                        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs transition",
                        locked
                          ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                          : "text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600",
                      ].join(" ")}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available contacts to add */}
          {available.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Add people</p>
              <div className="flex flex-col gap-1.5">
                {available.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                  >
                    <Avatar name={c.name} image={c.image} size="sm" />
                    <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">{c.name}</span>
                    <button
                      onClick={() => handleAdd(c.id)}
                      disabled={isPending}
                      className="shrink-0 rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {available.length === 0 && participants.length > 0 && (
            <p className="text-xs text-zinc-400 text-center">
              All your contacts are already in this event.{" "}
              <a href="/people/new" className="text-brand-600 dark:text-brand-400 underline">Add more people</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
