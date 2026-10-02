import "dotenv/config";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const demoJobDescription = [
  "About The Role",
  "Fictional Orchard Labs is hiring a senior frontend engineer to lead its customer dashboard. This posting is invented for the JobPilot demo.",
  "What You Will Do",
  "- Own the React and TypeScript dashboard from design review to release",
  "- Improve accessibility, performance budgets, and test coverage",
  "- Pair with backend engineers on API contracts",
  "Required Technical And Professional Expertise",
  "- 5+ years building production web applications",
  "- Strong TypeScript, testing, and browser debugging skills",
].join("\n\n");

async function main() {
  const url = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production" || process.env.SEED_DEMO !== "1" || !url?.startsWith("file:") || !path.isAbsolute(url.slice(5))) {
    throw new Error("Demo seed requires SEED_DEMO=1, a non-production environment, and an explicit absolute file: DATABASE_URL.");
  }
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.user.count()) throw new Error("Demo seed refuses a nonempty database. Use a new, migrated disposable database.");
      const date = new Date("2026-08-01T12:00:00Z");
      // Fixed salt is only for this public fictional fixture, never real accounts.
      const passwordHash = await bcrypt.hash("Demo-only-password-2026!", "$2b$10$abcdefghijklmnopqrstuu");
      await tx.user.create({ data: {
        id: "demo-pilot", name: "Alex Example", email: "alex@example.test", passwordHash, createdAt: date, updatedAt: date,
      } });
      const applications = [
        { company: "Fictional Orchard Labs", role: "Senior Frontend Engineer", status: "INTERVIEWING", location: "Remote, Canada", salary: "CAD 135k-155k", daysAgo: 3 },
        { company: "Fictional Lunar Maps", role: "Platform Engineer", status: "OFFER", location: "Toronto, ON", salary: "CAD 140k-160k", daysAgo: 6 },
        { company: "Fictional Paper Kite", role: "Full-Stack Developer", status: "APPLIED", location: "Montreal, QC", salary: "", daysAgo: 1 },
        { company: "Fictional Amber Studio", role: "Software Engineer, Payments", status: "REJECTED", location: "Remote", salary: "USD 120k-140k", daysAgo: 12 },
        { company: "Fictional Harbor Analytics", role: "Data Engineer", status: "APPLIED", location: "Vancouver, BC", salary: "CAD 120k-135k", daysAgo: 1 },
        { company: "Fictional Quiet Forest", role: "Backend Engineer (Go)", status: "INTERVIEWING", location: "Hybrid, Ottawa", salary: "", daysAgo: 8 },
        { company: "Fictional Signal Bakery", role: "Developer Experience Engineer", status: "APPLIED", location: "Remote", salary: "USD 130k-150k", daysAgo: 4 },
        { company: "Fictional Copper Robotics", role: "Embedded Software Engineer", status: "REJECTED", location: "Waterloo, ON", salary: "", daysAgo: 15 },
      ] as const;
      for (const [index, item] of applications.entries()) {
        const id = `demo-application-${index}`;
        const appliedAt = new Date(date.getTime() - item.daysAgo * 86400000);
        await tx.application.create({ data: {
          id, userId: "demo-pilot", company: item.company, role: item.role, status: item.status,
          location: item.location, salary: item.salary || null, jobUrl: `https://example.test/jobs/${index}`,
          notes: "Fictional demo record. Not a real employer or application.",
          jobDescription: index === 0 ? demoJobDescription : null,
          appliedAt, createdAt: appliedAt, updatedAt: date, sortOrder: index,
          statusChanges: { create: [
            { id: `${id}-applied`, status: "APPLIED", changedAt: appliedAt },
            ...(item.status === "APPLIED" ? [] : [{ id: `${id}-status`, status: item.status, changedAt: new Date(appliedAt.getTime() + 2 * 86400000) }]),
          ] },
        } });
      }
      await tx.applicationNote.create({ data: {
        id: "demo-note", applicationId: "demo-application-0", userId: "demo-pilot", title: "Prep for system design",
        body: "Review the fictional team's public design notes.\nPrepare a caching example and questions about on-call.",
        createdAt: date, updatedAt: date,
      } });
      await tx.applicationInterview.create({ data: {
        id: "demo-interview", applicationId: "demo-application-0", userId: "demo-pilot", title: "Technical round",
        interviewType: "System design", scheduledAt: new Date(date.getTime() + 2 * 86400000), createdAt: date,
        studyNotes: "Rate limiting, caching, and queue back-pressure.",
      } });
      await tx.applicationEmailLog.create({ data: {
        id: "demo-email", applicationId: "demo-application-0", userId: "demo-pilot", subject: "Next steps: technical round",
        direction: "RECEIVED", recipient: "recruiting@example.test", sentAt: new Date(date.getTime() - 86400000), createdAt: date,
      } });
    });
    console.log("Fictional demo created: alex@example.test / Demo-only-password-2026!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
