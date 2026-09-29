import { expect, test } from "@playwright/test";

test("Backspace navigates details without interrupting editable fields", async ({ page }) => {
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
  await expect(details.getByRole("group", { name: "Company" })).toBeVisible();

  await details.getByRole("group", { name: "Company" }).focus();
  await page.keyboard.press("Enter");
  const companyInput = details.getByRole("textbox", { name: "Company" });
  await companyInput.fill("Unsaved company name");
  await companyInput.press("End");
  await companyInput.press("Backspace");
  await expect(companyInput).toHaveValue("Unsaved company nam");
  await expect(page.getByRole("dialog", { name: "Discard unsaved changes" })).not.toBeVisible();

  await details.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("dialog", { name: "Discard unsaved changes" })).toBeVisible();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(details.getByRole("group", { name: "Company" })).toBeVisible();

  await details.getByRole("button", { name: "Notes", exact: true }).click();
  await details.getByRole("button", { name: "New note" }).click();
  const noteTitle = details.getByRole("textbox", { name: "Note title" });
  await noteTitle.fill("Interview prep");
  await noteTitle.press("End");
  await noteTitle.press("Backspace");
  await expect(noteTitle).toHaveValue("Interview pre");
  const noteBody = details.getByRole("textbox", { name: "Note body" });
  await noteBody.fill("Take notes");
  await noteBody.press("End");
  await noteBody.press("Backspace");
  await expect(noteBody).toHaveValue("Take note");
  await expect(page.getByRole("dialog", { name: "Discard unsaved changes" })).not.toBeVisible();
  await details.getByRole("button", { name: "Back to details" }).focus();
  await page.keyboard.press("Backspace");
  await page.getByRole("button", { name: "Discard changes" }).click();

  await details.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Backspace");
  await expect(details).not.toBeVisible();
});
