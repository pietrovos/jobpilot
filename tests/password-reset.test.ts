import assert from "node:assert/strict";
import { test } from "node:test";
import { temporaryDatabase } from "./helpers/database";

const db = temporaryDatabase();
process.env.DATABASE_URL = db.url;
// Imported after DATABASE_URL is set so the shared client opens the temporary database.
const reset = import("../src/lib/password-reset");
const database = import("../src/lib/db");

test.after(async () => {
  await (await database).prisma.$disconnect();
  db.cleanup();
});

test("a reset token is single use, replaces older links and signs out every session", async () => {
  const { createPasswordResetToken, findPasswordResetUser, resetPasswordWithToken } = await reset;
  const { prisma } = await database;
  const user = await prisma.user.create({ data: { name: "Reset Pilot", email: "reset@example.test", passwordHash: "old-hash" } });
  await prisma.session.create({ data: { userId: user.id, tokenHash: "session-a", expiresAt: new Date("2030-01-01") } });
  await prisma.session.create({ data: { userId: user.id, tokenHash: "session-b", expiresAt: new Date("2030-01-01") } });

  const first = await createPasswordResetToken(user.id);
  const second = await createPasswordResetToken(user.id);
  assert.equal(await findPasswordResetUser(first), null);
  assert.equal(await findPasswordResetUser(second), user.id);
  assert.equal(await prisma.passwordResetToken.count({ where: { tokenHash: second } }), 0, "only the hash is stored");

  assert.equal(await resetPasswordWithToken(second, "new-hash"), user.id);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, "new-hash");
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
  assert.equal(await resetPasswordWithToken(second, "replayed-hash"), null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, "new-hash");
});

test("expired, malformed and deleted-account tokens are rejected", async () => {
  const { createPasswordResetToken, findPasswordResetUser, resetPasswordWithToken } = await reset;
  const { prisma } = await database;
  const user = await prisma.user.create({ data: { name: "Expired Pilot", email: "expired@example.test", passwordHash: "old-hash" } });
  const issuedAt = new Date("2026-01-01T12:00:00Z");
  const token = await createPasswordResetToken(user.id, issuedAt);

  assert.equal(await findPasswordResetUser(token, new Date("2026-01-01T12:29:00Z")), user.id);
  assert.equal(await resetPasswordWithToken(token, "late-hash", new Date("2026-01-01T12:31:00Z")), null);
  assert.equal(await resetPasswordWithToken("not-a-token", "bad-hash"), null);

  const fresh = await createPasswordResetToken(user.id);
  await prisma.user.delete({ where: { id: user.id } });
  assert.equal(await findPasswordResetUser(fresh), null);
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: user.id } }), 0);
});
