import { Metadata } from "next";
import Link from "next/link";
import { getGroup } from "@/lib/actions/groups";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Group" };

export default async function GroupPage({ params }: { params: { groupId: string } }) {
  const group = await getGroup(params.groupId);

  const members = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    image: m.user.image,
  }));

  const totalSpend = group.directExpenses.reduce((s, de) => s + de.totalCents, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <span className="text-4xl">{group.emoji}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white truncate">{group.name}</h1>
          <div className="flex -space-x-2 mt-2">
            {members.map((m) => (
              <Avatar key={m.id} name={m.name} image={m.image} size="sm" className="ring-2 ring-white dark:ring-zinc-950" />
            ))}
          </div>
        </div>
        {totalSpend > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="text-base font-bold text-zinc-900 dark:text-white">{formatCents(totalSpend)}</p>
          </div>
        )}
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-zinc-900 dark:text-white">Members</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} image={m.image} size="sm" />
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{m.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Direct expenses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-900 dark:text-white">Expenses</h2>
          <Link href={`/groups/${group.id}/expenses/new`}>
            <Button size="sm" variant="secondary">+ Add expense</Button>
          </Link>
        </div>

        {group.directExpenses.length === 0 ? (
          <EmptyState
            icon="💵"
            title="No expenses yet"
            description="Add a shared expense like rent, utilities, or groceries."
          >
            <Link href={`/groups/${group.id}/expenses/new`}>
              <Button variant="primary" size="sm">Add first expense</Button>
            </Link>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {group.directExpenses.map((de) => (
              <div
                key={de.id}
                className="flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3"
              >
                <span className="text-xl">💵</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{de.description}</p>
                  <p className="text-xs text-zinc-500">Paid by {de.paidByUser.name}</p>
                </div>
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                  {formatCents(de.totalCents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
