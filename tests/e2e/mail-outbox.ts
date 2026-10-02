import { readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// The browser-test server writes outgoing mail here instead of using SMTP.
export const mailOutbox = path.join(tmpdir(), "jobpilot-e2e-mail-outbox");

export async function latestMailTo(address: string) {
  const names = (await readdir(mailOutbox).catch(() => [])).sort().reverse();
  for (const name of names) {
    const message = JSON.parse(await readFile(path.join(mailOutbox, name), "utf8")) as { to: string; subject: string; text: string };
    if (message.to === address) return message;
  }
  return null;
}
