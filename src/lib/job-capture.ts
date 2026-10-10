import { z } from "zod";
import { webUrlSchema } from "./backend-validation";
import { clean, extractFromHtml, mergeJobValues, normalizeJobUrl, type JobValues } from "./job-import";

// What the Save to JobPilot bookmarklet sends from the user's own browser. It is
// as untrusted as anything typed into the form, so every field is bounded.
export const capturedPostingSchema = z.object({
  v: z.literal(1),
  url: webUrlSchema.refine((url) => url.startsWith("https://"), "HTTPS only"),
  title: z.string().max(300),
  h1: z.string().max(300),
  company: z.string().max(200),
  location: z.string().max(200),
  description: z.string().max(20000),
  meta: z.record(z.string().max(100), z.string().max(1000)).refine((meta) => Object.keys(meta).length <= 40, "Too many meta tags"),
  ld: z.array(z.string().max(20000)).max(3),
});

export type CapturedPosting = z.infer<typeof capturedPostingSchema>;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// innerText is plain text, so "<5 years" must survive; only tidy the lines.
function plainText(value: string) {
  return value.replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Government career sites name the employer awkwardly or not at all.
const SITE_EMPLOYERS: Record<string, { company: string; location?: string }> = {
  // Its microdata says "CityofOttawa".
  "jobs-emplois.ottawa.ca": { company: "City of Ottawa" },
  // Bilingual: "Canada Post - Postes Canada".
  "jobs.canadapost.ca": { company: "Canada Post" },
  // Every CSE job is in Ottawa, and its pages name neither.
  "careers.cse-cst.gc.ca": { company: "Communications Security Establishment (CSE)", location: "Ottawa, ON" },
};

function employerName(company: string, host: string) {
  // Job Bank: "Export Development Canada | Exportation et développement Canada".
  if (host === "www.jobbank.gc.ca") return company.split(" | ")[0];
  // GC Jobs: "Department - Branch - Division"; the department is the employer.
  if (host === "emploisfp-psjobs.cfp-psc.gc.ca") return company.split(" - ")[0] || "Government of Canada";
  return company;
}

export function capturedPostingValues(posting: CapturedPosting): JobValues {
  const values = capturedPageValues(posting);
  const host = new URL(values.jobUrl).hostname;
  const site = SITE_EMPLOYERS[host];
  return {
    ...values,
    company: site?.company ?? employerName(values.company, host),
    location: values.location || site?.location || "",
    jobDescription: host === "emploisfp-psjobs.cfp-psc.gc.ca" ? withoutPageMenu(values.jobDescription) : values.jobDescription,
  };
}

// GC Jobs postings open with an "On this page" list of their own section headings;
// the posting itself starts where the first of those headings appears again.
function withoutPageMenu(description: string) {
  const lines = description.split("\n");
  if (lines[0] !== "On this page" || !lines[1]) return description;
  const start = lines.indexOf(lines[1], 2);
  return start > 0 ? lines.slice(start).join("\n") : description;
}

function capturedPageValues(posting: CapturedPosting): JobValues {
  const jobUrl = normalizeJobUrl(posting.url);
  // Rebuild a minimal page from the captured head so the regular extractor reads it.
  const html = [
    `<title>${escapeHtml(posting.title)}</title>`,
    ...Object.entries(posting.meta).map(([name, content]) => `<meta property="${escapeHtml(name)}" content="${escapeHtml(content)}">`),
    ...posting.ld.map((json) => `<script type="application/ld+json">${json.replace(/<\/script/gi, "<\\/script")}</script>`),
    `<h1>${escapeHtml(posting.h1)}</h1>`,
  ].join("\n");
  const fromPage = extractFromHtml(html, jobUrl);
  // Fields read from the site's own layout are more reliable than titles, but
  // structured data, when the page has it, is more reliable than both.
  const fromLayout = {
    company: clean(posting.company),
    // LinkedIn shows "Kanata, ON · 6 days ago · 40 applicants"; keep the place.
    location: clean(posting.location.split(/\s+[·•]\s+/)[0] ?? ""),
    jobDescription: plainText(posting.description).slice(0, 12000),
  };
  return { ...mergeJobValues(posting.ld.length > 0 ? fromPage : {}, fromLayout, fromPage), jobUrl };
}
