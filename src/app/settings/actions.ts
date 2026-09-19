"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/backend-limits";
import { passwordSchema } from "@/lib/backend-validation";
import { prisma } from "@/lib/db";

async function confirmPassword(formData: FormData) {
  const user = await requireUser();
  if (user.isGuest) redirect("/signup");
  if (!await consumeRateLimit(`account:${user.id}`, 10, 15 * 60 * 1000)) redirect("/settings?message=limited");
  const password = formData.get("currentPassword");
  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (typeof password !== "string" || Buffer.byteLength(password) > 72 || !await bcrypt.compare(password, account.passwordHash)) redirect("/settings?message=invalid");
  return user;
}

export async function changePassword(formData: FormData) {
  const user = await confirmPassword(formData);
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
