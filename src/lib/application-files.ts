import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { privateFileHeaders, privateFileResponse } from "@/lib/private-file";

const applicationUploadsRoot = path.join(process.cwd(), "uploads", "application-files");
const documentUploadsRoot = path.join(process.cwd(), "uploads", "documents");

export async function getOwnedFileResponse(fileId: string, disposition: "attachment" | "inline", range?: string | null) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: privateFileHeaders });
  }

  const file = await prisma.applicationFile.findFirst({
    where: {
      id: fileId,
      userId: user.id,
      application: { userId: user.id, deletedAt: null },
      OR: [
        { userDocumentId: null },
        { userDocument: { userId: user.id } },
      ],
    },
  });

  if (!file) {
    return new Response("Not found", { status: 404, headers: privateFileHeaders });
  }

  return privateFileResponse(file.userDocumentId ? documentUploadsRoot : applicationUploadsRoot, file.storagePath, file.fileName, disposition, range);
}

export async function getOwnedDocumentResponse(documentId: string, disposition: "attachment" | "inline", range?: string | null) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401, headers: privateFileHeaders });
  }

  const document = await prisma.userDocument.findFirst({
    where: { id: documentId, userId: user.id },
  });

  if (!document) {
    return new Response("Not found", { status: 404, headers: privateFileHeaders });
  }

  return privateFileResponse(documentUploadsRoot, document.storagePath, document.fileName, disposition, range);
}
