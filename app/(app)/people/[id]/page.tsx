import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactProfile } from "@/lib/actions/contacts";
import { requireUser } from "@/lib/server-auth";
import { Avatar } from "@/components/ui/Avatar";
import { formatCents } from "@/lib/utils";
import { PersonActions } from "./PersonActions";
import { ExpenseRow } from "./ExpenseActions";

export const metadata: Metadata = { title: "Profile" };

export default async function PersonProfilePage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  const { contact, netCents, sharedExpenses } = await getContactProfile(params.id);

  if (!contact) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar name={contact.name!} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{contact.name}</h1>
          <p className="text-sm text-zinc-500">
            {netCents === 0 ? (
              <span>You and {contact.name} are settled up.</span>
            ) : netCents > 0 ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                Owes you {formatCents(netCents)}
              </span>
            ) : (
              <span className="text-red-500 dark:text-red-400 font-medium">
                You owe {formatCents(-netCents)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 mb-8">
        <Link
          href={`/expenses/new?with=${contact.id}`}
          className="flex justify-center items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition"
        >
          Add Quick Expense
        </Link>
        <PersonActions contactId={contact.id} currentName={contact.name!} />
      </div>

      {/* Expenses List */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Shared Expenses</h2>

        {sharedExpenses.length === 0 ? (
          <div className="text-center py-12 border border-zinc-200 dark:border-zinc-800 rounded-xl border-dashed">
            <span className="text-4xl mb-3 block">💸</span>
            <p className="text-sm text-zinc-500">No direct expenses with {contact.name} yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sharedExpenses.map((expense) => {
              const mySplit = expense.splits.find((s) => s.userId === me.id);
              const theirSplit = expense.splits.find((s) => s.userId === contact.id);

              let amountLabel = "";
              let amountColor = "text-zinc-500";
              let amountSign = "";
              let netAmount = 0;

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
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  currentUserId={me.id}
                  contactName={contact.name!}
                  netAmount={netAmount}
                  amountLabel={amountLabel}
                  amountColor={amountColor}
                  amountSign={amountSign}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
