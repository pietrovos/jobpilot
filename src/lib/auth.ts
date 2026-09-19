import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

const SESSION_COOKIE = "jobpilot_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, options: { browserSessionOnly?: boolean } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (options.browserSessionOnly ? 1 : SESSION_DAYS) * 24 * 60 * 60 * 1000);

  const cookieStore = await cookies();
  const previous = cookieStore.get(SESSION_COOKIE)?.value;
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { OR: [
      { expiresAt: { lte: new Date() } },
      ...(previous ? [{ tokenHash: hashToken(previous) }] : []),
    ] } });
    const sessions = await tx.session.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: 9, select: { id: true } });
    await tx.session.deleteMany({ where: { id: { in: sessions.map((session) => session.id) } } });
    await tx.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
    });
  });

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(options.browserSessionOnly ? {} : { expires: expiresAt }),
    path: "/",
  });
}

export async function createGuestSession() {
  const user = await prisma.user.create({
    data: {
      name: "Guest Pilot",
      email: `guest-${randomBytes(16).toString("hex")}@jobpilot.local`,
      passwordHash: randomBytes(32).toString("hex"),
      isGuest: true,
    },
  });

  await createSession(user.id, { browserSessionOnly: true });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, isGuest: true, profileImagePath: true, profileImageType: true, createdAt: true } } },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?auth=required");
  }

  return user;
}

export function isGuestUser(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): user is NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> & { isGuest: true } {
  return Boolean(user?.isGuest);
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}
