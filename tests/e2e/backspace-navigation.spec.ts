import { expect, test } from "@playwright/test";

test("Backspace moves back through application details regardless of focus", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Keyboard Navigation Co");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
  await creation.getByRole("button", { name: "Save application" }).click();

  await page.getByRole("button", { name: "View details", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Keyboard Navigation Co application details" });
  await details.getByRole("button", { name: "Files", exact: true }).click();
  await details.getByLabel("Attach files, up to 10 MB each and 30 MB total").focus();
  await page.keyboard.press("Backspace");
  await expect(details.getByRole("button", { name: "Files", exact: true })).toBeVisible();

  await details.getByRole("group", { name: "Company" }).focus();
  await page.keyboard.press("Enter");
  const companyInput = details.getByRole("textbox", { name: "Company" });
  await companyInput.fill("Unsaved company name");
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("dialog", { name: "Discard unsaved changes" })).toBeVisible();
  await expect(companyInput).toHaveValue("Unsaved company name");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(details.getByRole("group", { name: "Company" })).toBeVisible();

  await details.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Backspace");
  await expect(details).not.toBeVisible();
});
