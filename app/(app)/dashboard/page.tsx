import { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyGroups } from "@/lib/actions/groups";
import { getMyEvents } from "@/lib/actions/events";
import { getGlobalBalances } from "@/lib/actions/balances";
import { getMyContacts } from "@/lib/actions/contacts";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const [groups, events, globalBalances, contacts] = await Promise.all([
    getMyGroups().catch(() => []),
    getMyEvents().catch(() => []),
    getGlobalBalances().catch(() => ({ balances: [], settlements: [] })),
    getMyContacts().catch(() => []),
  ]);
  const { balances } = globalBalances;

  const balanceMap = new Map(balances.map((b) => [b.userId, b.netCents]));

  const totalOwedToMe = balances.filter((b) => b.netCents > 0).reduce((s, b) => s + b.netCents, 0);
  const totalIOwe = balances.filter((b) => b.netCents < 0).reduce((s, b) => s + b.netCents, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Hi, {session.user.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          {(totalOwedToMe > 0 || totalIOwe < 0) ? (
            <p className="text-sm text-zinc-500 mt-0.5">
              {totalOwedToMe > 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {formatCents(totalOwedToMe)} owed to you
                </span>
              )}
              {totalOwedToMe > 0 && totalIOwe < 0 && <span className="text-zinc-400 mx-1.5">·</span>}
              {totalIOwe < 0 && (
                <span className="text-red-500 dark:text-red-400 font-medium">
                  you owe {formatCents(-totalIOwe)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-zinc-400 mt-0.5">All settled up!</p>
          )}
        </div>
        <Link href="/expenses/new">
          <button className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors">
            <span>+ Quick Expense</span>
          </button>
        </Link>
      </div>

      {/* ── People ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-900 dark:text-white">People</h2>
          <Link href="/people/new" className="text-sm text-brand-600 dark:text-brand-400 font-medium">
            + Add
          </Link>
        </div>

        {contacts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-zinc-400 mb-3">No people added yet.</p>
              <Link href="/people/new" className="text-sm text-brand-600 dark:text-brand-400 font-medium underline">
                Add your first person
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {contacts.map((contact) => {
              const net = balanceMap.get(contact.id) ?? 0;
              return (
                <Link key={contact.id} href={`/people/${contact.id}`}>
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                    <Avatar name={contact.name} size="sm" />
                    <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{contact.name}</span>
                    {net === 0 && <span className="text-xs text-zinc-400">settled</span>}
                    {net > 0 && <span className="text-sm font-semibold text-green-600 dark:text-green-400">+{formatCents(net)}</span>}
                    {net < 0 && <span className="text-sm font-semibold text-red-500 dark:text-red-400">−{formatCents(-net)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Groups ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-900 dark:text-white">Groups</h2>
          <Link href="/groups/new" className="text-sm text-brand-600 dark:text-brand-400 font-medium">
            + New
          </Link>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-zinc-400 mb-3">No groups yet.</p>
              <Link href="/groups/new" className="text-sm text-brand-600 dark:text-brand-400 font-medium underline">
                Create a group
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                  <span className="text-2xl">{group.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{group.name}</p>
                    <p className="text-xs text-zinc-400">{group.members.length} people</p>
                  </div>
                  {group._count.directExpenses > 0 && (
                    <Badge variant="default">{group._count.directExpenses} expense{group._count.directExpenses !== 1 ? "s" : ""}</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Events ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-900 dark:text-white">Events</h2>
          <Link href="/events/new" className="text-sm text-brand-600 dark:text-brand-400 font-medium">
            + New
          </Link>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-zinc-400 mb-3">No events yet.</p>
              <Link href="/events/new" className="text-sm text-brand-600 dark:text-brand-400 font-medium underline">
                Create an event
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => {
              const total = event.establishments.reduce(
                (s, est) => s + est.bills.reduce((s2, b) => s2 + b.totalCents, 0),
                0
              );
              return (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                    <span className="text-2xl">✈️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{event.name}</p>
                      <p className="text-xs text-zinc-400">
                        {event.participants.length} people · {event._count.establishments} stop{event._count.establishments !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {total > 0 && (
                      <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 shrink-0">
                        {formatCents(total)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
