import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

export type MailMessage = { to: string; subject: string; text: string };

// Mail is configured by SMTP_URL (for example smtps://user:pass@smtp.example.com:465)
// or, for local development and browser tests, MAIL_OUTBOX, a directory that
// receives one JSON file per message. Production needs MAIL_FROM as well.
export function mailConfigured() {
  return Boolean((process.env.SMTP_URL && process.env.MAIL_FROM) || process.env.MAIL_OUTBOX);
}

export async function sendMail(message: MailMessage) {
  const outbox = process.env.MAIL_OUTBOX;
  if (outbox) {
    await mkdir(outbox, { recursive: true });
    await writeFile(path.join(outbox, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(message));
    return;
  }
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) throw new Error("Mail is not configured");
  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.MAIL_FROM, ...message });
}
