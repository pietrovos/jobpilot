import { expect, test } from "./fixtures";

test("the dashboard switches between card, compact and board layouts and remembers the choice", async ({ page, isMobile }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();

  for (const company of ["Fictional Orchard Labs", "Fictional Lunar Maps"]) {
    await page.getByRole("button", { name: "Add application", exact: true }).click();
    const creation = page.getByRole("dialog", { name: "Add application", exact: true });
    await creation.getByRole("button", { name: "Enter details manually" }).click();
    await creation.getByRole("textbox", { name: "Company", exact: true }).fill(company);
    await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
    await creation.getByRole("button", { name: "Save application" }).click();
    await expect(creation).not.toBeVisible();
  }

  const layouts = page.getByRole("group", { name: "Layout" });
  await expect(layouts.getByRole("button", { name: "Cards", pressed: true })).toBeVisible();

  await layouts.getByRole("button", { name: "Compact" }).click();
  await expect(layouts.getByRole("button", { name: "Compact", pressed: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Fictional Orchard Labs application" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await layouts.getByRole("button", { name: "Board" }).click();
  const applied = page.getByRole("region", { name: "Applied applications" });
  const offer = page.getByRole("region", { name: "Offer applications" });
  await expect(applied.getByRole("article")).toHaveCount(2);
  await expect(offer.getByText("Drag applications here")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The choice survives a reload.
  await page.reload();
  await expect(layouts.getByRole("button", { name: "Board", pressed: true })).toBeVisible();

  // Arrow keys follow the on-screen order.
  const first = applied.getByRole("article").first();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(applied.getByRole("article").nth(1)).toBeFocused();

  if (!isMobile) {
    await page.getByRole("article", { name: "Fictional Lunar Maps application" }).dragTo(offer);
    await expect(offer.getByRole("article", { name: "Fictional Lunar Maps application" })).toBeVisible();
    await expect(page.getByText("Fictional Lunar Maps moved to Offer.")).toBeVisible();
    await page.reload();
    await expect(offer.getByRole("article", { name: "Fictional Lunar Maps application" })).toBeVisible();
    await expect(applied.getByRole("article")).toHaveCount(1);
  }

  await layouts.getByRole("button", { name: "Cards" }).click();
  await expect(page.getByRole("region", { name: /Applications applied/ })).toBeVisible();
});
