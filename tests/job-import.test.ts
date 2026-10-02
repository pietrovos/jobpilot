import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFromHtml, failedExtract, normalizeJobUrl } from "../src/lib/job-import";

test("structured job postings fill company, role, location, salary and logo", () => {
  const posting = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "JobPosting",
      title: "Platform Engineer",
      datePosted: "2026-09-01T12:00:00Z",
      description: "<p>Build &amp; run the platform.</p><ul><li>Kubernetes</li><li>Go</li></ul>",
      identifier: { value: "PE-42" },
      hiringOrganization: { name: "Fictional Observatory", logo: "/logo.png" },
      jobLocation: { address: { addressLocality: "Toronto", addressRegion: "ON", addressCountry: "CA" } },
      baseSalary: { currency: "CAD", value: { minValue: 100000, maxValue: 130000, unitText: "YEAR" } },
    }],
  };
  const html = `<html><head><title>Ignored</title><script type="application/ld+json">${JSON.stringify(posting)}</script></head></html>`;
  const extracted = extractFromHtml(html, "https://jobs.example.test/openings/platform");

  assert.equal(extracted.company, "Fictional Observatory");
  assert.equal(extracted.role, "Platform Engineer");
  assert.equal(extracted.location, "Toronto, ON, CA");
  assert.equal(extracted.salary, "CAD 100000-130000 / year");
  assert.equal(extracted.companyLogoUrl, "https://jobs.example.test/logo.png");
  assert.equal(extracted.jobPostedAt, "Sep 1, 2026");
  assert.equal(extracted.jobDescription, "Build & run the platform.\n\n- Kubernetes\n\n- Go");
});

test("LinkedIn page titles provide details when structured data is missing", () => {
  const html = `<meta property="og:title" content="Fictional Labs hiring Data Engineer in Montreal, QC | LinkedIn">`;
  const extracted = extractFromHtml(html, "https://www.linkedin.com/jobs/view/1234567890/");
  assert.equal(extracted.company, "Fictional Labs");
  assert.equal(extracted.role, "Data Engineer");
  assert.equal(extracted.location, "Montreal, QC");
});

test("login walls and search URLs do not produce invented details", () => {
  const extracted = extractFromHtml("<title>LinkedIn Login, Sign in | LinkedIn</title>", "https://www.linkedin.com/jobs/view/1234567890/");
  assert.equal(extracted.company, "");
  assert.equal(extracted.role, "");
  assert.equal(
    normalizeJobUrl("https://www.linkedin.com/jobs/search-results/?currentJobId=1234567890&keywords=engineer"),
    "https://www.linkedin.com/jobs/view/1234567890/",
  );
  assert.equal(normalizeJobUrl("https://jobs.example.test/a?b=1"), "https://jobs.example.test/a?b=1");
  assert.equal(failedExtract("https://jobs.example.test/a").values.jobUrl, "https://jobs.example.test/a");
});
