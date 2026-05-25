"use client";

import { useState, useTransition } from "react";
import { updateEvent } from "@/lib/actions/events";

interface Props {
  eventId: string;
  name: string;
  description?: string | null;
  isOwner: boolean;
}

export function EditEventHeader({ eventId, name, description, isOwner }: Props) {
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
    });
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-brand-200 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-950/20 w-full">
        <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Edit event</p>
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
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">✈️ {name}</h1>
        {isOwner && (
          <button
            onClick={() => setEditing(true)}
            title="Edit event name"
            className="p-1 rounded-lg text-zinc-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
      {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
    </div>
  );
}
