import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";

const isDev = process.env.NODE_ENV === "development";

// "No DB" mode: ENABLE_DEV_LOGIN=true but DATABASE_URL not set.
// Falls back to synthetic in-memory users so the app is at least usable.
const isTestDeploy =
  process.env.ENABLE_DEV_LOGIN === "true" &&
  !process.env.DATABASE_URL &&
  process.env.NODE_ENV === "production";

// Show the email/name dev-login form whenever in local dev
// OR when ENABLE_DEV_LOGIN is explicitly set (even with a real DB).
const useDevLogin = isDev || process.env.ENABLE_DEV_LOGIN === "true";

export const authOptions: NextAuthOptions = {
  // Fall back to a built-in secret for test deployments.
  // Real production MUST set NEXTAUTH_SECRET via environment variable.
  secret:
    process.env.NEXTAUTH_SECRET ??
    (useDevLogin ? "splitkaro-dev-secret-not-for-production" : undefined),

  // Only attach PrismaAdapter when we have a real database.
  // Credentials + JWT strategy doesn't use the adapter for sessions anyway,
  // but removing it avoids accidental DB calls on test deploys.
  ...(isTestDeploy ? {} : { adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"] }),

  providers: [
    // ── Google OAuth (production) ──────────────────────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "placeholder"
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),

    // ── Dev / test-deploy login ────────────────────────────────────────────
    ...(useDevLogin
      ? [
          CredentialsProvider({
            id: "dev-login",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              name: { label: "Name", type: "text" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;
              const email = credentials.email.trim().toLowerCase();
              const name = credentials.name?.trim() || email.split("@")[0];

              if (isTestDeploy) {
                // No database on test deploys — return a synthetic user.
                // The ID is deterministic so the same email always gets the
                // same ID across requests (important for JWT consistency).
                const id = "test-" + Buffer.from(email).toString("base64url").slice(0, 16);
                return { id, email, name };
              }

              // Local dev: upsert into the local SQLite DB
              const user = await prisma.user.upsert({
                where: { email },
                update: { name },
                create: { email, name, emailVerified: new Date() },
              });
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],

  // Credentials provider requires JWT strategy
  session: { strategy: useDevLogin ? "jwt" : "database" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = (token?.id as string | undefined) ?? user?.id;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
};
