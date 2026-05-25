import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { AvatarGroup } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    emoji: string;
    members: Array<{ user: { id: string; name?: string | null; image?: string | null } }>;
    _count: { directExpenses: number };
  };
}

export function GroupCard({ group }: GroupCardProps) {
  const totalActivity = group._count.directExpenses;

  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="hover:border-brand-300 dark:hover:border-brand-700 transition-colors cursor-pointer hover:shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl shrink-0">{group.emoji}</span>
              <div className="min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{group.name}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {totalActivity > 0 && (
              <Badge variant="info" className="shrink-0">
                {totalActivity} item{totalActivity !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <AvatarGroup
              users={group.members.map((m) => ({ id: m.user.id, name: m.user.name, image: m.user.image }))}
              size="sm"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
