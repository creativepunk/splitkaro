import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";

const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.ENABLE_DEV_LOGIN === "true";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
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

    // ── Dev bypass (local only) ────────────────────────────────────────────
    // Lets any email/name log in instantly without Google OAuth.
    // Automatically excluded in production by the session strategy check below.
    ...(isDev
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

              // Upsert: find or create the user in the local SQLite DB
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

  // Credentials provider requires JWT strategy (can't use DB sessions with credentials)
  session: { strategy: isDev ? "jwt" : "database" },

  callbacks: {
    // For JWT strategy (dev): embed user ID directly in the token
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    // Expose user.id on the session object in both strategies
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
