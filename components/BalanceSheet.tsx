import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatCents } from "@/lib/utils";
import type { EventBalanceSummary } from "@/lib/actions/balances";

type BalanceItem = EventBalanceSummary["balances"][number];

interface BalanceSheetProps {
  summary: EventBalanceSummary;
  members: Array<{ id: string; name?: string | null; image?: string | null }>;
}

function memberById(id: string, members: BalanceSheetProps["members"]) {
  return members.find((m) => m.id === id);
}

export function BalanceSheet({ summary, members }: BalanceSheetProps) {
  const { balances, settlements } = summary;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">Balances</h3>
        <div className="flex flex-col gap-2">
          {balances.map((b) => (
            <BalanceRow key={b.userId} balance={b} />
          ))}
        </div>
      </div>

      {settlements.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
            Settle up
          </h3>
          <div className="flex flex-col gap-2">
            {settlements.map((s, i) => {
              const from = memberById(s.fromUserId, members);
              const to = memberById(s.toUserId, members);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 px-4 py-3"
                >
                  <Avatar name={from?.name} image={from?.image} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {from?.name ?? "Someone"}
                    </span>
                    <span className="text-sm text-zinc-500"> pays </span>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {to?.name ?? "Someone"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 shrink-0">
                    {formatCents(s.amountCents)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {settlements.length === 0 && balances.some((b) => b.netCents !== 0) && (
        <p className="text-sm text-zinc-500 text-center py-4">All balances are even.</p>
      )}
    </div>
  );
}

function BalanceRow({ balance }: { balance: BalanceItem }) {
  const isPositive = balance.netCents > 0;
  const isNegative = balance.netCents < 0;
  const isEven = balance.netCents === 0;

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-zinc-50 dark:bg-zinc-900">
      <Avatar name={balance.name} image={balance.image} size="sm" />
      <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
        {balance.name ?? "Unknown"}
      </span>
      {isEven && <Badge variant="success">Settled</Badge>}
      {isPositive && (
        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
          +{formatCents(balance.netCents)}
        </span>
      )}
      {isNegative && (
        <span className="text-sm font-semibold text-red-500 dark:text-red-400">
          −{formatCents(-balance.netCents)}
        </span>
      )}
    </div>
  );
}
