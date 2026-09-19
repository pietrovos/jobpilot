import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { withUploadBatch } from "../src/lib/upload-batch";

test("upload batches stage all files before committing and retain successful bytes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "jobpilot-batch-"));
  try {
    const result = await withUploadBatch(root, "user", [new File(["one"], "one.txt"), new File(["two"], "two.txt")], async (uploads) => {
      assert.equal(uploads.length, 2);
      assert.equal(await readFile(path.join(root, uploads[0].storagePath), "utf8"), "one");
      return "committed";
    });
    assert.equal(result, "committed");
    assert.equal((await readdir(path.join(root, "user"))).length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("metadata failure rolls back every staged file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "jobpilot-batch-"));
  try {
    await assert.rejects(withUploadBatch(root, "user", [new File(["one"], "one.txt"), new File(["two"], "two.txt")], async () => {
      throw new Error("Database unavailable");
    }), /Database unavailable/);
    assert.deepEqual(await readdir(path.join(root, "user")), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("later invalid file removes earlier staging and never commits metadata", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "jobpilot-batch-"));
  try {
    let committed = false;
    await assert.rejects(withUploadBatch(root, "user", [new File(["one"], "one.txt"), new File(["<script>"], "unsafe.html")], async () => { committed = true; }));
    assert.equal(committed, false);
    assert.deepEqual(await readdir(path.join(root, "user")), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
