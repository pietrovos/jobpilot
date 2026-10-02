"use server";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumeAuthRateLimit } from "@/lib/backend-limits";
import { passwordSchema } from "@/lib/backend-validation";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { createPasswordResetToken, passwordResetEnabled, passwordResetLink, resetPasswordWithToken } from "@/lib/password-reset";
import { value } from "./form-data";

export async function requestPasswordReset(formData: FormData) {
  if (!passwordResetEnabled()) redirect("/login");
  const email = z.string().trim().email().toLowerCase().safeParse(value(formData, "email"));
  if (!email.success) redirect("/forgot-password?auth=reset-email-invalid");
  if (!await consumeAuthRateLimit("password-reset", email.data)) redirect("/forgot-password?auth=rate-limited");

  const user = await prisma.user.findUnique({ where: { email: email.data }, select: { id: true, name: true, isGuest: true } });
  if (user && !user.isGuest) {
    const token = await createPasswordResetToken(user.id);
    // Sending after the response keeps timing the same whether or not the account exists.
    after(() => sendMail({
      to: email.data,
      subject: "Reset your JobPilot password",
      text: [
        `Hi ${user.name},`,
        "",
        "Use this link within 30 minutes to choose a new JobPilot password:",
        passwordResetLink(token),
        "",
        "Resetting your password signs out every device. If you did not ask for this, you can ignore this email.",
      ].join("\n"),
    }).catch((error) => console.error(JSON.stringify({ event: "password-reset-mail-failed", message: String(error) }))));
  }

  redirect("/forgot-password?auth=reset-sent");
}

export async function resetPassword(formData: FormData) {
  const token = value(formData, "token");
  const password = passwordSchema.safeParse(value(formData, "password"));
  if (!password.success || value(formData, "confirmPassword") !== password.data) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&auth=reset-password-invalid`);
  }

  const passwordHash = await bcrypt.hash(password.data, 12);
  const userId = await resetPasswordWithToken(token, passwordHash);
  if (!userId) redirect("/forgot-password?auth=reset-expired");

  redirect("/login?auth=password-reset");
}
