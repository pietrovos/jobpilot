-- CreateTable
CREATE TABLE "ApplicationEmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "recipient" TEXT,
    "sentAt" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationEmailLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationEmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationInterview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "interviewType" TEXT,
    "scheduledAt" DATETIME,
    "studyNotes" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationInterview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationOfferDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "compensation" TEXT,
    "startDate" TEXT,
    "deadline" TEXT,
    "benefits" TEXT,
    "equity" TEXT,
    "negotiables" TEXT,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationOfferDetails_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationOfferDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ApplicationEmailLog_applicationId_sentAt_idx" ON "ApplicationEmailLog"("applicationId", "sentAt");

-- CreateIndex
CREATE INDEX "ApplicationEmailLog_userId_sentAt_idx" ON "ApplicationEmailLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "ApplicationInterview_applicationId_scheduledAt_idx" ON "ApplicationInterview"("applicationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ApplicationInterview_userId_scheduledAt_idx" ON "ApplicationInterview"("userId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationOfferDetails_applicationId_key" ON "ApplicationOfferDetails"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationOfferDetails_userId_updatedAt_idx" ON "ApplicationOfferDetails"("userId", "updatedAt");
