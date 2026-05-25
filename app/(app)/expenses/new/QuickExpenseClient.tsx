"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDirectExpense } from "@/lib/actions/bills";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PriceInput } from "@/components/ui/PriceInput";
import { Avatar } from "@/components/ui/Avatar";

type Participant = { id: string; name: string | null; isContact: boolean };

export function QuickExpenseClient({
  participants,
  initialTarget,
}: {
  participants: Participant[];
  initialTarget?: string;
}) {
  const router = useRouter();
  const me = participants.find((p) => !p.isContact);

  const [description, setDescription] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  
  // Who paid? (Default to self)
  const [payerId, setPayerId] = useState(me?.id ?? "");

  // Who is splitting it? (Default to self + initialTarget if present)
  const [splitWithIds, setSplitWithIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (me) s.add(me.id);
    if (initialTarget && participants.some((p) => p.id === initialTarget)) {
      s.add(initialTarget);
    }
    return s;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSplit = (id: string) => {
    setSplitWithIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!description.trim() || totalCents <= 0 || splitWithIds.size === 0 || !payerId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const splits = Array.from(splitWithIds).map((userId) => ({
        userId,
        numerator: 1,
        denominator: splitWithIds.size,
      }));

      await createDirectExpense({
        description: description.trim(),
        totalCents,
        splits,
        // No groupId or eventId
      });
      // The server action handles redirect to dashboard/profile
    } catch (e) {
      console.error(e);
      alert("Failed to create expense");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <Input
          placeholder="e.g. Dinner, Uber, Groceries"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Total Amount
        </label>
        <div className="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 focus-within:ring-2 ring-brand-500 bg-white dark:bg-zinc-900">
          <span className="text-zinc-500 font-medium">₹</span>
          <PriceInput
            valueCents={totalCents}
            onChange={setTotalCents}
            className="flex-1 text-lg"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Paid by
        </label>
        <select
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white"
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === me?.id ? "You" : p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Split evenly between
        </label>
        <div className="flex flex-col gap-2">
          {participants.map((p) => {
            const isChecked = splitWithIds.has(p.id);
            const pct = isChecked ? Number((100 / splitWithIds.size).toFixed(1)).toString() : "0";
            return (
              <label
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSplit(p.id)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-5 h-5 flex-shrink-0"
                />
                <Avatar name={p.name!} size="sm" />
                <span className="text-sm font-medium text-zinc-900 dark:text-white flex-1 truncate">
                  {p.id === me?.id ? "You" : p.name}
                </span>
                {isChecked && (
                  <span className="text-xs text-zinc-400 w-12 text-right tabular-nums">{pct}%</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="mt-4"
        disabled={isSubmitting || !description.trim() || totalCents <= 0 || splitWithIds.size === 0}
        onClick={handleSave}
      >
        {isSubmitting ? "Saving..." : "Save Expense"}
      </Button>
    </div>
  );
}
