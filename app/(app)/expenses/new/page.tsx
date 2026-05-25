import { Metadata } from "next";
import { QuickExpenseClient } from "./QuickExpenseClient";
import { getMyParticipants } from "@/lib/actions/contacts";

export const metadata: Metadata = { title: "New Quick Expense" };

export default async function QuickExpensePage({
  searchParams,
}: {
  searchParams: { with?: string };
}) {
  const participants = await getMyParticipants();

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
        Quick Expense
      </h1>
      <QuickExpenseClient
        participants={participants}
        initialTarget={searchParams.with}
      />
    </div>
  );
}
