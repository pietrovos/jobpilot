import "dotenv/config";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

if (!process.env.DATABASE_URL?.startsWith("file:/")) throw new Error("Set an absolute DATABASE_URL before cleanup");
const apply = process.argv.includes("--apply");
if (apply && process.env.MAINTENANCE_MODE !== "1") throw new Error("Stop the application and set MAINTENANCE_MODE=1 before applying cleanup");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL }) });
const now = new Date();
const dayAgo = new Date(now.getTime() - 86400000);
const cutoff = new Date(now.getTime() - 30 * 86400000);

try {
  const guests = { isGuest: true, createdAt: { lt: dayAgo }, sessions: { none: { expiresAt: { gt: now } } } };
  const expired = { deletedAt: { lte: cutoff } };
  console.info(JSON.stringify({ event: "cleanup", apply, expiredSessions: await prisma.session.count({ where: { expiresAt: { lte: now } } }), abandonedGuests: await prisma.user.count({ where: guests }), expiredApplications: await prisma.application.count({ where: expired }) }));
  if (apply) {
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.user.deleteMany({ where: guests }),
      prisma.application.deleteMany({ where: expired }),
      prisma.deletedApplication.deleteMany({ where: expired }),
    ]);
  }
  const refs = new Map<string, Set<string>>([
    ["application-files", new Set((await prisma.applicationFile.findMany({ where: { userDocumentId: null }, select: { storagePath: true } })).map((file) => file.storagePath))],
    ["documents", new Set((await prisma.userDocument.findMany({ select: { storagePath: true } })).map((file) => file.storagePath))],
    ["profile-pictures", new Set((await prisma.user.findMany({ select: { profileImagePath: true } })).flatMap((user) => user.profileImagePath ? [user.profileImagePath] : []))],
    ["company-logos", new Set([
      ...(await prisma.application.findMany({ select: { companyLogoPath: true } })),
      ...(await prisma.deletedApplication.findMany({ select: { companyLogoPath: true } })),
    ].flatMap((app) => app.companyLogoPath ? [app.companyLogoPath] : []))],
  ]);
  let orphanFiles = 0;
  for (const [kind, referenced] of refs) {
    const root = path.join(process.cwd(), "uploads", kind);
    const visit = async (relative = "") => {
      const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      for (const entry of entries) {
        const key = path.join(relative, entry.name);
        if (entry.isDirectory()) await visit(key);
        else if (entry.isFile() && !referenced.has(key) && (await stat(path.join(root, key))).mtime < dayAgo) {
          orphanFiles++;
          if (apply) await unlink(path.join(root, key));
        }
      }
    };
    await visit();
  }
  console.info(JSON.stringify({ event: "cleanup-files", apply, orphanFiles }));
} finally {
  await prisma.$disconnect();
}
