import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCents } from "@/lib/utils";

interface EventCardProps {
  event: {
    id: string;
    groupId?: string;
    name: string;
    startDate?: Date | null;
    endDate?: Date | null;
    _count: { establishments: number };
    establishments: Array<{ bills: Array<{ totalCents: number }> }>;
  };
  /** Override the link destination. Defaults to /events/[id]. */
  href?: string;
}

export function EventCard({ event, href }: EventCardProps) {
  const totalCents = event.establishments.reduce(
    (sum, est) => sum + est.bills.reduce((s, b) => s + b.totalCents, 0),
    0
  );

  const destination = href ?? `/events/${event.id}`;

  const dateRange = event.startDate
    ? event.endDate && event.endDate.getTime() !== event.startDate.getTime()
      ? `${event.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${event.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : event.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Link href={destination}>
      <Card className="hover:border-brand-300 dark:hover:border-brand-700 transition-colors cursor-pointer hover:shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">✈️ {event.name}</h3>
              {dateRange && <p className="text-xs text-zinc-500 mt-0.5">{dateRange}</p>}
            </div>
            {totalCents > 0 && (
              <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 shrink-0">
                {formatCents(totalCents)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="default">
              {event._count.establishments} stop{event._count.establishments !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
