"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import path from "path";
import { z } from "zod";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { createGuestSession, createSession, destroySession, getCurrentUser, isGuestUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateSchema, optionalDateSchema, passwordSchema, webUrlSchema } from "@/lib/backend-validation";
import { safeFetch } from "@/lib/safe-fetch";
import { transferGuestOwnership } from "@/lib/guest-transfer";
import { adoptGuestWorkspace } from "@/lib/oauth-session";
import { consumeRateLimit } from "@/lib/backend-limits";
import { verifiedImage, verifyUpload } from "@/lib/verified-upload";
import { withUploadBatch } from "@/lib/upload-batch";

const authSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
});

const applicationSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  status: z.enum(ApplicationStatus).default("APPLIED"),
  location: z.string().trim().max(120).optional(),
  salary: z.string().trim().max(80).optional(),
  jobUrl: webUrlSchema.optional().or(z.literal("")),
  companyLogoUrl: webUrlSchema.optional().or(z.literal("")),
  jobPostedAt: z.string().trim().max(120).optional(),
  jobDescription: z.string().trim().max(12000).optional(),
  notes: z.string().trim().max(1000).optional(),
  appliedAt: optionalDateSchema,
});

const emailLogSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  direction: z.enum(["RECEIVED", "SENT"]).default("RECEIVED"),
  recipient: z.string().trim().max(160).optional(),
  emailUrl: webUrlSchema.optional().or(z.literal("")),
  sentAt: dateSchema,
  notes: z.string().trim().max(1000).optional(),
});

const noteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(3000),
});

const noteFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const interviewSchema = z.object({
  title: z.string().trim().min(1).max(120),
  interviewType: z.string().trim().max(120).optional(),
  scheduledAt: optionalDateSchema,
  studyNotes: z.string().trim().max(1500).optional(),
  notes: z.string().trim().max(1500).optional(),
});

const offerDetailsSchema = z.object({
  compensation: z.string().trim().max(160).optional(),
  startDate: optionalDateSchema,
  deadline: optionalDateSchema,
  benefits: z.string().trim().max(1500).optional(),
  equity: z.string().trim().max(500).optional(),
  negotiables: z.string().trim().max(1500).optional(),
  notes: z.string().trim().max(1500).optional(),
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BATCH_BYTES = 30 * 1024 * 1024;
// Compared against for unknown or passwordless accounts to keep timing uniform.
const DUMMY_PASSWORD_HASH = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
const MAX_PROFILE_IMAGE_BYTES = 3 * 1024 * 1024;
const MIN_PROFILE_IMAGE_DIMENSION = 64;
const uploadsRoot = path.join(process.cwd(), "uploads", "application-files");
const documentUploadsRoot = path.join(process.cwd(), "uploads", "documents");
const profileUploadsRoot = path.join(process.cwd(), "uploads", "profile-pictures");
const companyLogoUploadsRoot = path.join(process.cwd(), "uploads", "company-logos");
const MAX_COMPANY_LOGO_BYTES = 2 * 1024 * 1024;

export type ExtractJobState = {
  message: string;
  values: {
    company: string;
    role: string;
    location: string;
    salary: string;
    jobUrl: string;
    companyLogoUrl: string;
    jobPostedAt: string;
    jobDescription: string;
    notes: string;
  };
};

const emptyExtractJobState: ExtractJobState = {
  message: "",
  values: {
    company: "",
    role: "",
    location: "",
    salary: "",
    jobUrl: "",
    companyLogoUrl: "",
    jobPostedAt: "",
    jobDescription: "",
    notes: "",
  },
};

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function nullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function signUp(formData: FormData) {
  if (!await consumeRateLimit("signup", 20, 60 * 60 * 1000)) redirect("/signup?auth=rate-limited");
  const guestUser = await getCurrentUser();
  const parsed = authSchema.safeParse({
    name: value(formData, "name"),
    email: value(formData, "email"),
    password: value(formData, "password"),
  });

  if (!parsed.success || !parsed.data.name) {
    redirect("/signup?auth=signup-invalid");
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (existing) {
    redirect("/signup?auth=email-taken");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: {
      name: parsed.data.name!, email: parsed.data.email, passwordHash,
    } });
    if (isGuestUser(guestUser)) await transferGuestOwnership(tx, guestUser.id, created.id);
    return created;
  });

  await createSession(user.id);
  redirect("/");
}

