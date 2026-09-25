-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
-- SQLite rewrites the table by inserting every row into "new_User" before the
-- old table is dropped. The quota triggers below read from "User", so they
-- would abort the rebuild (or silently skip their checks while it is absent).
-- Drop and restore them around the table swap.
DROP TRIGGER "Application_quota";
DROP TRIGGER "UserDocument_quota";
DROP TRIGGER "ApplicationFile_quota";
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "profileImagePath" TEXT,
    "profileImageType" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isGuest", "name", "passwordHash", "profileImagePath", "profileImageType", "updatedAt") SELECT "createdAt", "email", "id", "isGuest", "name", "passwordHash", "profileImagePath", "profileImageType", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE TRIGGER "Application_quota" BEFORE INSERT ON "Application"
BEGIN
  SELECT RAISE(ABORT, 'Application quota exceeded')
  WHERE (SELECT COUNT(*) FROM "Application" WHERE "userId" = NEW."userId") >=
    (SELECT CASE WHEN "isGuest" THEN 50 ELSE 1000 END FROM "User" WHERE "id" = NEW."userId");
END;

CREATE TRIGGER "UserDocument_quota" BEFORE INSERT ON "UserDocument"
BEGIN
  SELECT RAISE(ABORT, 'Document storage quota exceeded')
  WHERE NEW."fileSize" +
    COALESCE((SELECT SUM("fileSize") FROM "UserDocument" WHERE "userId" = NEW."userId"), 0) +
    COALESCE((SELECT SUM("fileSize") FROM "ApplicationFile" WHERE "userId" = NEW."userId" AND "userDocumentId" IS NULL), 0) >
    (SELECT CASE WHEN "isGuest" THEN 52428800 ELSE 524288000 END FROM "User" WHERE "id" = NEW."userId")
  OR (SELECT COUNT(*) FROM "UserDocument" WHERE "userId" = NEW."userId") >= 500;
END;

CREATE TRIGGER "ApplicationFile_quota" BEFORE INSERT ON "ApplicationFile"
BEGIN
  SELECT RAISE(ABORT, 'Attachment storage quota exceeded')
  WHERE (NEW."userDocumentId" IS NULL AND NEW."fileSize" +
    COALESCE((SELECT SUM("fileSize") FROM "UserDocument" WHERE "userId" = NEW."userId"), 0) +
    COALESCE((SELECT SUM("fileSize") FROM "ApplicationFile" WHERE "userId" = NEW."userId" AND "userDocumentId" IS NULL), 0) >
    (SELECT CASE WHEN "isGuest" THEN 52428800 ELSE 524288000 END FROM "User" WHERE "id" = NEW."userId"))
  OR (SELECT COUNT(*) FROM "ApplicationFile" WHERE "applicationId" = NEW."applicationId") >= 100;
END;

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
