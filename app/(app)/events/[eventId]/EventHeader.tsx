"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateEvent } from "@/lib/actions/events";
import { Avatar } from "@/components/ui/Avatar";

interface Participant {
  id: string;
  name?: string | null;
  image?: string | null;
}

interface Props {
  eventId: string;
  name: string;
  description?: string | null;
  isOwner: boolean;
  participants: Participant[];
  backHref?: string;
}

const MAX_SHOWN = 4;

export function EventHeader({
  eventId,
  name,
  description,
  isOwner,
  participants,
  backHref = "/dashboard",
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(name);
  const [descVal, setDescVal] = useState(description ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!nameVal.trim()) return;
    startTransition(async () => {
      await updateEvent(eventId, {
        name: nameVal.trim(),
        description: descVal.trim() || undefined,
      });
      setEditing(false);
      setMenuOpen(false);
    });
  };

  const shown = participants.slice(0, MAX_SHOWN);
  const overflow = participants.length - MAX_SHOWN;

  return (
    <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
      {/* Top row: back ← and ··· */}
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
          aria-label="Back"
        >
          <BackIcon />
        </Link>

        {/* ··· menu */}
        <div className="relative">
          <button
            onClick={() => { setMenuOpen((o) => !o); setEditing(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
            aria-label="Options"
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-10 z-20 min-w-[140px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                {isOwner && (
                  <button
                    onClick={() => { setEditing(true); setMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Edit event
                  </button>
                )}
                <Link
                  href={`/events/${eventId}/participants`}
                  className="block px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Manage participants
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit form — shown instead of title when editing */}
      {editing ? (
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-brand-200 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-950/20">
          <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">
            Edit event
          </p>
          <input
            autoFocus
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
            placeholder="Event name"
            className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            value={descVal}
            onChange={(e) => setDescVal(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !nameVal.trim()}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setNameVal(name); setDescVal(description ?? ""); setEditing(false); }}
              className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">
              {name}
            </h1>
            {description && (
              <p className="text-sm text-zinc-500 mt-0.5">{description}</p>
            )}
          </div>

          {/* Participant avatar row — tap to manage */}
          {participants.length > 0 && (
            <Link
              href={`/events/${eventId}/participants`}
              className="flex items-center gap-1 self-start group"
              aria-label={`${participants.length} participants`}
            >
              <div className="flex items-center -space-x-2">
                {shown.map((p) => (
                  <div
                    key={p.id}
                    className="ring-2 ring-white dark:ring-zinc-950 rounded-full"
                  >
                    <Avatar name={p.name} image={p.image} size="sm" />
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="ring-2 ring-white dark:ring-zinc-950 w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      +{overflow}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

function DotsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  );
}
