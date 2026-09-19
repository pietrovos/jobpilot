import "dotenv/config";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

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
      const statuses = ["APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;
      const companies = ["Fictional Orchard Labs", "Fictional Lunar Maps", "Fictional Paper Kite", "Fictional Amber Studio"];
      for (const [index, status] of statuses.entries()) {
        const id = `demo-application-${index}`;
        await tx.application.create({ data: {
          id, userId: "demo-pilot", company: companies[index], role: "Software Engineer", status,
          location: "Remote", jobUrl: `https://example.test/jobs/${index}`, notes: "Fictional demo record. Not a real employer or application.",
          appliedAt: date, createdAt: date, updatedAt: date, sortOrder: index,
          statusChanges: { create: { id: `${id}-status`, status, changedAt: date } },
        } });
      }
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
