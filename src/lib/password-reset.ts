import { randomBytes } from "node:crypto";
import { hashToken } from "./auth";
import { prisma } from "./db";
import { mailConfigured } from "./mailer";

const RESET_TOKEN_MINUTES = 30;

// Reset links must not be built from the request Host header, which a client
// controls. Production requires APP_URL; development falls back to localhost.
export function appOrigin() {
  const configured = process.env.APP_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function passwordResetEnabled() {
  return mailConfigured() && appOrigin() !== null;
}

export function isPasswordResetToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

// Only the hash is stored, and a new request replaces any earlier link.
export async function createPasswordResetToken(userId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ userId }, { expiresAt: { lte: now } }] } }),
    prisma.passwordResetToken.create({ data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + RESET_TOKEN_MINUTES * 60 * 1000),
    } }),
  ]);
  return token;
}

export async function findPasswordResetUser(token: string, now = new Date()) {
  if (!isPasswordResetToken(token)) return null;
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { userId: true, expiresAt: true } });
  return reset && reset.expiresAt > now ? reset.userId : null;
}

// Spends the token, sets the password and signs out every existing session in
// one transaction. Returns the user id, or null for an unknown or expired token.
export async function resetPasswordWithToken(token: string, passwordHash: string, now = new Date()) {
  if (!isPasswordResetToken(token)) return null;
  return prisma.$transaction(async (tx) => {
    const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { userId: true, expiresAt: true } });
    if (!reset || reset.expiresAt <= now) return null;
    await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId } });
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: reset.userId } });
    return reset.userId;
  });
}

export function passwordResetLink(token: string) {
  return `${appOrigin()}/reset-password?token=${token}`;
}
