import assert from "node:assert/strict";
import { test } from "node:test";
import { bookmarkletHref, decodeCapturePayload } from "../src/lib/bookmarklet";
import { capturedPostingSchema, capturedPostingValues, type CapturedPosting } from "../src/lib/job-capture";

const base: CapturedPosting = { v: 1, url: "https://www.indeed.com/viewjob?jk=a1b2c3d4e5f6", title: "", h1: "", company: "", location: "", description: "", meta: {}, ld: [] };

test("captured pages without structured data use the site's layout fields", () => {
  const values = capturedPostingValues({
    ...base,
    url: "https://www.linkedin.com/jobs/search-results/?currentJobId=4419969671",
    title: "(3) Senior Engineer | Fictional Labs | LinkedIn",
    h1: "Senior Engineer",
    company: "Fictional Labs",
    location: "Montreal, QC (Hybrid)",
    description: "About the job\n\n  Build invented tools.  \nRequires <5 years of experience.",
  });
  assert.equal(values.jobUrl, "https://www.linkedin.com/jobs/view/4419969671/");
  assert.equal(values.jobId, "4419969671");
  assert.equal(values.company, "Fictional Labs");
  assert.equal(values.role, "Senior Engineer");
  assert.equal(values.location, "Montreal, QC (Hybrid)");
  assert.equal(values.jobDescription, "About the job\n\nBuild invented tools.\nRequires <5 years of experience.");
});

test("signed-in LinkedIn captures read the company from the title and trim the location line", () => {
  const values = capturedPostingValues({
    ...base,
    url: "https://www.linkedin.com/jobs/view/4470712481/",
    title: "(3) Cloud Engineer | Fictional Vertex | LinkedIn",
    h1: "Cloud Engineer",
    location: "Kanata, Ontario, Canada · 6 days ago · 40 applicants",
    description: "Build invented cloud platforms.",
  });
  assert.equal(values.company, "Fictional Vertex");
  assert.equal(values.role, "Cloud Engineer");
  assert.equal(values.location, "Kanata, Ontario, Canada");
});

test("structured data in a capture wins over layout guesses", () => {
  const posting = { "@type": "JobPosting", title: "Data Analyst", hiringOrganization: { name: "Fictional Harbor Analytics" }, description: "<p>Analyse invented data.</p>" };
  const values = capturedPostingValues({ ...base, h1: "Wrong heading", company: "Wrong company", ld: [JSON.stringify(posting)] });
  assert.equal(values.company, "Fictional Harbor Analytics");
  assert.equal(values.role, "Data Analyst");
  assert.equal(values.jobDescription, "Analyse invented data.");
  assert.equal(values.jobId, "a1b2c3d4e5f6");
});

test("captures are validated and cannot break out of the rebuilt page", () => {
  for (const bad of [
    { ...base, url: "http://www.indeed.com/viewjob" },
    { ...base, url: "javascript:alert(1)" },
    { ...base, v: 2 },
    { ...base, description: "x".repeat(20001) },
    { ...base, ld: ["{}", "{}", "{}", "{}"] },
    { ...base, meta: Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`og:${index}`, "x"])) },
    "not an object",
  ]) {
    assert.equal(capturedPostingSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 80));
  }
  const values = capturedPostingValues({
    ...base,
    title: `</title><script type="application/ld+json">{"@type":"JobPosting","title":"Injected"}</script>`,
    meta: { "og:title\" content=\"Injected": "Real title" },
  });
  assert.notEqual(values.role, "Injected");
});

test("the bookmarklet targets this deployment and its payload round-trips", () => {
  const href = bookmarkletHref("https://jobs.example.test");
  assert.match(href, /^javascript:/);
  assert.match(decodeURIComponent(href), /https:\/\/jobs\.example\.test\/capture#/);
  const payload = { ...base, description: "Café – naïve résumé" };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  assert.deepEqual(decodeCapturePayload(encoded), payload);
});
