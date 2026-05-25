import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DirectExpenseClient } from "./DirectExpenseClient";

export const metadata: Metadata = { title: "Quick Expense" };

export default async function NewDirectExpensePage({
  params,
}: {
  params: { groupId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const group = await prisma.group.findFirst({
    where: {
      id: params.groupId,
      members: { some: { userId: session.user.id } },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!group) redirect("/dashboard");

  return (
    <DirectExpenseClient
      groupId={params.groupId}
      currentUserId={session.user.id}
      members={group.members.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? "Unknown",
        image: m.user.image,
      }))}
    />
  );
}
