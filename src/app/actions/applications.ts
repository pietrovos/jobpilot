"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import path from "path";
import { z } from "zod";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { applicationUploadsRoot as uploadsRoot } from "@/lib/upload-roots";
import { saveCompanyLogo, selectedDocumentIds, uploadedFiles, validateUploadedFiles } from "@/lib/application-storage";
import { requireUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/backend-limits";
import { webUrlSchema } from "@/lib/backend-validation";
import { prisma } from "@/lib/db";
import { emptyExtractJobState, extractFromHtml, failedExtract, normalizeJobUrl, type ExtractJobState } from "@/lib/job-import";
import { jobIdFromUrl } from "@/lib/job-id";
import { safeFetch } from "@/lib/safe-fetch";
import { withUploadBatch } from "@/lib/upload-batch";
import { applicationSchema, applicationValidationMessage, nullable, value } from "./form-data";

export async function extractJobPost(
  _previousState: ExtractJobState,
  formData: FormData,
): Promise<ExtractJobState> {
  const user = await requireUser();
  if (!await consumeRateLimit(`fetch:${user.id}`, 20, 60 * 60 * 1000)) return { ...emptyExtractJobState, message: "Autofill limit reached. Try again later." };

  const jobUrl = value(formData, "autofillUrl").trim();
  const parsedUrl = webUrlSchema.safeParse(jobUrl);

  if (!parsedUrl.success) {
    return {
      ...emptyExtractJobState,
      message: "Paste a valid job post URL to start adding an application.",
    };
  }

  const normalizedUrl = normalizeJobUrl(parsedUrl.data);

  try {
    const response = await safeFetch(normalizedUrl, "html", 2 * 1024 * 1024);
    const html = response.buffer.toString("utf8");
    const extracted = extractFromHtml(html, normalizedUrl);
    const foundAny = Object.values(extracted).some((item) => item.length > 0);

    return {
      message: foundAny
        ? "Autofill found some details. Review them and fill anything missing."
        : "Could not read useful details from that page. Fill the missing fields below.",
      values: {
        ...extracted,
        jobUrl: normalizedUrl,
        jobId: extracted.jobId || jobIdFromUrl(normalizedUrl),
      },
    };
  } catch {
    return failedExtract(normalizedUrl);
  }
}

export async function createApplication(formData: FormData) {
  const user = await requireUser();
  if (!await consumeRateLimit(`create:${user.id}`, 60, 60 * 60 * 1000)) return { success: false, message: "Application limit reached. Try again later." };
  const parsed = applicationSchema.safeParse({
    company: value(formData, "company"),
    role: value(formData, "role"),
    status: value(formData, "status") || "APPLIED",
    location: value(formData, "location"),
    salary: value(formData, "salary"),
    jobUrl: value(formData, "jobUrl"),
    jobId: value(formData, "jobId"),
    companyLogoUrl: value(formData, "companyLogoUrl"),
    jobPostedAt: value(formData, "jobPostedAt"),
    jobDescription: value(formData, "jobDescription"),
    notes: value(formData, "notes"),
    appliedAt: value(formData, "appliedAt"),
  });

  if (!parsed.success) {
    return { success: false, message: applicationValidationMessage(parsed.error, formData) };
  }

  const files = uploadedFiles(formData);
  const uploadError = await validateUploadedFiles(files, false);
  if (uploadError) return { success: false, message: uploadError };

  const applicationId = randomUUID();
  const documentIds = [...new Set(selectedDocumentIds(formData))];
  if (documentIds.length + files.length > 100) return { success: false, message: "Choose at most 100 attachments." };
  const application = await withUploadBatch(uploadsRoot, path.join(user.id, applicationId), files, (uploads) => prisma.$transaction(async (tx) => {
    const documents = await tx.userDocument.findMany({ where: { id: { in: documentIds }, userId: user.id } });
    if (documents.length !== documentIds.length) throw new Error("A selected document is no longer available");
    const firstApplication = await tx.application.findFirst({ where: { userId: user.id }, orderBy: { sortOrder: "asc" }, select: { sortOrder: true } });
    return tx.application.create({
    data: {
      id: applicationId,
      userId: user.id,
      company: parsed.data.company,
      role: parsed.data.role,
      status: parsed.data.status,
      location: nullable(parsed.data.location),
      salary: nullable(parsed.data.salary),
      jobUrl: nullable(parsed.data.jobUrl),
      jobId: nullable(parsed.data.jobId || jobIdFromUrl(parsed.data.jobUrl || "")),
      jobPostedAt: nullable(parsed.data.jobPostedAt),
      jobDescription: nullable(parsed.data.jobDescription),
      notes: nullable(parsed.data.notes),
      appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : new Date(),
      sortOrder: firstApplication ? firstApplication.sortOrder - 1 : 0,
      statusChanges: {
        create: { status: parsed.data.status },
      },
      files: { create: [
        ...uploads.map((upload) => ({ ...upload, userId: user.id })),
        ...documents.map((document) => ({ userId: user.id, userDocumentId: document.id, fileName: document.fileName, fileType: document.fileType, fileSize: document.fileSize, storagePath: document.storagePath })),
      ] },
    },
    select: { id: true },
    });
  }));
  await saveCompanyLogo(user.id, application.id, nullable(parsed.data.companyLogoUrl));

  revalidatePath("/");
  return { success: true, message: "Application created." };
}

export async function updateApplicationStatus(applicationId: string, formData: FormData) {
  const user = await requireUser();
  const status = z.enum(ApplicationStatus).safeParse(value(formData, "status"));

  if (!status.success) {
    return { success: false, message: "Choose a valid status." };
  }

  const found = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: { id: applicationId, userId: user.id, deletedAt: null }, select: { status: true },
    });
    if (!application) return false;
    if (application.status !== status.data) {
      await tx.application.update({ where: { id: applicationId }, data: { status: status.data } });
      await tx.statusChange.create({ data: { applicationId, status: status.data } });
    }
    return true;
  });
  if (!found) return { success: false, message: "Application not found." };

  revalidatePath("/");
  return { success: true, message: "Status saved." };
}

