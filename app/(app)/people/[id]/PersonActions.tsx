"use client";

import { useState, useTransition } from "react";
import { deleteContact, renameContact } from "@/lib/actions/contacts";

interface Props {
  contactId: string;
  currentName: string;
}

export function PersonActions({ contactId, currentName }: Props) {
  const [mode, setMode] = useState<"idle" | "rename" | "confirmDelete">("idle");
  const [name, setName] = useState(currentName);
  const [isPending, startTransition] = useTransition();

  const handleRename = () => {
    if (!name.trim() || name.trim() === currentName) { setMode("idle"); return; }
    startTransition(async () => {
      await renameContact(contactId, name.trim());
      setMode("idle");
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteContact(contactId);
    });
  };

  if (mode === "rename") {
    return (
      <div className="flex gap-2 items-center w-full">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setMode("idle"); }}
          className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={handleRename}
          disabled={isPending}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => { setName(currentName); setMode("idle"); }}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "confirmDelete") {
    return (
      <div className="w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 flex flex-col gap-3">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
          Delete {currentName}? This will remove the contact and all associated expense records.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => setMode("idle")}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 w-full">
      <button
        onClick={() => setMode("rename")}
        className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
      >
        ✏️ Rename
      </button>
      <button
        onClick={() => setMode("confirmDelete")}
        className="flex-1 rounded-xl border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
      >
        🗑️ Delete
      </button>
    </div>
  );
}