export async function signIn(formData: FormData) {
  if (!await consumeRateLimit("login", 100, 15 * 60 * 1000)) redirect("/login?auth=rate-limited");
  const guestUser = await getCurrentUser();
  const parsed = authSchema.omit({ name: true }).safeParse({
    email: value(formData, "email"),
    password: value(formData, "password"),
  });

  if (!parsed.success) {
    redirect("/login?auth=invalid-credentials");
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // OAuth-only accounts have no password hash: compare against a dummy hash so
  // the response time does not reveal whether the account can use a password.
  const usableHash = user && !user.isGuest && user.passwordHash ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const validPassword = await bcrypt.compare(parsed.data.password, usableHash);

  if (!user || user.isGuest || !user.passwordHash || !validPassword) {
    redirect("/login?auth=invalid-credentials");
  }

  if (isGuestUser(guestUser) && guestUser.id !== user.id) {
    await adoptGuestWorkspace(guestUser.id, user.id);
  }

  await createSession(user.id);
  redirect("/");
}

export async function continueAsGuest() {
  if (await getCurrentUser()) redirect("/");
  if (!await consumeRateLimit("guest", 30, 60 * 60 * 1000)) redirect("/login?auth=rate-limited");
  await createGuestSession();
  redirect("/");
}

export async function signOut() {
  const user = await getCurrentUser();
  await destroySession();

  if (isGuestUser(user)) {
    await prisma.user.delete({ where: { id: user.id } });
  }

  redirect("/");
}

export async function uploadProfilePicture(formData: FormData) {
  const user = await requireUser();
  if (!await consumeRateLimit(`upload:${user.id}`, 30, 60 * 60 * 1000)) redirect("/?file=rate-limited");
  const file = formData.get("profilePicture");
  const returnTo = safeReturnPath(value(formData, "returnTo"));

  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PROFILE_IMAGE_BYTES) {
    redirect(`${returnTo}?profile=invalid`);
  }

  const profileImage = await verifiedImage(Buffer.from(await file.arrayBuffer()), MIN_PROFILE_IMAGE_DIMENSION).catch(() => null);

  if (!profileImage) {
    redirect(`${returnTo}?profile=invalid`);
  }

  const extension = profileImage.extension;
  const storedFileName = `${randomUUID()}${extension}`;
  const relativePath = `${user.id}/${storedFileName}`;
  const absoluteDirectory = path.join(profileUploadsRoot, user.id);
  const absolutePath = path.join(profileUploadsRoot, relativePath);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, profileImage.buffer);

  const previousPath = user.profileImagePath;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      profileImagePath: relativePath,
      profileImageType: profileImage.mimeType,
    },
  }).catch(async (error) => {
    await removeStoredFile(relativePath, profileUploadsRoot);
    throw error;
  });

  if (previousPath) {
    await removeStoredFile(previousPath, profileUploadsRoot);
  }

  revalidatePath("/");
  revalidatePath("/documents");
  return { success: true, message: "Profile picture updated." };
}

function safeReturnPath(returnTo: string) {
  if (returnTo === "/documents") return returnTo;
  return "/";
}

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
    companyLogoUrl: value(formData, "companyLogoUrl"),
    jobPostedAt: value(formData, "jobPostedAt"),
    jobDescription: value(formData, "jobDescription"),
    notes: value(formData, "notes"),
    appliedAt: value(formData, "appliedAt"),
  });

  if (!parsed.success) {
    return { success: false, message: "Check the application fields, dates and URLs." };
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
    return { success: false, message: "Check the application fields, dates and URLs." };
  }

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id, deletedAt: null },
    select: { status: true },
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

