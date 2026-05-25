import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * GET /api/auth/clear-stale-session
 *
 * Clears next-auth session cookies and redirects to sign-in.
 * Used when requireUser() finds a valid JWT but no matching DB row
 * (e.g. after a local db reset). Without clearing the cookie, the
 * sign-in page would immediately redirect back to the app because the
 * JWT still looks valid, creating an infinite redirect loop.
 */
export function GET() {
  const jar = cookies();
  jar.delete("next-auth.session-token");
  jar.delete("__Secure-next-auth.session-token");
  redirect("/auth/signin");
}
