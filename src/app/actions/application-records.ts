"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailLogSchema, interviewSchema, noteFolderSchema, noteSchema, nullable, offerDetailsSchema, value } from "./form-data";

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
  if (!note) return { success: false, message: "Note not found." };

  if (folderId) {
    const folder = await prisma.applicationNoteFolder.findFirst({
      where: { id: folderId, applicationId: note.applicationId, userId: user.id },
      select: { id: true },
    });
    if (!folder) return { success: false, message: "Note folder not found." };
  }

  const updated = await prisma.applicationNote.updateMany({
    where: { id: noteId, userId: user.id, application: { userId: user.id, deletedAt: null } },
    data: { folderId: folderId || null },
  });
  if (!updated.count) return { success: false, message: "Note not found." };
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
