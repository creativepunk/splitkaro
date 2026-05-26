"use client";

import { useState } from "react";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { GroupCard } from "@/components/GroupCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Tab = "events" | "groups";

interface Event {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  _count: { establishments: number };
  establishments: Array<{ bills: Array<{ totalCents: number }> }>;
}

interface Group {
  id: string;
  name: string;
  emoji: string;
  members: Array<{ user: { id: string; name?: string | null; image?: string | null } }>;
  _count: { directExpenses: number };
}

interface Props {
  events: Event[];
  groups: Group[];
  defaultTab?: Tab;
}

export function OrganizeClient({ events, groups, defaultTab = "events" }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950">
      {/* Page header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {tab === "events" ? "Events" : "Groups"}
          </h1>
          <Link href={tab === "events" ? "/events/new" : "/groups/new"}>
            <Button size="sm" variant="primary">
              + {tab === "events" ? "New event" : "New group"}
            </Button>
          </Link>
        </div>

        {/* Sub-tab toggle */}
        <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 gap-0.5">
          <button
            onClick={() => setTab("events")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              tab === "events"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            ✈️ Events
          </button>
          <button
            onClick={() => setTab("groups")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              tab === "groups"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            👥 Groups
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-8">
        {tab === "events" && (
          <>
            {events.length === 0 ? (
              <EmptyState
                icon="✈️"
                title="No events yet"
                description="Create an event for a trip, dinner, or any short-term outing."
              >
                <Link href="/events/new">
                  <Button variant="primary" size="md">Create first event</Button>
                </Link>
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={{ ...event, groupId: "" }}
                    href={`/events/${event.id}`}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "groups" && (
          <>
            {groups.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No groups yet"
                description="Create a group for roommates, a recurring crew, or anyone you split with regularly."
              >
                <Link href="/groups/new">
                  <Button variant="primary" size="md">Create first group</Button>
                </Link>
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((g) => (
                  <GroupCard key={g.id} group={g} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
