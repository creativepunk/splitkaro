"use client";

import { useState, useTransition } from "react";
import { deleteDirectExpense, updateDirectExpense } from "@/lib/actions/bills";
import { formatCents } from "@/lib/utils";

interface Expense {
  id: string;
  description: string;
  totalCents: number;
  createdAt: Date;
  paidById: string;
}

interface Props {
  expense: Expense;
  currentUserId: string;
  contactName: string;
  netAmount: number;
  amountLabel: string;
  amountColor: string;
  amountSign: string;
}

export function ExpenseRow({
  expense,
  currentUserId,
  contactName,
  netAmount,
  amountLabel,
  amountColor,
  amountSign,
}: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [desc, setDesc] = useState(expense.description);
  const [amountStr, setAmountStr] = useState((expense.totalCents / 100).toFixed(2));
  const [isPending, startTransition] = useTransition();

  const isMine = expense.paidById === currentUserId;

  const handleSave = () => {
    const cents = Math.round(parseFloat(amountStr) * 100);
    if (!desc.trim() || isNaN(cents) || cents <= 0) return;
    startTransition(async () => {
      await updateDirectExpense(expense.id, { description: desc.trim(), totalCents: cents });
      setMode("view");
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDirectExpense(expense.id);
    });
  };

  const formattedDate = new Date(expense.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-brand-200 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-950/20">
        <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Edit expense</p>
        <input
          autoFocus
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setMode("view"); }}
          placeholder="Description"
          className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500 shrink-0">Total $</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => { setDesc(expense.description); setAmountStr((expense.totalCents / 100).toFixed(2)); setMode("view"); }}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "confirmDelete") {
    return (
      <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 flex flex-col gap-3">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
          Delete "{expense.description}"?
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setMode("view")}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{expense.description}</p>
        <p className="text-xs text-zinc-500">
          {formattedDate} · {formatCents(expense.totalCents)} total
        </p>
      </div>
      {netAmount > 0 && (
        <div className="text-right shrink-0">
          <p className="text-xs text-zinc-500">{amountLabel}</p>
          <p className={`text-sm font-semibold ${amountColor}`}>
            {amountSign}{formatCents(netAmount)}
          </p>
        </div>
      )}
      {/* Only the payer can edit/delete */}
      {isMine && (
        <div className="flex gap-1 shrink-0 ml-1">
          <button
            onClick={() => setMode("edit")}
            title="Edit"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setMode("confirmDelete")}
            title="Delete"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
