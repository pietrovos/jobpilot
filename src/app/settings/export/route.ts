import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/backend-limits";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers });
  if (!await consumeRateLimit(`export:${user.id}`, 5, 60 * 60 * 1000)) return new Response("Try again later", { status: 429, headers });
  const data = await prisma.$transaction(async (tx) => ({
    version: 1,
    account: { name: user.name, email: user.email, createdAt: user.createdAt },
    applications: await tx.application.findMany({ where: { userId: user.id }, include: {
      noteEntries: { where: { userId: user.id } }, noteFolders: { where: { userId: user.id } }, emailLogs: { where: { userId: user.id } }, interviews: { where: { userId: user.id } }, offerDetails: { where: { userId: user.id } }, statusChanges: true,
      files: { select: { id: true, fileName: true, fileSize: true, fileType: true, createdAt: true } },
    } }),
    documents: await tx.userDocument.findMany({ where: { userId: user.id }, select: { id: true, fileName: true, fileSize: true, fileType: true, createdAt: true } }),
    legacyDeletedApplications: await tx.deletedApplication.findMany({ where: { userId: user.id } }),
  }));
  return Response.json(data, { headers: { ...headers, "Content-Disposition": 'attachment; filename="jobpilot-export.json"' } });
}
