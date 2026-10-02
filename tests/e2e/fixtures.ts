import { createHash } from "node:crypto";
import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

// The test server trusts this header the way a deployment trusts its reverse proxy
// (TRUSTED_PROXY_IP_HEADER). Giving each test its own documentation-range address
// keeps auth rate limits per test instead of shared by the whole suite.
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide, testInfo) => {
    const hash = createHash("sha256").update(`${testInfo.project.name}:${testInfo.testId}:${testInfo.retry}`).digest();
    await provide({ "x-e2e-client": `198.51.${hash[0]}.${hash[1]}` });
  },
});
