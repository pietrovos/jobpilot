import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { latestMailTo } from "./mail-outbox";

test("a forgotten password can be reset once from the emailed link", async ({ page }) => {
  const email = `reset-${randomUUID()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Reset Pilot");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Original-password-2026!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email has an account")).toBeVisible();

  await expect.poll(() => latestMailTo(email)).not.toBeNull();
  const link = (await latestMailTo(email))!.text.match(/http:\/\/localhost:3100\/reset-password\?token=[\w-]+/)?.[0];
  expect(link).toBeTruthy();

  await page.goto(link!);
  await page.getByLabel("New password", { exact: true }).fill("Replacement-password-2026!");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Replacement-password-2026!");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Original-password-2026!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Replacement-password-2026!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");

  await page.goto(link!);
  await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
});

test("reset requests for unknown emails look the same and send nothing", async ({ page }) => {
  const email = `missing-${randomUUID()}@example.test`;
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email has an account")).toBeVisible();
  expect(await latestMailTo(email)).toBeNull();
});
