import { ApplicationStatus } from "@/generated/prisma/enums";

export type ApplicationSummary = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  location: string | null;
  salary: string | null;
  jobUrl: string | null;
  companyLogoPath: string | null;
  notes: string | null;
  appliedAt: string;
};

export type ApplicationDetail = ApplicationSummary & {
  jobPostedAt: string | null;
  jobDescription: string | null;
  createdAt: string;
  updatedAt: string;
  statusChanges: Array<{
    id: string;
    status: ApplicationStatus;
    changedAt: string;
  }>;
  files: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    createdAt: string;
  }>;
  emailLogs: Array<{
    id: string;
    subject: string;
    direction: "RECEIVED" | "SENT";
    recipient: string | null;
    emailUrl: string | null;
    sentAt: string;
    notes: string | null;
  }>;
  noteEntries: Array<{
    id: string;
    title: string;
    body: string;
    folderId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  noteFolders: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>;
  interviews: Array<{
    id: string;
    title: string;
    interviewType: string | null;
    scheduledAt: string | null;
    studyNotes: string | null;
    notes: string | null;
  }>;
  offerDetails: {
    compensation: string | null;
    startDate: string | null;
    deadline: string | null;
    benefits: string | null;
    equity: string | null;
    negotiables: string | null;
    notes: string | null;
  } | null;
};
