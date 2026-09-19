import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function temporaryDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), "jobpilot-test-"));
  const url = `file:${path.join(directory, "test.sqlite")}`;
  const env = { ...process.env, DATABASE_URL: url };
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return { url, env, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}