export async function addEmailLog(applicationId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = emailLogSchema.safeParse({
    subject: value(formData, "subject"),
    direction: value(formData, "direction") || "RECEIVED",
    recipient: value(formData, "recipient"),
    emailUrl: value(formData, "emailUrl"),
    sentAt: value(formData, "sentAt"),
    notes: value(formData, "notes"),
  });

  if (!parsed.success) return { success: false, message: "Check the email subject, date, and link." };

  const application = await prisma.application.findFirst({ where: { id: applicationId, userId: user.id, deletedAt: null }, select: { id: true } });
  if (!application) return { success: false, message: "Application not found." };

  await prisma.applicationEmailLog.create({
    data: {
      applicationId,
      userId: user.id,
      subject: parsed.data.subject,
      direction: parsed.data.direction,
      recipient: nullable(parsed.data.recipient),
      emailUrl: nullable(parsed.data.emailUrl),
      sentAt: new Date(parsed.data.sentAt),
      notes: nullable(parsed.data.notes),
    },
  });

  revalidatePath("/");
  return { success: true, message: "Email saved." };
}

export async function deleteEmailLog(emailLogId: string) {
  const user = await requireUser();
  const result = await prisma.applicationEmailLog.deleteMany({ where: { id: emailLogId, userId: user.id, application: { userId: user.id, deletedAt: null } } });
  revalidatePath("/");
  return { success: result.count > 0, message: result.count ? "Email deleted." : "Email not found." };
}

export async function updateEmailLog(emailLogId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = emailLogSchema.safeParse({
    subject: value(formData, "subject"),
    direction: value(formData, "direction"),
    recipient: value(formData, "recipient"),
    emailUrl: value(formData, "emailUrl"),
    sentAt: value(formData, "sentAt"),
    notes: value(formData, "notes"),
  });

  if (!parsed.success) return { success: false, message: "Check the email subject, date, and link." };

  const updated = await prisma.applicationEmailLog.updateMany({
    where: { id: emailLogId, userId: user.id, application: { userId: user.id, deletedAt: null } },
    data: {
      subject: parsed.data.subject,
      direction: parsed.data.direction,
      recipient: nullable(parsed.data.recipient),
      emailUrl: nullable(parsed.data.emailUrl),
      sentAt: new Date(parsed.data.sentAt),
      notes: nullable(parsed.data.notes),
    },
  });

  if (!updated.count) return { success: false, message: "Email log not found." };
  revalidatePath("/");
  return { success: true, message: "Email saved." };
}

export async function addApplicationNote(applicationId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = noteSchema.safeParse({
    title: value(formData, "title"),
    body: value(formData, "body"),
  });
  const folderId = value(formData, "folderId");

  if (!parsed.success) return { success: false, message: "Add both a note title and body." };

  const application = await prisma.application.findFirst({ where: { id: applicationId, userId: user.id, deletedAt: null }, select: { id: true } });
  if (!application) return { success: false, message: "Application not found." };

  if (folderId) {
    const folder = await prisma.applicationNoteFolder.findFirst({ where: { id: folderId, applicationId, userId: user.id }, select: { id: true } });
    if (!folder) return { success: false, message: "Note folder not found." };
  }

  await prisma.applicationNote.create({
    data: {
      applicationId,
      userId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      folderId: folderId || null,
    },
  });

  revalidatePath("/");
  return { success: true, message: "Note added." };
}

export async function deleteApplicationNote(noteId: string) {
  const user = await requireUser();
  const result = await prisma.applicationNote.deleteMany({ where: { id: noteId, userId: user.id, application: { userId: user.id, deletedAt: null } } });
  revalidatePath("/");
  return { success: result.count > 0, message: result.count ? "Note deleted." : "Note not found." };
}

