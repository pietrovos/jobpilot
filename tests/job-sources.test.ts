import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { matchJobSource, type SourceIO } from "../src/lib/job-sources";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/job-sources/${name}.json`, import.meta.url), "utf8")) as unknown;

// Records which API URLs a source asks for and answers from the fixtures.
function fakeIO(responses: Record<string, unknown>) {
  const requested: string[] = [];
  const io: SourceIO = {
    json: async (url) => {
      requested.push(url);
      if (!(url in responses)) throw new Error(`Unexpected request ${url}`);
      return responses[url];
    },
    html: async (url) => {
      requested.push(url);
      if (!(url in responses)) throw new Error(`Unexpected request ${url}`);
      return String(responses[url]);
    },
  };
  return { io, requested };
}

test("Greenhouse postings load from the boards API with pay ranges and decoded content", async () => {
  const source = matchJobSource("https://job-boards.greenhouse.io/fictional/jobs/4461450008");
  const api = "https://boards-api.greenhouse.io/v1/boards/fictional/jobs/4461450008?pay_transparency=true";
  const { io, requested } = fakeIO({ [api]: fixture("greenhouse") });
  const values = await source!.load(io);
  assert.deepEqual(requested, [api]);
  assert.equal(values.company, "Fictional Observatory");
  assert.equal(values.role, "Platform Engineer");
  assert.equal(values.location, "Toronto, ON");
  assert.equal(values.salary, "CAD 120000-150000");
  assert.equal(values.jobId, "4461450008");
  assert.equal(values.jobPostedAt, "Jul 30, 2026");
  assert.equal(values.jobDescription, "About the role\nRun the fictional telescope platform.\n\n- Go\n\n- Kubernetes");
});

test("Lever, SmartRecruiters, Workable and Workday map their API fields", async () => {
  const lever = matchJobSource("https://jobs.lever.co/fictional/6ed76ce8-4156-4b60-b120-403538bd66cd/apply");
  const leverValues = await lever!.load(fakeIO({ "https://api.lever.co/v0/postings/fictional/6ed76ce8-4156-4b60-b120-403538bd66cd": fixture("lever") }).io);
  assert.equal(leverValues.company, undefined, "Lever's API has no company name; the page provides it");
  assert.equal(leverValues.role, "Data Engineer");
  assert.equal(leverValues.location, "Montreal, QC, Remote");
  assert.equal(leverValues.salary, "CAD 110000-130000 / year");
  assert.match(leverValues.jobDescription ?? "", /What you will do\n\n- Model data\n\n- Ship pipelines/);

  const smart = matchJobSource("https://jobs.smartrecruiters.com/FictionalAmber/744000153235279-supply-planner");
  const smartValues = await smart!.load(fakeIO({ "https://api.smartrecruiters.com/v1/companies/FictionalAmber/postings/744000153235279": fixture("smartrecruiters") }).io);
  assert.equal(smartValues.company, "Fictional Amber Studio");
  assert.equal(smartValues.location, "Guadalajara, Jalisco, MX");
  assert.equal(smartValues.jobId, "REF296212T");
  assert.equal(smartValues.jobDescription, "Company Description\nAn invented studio.\nJob Description\nPlan fictional supplies.");

  const workable = matchJobSource("https://apply.workable.com/fictional/j/F4C096B22E/");
  const workableValues = await workable!.load(fakeIO({
    "https://apply.workable.com/api/v2/accounts/fictional/jobs/F4C096B22E": fixture("workable-job"),
    "https://apply.workable.com/api/v1/accounts/fictional": fixture("workable-account"),
  }).io);
  assert.equal(workableValues.company, "Fictional Harbor Analytics");
  assert.equal(workableValues.location, "Paris, Île-de-France, France, Remote");
  assert.equal(workableValues.jobPostedAt, "Jul 30, 2026");
  assert.equal(workableValues.companyLogoUrl, "https://workablehr.s3.amazonaws.com/uploads/account/logo/1/logo");

  const workday = matchJobSource("https://fictionalco.wd5.myworkdayjobs.com/en-US/External/job/US-CA-Santa-Clara/Embedded-Software-Engineer_JR2021651");
  const workdayValues = await workday!.load(fakeIO({ "https://fictionalco.wd5.myworkdayjobs.com/wday/cxs/fictionalco/External/job/US-CA-Santa-Clara/Embedded-Software-Engineer_JR2021651": fixture("workday") }).io);
  assert.equal(workdayValues.company, "FICTIONALCO");
  assert.equal(workdayValues.location, "US, CA, Santa Clara");
  assert.equal(workdayValues.jobId, "JR2021651");
  assert.equal(workdayValues.jobPostedAt, "Oct 2, 2026");
});

test("LinkedIn postings use the guest endpoint", async () => {
  const source = matchJobSource("https://www.linkedin.com/jobs/view/senior-engineer-at-fictional-labs-4419969671/");
  const html = `<h2 class="top-card-layout__title topcard__title">Senior Engineer</h2>
    <a class="topcard__org-name-link topcard__flavor--black-link" href="#">Fictional Labs</a>
    <span class="topcard__flavor topcard__flavor--bullet">Montreal, QC</span>`;
  const { io, requested } = fakeIO({ "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4419969671": html });
  const values = await source!.load(io);
  assert.deepEqual(requested, ["https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4419969671"]);
  assert.equal(values.company, "Fictional Labs");
  assert.equal(values.role, "Senior Engineer");
  assert.equal(values.location, "Montreal, QC");
});

test("only exact provider hosts and well-formed paths match", () => {
  for (const url of [
    "https://boards.greenhouse.io.evil.test/fictional/jobs/1",
    "https://evil.test/boards.greenhouse.io/fictional/jobs/1",
    "http://boards.greenhouse.io/fictional/jobs/1",
    "https://boards.greenhouse.io/fictional/jobs/not-a-number",
    "https://jobs.lever.co/fictional/not-a-uuid",
    "https://myworkdayjobs.com/External/job/x",
    "https://evil.wd5.myworkdayjobs.com.evil.test/External/job/x",
    "https://www.linkedin.com/jobs/search/?keywords=engineer",
    "not a url",
  ]) {
    assert.equal(matchJobSource(url), null, url);
  }
  assert.equal(matchJobSource("https://boards.greenhouse.io/fictional/jobs/123")?.provider, "greenhouse");
  assert.equal(matchJobSource("https://jobs.eu.lever.co/fictional/6ed76ce8-4156-4b60-b120-403538bd66cd")?.provider, "lever");
});
