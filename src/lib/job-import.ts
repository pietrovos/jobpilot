import { jobIdFromPosting, jobIdFromUrl } from "@/lib/job-id";

export type ExtractJobState = {
  message: string;
  // Set when the site answered with a bot check or login wall instead of the posting.
  blocked?: boolean;
  // Set when the user already has an application with this job ID on this site.
  alreadySaved?: boolean;
  values: {
    company: string;
    role: string;
    location: string;
    salary: string;
    jobUrl: string;
    jobId: string;
    companyLogoUrl: string;
    jobPostedAt: string;
    jobDescription: string;
    notes: string;
  };
};

export const emptyExtractJobState: ExtractJobState = {
  message: "",
  values: {
    company: "",
    role: "",
    location: "",
    salary: "",
    jobUrl: "",
    jobId: "",
    companyLogoUrl: "",
    jobPostedAt: "",
    jobDescription: "",
    notes: "",
  },
};

export type JobValues = ExtractJobState["values"];

const MAX_DESCRIPTION_LENGTH = 12000;

// Earlier sources win; later ones only fill fields that are still empty.
export function mergeJobValues(...sources: Partial<JobValues>[]): JobValues {
  const merged = { ...emptyExtractJobState.values };
  for (const source of sources) {
    for (const key of Object.keys(merged) as (keyof JobValues)[]) {
      if (!merged[key] && source[key]) merged[key] = source[key]!;
    }
  }
  return merged;
}

export function failedExtract(jobUrl: string): ExtractJobState {
  return {
    ...emptyExtractJobState,
    message: "That site blocked autofill or did not expose job details. Fill the missing fields below.",
    values: {
      ...emptyExtractJobState.values,
      jobUrl,
      jobId: jobIdFromUrl(jobUrl),
    },
  };
}

export function normalizeJobUrl(jobUrl: string) {
  const url = new URL(jobUrl);

  // Search, collection and recommendation pages all point at the open posting with
  // currentJobId; the bookmarklet captures whichever one the user is browsing.
  if (["linkedin.com", "www.linkedin.com"].includes(url.hostname) && url.pathname.startsWith("/jobs/") && !url.pathname.startsWith("/jobs/view/")) {
    const currentJobId = url.searchParams.get("currentJobId");

    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
    }
  }

  return jobUrl;
}