export async function updateApplicationNote(noteId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = noteSchema.safeParse({
    title: value(formData, "title"),
    body: value(formData, "body"),
  });
  const folderId = value(formData, "folderId");

  if (!parsed.success) return { success: false, message: "Add both a note title and body." };

  const note = await prisma.applicationNote.findFirst({ where: { id: noteId, userId: user.id, application: { userId: user.id, deletedAt: null } }, select: { applicationId: true } });
  if (!note) return { success: false, message: "Note not found." };

  if (folderId) {
    const folder = await prisma.applicationNoteFolder.findFirst({ where: { id: folderId, applicationId: note.applicationId, userId: user.id }, select: { id: true } });
    if (!folder) return { success: false, message: "Note folder not found." };
  }

  const updated = await prisma.applicationNote.updateMany({
    where: { id: noteId, userId: user.id, application: { userId: user.id, deletedAt: null } },
    data: { title: parsed.data.title, body: parsed.data.body, folderId: folderId || null },
  });

  if (!updated.count) return { success: false, message: "Note not found." };
  revalidatePath("/");
  return { success: true, message: "Note saved." };
}

export async function moveApplicationNote(noteId: string, folderId: string) {
  const user = await requireUser();
  const note = await prisma.applicationNote.findFirst({
    where: { id: noteId, userId: user.id, application: { userId: user.id, deletedAt: null } },
    select: { applicationId: true },
  });
  if (!note) return;

  const folder = await prisma.applicationNoteFolder.findFirst({
    where: { id: folderId, applicationId: note.applicationId, userId: user.id },
    select: { id: true },
  });
  if (!folder) return;

  await prisma.applicationNote.updateMany({
    where: { id: noteId, userId: user.id, application: { userId: user.id, deletedAt: null } },
    data: { folderId },
  });
  revalidatePath("/");
  return { success: true, message: "Note moved." };
}

export async function addApplicationNoteFolder(applicationId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = noteFolderSchema.safeParse({ name: value(formData, "name") });
  if (!parsed.success) return { success: false, message: "Enter a folder name." };

  const application = await prisma.application.findFirst({ where: { id: applicationId, userId: user.id, deletedAt: null }, select: { id: true } });
  if (!application) return { success: false, message: "Application not found." };

  await prisma.applicationNoteFolder.create({ data: { applicationId, userId: user.id, name: parsed.data.name } });
  revalidatePath("/");
  return { success: true, message: "Folder added." };
}

export async function updateApplicationNoteFolder(folderId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = noteFolderSchema.safeParse({ name: value(formData, "name") });
  if (!parsed.success) return { success: false, message: "Enter a folder name." };

  await prisma.applicationNoteFolder.updateMany({ where: { id: folderId, userId: user.id, application: { userId: user.id, deletedAt: null } }, data: { name: parsed.data.name } });
  revalidatePath("/");
  return { success: true, message: "Folder saved." };
}

export async function deleteApplicationNoteFolder(folderId: string) {
  const user = await requireUser();

  await prisma.$transaction([
    prisma.applicationNote.updateMany({ where: { folderId, userId: user.id, application: { userId: user.id, deletedAt: null } }, data: { folderId: null } }),
    prisma.applicationNoteFolder.deleteMany({ where: { id: folderId, userId: user.id, application: { userId: user.id, deletedAt: null } } }),
  ]);
  revalidatePath("/");
  return { success: true, message: "Folder deleted." };
}

export async function addInterview(applicationId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = interviewSchema.safeParse({
    title: value(formData, "title"),
    interviewType: value(formData, "interviewType"),
    scheduledAt: value(formData, "scheduledAt"),
    studyNotes: value(formData, "studyNotes"),
    notes: value(formData, "notes"),
  });

  if (!parsed.success) return { success: false, message: "Enter an interview round name and valid date." };

  const application = await prisma.application.findFirst({ where: { id: applicationId, userId: user.id, deletedAt: null }, select: { id: true } });
  if (!application) return { success: false, message: "Application not found." };

  await prisma.applicationInterview.create({
    data: {
      applicationId,
      userId: user.id,
      title: parsed.data.title,
      interviewType: nullable(parsed.data.interviewType),
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      studyNotes: nullable(parsed.data.studyNotes),
      notes: nullable(parsed.data.notes),
    },
  });

  revalidatePath("/");
  return { success: true, message: "Interview added." };
}

