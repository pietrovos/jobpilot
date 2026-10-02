import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { safeFetch } from "@/lib/safe-fetch";
import { applicationUploadsRoot as uploadsRoot, companyLogoUploadsRoot, documentUploadsRoot } from "@/lib/upload-roots";
import { withUploadBatch } from "@/lib/upload-batch";
import { verifiedImage, verifyUpload } from "@/lib/verified-upload";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BATCH_BYTES = 30 * 1024 * 1024;
const MAX_COMPANY_LOGO_BYTES = 2 * 1024 * 1024;

export function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || "application-file").slice(0, 160);
}

export function uploadedFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);
}

export function selectedDocumentIds(formData: FormData) {
  return formData
    .getAll("documentIds")
    .filter((item): item is string => typeof item === "string" && item.length > 0);
}

export async function validateUploadedFiles(files: File[], required: boolean) {
  const totalSize = files.reduce((total, file) => total + file.size, 0);

  if (
    (required && files.length === 0) ||
    files.length > 10 ||
    totalSize > MAX_UPLOAD_BATCH_BYTES ||
    files.some((file) => file.size > MAX_UPLOAD_BYTES)
  ) {
    return "Choose up to 10 files, at most 10 MB each and 30 MB total.";
  }
  try {
    for (const file of files) await verifyUpload(file);
  } catch {
    return "Upload PDF, UTF-8 text, or a valid non-animated PNG, JPEG, WebP or GIF image.";
  }
}

export async function saveApplicationFiles(userId: string, applicationId: string, files: File[]) {
  return withUploadBatch(uploadsRoot, path.join(userId, applicationId), files, (uploads) => prisma.$transaction(async (tx) => {
    await tx.application.findFirstOrThrow({ where: { id: applicationId, userId, deletedAt: null }, select: { id: true } });
    await tx.applicationFile.createMany({ data: uploads.map((upload) => ({ ...upload, userId, applicationId })) });
  }));
}

export async function saveCompanyLogo(userId: string, applicationId: string, logoUrl: string | null) {
  if (!logoUrl) return;
  let pendingPath: string | undefined;
  try {
    const response = await safeFetch(logoUrl, "image", MAX_COMPANY_LOGO_BYTES);
    const image = await verifiedImage(response.buffer);

    const relativePath = path.join(userId, applicationId, `${randomUUID()}${image.extension}`);
    const absolutePath = path.join(companyLogoUploadsRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    pendingPath = relativePath;
    await writeFile(absolutePath, image.buffer);
    const previous = await prisma.$transaction(async (tx) => {
      const application = await tx.application.findFirstOrThrow({ where: { id: applicationId, userId, deletedAt: null } });
      await tx.application.update({
        where: { id: applicationId },
        data: { companyLogoPath: relativePath, companyLogoType: image.mimeType },
      });
      return application.companyLogoPath;
    });
    pendingPath = undefined;
    if (previous) await removeStoredFile(previous, companyLogoUploadsRoot);
    return true;
  } catch {
    if (pendingPath) await removeStoredFile(pendingPath, companyLogoUploadsRoot);
    // A missing or blocked logo must not prevent saving the application.
  }
}

export async function saveUserDocuments(userId: string, files: File[]) {
  return withUploadBatch(documentUploadsRoot, userId, files, (uploads) => prisma.$transaction(async (tx) => {
    await tx.userDocument.createMany({ data: uploads.map((upload) => ({ ...upload, userId })) });
  }));
}

export async function removeStoredFiles(paths: string[], rootPath: string) {
  await Promise.all(paths.map((storagePath) => removeStoredFile(storagePath, rootPath)));
}

export async function removeStoredFile(storagePath: string, rootPath: string) {
  const absolutePath = path.resolve(rootPath, storagePath);

  if (!absolutePath.startsWith(path.resolve(rootPath) + path.sep)) {
    return;
  }

  await unlink(absolutePath).catch(() => undefined);
}

export async function trimDeletedApplications(userId: string) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expired = await prisma.$transaction(async (tx) => {
    const applications = await tx.application.findMany({
      where: { userId, deletedAt: { lte: cutoff } },
      include: { files: { where: { userDocumentId: null } } },
    });
    await tx.application.deleteMany({ where: { id: { in: applications.map((item) => item.id) }, userId, deletedAt: { lte: cutoff } } });
    return applications;
  });
  await removeStoredFiles(expired.flatMap((item) => item.files.map((file) => file.storagePath)), uploadsRoot);
  await removeStoredFiles(expired.flatMap((item) => item.companyLogoPath ? [item.companyLogoPath] : []), companyLogoUploadsRoot);
  const stale = await prisma.deletedApplication.findMany({
    where: { userId, deletedAt: { lte: cutoff } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, companyLogoPath: true },
  });

  if (stale.length === 0) {
    return;
  }

  await prisma.deletedApplication.deleteMany({
    where: { id: { in: stale.map((application) => application.id) } },
  });
  await removeStoredFiles(
    stale.flatMap((application) => (application.companyLogoPath ? [application.companyLogoPath] : [])),
    companyLogoUploadsRoot,
  );
}

export async function purgeDeletedApplications(userId: string, ids?: string[]) {
  const deleted = await prisma.$transaction(async (tx) => {
    const where = { userId, ...(ids ? { id: { in: ids } } : {}), deletedAt: { not: null } };
    const legacyWhere = { userId, ...(ids ? { id: { in: ids } } : {}) };
    const applications = await tx.application.findMany({
      where,
      select: {
        companyLogoPath: true,
        files: { where: { userDocumentId: null }, select: { storagePath: true } },
      },
    });
    const legacy = await tx.deletedApplication.findMany({
      where: legacyWhere,
      select: { companyLogoPath: true },
    });
    const result = await tx.application.deleteMany({ where });
    const legacyResult = await tx.deletedApplication.deleteMany({ where: legacyWhere });
    return { applications, legacy, count: result.count + legacyResult.count };
  });
  await removeStoredFiles(deleted.applications.flatMap((item) => item.files.map((file) => file.storagePath)), uploadsRoot);
  await removeStoredFiles(
    [...deleted.applications, ...deleted.legacy].flatMap((item) => item.companyLogoPath ? [item.companyLogoPath] : []),
    companyLogoUploadsRoot,
  );
  return deleted.count;
}