export function extractFromHtml(html: string, jobUrl: string): JobValues {
  const jsonLd = extractJsonLdJobPosting(html);
  const structuredTitle = stringValue(jsonLd?.title);
  const pageTitle = metaContent(html, "og:title") || tagText(html, "title");
  const title = structuredTitle || pageTitle;

  if (isBlockedPage(html)) {
    return { ...emptyExtractJobState.values, jobUrl, jobId: jobIdFromUrl(jobUrl) };
  }

  const linkedInDetails = parseLinkedInTitle(pageTitle || title);
  const topCard = linkedInTopCard(html);
  const company =
    organizationName(jsonLd?.hiringOrganization) ||
    linkedInDetails.company ||
    topCard.company ||
    usableSiteName(metaContent(html, "og:site_name")) ||
    usableSiteName(companyFromTitle(title)) ||
    companyFromHost(jobUrl);
  const companyLogoUrl =
    organizationLogoUrl(jsonLd?.hiringOrganization, jobUrl) || companyLogoFromHtml(html, jobUrl, company);
  const location = jobLocation(jsonLd?.jobLocation) || remoteLocation(jsonLd) || linkedInDetails.location || linkedInLocation(html);
  const salary = salaryText(jsonLd?.baseSalary) || salaryText(firstItem(jsonLd?.estimatedSalary)) || linkedInSalary(html);
  const postedAt = datePosted(jsonLd?.datePosted) || linkedInPostedAt(html);
  const description = linkedInDescription(html) || stringValue(jsonLd?.description) || mainText(html) || metaContent(html, "description") || metaContent(html, "og:description");

  return {
    company: clean(company),
    role: withoutApplyPrefix(clean(linkedInDetails.role || structuredTitle || topCard.role || tagText(html, "h1") || roleFromTitle(title, company) || "")),
    location: clean(location),
    salary: clean(salary),
    jobUrl,
    jobId: jobIdFromUrl(jobUrl) || jobIdFromPosting(jsonLd?.identifier),
    companyLogoUrl,
    jobPostedAt: clean(postedAt),
    jobDescription: cleanDescription(description).slice(0, MAX_DESCRIPTION_LENGTH),
    notes: "",
  };
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

// Bot checks and login walls served in place of the posting.
export function isBlockedPage(html: string) {
  const title = metaContent(html, "og:title") || tagText(html, "title");
  return /linkedin\s+login|sign\s+in|log\s+in|authenticating|just a moment|attention required|access denied|verify you are human|security check|captcha/i.test(title);
}

function firstItem(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function remoteLocation(posting: Record<string, unknown> | null) {
  if (!posting) return "";
  const remote = String(posting.jobLocationType ?? "").toUpperCase() === "TELECOMMUTE";
  const requirement = firstItem(posting.applicantLocationRequirements);
  const area = requirement && typeof requirement === "object" ? stringValue((requirement as Record<string, unknown>).name) : "";
  return remote ? (area ? `Remote, ${area}` : "Remote") : "";
}

function withoutApplyPrefix(role: string) {
  return role.replace(/^(?:job application for|apply for|apply now:?)\s+/i, "");
}

function linkedInTopCard(html: string) {
  const role = html.match(/<h[12][^>]+class=["'][^"']*\btopcard__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ?? "";
  const company = html.match(/<a[^>]+class=["'][^"']*\btopcard__org-name-link\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "";
  return { role: clean(role), company: clean(company) };
}

const jobBoardSites = new Set(["linkedin", "indeed", "glassdoor", "ziprecruiter", "greenhouse", "lever", "ashbyhq", "workable", "smartrecruiters", "myworkdayjobs", "icims", "jobvite", "bamboohr"]);

// careers.acme.com and jobs.acme.co.uk both become "Acme"; job boards give nothing.
export function companyFromHost(jobUrl: string) {
  try {
    const labels = new URL(jobUrl).hostname.toLowerCase().split(".").filter((label) => !["www", "careers", "career", "jobs", "job", "apply", "boards"].includes(label));
    const tlds = labels.length >= 3 && ["co", "com", "org", "net", "ac"].includes(labels[labels.length - 2]) ? 2 : 1;
    const name = labels[labels.length - 1 - tlds] ?? "";
    if (!name || jobBoardSites.has(name)) return "";
    return name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  } catch {
    return "";
  }
}

// Text of the page's main content, for career pages without structured data.
function mainText(html: string) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? "";
  const text = cleanDescription(main.replace(/<(script|style|noscript|svg|nav|header|footer|form)\b[\s\S]*?<\/\1>/gi, " "));
  return text.length >= 200 ? text : "";
}

function extractJsonLdJobPosting(html: string): Record<string, unknown> | null {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const script of scripts) {
    try {
      const data = JSON.parse(decodeHtml(script[1] ?? ""));
      const posting = findJobPosting(data);
      if (posting) return posting;
    } catch {
      continue;
    }
  }

  return null;
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];

  if (types.some((item) => String(item).toLowerCase() === "jobposting")) {
    return record;
  }

  return findJobPosting(record["@graph"]);
}

function metaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(regex);
  return decodeHtml(match?.[1] ?? match?.[2] ?? "");
}

function tagText(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
  return decodeHtml(match?.[1] ?? "");
}

function roleFromTitle(title: string, company: string | undefined) {
  if (!title) return "";
  const parts = title.split(/\s[-|–—]\s/).map((item) => item.trim());
  return parts.find((part) => part && part !== company) ?? title;
}

function parseLinkedInTitle(title: string) {
  const onLinkedIn = /\s\|\s+LinkedIn(?:\s+Jobs)?\s*$/i.test(title);
  // Signed-in pages prefix the title with a notification count, e.g. "(3) ".
  const normalized = title.replace(/\s+\|\s+LinkedIn(?:\s+Jobs)?\s*$/i, "").replace(/^\(\d+\+?\)\s+/, "").trim();
  const hiringMatch = normalized.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+)$/i);

  if (hiringMatch) {
    return {
      company: hiringMatch[1]?.trim() ?? "",
      role: hiringMatch[2]?.trim() ?? "",
      location: hiringMatch[3]?.trim() ?? "",
    };
  }

  const atMatch = normalized.match(/^(.+?)\s+at\s+(.+?)(?:\s[-–—|]\s(.+))?$/i);

  if (atMatch) {
    return {
      company: atMatch[2]?.trim() ?? "",
      role: atMatch[1]?.trim() ?? "",
      location: atMatch[3]?.trim() ?? "",
    };
  }

  // Signed-in job pages use "Role | Company | LinkedIn".
  const pipeMatch = onLinkedIn ? normalized.match(/^(.+?)\s+\|\s+([^|]+)$/) : null;

  if (pipeMatch) {
    return { company: pipeMatch[2]?.trim() ?? "", role: pipeMatch[1]?.trim() ?? "", location: "" };
  }

  return { company: "", role: "", location: "" };
}

function usableSiteName(siteName: string) {
  const genericJobBoards = new Set(["linkedin", "indeed", "glassdoor", "ziprecruiter"]);
  const normalized = siteName.trim().toLowerCase();

  return normalized && !genericJobBoards.has(normalized) ? siteName : "";
}

function companyFromTitle(title: string) {
  if (!title) return "";
  const parts = title.split(/\s[-|–—]\s/).map((item) => item.trim());
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

function organizationName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" ? record.name : "";
}

