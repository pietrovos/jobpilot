import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { test } from "node:test";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { temporaryDatabase } from "./helpers/database";
import { transferGuestOwnership } from "../src/lib/guest-transfer";

test("fresh migrations support ownership queries, uniqueness, and cascading deletion", async () => {
  const db = temporaryDatabase();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  try {
    const user = await prisma.user.create({ data: { name: "Test Pilot", email: "pilot@example.test", passwordHash: "not-a-login" } });
    await assert.rejects(prisma.user.create({ data: { name: "Duplicate", email: user.email, passwordHash: "unused" } }), { code: "P2002" });
    const application = await prisma.application.create({ data: {
      userId: user.id, company: "Fictional Observatory", role: "Engineer",
      statusChanges: { create: { status: "APPLIED" } },
      emailLogs: { create: { userId: user.id, subject: "Hello", sentAt: new Date("2026-01-01T12:00:00Z") } },
    }, include: { emailLogs: true } });
    assert.equal(application.emailLogs[0].direction, "RECEIVED");
    assert.equal(application.companyLogoPath, null);
    assert.equal(await prisma.application.count({ where: { userId: "another-user" } }), 0);
    await prisma.session.create({ data: { userId: user.id, tokenHash: "fixture-hash", expiresAt: new Date("2030-01-01") } });
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal(await prisma.application.count(), 0);
    assert.equal(await prisma.statusChange.count(), 0);
    assert.equal(await prisma.applicationEmailLog.count(), 0);
    assert.equal(await prisma.session.count(), 0);
    // Deploy is safe to repeat and must not reset an already migrated database.
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: db.env, stdio: "pipe" });
  } finally {
    await prisma.$disconnect();
    db.cleanup();
  }
});

test("demo seed requires consent and refuses to overwrite existing data", async () => {
  const db = temporaryDatabase();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  const run = (consent: string) => spawnSync(process.execPath, ["--import", "tsx", "scripts/seed-demo.ts"], {
    env: { ...db.env, NODE_ENV: "test", SEED_DEMO: consent }, encoding: "utf8",
  });
  try {
    assert.notEqual(run("").status, 0);
    const seeded = run("1");
    assert.equal(seeded.status, 0, seeded.stderr);
    assert.equal(await prisma.user.count(), 1);
    assert.equal(await prisma.application.count(), 4);
    assert.notEqual(run("1").status, 0);
    assert.equal(await prisma.application.count(), 4);
  } finally {
    await prisma.$disconnect();
    db.cleanup();
  }
});

test("guest transfer and soft deletion preserve notes, folders and history", async () => {
  const db = temporaryDatabase();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  try {
    const guest = await prisma.user.create({ data: { name: "Guest", email: "guest@example.test", passwordHash: "unused", isGuest: true } });
    const account = await prisma.user.create({ data: { name: "Account", email: "account@example.test", passwordHash: "unused" } });
    const app = await prisma.application.create({ data: { userId: guest.id, company: "Fictional Co", role: "Engineer", statusChanges: { create: { status: "APPLIED" } } } });
    const folder = await prisma.applicationNoteFolder.create({ data: { userId: guest.id, applicationId: app.id, name: "Research" } });
    const note = await prisma.applicationNote.create({ data: { userId: guest.id, applicationId: app.id, folderId: folder.id, title: "Questions", body: "Ask about testing" } });
    await prisma.$transaction((tx) => transferGuestOwnership(tx, guest.id, account.id));
    assert.equal(await prisma.user.findUnique({ where: { id: guest.id } }), null);
    assert.equal((await prisma.applicationNote.findUniqueOrThrow({ where: { id: note.id } })).userId, account.id);
    assert.equal((await prisma.applicationNoteFolder.findUniqueOrThrow({ where: { id: folder.id } })).userId, account.id);
    await prisma.application.update({ where: { id: app.id }, data: { deletedAt: new Date() } });
    assert.equal(await prisma.application.count({ where: { userId: account.id, deletedAt: null } }), 0);
    await prisma.application.update({ where: { id: app.id }, data: { deletedAt: null } });
    assert.equal(await prisma.applicationNote.count({ where: { applicationId: app.id } }), 1);
    assert.equal(await prisma.statusChange.count({ where: { applicationId: app.id } }), 1);
  } finally {
    await prisma.$disconnect();
    db.cleanup();
  }
});

