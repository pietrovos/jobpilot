import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { transferGuestOwnership } from "./guest-transfer";

const profileUploadsRoot = path.join(process.cwd(), "uploads", "profile-pictures");

// Moves a guest workspace into a real account and removes the guest's now
// unreferenced profile picture, mirroring the password signup flow.
export async function adoptGuestWorkspace(guestUserId: string, realUserId: string) {
  const unusedProfile = await prisma.$transaction((tx) => transferGuestOwnership(tx, guestUserId, realUserId));
  if (!unusedProfile) return;

  const absolutePath = path.resolve(profileUploadsRoot, unusedProfile);
  if (absolutePath.startsWith(path.resolve(profileUploadsRoot) + path.sep)) {
    await unlink(absolutePath).catch(() => undefined);
  }
}
