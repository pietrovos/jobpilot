import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const blockingSeverities = new Set(["moderate", "high", "critical"]);
const severities = new Set(["info", "low", ...blockingSeverities]);

export function checkAudit(report, lockfile, exceptions, now = new Date()) {
  if (report.error || report.auditReportVersion !== 2 || !report.vulnerabilities ||
      !report.metadata?.vulnerabilities || !lockfile.packages) {
    throw new Error("Missing or unsupported npm audit report or lockfile.");
  }

  const ignored = new Set();
  const blocked = new Set();
  const visited = new Set();

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const vulnerability = report.vulnerabilities[name];
    if (!vulnerability || !severities.has(vulnerability.severity) ||
        !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      throw new Error(`Incomplete audit entry for ${name}.`);
    }

    for (const via of vulnerability.via) {
      if (typeof via === "string") {
        visit(via);
        continue;
      }
      if (!via || !severities.has(via.severity) || typeof via.url !== "string" ||
          typeof via.name !== "string") {
        throw new Error(`Unsupported advisory for ${name}.`);
      }
      if (!blockingSeverities.has(via.severity)) continue;

      const exception = exceptions.find((entry) => entry.package === via.name && entry.url === via.url);
      const nodes = vulnerability.nodes;
      const devOnly = Array.isArray(nodes) && nodes.length > 0 && nodes.every((node) =>
        lockfile.packages[node]?.dev === true,
      );
      // Also check copies outside the reported nodes before accepting a dev-only exception.
      const copies = Object.entries(lockfile.packages).filter(([path]) =>
        path.endsWith(`/node_modules/${via.name}`) || path === `node_modules/${via.name}`,
      );
      const expires = exception && /^\d{4}-\d{2}-\d{2}$/.test(exception.expires)
        ? Date.parse(`${exception.expires}T00:00:00Z`)
        : NaN;
      if (exception && now.getTime() < expires && devOnly && copies.length > 0 &&
          copies.every(([, pkg]) => pkg.dev === true)) {
        ignored.add(`${via.url} (development only; expires ${exception.expires}): ${exception.reason}`);
      } else {
        blocked.add(`${via.name}: ${via.url}${exception ? " (exception expired or dependency is not development-only)" : ""}`);
      }
    }
  }

  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!severities.has(vulnerability.severity)) throw new Error(`Unknown severity for ${name}.`);
    if (blockingSeverities.has(vulnerability.severity)) visit(name);
  }
  return { ignored: [...ignored], blocked: [...blocked] };
}

function main() {
  const audit = spawnSync("npm", ["audit", "--json", "--audit-level=moderate"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (audit.error || audit.signal || ![0, 1].includes(audit.status)) {
    throw new Error(audit.error?.message || audit.stderr || "npm audit did not finish successfully.");
  }
  const report = JSON.parse(audit.stdout);
  const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const exceptions = JSON.parse(readFileSync(".github/dependency-audit-exceptions.json", "utf8"));
  const result = checkAudit(report, lockfile, exceptions);
  for (const ignored of result.ignored) console.warn(`Temporary audit exception: ${ignored}`);
  for (const blocked of result.blocked) console.error(`Blocking advisory: ${blocked}`);
  if (result.blocked.length) process.exitCode = 1;
  else console.log("Dependency audit passed: no unexcepted moderate, high, or critical advisories.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`Dependency audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
