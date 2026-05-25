import { execSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import path from "path";

/**
 * Auto-initialises the SQLite schema when running on Vercel in test mode
 * (ENABLE_DEV_LOGIN=true + DATABASE_URL=file:/tmp/...).
 *
 * Vercel's Lambda /tmp is writable but ephemeral — each cold start gets a
 * fresh container with an empty /tmp. This runs `prisma db push` once per
 * container lifetime so every cold start has the right tables.
 *
 * No-op in local dev (devs manage their own DB) and in real production
 * (uses PostgreSQL which is already migrated).
 */
const INIT_MARKER = "/tmp/.splitkaro-db-ready";

export function ensureDevDb(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ENABLE_DEV_LOGIN !== "true") return;
  if (existsSync(INIT_MARKER)) return; // already initialised in this container

  try {
    const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
    execSync(`${prismaBin} db push --accept-data-loss --skip-generate`, {
      env: { ...process.env },
      stdio: "pipe",
      timeout: 30_000,
      cwd: process.cwd(),
    });
    writeFileSync(INIT_MARKER, new Date().toISOString());
    console.log("[test-deploy] SQLite schema ready at", process.env.DATABASE_URL);
  } catch (err) {
    console.error("[test-deploy] DB init failed:", (err as Error).message);
    // Don't throw — queries will fail with helpful errors rather than crashing at import
  }
}
