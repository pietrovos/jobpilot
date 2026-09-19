-- AlterTable
ALTER TABLE "Application" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Application_userId_archivedAt_idx" ON "Application"("userId", "archivedAt");
