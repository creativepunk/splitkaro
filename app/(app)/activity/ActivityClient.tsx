"use client";

import { useState, useTransition } from "react";
import { deleteDirectExpense } from "@/lib/actions/bills";
import { formatCents } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

interface Split {
  userId: string;
  numerator: number;
  denominator: number;
  user: { id: string; name: string | null };
}

interface Expense {
  id: string;
  description: string;
  totalCents: number;
  createdAt: Date;
  paidByUser: { id: string; name: string | null; image: string | null };
  splits: Split[];
}

interface Props {
  expenses: Expense[];
  currentUserId: string;
}

export function ActivityClient({ expenses, currentUserId }: Props) {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
        <span className="text-5xl">⚡</span>
        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">No activity yet</p>
        <p className="text-sm text-zinc-500">
          Quick expenses you add outside of events or groups will appear here.
        </p>
      </div>
    );
  }

  // Group expenses by date label
  const grouped = groupByDate(expenses);

  return (
    <div className="flex flex-col pb-8">
      {grouped.map(({ label, items }) => (
        <div key={label}>
          {/* Date header */}
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 border-y border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              {label}
            </p>
          </div>
          {/* Expense rows */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((exp) => (
              <ActivityRow key={exp.id} expense={exp} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single expense row with delete
// ---------------------------------------------------------------------------

function ActivityRow({
  expense,
  currentUserId,
}: {
  expense: Expense;
  currentUserId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isMine = expense.paidByUser.id === currentUserId;
  const isParticipant = expense.splits.some((s) => s.userId === currentUserId);

  const mySplit = expense.splits.find((s) => s.userId === currentUserId);
  const myShareCents = mySplit
    ? Math.round(expense.totalCents * (mySplit.numerator / mySplit.denominator))
    : 0;

  // "You lent" vs "You owe"
  const iLent = isMine && myShareCents < expense.totalCents;
  const iOwe = !isMine && isParticipant;
  const youLentCents = iLent ? expense.totalCents - myShareCents : 0;
  const youOweCents = iOwe ? myShareCents : 0;

  const paidLabel =
    expense.paidByUser.id === currentUserId
      ? "You paid"
      : `${expense.paidByUser.name ?? "Someone"} paid`;

  const splitLabel =
    expense.splits.length <= 1
      ? ""
      : expense.splits.length === 2
      ? `split with ${expense.splits.find((s) => s.userId !== currentUserId)?.user.name ?? "1 other"}`
      : `split with ${expense.splits.length - 1} others`;

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDirectExpense(expense.id);
    });
  };

  if (confirming) {
    return (
      <div className="px-4 py-3 flex flex-col gap-3 bg-red-50 dark:bg-red-950/20">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
          Delete &quot;{expense.description}&quot;?
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
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {/* Payer avatar */}
      <Avatar name={expense.paidByUser.name} image={expense.paidByUser.image} size="sm" />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
          {expense.description}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">
          {paidLabel} {formatCents(expense.totalCents)}
          {splitLabel && <> · {splitLabel}</>}
        </p>
      </div>

      {/* Net amount for current user */}
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        {iLent && youLentCents > 0 && (
          <>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">you lent</p>
            <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">
              {formatCents(youLentCents)}
            </p>
          </>
        )}
        {iOwe && youOweCents > 0 && (
          <>
            <p className="text-xs text-red-500 dark:text-red-400 font-medium">you owe</p>
            <p className="text-sm font-bold tabular-nums text-red-500 dark:text-red-400">
              {formatCents(youOweCents)}
            </p>
          </>
        )}
        {!iLent && !iOwe && (
          <p className="text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
            {formatCents(expense.totalCents)}
          </p>
        )}
      </div>

      {/* Delete */}
      {(isMine || isParticipant) && (
        <button
          onClick={() => setConfirming(true)}
          title="Delete"
          className="shrink-0 p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date grouping helper
// ---------------------------------------------------------------------------

function groupByDate(expenses: Expense[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const buckets = new Map<string, Expense[]>();

  for (const exp of expenses) {
    const d = new Date(exp.createdAt);
    d.setHours(0, 0, 0, 0);

    let label: string;
    if (d.getTime() === today.getTime()) {
      label = "Today";
    } else if (d.getTime() === yesterday.getTime()) {
      label = "Yesterday";
    } else if (d >= weekAgo) {
      label = "This week";
    } else {
      label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(exp);
  }

  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
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
