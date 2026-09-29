const idParameters = new Set(["currentjobid", "jobid", "job_id", "jobpostingid", "requisitionid", "reqid", "gh_jid", "jk", "jid"]);

export function jobIdFromUrl(jobUrl: string) {
  let url: URL;
  try {
    url = new URL(jobUrl);
  } catch {
    return "";
  }
  if (!["http:", "https:"].includes(url.protocol)) return "";

  for (const [key, value] of url.searchParams) {
    if (idParameters.has(key.toLowerCase()) && isJobId(value)) return value;
  }

  const pathId = /^\/(?:jobs?\/(?:view|details?)|positions?|requisitions?|job-postings?|jobs)\/([a-z\d_-]+)\/?$/i.exec(url.pathname)?.[1];
  return pathId && /\d/.test(pathId) && isJobId(pathId) ? pathId : "";
}

export function jobIdFromPosting(identifier: unknown) {
  const value = identifier && typeof identifier === "object" && !Array.isArray(identifier)
    ? (identifier as Record<string, unknown>).value
    : identifier;
  const id = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return id.length > 0 && id.length <= 120 ? id : "";
}

export function jobIdSource(jobUrl: string) {
  try {
    const url = new URL(jobUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    const domain = url.hostname.replace(/^www\./, "").split(".");
    return domain.length >= 2 ? domain[domain.length - 2] : "";
  } catch {
    return "";
  }
}

function isJobId(value: string) {
  return value.length >= 3 && value.length <= 120 && /^[a-z\d_-]+$/i.test(value);
}
