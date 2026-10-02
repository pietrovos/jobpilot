import { jobIdFromPosting, jobIdFromUrl } from "@/lib/job-id";

export type ExtractJobState = {
  message: string;
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

  if (["linkedin.com", "www.linkedin.com"].includes(url.hostname) && url.pathname.includes("/jobs/search-results")) {
    const currentJobId = url.searchParams.get("currentJobId");

    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
    }
  }

  return jobUrl;
}

export function extractFromHtml(html: string, jobUrl: string) {
  const jsonLd = extractJsonLdJobPosting(html);
  const structuredTitle = stringValue(jsonLd?.title);
  const pageTitle = metaContent(html, "og:title") || tagText(html, "title");
  const title = structuredTitle || pageTitle;

  if (isBlockedOrLoginPage(title)) {
    return { ...emptyExtractJobState.values, jobUrl, jobId: jobIdFromUrl(jobUrl) };
  }

  const linkedInDetails = parseLinkedInTitle(pageTitle || title);
  const company =
    organizationName(jsonLd?.hiringOrganization) ||
    linkedInDetails.company ||
    usableSiteName(metaContent(html, "og:site_name")) ||
    companyFromTitle(title);
  const companyLogoUrl =
    organizationLogoUrl(jsonLd?.hiringOrganization, jobUrl) || companyLogoFromHtml(html, jobUrl, company);
  const location = jobLocation(jsonLd?.jobLocation) || linkedInDetails.location || linkedInLocation(html);
  const salary = salaryText(jsonLd?.baseSalary) || linkedInSalary(html);
  const postedAt = datePosted(jsonLd?.datePosted) || linkedInPostedAt(html);
  const description = linkedInDescription(html) || stringValue(jsonLd?.description) || metaContent(html, "description") || metaContent(html, "og:description");

  return {
    company: clean(company),
    role: clean(linkedInDetails.role || structuredTitle || roleFromTitle(title, company) || ""),
    location: clean(location),
    salary: clean(salary),
    jobUrl,
    jobId: jobIdFromUrl(jobUrl) || jobIdFromPosting(jsonLd?.identifier),
    companyLogoUrl,
    jobPostedAt: clean(postedAt),
    jobDescription: cleanDescription(description),
    notes: "",
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isBlockedOrLoginPage(title: string) {
  return /linkedin\s+login|sign\s+in|log\s+in/i.test(title);
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
  const normalized = title.replace(/\s+\|\s+LinkedIn(?:\s+Jobs)?\s*$/i, "").trim();
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

function formatPostedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function salaryText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const currency = typeof record.currency === "string" ? record.currency : "";
  const salaryValue = record.value;

  if (!salaryValue || typeof salaryValue !== "object") return "";

  const salaryRecord = salaryValue as Record<string, unknown>;
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

function clean(value: unknown) {
  return decodeHtml(String(value ?? ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(value: unknown) {
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
    .replace(/&#39;/g, "'");
}
