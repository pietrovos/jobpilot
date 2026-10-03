import type { ApplicationDetail } from "./application-types";
import { jobIdSource } from "@/lib/job-id";

export function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes("Files");
}

export function formatDateTime(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(date));
}

export function formatShortDate(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(date));
}

export function formatApplicationDay(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone }).format(new Date(date));
}

export function applicationDay(date: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(new Date(date));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatJobId(jobId: string | null, jobUrl: string | null) {
  if (!jobId) return "Not added";
  const source = jobUrl ? jobIdSource(jobUrl) : "";
  return source ? `${jobId} (${source})` : jobId;
}

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseDatetimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return {
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
      year: fallback.getFullYear(),
      hour: fallback.getHours(),
      minute: fallback.getMinutes(),
    };
  }

  return {
    month: date.getMonth() + 1,
    day: date.getDate(),
    year: date.getFullYear(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function to12Hour(hour: number) {
  const normalized = hour % 12;
  return { hour: normalized === 0 ? 12 : normalized };
}

export function to24Hour(hour: number, period: "AM" | "PM") {
  if (period === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function isPreviewableFile(file: ApplicationDetail["files"][number]) {
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.fileType);
}

export function formatExactDateTime(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

export function toDatetimeLocal(date: string) {
  const value = new Date(date);
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
