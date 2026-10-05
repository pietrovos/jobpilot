import assert from "node:assert/strict";
import { test } from "node:test";
import { companyFromHost, extractFromHtml, failedExtract, isBlockedPage, mergeJobValues, normalizeJobUrl } from "../src/lib/job-import";

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
  assert.equal(
    normalizeJobUrl("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=1234567890"),
    "https://www.linkedin.com/jobs/view/1234567890/",
  );
  assert.equal(normalizeJobUrl("https://www.linkedin.com/jobs/view/1234567890/?currentJobId=42"), "https://www.linkedin.com/jobs/view/1234567890/?currentJobId=42");
  assert.equal(normalizeJobUrl("https://jobs.example.test/a?b=1"), "https://jobs.example.test/a?b=1");
  assert.equal(failedExtract("https://jobs.example.test/a").values.jobUrl, "https://jobs.example.test/a");
});

test("career pages without structured data fall back to the heading, host and main content", () => {
  const body = "Fictional Copper Robotics builds invented machines. ".repeat(6);
  const html = `<html><head><title>Careers</title><script>tracking()</script></head><body>
    <nav>Home Jobs About</nav><main><h1>Robotics Software Engineer</h1><p>${body}</p><footer>Privacy</footer></main></body></html>`;
  const extracted = extractFromHtml(html, "https://careers.copper-robotics.co.uk/openings/42");
  assert.equal(extracted.role, "Robotics Software Engineer");
  assert.equal(extracted.company, "Copper Robotics");
  assert.match(extracted.jobDescription, /^Robotics Software Engineer\nFictional Copper Robotics builds invented machines\./);
  assert.doesNotMatch(extracted.jobDescription, /tracking|Privacy/);
  assert.equal(companyFromHost("https://www.linkedin.com/jobs/view/1"), "");
  assert.equal(companyFromHost("https://jobs.lever.co/acme/1"), "");
});

test("remote postings, estimated salaries and bot checks are recognised", () => {
  const posting = {
    "@type": "JobPosting", title: "Support Engineer", hiringOrganization: { name: "Fictional Lunar Maps" },
    jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "Canada" },
    estimatedSalary: [{ currency: "CAD", minValue: 80000, maxValue: 95000, unitText: "YEAR" }],
    datePosted: "2026-07-30",
  };
  const extracted = extractFromHtml(`<script type="application/ld+json">${JSON.stringify(posting)}</script>`, "https://jobs.example.test/1");
  assert.equal(extracted.location, "Remote, Canada");
  assert.equal(extracted.salary, "CAD 80000-95000 / year");
  assert.equal(extracted.jobPostedAt, "Jul 30, 2026");
  for (const title of ["Just a moment...", "Authenticating...", "Attention Required! | Cloudflare", "Sign in | LinkedIn"]) {
    assert.equal(isBlockedPage(`<title>${title}</title>`), true, title);
  }
  assert.equal(isBlockedPage("<title>Platform Engineer at Fictional Labs</title>"), false);
  assert.deepEqual(mergeJobValues({ role: "From API" }, { role: "From page", company: "Fictional Labs" }).role, "From API");
  assert.equal(mergeJobValues({ role: "" }, { company: "Fictional Labs" }).company, "Fictional Labs");
});
