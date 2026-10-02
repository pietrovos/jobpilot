import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./db";

// SQLite performs the conditional increment atomically, across local workers/restarts.
export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = createHash("sha256").update(key).digest("hex");
  await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "expiresAt" <= ${now}`;
  const changed = await prisma.$executeRaw`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${bucket}, 1, ${now + windowMs})
    ON CONFLICT("key") DO UPDATE SET "count" = "count" + 1 WHERE "count" < ${limit}`;
  return changed > 0;
}

type AuthLimit = { global: number; perClient: number; perAccount?: number; windowMs: number };

const minute = 60 * 1000;

export const authLimits = {
  login: { global: 100, perClient: 20, perAccount: 10, windowMs: 15 * minute },
  signup: { global: 20, perClient: 5, windowMs: 60 * minute },
  guest: { global: 30, perClient: 5, windowMs: 60 * minute },
  "password-reset": { global: 30, perClient: 5, perAccount: 3, windowMs: 60 * minute },
} satisfies Record<string, AuthLimit>;

export type AuthAction = keyof typeof authLimits;

// Without a trusted proxy every client looks the same, so the per-action bucket is
// global. With one, clients get their own bucket and the global one becomes a
// higher backstop, so a single client cannot lock everyone else out.
const trustedClientBackstop = 10;

export function authRateLimitBuckets(
  action: AuthAction,
  { account, client }: { account?: string; client?: string | null },
) {
  const limit: AuthLimit = authLimits[action];
  const buckets: { key: string; limit: number }[] = [];
  if (account && limit.perAccount) {
    buckets.push({ key: `${action}:account:${account.trim().toLowerCase()}`, limit: limit.perAccount });
  }
  if (client) {
    buckets.push({ key: `${action}:client:${client}`, limit: limit.perClient });
    buckets.push({ key: action, limit: limit.global * trustedClientBackstop });
  } else {
    buckets.push({ key: action, limit: limit.global });
  }
  return { buckets, windowMs: limit.windowMs };
}

// Forwarded headers are only trusted when the operator names the header their own
// reverse proxy sets. The rightmost entry is the one that proxy appended.
export function clientAddress(requestHeaders: Pick<Headers, "get">, trustedHeader = process.env.TRUSTED_PROXY_IP_HEADER) {
  if (!trustedHeader) return null;
  const entries = requestHeaders.get(trustedHeader)?.split(",").map((entry) => entry.trim()).filter(Boolean);
  const address = entries?.at(-1);
  return address && address.length <= 64 && /^[0-9a-fA-F:.]+$/.test(address) ? address : null;
}

// Checks the narrowest bucket first so a blocked account or client does not also
// spend the shared allowance.
export async function consumeAuthRateLimit(action: AuthAction, account?: string) {
  const { buckets, windowMs } = authRateLimitBuckets(action, { account, client: clientAddress(await headers()) });
  for (const bucket of buckets) {
    if (!await consumeRateLimit(bucket.key, bucket.limit, windowMs)) return false;
  }
  return true;
}
