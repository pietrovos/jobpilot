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
import { capturedPostingSchema, capturedPostingValues } from "@/lib/job-capture";
import { fetchFromJobSource, fetchJobPosting } from "@/lib/job-fetch";
import { matchJobSource } from "@/lib/job-sources";
import { emptyExtractJobState, failedExtract, mergeJobValues, normalizeJobUrl, type ExtractJobState } from "@/lib/job-import";
import { jobIdFromUrl } from "@/lib/job-id";
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
  const posting = await fetchJobPosting(normalizedUrl);

  if (posting.found) {
    return { message: "Autofill found some details. Review them and fill anything missing.", values: posting.values };
  }
  if (posting.blocked) {
    return {
      message: "That site blocks automated access. Open the posting in your browser and use Save to JobPilot, or fill the fields below.",
      blocked: true,
      values: posting.values,
    };
  }
  if (posting.failed) return failedExtract(normalizedUrl);
  return { message: "Could not read useful details from that page. Fill the missing fields below.", values: posting.values };
}

// Receives what the Save to JobPilot bookmarklet read from a job page in the
// user's browser, for sites that block server-side autofill.
export async function importCapturedPosting(payload: unknown): Promise<ExtractJobState> {
  const user = await requireUser();
  if (!await consumeRateLimit(`capture:${user.id}`, 60, 60 * 60 * 1000)) return { ...emptyExtractJobState, message: "Capture limit reached. Try again later." };
  const parsed = capturedPostingSchema.safeParse(payload);
  if (!parsed.success) return { ...emptyExtractJobState, message: "That capture could not be read. Click Save to JobPilot on the job page again." };

  // The capture comes first; a site JobPilot can also read directly (such as
  // LinkedIn's guest page) fills in fields the page layout hid from it.
  const captured = capturedPostingValues(parsed.data);
  const missing = !captured.company || !captured.role || !captured.location || !captured.jobDescription;
  const fromSource = missing && matchJobSource(captured.jobUrl) && await consumeRateLimit(`fetch:${user.id}`, 20, 60 * 60 * 1000)
    ? await fetchFromJobSource(captured.jobUrl)
    : {};
  const values = { ...mergeJobValues(captured, fromSource), jobUrl: captured.jobUrl };
  const found = Boolean(values.company || values.role || values.jobDescription);
  return {
    message: found
      ? `Saved from ${new URL(values.jobUrl).hostname}. Review the details and fill anything missing.`
      : "The page did not show job details JobPilot could read. Select the job description on the page before clicking Save to JobPilot, or fill the fields below.",
    values,
  };
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
  await saveCompanyLogo(user.id, application.id, nullable(parsed.data.companyLogoUrl), nullable(parsed.data.jobUrl));

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

  if (!application?.jobUrl) return { success: false, message: "Add a job URL first." };

  try {
    const posting = await fetchJobPosting(normalizeJobUrl(application.jobUrl));
    if (!posting.found) return { success: false, message: "That site could not provide a logo." };
    if (!await saveCompanyLogo(user.id, application.id, nullable(posting.values.companyLogoUrl), posting.pageUrl)) return { success: false, message: "No supported logo was found." };
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
