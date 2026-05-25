import { PrismaClient } from "@prisma/client";
import { ensureDevDb } from "./db-init";

// Auto-create SQLite tables on Vercel test deployments (ENABLE_DEV_LOGIN=true).
// This is synchronous but only runs once per Lambda container cold-start.
ensureDevDb();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
