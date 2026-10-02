import { expect, test } from "@playwright/test";

test("detail workspace supports email and note editing with readable content on desktop and mobile", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Workspace Example");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Software Engineer");
  await creation.getByRole("textbox", { name: "Salary", exact: true }).fill("$90,000–$110,000");
  const description = "About the job\nBuild tools for applicants.\nCollaborate across teams.\n\nResponsibilities\n- Build accessible software\n• Collaborate with the team\n\nRequirements\nExperience with TypeScript.\n\nHiring process\n1. Introduction\n2. Technical interview";
  await creation.getByRole("textbox", { name: "Job description", exact: true }).fill(`${description}\n\n${Array.from({ length: 30 }, (_, index) => `Project context ${index + 1}: Help build accessible tools and collaborate with the engineering team.`).join("\n\n")}`);
  await creation.getByRole("button", { name: "Save application" }).click();
  await page.getByRole("button", { name: "View details", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Workspace Example application details" });
  await expect(details.getByRole("group", { name: "Job description", exact: true })).toContainText("Build accessible software");
  const scrollArea = details.getByRole("region", { name: "Job description content", exact: true });
  expect(await scrollArea.evaluate((element) => {
    element.scrollTop = 200;
    return element.scrollTop > 0 && element.scrollHeight > element.clientHeight;
  })).toBe(true);
  await expect(details.locator(".job-description-toolbar").getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  await expect(details.locator(".job-description-toolbar").getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await scrollArea.evaluate((element) => { element.scrollTop = 0; });
  const descriptionGroup = details.getByRole("group", { name: "Job description", exact: true });
  await descriptionGroup.focus();
  await descriptionGroup.press("Enter");
  await expect(details.getByRole("textbox", { name: "Job description", exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(descriptionGroup).toBeVisible();
  await scrollArea.focus();
  await scrollArea.press("ArrowRight");
  await expect(details.getByRole("button", { name: "Additional details", exact: true })).toBeFocused();
  await expect(details.getByRole("group", { name: "Company", exact: true })).toHaveCount(0);
  await expect(details.locator(".details-header-meta")).toContainText("Applied");
  await expect(details.locator(".details-header-meta")).toContainText("$90,000–$110,000");
  await details.getByRole("button", { name: "Edit Salary", exact: true }).click();
  await details.getByRole("textbox", { name: "Salary", exact: true }).fill("$100,000–$120,000");
  await details.getByRole("button", { name: "Save", exact: true }).click();
  await expect(details.locator(".details-header-meta")).toContainText("$100,000–$120,000");
  await details.getByRole("button", { name: "Additional details", exact: true }).click();
  await expect(details.getByRole("group", { name: "Company", exact: true })).toContainText("Workspace Example");
  await expect(details.getByRole("group", { name: "Job posting link", exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Back to details", exact: true }).click();
  const checkWidth = async () => {
    expect(await details.locator(".detail-workspace").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  };

  await details.getByRole("button", { name: "Email log", exact: true }).click();
  await expect(details.getByText("No emails logged yet", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "New email log", exact: true }).click();
  await details.getByLabel("Subject", { exact: true }).fill("Interview invitation");
  await details.getByLabel("Email notes", { exact: true }).fill("Prepare a project walkthrough.\nAsk about the team.");
  await details.getByRole("button", { name: "Save email log", exact: true }).click();
  await expect(details.locator(".workspace-prose").getByText("Prepare a project walkthrough.\nAsk about the team.", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Edit email log", exact: true }).click();
  await details.getByLabel("Subject", { exact: true }).fill("Updated invitation");
  await details.getByRole("button", { name: "Save email log", exact: true }).click();
  await expect(details.locator(".workspace-reading-title")).toHaveText("Updated invitation");
  await checkWidth();

  await details.getByRole("button", { name: "Back to details" }).click();
  await details.getByRole("button", { name: "Notes", exact: true }).click();
  await details.getByRole("button", { name: "New note" }).click();
  await details.getByLabel("Note title", { exact: true }).fill("Company research");
  await details.getByLabel("Note body", { exact: true }).fill("Review the engineering blog.");
  await details.getByRole("button", { name: "Save note" }).click();
  await details.getByRole("treeitem", { name: "Company research", exact: true }).click();
  await expect(details.locator("aside").getByText("Review the engineering blog.", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Edit note", exact: true }).click();
  await details.getByLabel("Note body", { exact: true }).fill("Research updated.");
  await details.getByRole("button", { name: "Save note" }).click();
  await expect(details.locator("aside").getByText("Research updated.", { exact: true })).toBeVisible();
  await checkWidth();

  await details.getByRole("button", { name: "Back to details" }).click();
  await expect(details.getByText("Build accessible software", { exact: false })).toBeVisible();
  await expect(details.getByText(/\d+ words|\d+ min read/)).toHaveCount(0);
  await expect(details.getByRole("heading", { name: "Job description", exact: true })).toHaveCount(0);
  const reader = details.locator(".job-description-reader");
  await expect(reader.getByRole("heading", { name: "About the job", exact: true })).toBeVisible();
  await expect(reader.getByText("Build tools for applicants. Collaborate across teams.", { exact: true })).toBeVisible();
  await expect(reader.locator("ul li")).toHaveText(["Build accessible software", "Collaborate with the team"]);
  await expect(reader.locator("ol li")).toHaveText(["Introduction", "Technical interview"]);
  await checkWidth();
  await details.getByRole("button", { name: "Files", exact: true }).click();
  await expect(details.getByText("No files uploaded yet.", { exact: true })).toBeVisible();
  await checkWidth();
  await details.getByRole("button", { name: "Back to details" }).click();
  await details.getByRole("button", { name: "History", exact: true }).click();
  await expect(details.locator(".detail-history li")).toHaveCount(1);
  await expect(details.getByText("Status changed to · Latest update", { exact: true })).toBeVisible();
  await checkWidth();
});


