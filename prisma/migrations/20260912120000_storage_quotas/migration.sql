-- SQLite triggers enforce insertion quotas atomically, including concurrent actions.
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

CREATE TRIGGER "ApplicationNote_quota" BEFORE INSERT ON "ApplicationNote"
BEGIN
  SELECT RAISE(ABORT, 'Note quota exceeded') WHERE (SELECT COUNT(*) FROM "ApplicationNote" WHERE "applicationId" = NEW."applicationId") >= 500;
END;
CREATE TRIGGER "ApplicationNoteFolder_quota" BEFORE INSERT ON "ApplicationNoteFolder"
BEGIN
  SELECT RAISE(ABORT, 'Folder quota exceeded') WHERE (SELECT COUNT(*) FROM "ApplicationNoteFolder" WHERE "applicationId" = NEW."applicationId") >= 100;
END;
CREATE TRIGGER "ApplicationEmailLog_quota" BEFORE INSERT ON "ApplicationEmailLog"
BEGIN
  SELECT RAISE(ABORT, 'Email log quota exceeded') WHERE (SELECT COUNT(*) FROM "ApplicationEmailLog" WHERE "applicationId" = NEW."applicationId") >= 500;
END;
CREATE TRIGGER "ApplicationInterview_quota" BEFORE INSERT ON "ApplicationInterview"
BEGIN
  SELECT RAISE(ABORT, 'Interview quota exceeded') WHERE (SELECT COUNT(*) FROM "ApplicationInterview" WHERE "applicationId" = NEW."applicationId") >= 100;
END;
