import { Metadata } from "next";
import Link from "next/link";
import { getMyContacts } from "@/lib/actions/contacts";
import { getGlobalBalances } from "@/lib/actions/balances";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const [contacts, { balances }] = await Promise.all([
    getMyContacts(),
    getGlobalBalances(),
  ]);

  const balanceMap = new Map(balances.map((b) => [b.userId, b.netCents]));

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">People</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Friends you split expenses with</p>
        </div>
        <Link href="/people/new">
          <Button size="sm" variant="primary">+ Add person</Button>
        </Link>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-5xl">👤</span>
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">No people yet</h3>
          <p className="text-sm text-zinc-500 max-w-xs">
            Add friends or family members to split expenses with them.
          </p>
          <Link href="/people/new">
            <Button variant="primary" size="md">Add your first person</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((contact) => {
            const net = balanceMap.get(contact.id) ?? 0;
            return (
              <Link
                key={contact.id}
                href={`/people/${contact.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
              >
                <Avatar name={contact.name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{contact.name}</p>
                  {net === 0 ? (
                    <p className="text-xs text-zinc-400">All settled</p>
                  ) : net > 0 ? (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Owes you {formatCents(net)}
                    </p>
                  ) : (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      You owe {formatCents(-net)}
                    </p>
                  )}
                </div>
                {net !== 0 && (
                  <span className={`text-sm font-semibold ${net > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {net > 0 ? "+" : "−"}{formatCents(Math.abs(net))}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
