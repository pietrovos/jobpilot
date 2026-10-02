import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { allowedFetchUrl, isPublicAddress } from "../src/lib/safe-fetch";
import { dateSchema, passwordSchema, webUrlSchema } from "../src/lib/backend-validation";
import { verifyUpload } from "../src/lib/verified-upload";
import { privateFileResponse } from "../src/lib/private-file";

test("remote fetching fails closed for unsafe hosts, schemes, credentials and ports", () => {
  for (const url of ["http://www.linkedin.com/jobs", "https://localhost/jobs", "https://user:pass@www.linkedin.com", "https://www.linkedin.com:8443", "https://[::1]", "file:///etc/passwd", `https://example.com/${"a".repeat(2050)}`]) {
    assert.throws(() => allowedFetchUrl(url, "html"), url);
  }
  // Any public HTTPS page is allowed; the resolved address is checked when connecting.
  assert.equal(allowedFetchUrl("https://careers.example.com/jobs/123", "html").hostname, "careers.example.com");
  assert.equal(allowedFetchUrl("https://www.linkedin.com/jobs/view/123", "html").hostname, "www.linkedin.com");
  // JSON only from provider APIs, images only from logo CDNs or the job page's site.
  assert.equal(allowedFetchUrl("https://boards-api.greenhouse.io/v1/boards/x/jobs/1", "json").hostname, "boards-api.greenhouse.io");
  assert.equal(allowedFetchUrl("https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/x/job/y", "json").hostname, "acme.wd5.myworkdayjobs.com");
  for (const url of ["https://example.com/api.json", "https://myworkdayjobs.com/x", "https://acme.myworkdayjobs.com.evil.test/x"]) {
    assert.throws(() => allowedFetchUrl(url, "json"), url);
  }
  assert.throws(() => allowedFetchUrl("https://cdn.example.com/logo.png", "image"));
  assert.equal(allowedFetchUrl("https://cdn.acme.co.uk/logo.png", "image", { imageHosts: ["careers.acme.co.uk"] }).hostname, "cdn.acme.co.uk");
  assert.throws(() => allowedFetchUrl("https://other.co.uk/logo.png", "image", { imageHosts: ["careers.acme.co.uk"] }));
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.16.0.1", "192.168.0.1", "100.64.0.1", "198.18.0.1", "::1", "::ffff:127.0.0.1"]) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("8.8.8.8"), true);
});

test("validation rejects unsafe navigation, invalid calendars and bcrypt truncation", () => {
  assert.equal(webUrlSchema.safeParse("javascript:alert(1)").success, false);
  assert.equal(webUrlSchema.safeParse("https://example.com/jobs").success, true);
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  assert.equal(dateSchema.safeParse("2026-09-12T12:30:00Z").success, true);
  assert.equal(dateSchema.safeParse("2026-09-12T12:30:00").success, false);
  assert.equal(passwordSchema.safeParse("a".repeat(73)).success, false);
  assert.equal(passwordSchema.safeParse("\u00e9".repeat(37)).success, false);
});

test("uploads reject active content and spoofed raster formats", async () => {
  await assert.rejects(verifyUpload(new File(["<svg onload='alert(1)'/>"], "image.svg", { type: "image/svg+xml" })));
  await assert.rejects(verifyUpload(new File(["<script>alert(1)</script>"], "image.png", { type: "image/png" })));
  const result = await verifyUpload(new File(["Interview notes"], "notes.txt", { type: "text/html" }));
  assert.equal(result.mimeType, "text/plain");
});

test("private files force active content to download, stream ranges and contain paths", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "jobpilot-files-"));
  try {
    await writeFile(path.join(root, "unsafe.html"), "<script>alert(1)</script>");
    const response = await privateFileResponse(root, "unsafe.html", "unsafe.html", "inline");
    assert.match(response.headers.get("Content-Disposition")!, /^attachment/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(response.headers.get("Content-Security-Policy")!, /sandbox/);
    await response.arrayBuffer();
    const partial = await privateFileResponse(root, "unsafe.html", "unsafe.html", "attachment", "bytes=0-6");
    assert.equal(partial.status, 206);
    assert.equal(await partial.text(), "<script");
    assert.equal((await privateFileResponse(root, "unsafe.html", "x", "inline", "bytes=999-1000")).status, 416);
    assert.equal((await privateFileResponse(root, "../outside", "x", "inline")).status, 404);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
