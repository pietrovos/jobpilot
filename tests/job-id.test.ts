import assert from "node:assert/strict";
import { test } from "node:test";
import { jobIdFromPosting, jobIdFromUrl, jobIdSource, jobPlatformName } from "../src/lib/job-id";

test("job IDs come from explicit URL parameters and job paths across sites", () => {
  assert.equal(jobIdFromUrl("https://www.linkedin.com/jobs/search-results/?currentJobId=4429419357&trackingId=abc"), "4429419357");
  assert.equal(jobIdFromUrl("https://www.linkedin.com/jobs/view/4429419357/"), "4429419357");
  assert.equal(jobIdFromUrl("https://boards.greenhouse.io/company/jobs/123456?gh_jid=987654"), "987654");
  assert.equal(jobIdFromUrl("https://www.indeed.com/viewjob?jk=abc123def"), "abc123def");
  assert.equal(jobIdFromUrl("https://example.com/positions/REQ-12345"), "REQ-12345");
  assert.equal(jobIdFromUrl("https://example.com/jobs/search?keywords=engineer&trackingId=12345"), "");
  assert.equal(jobIdFromUrl("not a url"), "");
});

test("structured posting identifiers and sources are extracted without guessing", () => {
  assert.equal(jobIdFromPosting({ "@type": "PropertyValue", value: "REQ-12345" }), "REQ-12345");
  assert.equal(jobIdFromPosting("ABC-999"), "ABC-999");
  assert.equal(jobIdFromPosting({ name: "Example Company" }), "");
  assert.equal(jobIdSource("https://www.linkedin.com/jobs/view/123"), "linkedin");
  assert.equal(jobIdSource("https://boards.greenhouse.io/company/jobs/123"), "greenhouse");
  assert.equal(jobPlatformName("https://acme.wd5.myworkdayjobs.com/careers/job/123"), "Workday");
  assert.equal(jobPlatformName("https://jobs.fictional.test/viewjob?jk=abc"), "fictional");
});
