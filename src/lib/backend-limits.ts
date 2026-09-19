import { createHash } from "node:crypto";
import { prisma } from "./db";

// SQLite performs the conditional increment atomically, across local workers/restarts.
// Public auth limits are deliberately global: untrusted forwarded headers cannot bypass them.
export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = createHash("sha256").update(key).digest("hex");
  await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "expiresAt" <= ${now}`;
  const changed = await prisma.$executeRaw`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${bucket}, 1, ${now + windowMs})
    ON CONFLICT("key") DO UPDATE SET "count" = "count" + 1 WHERE "count" < ${limit}`;
  return changed > 0;
}
