import assert from "node:assert/strict";
import { test } from "node:test";
import { temporaryDatabase } from "./helpers/database";

const db = temporaryDatabase();
process.env.DATABASE_URL = db.url;
// Imported after DATABASE_URL is set so the shared client opens the temporary database.
const limits = import("../src/lib/backend-limits");
const database = import("../src/lib/db");

test.after(async () => {
  await (await database).prisma.$disconnect();
  db.cleanup();
});

test("forwarded addresses are ignored unless the operator trusts a header", async () => {
  const { clientAddress } = await limits;
  const forwarded = new Headers({ "x-forwarded-for": "198.51.100.7, 203.0.113.9", "x-real-ip": "203.0.113.9" });
  assert.equal(clientAddress(forwarded, undefined), null);
  assert.equal(clientAddress(forwarded, "x-forwarded-for"), "203.0.113.9");
  assert.equal(clientAddress(forwarded, "x-real-ip"), "203.0.113.9");
  assert.equal(clientAddress(new Headers({ "x-real-ip": "not an address" }), "x-real-ip"), null);
  assert.equal(clientAddress(new Headers(), "x-real-ip"), null);
});

test("login buckets narrow by account and client and keep a global backstop", async () => {
  const { authRateLimitBuckets } = await limits;
  assert.deepEqual(authRateLimitBuckets("login", {}).buckets, [{ key: "login", limit: 100 }]);
  assert.deepEqual(authRateLimitBuckets("login", { account: " Pilot@Example.test ", client: "203.0.113.9" }).buckets, [
    { key: "login:account:pilot@example.test", limit: 10 },
    { key: "login:client:203.0.113.9", limit: 20 },
    { key: "login", limit: 1000 },
  ]);
  assert.deepEqual(authRateLimitBuckets("signup", { account: "ignored@example.test" }).buckets, [{ key: "signup", limit: 20 }]);
});

test("a limit blocks once full and resets after its window", async () => {
  const { consumeRateLimit } = await limits;
  for (let attempt = 0; attempt < 3; attempt++) assert.equal(await consumeRateLimit("fixture", 3, 60_000), true);
  assert.equal(await consumeRateLimit("fixture", 3, 60_000), false);
  assert.equal(await consumeRateLimit("other-fixture", 3, 60_000), true);
  assert.equal(await consumeRateLimit("expired-fixture", 1, -1), true);
  assert.equal(await consumeRateLimit("expired-fixture", 1, 60_000), true);
});
