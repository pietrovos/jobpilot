import { expect, test } from "./fixtures";

test.use({ timezoneId: "America/New_York" });

test("applications can be collapsed and expanded by applied day", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();

  for (const company of ["First Company", "Second Company"]) {
    await page.getByRole("button", { name: "Add application", exact: true }).click();
    const creation = page.getByRole("dialog", { name: "Add application", exact: true });
    await creation.getByRole("button", { name: "Enter details manually" }).click();
    await creation.getByRole("textbox", { name: "Company", exact: true }).fill(company);
    await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
    await creation.getByRole("button", { name: "Save application" }).click();
    await expect(creation).not.toBeVisible();
  }

  const group = page.getByRole("region", { name: /Applications applied/ });
  const toggle = group.getByRole("button", { name: /\(2\)/ });
  const localDay = await page.evaluate(() => new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()));
  await expect(toggle).toContainText(localDay);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(group.getByRole("article")).toHaveCount(2);
  await expect(group.getByText(/Applied .* (EST|EDT)/).first()).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(group.getByRole("article")).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(group.getByRole("article")).toHaveCount(2);
});
