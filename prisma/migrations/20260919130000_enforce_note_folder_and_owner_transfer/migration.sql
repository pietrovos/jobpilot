CREATE TRIGGER "application_note_folder_match_insert"
BEFORE INSERT ON "ApplicationNote"
WHEN NEW."folderId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "ApplicationNoteFolder"
  WHERE "id" = NEW."folderId" AND "applicationId" = NEW."applicationId" AND "userId" = NEW."userId"
)
BEGIN SELECT RAISE(ABORT, 'ApplicationNote folder must match note owner and application'); END;

CREATE TRIGGER "application_note_folder_match_update"
BEFORE UPDATE OF "folderId", "applicationId", "userId" ON "ApplicationNote"
WHEN NEW."folderId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "ApplicationNoteFolder"
  WHERE "id" = NEW."folderId" AND "applicationId" = NEW."applicationId" AND "userId" = NEW."userId"
)
BEGIN SELECT RAISE(ABORT, 'ApplicationNote folder must match note owner and application'); END;

-- Application ownership moves only occur during guest conversion. Keep all
-- denormalized child ownership values synchronized for that atomic transfer.
CREATE TRIGGER "application_owner_cascade"
AFTER UPDATE OF "userId" ON "Application"
WHEN OLD."userId" != NEW."userId"
BEGIN
  UPDATE "ApplicationNoteFolder" SET "userId" = NEW."userId" WHERE "applicationId" = NEW."id";
  UPDATE "ApplicationNote" SET "userId" = NEW."userId" WHERE "applicationId" = NEW."id";
  UPDATE "ApplicationEmailLog" SET "userId" = NEW."userId" WHERE "applicationId" = NEW."id";
  UPDATE "ApplicationInterview" SET "userId" = NEW."userId" WHERE "applicationId" = NEW."id";
  UPDATE "ApplicationOfferDetails" SET "userId" = NEW."userId" WHERE "applicationId" = NEW."id";
  UPDATE "ApplicationFile" SET "userId" = NEW."userId" WHERE "applicationId" = NEW."id";
END;
