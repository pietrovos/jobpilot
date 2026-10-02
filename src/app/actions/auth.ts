"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import path from "path";
import { createGuestSession, createSession, destroySession, getCurrentUser, isGuestUser, requireUser } from "@/lib/auth";
import { removeStoredFile } from "@/lib/application-storage";
import { consumeAuthRateLimit, consumeRateLimit } from "@/lib/backend-limits";
import { prisma } from "@/lib/db";
import { transferGuestOwnership } from "@/lib/guest-transfer";
import { adoptGuestWorkspace } from "@/lib/oauth-session";
import { profileUploadsRoot } from "@/lib/upload-roots";
import { verifiedImage } from "@/lib/verified-upload";
import { authSchema, value } from "./form-data";

// Compared against for unknown or passwordless accounts to keep timing uniform.
const DUMMY_PASSWORD_HASH = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
const MAX_PROFILE_IMAGE_BYTES = 3 * 1024 * 1024;
const MIN_PROFILE_IMAGE_DIMENSION = 64;

export async function signUp(formData: FormData) {
  if (!await consumeAuthRateLimit("signup")) redirect("/signup?auth=rate-limited");
  const guestUser = await getCurrentUser();
  const parsed = authSchema.safeParse({
    name: value(formData, "name"),
    email: value(formData, "email"),
    password: value(formData, "password"),
  });

  if (!parsed.success || !parsed.data.name) {
    redirect("/signup?auth=signup-invalid");
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (existing) {
    redirect("/signup?auth=email-taken");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: {
      name: parsed.data.name!, email: parsed.data.email, passwordHash,
    } });
    if (isGuestUser(guestUser)) await transferGuestOwnership(tx, guestUser.id, created.id);
    return created;
  });

  await createSession(user.id);
  redirect("/");
}

export async function signIn(formData: FormData) {
  if (!await consumeAuthRateLimit("login", value(formData, "email"))) redirect("/login?auth=rate-limited");
  const guestUser = await getCurrentUser();
  const parsed = authSchema.omit({ name: true }).safeParse({
    email: value(formData, "email"),
    password: value(formData, "password"),
  });

  if (!parsed.success) {
    redirect("/login?auth=invalid-credentials");
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // OAuth-only accounts have no password hash: compare against a dummy hash so
  // the response time does not reveal whether the account can use a password.
  const usableHash = user && !user.isGuest && user.passwordHash ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const validPassword = await bcrypt.compare(parsed.data.password, usableHash);

  if (!user || user.isGuest || !user.passwordHash || !validPassword) {
    redirect("/login?auth=invalid-credentials");
  }

  if (isGuestUser(guestUser) && guestUser.id !== user.id) {
    await adoptGuestWorkspace(guestUser.id, user.id);
  }

  await createSession(user.id);
  redirect("/");
}

export async function continueAsGuest() {
  if (await getCurrentUser()) redirect("/");
  if (!await consumeAuthRateLimit("guest")) redirect("/login?auth=rate-limited");
  await createGuestSession();
  redirect("/");
}

export async function signOut() {
  const user = await getCurrentUser();
  await destroySession();

  if (isGuestUser(user)) {
    await prisma.user.delete({ where: { id: user.id } });
  }

  redirect("/");
}

export async function uploadProfilePicture(formData: FormData) {
  const user = await requireUser();
  if (!await consumeRateLimit(`upload:${user.id}`, 30, 60 * 60 * 1000)) redirect("/?file=rate-limited");
  const file = formData.get("profilePicture");
  const returnTo = safeReturnPath(value(formData, "returnTo"));

  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PROFILE_IMAGE_BYTES) {
    redirect(`${returnTo}?profile=invalid`);
  }

  const profileImage = await verifiedImage(Buffer.from(await file.arrayBuffer()), MIN_PROFILE_IMAGE_DIMENSION).catch(() => null);

  if (!profileImage) {
    redirect(`${returnTo}?profile=invalid`);
  }

  const extension = profileImage.extension;
  const storedFileName = `${randomUUID()}${extension}`;
  const relativePath = `${user.id}/${storedFileName}`;
  const absoluteDirectory = path.join(profileUploadsRoot, user.id);
  const absolutePath = path.join(profileUploadsRoot, relativePath);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, profileImage.buffer);

  const previousPath = user.profileImagePath;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      profileImagePath: relativePath,
      profileImageType: profileImage.mimeType,
    },
  }).catch(async (error) => {
    await removeStoredFile(relativePath, profileUploadsRoot);
    throw error;
  });

  if (previousPath) {
    await removeStoredFile(previousPath, profileUploadsRoot);
  }

  revalidatePath("/");
  revalidatePath("/documents");
  return { success: true, message: "Profile picture updated." };
}

function safeReturnPath(returnTo: string) {
  if (returnTo === "/documents") return returnTo;
  return "/";
}
