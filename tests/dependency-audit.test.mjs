import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkAudit } from "../scripts/dependency-audit.mjs";

const exceptions = JSON.parse(readFileSync(new URL("../.github/dependency-audit-exceptions.json", import.meta.url), "utf8"));
const now = new Date("2026-10-05T12:00:00Z");

function fixture() {
  const advisory = { name: "braces", severity: "high", url: exceptions[0].url };
  const vulnerabilities = {
    braces: { severity: "high", via: [advisory], nodes: ["node_modules/braces"] },
    micromatch: { severity: "high", via: ["braces"] },
    "fast-glob": { severity: "high", via: ["micromatch"] },
    "@next/eslint-plugin-next": { severity: "high", via: ["fast-glob"] },
    "eslint-config-next": { severity: "high", via: ["@next/eslint-plugin-next"] },
  };
  return {
    report: { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { high: 5 } } },
    lockfile: { packages: { "node_modules/braces": { dev: true } } },
  };
}

test("excepts only the approved advisory and its transitive reports", () => {
  const { report, lockfile } = fixture();
  const result = checkAudit(report, lockfile, exceptions, now);
  assert.equal(result.ignored.length, 1);
  assert.deepEqual(result.blocked, []);
});

test("still blocks a different advisory in the excepted package", () => {
  const { report, lockfile } = fixture();
  report.vulnerabilities.braces.via.push({ name: "braces", severity: "moderate", url: "https://github.com/advisories/GHSA-other" });
  assert.equal(checkAudit(report, lockfile, exceptions, now).blocked.length, 1);
});

test("still blocks unrelated dependencies", () => {
  const { report, lockfile } = fixture();
  report.vulnerabilities.other = { severity: "critical", via: [{ name: "other", severity: "critical", url: "https://github.com/advisories/GHSA-other" }] };
  assert.equal(checkAudit(report, lockfile, exceptions, now).blocked.length, 1);
});

test("exception expires at midnight UTC on the stated date", () => {
  const { report, lockfile } = fixture();
  assert.equal(checkAudit(report, lockfile, exceptions, new Date("2026-11-05T00:00:00Z")).blocked.length, 1);
});

test("blocks the advisory if a reported copy becomes a production dependency", () => {
  const { report, lockfile } = fixture();
  lockfile.packages["node_modules/braces"].dev = false;
  assert.equal(checkAudit(report, lockfile, exceptions, now).blocked.length, 1);
});

test("blocks the advisory if another copy is a production dependency", () => {
  const { report, lockfile } = fixture();
  lockfile.packages["node_modules/other/node_modules/braces"] = { dev: false };
  assert.equal(checkAudit(report, lockfile, exceptions, now).blocked.length, 1);
});

test("fails closed on audit errors and missing transitive entries", () => {
  const { report, lockfile } = fixture();
  assert.throws(() => checkAudit({ error: { message: "Registry unavailable" } }, lockfile, exceptions, now));
  delete report.vulnerabilities.braces;
  assert.throws(() => checkAudit(report, lockfile, exceptions, now), /Incomplete audit entry/);
});

test("accepts an empty successful audit report", () => {
  const { report, lockfile } = fixture();
  report.vulnerabilities = {};
  report.metadata.vulnerabilities = { high: 0 };
  assert.deepEqual(checkAudit(report, lockfile, exceptions, now), { ignored: [], blocked: [] });
});
