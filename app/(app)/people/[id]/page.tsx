import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactProfile, type BillBreakdown, type ContactOtherDebt } from "@/lib/actions/contacts";
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
  const { contact, netCents, sharedExpenses, billBreakdowns, othersDebts } =
    await getContactProfile(params.id);

  if (!contact) notFound();

  const firstName = contact.name!.split(" ")[0];

  // Split into directional buckets
  const theyOweMeBills = billBreakdowns.filter((b) => b.netCents > 0);
  const iOweThemBills  = billBreakdowns.filter((b) => b.netCents < 0);

  const theyOweMeExpenses: SharedExpense[] = [];
  const iOweThemExpenses: SharedExpense[]  = [];
  for (const exp of sharedExpenses) {
    if (exp.paidById === me.id) theyOweMeExpenses.push(exp);
    else if (exp.paidById === contact.id) iOweThemExpenses.push(exp);
  }

  const theyOweMeTotal =
    theyOweMeBills.reduce((s, b) => s + b.netCents, 0) +
    theyOweMeExpenses.reduce((s, e) => {
      const sp = e.splits.find((x) => x.userId === contact.id);
      return s + (sp ? Math.round(e.totalCents * (sp.numerator / sp.denominator)) : 0);
    }, 0);

  const iOweThemTotal =
    iOweThemBills.reduce((s, b) => s + Math.abs(b.netCents), 0) +
    iOweThemExpenses.reduce((s, e) => {
      const sp = e.splits.find((x) => x.userId === me.id);
      return s + (sp ? Math.round(e.totalCents * (sp.numerator / sp.denominator)) : 0);
    }, 0);

  const hasTheyOwe = theyOweMeBills.length > 0 || theyOweMeExpenses.length > 0;
  const hasIOwe    = iOweThemBills.length > 0  || iOweThemExpenses.length > 0;
  const hasOthers  = othersDebts.length > 0;
  const hasAnything = hasTheyOwe || hasIOwe || hasOthers;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Avatar name={contact.name!} size="lg" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">{contact.name}</h1>
          {netCents === 0 && !hasOthers ? (
            <p className="text-sm text-zinc-500 mt-0.5">All settled up 🎉</p>
          ) : (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {theyOweMeTotal > 0 && (
                <span className="text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full px-2.5 py-0.5">
                  owes you {formatCents(theyOweMeTotal)}
                </span>
              )}
              {iOweThemTotal > 0 && (
                <span className="text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-full px-2.5 py-0.5">
                  you owe {formatCents(iOweThemTotal)}
                </span>
              )}
              {theyOweMeTotal > 0 && iOweThemTotal > 0 && (
                <span className="text-xs text-zinc-400">
                  net {netCents > 0 ? "+" : "−"}{formatCents(Math.abs(netCents))}
                </span>
              )}
            </div>
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

      {/* ── They owe you ── */}
      {hasTheyOwe && (
        <DirectionSection direction="they-owe" label={`${firstName} owes you`} total={theyOweMeTotal}>
          {theyOweMeBills.map((b) => (
            <BillRow key={b.billId} bill={b} contactName={contact.name!} />
          ))}
          {theyOweMeExpenses.map((exp) => {
            const sp = exp.splits.find((x) => x.userId === contact.id);
            const net = sp ? Math.round(exp.totalCents * (sp.numerator / sp.denominator)) : 0;
            return (
              <ExpenseRow
                key={exp.id} flat
                expense={exp} currentUserId={me.id} contactName={contact.name!}
                netAmount={net} amountLabel="you lent"
                amountColor="text-emerald-600 dark:text-emerald-400" amountSign="+"
              />
            );
          })}
        </DirectionSection>
      )}

      {/* ── You owe them ── */}
      {hasIOwe && (
        <DirectionSection direction="i-owe" label={`You owe ${firstName}`} total={iOweThemTotal}>
          {iOweThemBills.map((b) => (
            <BillRow key={b.billId} bill={b} contactName={contact.name!} />
          ))}
          {iOweThemExpenses.map((exp) => {
            const sp = exp.splits.find((x) => x.userId === me.id);
            const net = sp ? Math.round(exp.totalCents * (sp.numerator / sp.denominator)) : 0;
            return (
              <ExpenseRow
                key={exp.id} flat
                expense={exp} currentUserId={me.id} contactName={contact.name!}
                netAmount={net} amountLabel="you borrowed"
                amountColor="text-red-500 dark:text-red-400" amountSign="−"
              />
            );
          })}
        </DirectionSection>
      )}

      {/* ── With others in shared events ── */}
      {hasOthers && (
        <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              {firstName}&apos;s other debts
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Settlements with other people in shared events
            </p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
            {othersDebts.map((debt, i) => (
              <OtherDebtRow key={i} debt={debt} contactFirstName={firstName} />
            ))}
          </div>
        </div>
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
// Bill row — flat, sits inside a DirectionSection
// ---------------------------------------------------------------------------

function BillRow({ bill, contactName }: { bill: BillBreakdown; contactName: string }) {
  const firstName = contactName.split(" ")[0];
  const date = new Date(bill.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short",
  });
  const absNet = Math.abs(bill.netCents);
  const isPos  = bill.netCents > 0;

  return (
    <Link
      href={`/events/${bill.eventId}`}
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
    >
      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 text-sm">
        🏪
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
          {bill.establishmentName}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {bill.eventName} · {date} · {bill.itemCount} item{bill.itemCount !== 1 ? "s" : ""}
        </p>
        {/* Neutral chips — color lives only on the net amount */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {bill.myOwedCents > 0 && (
            <Chip>Your share {formatCents(bill.myOwedCents)}</Chip>
          )}
          {bill.theirOwedCents > 0 && (
            <Chip>{firstName}&apos;s share {formatCents(bill.theirOwedCents)}</Chip>
          )}
          {bill.myPaidCents > 0 && (
            <Chip>You paid {formatCents(bill.myPaidCents)}</Chip>
          )}
          {bill.theirPaidCents > 0 && (
            <Chip>{firstName} paid {formatCents(bill.theirPaidCents)}</Chip>
          )}
        </div>
      </div>
      {/* Net — this is the only colored element in the row */}
      <div className="shrink-0 text-right pt-0.5">
        <span className={`text-sm font-bold tabular-nums ${
          isPos ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
        }`}>
          {isPos ? "+" : "−"}{formatCents(absNet)}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Other-person debt row
// ---------------------------------------------------------------------------

function OtherDebtRow({ debt, contactFirstName }: { debt: ContactOtherDebt; contactFirstName: string }) {
  const otherFirst = debt.otherPersonName?.split(" ")[0] ?? "Someone";
  return (
    <Link
      href={`/events/${debt.eventId}`}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {debt.contactOwes ? (
            <><span className="font-semibold">{contactFirstName}</span>
              <span className="text-zinc-400 mx-1.5">owes</span>
              <span className="font-semibold">{otherFirst}</span></>
          ) : (
            <><span className="font-semibold">{otherFirst}</span>
              <span className="text-zinc-400 mx-1.5">owes</span>
              <span className="font-semibold">{contactFirstName}</span></>
          )}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">{debt.eventName}</p>
      </div>
      <span className={`text-sm font-bold tabular-nums shrink-0 ${
        debt.contactOwes
          ? "text-red-500 dark:text-red-400"
          : "text-emerald-600 dark:text-emerald-400"
      }`}>
        {formatCents(debt.amountCents)}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">
      {children}
    </span>
  );
}
