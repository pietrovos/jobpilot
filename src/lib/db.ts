import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

const prismaSchemaVersion = "lossless-soft-delete";

if (
  globalForPrisma.prisma &&
  (globalForPrisma.prismaSchemaVersion !== prismaSchemaVersion ||
    !("userDocument" in globalForPrisma.prisma) ||
    !("applicationFile" in globalForPrisma.prisma) ||
     !("applicationEmailLog" in globalForPrisma.prisma) ||
     !("applicationNote" in globalForPrisma.prisma) ||
     !("applicationNoteFolder" in globalForPrisma.prisma) ||
    !("applicationInterview" in globalForPrisma.prisma) ||
    !("applicationOfferDetails" in globalForPrisma.prisma))
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = prismaSchemaVersion;
}
