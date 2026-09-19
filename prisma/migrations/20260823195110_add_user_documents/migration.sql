-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApplicationFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userDocumentId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationFile_userDocumentId_fkey" FOREIGN KEY ("userDocumentId") REFERENCES "UserDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApplicationFile" ("applicationId", "createdAt", "fileName", "fileSize", "fileType", "id", "storagePath", "userId") SELECT "applicationId", "createdAt", "fileName", "fileSize", "fileType", "id", "storagePath", "userId" FROM "ApplicationFile";
DROP TABLE "ApplicationFile";
ALTER TABLE "new_ApplicationFile" RENAME TO "ApplicationFile";
CREATE INDEX "ApplicationFile_userId_createdAt_idx" ON "ApplicationFile"("userId", "createdAt");
CREATE INDEX "ApplicationFile_applicationId_createdAt_idx" ON "ApplicationFile"("applicationId", "createdAt");
CREATE INDEX "ApplicationFile_userDocumentId_idx" ON "ApplicationFile"("userDocumentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserDocument_userId_createdAt_idx" ON "UserDocument"("userId", "createdAt");
