import { PrismaClient } from "@prisma/client";
import { ensureDevDb } from "./db-init";

// Auto-create SQLite tables on Vercel test deployments (ENABLE_DEV_LOGIN=true).
// This is synchronous but only runs once per Lambda container cold-start.
ensureDevDb();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Cache the client on globalThis in ALL environments so that:
//  - Dev: the same instance survives Next.js hot-module replacement
//  - Production: the same instance is reused across requests in a warm Lambda
//    (avoiding the overhead of re-connecting on every request)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
