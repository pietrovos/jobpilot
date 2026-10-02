import { clean, cleanDescription, extractFromHtml, formatPostedDate, stringValue, type JobValues } from "./job-import";

// Some job sites publish postings through a public JSON API that carries more than
// their HTML pages (or serve HTML only to browsers). Each source turns a recognised
// job URL into partial values; extractJobPost fills the rest from the page itself.

export type SourceIO = {
  json: (url: string) => Promise<unknown>;
  html: (url: string) => Promise<string>;
};

export type JobSource = {
  provider: string;
  load: (io: SourceIO) => Promise<Partial<JobValues>>;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function joinParts(...parts: unknown[]) {
  return parts.map((part) => clean(part)).filter(Boolean).join(", ");
}

function postedDate(value: unknown) {
  if (typeof value === "number") return formatPostedDate(new Date(value).toISOString());
  return typeof value === "string" && value ? formatPostedDate(value) : "";
}

function description(...htmlParts: unknown[]) {
  return cleanDescription(htmlParts.map((part) => stringValue(part)).filter(Boolean).join("</div><div>")).slice(0, 12000);
}

function money(currency: unknown, min: unknown, max: unknown, unit: string) {
  if (typeof min !== "number" || typeof max !== "number") return "";
  return `${stringValue(currency)} ${min}-${max}${unit ? ` / ${unit}` : ""}`.trim();
}

export function greenhouseValues(job: unknown): Partial<JobValues> {
  const data = record(job);
  const pay = record(list(data.pay_input_ranges)[0]);
  return {
    company: clean(data.company_name),
    role: clean(data.title),
    location: clean(record(data.location).name),
    jobId: clean(data.id),
    salary: money(pay.currency_type, typeof pay.min_cents === "number" ? pay.min_cents / 100 : undefined, typeof pay.max_cents === "number" ? pay.max_cents / 100 : undefined, ""),
    jobPostedAt: postedDate(data.first_published),
    // Greenhouse returns the posting body as entity-encoded HTML.
    jobDescription: description(data.content),
  };
}

export function leverValues(posting: unknown): Partial<JobValues> {
  const data = record(posting);
  const categories = record(data.categories);
  const range = record(data.salaryRange);
  const interval = stringValue(range.interval).replace(/^per-/, "").replace(/-salary$/, "");
  const lists = list(data.lists).map((item) => `<h3>${stringValue(record(item).text)}</h3><ul>${stringValue(record(item).content)}</ul>`);
  return {
    role: clean(data.text),
    location: joinParts(categories.location, stringValue(data.workplaceType) === "remote" ? "Remote" : ""),
    salary: money(range.currency, range.min, range.max, interval),
    jobPostedAt: postedDate(data.createdAt),
    jobDescription: description(data.description, ...lists, data.additional),
  };
}

export function smartRecruitersValues(posting: unknown): Partial<JobValues> {
  const data = record(posting);
  const location = record(data.location);
  const sections = record(record(data.jobAd).sections);
  const parts = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"].map((key) => {
    const section = record(sections[key]);
    return section.text ? `<h3>${stringValue(section.title)}</h3>${stringValue(section.text)}` : "";
  });
  return {
    company: clean(record(data.company).name),
    role: clean(data.name),
    location: joinParts(location.city, location.region, stringValue(location.country).toUpperCase(), location.remote === true ? "Remote" : ""),
    jobId: clean(data.refNumber || data.id),
    jobPostedAt: postedDate(data.releasedDate),
    jobDescription: description(...parts),
  };
}

export function workableValues(job: unknown, account: unknown): Partial<JobValues> {
  const data = record(job);
  const location = record(data.location);
  const company = record(account);
  return {
    company: clean(company.name),
    role: clean(data.title),
    location: joinParts(location.city, location.region, location.country, data.remote === true || data.workplace === "remote" ? "Remote" : ""),
    jobId: clean(data.shortcode),
    companyLogoUrl: stringValue(company.logo).startsWith("https://") ? stringValue(company.logo) : "",
    jobPostedAt: postedDate(data.published),
    jobDescription: description(data.description, data.requirements, data.benefits),
  };
}

