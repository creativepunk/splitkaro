import { Metadata } from "next";
import Link from "next/link";
import { getMyDirectExpenses } from "@/lib/actions/bills";
import { requireUser } from "@/lib/server-auth";
import { ActivityClient } from "./ActivityClient";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const [me, expenses] = await Promise.all([
    requireUser(),
    getMyDirectExpenses(),
  ]);

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Activity</h1>
        <Link
          href="/expenses/new"
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          + Add expense
        </Link>
      </div>

      <ActivityClient expenses={expenses} currentUserId={me.id} />
    </div>
  );
}
