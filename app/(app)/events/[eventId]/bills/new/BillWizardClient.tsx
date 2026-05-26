"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BillSplitterWizard } from "@/components/bill-wizard/BillSplitterWizard";
import { createBill } from "@/lib/actions/bills";
import { formatCents } from "@/lib/utils";
import { PriceInput } from "@/components/ui/PriceInput";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { useBillWizard } from "@/components/bill-wizard/useBillWizard";

type Participant = { id: string; name: string; image?: string | null };
type SplitParticipant = { userId: string; parts: number };
type Mode = "choice" | "single" | "multi";
type SingleStep = "details" | "split" | "payment";

interface Props {
  eventId: string;
  participants: Participant[];
}

// ---------------------------------------------------------------------------
// Root client — shows choice, then routes to single or multi flow
// ---------------------------------------------------------------------------

export function BillWizardClient({ eventId, participants }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choice");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleMultiComplete = async (wizard: ReturnType<typeof useBillWizard>) => {
    setSubmitting(true);
    setError(null);
    const { state, toBillInput } = wizard;
    const { lineItems, payments } = toBillInput();
    try {
      await createBill({
        eventId,
        establishmentName: state.establishmentName || "Unknown",
        currency: "INR",
        subtotalCents: state.subtotalCents,
        taxCents: state.taxCents,
        tipCents: state.tipCents,
        gratuityCents: state.gratuityCents,
        totalCents: state.totalCents,
        receiptUrl: state.receiptBlobUrl || undefined,
        lineItems,
        payments,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bill");
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-zinc-500">Saving bill…</p>
        </div>
      </div>
    );
  }

  // ── Choice screen ──────────────────────────────────────────────────────────
  if (mode === "choice") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 max-w-lg mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 shrink-0"
            aria-label="Back"
          >
            <BackIcon />
          </button>
          <h2 className="flex-1 text-base font-semibold text-zinc-900 dark:text-white">
            Add bill
          </h2>
        </div>

        {/* Choice cards */}
        <div className="flex flex-col gap-3 px-4 pt-6">
          <button
            onClick={() => setMode("single")}
            className="flex items-center gap-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-5 text-left hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50/40 dark:hover:bg-brand-950/20 transition-all group"
          >
            <span className="text-3xl shrink-0">🧾</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-zinc-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                Single item
              </p>
              <p className="text-sm text-zinc-500 mt-0.5">
                One expense — Petrol, Taxi, Airbnb…
              </p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-zinc-300 dark:text-zinc-600 shrink-0 group-hover:text-brand-500 transition-colors" />
          </button>

          <button
            onClick={() => setMode("multi")}
            className="flex items-center gap-4 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-5 text-left hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50/40 dark:hover:bg-brand-950/20 transition-all group"
          >
            <span className="text-3xl shrink-0">🍽️</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-zinc-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                Multiple items
              </p>
              <p className="text-sm text-zinc-500 mt-0.5">
                Restaurant bill, receipt with line items…
              </p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-zinc-300 dark:text-zinc-600 shrink-0 group-hover:text-brand-500 transition-colors" />
          </button>
        </div>
      </div>
    );
  }

  // ── Multi-item: existing wizard ────────────────────────────────────────────
  if (mode === "multi") {
    return (
      <>
        {error && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm text-center px-4 py-2">
            {error}
          </div>
        )}
        <BillSplitterWizard
          participants={participants}
          onComplete={handleMultiComplete}
          onCancel={() => setMode("choice")}
        />
      </>
    );
  }

  // ── Single-item flow ───────────────────────────────────────────────────────
  return (
    <SingleItemFlow
      eventId={eventId}
      participants={participants}
      onBack={() => setMode("choice")}
    />
  );
}

// ---------------------------------------------------------------------------
// Single-item bill flow
// ---------------------------------------------------------------------------