export function workdayValues(response: unknown, tenant: string): Partial<JobValues> {
  const data = record(response);
  const info = record(data.jobPostingInfo);
  // Workday names the legal entity ("2100 NVIDIA USA"); keep the tenant's spelling from it.
  const organization = stringValue(record(data.hiringOrganization).name);
  const spelled = organization.match(new RegExp(`\\b${tenant.replace(/[^a-z0-9]/gi, "")}\\b`, "i"))?.[0];
  return {
    company: spelled ?? tenant.charAt(0).toUpperCase() + tenant.slice(1),
    role: clean(info.title),
    location: clean(info.location),
    jobId: clean(info.jobReqId),
    jobPostedAt: postedDate(info.startDate),
    jobDescription: description(info.jobDescription),
  };
}

export function matchJobSource(jobUrl: string): JobSource | null {
  let url: URL;
  try {
    url = new URL(jobUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const slug = /^[A-Za-z0-9_-]{1,120}$/;

  if ((host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") && segments[1] === "jobs" && slug.test(segments[0] ?? "") && /^\d{1,20}$/.test(segments[2] ?? "")) {
    const [board, , id] = segments;
    return { provider: "greenhouse", load: async (io) => greenhouseValues(await io.json(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}?pay_transparency=true`)) };
  }

  if ((host === "jobs.lever.co" || host === "jobs.eu.lever.co") && slug.test(segments[0] ?? "") && /^[0-9a-f-]{36}$/i.test(segments[1] ?? "")) {
    const api = host === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co";
    return { provider: "lever", load: async (io) => leverValues(await io.json(`https://${api}/v0/postings/${segments[0]}/${segments[1]}`)) };
  }

  if (host === "jobs.smartrecruiters.com" && slug.test(segments[0] ?? "")) {
    const id = /^(\d{6,20})(?:-|$)/.exec(segments[1] ?? "")?.[1];
    if (id) return { provider: "smartrecruiters", load: async (io) => smartRecruitersValues(await io.json(`https://api.smartrecruiters.com/v1/companies/${segments[0]}/postings/${id}`)) };
  }

  if (host === "apply.workable.com" && slug.test(segments[0] ?? "") && segments[1] === "j" && /^[A-Z0-9]{6,20}$/i.test(segments[2] ?? "")) {
    const [account, , shortcode] = segments;
    return {
      provider: "workable",
      load: async (io) => {
        const [job, details] = await Promise.all([
          io.json(`https://apply.workable.com/api/v2/accounts/${account}/jobs/${shortcode}`),
          io.json(`https://apply.workable.com/api/v1/accounts/${account}`).catch(() => ({})),
        ]);
        return workableValues(job, details);
      },
    };
  }

  const workday = /^([a-z0-9-]+)\.wd\d{1,3}\.myworkdayjobs\.com$/.exec(host);
  if (workday) {
    const parts = /^[a-z]{2}-[A-Z]{2}$/.test(segments[0] ?? "") ? segments.slice(1) : segments;
    const jobIndex = parts.indexOf("job");
    if (jobIndex === 1 && slug.test(parts[0]) && parts.length > 2 && parts.slice(2).every((part) => /^[A-Za-z0-9_.,()-]{1,200}$/.test(part))) {
      const path = parts.slice(2).map(encodeURIComponent).join("/");
      return { provider: "workday", load: async (io) => workdayValues(await io.json(`https://${host}/wday/cxs/${workday[1]}/${parts[0]}/job/${path}`), workday[1]) };
    }
  }

  if ((host === "www.linkedin.com" || host === "linkedin.com") && segments[0] === "jobs" && segments[1] === "view") {
    const id = /(?:^|-)(\d{6,20})$/.exec(segments[2] ?? "")?.[1];
    // The guest endpoint serves the posting without the login wall the full page often shows.
    if (id) return { provider: "linkedin", load: async (io) => extractFromHtml(await io.html(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`), jobUrl) };
  }

  return null;
}
