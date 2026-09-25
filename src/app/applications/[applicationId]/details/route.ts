import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const user = await getCurrentUser();
  const { applicationId } = await params;
  if (!user) return new Response("Not found", { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id, deletedAt: null },
    include: {
      statusChanges: { orderBy: { changedAt: "desc" } },
      files: { where: { userId: user.id }, orderBy: { createdAt: "desc" } },
      emailLogs: { where: { userId: user.id }, orderBy: { sentAt: "desc" } },
      noteEntries: { where: { userId: user.id }, orderBy: { createdAt: "desc" } },
      noteFolders: { where: { userId: user.id }, orderBy: [{ name: "asc" }, { createdAt: "asc" }] },
      interviews: { where: { userId: user.id }, orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }] },
      offerDetails: { where: { userId: user.id } },
    },
  });
  if (!application) return new Response("Not found", { status: 404 });

  return Response.json({
    ...application,
    appliedAt: (application.appliedAt ?? application.createdAt).toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    statusChanges: application.statusChanges.map((change) => ({ ...change, changedAt: change.changedAt.toISOString() })),
    files: application.files.map((file) => ({
      id: file.id,
      userDocumentId: file.userDocumentId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      createdAt: file.createdAt.toISOString(),
    })),
    emailLogs: application.emailLogs.map((email) => ({ ...email, direction: email.direction === "SENT" ? "SENT" as const : "RECEIVED" as const, sentAt: email.sentAt.toISOString() })),
    noteEntries: application.noteEntries.map((note) => ({ ...note, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() })),
    noteFolders: application.noteFolders.map((folder) => ({ ...folder, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString() })),
    interviews: application.interviews.map((interview) => ({ ...interview, scheduledAt: interview.scheduledAt?.toISOString() ?? null })),
    offerDetails: application.offerDetails
      ? {
          compensation: application.offerDetails.compensation,
          startDate: application.offerDetails.startDate,
          deadline: application.offerDetails.deadline,
          benefits: application.offerDetails.benefits,
          equity: application.offerDetails.equity,
          negotiables: application.offerDetails.negotiables,
          notes: application.offerDetails.notes,
        }
      : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
