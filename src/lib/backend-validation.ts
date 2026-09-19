import { z } from "zod";

export const passwordSchema = z.string().min(8).max(128).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "Password must be at most 72 UTF-8 bytes",
);

export const webUrlSchema = z.string().trim().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an HTTP or HTTPS URL without credentials");

export const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 2200 && calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day && Number.isFinite(new Date(value).getTime());
}, "Use a valid ISO date or date-time");

export const optionalDateSchema = dateSchema.or(z.literal("")).optional();
