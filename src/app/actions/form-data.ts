import { z } from "zod";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { dateSchema, optionalDateSchema, passwordSchema, webUrlSchema } from "@/lib/backend-validation";

export const authSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
});

export const applicationSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  status: z.enum(ApplicationStatus).default("APPLIED"),
  location: z.string().trim().max(120).optional(),
  salary: z.string().trim().max(80).optional(),
  jobUrl: webUrlSchema.optional().or(z.literal("")),
  jobId: z.string().trim().max(120).optional(),
  companyLogoUrl: webUrlSchema.optional().or(z.literal("")),
  jobPostedAt: z.string().trim().max(120).optional(),
  jobDescription: z.string().trim().max(12000).optional(),
  notes: z.string().trim().max(1000).optional(),
  appliedAt: optionalDateSchema,
});

const applicationFieldLabels: Record<keyof z.infer<typeof applicationSchema>, string> = {
  company: "Company",
  role: "Role",
  status: "Status",
  location: "Location",
  salary: "Salary",
  jobUrl: "Job posting link",
  jobId: "Job ID",
  companyLogoUrl: "Company logo URL",
  jobPostedAt: "Posting date",
  jobDescription: "Job description",
  notes: "Notes",
  appliedAt: "Application date",
};

export function applicationValidationMessage(error: z.ZodError, formData: FormData) {
  const issue = error.issues[0];
  const field = issue?.path[0];
  if (typeof field !== "string" || !(field in applicationFieldLabels)) {
    return "Check the application fields and try again.";
  }

  const label = applicationFieldLabels[field as keyof typeof applicationFieldLabels];
  const entry = formData.get(field);
  const length = typeof entry === "string" ? entry.trim().length : 0;
  if (issue.code === "too_big" && issue.origin === "string") {
    return `${label} is too long (${length.toLocaleString("en-US")} characters; maximum ${issue.maximum.toLocaleString("en-US")}).`;
  }
  if (issue.code === "too_small" && issue.origin === "string") {
    return length === 0 ? `${label} is required.` : `${label} must be at least ${issue.minimum} characters.`;
  }
  if (field === "jobUrl" || field === "companyLogoUrl") return `${label} must be a valid HTTP or HTTPS URL.`;
  if (field === "appliedAt") return `${label} must be a valid date.`;
  if (field === "status") return "Choose a valid application status.";
  return `Check ${label.toLowerCase()} and try again.`;
}

export const emailLogSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  direction: z.enum(["RECEIVED", "SENT"]).default("RECEIVED"),
  recipient: z.string().trim().max(160).optional(),
  emailUrl: webUrlSchema.optional().or(z.literal("")),
  sentAt: dateSchema,
  notes: z.string().trim().max(1000).optional(),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(3000),
});

export const noteFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const interviewSchema = z.object({
  title: z.string().trim().min(1).max(120),
  interviewType: z.string().trim().max(120).optional(),
  scheduledAt: optionalDateSchema,
  studyNotes: z.string().trim().max(1500).optional(),
  notes: z.string().trim().max(1500).optional(),
});

export const offerDetailsSchema = z.object({
  compensation: z.string().trim().max(160).optional(),
  startDate: optionalDateSchema,
  deadline: optionalDateSchema,
  benefits: z.string().trim().max(1500).optional(),
  equity: z.string().trim().max(500).optional(),
  negotiables: z.string().trim().max(1500).optional(),
  notes: z.string().trim().max(1500).optional(),
});

export function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

export function nullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}