function organizationLogoUrl(value: unknown, jobUrl: string) {
  if (!value || typeof value !== "object") return "";

  const logo = (value as Record<string, unknown>).logo;
  const logoUrl = typeof logo === "string"
    ? logo
    : logo && typeof logo === "object"
      ? stringValue((logo as Record<string, unknown>).url) || stringValue((logo as Record<string, unknown>).contentUrl)
      : "";

  try {
    const url = new URL(logoUrl, jobUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function companyLogoFromHtml(html: string, jobUrl: string, company: string) {
  const normalizedCompany = company.trim().toLowerCase();

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const source = imageAttribute(tag, "data-delayed-url") || imageAttribute(tag, "src");
    const alt = clean(imageAttribute(tag, "alt")).toLowerCase();
    const className = imageAttribute(tag, "class");

    if (!source || (alt !== normalizedCompany && !/company-logo/i.test(className))) continue;

    try {
      const url = new URL(source, jobUrl);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch {
      continue;
    }
  }

  return "";
}

function imageAttribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escapedName}=["']([^"']*)["']`, "i"));
  return decodeHtml(match?.[1] ?? "");
}

function jobLocation(value: unknown): string {
  const location = Array.isArray(value) ? value[0] : value;
  if (!location || typeof location !== "object") return "";

  const record = location as Record<string, unknown>;
  const address = record.address;
  if (!address || typeof address !== "object") return "";

  const addressRecord = address as Record<string, unknown>;
  return [addressRecord.addressLocality, addressRecord.addressRegion, addressRecord.addressCountry]
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .join(", ");
}

function linkedInLocation(html: string) {
  const match = html.match(
    /<span[^>]+class=["'][^"']*\btopcard__flavor--bullet\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );

  return clean(match?.[1] ?? "");
}

function linkedInSalary(html: string) {
  const match = html.match(
    /<div[^>]+class=["'][^"']*\bsalary\b[^"']*\bcompensation__salary\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );

  return clean(match?.[1] ?? "");
}

function linkedInPostedAt(html: string) {
  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i);
  if (timeMatch?.[1]) {
    return formatPostedDate(timeMatch[1]);
  }

  const postedTextMatch = html.match(
    /<span[^>]+class=["'][^"']*\bposted-time-ago__text\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );

  return clean(postedTextMatch?.[1] ?? "");
}

function datePosted(value: unknown) {
  return typeof value === "string" && value.length > 0 ? formatPostedDate(value) : "";
}

// Uses the calendar date the site wrote, so "2026-07-30" never shows as Jul 29
// on a server west of UTC.
export function formatPostedDate(value: string) {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = day ? new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function linkedInDescription(html: string) {
  const candidates = [
    ...html.matchAll(/<div[^>]+class=["'][^"']*\bshow-more-less-html__markup\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi),
    ...html.matchAll(/<div[^>]+class=["'][^"']*\bdescription__text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/section>/gi),
    ...html.matchAll(/<section[^>]+class=["'][^"']*\bdescription\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi),
  ]
    .map((match) => cleanDescription(match[1] ?? ""))
    .filter((item) => item.length > 180 && !/similar jobs on linkedin/i.test(item));

  return candidates.sort((left, right) => right.length - left.length)[0] ?? "";
}

export function salaryText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const currency = typeof record.currency === "string" ? record.currency : "";
  const salaryValue = record.value;
  // MonetaryAmountDistribution puts the range on the amount itself.
  const salaryRecord = salaryValue && typeof salaryValue === "object" ? salaryValue as Record<string, unknown> : record;
  const min = salaryRecord.minValue;
  const max = salaryRecord.maxValue;
  const unit = typeof salaryRecord.unitText === "string" ? salaryRecord.unitText.toLowerCase() : "";

  if (typeof min === "number" && typeof max === "number") {
    return `${currency} ${min}-${max}${unit ? ` / ${unit}` : ""}`.trim();
  }

  const singleValue = salaryRecord.value;
  if (typeof singleValue === "number") {
    return `${currency} ${singleValue}${unit ? ` / ${unit}` : ""}`.trim();
  }

  return "";
}

export function clean(value: unknown) {
  return decodeHtml(String(value ?? ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanDescription(value: unknown) {
  return decodeHtml(String(value ?? ""))
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(h[1-6])>/gi, "\n\n")
    .replace(/<\/(p|div|section|ul|ol)>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n(?=(?:Your Role And Responsibilities|About The Role|What You Will Do|Preferred Education|Required Technical And Professional Expertise|Preferred Technical And Professional Experience|Introduction)\b)/g, "\n\n")
    .replace(/([^\n])\n(- )/g, "$1\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d{1,7});/g, (entity, code: string) => codePoint(Number(code)) ?? entity)
    .replace(/&#x([0-9a-f]{1,6});/gi, (entity, code: string) => codePoint(Number.parseInt(code, 16)) ?? entity);
}

function codePoint(code: number) {
  return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : undefined;
}
