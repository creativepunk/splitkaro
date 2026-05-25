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

export default async function PersonProfilePage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const { contact, netCents, sharedExpenses, billBreakdowns } = await getContactProfile(params.id);

  if (!contact) notFound();

  const billsTotal = billBreakdowns.reduce((s, b) => s + b.netCents, 0);
  const directTotal = netCents - billsTotal; // what the direct expenses contribute

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Avatar name={contact.name!} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{contact.name}</h1>
          <p className="text-sm mt-0.5">
            {netCents === 0 ? (
              <span className="text-zinc-500">Settled up</span>
            ) : netCents > 0 ? (
              <span className="text-green-600 dark:text-green-400 font-semibold">
                Owes you {formatCents(netCents)}
              </span>
            ) : (
              <span className="text-red-500 dark:text-red-400 font-semibold">
                You owe {formatCents(-netCents)}
              </span>
            )}
          </p>
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

      {/* ── Balance breakdown ── */}
      {(billBreakdowns.length > 0 || sharedExpenses.length > 0) && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Balance breakdown
            </span>
            {netCents !== 0 && (
              <span className={netCents > 0 ? "text-sm font-bold text-green-600 dark:text-green-400" : "text-sm font-bold text-red-500 dark:text-red-400"}>
                {netCents > 0 ? "+" : "−"}{formatCents(Math.abs(netCents))}
              </span>
            )}
          </div>

          {/* Event bills */}
          {billBreakdowns.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/50">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">From events</span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {billBreakdowns.map((bill) => (
                  <BillBreakdownRow
                    key={bill.billId}
                    bill={bill}
                    contactName={contact.name!}
                  />
                ))}
              </div>
              {/* Subtotal for events */}
              {billsTotal !== 0 && (
                <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Events subtotal</span>
                  <span className={`text-xs font-semibold tabular-nums ${billsTotal > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {billsTotal > 0 ? "+" : "−"}{formatCents(Math.abs(billsTotal))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Direct expenses */}
          {sharedExpenses.length > 0 && (
            <div>
              <div className={`px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 ${billBreakdowns.length > 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""}`}>
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Quick expenses</span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sharedExpenses.map((expense) => {
                  const mySplit = expense.splits.find((s) => s.userId === me.id);
                  const theirSplit = expense.splits.find((s) => s.userId === contact.id);
                  let netAmount = 0, amountLabel = "", amountColor = "text-zinc-500", amountSign = "";

                  if (mySplit && theirSplit) {
                    const total = expense.totalCents;
                    const myShare = Math.round(total * (mySplit.numerator / mySplit.denominator));
                    const theirShare = Math.round(total * (theirSplit.numerator / theirSplit.denominator));
                    if (expense.paidById === me.id) {
                      netAmount = theirShare;
                      amountLabel = "you lent";
                      amountColor = "text-green-600 dark:text-green-400";
                      amountSign = "+";
                    } else if (expense.paidById === contact.id) {
                      netAmount = myShare;
                      amountLabel = "you borrowed";
                      amountColor = "text-red-500 dark:text-red-400";
                      amountSign = "−";
                    }
                  }

                  return (
                    <div key={expense.id} className="px-4 py-0.5">
                      <ExpenseRow
                        expense={expense}
                        currentUserId={me.id}
                        contactName={contact.name!}
                        netAmount={netAmount}
                        amountLabel={amountLabel}
                        amountColor={amountColor}
                        amountSign={amountSign}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Subtotal for direct */}
              {directTotal !== 0 && billBreakdowns.length > 0 && (
                <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Quick expenses subtotal</span>
                  <span className={`text-xs font-semibold tabular-nums ${directTotal > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {directTotal > 0 ? "+" : "−"}{formatCents(Math.abs(directTotal))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {billBreakdowns.length === 0 && sharedExpenses.length === 0 && (
        <div className="text-center py-12 border border-zinc-200 dark:border-zinc-800 rounded-xl border-dashed">
          <span className="text-4xl mb-3 block">💸</span>
          <p className="text-sm text-zinc-500">No shared expenses with {contact.name} yet.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bill breakdown row
// ---------------------------------------------------------------------------

function BillBreakdownRow({ bill, contactName }: { bill: BillBreakdown; contactName: string }) {
  const isPos = bill.netCents > 0;
  const isNeg = bill.netCents < 0;
  const isEven = bill.netCents === 0;

  const date = new Date(bill.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <Link
      href={`/events/${bill.eventId}`}
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors group"
    >
      {/* Icon */}
      <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-sm">🏪</span>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-snug">
          {bill.establishmentName}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {bill.eventName} · {date} · {bill.itemCount} item{bill.itemCount !== 1 ? "s" : ""}
        </p>
        {/* Share details */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
            <span className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5">
              You paid {formatCents(bill.myPaidCents)}
            </span>
          )}
          {bill.theirPaidCents > 0 && (
            <span className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-full px-2 py-0.5">
              {contactName.split(" ")[0]} paid {formatCents(bill.theirPaidCents)}
            </span>
          )}
        </div>
      </div>

      {/* Net for this bill */}
      <div className="shrink-0 text-right">
        {isEven && (
          <span className="text-xs font-medium text-zinc-400">Even</span>
        )}
        {isPos && (
          <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
            +{formatCents(bill.netCents)}
          </span>
        )}
        {isNeg && (
          <span className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
            −{formatCents(-bill.netCents)}
          </span>
        )}
        <p className="text-xs text-zinc-400 mt-0.5">
          {isPos ? "they owe" : isNeg ? "you owe" : ""}
        </p>
      </div>
    </Link>
  );
}
