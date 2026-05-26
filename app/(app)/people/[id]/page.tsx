import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactProfile, type EventSettlement } from "@/lib/actions/contacts";
import { requireUser } from "@/lib/server-auth";
import { Avatar } from "@/components/ui/Avatar";
import { formatCents } from "@/lib/utils";
import { PersonActions } from "./PersonActions";
import { ExpenseRow } from "./ExpenseActions";

export const metadata: Metadata = { title: "Profile" };

type SharedExpense = Awaited<ReturnType<typeof getContactProfile>>["sharedExpenses"][number];


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PersonProfilePage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const { contact, sharedExpenses, eventSettlements, othersDebts } =
    await getContactProfile(params.id);

  if (!contact) notFound();

  const firstName = contact.name!.split(" ")[0];

  // Split event settlements and direct expenses by direction
  const theyOweMeEvents = eventSettlements.filter((s) => s.netCents > 0);
  const iOweThemEvents  = eventSettlements.filter((s) => s.netCents < 0);

  const theyOweMeExpenses: SharedExpense[] = [];
  const iOweThemExpenses: SharedExpense[]  = [];
  for (const exp of sharedExpenses) {
    if (exp.paidById === me.id) theyOweMeExpenses.push(exp);
    else if (exp.paidById === contact.id) iOweThemExpenses.push(exp);
  }

  const theyOweMeTotal =
    theyOweMeEvents.reduce((s, e) => s + e.netCents, 0) +
    theyOweMeExpenses.reduce((s, e) => {
      const sp = e.splits.find((x) => x.userId === contact.id);
      return s + (sp ? Math.round(e.totalCents * (sp.numerator / sp.denominator)) : 0);
    }, 0);

  const iOweThemTotal =
    iOweThemEvents.reduce((s, e) => s + Math.abs(e.netCents), 0) +
    iOweThemExpenses.reduce((s, e) => {
      const sp = e.splits.find((x) => x.userId === me.id);
      return s + (sp ? Math.round(e.totalCents * (sp.numerator / sp.denominator)) : 0);
    }, 0);

  // Group othersDebts by direction + other person name so multiple events
  // from the same pair are shown as a summed row with event breakdown below.
  type OtherDebtEntry = {
    id: string;
    label: string;
    href: string;
    amountCents: number;
  };
  type GroupedOtherDebt = {
    contactOwes: boolean;
    otherPersonName: string | null;
    totalAmountCents: number;
    entries: OtherDebtEntry[];
  };
  const othersMap = new Map<string, GroupedOtherDebt>();
  for (const d of othersDebts) {
    const key = `${d.contactOwes ? 1 : 0}:${d.otherPersonName ?? ""}`;
    if (!othersMap.has(key)) {
      othersMap.set(key, {
        contactOwes: d.contactOwes,
        otherPersonName: d.otherPersonName,
        totalAmountCents: 0,
        entries: [],
      });
    }
    const g = othersMap.get(key)!;
    g.totalAmountCents += d.amountCents;
    g.entries.push({
      id:    d.eventId ?? d.expenseId ?? "",
      label: d.eventName ?? d.expenseDescription ?? "",
      href:  d.eventId ? `/events/${d.eventId}` : "/activity",
      amountCents: d.amountCents,
    });
  }
  // Split third-party debts by direction so they merge into the two main sections
  const contactOwesOthers = [...othersMap.values()].filter((g) => g.contactOwes);
  const othersOweContact  = [...othersMap.values()].filter((g) => !g.contactOwes);

  // Total what contact owes overall (to you + to third parties)
  const totalContactOwes =
    theyOweMeTotal +
    contactOwesOthers.reduce((s, g) => s + g.totalAmountCents, 0);

  // Total what's owed to contact overall (from you + from third parties)
  const totalOwedToContact =
    iOweThemTotal +
    othersOweContact.reduce((s, g) => s + g.totalAmountCents, 0);

  // Overall net: positive = contact owes more than is owed to them
  const overallNet = totalContactOwes - totalOwedToContact;

  const hasOwes    = theyOweMeEvents.length > 0 || theyOweMeExpenses.length > 0 || contactOwesOthers.length > 0;
  const hasOwed    = iOweThemEvents.length > 0  || iOweThemExpenses.length > 0  || othersOweContact.length > 0;
  const hasAnything = hasOwes || hasOwed;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Avatar name={contact.name!} size="lg" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">{contact.name}</h1>
          {!hasAnything ? (
            <p className="text-sm text-zinc-500 mt-0.5">All settled up 🎉</p>
          ) : overallNet > 0 ? (
            <span className="text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full px-2.5 py-0.5 mt-1 inline-block">
              owes {formatCents(overallNet)} overall
            </span>
          ) : overallNet < 0 ? (
            <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-0.5 mt-1 inline-block">
              is owed {formatCents(-overallNet)} overall
            </span>
          ) : (
            <p className="text-sm text-zinc-500 mt-0.5">Net settled 🎉</p>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col gap-2">
        <Link
          href={`/expenses/new?with=${contact.id}`}
          className="flex justify-center items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition"
        >
          Add Quick Expense
        </Link>
        <PersonActions contactId={contact.id} currentName={contact.name!} />
      </div>

      {/* ── What contact owes (to you + to others) ── */}
      {hasOwes && (
        <DirectionSection direction="they-owe" label={`${firstName} owes`} total={totalContactOwes}>
          {theyOweMeEvents.map((s) => (
            <EventSettlementRow key={s.eventId} settlement={s} />
          ))}
          {theyOweMeExpenses.map((exp) => {
            const sp = exp.splits.find((x) => x.userId === contact.id);
            const net = sp ? Math.round(exp.totalCents * (sp.numerator / sp.denominator)) : 0;
            return (
              <ExpenseRow
                key={exp.id} flat canDelete
                expense={exp} currentUserId={me.id} contactName={contact.name!}
                netAmount={net} amountLabel="you lent"
                amountColor="text-emerald-600 dark:text-emerald-400" amountSign="+"
              />
            );
          })}
          {contactOwesOthers.map((group, i) => (
            <GroupedOtherDebtRow key={`owe-${i}`} group={group} contactFirstName={firstName} />
          ))}
        </DirectionSection>
      )}

      {/* ── What's owed to contact (from you + from others) ── */}
      {hasOwed && (
        <DirectionSection direction="i-owe" label={`Owed to ${firstName}`} total={totalOwedToContact}>
          {iOweThemEvents.map((s) => (
            <EventSettlementRow key={s.eventId} settlement={s} />
          ))}
          {iOweThemExpenses.map((exp) => {
            const sp = exp.splits.find((x) => x.userId === me.id);
            const net = sp ? Math.round(exp.totalCents * (sp.numerator / sp.denominator)) : 0;
            return (
              <ExpenseRow
                key={exp.id} flat canDelete
                expense={exp} currentUserId={me.id} contactName={contact.name!}
                netAmount={net} amountLabel="you borrowed"
                amountColor="text-red-500 dark:text-red-400" amountSign="−"
              />
            );
          })}
          {othersOweContact.map((group, i) => (
            <GroupedOtherDebtRow key={`owed-${i}`} group={group} contactFirstName={firstName} />
          ))}
        </DirectionSection>
      )}

      {/* ── Empty ── */}
      {!hasAnything && (
        <div className="text-center py-14 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <span className="text-4xl block mb-3">💸</span>
          <p className="text-sm text-zinc-500">No shared expenses with {contact.name} yet.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colored direction section wrapper
// ---------------------------------------------------------------------------

function DirectionSection({
  direction, label, total, children,
}: {
  direction: "they-owe" | "i-owe";
  label: string;
  total: number;
  children: React.ReactNode;
}) {
  const green = direction === "they-owe";
  return (
    <div className={`rounded-2xl overflow-hidden border ${
      green ? "border-emerald-200 dark:border-emerald-800/60"
            : "border-red-200 dark:border-red-800/60"
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${
        green ? "bg-emerald-50 dark:bg-emerald-950/30"
              : "bg-red-50 dark:bg-red-950/30"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-lg leading-none ${green ? "text-emerald-500" : "text-red-400"}`}>
            {green ? "↑" : "↓"}
          </span>
          <span className={`text-sm font-semibold ${
            green ? "text-emerald-900 dark:text-emerald-100"
                  : "text-red-900 dark:text-red-100"
          }`}>
            {label}
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${
          green ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-600 dark:text-red-400"
        }`}>
          {green ? "+" : "−"}{formatCents(total)}
        </span>
      </div>
      {/* Rows */}
      <div className={`divide-y bg-white dark:bg-zinc-950 ${
        green ? "divide-emerald-100 dark:divide-emerald-900/40"
              : "divide-red-100 dark:divide-red-900/40"
      }`}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event settlement row — one row per shared event, simplified amount
// ---------------------------------------------------------------------------

function EventSettlementRow({ settlement }: { settlement: EventSettlement }) {
  const absNet = Math.abs(settlement.netCents);
  const isPos  = settlement.netCents > 0;

  return (
    <Link
      href={`/events/${settlement.eventId}`}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
    >
      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-sm">
        ✈️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
          {settlement.eventName}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">Simplified settle-up</p>
      </div>
      <span className={`text-sm font-bold tabular-nums shrink-0 ${
        isPos ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400"
      }`}>
        {isPos ? "+" : "−"}{formatCents(absNet)}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Grouped other-person debt row (sum header + per-event breakdown)
// ---------------------------------------------------------------------------

type OtherDebtEntry = {
  id: string;
  label: string;
  href: string;
  amountCents: number;
};
type GroupedOtherDebt = {
  contactOwes: boolean;
  otherPersonName: string | null;
  totalAmountCents: number;
  entries: OtherDebtEntry[];
};

function GroupedOtherDebtRow({
  group,
  contactFirstName,
}: {
  group: GroupedOtherDebt;
  contactFirstName: string;
}) {
  const otherFirst = group.otherPersonName?.split(" ")[0] ?? "Someone";
  const amountColor = group.contactOwes
    ? "text-red-500 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";

  const entryCount = group.entries.length;
  const hasEvents   = group.entries.some((e) => e.href.startsWith("/events/"));
  const hasExpenses = group.entries.some((e) => e.href === "/activity");
  const subLabel =
    entryCount > 1
      ? hasEvents && hasExpenses
        ? `across ${entryCount} expenses & events`
        : hasExpenses
        ? `across ${entryCount} expenses`
        : `across ${entryCount} events`
      : null;

  return (
    <div>
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {group.contactOwes ? (
              <>
                <span className="font-semibold">{contactFirstName}</span>
                <span className="text-zinc-400 mx-1.5">owes</span>
                <span className="font-semibold">{otherFirst}</span>
              </>
            ) : (
              <>
                <span className="font-semibold">{otherFirst}</span>
                <span className="text-zinc-400 mx-1.5">owes</span>
                <span className="font-semibold">{contactFirstName}</span>
              </>
            )}
          </p>
          {subLabel && (
            <p className="text-xs text-zinc-400 mt-0.5">{subLabel}</p>
          )}
        </div>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${amountColor}`}>
          {formatCents(group.totalAmountCents)}
        </span>
      </div>

      {/* Per-entry breakdown */}
      <div className="pb-2 px-4 flex flex-col gap-0.5">
        {group.entries.map((entry) => (
          <Link
            key={entry.id}
            href={entry.href}
            className="flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group"
          >
            <span className="text-zinc-300 dark:text-zinc-600 text-xs shrink-0">└</span>
            <span className="flex-1 text-xs text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 truncate">
              {entry.label}
            </span>
            <span className={`text-xs font-semibold tabular-nums shrink-0 ${amountColor}`}>
              {formatCents(entry.amountCents)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