function SingleItemFlow({
  eventId,
  participants,
  onBack,
}: {
  eventId: string;
  participants: Participant[];
  onBack: () => void;
}) {
  const me = participants[0]; // first participant = current user

  const [step, setStep] = useState<SingleStep>("details");
  const [itemName, setItemName] = useState("");
  const [totalCents, setTotalCents] = useState(0);

  // Split participants — everyone starts included with 1 part
  const [splitParticipants, setSplitParticipants] = useState<SplitParticipant[]>(() =>
    participants.map((p) => ({ userId: p.id, parts: 1 }))
  );

  // Who paid — default: current user (first participant)
  const [payerId, setPayerId] = useState(me?.id ?? "");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Split helpers ────────────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!itemName.trim() || totalCents <= 0 || !anyAssigned || !payerId) return;
    startTransition(async () => {
      setError(null);
      const splitParts = splitParticipants.filter((p) => p.parts > 0);
      const denom = splitParts.reduce((s, p) => s + p.parts, 0);
      try {
        await createBill({
          eventId,
          establishmentName: itemName.trim(),
          currency: "INR",
          subtotalCents: totalCents,
          taxCents: 0,
          tipCents: 0,
          gratuityCents: 0,
          totalCents,
          lineItems: [
            {
              name: itemName.trim(),
              quantity: 1,
              unitCents: totalCents,
              totalCents,
              fractions: splitParts.map((p) => ({
                userId: p.userId,
                numerator: p.parts,
                denominator: denom,
              })),
            },
          ],
          payments: [{ userId: payerId, amountCents: totalCents }],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  // ── Split full-page screen ──────────────────────────────────────────────
  if (step === "split") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 max-w-lg mx-auto">
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setStep("details")}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <BackIcon />
          </button>
          <h2 className="flex-1 text-base font-semibold text-zinc-900 dark:text-white truncate">
            Split between
          </h2>
          <button
            onClick={() => anyAssigned && setStep("payment")}
            disabled={!anyAssigned}
            className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-950/70 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 px-4">
            {splitParticipants.map((sp) => {
              const person = participants.find((p) => p.id === sp.userId);
              const isIn = sp.parts > 0;
              const pct = totalParts > 0 && isIn ? Math.round((sp.parts / totalParts) * 100) : 0;
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
                      isIn ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400 dark:text-zinc-600"
                    )}
                  >
                    {person?.name}
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

  // ── Payment full-page screen ───────────────────────────────────────────────
  if (step === "payment") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 max-w-lg mx-auto">
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setStep("split")}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <BackIcon />
          </button>
          <h2 className="flex-1 text-base font-semibold text-zinc-900 dark:text-white truncate">
            Who paid?
          </h2>
          <button
            onClick={handleSubmit}
            disabled={isPending || !payerId}
            className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-950/70 disabled:opacity-40 transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

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
                    {p.name}
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

  // ── Details screen ─────────────────────────────────────────────────────────
  const isAllAssigned = assignedCount === participants.length;
  const payerName = participants.find((p) => p.id === payerId)?.name ?? "Nobody";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
        >
          <BackIcon />
        </button>
        <h2 className="flex-1 text-base font-semibold text-zinc-900 dark:text-white">
          Single item
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
        {/* Item name */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            What is this expense?
          </label>
          <input
            autoFocus
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Petrol, Taxi, Airbnb"
            className="rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-3 text-base font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Total Amount
          </label>
          <div className="flex items-center gap-2 border border-zinc-300 dark:border-zinc-600 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500 bg-white dark:bg-zinc-900 transition-colors">
            <span className="text-zinc-500 font-medium">₹</span>
            <PriceInput
              valueCents={totalCents}
              onChange={setTotalCents}
              className="flex-1 text-lg"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Summary rows */}
        <div className="flex flex-col gap-2">
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

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          disabled={isPending || !itemName.trim() || totalCents <= 0 || !anyAssigned}
          onClick={handleSubmit}
        >
          {isPending ? "Saving…" : "Save Bill"}
        </Button>
      </div>
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

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className ?? "w-4 h-4"}>
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className ?? "w-4 h-4"}>
      <path
        fillRule="evenodd"
        d="M1 4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4Zm14.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
