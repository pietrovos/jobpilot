import { expect, test } from "@playwright/test";

test("permanently deletes one recycled application and empties the rest", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();

  for (const company of ["Keep Active", "Delete Individually", "Select First", "Select Second", "Empty Together"]) {
    await page.getByRole("button", { name: "Add application", exact: true }).click();
    const creation = page.getByRole("dialog", { name: "Add application", exact: true });
    await creation.getByRole("button", { name: "Enter details manually" }).click();
    await creation.getByRole("textbox", { name: "Company", exact: true }).fill(company);
    await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
    await creation.getByRole("button", { name: "Save application" }).click();
    await expect(creation).not.toBeVisible();
    if (company === "Keep Active") continue;
    await page.locator("article[data-application-id]").filter({ hasText: company }).getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog", { name: "Confirm delete applications" }).getByRole("button", { name: "Delete application", exact: true }).click();
    await expect(page.locator("article[data-application-id]").filter({ hasText: company })).toHaveCount(0);
  }

  await page.getByRole("button", { name: "Open recycle bin" }).click();
  const bin = page.getByRole("dialog", { name: "Recycle bin", exact: true });
  await expect(bin.locator("article")).toHaveCount(4);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Are you sure");
    await dialog.dismiss();
  });
  await bin.getByRole("button", { name: "Permanently delete Delete Individually — Engineer", exact: true }).click();
  await expect(bin.locator("article")).toHaveCount(4);
  page.once("dialog", (dialog) => dialog.accept());
  await bin.getByRole("button", { name: "Permanently delete Delete Individually — Engineer", exact: true }).click();
  await expect(bin.locator("article")).toHaveCount(3);

  await bin.getByText("Select First", { exact: true }).click({ modifiers: ["Control"] });
  await bin.getByText("Select Second", { exact: true }).click({ modifiers: ["Control"] });
  await expect(bin.getByRole("checkbox", { name: "Select Select First — Engineer", exact: true })).toBeChecked();
  await expect(bin.getByRole("checkbox", { name: "Select Select Second — Engineer", exact: true })).toBeChecked();
  await bin.getByText("Select Second", { exact: true }).click({ modifiers: ["Control"] });
  await expect(bin.getByRole("button", { name: "Delete selected (1)", exact: true })).toBeVisible();
  await bin.getByRole("checkbox", { name: "Select Select Second — Engineer", exact: true }).check();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("2 selected applications");
    await dialog.dismiss();
  });
  await bin.getByRole("button", { name: "Delete selected (2)", exact: true }).click();
  await expect(bin.locator("article")).toHaveCount(3);
  page.once("dialog", (dialog) => dialog.accept());
  await bin.getByRole("button", { name: "Delete selected (2)", exact: true }).click();
  await expect(bin.locator("article")).toHaveCount(1);
  await expect(bin.getByText("Empty Together", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open recycle bin" }).click();
  await expect(bin.locator("article")).toHaveCount(1);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("all applications");
    await dialog.dismiss();
  });
  await bin.getByRole("button", { name: "Empty recycle bin", exact: true }).click();
  await expect(bin.locator("article")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await bin.getByRole("button", { name: "Empty recycle bin", exact: true }).click();
  await expect(bin.getByText("The recycle bin is empty.")).toBeVisible();
  await page.reload();
  await expect(page.locator("article[data-application-id]")).toHaveCount(1);
  await expect(page.locator("article[data-application-id]")).toContainText("Keep Active");
  await page.getByRole("button", { name: "Open recycle bin" }).click();
  await expect(bin.getByText("The recycle bin is empty.")).toBeVisible();
  await expect(bin.getByRole("button", { name: "Empty recycle bin", exact: true })).toHaveCount(0);
});
