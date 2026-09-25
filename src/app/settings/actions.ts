"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/backend-limits";
import { passwordSchema } from "@/lib/backend-validation";
import { prisma } from "@/lib/db";
import { isOAuthProvider } from "@/lib/oauth";

async function confirmPassword(formData: FormData) {
  const user = await requireUser();
  if (user.isGuest) redirect("/signup");
  if (!await consumeRateLimit(`account:${user.id}`, 10, 15 * 60 * 1000)) redirect("/settings?message=limited");
  const password = formData.get("currentPassword");
  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (account.passwordHash === null) redirect("/settings?message=passwordless");
  if (typeof password !== "string" || Buffer.byteLength(password) > 72 || !await bcrypt.compare(password, account.passwordHash)) redirect("/settings?message=invalid");
  return user;
}

// OAuth-only accounts set their first password here instead of confirming one.
async function confirmAccount(formData: FormData) {
  const user = await requireUser();
  if (user.isGuest) redirect("/signup");
  if (!await consumeRateLimit(`account:${user.id}`, 10, 15 * 60 * 1000)) redirect("/settings?message=limited");
  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (account.passwordHash === null) return { user, changingPassword: true };
  const password = formData.get("currentPassword");
  if (typeof password !== "string" || Buffer.byteLength(password) > 72 || !await bcrypt.compare(password, account.passwordHash)) redirect("/settings?message=invalid");
  return { user, changingPassword: false };
}

export async function changePassword(formData: FormData) {
  const { user } = await confirmAccount(formData);
  const parsed = passwordSchema.safeParse(formData.get("newPassword"));
  if (!parsed.success || formData.get("confirmPassword") !== parsed.data) redirect("/settings?message=password");
  const passwordHash = await bcrypt.hash(parsed.data, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await createSession(user.id);
  redirect("/settings?message=changed");
}

export async function revokeOtherSessions(formData: FormData) {
  const user = await confirmPassword(formData);
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  redirect("/settings?message=revoked");
}

export async function deleteAccount(formData: FormData) {
  const user = await confirmPassword(formData);
  if (formData.get("confirmation") !== "DELETE") redirect("/settings?message=confirmation");
  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/login");
}

export async function disconnectProvider(formData: FormData) {
  const user = await requireUser();
  if (user.isGuest) redirect("/signup");
  const provider = formData.get("provider");
  if (typeof provider !== "string" || !isOAuthProvider(provider)) redirect("/settings?message=provider");

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true, oauthAccounts: { select: { id: true, provider: true } } },
  });

  // Removing the last sign-in method would lock the account out.
  if (account.passwordHash === null && account.oauthAccounts.length <= 1) {
    redirect("/settings?message=last-method");
  }

  await prisma.oAuthAccount.deleteMany({ where: { userId: user.id, provider } });
  redirect("/settings?message=disconnected");
}
