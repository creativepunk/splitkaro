import { Metadata } from "next";
import Link from "next/link";
import { getMyContacts } from "@/lib/actions/contacts";
import { getGlobalBalances, type RichSettlement } from "@/lib/actions/balances";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const [contacts, { balances, settlements, currentUserId }] = await Promise.all([
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
        <div className="flex flex-col gap-4">
          {/* ── Simplified settlements card ── */}
          {settlements.length > 0 && (
            <SettlementsCard
              settlements={settlements}
              currentUserId={currentUserId}
            />
          )}

          {/* ── Per-person balance list ── */}
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settlements card
// ---------------------------------------------------------------------------

function SettlementsCard({
  settlements,
  currentUserId,
}: {
  settlements: RichSettlement[];
  currentUserId: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-200 dark:border-brand-800/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-brand-50 dark:bg-brand-950/30 border-b border-brand-200 dark:border-brand-800/60">
        <span className="text-base leading-none">⚡</span>
        <div>
          <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
            Simplified settle-up
          </p>
          <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
            {settlements.length} transfer{settlements.length !== 1 ? "s" : ""} clears all debts
          </p>
        </div>
      </div>

      {/* Settlement rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
        {settlements.map((s, i) => {
          const iOwe  = s.fromUserId === currentUserId;
          const iReceive = s.toUserId === currentUserId;

          const fromLabel = iOwe ? "You" : (s.fromName ?? "Someone");
          const toLabel   = iReceive ? "you" : (s.toName ?? "Someone");

          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* Avatar stack */}
              <div className="flex items-center shrink-0">
                <Avatar
                  name={iOwe ? "You" : s.fromName}
                  size="sm"
                />
                <span className="text-zinc-300 dark:text-zinc-600 mx-1.5 text-xs">→</span>
                <Avatar
                  name={iReceive ? "You" : s.toName}
                  size="sm"
                />
              </div>

              {/* Label */}
              <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 min-w-0">
                <span className={`font-semibold ${iOwe ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white"}`}>
                  {fromLabel}
                </span>
                <span className="text-zinc-400 mx-1">pays</span>
                <span className={`font-semibold ${iReceive ? "text-green-600 dark:text-green-400" : "text-zinc-900 dark:text-white"}`}>
                  {toLabel}
                </span>
              </p>

              {/* Amount */}
              <span className={`text-sm font-bold tabular-nums shrink-0 ${
                iOwe
                  ? "text-red-600 dark:text-red-400"
                  : iReceive
                  ? "text-green-600 dark:text-green-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}>
                {formatCents(s.amountCents)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
