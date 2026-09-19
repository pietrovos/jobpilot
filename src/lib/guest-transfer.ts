import type { Prisma } from "@/generated/prisma/client";

// Caller supplies a transaction so signup can include account creation atomically.
export async function transferGuestOwnership(tx: Prisma.TransactionClient, guestId: string, userId: string) {
  if (guestId === userId) return null;
  const guest = await tx.user.findUnique({ where: { id: guestId } });
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!guest?.isGuest || !user || user.isGuest) throw new Error("Invalid guest transfer");
  const where = { userId: guestId };
  const data = { userId };
  await tx.userDocument.updateMany({ where, data });
  await tx.application.updateMany({ where, data });
  await tx.deletedApplication.updateMany({ where, data });
  if (guest.profileImagePath && !user.profileImagePath) {
    await tx.user.update({ where: { id: userId }, data: {
      profileImagePath: guest.profileImagePath, profileImageType: guest.profileImageType,
    } });
  }
  await tx.user.delete({ where: { id: guestId } });
  return user.profileImagePath ? guest.profileImagePath : null;
}
