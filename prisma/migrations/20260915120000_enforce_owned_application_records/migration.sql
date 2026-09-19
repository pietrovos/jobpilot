-- The application children intentionally duplicate userId for efficient scoped queries.
-- Keep that denormalized value consistent with its owning record in SQLite as well.
CREATE TRIGGER "application_note_owner_insert"
BEFORE INSERT ON "ApplicationNote"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationNote owner must match application owner'); END;

CREATE TRIGGER "application_note_owner_update"
BEFORE UPDATE OF "userId", "applicationId" ON "ApplicationNote"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationNote owner must match application owner'); END;

CREATE TRIGGER "application_note_folder_owner_insert"
BEFORE INSERT ON "ApplicationNoteFolder"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationNoteFolder owner must match application owner'); END;

CREATE TRIGGER "application_note_folder_owner_update"
BEFORE UPDATE OF "userId", "applicationId" ON "ApplicationNoteFolder"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationNoteFolder owner must match application owner'); END;

CREATE TRIGGER "application_email_owner_insert"
BEFORE INSERT ON "ApplicationEmailLog"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationEmailLog owner must match application owner'); END;

CREATE TRIGGER "application_email_owner_update"
BEFORE UPDATE OF "userId", "applicationId" ON "ApplicationEmailLog"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationEmailLog owner must match application owner'); END;

CREATE TRIGGER "application_interview_owner_insert"
BEFORE INSERT ON "ApplicationInterview"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationInterview owner must match application owner'); END;

CREATE TRIGGER "application_interview_owner_update"
BEFORE UPDATE OF "userId", "applicationId" ON "ApplicationInterview"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationInterview owner must match application owner'); END;

CREATE TRIGGER "application_offer_owner_insert"
BEFORE INSERT ON "ApplicationOfferDetails"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationOfferDetails owner must match application owner'); END;

CREATE TRIGGER "application_offer_owner_update"
BEFORE UPDATE OF "userId", "applicationId" ON "ApplicationOfferDetails"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
BEGIN SELECT RAISE(ABORT, 'ApplicationOfferDetails owner must match application owner'); END;

CREATE TRIGGER "application_file_owner_insert"
BEFORE INSERT ON "ApplicationFile"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
  OR (NEW."userDocumentId" IS NOT NULL AND NEW."userId" != (SELECT "userId" FROM "UserDocument" WHERE "id" = NEW."userDocumentId"))
BEGIN SELECT RAISE(ABORT, 'ApplicationFile owner must match related records'); END;

CREATE TRIGGER "application_file_owner_update"
BEFORE UPDATE OF "userId", "applicationId", "userDocumentId" ON "ApplicationFile"
WHEN NEW."userId" != (SELECT "userId" FROM "Application" WHERE "id" = NEW."applicationId")
  OR (NEW."userDocumentId" IS NOT NULL AND NEW."userId" != (SELECT "userId" FROM "UserDocument" WHERE "id" = NEW."userDocumentId"))
BEGIN SELECT RAISE(ABORT, 'ApplicationFile owner must match related records'); END;
