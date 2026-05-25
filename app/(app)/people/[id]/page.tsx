import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactProfile, type BillBreakdown } from "@/lib/actions/contacts";
import { requireUser } from "@/lib/server-auth";
import { Avatar } from "@/components/ui/Avatar";
import { formatCents } from "@/lib/utils";
import { PersonActions } from "./PersonActions";
import { ExpenseRow } from "./ExpenseActions";

export const metadata: Metadata = { title: "Profile" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SharedExpense = Awaited<ReturnType<typeof getContactProfile>>["sharedExpenses"][number];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PersonProfilePage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const { contact, netCents, sharedExpenses, billBreakdowns } = await getContactProfile(params.id);

  if (!contact) notFound();

  // ── Split into "they owe me" vs "I owe them" ──────────────────────────────
  const theyOweMeBills = billBreakdowns.filter((b) => b.netCents > 0);
  const iOweThemBills  = billBreakdowns.filter((b) => b.netCents < 0);

  const theyOweMeExpenses: SharedExpense[] = [];
  const iOweThemExpenses: SharedExpense[] = [];

  for (const exp of sharedExpenses) {
    if (exp.paidById === me.id) theyOweMeExpenses.push(exp);
    else if (exp.paidById === contact.id) iOweThemExpenses.push(exp);
  }

  const theyOweMeTotal =
    theyOweMeBills.reduce((s, b) => s + b.netCents, 0) +
    theyOweMeExpenses.reduce((s, e) => {
      const theirSplit = e.splits.find((sp) => sp.userId === contact.id);
      return s + (theirSplit ? Math.round(e.totalCents * (theirSplit.numerator / theirSplit.denominator)) : 0);
    }, 0);

  const iOweThemTotal =
    iOweThemBills.reduce((s, b) => s + Math.abs(b.netCents), 0) +
    iOweThemExpenses.reduce((s, e) => {
      const mySplit = e.splits.find((sp) => sp.userId === me.id);
      return s + (mySplit ? Math.round(e.totalCents * (mySplit.numerator / mySplit.denominator)) : 0);
    }, 0);

  const hasTheyOweSection = theyOweMeBills.length > 0 || theyOweMeExpenses.length > 0;
  const hasIOweSection    = iOweThemBills.length > 0  || iOweThemExpenses.length > 0;
  const hasAnything       = hasTheyOweSection || hasIOweSection;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Avatar name={contact.name!} size="lg" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white truncate">{contact.name}</h1>
          {netCents === 0 ? (
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
      {hasTheyOweSection && (
        <Section
          direction="they-owe"
          label={`${contact.name!.split(" ")[0]} owes you`}
          total={theyOweMeTotal}
        >
          {theyOweMeBills.map((bill) => (
            <BillRow key={bill.billId} bill={bill} contactName={contact.name!} />
          ))}
          {theyOweMeExpenses.map((expense) => {
            const theirSplit = expense.splits.find((s) => s.userId === contact.id);
            const netAmount = theirSplit
              ? Math.round(expense.totalCents * (theirSplit.numerator / theirSplit.denominator))
              : 0;
            return (
              <ExpenseRow
                key={expense.id}
                flat
                expense={expense}
                currentUserId={me.id}
                contactName={contact.name!}
                netAmount={netAmount}
                amountLabel="you lent"
                amountColor="text-emerald-600 dark:text-emerald-400"
                amountSign="+"
              />
            );
          })}
        </Section>
      )}

      {/* ── You owe them ── */}
      {hasIOweSection && (
        <Section
          direction="i-owe"
          label={`You owe ${contact.name!.split(" ")[0]}`}
          total={iOweThemTotal}
        >
          {iOweThemBills.map((bill) => (
            <BillRow key={bill.billId} bill={bill} contactName={contact.name!} />
          ))}
          {iOweThemExpenses.map((expense) => {
            const mySplit = expense.splits.find((s) => s.userId === me.id);
            const netAmount = mySplit
              ? Math.round(expense.totalCents * (mySplit.numerator / mySplit.denominator))
              : 0;
            return (
              <ExpenseRow
                key={expense.id}
                flat
                expense={expense}
                currentUserId={me.id}
                contactName={contact.name!}
                netAmount={netAmount}
                amountLabel="you borrowed"
                amountColor="text-red-500 dark:text-red-400"
                amountSign="−"
              />
            );
          })}
        </Section>
      )}

      {/* ── Empty state ── */}
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
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  direction,
  label,
  total,
  children,
}: {
  direction: "they-owe" | "i-owe";
  label: string;
  total: number;
  children: React.ReactNode;
}) {
  const isGreen = direction === "they-owe";

  return (
    <div className={`rounded-2xl overflow-hidden border ${
      isGreen
        ? "border-emerald-200 dark:border-emerald-800/60"
        : "border-red-200 dark:border-red-800/60"
    }`}>
      {/* Coloured header */}
      <div className={`flex items-center justify-between px-4 py-3 ${
        isGreen
          ? "bg-emerald-50 dark:bg-emerald-950/30"
          : "bg-red-50 dark:bg-red-950/30"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-lg leading-none ${isGreen ? "text-emerald-500" : "text-red-400"}`}>
            {isGreen ? "↑" : "↓"}
          </span>
          <span className={`text-sm font-semibold ${
            isGreen ? "text-emerald-900 dark:text-emerald-100" : "text-red-900 dark:text-red-100"
          }`}>
            {label}
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${
          isGreen
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-red-600 dark:text-red-400"
        }`}>
          {isGreen ? "+" : "−"}{formatCents(total)}
        </span>
      </div>

      {/* Rows */}
      <div className={`divide-y ${
        isGreen
          ? "divide-emerald-100 dark:divide-emerald-900/40 bg-white dark:bg-zinc-950"
          : "divide-red-100 dark:divide-red-900/40 bg-white dark:bg-zinc-950"
      }`}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bill row (flat, sits inside a Section)
// ---------------------------------------------------------------------------

function BillRow({ bill, contactName }: { bill: BillBreakdown; contactName: string }) {
  const date = new Date(bill.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short",
  });
  const absNet = Math.abs(bill.netCents);
  const isPos = bill.netCents > 0;

  return (
    <Link
      href={`/events/${bill.eventId}`}
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 text-sm">
        🏪
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
          {bill.establishmentName}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {bill.eventName} · {date} · {bill.itemCount} item{bill.itemCount !== 1 ? "s" : ""}
        </p>
        {/* Share chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {bill.myOwedCents > 0 && (
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">
              Your share {formatCents(bill.myOwedCents)}
            </span>
          )}
          {bill.theirOwedCents > 0 && (
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full px-2 py-0.5">
              {contactName.split(" ")[0]}'s share {formatCents(bill.theirOwedCents)}
            </span>
          )}
          {bill.myPaidCents > 0 && (
            <span className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5">
              You paid {formatCents(bill.myPaidCents)}
            </span>
          )}
          {bill.theirPaidCents > 0 && (
            <span className="text-xs bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 rounded-full px-2 py-0.5">
              {contactName.split(" ")[0]} paid {formatCents(bill.theirPaidCents)}
            </span>
          )}
        </div>
      </div>

      {/* Net */}
      <div className="shrink-0 text-right pt-0.5">
        <span className={`text-sm font-bold tabular-nums ${
          isPos
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        }`}>
          {isPos ? "+" : "−"}{formatCents(absNet)}
        </span>
      </div>
    </Link>
  );
}
