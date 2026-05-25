import { Metadata } from "next";
import Link from "next/link";
import { getMyGroups } from "@/lib/actions/groups";
import { GroupCard } from "@/components/GroupCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage() {
  const groups = await getMyGroups();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Groups</h1>
        <Link href="/groups/new">
          <Button size="sm" variant="primary">+ New group</Button>
        </Link>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon="👥" title="No groups yet" description="Create a group for roommates, a recurring crew, or anyone you split with regularly.">
          <Link href="/groups/new"><Button variant="primary" size="md">Create first group</Button></Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => <GroupCard key={g.id} group={g} />)}
        </div>
      )}
    </div>
  );
}