export async function updateApplication(applicationId: string, formData: FormData) {
  const user = await requireUser();
  // Omitted fields are unchanged; an explicit empty optional field clears it.
  const fields = Object.keys(applicationSchema.shape).filter((key) => key !== "companyLogoUrl" && formData.has(key));
  // Zod applies inner defaults even through partial(); patches must not reset status.
  const parsed = applicationSchema.extend({ status: z.enum(ApplicationStatus).optional() }).partial().safeParse(Object.fromEntries(fields.map((key) => [key, value(formData, key)])));

  if (!parsed.success) {
    return { success: false, message: applicationValidationMessage(parsed.error, formData) };
  }

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id, deletedAt: null },
    select: { status: true, jobId: true },
  });

  if (!application) {
    return { success: false, message: "Application not found." };
  }

  const update = prisma.application.update({
    where: { id: applicationId },
    data: {
      company: parsed.data.company,
      role: parsed.data.role,
      status: parsed.data.status,
      location: parsed.data.location === undefined ? undefined : nullable(parsed.data.location),
      salary: parsed.data.salary === undefined ? undefined : nullable(parsed.data.salary),
      jobUrl: parsed.data.jobUrl === undefined ? undefined : nullable(parsed.data.jobUrl),
      jobId: parsed.data.jobId === undefined
        ? parsed.data.jobUrl && !application.jobId ? nullable(jobIdFromUrl(parsed.data.jobUrl)) : undefined
        : nullable(parsed.data.jobId),
      jobPostedAt: parsed.data.jobPostedAt === undefined ? undefined : nullable(parsed.data.jobPostedAt),
      jobDescription: parsed.data.jobDescription === undefined ? undefined : nullable(parsed.data.jobDescription),
      notes: parsed.data.notes === undefined ? undefined : nullable(parsed.data.notes),
      appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : undefined,
    },
  });

  if (!parsed.data.status || application.status === parsed.data.status) {
    await update;
  } else {
    await prisma.$transaction([
      update,
      prisma.statusChange.create({
        data: { applicationId, status: parsed.data.status },
      }),
    ]);
  }

  revalidatePath("/");
  return { success: true, message: "Application saved." };
}

export async function refreshCompanyLogo(applicationId: string) {
  const user = await requireUser();
  if (!await consumeRateLimit(`fetch:${user.id}`, 20, 60 * 60 * 1000)) return { success: false, message: "Logo refresh limit reached. Try again later." };
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id, deletedAt: null },
    select: { id: true, jobUrl: true },
  });

  if (!application?.jobUrl) return { success: false, message: "Add a supported job URL first." };

  try {
    const response = await safeFetch(normalizeJobUrl(application.jobUrl), "html", 2 * 1024 * 1024);
    const logoUrl = extractFromHtml(response.buffer.toString("utf8"), response.url).companyLogoUrl;
    if (!await saveCompanyLogo(user.id, application.id, nullable(logoUrl))) return { success: false, message: "No supported logo was found." };
  } catch {
    // A blocked job board must not interrupt the application list.
    return { success: false, message: "That site could not provide a logo." };
  }

  revalidatePath("/");
  return { success: true, message: "Logo refreshed." };
}

export async function deleteStatusChange(statusChangeId: string) {
  const user = await requireUser();
  const statusChange = await prisma.statusChange.findFirst({
    where: {
      id: statusChangeId,
      application: { userId: user.id, deletedAt: null },
    },
    select: { id: true },
  });

  if (!statusChange) {
    return;
  }

  await prisma.statusChange.delete({ where: { id: statusChange.id } });

  revalidatePath("/");
  return { success: true, message: "Status history entry deleted." };
}

export async function reorderApplications(formData: FormData) {
  const user = await requireUser();
  const applicationIds = formData
    .getAll("applicationIds")
    .filter((item): item is string => typeof item === "string" && item.length > 0);

  if (applicationIds.length === 0 || applicationIds.length > 1000) {
    return;
  }

  const ownedApplications = await prisma.application.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  const ownedIds = new Set(ownedApplications.map((application) => application.id));
  if (ownedIds.size !== applicationIds.length || new Set(applicationIds).size !== applicationIds.length || applicationIds.some((id) => !ownedIds.has(id))) {
    return { success: false, message: "Refresh the complete list before reordering." };
  }

  await prisma.$transaction(
    applicationIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) =>
        prisma.application.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
  );

  revalidatePath("/");
  return { success: true, message: "Applications reordered." };
}
