import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar initialUser={session.user ? { name: session.user.name ?? null, image: session.user.image ?? null } : null} />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
    </div>
  );
}
