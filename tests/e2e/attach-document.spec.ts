import { expect, test } from "@playwright/test";

test("attach a saved document to an existing application without removing it from Documents", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.goto("/documents");
  await page.getByRole("button", { name: "Add documents" }).click();
  const upload = page.getByRole("dialog", { name: "Add documents" });
  await upload.getByLabel("Documents, up to 10 MB each and 30 MB total").setInputFiles({
    name: "saved-resume.txt", mimeType: "text/plain", buffer: Buffer.from("Saved resume"),
  });
  await upload.getByRole("button", { name: "Upload documents", exact: true }).click();
  await expect(page.getByRole("link", { name: "saved-resume.txt" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Attachment Example");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
  await creation.getByRole("button", { name: "Save application" }).click();

  await page.getByRole("button", { name: "View details", exact: true }).click();
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await page.getByRole("checkbox", { name: /saved-resume.txt/ }).check();
  await page.getByRole("button", { name: "Attach selected" }).click();
  const attached = page.getByRole("link", { name: "saved-resume.txt" });
  await expect(attached).toBeVisible();
  expect((await page.request.get((await attached.getAttribute("href"))!)).status()).toBe(200);
  await expect(page.getByRole("checkbox", { name: /saved-resume.txt/ })).toHaveCount(0);

  await page.goto("/documents");
  await expect(page.getByRole("link", { name: "saved-resume.txt" })).toBeVisible();
});
