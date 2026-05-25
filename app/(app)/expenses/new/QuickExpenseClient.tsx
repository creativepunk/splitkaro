"use client";

import { useState, useTransition } from "react";
import { createDirectExpense } from "@/lib/actions/bills";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PriceInput } from "@/components/ui/PriceInput";
import { Avatar } from "@/components/ui/Avatar";
import { formatCents } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Participant = {
  id: string;
  name: string | null;
  image?: string | null;
  isContact: boolean;
};

type SplitParticipant = { userId: string; parts: number };
type Step = "details" | "split" | "payment";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QuickExpenseClient({
  participants,
  initialTarget,
}: {
  participants: Participant[];
  initialTarget?: string;
}) {
  const me = participants.find((p) => !p.isContact);

  const [step, setStep] = useState<Step>("details");
  const [description, setDescription] = useState("");
  const [totalCents, setTotalCents] = useState(0);

  // Who splits — default: current user + initialTarget (if present), parts = 1
  const [splitParticipants, setSplitParticipants] = useState<SplitParticipant[]>(() =>
    participants.map((p) => ({
      userId: p.id,
      parts:
        p.id === me?.id || (initialTarget && p.id === initialTarget) ? 1 : 0,
    }))
  );

  // Who paid — default: current user
  const [payerId, setPayerId] = useState(me?.id ?? "");

  const [isPending, startTransition] = useTransition();

  // ── Split helpers ───────────────────────────────────────────────────────
  const setParts = (userId: string, parts: number) =>
    setSplitParticipants((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, parts: Math.max(0, parts) } : p))
    );

  const equalSplit = () =>
    setSplitParticipants((prev) => prev.map((p) => ({ ...p, parts: 1 })));

  const uncheckAll = () =>
    setSplitParticipants((prev) => prev.map((p) => ({ ...p, parts: 0 })));

  const totalParts = splitParticipants.reduce((s, p) => s + p.parts, 0);
  const anyAssigned = totalParts > 0;
  const assignedCount = splitParticipants.filter((p) => p.parts > 0).length;

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!description.trim() || totalCents <= 0 || !anyAssigned || !payerId) return;
    startTransition(async () => {
      const splits = splitParticipants
        .filter((p) => p.parts > 0)
        .map((p) => ({
          userId: p.userId,
          numerator: p.parts,
          denominator: totalParts,
        }));
      await createDirectExpense({
        description: description.trim(),
        totalCents,
        currency: "INR",
        paidById: payerId,
        splits,
      });
    });
  };

  // ── Split full-page screen ───────────────────────────────────────────────
  if (step === "split") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 max-w-lg mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setStep("details")}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
            aria-label="Back"
          >
            <XIcon />
          </button>
          <h2 className="flex-1 text-base font-semibold text-zinc-900 dark:text-white truncate">
            Split between
          </h2>
          <button
            onClick={() => anyAssigned && setStep("payment")}
            disabled={!anyAssigned}
            className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-950/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>

        {/* Participant list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 px-4">
            {splitParticipants.map((sp) => {
              const person = participants.find((p) => p.id === sp.userId);
              const isIn = sp.parts > 0;
              const pct =
                totalParts > 0 && isIn ? Math.round((sp.parts / totalParts) * 100) : 0;
              const share =
                totalParts > 0 && isIn && totalCents > 0
                  ? Math.round((totalCents * sp.parts) / totalParts)
                  : null;

              return (
                <div key={sp.userId} className="flex items-center gap-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={isIn}
                    onChange={() => setParts(sp.userId, isIn ? 0 : 1)}
                    className="shrink-0 w-5 h-5 rounded border-zinc-300 dark:border-zinc-600 text-brand-600 accent-brand-600 cursor-pointer"
                  />
                  <Avatar name={person?.name} image={person?.image} size="sm" />
                  <span
                    className={cn(
                      "flex-1 text-sm font-medium truncate",
                      isIn
                        ? "text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-400 dark:text-zinc-600"
                    )}
                  >
                    {sp.userId === me?.id ? "You" : person?.name}
                  </span>

                  {isIn ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setParts(sp.userId, sp.parts - 1)}
                        className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-base font-medium text-zinc-600 dark:text-zinc-300 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
                        {sp.parts}
                      </span>
                      <button
                        onClick={() => setParts(sp.userId, sp.parts + 1)}
                        className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-base font-medium text-zinc-600 dark:text-zinc-300 transition-colors"
                      >
                        +
                      </button>
                      <div className="flex flex-col items-end w-14 shrink-0">
                        <span className="text-xs tabular-nums text-zinc-400">{pct}%</span>
                        {share !== null && (
                          <span className="text-xs tabular-nums font-medium text-zinc-600 dark:text-zinc-400">
                            {formatCents(share)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400 shrink-0">excluded</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky bottom */}
        <div className="sticky bottom-0 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 flex gap-2">
          <button
            onClick={equalSplit}
            className="flex-1 text-sm font-medium text-brand-600 dark:text-brand-400 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
          >
            Equal split
          </button>
          <button
            onClick={uncheckAll}
            className="flex-1 text-sm font-medium text-zinc-500 dark:text-zinc-400 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            Uncheck all
          </button>
        </div>
      </div>
    );
  }

  // ── Payment full-page screen ─────────────────────────────────────────────
  if (step === "payment") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 max-w-lg mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setStep("split")}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
            aria-label="Back"
          >
            <XIcon />
          </button>
          <h2 className="flex-1 text-base font-semibold text-zinc-900 dark:text-white truncate">
            Who paid?
          </h2>
          <button
            onClick={handleSubmit}
            disabled={isPending || !payerId}
            className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-950/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Payer list — radio-style tap to select */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 px-4">
            {participants.map((p) => {
              const isSelected = payerId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPayerId(p.id)}
                  className="w-full flex items-center gap-3 py-3.5 text-left"
                >
                  {/* Radio dot */}
                  <div
                    className={cn(
                      "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-brand-600 bg-brand-600"
                        : "border-zinc-300 dark:border-zinc-600"
                    )}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <Avatar name={p.name} image={p.image} size="sm" />
                  <span
                    className={cn(
                      "flex-1 text-sm font-medium truncate",
                      isSelected
                        ? "text-zinc-900 dark:text-white"
                        : "text-zinc-500 dark:text-zinc-400"
                    )}
                  >
                    {p.id === me?.id ? "You" : p.name}
                  </span>
                  {isSelected && totalCents > 0 && (
                    <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 shrink-0">
                      {formatCents(totalCents)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Details screen ───────────────────────────────────────────────────────
  const isAllAssigned = assignedCount === participants.length;
  const payerName =
    payerId === me?.id
      ? "You"
      : (participants.find((p) => p.id === payerId)?.name ?? "Nobody");

  return (
    <div className="flex flex-col gap-5">
      {/* Description */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <Input
          autoFocus
          placeholder="e.g. Dinner, Uber, Groceries"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Total Amount
        </label>
        <div className="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 focus-within:ring-2 ring-brand-500 bg-white dark:bg-zinc-900">
          <span className="text-zinc-500 font-medium">₹</span>
          <PriceInput
            valueCents={totalCents}
            onChange={setTotalCents}
            className="flex-1 text-lg"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Summary rows — tap to open split / payment screens */}
      <div className="flex flex-col gap-2">
        {/* Split row */}
        <button
          onClick={() => setStep("split")}
          className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
        >
          <PeopleIcon className="w-4 h-4 text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Split between</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {assignedCount === 0
                ? "Nobody selected"
                : isAllAssigned
                ? "Everyone"
                : `${assignedCount} ${assignedCount === 1 ? "person" : "people"}`}
            </p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
        </button>

        {/* Payer row */}
        <button
          onClick={() => setStep("payment")}
          className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
        >
          <WalletIcon className="w-4 h-4 text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Paid by</p>
            <p className="text-xs text-zinc-500 mt-0.5">{payerName}</p>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
        </button>
      </div>

      <Button
        variant="primary"
        size="lg"
        disabled={isPending || !description.trim() || totalCents <= 0 || !anyAssigned}
        onClick={handleSubmit}
      >
        {isPending ? "Saving…" : "Save Expense"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className ?? "w-3.5 h-3.5"}>
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className ?? "w-3.5 h-3.5"}>
      <path
        fillRule="evenodd"
        d="M1 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4Zm14.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className ?? "w-4 h-4"}>
      <path
        fillRule="evenodd"
        d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
