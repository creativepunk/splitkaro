import { Metadata } from "next";
import Link from "next/link";
import { getContactListData, type ContactListItem } from "@/lib/actions/contacts";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/utils";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const items = await getContactListData();
  const me = items.find((i) => i.isMe)!;
  const contacts = items.filter((i) => !i.isMe);

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

      <div className="flex flex-col gap-2">
        {/* ── Current user (non-clickable) ── */}
        <PersonCard item={me} />

        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="text-4xl">👤</span>
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">No people yet</h3>
            <p className="text-sm text-zinc-500 max-w-xs">
              Add friends or family members to split expenses with them.
            </p>
            <Link href="/people/new">
              <Button variant="primary" size="md">Add your first person</Button>
            </Link>
          </div>
        ) : (
          contacts.map((contact) => (
            <Link key={contact.id} href={`/people/${contact.id}`}>
              <PersonCard item={contact} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card — shared between "me" and contacts
// ---------------------------------------------------------------------------

function PersonCard({ item }: { item: ContactListItem }) {
  const net = item.totalOwed - item.totalOwes;

  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-white dark:bg-zinc-900 px-4 py-3 transition-colors ${
      item.isMe
        ? "border-brand-200 dark:border-brand-800"
        : "border-zinc-200 dark:border-zinc-800 hover:border-brand-300 dark:hover:border-brand-700"
    }`}>
      <Avatar name={item.name} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
          {item.name ?? "—"}
          {item.isMe && (
            <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span>
          )}
        </p>

        {/* Owes · Owed sub-line */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {item.totalOwes > 0 && (
            <span className="text-xs text-red-500 dark:text-red-400">
              owes {formatCents(item.totalOwes)}
            </span>
          )}
          {item.totalOwes > 0 && item.totalOwed > 0 && (
            <span className="text-xs text-zinc-300 dark:text-zinc-600">·</span>
          )}
          {item.totalOwed > 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              owed {formatCents(item.totalOwed)}
            </span>
          )}
          {item.totalOwes === 0 && item.totalOwed === 0 && (
            <span className="text-xs text-zinc-400">All settled</span>
          )}
        </div>
      </div>

      {/* Net badge on the right */}
      {net !== 0 && (
        <span className={`text-sm font-semibold tabular-nums shrink-0 ${
          net > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        }`}>
          {net > 0 ? "+" : "−"}{formatCents(Math.abs(net))}
        </span>
      )}
    </div>
  );
}
