import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

// Explicit hosts only: adding a provider requires reviewing its redirect/CDN hosts.
export const JOB_HOSTS = new Set([
  "linkedin.com", "www.linkedin.com", "www.indeed.com", "indeed.com",
  "boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.lever.co",
  "jobs.ashbyhq.com", "apply.workable.com", "jobs.smartrecruiters.com",
]);
export const LOGO_HOSTS = new Set([...JOB_HOSTS, "media.licdn.com", "static.licdn.com", "logo.clearbit.com"]);

export function allowedFetchUrl(input: string, kind: "html" | "image") {
  const url = new URL(input);
  if (input.length > 2048 || url.protocol !== "https:" || url.username || url.password ||
      (url.port && url.port !== "443") || !(kind === "html" ? JOB_HOSTS : LOGO_HOSTS).has(url.hostname)) {
    throw new Error("Remote URL is not allowed");
  }
  return url;
}

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

export async function safeFetch(input: string, kind: "html" | "image", maxBytes: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let url = allowedFetchUrl(input, kind);
    for (let hop = 0; hop <= 3; hop++) {
      const addresses = await Promise.race([
        lookup(url.hostname, { all: true, family: 4 }),
        new Promise<never>((_, reject) => {
          if (controller.signal.aborted) reject(new Error("Request timed out"));
          else controller.signal.addEventListener("abort", () => reject(new Error("Request timed out")), { once: true });
        }),
      ]);
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("Non-public host");
      const result = await new Promise<{ redirect?: string; buffer: Buffer; mimeType: string }>((resolve, reject) => {
        const req = request(url, {
          signal: controller.signal,
          family: 4,
          // Pin the checked address, retaining the original host for TLS verification/SNI.
          lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
          agent: false,
          headers: { accept: kind === "html" ? "text/html,application/xhtml+xml" : "image/*", "accept-encoding": "identity", "user-agent": "JobPilot/1.0" },
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
              (kind === "html" ? !["text/html", "application/xhtml+xml"].includes(mimeType) : !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType))) {
            res.destroy();
            reject(new Error("Unsupported remote response"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) res.destroy(new Error("Remote response too large"));
            else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () => resolve({ buffer: Buffer.concat(chunks), mimeType }));
        });
        req.on("error", reject);
        req.end();
      });
      if (!result.redirect) return { ...result, url: url.toString() };
      url = allowedFetchUrl(new URL(result.redirect, url).toString(), kind);
    }
    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}
