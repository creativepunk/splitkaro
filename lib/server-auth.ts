"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Returns the authenticated user from the database.
 * If the JWT exists but the user row is gone (e.g. after a db reset in dev),
 * we clear the session cookies before redirecting so the sign-in page
 * doesn't immediately redirect back and create an infinite loop.
 */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  // No-DB mode: ENABLE_DEV_LOGIN=true but DATABASE_URL not set — trust JWT directly.
  if (
    process.env.ENABLE_DEV_LOGIN === "true" &&
    !process.env.DATABASE_URL &&
    process.env.NODE_ENV === "production"
  ) {
    return {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!user) {
    // Stale JWT — redirect through a Route Handler that can clear the cookie
    // before landing on sign-in. Doing it here (Server Component context)
    // would throw "Cookies can only be modified in a Server Action or Route Handler".
    redirect("/api/auth/clear-stale-session");
  }

  return user;
}
