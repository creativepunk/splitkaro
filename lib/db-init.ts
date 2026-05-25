import { copyFileSync, existsSync, writeFileSync } from "fs";
import path from "path";

/**
 * Initialises the SQLite DB on Vercel test deployments (ENABLE_DEV_LOGIN=true).
 *
 * Why copy instead of `prisma db push`:
 *   `prisma db push` needs the Prisma schema engine binary, which is only
 *   available at build time — not in the serverless function bundle at runtime.
 *
 * How it works:
 *   The vercel.json buildCommand creates prisma/dev.db.template (an empty but
 *   fully-migrated SQLite file) during the build step. At runtime we just copy
 *   that file to /tmp/splitkaro.db. The copy is instant — no binaries needed.
 *
 *   A marker file in /tmp prevents re-copying on every request within the same
 *   Lambda container (containers are reused across requests until they're
 *   recycled, so data persists for the lifetime of one container).
 */
const INIT_MARKER = "/tmp/.splitkaro-db-ready";

export function ensureDevDb(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ENABLE_DEV_LOGIN !== "true") return;
  if (existsSync(INIT_MARKER)) return;

  const dbPath = (process.env.DATABASE_URL ?? "file:/tmp/splitkaro.db")
    .replace(/^file:/, "");

  const template = path.join(process.cwd(), "prisma", "dev.db.template");

  if (!existsSync(template)) {
    console.error(
      "[test-deploy] DB template missing at",
      template,
      "— was the buildCommand in vercel.json run?"
    );
    return;
  }

  try {
    copyFileSync(template, dbPath);
    writeFileSync(INIT_MARKER, new Date().toISOString());
    console.log("[test-deploy] SQLite DB copied to", dbPath);
  } catch (err) {
    console.error("[test-deploy] Failed to copy DB template:", (err as Error).message);
  }
}
