import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OAUTH_PROVIDERS,
  callbackUri,
  decodeStateCookie,
  encodeStateCookie,
  enabledProviders,
  isOAuthProvider,
  oauthErrorMessage,
  pkceChallenge,
  providerConfig,
  statesMatch,
  type OAuthState,
} from "../src/lib/oauth";
import { resolveOAuthUser } from "../src/lib/oauth-accounts";
import { temporaryDatabase } from "./helpers/database";

const state: OAuthState = { provider: "google", state: "s".repeat(43), verifier: "v".repeat(64), next: "/documents", link: false };

test("provider allowlist rejects unknown or misspelled providers", () => {
  for (const name of ["google", "github", "linkedin"]) assert.equal(isOAuthProvider(name), true, name);
  for (const name of ["", "googl", "Google", "github ", "wechat", "google/../evil"]) assert.equal(isOAuthProvider(name), false, name);
});

test("state cookies round-trip and reject tampered or undersized payloads", () => {
  const restored = decodeStateCookie(encodeStateCookie(state));
  assert.deepEqual(restored, state);
  assert.equal(decodeStateCookie(undefined), null);
  assert.equal(decodeStateCookie("not-base64!"), null);
  assert.equal(decodeStateCookie(Buffer.from("{}").toString("base64url")), null);
  assert.equal(decodeStateCookie(Buffer.from(JSON.stringify({ ...state, provider: "evil" })).toString("base64url")), null);
  assert.equal(decodeStateCookie(Buffer.from(JSON.stringify({ ...state, state: "short" })).toString("base64url")), null);
  assert.equal(decodeStateCookie(Buffer.from(JSON.stringify({ ...state, verifier: "short" })).toString("base64url")), null);
});

test("state comparison is constant-time-shaped and rejects absent or wrong values", () => {
  assert.equal(statesMatch(state.state, state.state), true);
  assert.equal(statesMatch(state.state, state.state.slice(0, -1) + "x"), false);
  assert.equal(statesMatch(state.state, null), false);
  assert.equal(statesMatch(state.state, state.state + "a"), false);
});

test("PKCE challenge is deterministic base64url and varies with the verifier", () => {
  const first = pkceChallenge("verifier-one");
  assert.equal(first, pkceChallenge("verifier-one"));
  assert.notEqual(first, pkceChallenge("verifier-two"));
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
});

test("callback URIs are provider-scoped and origins are normalized", () => {
  assert.equal(callbackUri("https://jobs.example", "github"), "https://jobs.example/api/auth/oauth/github/callback");
  assert.equal(callbackUri("https://jobs.example/", "linkedin"), "https://jobs.example/api/auth/oauth/linkedin/callback");
});

test("credentials gate the provider list and never leak partial config", () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    for (const provider of OAUTH_PROVIDERS) {
      delete process.env[`${provider.toUpperCase()}_CLIENT_ID`];
      delete process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
    }
    assert.deepEqual(enabledProviders(), []);
    assert.equal(providerConfig("google"), null);

    process.env.GOOGLE_CLIENT_ID = "id";
    assert.equal(providerConfig("google"), null, "a client id without a secret must not enable the provider");

    process.env.GOOGLE_CLIENT_SECRET = "secret";
    assert.deepEqual(enabledProviders(), ["google"]);
    assert.equal(providerConfig("google")?.authorizeUrl, "https://accounts.google.com/o/oauth2/v2/auth");
  } finally {
    process.env = saved;
  }
});

test("development lists every provider so the buttons stay visible", () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "development" });
    for (const provider of OAUTH_PROVIDERS) {
      delete process.env[`${provider.toUpperCase()}_CLIENT_ID`];
      delete process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
    }
    assert.deepEqual(enabledProviders(), [...OAUTH_PROVIDERS]);
    // Configuration still reports nothing, so the start route can explain why.
    assert.equal(providerConfig("google"), null);
  } finally {
    process.env = saved;
  }
});

test("error messages cover every callback reason with a stable fallback", () => {
  assert.equal(oauthErrorMessage(undefined), undefined);
  assert.match(oauthErrorMessage("denied")!, /cancelled/i);
  assert.match(oauthErrorMessage("state")!, /expired/i);
  assert.match(oauthErrorMessage("no-email")!, /email/i);
  assert.match(oauthErrorMessage("email-taken")!, /password/i);
  assert.match(oauthErrorMessage("link-taken")!, /another account/i);
  assert.equal(oauthErrorMessage("some-new-code"), oauthErrorMessage("failed"));
});

test("unverified-email providers cannot link onto an existing account", async () => {
  const db = temporaryDatabase();
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  try {
    await prisma.user.create({ data: { name: "Owner", email: "owner@example.test", passwordHash: "hash" } });

    // LinkedIn carries an email but no email_verified claim, so it must not
    // silently attach itself to the account that already owns that address.
    const linkedIn = await resolveOAuthUser("linkedin", { providerAccountId: "li-1", email: "owner@example.test", name: "Owner" }, prisma);
    assert.equal(linkedIn.ok, true);
    if (linkedIn.ok) {
      const created = await prisma.user.findUniqueOrThrow({ where: { id: linkedIn.userId } });
      assert.notEqual(created.email, "owner@example.test");
      assert.equal(created.passwordHash, null);
      assert.deepEqual(await resolveOAuthUser("linkedin", { providerAccountId: "li-1", email: "owner@example.test", name: "Owner" }, prisma), linkedIn);
    }

    // Google asserts verification, so a matching address still refuses to
    // auto-link and instead tells the user to connect it while signed in.
    const google = await resolveOAuthUser("google", { providerAccountId: "g-1", email: "owner@example.test", name: "Owner" }, prisma);
    assert.deepEqual(google, { ok: false, reason: "email-taken" });

    // A brand-new verified address provisions an account with no password.
    const fresh = await resolveOAuthUser("google", { providerAccountId: "g-2", email: "new@example.test", name: "New" }, prisma);
    assert.equal(fresh.ok, true);
    if (fresh.ok) {
      const created = await prisma.user.findUniqueOrThrow({ where: { id: fresh.userId } });
      assert.equal(created.passwordHash, null);
    }
  } finally {
    await prisma.$disconnect();
    db.cleanup();
  }
});

test("oauth identity maps to its own user even without a shared email", async () => {
  const db = temporaryDatabase();
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  try {
    const user = await prisma.user.create({
      data: {
        name: "Linked Account",
        email: "placeholder@oauth.jobpilot.local",
        passwordHash: null,
        oauthAccounts: { create: { provider: "github", providerAccountId: "42", email: null } },
      },
    });

    const resolved = await resolveOAuthUser("github", { providerAccountId: "42", email: null, name: "Linked Account" }, prisma);
    assert.deepEqual(resolved, { ok: true, userId: user.id });
  } finally {
    await prisma.$disconnect();
    db.cleanup();
  }
});
