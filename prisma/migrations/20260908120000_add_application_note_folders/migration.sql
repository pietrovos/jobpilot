-- CreateTable
CREATE TABLE "ApplicationNoteFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationNoteFolder_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationNoteFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApplicationNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "folderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationNote_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ApplicationNoteFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApplicationNote" ("applicationId", "body", "createdAt", "id", "title", "updatedAt", "userId") SELECT "applicationId", "body", "createdAt", "id", "title", "updatedAt", "userId" FROM "ApplicationNote";
DROP TABLE "ApplicationNote";
ALTER TABLE "new_ApplicationNote" RENAME TO "ApplicationNote";
CREATE INDEX "ApplicationNote_applicationId_createdAt_idx" ON "ApplicationNote"("applicationId", "createdAt");
CREATE INDEX "ApplicationNote_userId_createdAt_idx" ON "ApplicationNote"("userId", "createdAt");
CREATE INDEX "ApplicationNote_folderId_idx" ON "ApplicationNote"("folderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ApplicationNoteFolder_applicationId_name_idx" ON "ApplicationNoteFolder"("applicationId", "name");

-- CreateIndex
CREATE INDEX "ApplicationNoteFolder_userId_createdAt_idx" ON "ApplicationNoteFolder"("userId", "createdAt");
