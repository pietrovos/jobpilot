import { expect, test } from "./fixtures";

test("a saved job link fills its ID and shows the source in details", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Example Co");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
  await creation.getByRole("textbox", { name: "Job posting link (optional)" }).fill("https://www.indeed.com/viewjob?jk=abc123def");
  await creation.getByRole("button", { name: "Save application" }).click();
  await expect(creation).not.toBeVisible();

  await page.getByRole("button", { name: "View details", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Example Co application details" });
  await details.getByRole("button", { name: "Additional details", exact: true }).click();
  await expect(details.getByRole("group", { name: "Job ID" })).toContainText("abc123def (Indeed)");
});
