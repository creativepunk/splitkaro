"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCents } from "@/lib/utils";
import { calculateBillBalances } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import type { EventBalanceSummary } from "@/lib/actions/balances";

// ---------------------------------------------------------------------------
// Serialisable types (plain objects from the server component)
// ---------------------------------------------------------------------------

type Member = { id: string; name?: string | null; image?: string | null };
type Fraction = { userId: string; numerator: number; denominator: number };
type LineItemData = {
  id: string;
  name: string;
  quantity: number;
  totalCents: number;
  fractions: Fraction[];
};
type PaymentData = { userId: string; amountCents: number };
type BillData = {
  id: string;
  createdAt: string; // ISO string — serialised from server
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  gratuityCents: number;
  lineItems: LineItemData[];
  payments: PaymentData[];
};
type EstablishmentData = {
  id: string;
  name: string;
  category?: string | null;
  bills: BillData[];
};

interface EventTabsProps {
  eventId: string;
  currentUserId: string;
  members: Member[];
  establishments: EstablishmentData[];
  balanceSummary: EventBalanceSummary;
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

const TABS = [
  { id: "bills" as const, label: "Bills" },
  { id: "settleup" as const, label: "Settle up" },
  { id: "balances" as const, label: "Balances" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function EventTabs({
  eventId,
  currentUserId,
  members,
  establishments,
  balanceSummary,
}: EventTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("bills");
  const hasAnyBills = establishments.some((e) => e.bills.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Segmented control */}
      <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 gap-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === tab.id
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bills" && (
        <BillsTab
          eventId={eventId}
          currentUserId={currentUserId}
          members={members}
          establishments={establishments}
        />
      )}
      {activeTab === "settleup" && (
        <SettleUpTab summary={balanceSummary} members={members} hasAnyBills={hasAnyBills} />
      )}
      {activeTab === "balances" && (
        <BalancesTab summary={balanceSummary} members={members} hasAnyBills={hasAnyBills} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bills tab
// ---------------------------------------------------------------------------

function BillsTab({
  eventId,
  currentUserId,
  members,
  establishments,
}: {
  eventId: string;
  currentUserId: string;
  members: Member[];
  establishments: EstablishmentData[];
}) {
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());

  const toggleBill = (billId: string) =>
    setExpandedBills((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) next.delete(billId);
      else next.add(billId);
      return next;
    });

  const hasAnyBill = establishments.some((e) => e.bills.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <Link href={`/events/${eventId}/bills/new`}>
        <Button variant="primary" size="lg" className="w-full">
          + Add bill
        </Button>
      </Link>

      {!hasAnyBill ? (
        <EmptyState
          icon="🏪"
          title="No bills yet"
          description="Add a bill for a restaurant, activity, or any expense from this event."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {establishments.flatMap((est) =>
            est.bills.map((bill) => {
              const isExpanded = expandedBills.has(bill.id);

              // ── Per-bill user net ──────────────────────────────────────
              let userNetCents = 0;
              try {
                const result = calculateBillBalances({
                  totalCents: bill.totalCents,
                  subtotalCents: bill.subtotalCents,
                  taxCents: bill.taxCents,
                  tipCents: bill.tipCents,
                  gratuityCents: bill.gratuityCents,
                  lineItems: bill.lineItems.map((li) => ({
                    id: li.id,
                    name: li.name,
                    totalCents: li.totalCents,
                    fractions: li.fractions.map((f) => ({
                      userId: f.userId,
                      fraction: { numerator: f.numerator, denominator: f.denominator },
                    })),
                  })),
                  payments: bill.payments,
                });
                userNetCents =
                  result.userBalances.find((b) => b.userId === currentUserId)?.netCents ?? 0;
              } catch {
                /* skip malformed bill */
              }

              const isLent = userNetCents > 0;
              const isBorrowed = userNetCents < 0;
              const isInvolved = userNetCents !== 0;

              // ── Payment chip label ─────────────────────────────────────
              const paymentLabel = buildPaymentLabel(bill.payments, members, currentUserId);

              // ── Date ──────────────────────────────────────────────────
              const dateLabel = new Date(bill.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={bill.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
                >
                  {/* Collapsed header — tap to expand */}
                  <button
                    onClick={() => toggleBill(bill.id)}
                    className="w-full px-4 pt-4 pb-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Left: name + items + date */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-snug">
                          {est.name}
                        </h3>
                        {bill.lineItems.length > 0 && (
                          <p className="text-sm text-zinc-500 mt-0.5">
                            {bill.lineItems.length} item{bill.lineItems.length !== 1 ? "s" : ""}
                          </p>
                        )}
                        <p className="text-sm text-zinc-400 mt-0.5">{dateLabel}</p>
                      </div>

                      {/* Right: you lent/borrowed + amount + payment chip */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isInvolved && (
                          <>
                            <p
                              className={cn(
                                "text-xs font-medium",
                                isLent
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-500 dark:text-red-400"
                              )}
                            >
                              {isLent ? "You lent" : "You borrowed"}
                            </p>
                            <p
                              className={cn(
                                "text-xl font-bold tabular-nums leading-none",
                                isLent
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-500 dark:text-red-400"
                              )}
                            >
                              {formatCents(Math.abs(userNetCents))}
                            </p>
                          </>
                        )}
                        {!isInvolved && (
                          <p className="text-lg font-bold text-brand-600 dark:text-brand-400 tabular-nums leading-none">
                            {formatCents(bill.totalCents)}
                          </p>
                        )}
                        {paymentLabel && (
                          <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1 whitespace-nowrap">
                            {paymentLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 flex flex-col gap-3">
                      {/* Line items */}
                      <div className="flex flex-col gap-1">
                        {bill.lineItems.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-zinc-700 dark:text-zinc-300">
                              {item.name || "Item"}
                              {item.quantity > 1 && (
                                <span className="text-zinc-400 ml-1">×{item.quantity}</span>
                              )}
                            </span>
                            <span className="text-zinc-500">{formatCents(item.totalCents)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Totals breakdown */}
                      <div className="flex gap-3 text-xs text-zinc-400 flex-wrap border-t border-zinc-100 dark:border-zinc-800 pt-2">
                        <span>Sub: {formatCents(bill.subtotalCents)}</span>
                        {bill.taxCents > 0 && <span>Tax: {formatCents(bill.taxCents)}</span>}
                        {bill.tipCents > 0 && <span>Svc: {formatCents(bill.tipCents)}</span>}
                        {bill.gratuityCents > 0 && (
                          <span>Tip: {formatCents(bill.gratuityCents)}</span>
                        )}
                        <span className="ml-auto font-semibold text-zinc-600 dark:text-zinc-300">
                          Total {formatCents(bill.totalCents)}
                        </span>
                      </div>

                      {/* Payments with avatars */}
                      {bill.payments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {bill.payments.map((p) => {
                            const u = members.find((m) => m.id === p.userId);
                            return (
                              <div
                                key={p.userId}
                                className="flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-400"
                              >
                                <Avatar name={u?.name} image={u?.image} size="xs" />
                                {p.userId === currentUserId ? "You" : u?.name} paid{" "}
                                {formatCents(p.amountCents)}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Per-bill settlements */}
                      <BillSettlements bill={bill} members={members} currentUserId={currentUserId} />

                      {/* Edit link */}
                      <div className="flex justify-end pt-0.5">
                        <Link
                          href={`/events/${eventId}/bills/${bill.id}/edit`}
                          className="text-xs text-brand-600 dark:text-brand-400 font-medium px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Edit bill
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Build a concise payment label for the collapsed card
function buildPaymentLabel(
  payments: PaymentData[],
  members: Member[],
  currentUserId: string
): string | null {
  if (payments.length === 0) return null;
  if (payments.length === 1) {
    const p = payments[0];
    const name =
      p.userId === currentUserId
        ? "You"
        : (members.find((m) => m.id === p.userId)?.name?.split(" ")[0] ?? "?");
    return `${name} paid ${formatCents(p.amountCents)}`;
  }
  const total = payments.reduce((s, p) => s + p.amountCents, 0);
  return `${payments.length} people paid ${formatCents(total)}`;
}

// ---------------------------------------------------------------------------
// Bill settlements (expanded)
// ---------------------------------------------------------------------------

function BillSettlements({
  bill,
  members,
  currentUserId,
}: {
  bill: BillData;
  members: Member[];
  currentUserId: string;
}) {
  let settlements: Array<{ fromUserId: string; toUserId: string; amountCents: number }> = [];
  try {
    const result = calculateBillBalances({
      totalCents: bill.totalCents,
      subtotalCents: bill.subtotalCents,
      taxCents: bill.taxCents,
      tipCents: bill.tipCents,
      gratuityCents: bill.gratuityCents,
      lineItems: bill.lineItems.map((li) => ({
        id: li.id,
        name: li.name,
        totalCents: li.totalCents,
        fractions: li.fractions.map((f) => ({
          userId: f.userId,
          fraction: { numerator: f.numerator, denominator: f.denominator },
        })),
      })),
      payments: bill.payments,
    });
    settlements = result.settlements;
  } catch {
    /* skip */
  }

  if (settlements.length === 0) return null;

  return (
    <div className="rounded-xl bg-brand-50 dark:bg-brand-950/30 px-3 py-2 flex flex-col gap-1">
      {settlements.map((s, i) => {
        const fromName =
          s.fromUserId === currentUserId
            ? "You"
            : (members.find((m) => m.id === s.fromUserId)?.name ?? "?");
        const toName =
          s.toUserId === currentUserId
            ? "you"
            : (members.find((m) => m.id === s.toUserId)?.name ?? "?");
        return (
          <span key={i} className="text-xs text-brand-700 dark:text-brand-300">
            {fromName} owe{fromName === "You" ? "" : "s"} {toName}{" "}
            <strong>{formatCents(s.amountCents)}</strong>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balances tab
// ---------------------------------------------------------------------------

function BalancesTab({
  summary,
  members,
  hasAnyBills,
}: {
  summary: EventBalanceSummary;
  members: Member[];
  hasAnyBills: boolean;
}) {
  if (!hasAnyBills) {
    return (
      <EmptyState
        icon="⚖️"
        title="No balances yet"
        description="Add bills to see how costs are split across the group."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {summary.balances.map((b) => {
        const isPos = b.netCents > 0;
        const isNeg = b.netCents < 0;
        const u = members.find((m) => m.id === b.userId);
        return (
          <div
            key={b.userId}
            className="flex items-center gap-3 rounded-xl px-4 py-3 bg-zinc-50 dark:bg-zinc-900"
          >
            <Avatar name={b.name ?? u?.name} image={b.image ?? u?.image} size="sm" />
            <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {b.name ?? "Unknown"}
            </span>
            {b.netCents === 0 && <Badge variant="success">Settled</Badge>}
            {isPos && (
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                +{formatCents(b.netCents)}
              </span>
            )}
            {isNeg && (
              <span className="text-sm font-semibold text-red-500 dark:text-red-400">
                −{formatCents(-b.netCents)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settle Up tab
// ---------------------------------------------------------------------------

function SettleUpTab({
  summary,
  members,
  hasAnyBills,
}: {
  summary: EventBalanceSummary;
  members: Member[];
  hasAnyBills: boolean;
}) {
  if (!hasAnyBills) {
    return (
      <EmptyState
        icon="✅"
        title="Nothing to settle"
        description="Add bills to see who owes what."
      />
    );
  }

  if (summary.settlements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <span className="text-4xl">🎉</span>
        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">All settled up!</p>
        <p className="text-sm text-zinc-500">Everyone is even on this event.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {summary.settlements.map((s, i) => {
        const from = members.find((m) => m.id === s.fromUserId);
        const to = members.find((m) => m.id === s.toUserId);
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 px-4 py-3.5"
          >
            <Avatar name={from?.name} image={from?.image} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-snug">
                <span>{from?.name ?? "Someone"}</span>
                <span className="text-zinc-400 mx-1.5">→</span>
                <span>{to?.name ?? "Someone"}</span>
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">needs to pay</p>
            </div>
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 shrink-0">
              {formatCents(s.amountCents)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