export async function deleteInterview(interviewId: string) {
  const user = await requireUser();
  const result = await prisma.applicationInterview.deleteMany({ where: { id: interviewId, userId: user.id, application: { userId: user.id, deletedAt: null } } });
  revalidatePath("/");
  return { success: result.count > 0, message: result.count ? "Interview deleted." : "Interview not found." };
}

export async function updateInterview(interviewId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = interviewSchema.safeParse({
    title: value(formData, "title"),
    interviewType: value(formData, "interviewType"),
    scheduledAt: value(formData, "scheduledAt"),
    studyNotes: value(formData, "studyNotes"),
    notes: value(formData, "notes"),
  });

  if (!parsed.success) return { success: false, message: "Enter an interview round name and valid date." };
  const updated = await prisma.applicationInterview.updateMany({
    where: { id: interviewId, userId: user.id, application: { deletedAt: null } },
    data: {
      title: parsed.data.title,
      interviewType: nullable(parsed.data.interviewType),
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      studyNotes: nullable(parsed.data.studyNotes),
      notes: nullable(parsed.data.notes),
    },
  });
  if (!updated.count) return { success: false, message: "Interview not found." };

  revalidatePath("/");
  return { success: true, message: "Interview saved." };
}

export async function saveOfferDetails(applicationId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = offerDetailsSchema.safeParse({
    compensation: value(formData, "compensation"),
    startDate: value(formData, "startDate"),
    deadline: value(formData, "deadline"),
    benefits: value(formData, "benefits"),
    equity: value(formData, "equity"),
    negotiables: value(formData, "negotiables"),
    notes: value(formData, "notes"),
  });

  if (!parsed.success) return { success: false, message: "Check the offer dates and text fields." };

  const application = await prisma.application.findFirst({ where: { id: applicationId, userId: user.id, deletedAt: null }, select: { id: true } });
  if (!application) return { success: false, message: "Application not found." };

  await prisma.applicationOfferDetails.upsert({
    where: { applicationId },
    create: {
      applicationId,
      userId: user.id,
      compensation: nullable(parsed.data.compensation),
      startDate: nullable(parsed.data.startDate),
      deadline: nullable(parsed.data.deadline),
      benefits: nullable(parsed.data.benefits),
      equity: nullable(parsed.data.equity),
      negotiables: nullable(parsed.data.negotiables),
      notes: nullable(parsed.data.notes),
    },
    update: {
      compensation: nullable(parsed.data.compensation),
      startDate: nullable(parsed.data.startDate),
      deadline: nullable(parsed.data.deadline),
      benefits: nullable(parsed.data.benefits),
      equity: nullable(parsed.data.equity),
      negotiables: nullable(parsed.data.negotiables),
      notes: nullable(parsed.data.notes),
    },
  });

  revalidatePath("/");
  return { success: true, message: "Offer details saved." };
}

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

function failedExtract(jobUrl: string): ExtractJobState {
  return {
    ...emptyExtractJobState,
    message: "That site blocked autofill or did not expose job details. Fill the missing fields below.",
    values: {
      ...emptyExtractJobState.values,
      jobUrl,
    },
  };
}

function normalizeJobUrl(jobUrl: string) {
  const url = new URL(jobUrl);

  if (["linkedin.com", "www.linkedin.com"].includes(url.hostname) && url.pathname.includes("/jobs/search-results")) {
    const currentJobId = url.searchParams.get("currentJobId");

    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
    }
  }

  return jobUrl;
}

