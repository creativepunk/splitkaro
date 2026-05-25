"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useBillWizard, type WizardParticipant, type WizardLineItem } from "./useBillWizard";
import { useOCR } from "@/lib/hooks/useOCR";
import { formatCents } from "@/lib/utils";
import { PriceInput } from "@/components/ui/PriceInput";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface BillSplitterWizardProps {
  participants: WizardParticipant[];
  onComplete: (wizard: ReturnType<typeof useBillWizard>) => void;
}

const STEPS = ["Upload Receipt", "Items & Shares", "Log Payments"] as const;

// ---------------------------------------------------------------------------
// Root wizard
// ---------------------------------------------------------------------------

export function BillSplitterWizard({ participants, onComplete }: BillSplitterWizardProps) {
  const wizard = useBillWizard(participants);
  const ocr = useOCR();
  const { state, next, back, canSubmit } = wizard;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 max-w-lg mx-auto">
      {/* Progress */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          {state.step > 1 && (
            <button onClick={back} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white -ml-1 px-1 py-0.5">
              ← Back
            </button>
          )}
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {STEPS[state.step - 1]}
          </span>
          <span className="ml-auto text-xs text-zinc-400">{state.step}/3</span>
        </div>
        <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${(state.step / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {state.step === 1 && (
          <ReceiptUploadStep
            ocr={ocr}
            onResult={(receipt) => wizard.applyOCRResult(receipt)}
            onSkip={wizard.skipToManual}
          />
        )}
        {state.step === 2 && (
          <ItemsAndSharesStep wizard={wizard} participants={participants} onNext={next} />
        )}
        {state.step === 3 && (
          <LogPayersStep
            wizard={wizard}
            participants={participants}
            onSubmit={() => onComplete(wizard)}
            canSubmit={canSubmit}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Receipt Upload
// ---------------------------------------------------------------------------

function ReceiptUploadStep({
  ocr,
  onResult,
  onSkip,
}: {
  ocr: ReturnType<typeof useOCR>;
  onResult: (receipt: NonNullable<Extract<ReturnType<typeof useOCR>["status"], { state: "success" }>["receipt"]>) => void;
  onSkip: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => ocr.scan(file);
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  if (ocr.status.state === "success") {
    onResult(ocr.status.receipt);
    return null;
  }

  const busy = ocr.status.state === "uploading" || ocr.status.state === "analyzing";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Add a Receipt</h1>
        <p className="text-sm text-zinc-500 mt-1">Scan a receipt to auto-fill items, or enter manually.</p>
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="relative flex flex-col items-center justify-center gap-3 w-full h-44 border-2 border-dashed border-brand-300 dark:border-brand-700 rounded-2xl bg-brand-50 dark:bg-brand-950/20 hover:bg-brand-100 dark:hover:bg-brand-950/40 transition-colors disabled:opacity-50"
      >
        {!busy && ocr.status.state !== "error" && (
          <>
            <span className="text-4xl">🧾</span>
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Tap to upload receipt</span>
          </>
        )}
        {busy && (
          <>
            <svg className="h-8 w-8 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm text-brand-700">
              {ocr.status.state === "uploading" ? "Uploading…" : (ocr.status as { message: string }).message}
            </span>
          </>
        )}
        {ocr.status.state === "error" && (
          <>
            <span className="text-3xl">⚠️</span>
            <span className="text-sm text-red-600">{ocr.status.message}</span>
          </>
        )}
      </button>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />

      <div className="flex gap-3">
        <Button onClick={() => cameraRef.current?.click()} disabled={busy} variant="primary" size="lg" className="flex-1">
          📷 Camera
        </Button>
        <Button onClick={onSkip} variant="secondary" size="lg" className="flex-1">
          Enter Manually
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Items & Shares
// ---------------------------------------------------------------------------

function ItemsAndSharesStep({
  wizard,
  participants,
  onNext,
}: {
  wizard: ReturnType<typeof useBillWizard>;
  participants: WizardParticipant[];
  onNext: () => void;
}) {
  const { state, setEstablishmentName, updateItem, addItem, removeItem, updateTaxTip, setParticipantParts, equalSplitItem, equalSplitAll } = wizard;
  const [splitItemId, setSplitItemId] = useState<string | null>(null);

  const allSharesValid = state.lineItems.every(
    (item) => item.participants.reduce((s, p) => s + p.parts, 0) > 0
  );

  const splitItem = splitItemId ? state.lineItems.find((i) => i.id === splitItemId) ?? null : null;

  const closePanel = () => setSplitItemId(null);
  const togglePanel = (id: string) => setSplitItemId((prev) => (prev === id ? null : id));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Items & Shares</h1>
        <button
          onClick={equalSplitAll}
          className="text-xs text-brand-600 dark:text-brand-400 font-medium px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-800"
        >
          Split all equally
        </button>
      </div>

      {/* Establishment name */}
      <input
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors"
        placeholder="Establishment / place name"
        value={state.establishmentName}
        onChange={(e) => setEstablishmentName(e.target.value)}
      />

      {/* Line items */}
      <div className="flex flex-col gap-2">
        {state.lineItems.map((item) => {
          const assignedCount = item.participants.filter((p) => p.parts > 0).length;
          const isAll = assignedCount === participants.length;
          const isOpen = splitItemId === item.id;

          return (
            <div key={item.id} className="relative">
              {/* Item row */}
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 bg-white dark:bg-zinc-900 transition-colors",
                isOpen
                  ? "border-brand-400 dark:border-brand-600"
                  : "border-zinc-200 dark:border-zinc-800"
              )}>
                <input
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 outline-none"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                />
                <input
                  type="number"
                  min={1}
                  className="w-7 bg-transparent text-sm text-center text-zinc-600 dark:text-zinc-400 outline-none shrink-0"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                />
                <span className="text-zinc-400 text-xs shrink-0">x ₹</span>
                <PriceInput
                  valueCents={item.unitCents}
                  onChange={(cents) => updateItem(item.id, { unitCents: cents })}
                  className="w-16 text-sm text-zinc-900 dark:text-white"
                  placeholder="0.00"
                />
                {/* Split chip */}
                <button
                  onClick={() => togglePanel(item.id)}
                  className={cn(
                    "shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors",
                    isOpen
                      ? "bg-brand-100 dark:bg-brand-950 border-brand-400 text-brand-700 dark:text-brand-300"
                      : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-brand-50 hover:border-brand-300 dark:hover:bg-brand-950 dark:hover:border-brand-700"
                  )}
                >
                  <span>{isAll ? "All" : assignedCount}</span>
                  <PeopleIcon />
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-colors shrink-0 ml-0.5"
                >
                  ✕
                </button>
              </div>

              {/* Desktop dropdown (md+) */}
              {isOpen && (
                <div className="hidden md:block absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
                  <SplitPanelContent
                    item={item}
                    participants={participants}
                    onSetParts={(uid, parts) => setParticipantParts(item.id, uid, parts)}
                    onEqualSplit={() => equalSplitItem(item.id)}
                    onClose={closePanel}
                  />
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={addItem}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 py-1"
        >
          + Add item
        </button>
      </div>

      {/* Mobile drawer (below md) — backdrop + sheet */}
      {splitItem && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={closePanel}
          />
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 rounded-t-2xl bg-white dark:bg-zinc-900 shadow-2xl safe-area-inset-bottom">
            <SplitPanelContent
              item={splitItem}
              participants={participants}
              onSetParts={(uid, parts) => setParticipantParts(splitItem.id, uid, parts)}
              onEqualSplit={() => equalSplitItem(splitItem.id)}
              onClose={closePanel}
            />
          </div>
        </>
      )}

      {/* Desktop dropdown backdrop (closes on outside click) */}
      {splitItemId && (
        <div className="hidden md:block fixed inset-0 z-40" onClick={closePanel} />
      )}

      {/* Tax / Tip / Totals */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
        {[
          { label: "Subtotal", value: state.subtotalCents, readOnly: true },
          { label: "Tax", key: "taxCents" as const, value: state.taxCents },
          { label: "Tip", key: "tipCents" as const, value: state.tipCents },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-zinc-500">{row.label}</span>
            {row.readOnly ? (
              <span className="font-semibold text-zinc-900 dark:text-white">{formatCents(row.value)}</span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-zinc-400 text-xs">₹</span>
                <PriceInput
                  valueCents={row.value}
                  onChange={(cents) => updateTaxTip({ [row.key!]: cents })}
                  className="w-20 text-sm text-zinc-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
          <span>Total</span>
          <span className="text-brand-600 dark:text-brand-400">{formatCents(state.totalCents)}</span>
        </div>
      </div>

      <Button
        onClick={onNext}
        variant="primary"
        size="lg"
        className="w-full"
        disabled={state.lineItems.length === 0 || state.totalCents === 0 || !allSharesValid}
      >
        Next: Log Payments
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Split panel content (shared by dropdown + drawer)
// ---------------------------------------------------------------------------

function SplitPanelContent({
  item,
  participants,
  onSetParts,
  onEqualSplit,
  onClose,
}: {
  item: WizardLineItem;
  participants: WizardParticipant[];
  onSetParts: (userId: string, parts: number) => void;
  onEqualSplit: () => void;
  onClose: () => void;
}) {
  const totalParts = item.participants.reduce((s, p) => s + p.parts, 0);

  return (
    <div className="p-4">
      {/* Handle bar (mobile) */}
      <div className="md:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 mx-auto mb-4" />

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate pr-2">
          {item.name || "Item"}
        </span>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0 text-lg leading-none">
          ×
        </button>
      </div>

      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {item.participants.map((p) => {
          const person = participants.find((m) => m.id === p.userId);
          const isIn = p.parts > 0;
          const pct = totalParts > 0 && isIn ? Math.round((p.parts / totalParts) * 100) : 0;
          const share = totalParts > 0 && isIn && item.totalCents > 0
            ? Math.round((item.totalCents * p.parts) / totalParts)
            : null;

          return (
            <div key={p.userId} className="flex items-center gap-3 py-2.5">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isIn}
                onChange={() => onSetParts(p.userId, isIn ? 0 : 1)}
                className="shrink-0 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-brand-600 accent-brand-600 cursor-pointer"
              />

              {/* Avatar (display only) */}
              <div className={cn(
                "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                isIn
                  ? "bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50"
              )}>
                {person?.name?.[0]?.toUpperCase() ?? "?"}
              </div>

              <span className={cn(
                "flex-1 text-sm truncate",
                isIn ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400"
              )}>
                {person?.name}
              </span>

              {isIn ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSetParts(p.userId, p.parts - 1)}
                    className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-colors"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                    {p.parts}
                  </span>
                  <button
                    onClick={() => onSetParts(p.userId, p.parts + 1)}
                    className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-colors"
                  >
                    +
                  </button>
                  <span className="text-xs text-zinc-400 w-8 text-right tabular-nums">{pct}%</span>
                  {share !== null && (
                    <span className="text-xs text-zinc-500 w-14 text-right tabular-nums">
                      {formatCents(share)}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-zinc-400 shrink-0">excluded</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onEqualSplit}
        className="mt-3 w-full text-xs font-medium text-brand-600 dark:text-brand-400 py-2 rounded-lg border border-brand-200 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
      >
        Equal split
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Log Payments
// ---------------------------------------------------------------------------

function LogPayersStep({
  wizard,
  participants,
  onSubmit,
  canSubmit,
}: {
  wizard: ReturnType<typeof useBillWizard>;
  participants: WizardParticipant[];
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  const { state, setPayment, setPayerFull, remainingCents, getBalancePreview } = wizard;
  const preview = getBalancePreview();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Who Paid?</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Enter how much each person physically paid the vendor.</p>
      </div>

      <div className="flex flex-col gap-2">
        {state.payments.map(({ userId, amountCents }) => {
          const person = participants.find((p) => p.id === userId);
          return (
            <div key={userId} className="flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5">
              <Avatar name={person?.name} image={person?.image} size="sm" />
              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{person?.name}</span>
              <button
                onClick={() => setPayerFull(userId)}
                className="text-xs text-brand-600 dark:text-brand-400 font-medium px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/30 shrink-0"
              >
                Paid in full
              </button>
              <div className="flex items-center gap-1">
                <span className="text-zinc-400 text-xs">₹</span>
                <PriceInput
                  valueCents={amountCents}
                  onChange={(cents) => setPayment(userId, cents)}
                  className="w-20 text-sm text-zinc-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Remaining */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium",
        remainingCents === 0
          ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
          : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
      )}>
        <span>
          {remainingCents === 0
            ? "Payments balanced ✓"
            : remainingCents > 0
            ? `${formatCents(remainingCents)} still unassigned`
            : `${formatCents(-remainingCents)} over-assigned`}
        </span>
        <span>{formatCents(state.totalCents)} total</span>
      </div>

      {/* Balance preview */}
      {preview && canSubmit && preview.settlements.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Settle up</p>
          <div className="flex flex-col gap-2">
            {preview.settlements.map((s, i) => {
              const from = participants.find((p) => p.id === s.fromUserId);
              const to = participants.find((p) => p.id === s.toUserId);
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Avatar name={from?.name} image={from?.image} size="xs" />
                  <span className="text-zinc-700 dark:text-zinc-300">{from?.name}</span>
                  <span className="text-zinc-400">→</span>
                  <Avatar name={to?.name} image={to?.image} size="xs" />
                  <span className="text-zinc-700 dark:text-zinc-300">{to?.name}</span>
                  <span className="ml-auto font-semibold text-brand-600 dark:text-brand-400">
                    {formatCents(s.amountCents)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button onClick={onSubmit} variant="primary" size="lg" className="w-full" disabled={!canSubmit}>
        Save Bill
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PeopleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
    </svg>
  );
}
