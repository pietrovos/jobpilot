ALTER TABLE "Application" ADD COLUMN "deletedAt" DATETIME;
CREATE INDEX "Application_userId_deletedAt_idx" ON "Application"("userId", "deletedAt");
CREATE TABLE "RateLimit" ("key" TEXT NOT NULL PRIMARY KEY, "count" INTEGER NOT NULL, "expiresAt" BIGINT NOT NULL);
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