function extractFromHtml(html: string, jobUrl: string) {
  const jsonLd = extractJsonLdJobPosting(html);
  const structuredTitle = stringValue(jsonLd?.title);
  const pageTitle = metaContent(html, "og:title") || tagText(html, "title");
  const title = structuredTitle || pageTitle;

  if (isBlockedOrLoginPage(title)) {
    return { ...emptyExtractJobState.values, jobUrl };
  }

  const linkedInDetails = parseLinkedInTitle(pageTitle || title);
  const company =
    organizationName(jsonLd?.hiringOrganization) ||
    linkedInDetails.company ||
    usableSiteName(metaContent(html, "og:site_name")) ||
    companyFromTitle(title);
  const companyLogoUrl =
    organizationLogoUrl(jsonLd?.hiringOrganization, jobUrl) || companyLogoFromHtml(html, jobUrl, company);
  const location = jobLocation(jsonLd?.jobLocation) || linkedInDetails.location || linkedInLocation(html);
  const salary = salaryText(jsonLd?.baseSalary) || linkedInSalary(html);
  const postedAt = datePosted(jsonLd?.datePosted) || linkedInPostedAt(html);
  const description = linkedInDescription(html) || stringValue(jsonLd?.description) || metaContent(html, "description") || metaContent(html, "og:description");

  return {
    company: clean(company),
    role: clean(linkedInDetails.role || structuredTitle || roleFromTitle(title, company) || ""),
    location: clean(location),
    salary: clean(salary),
    jobUrl,
    companyLogoUrl,
    jobPostedAt: clean(postedAt),
    jobDescription: cleanDescription(description),
    notes: "",
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isBlockedOrLoginPage(title: string) {
  return /linkedin\s+login|sign\s+in|log\s+in/i.test(title);
}

function extractJsonLdJobPosting(html: string): Record<string, unknown> | null {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const script of scripts) {
    try {
      const data = JSON.parse(decodeHtml(script[1] ?? ""));
      const posting = findJobPosting(data);
      if (posting) return posting;
    } catch {
      continue;
    }
  }

  return null;
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];

  if (types.some((item) => String(item).toLowerCase() === "jobposting")) {
    return record;
  }

  return findJobPosting(record["@graph"]);
}

function metaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(regex);
  return decodeHtml(match?.[1] ?? match?.[2] ?? "");
}

function tagText(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
  return decodeHtml(match?.[1] ?? "");
}

function roleFromTitle(title: string, company: string | undefined) {
  if (!title) return "";
  const parts = title.split(/\s[-|–—]\s/).map((item) => item.trim());
  return parts.find((part) => part && part !== company) ?? title;
}

function parseLinkedInTitle(title: string) {
  const normalized = title.replace(/\s+\|\s+LinkedIn(?:\s+Jobs)?\s*$/i, "").trim();
  const hiringMatch = normalized.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+)$/i);

  if (hiringMatch) {
    return {
      company: hiringMatch[1]?.trim() ?? "",
      role: hiringMatch[2]?.trim() ?? "",
      location: hiringMatch[3]?.trim() ?? "",
    };
  }

  const atMatch = normalized.match(/^(.+?)\s+at\s+(.+?)(?:\s[-–—|]\s(.+))?$/i);

  if (atMatch) {
    return {
      company: atMatch[2]?.trim() ?? "",
      role: atMatch[1]?.trim() ?? "",
      location: atMatch[3]?.trim() ?? "",
    };
  }

  return { company: "", role: "", location: "" };
}

function usableSiteName(siteName: string) {
  const genericJobBoards = new Set(["linkedin", "indeed", "glassdoor", "ziprecruiter"]);
  const normalized = siteName.trim().toLowerCase();

  return normalized && !genericJobBoards.has(normalized) ? siteName : "";
}

function companyFromTitle(title: string) {
  if (!title) return "";
  const parts = title.split(/\s[-|–—]\s/).map((item) => item.trim());
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

function organizationName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" ? record.name : "";
}

