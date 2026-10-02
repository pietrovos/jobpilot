"use server";

import { randomUUID } from "crypto";
import { copyFile, mkdir } from "fs/promises";
import { revalidatePath } from "next/cache";
import path from "path";
import { removeStoredFile, removeStoredFiles, sanitizeFileName, saveApplicationFiles, saveUserDocuments, selectedDocumentIds, uploadedFiles, validateUploadedFiles } from "@/lib/application-storage";
import { requireUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/backend-limits";
import { prisma } from "@/lib/db";
import { applicationUploadsRoot as uploadsRoot, documentUploadsRoot } from "@/lib/upload-roots";

export async function uploadApplicationFile(applicationId: string, formData: FormData) {
  const user = await requireUser();
  if (!await consumeRateLimit(`upload:${user.id}`, 30, 60 * 60 * 1000)) return { success: false, message: "Upload limit reached. Try again later." };
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id, deletedAt: null },
    select: { id: true },
  });

  if (!application) {
    return { success: false, message: "Application not found." };
  }

  const files = uploadedFiles(formData);
  const uploadError = await validateUploadedFiles(files, true);
  if (uploadError) return { success: false, message: uploadError };
  await saveApplicationFiles(user.id, application.id, files);

  revalidatePath("/");
  return { success: true, message: "Files uploaded." };
}

export async function attachApplicationDocuments(applicationId: string, formData: FormData) {
  const user = await requireUser();
  const documentIds = [...new Set(selectedDocumentIds(formData))];
  if (documentIds.length === 0 || documentIds.length > 100) {
    return { success: false, message: "Choose between 1 and 100 documents." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: { id: applicationId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!application) return { success: false, message: "Application not found." };

    const documents = await tx.userDocument.findMany({ where: { id: { in: documentIds }, userId: user.id } });
    if (documents.length !== documentIds.length) return { success: false, message: "A selected document is no longer available." };

    const existing = await tx.applicationFile.findMany({
      where: { applicationId, userId: user.id, userDocumentId: { in: documentIds } },
      select: { userDocumentId: true },
    });
    if (existing.length > 0) return { success: false, message: "One or more documents are already attached." };

    const fileCount = await tx.applicationFile.count({ where: { applicationId, userId: user.id } });
    if (fileCount + documents.length > 100) return { success: false, message: "Choose at most 100 attachments per application." };

    await tx.applicationFile.createMany({ data: documents.map((document) => ({
      applicationId,
      userId: user.id,
      userDocumentId: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      storagePath: document.storagePath,
    })) });
    return { success: true, message: documents.length === 1 ? "Document attached." : "Documents attached." };
  });

  if (result.success) revalidatePath("/");
  return result;
}

export async function deleteApplicationFile(fileId: string) {
  const user = await requireUser();
  const file = await prisma.applicationFile.findFirst({
    where: { id: fileId, userId: user.id, application: { userId: user.id, deletedAt: null } },
  });

  if (!file) {
    return;
  }

  await prisma.applicationFile.delete({ where: { id: file.id } });
  if (!file.userDocumentId) {
    await removeStoredFile(file.storagePath, uploadsRoot);
  }

  revalidatePath("/");
  return { success: true, message: "File deleted." };
}

export async function uploadUserDocuments(formData: FormData) {
  const user = await requireUser();
  if (!await consumeRateLimit(`upload:${user.id}`, 30, 60 * 60 * 1000)) return { success: false, message: "Upload limit reached. Try again later." };
  const files = uploadedFiles(formData);

  const uploadError = await validateUploadedFiles(files, true);
  if (uploadError) return { success: false, message: uploadError };
  await saveUserDocuments(user.id, files);

  revalidatePath("/");
  revalidatePath("/documents");
  return { success: true, message: "Documents uploaded." };
}

export async function deleteUserDocument(documentId: string) {
  const user = await requireUser();
  const document = await prisma.userDocument.findFirst({
    where: { id: documentId, userId: user.id },
  });

  if (!document) {
    return;
  }

  const copies: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const attachments = await tx.applicationFile.findMany({ where: { userDocumentId: document.id, userId: user.id } });
      const documentsSize = await tx.userDocument.aggregate({ where: { userId: user.id }, _sum: { fileSize: true } });
      const filesSize = await tx.applicationFile.aggregate({ where: { userId: user.id, userDocumentId: null }, _sum: { fileSize: true } });
      if ((documentsSize._sum.fileSize ?? 0) + (filesSize._sum.fileSize ?? 0) + (attachments.length - 1) * document.fileSize > (user.isGuest ? 50 : 500) * 1024 * 1024) {
        throw new Error("Storage quota prevents preserving these attachments. Remove unused attachments first.");
      }
      for (const attachment of attachments) {
        const storagePath = path.join(user.id, attachment.applicationId, `${randomUUID()}-${sanitizeFileName(attachment.fileName)}`);
        const target = path.join(uploadsRoot, storagePath);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(documentUploadsRoot, document.storagePath), target);
        copies.push(storagePath);
        await tx.applicationFile.update({ where: { id: attachment.id }, data: { userDocumentId: null, storagePath } });
      }
      await tx.userDocument.delete({ where: { id: document.id } });
    }, { timeout: 15000 });
  } catch (error) {
    await removeStoredFiles(copies, uploadsRoot);
    throw error;
  }
  await removeStoredFile(document.storagePath, documentUploadsRoot);

  revalidatePath("/");
  revalidatePath("/documents");
  return { success: true, message: "Document removed from library. Application attachments were preserved." };
}