test("SQLite insertion quotas reject oversized guest storage and excess applications", async () => {
  const db = temporaryDatabase();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  try {
    const user = await prisma.user.create({ data: { name: "Limited Guest", email: "limited@example.test", passwordHash: "unused", isGuest: true } });
    await assert.rejects(prisma.userDocument.create({ data: { userId: user.id, fileName: "fixture.pdf", fileType: "application/pdf", fileSize: 51 * 1024 * 1024, storagePath: "not-a-real-file" } }));
    await prisma.application.createMany({ data: Array.from({ length: 50 }, (_, index) => ({ userId: user.id, company: `Fictional ${index}`, role: "Engineer" })) });
    await assert.rejects(prisma.application.create({ data: { userId: user.id, company: "Over quota", role: "Engineer" } }));
    assert.equal(await prisma.application.count(), 50);
    assert.equal(await prisma.userDocument.count(), 0);
  } finally {
    await prisma.$disconnect();
    db.cleanup();
  }
});

test("SQLite enforces application ownership across every child record", async () => {
  const db = temporaryDatabase();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  try {
    const [owner, other] = await Promise.all([
      prisma.user.create({ data: { name: "Owner", email: "owner@example.test", passwordHash: "unused" } }),
      prisma.user.create({ data: { name: "Other", email: "other@example.test", passwordHash: "unused" } }),
    ]);
    const application = await prisma.application.create({ data: { userId: owner.id, company: "Fictional Co", role: "Engineer" } });
    const document = await prisma.userDocument.create({ data: {
      userId: owner.id, fileName: "resume.txt", fileType: "text/plain", fileSize: 10, storagePath: "owner/resume.txt",
    } });
    const folder = await prisma.applicationNoteFolder.create({ data: { applicationId: application.id, userId: owner.id, name: "Owner folder" } });

    await assert.rejects(prisma.applicationNote.create({ data: {
      applicationId: application.id, userId: other.id, title: "Cross-account", body: "Must fail",
    } }));
    await assert.rejects(prisma.applicationNoteFolder.create({ data: { applicationId: application.id, userId: other.id, name: "Cross-account" } }));
    await assert.rejects(prisma.applicationEmailLog.create({ data: {
      applicationId: application.id, userId: other.id, subject: "Cross-account", sentAt: new Date(),
    } }));
    await assert.rejects(prisma.applicationInterview.create({ data: { applicationId: application.id, userId: other.id, title: "Cross-account" } }));
    await assert.rejects(prisma.applicationOfferDetails.create({ data: { applicationId: application.id, userId: other.id } }));
    await assert.rejects(prisma.applicationFile.create({ data: {
      applicationId: application.id, userId: other.id, userDocumentId: document.id,
      fileName: "resume.txt", fileType: "text/plain", fileSize: 10, storagePath: "other/resume.txt",
    } }));
    const otherApplication = await prisma.application.create({ data: { userId: other.id, company: "Other Co", role: "Engineer" } });
    const otherFolder = await prisma.applicationNoteFolder.create({ data: { applicationId: otherApplication.id, userId: other.id, name: "Other folder" } });
    await assert.rejects(prisma.applicationNote.create({ data: {
      applicationId: application.id, userId: owner.id, folderId: otherFolder.id, title: "Wrong folder", body: "Must fail",
    } }));

    const note = await prisma.applicationNote.create({ data: { applicationId: application.id, userId: owner.id, folderId: folder.id, title: "Owned", body: "Safe" } });
    const email = await prisma.applicationEmailLog.create({ data: { applicationId: application.id, userId: owner.id, subject: "Owned", sentAt: new Date() } });
    const interview = await prisma.applicationInterview.create({ data: { applicationId: application.id, userId: owner.id, title: "Owned" } });
    const offer = await prisma.applicationOfferDetails.create({ data: { applicationId: application.id, userId: owner.id } });
    const file = await prisma.applicationFile.create({ data: {
      applicationId: application.id, userId: owner.id, fileName: "owned.txt", fileType: "text/plain", fileSize: 10, storagePath: "owner/owned.txt",
    } });
    await prisma.userDocument.update({ where: { id: document.id }, data: { userId: other.id } });
    await prisma.application.update({ where: { id: application.id }, data: { userId: other.id } });

    for (const model of [
      prisma.applicationNote.findUniqueOrThrow({ where: { id: note.id } }),
      prisma.applicationNoteFolder.findUniqueOrThrow({ where: { id: folder.id } }),
      prisma.applicationEmailLog.findUniqueOrThrow({ where: { id: email.id } }),
      prisma.applicationInterview.findUniqueOrThrow({ where: { id: interview.id } }),
      prisma.applicationOfferDetails.findUniqueOrThrow({ where: { id: offer.id } }),
      prisma.applicationFile.findUniqueOrThrow({ where: { id: file.id } }),
    ]) assert.equal((await model).userId, other.id);

    await assert.equal(await prisma.applicationNote.count(), 1);
    await assert.equal(await prisma.applicationFile.count(), 1);
  } finally {
    await prisma.$disconnect();
    db.cleanup();
  }
});
