import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { jobIdFromUrl } from "../src/lib/job-id";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });

async function main() {
  try {
    const applications = await prisma.application.findMany({
      where: { OR: [{ jobId: null }, { jobId: "" }], jobUrl: { not: null } },
      select: { id: true, jobId: true, jobUrl: true },
    });
    let updated = 0;

    for (const application of applications) {
      const jobId = jobIdFromUrl(application.jobUrl ?? "");
      if (!jobId) continue;
      const result = await prisma.application.updateMany({
        where: { id: application.id, jobId: application.jobId },
        data: { jobId },
      });
      updated += result.count;
    }

    console.info(`Filled ${updated} job IDs from saved application links.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
