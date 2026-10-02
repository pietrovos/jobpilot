"use server";

import { revalidatePath } from "next/cache";
import { purgeDeletedApplications, trimDeletedApplications } from "@/lib/application-storage";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

export async function permanentlyDeleteApplication(deletedApplicationId: string) {
  const user = await requireUser();
  const count = await purgeDeletedApplications(user.id, [deletedApplicationId]);
  revalidatePath("/");
  return count
    ? { success: true, message: "Application permanently deleted." }
    : { success: false, message: "Deleted application not found." };
}

export async function permanentlyDeleteApplications(formData: FormData) {
  const user = await requireUser();
  const ids = [...new Set(formData.getAll("applicationIds").filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (ids.length === 0 || ids.length > 1100) {
    return { success: false, message: "Select between 1 and 1100 applications to delete." };
  }
  const count = await purgeDeletedApplications(user.id, ids);
  revalidatePath("/");
  return count
    ? { success: true, message: `${count} selected applications permanently deleted.` }
    : { success: false, message: "Selected deleted applications not found." };
}

export async function emptyRecycleBin() {
  const user = await requireUser();
  await purgeDeletedApplications(user.id);
  revalidatePath("/");
  return { success: true, message: "Recycle bin emptied." };
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
