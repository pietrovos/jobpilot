import { expect, test } from "./fixtures";

test("notes tree expands folders independently and moves notes between folders and root", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Tree Example");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
  await creation.getByRole("button", { name: "Save application" }).click();
  await page.getByRole("button", { name: "View details", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Tree Example application details" });
  await details.getByRole("button", { name: "Notes", exact: true }).click();
  await details.getByRole("button", { name: "New note", exact: true }).click();
  await details.getByLabel("Note title", { exact: true }).fill("Draggable research");
  await details.getByLabel("Note body", { exact: true }).fill("Keep this content when moving.");
  await details.getByRole("button", { name: "Save note", exact: true }).click();
  const tree = details.getByRole("tree", { name: "Notes explorer" });
  const note = tree.getByRole("treeitem", { name: "Draggable research", exact: true });
  await expect(note).toBeVisible();
  for (const folder of ["Research", "Interviews"]) {
    await details.getByRole("button", { name: "New folder", exact: true }).click();
    await details.getByLabel("Folder name", { exact: true }).fill(folder);
    await details.getByRole("button", { name: "Create folder", exact: true }).click();
    await expect(tree.getByRole("treeitem", { name: new RegExp(folder) })).toBeVisible();
  }
  const research = tree.getByRole("treeitem", { name: /Research/ });
  const interviews = tree.getByRole("treeitem", { name: /Interviews/ });
  // Native browser dragging onto a collapsed folder must refresh the current view.
  await note.dragTo(research);
  await expect(research).toHaveAttribute("aria-expanded", "true");
  await expect(research.locator("../..").getByRole("group").getByRole("treeitem", { name: "Draggable research" })).toBeVisible();
  await interviews.click();
  await expect(interviews).toHaveAttribute("aria-expanded", "true");
  await expect(research).toHaveAttribute("aria-expanded", "true");
  await note.dragTo(interviews);
  await expect(interviews.locator("../..").getByRole("group").getByRole("treeitem", { name: "Draggable research" })).toBeVisible();
  await expect(research.locator("../..").getByRole("treeitem", { name: "Draggable research" })).toHaveCount(0);
  await note.dragTo(details.getByRole("button", { name: "Notes root — drop notes here to move out of folders", exact: true }));
  await expect(note).toHaveAttribute("aria-level", "1");
  await note.click();
  await expect(details.locator("aside").getByText("Keep this content when moving.", { exact: true })).toBeVisible();
  // The folder picker also supports touch and keyboard moves.
  const picker = details.getByLabel("Move note to folder", { exact: true });
  await picker.selectOption({ label: "Research" });
  await expect(note).toHaveAttribute("aria-level", "2");
  await picker.selectOption({ label: "Notes root" });
  await expect(note).toHaveAttribute("aria-level", "1");
  await research.focus();
  await research.press("ArrowLeft");
  await expect(research).toHaveAttribute("aria-expanded", "false");
  await research.press("ArrowRight");
  await expect(research).toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await page.getByRole("button", { name: "View details", exact: true }).click();
  await details.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(note).toHaveAttribute("aria-level", "1");
});
