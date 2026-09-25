import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "./db";
import { OAUTH_PROVIDER_INFO, type OAuthProfile, type OAuthProvider } from "./oauth";

export type OAuthResolution =
  | { ok: true; userId: string }
  | { ok: false; reason: "no-email" | "email-taken" | "link-taken" };

// Links a provider identity onto whichever account is currently signed in.
export async function linkOAuthAccount(userId: string, provider: OAuthProvider, profile: OAuthProfile): Promise<OAuthResolution> {
  const identity = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
  });
  if (identity) {
    return identity.userId === userId ? { ok: true, userId } : { ok: false, reason: "link-taken" };
  }

  try {
    await prisma.oAuthAccount.create({
      data: { userId, provider, providerAccountId: profile.providerAccountId, email: profile.email },
    });
  } catch (error) {
    // A concurrent request may have created the same identity first.
    if (isUniqueViolation(error)) {
      const existing = await prisma.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
        select: { userId: true },
      });
      return existing?.userId === userId ? { ok: true, userId } : { ok: false, reason: "link-taken" };
    }
    throw error;
  }

  return { ok: true, userId };
}

export async function resolveOAuthUser(
  provider: OAuthProvider,
  profile: OAuthProfile,
  client: PrismaClient = prisma,
): Promise<OAuthResolution> {
  const identity = await client.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
    select: { user: { select: { isGuest: true } }, userId: true },
  });

  if (identity && !identity.user.isGuest) {
    return { ok: true, userId: identity.userId };
  }

  const trustedEmail = OAUTH_PROVIDER_INFO[provider].trustedEmail;
  if (!trustedEmail) {
    // Never match an unverified address to an existing user. The provider's
    // stable identity gets a separate account with a local placeholder email.
    const userId = await client.$transaction(async (tx) => createOAuthUser(tx, provider, profile, false));
    return { ok: true, userId };
  }

  if (!profile.email) {
    return { ok: false, reason: "no-email" };
  }

  const existingUser = await client.user.findUnique({ where: { email: profile.email }, select: { id: true, isGuest: true } });
  if (existingUser) {
    // An established account keeps its password; the provider must be linked first.
    return existingUser.isGuest ? { ok: false, reason: "link-taken" } : { ok: false, reason: "email-taken" };
  }

  const userId = await client.$transaction(async (tx) => createOAuthUser(tx, provider, profile, trustedEmail));
  return { ok: true, userId };
}

// LinkedIn has no trusted email, so the created account records a placeholder
// address that the user is expected to replace from Account settings.
export async function createOAuthUser(
  tx: Prisma.TransactionClient,
  provider: OAuthProvider,
  profile: OAuthProfile,
  trustedEmail: boolean,
) {
  const user = await tx.user.create({
    data: {
      name: profile.name,
      email: trustedEmail && profile.email ? profile.email : oauthPlaceholderEmail(provider, profile.providerAccountId),
      passwordHash: null,
      oauthAccounts: {
        create: { provider, providerAccountId: profile.providerAccountId, email: profile.email },
      },
    },
    select: { id: true },
  });
  return user.id;
}

function oauthPlaceholderEmail(provider: OAuthProvider, providerAccountId: string) {
  const id = createHash("sha256").update(providerAccountId).digest("hex");
  return `${provider}-${id}@oauth.jobpilot.local`;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
