import { jobIdFromUrl } from "./job-id";
import { extractFromHtml, isBlockedPage, mergeJobValues, type JobValues } from "./job-import";
import { matchJobSource, type SourceIO } from "./job-sources";
import { RemoteFetchError, safeFetch } from "./safe-fetch";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
// Status codes job sites use for bot checks and login walls (LinkedIn uses 999).
const BLOCKED_STATUSES = new Set([401, 403, 429, 999]);

const io: SourceIO = {
  json: async (url) => JSON.parse((await safeFetch(url, "json", MAX_RESPONSE_BYTES)).buffer.toString("utf8")),
  html: async (url) => (await safeFetch(url, "html", MAX_RESPONSE_BYTES)).buffer.toString("utf8"),
};

// Values from the job site's own API or guest page, for filling in what a browser
// capture missed. Returns nothing for sites without a dedicated source.
export async function fetchFromJobSource(jobUrl: string): Promise<Partial<JobValues>> {
  const source = matchJobSource(jobUrl);
  return source ? source.load(io).catch(() => ({})) : {};
}

export type FetchedPosting = {
  values: JobValues;
  // The final page URL after redirects, used to allow a logo from the same site.
  pageUrl: string;
  found: boolean;
  blocked: boolean;
  failed: boolean;
};

// Asks the provider's API (when the URL belongs to a known job site) and the page
// itself at the same time, then fills each field from the first source that has it.
export async function fetchJobPosting(jobUrl: string): Promise<FetchedPosting> {
  const source = matchJobSource(jobUrl);
  const [fromSource, page] = await Promise.all([
    source ? source.load(io).catch(() => ({})) : Promise.resolve({}),
    safeFetch(jobUrl, "html", MAX_RESPONSE_BYTES).then(
      (response) => {
        const html = response.buffer.toString("utf8");
        return { values: extractFromHtml(html, response.url), pageUrl: response.url, blocked: isBlockedPage(html), failed: false };
      },
      (error: unknown) => ({
        values: {},
        pageUrl: jobUrl,
        blocked: error instanceof RemoteFetchError && BLOCKED_STATUSES.has(error.status ?? 0),
        failed: true,
      }),
    ),
  ]);

  const values = { ...mergeJobValues(fromSource, page.values, { jobId: jobIdFromUrl(jobUrl) }), jobUrl };
  const found = Boolean(values.company || values.role || values.jobDescription);
  return { values, pageUrl: page.pageUrl, found, blocked: !found && page.blocked, failed: !found && page.failed && !page.blocked };
}
