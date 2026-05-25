"use client";

import { useState } from "react";
import { createDirectExpense } from "@/lib/actions/bills";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { parseDollarsToCents } from "@/lib/utils";

interface Props {
  groupId: string;
  currentUserId: string;
  members: Array<{ id: string; name: string; image?: string | null }>;
}

export function DirectExpenseClient({ groupId, currentUserId, members }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splits, setSplits] = useState<Record<string, boolean>>(
    Object.fromEntries(members.map((m) => [m.id, true]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMembers = members.filter((m) => splits[m.id]);
  const n = selectedMembers.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || n === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      await createDirectExpense({
        groupId,
        description,
        currency: "USD",
        totalCents: parseDollarsToCents(amount),
        splits: selectedMembers.map((m) => ({
          userId: m.id,
          numerator: 1,
          denominator: n,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Quick Expense</h1>
      <p className="text-sm text-zinc-500 mb-8">A single lump-sum split between members.</p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input
          label="Description"
          placeholder="e.g. Gas money"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <Input
          label="Total amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
            Split equally between
          </label>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={splits[m.id]}
                  onChange={(e) => setSplits((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                  className="h-4 w-4 rounded accent-brand-600"
                />
                <Avatar name={m.name} image={m.image} size="sm" />
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1">
                  {m.name}
                  {m.id === currentUserId && (
                    <span className="ml-1 text-xs text-zinc-400">(you)</span>
                  )}
                </span>
                {splits[m.id] && n > 0 && (
                  <span className="text-xs text-zinc-400">1/{n}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          variant="primary"
          loading={submitting}
          disabled={selectedMembers.length === 0}
        >
          Save expense
        </Button>
      </form>
    </div>
  );
}
