import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BillWizardClient } from "./BillWizardClient";

export const metadata: Metadata = { title: "Add Bill" };

export default async function NewBillPage({ params }: { params: { eventId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const event = await prisma.event.findFirst({
    where: {
      id: params.eventId,
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!event) redirect("/dashboard");

  const participants = event.participants.map((p) => ({
    id: p.user.id,
    name: p.user.name ?? "Unknown",
    image: p.user.image,
  }));

  return <BillWizardClient eventId={params.eventId} participants={participants} />;
}