function organizationLogoUrl(value: unknown, jobUrl: string) {
  if (!value || typeof value !== "object") return "";

  const logo = (value as Record<string, unknown>).logo;
  const logoUrl = typeof logo === "string"
    ? logo
    : logo && typeof logo === "object"
      ? stringValue((logo as Record<string, unknown>).url) || stringValue((logo as Record<string, unknown>).contentUrl)
      : "";

  try {
    const url = new URL(logoUrl, jobUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function companyLogoFromHtml(html: string, jobUrl: string, company: string) {
  const normalizedCompany = company.trim().toLowerCase();

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const source = imageAttribute(tag, "data-delayed-url") || imageAttribute(tag, "src");
    const alt = clean(imageAttribute(tag, "alt")).toLowerCase();
    const className = imageAttribute(tag, "class");

    if (!source || (alt !== normalizedCompany && !/company-logo/i.test(className))) continue;

    try {
      const url = new URL(source, jobUrl);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch {
      continue;
    }
  }

  return "";
}

function imageAttribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escapedName}=["']([^"']*)["']`, "i"));
  return decodeHtml(match?.[1] ?? "");
}

function jobLocation(value: unknown): string {
  const location = Array.isArray(value) ? value[0] : value;
  if (!location || typeof location !== "object") return "";

  const record = location as Record<string, unknown>;
  const address = record.address;
  if (!address || typeof address !== "object") return "";

  const addressRecord = address as Record<string, unknown>;
  return [addressRecord.addressLocality, addressRecord.addressRegion, addressRecord.addressCountry]
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .join(", ");
}

function linkedInLocation(html: string) {
  const match = html.match(
    /<span[^>]+class=["'][^"']*\btopcard__flavor--bullet\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );

  return clean(match?.[1] ?? "");
}

function linkedInSalary(html: string) {
  const match = html.match(
    /<div[^>]+class=["'][^"']*\bsalary\b[^"']*\bcompensation__salary\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );

  return clean(match?.[1] ?? "");
}

function linkedInPostedAt(html: string) {
  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i);
  if (timeMatch?.[1]) {
    return formatPostedDate(timeMatch[1]);
  }

  const postedTextMatch = html.match(
    /<span[^>]+class=["'][^"']*\bposted-time-ago__text\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );

  return clean(postedTextMatch?.[1] ?? "");
}

function datePosted(value: unknown) {
  return typeof value === "string" && value.length > 0 ? formatPostedDate(value) : "";
}

function formatPostedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function linkedInDescription(html: string) {
  const candidates = [
    ...html.matchAll(/<div[^>]+class=["'][^"']*\bshow-more-less-html__markup\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi),
    ...html.matchAll(/<div[^>]+class=["'][^"']*\bdescription__text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/section>/gi),
    ...html.matchAll(/<section[^>]+class=["'][^"']*\bdescription\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi),
  ]
    .map((match) => cleanDescription(match[1] ?? ""))
    .filter((item) => item.length > 180 && !/similar jobs on linkedin/i.test(item));

  return candidates.sort((left, right) => right.length - left.length)[0] ?? "";
}

function salaryText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const currency = typeof record.currency === "string" ? record.currency : "";
  const salaryValue = record.value;

  if (!salaryValue || typeof salaryValue !== "object") return "";

  const salaryRecord = salaryValue as Record<string, unknown>;
  const min = salaryRecord.minValue;
  const max = salaryRecord.maxValue;
  const unit = typeof salaryRecord.unitText === "string" ? salaryRecord.unitText.toLowerCase() : "";

  if (typeof min === "number" && typeof max === "number") {
    return `${currency} ${min}-${max}${unit ? ` / ${unit}` : ""}`.trim();
  }

  const singleValue = salaryRecord.value;
  if (typeof singleValue === "number") {
    return `${currency} ${singleValue}${unit ? ` / ${unit}` : ""}`.trim();
  }

  return "";
}

function clean(value: unknown) {
  return decodeHtml(String(value ?? ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(value: unknown) {
  return decodeHtml(String(value ?? ""))
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(h[1-6])>/gi, "\n\n")
    .replace(/<\/(p|div|section|ul|ol)>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n(?=(?:Your Role And Responsibilities|About The Role|What You Will Do|Preferred Education|Required Technical And Professional Expertise|Preferred Technical And Professional Experience|Introduction)\b)/g, "\n\n")
    .replace(/([^\n])\n(- )/g, "$1\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function deleteApplication(applicationId: string) {
  const user = await requireUser();
  await prisma.application.updateMany({
    where: { id: applicationId, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  await trimDeletedApplications(user.id);

  revalidatePath("/");
  return { success: true, message: "Application moved to trash for 30 days." };
}

export async function deleteApplications(formData: FormData) {
  const user = await requireUser();
  const applicationIds = formData
    .getAll("applicationIds")
    .filter((item): item is string => typeof item === "string" && item.length > 0);

  if (applicationIds.length === 0) {
    return;
  }

  if (applicationIds.length > 1000) return;
  await prisma.application.updateMany({
    where: { id: { in: applicationIds }, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  await trimDeletedApplications(user.id);

  revalidatePath("/");
  return { success: true, message: "Applications moved to trash for 30 days." };
}

export async function restoreDeletedApplication(deletedApplicationId: string) {
  const user = await requireUser();
  await trimDeletedApplications(user.id);
  const restored = await prisma.application.updateMany({
    where: { id: deletedApplicationId, userId: user.id, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (restored.count) {
    revalidatePath("/");
    return { success: true, message: "Application restored with all related data." };
  }
  // Existing persisted snapshots remain restorable, but cannot recover already-lost relations.
  const deletedApplication = await prisma.deletedApplication.findFirst({
    where: { id: deletedApplicationId, userId: user.id },
  });

  if (!deletedApplication) {
    return { success: false, message: "Deleted application not found or retention expired." };
  }

  const firstApplication = await prisma.application.findFirst({
    where: { userId: user.id },
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });

  await prisma.$transaction([
    prisma.application.create({
      data: {
        userId: user.id,
        company: deletedApplication.company,
        role: deletedApplication.role,
        status: deletedApplication.status,
        location: deletedApplication.location,
        salary: deletedApplication.salary,
        jobUrl: deletedApplication.jobUrl,
        companyLogoPath: deletedApplication.companyLogoPath,
        companyLogoType: deletedApplication.companyLogoType,
        jobPostedAt: deletedApplication.jobPostedAt,
        jobDescription: deletedApplication.jobDescription,
        notes: deletedApplication.notes,
        appliedAt: deletedApplication.appliedAt,
        createdAt: deletedApplication.createdAt,
        sortOrder: firstApplication ? firstApplication.sortOrder - 1 : 0,
        statusChanges: {
          create: { status: deletedApplication.status },
        },
      },
    }),
    prisma.deletedApplication.delete({ where: { id: deletedApplication.id } }),
  ]);

  revalidatePath("/");
  return { success: true, message: "Legacy application restored. Previously deleted related records cannot be recovered." };
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || "application-file").slice(0, 160);
}

function uploadedFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);
}

function selectedDocumentIds(formData: FormData) {
  return formData
    .getAll("documentIds")
    .filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function validateUploadedFiles(files: File[], required: boolean) {
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

async function saveApplicationFiles(userId: string, applicationId: string, files: File[]) {
  return withUploadBatch(uploadsRoot, path.join(userId, applicationId), files, (uploads) => prisma.$transaction(async (tx) => {
    await tx.application.findFirstOrThrow({ where: { id: applicationId, userId, deletedAt: null }, select: { id: true } });
    await tx.applicationFile.createMany({ data: uploads.map((upload) => ({ ...upload, userId, applicationId })) });
  }));
}

async function saveCompanyLogo(userId: string, applicationId: string, logoUrl: string | null) {
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

async function saveUserDocuments(userId: string, files: File[]) {
  return withUploadBatch(documentUploadsRoot, userId, files, (uploads) => prisma.$transaction(async (tx) => {
    await tx.userDocument.createMany({ data: uploads.map((upload) => ({ ...upload, userId })) });
  }));
}

async function removeStoredFiles(paths: string[], rootPath: string) {
  await Promise.all(paths.map((storagePath) => removeStoredFile(storagePath, rootPath)));
}

async function removeStoredFile(storagePath: string, rootPath: string) {
  const absolutePath = path.resolve(rootPath, storagePath);

  if (!absolutePath.startsWith(path.resolve(rootPath) + path.sep)) {
    return;
  }

  await unlink(absolutePath).catch(() => undefined);
}

async function trimDeletedApplications(userId: string) {
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
