import { Metadata } from "next";
import { getMyEvents } from "@/lib/actions/events";
import { getMyGroups } from "@/lib/actions/groups";
import { OrganizeClient } from "./OrganizeClient";

export const metadata: Metadata = { title: "Events & Groups" };

export default async function OrganizePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [events, groups] = await Promise.all([getMyEvents(), getMyGroups()]);

  return (
    <OrganizeClient
      events={events}
      groups={groups}
      defaultTab={searchParams.tab === "groups" ? "groups" : "events"}
    />
  );
}
