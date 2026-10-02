import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

// Job pages may be on any public HTTPS host: DNS results are checked and pinned
// below, so the host name alone never decides whether a fetch is safe.
// JSON is limited to the provider APIs in job-sources.ts, and images to known logo
// CDNs plus the host of the job page they were found on.
export const JSON_API_HOSTS = new Set([
  "boards-api.greenhouse.io", "api.lever.co", "api.eu.lever.co", "api.smartrecruiters.com", "apply.workable.com",
]);
const JSON_API_HOST_SUFFIXES = [".myworkdayjobs.com"];
export const LOGO_HOSTS = new Set([
  "linkedin.com", "www.linkedin.com", "media.licdn.com", "static.licdn.com", "logo.clearbit.com",
  "www.indeed.com", "indeed.com", "boards.greenhouse.io", "job-boards.greenhouse.io",
  "s2-recruiting.cdn.greenhouse.io", "jobs.lever.co", "lever-client-logos.s3.us-west-2.amazonaws.com",
  "jobs.ashbyhq.com", "app.ashbyhq.com", "apply.workable.com", "workablehr.s3.amazonaws.com",
  "jobs.smartrecruiters.com", "c.smartrecruiters.com",
]);

export type FetchKind = "html" | "json" | "image";
export type FetchOptions = { imageHosts?: string[] };

export class RemoteFetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

// Hosts that share a site with the page, e.g. careers.acme.com and cdn.acme.com.
export function siteOf(hostname: string) {
  const labels = hostname.toLowerCase().split(".");
  const secondLevel = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);
  const size = labels.length >= 3 && secondLevel.has(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2;
  return labels.slice(-size).join(".");
}

function hostAllowed(hostname: string, kind: FetchKind, options: FetchOptions) {
  if (kind === "html") return true;
  if (kind === "json") return JSON_API_HOSTS.has(hostname) || JSON_API_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix) && hostname.length > suffix.length);
  return LOGO_HOSTS.has(hostname) || (options.imageHosts ?? []).some((host) => siteOf(host) === siteOf(hostname));
}

export function allowedFetchUrl(input: string, kind: FetchKind, options: FetchOptions = {}) {
  const url = new URL(input);
  if (input.length > 2048 || url.protocol !== "https:" || url.username || url.password ||
      (url.port && url.port !== "443") || !url.hostname.includes(".") || !hostAllowed(url.hostname, kind, options)) {
    throw new RemoteFetchError("Remote URL is not allowed");
  }
  return url;
}

const acceptedTypes: Record<FetchKind, string[]> = {
  html: ["text/html", "application/xhtml+xml"],
  json: ["application/json"],
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
};
const acceptHeaders: Record<FetchKind, string> = { html: "text/html,application/xhtml+xml", json: "application/json", image: "image/*" };

export function isPublicAddress(address: string) {
  // IPv4-only outbound connections intentionally fail closed for IPv6-only hosts.
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export async function safeFetch(input: string, kind: FetchKind, maxBytes: number, options: FetchOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let url = allowedFetchUrl(input, kind, options);
    for (let hop = 0; hop <= 3; hop++) {
      const addresses = await Promise.race([
        lookup(url.hostname, { all: true, family: 4 }),
        new Promise<never>((_, reject) => {
          if (controller.signal.aborted) reject(new RemoteFetchError("Request timed out"));
          else controller.signal.addEventListener("abort", () => reject(new RemoteFetchError("Request timed out")), { once: true });
        }),
      ]);
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new RemoteFetchError("Non-public host");
      const result = await new Promise<{ redirect?: string; buffer: Buffer; mimeType: string }>((resolve, reject) => {
        const req = request(url, {
          signal: controller.signal,
          family: 4,
          // Pin the checked address, retaining the original host for TLS verification/SNI.
          lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
          agent: false,
          headers: { accept: acceptHeaders[kind], "accept-encoding": "identity", "user-agent": "JobPilot/1.0" },
        }, (res) => {
          const status = res.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
            res.destroy();
            resolve({ redirect: res.headers.location, buffer: Buffer.alloc(0), mimeType: "" });
            return;
          }
          const mimeType = (res.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
          if (status < 200 || status >= 300 || Number(res.headers["content-length"]) > maxBytes ||
              (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") ||
              !acceptedTypes[kind].includes(mimeType)) {
            res.destroy();
            reject(new RemoteFetchError("Unsupported remote response", status));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) res.destroy(new RemoteFetchError("Remote response too large"));
            else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () => resolve({ buffer: Buffer.concat(chunks), mimeType }));
        });
        req.on("error", reject);
        req.end();
      });
      if (!result.redirect) return { ...result, url: url.toString() };
      url = allowedFetchUrl(new URL(result.redirect, url).toString(), kind, options);
    }
    throw new RemoteFetchError("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}
