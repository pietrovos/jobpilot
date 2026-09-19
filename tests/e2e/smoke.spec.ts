import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("anonymous dashboard redirects and auth navigation renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main-content");
  await expect(page.getByRole("heading", { name: "Log in", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "No account? Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Create account", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("signup creates a secure session and persists across reload", async ({ page, context }) => {
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Smoke Pilot");
  await page.getByLabel("Email", { exact: true }).fill(`smoke-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Smoke-only-password-2026!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  const session = (await context.cookies()).find((cookie) => cookie.name === "jobpilot_session");
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
  await page.reload();
  await expect(page).toHaveURL("http://localhost:3100/");
});

test("application details open with the keyboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Keyboard Controls Company");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Accessibility Engineer");
  await creation.getByRole("button", { name: "Save application" }).click();

  const application = page.locator("article").filter({ hasText: "Keyboard Controls Company" });
  const details = application.getByRole("button", { name: "View details", exact: true });
  await details.focus();
  await details.press("Enter");
  await expect(page.getByRole("dialog", { name: "Keyboard Controls Company application details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("documents dialog receives focus and restores it when dismissed", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");

  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Documents", level: 1 })).toBeVisible();
  const trigger = page.getByRole("button", { name: "Add documents" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Add documents" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("application selection is visible and keyboard accessible", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Selection Controls Company");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Product Engineer");
  await creation.getByRole("button", { name: "Save application" }).click();

  const application = page.locator("article").filter({ hasText: "Selection Controls Company" });
  const select = application.getByRole("button", { name: "Select", exact: true });
  await select.focus();
  await select.press("Enter");
  const selected = application.getByRole("button", { name: "Selected", exact: true });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Delete selected", exact: true })).toBeVisible();
  await selected.press("Space");
  await expect(select).toHaveAccessibleName("Select");
  await expect(select).toHaveAttribute("aria-pressed", "false");
});

test("guest can create manually, keep multiline notes, restore and convert to an account", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Fictional Test Observatory");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Software Engineer");
  await creation.getByRole("button", { name: "Save application" }).click();
  await expect(creation).not.toBeVisible();
  const statusButton = page.getByRole("button", { name: "Applied" });
  await statusButton.focus();
  await statusButton.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Applied ACTIVE", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(statusButton).toBeFocused();
  await statusButton.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Applied ACTIVE", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Interviewing" })).toBeVisible();
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("button", { name: "Edit Company", exact: true })).toHaveCount(0);
  await page.getByText("Company", { exact: true }).dblclick();
  await page.getByRole("textbox", { name: "Company", exact: true }).fill("Unsaved Fictional Observatory");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const discardChanges = page.getByRole("dialog", { name: "Discard unsaved changes", exact: true });
  await expect(discardChanges).toBeVisible();
  await discardChanges.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Company", exact: true })).toHaveValue("Unsaved Fictional Observatory");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(discardChanges).toBeVisible();
  await discardChanges.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Company", exact: true })).toHaveValue("Unsaved Fictional Observatory");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(discardChanges).toBeVisible();
  await discardChanges.getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.getByText("Company", { exact: true }).dblclick();
  await page.getByRole("textbox", { name: "Company", exact: true }).evaluate((element) => {
    const input = element as HTMLInputElement;
    const form = input.closest("form");
    if (!form) throw new Error("Company editor form not found");
    form.noValidate = true;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.requestSubmit();
  });
  await expect(page.getByText("Check the application fields, dates and URLs.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Company", exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("Company", { exact: true }).dblclick();
  await page.getByRole("textbox", { name: "Company", exact: true }).fill("Renamed Fictional Observatory");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Renamed Fictional Observatory", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Interviews", exact: true }).click();
  await page.getByRole("button", { name: "Add interview", exact: true }).click();
  await page.getByLabel("Interview round name", { exact: true }).fill("Technical screen");
  await page.getByRole("button", { name: "Save interview", exact: true }).click();
  await expect(page.getByText("Technical screen", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Interview round name", { exact: true }).fill("Technical interview");
  await page.getByRole("button", { name: "Save interview", exact: true }).click();
  await expect(page.getByText("Technical interview", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to details", exact: true }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByLabel("Note title", { exact: true }).fill("Interview questions");
  const body = page.getByLabel("Note body", { exact: true });
  await body.fill("First question");
  await body.press("Enter");
  await body.pressSequentially("Second question");
  await expect(body).toHaveValue("First question\nSecond question");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(body).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Interviewing" })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm delete applications" }).getByRole("button", { name: "Delete application", exact: true }).click();
  await expect(page.getByRole("button", { name: "View details" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open recycle bin" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Recycle bin" }).getByText("The recycle bin is empty.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Converted Pilot");
  await page.getByLabel("Email", { exact: true }).fill(`converted-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Conversion-test-password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "View details" }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByText("Interview questions", { exact: true })).toBeVisible();
});

test("documents and application attachments are private to their owner", async ({ page }) => {
  const ownerEmail = `files-owner-${randomUUID()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("File Owner");
  await page.getByLabel("Email", { exact: true }).fill(ownerEmail);
  await page.getByLabel("Password", { exact: true }).fill("Files-only-password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");

  await page.goto("/documents");
  await page.getByRole("button", { name: "Add documents" }).click();
  const documentDialog = page.getByRole("dialog", { name: "Add documents" });
  await documentDialog.getByLabel("Documents, up to 10 MB each and 30 MB total").setInputFiles({
    name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("Owner resume"),
  });
  await documentDialog.getByRole("button", { name: "Upload documents", exact: true }).click();
  const documentLink = page.getByRole("link", { name: "resume.txt", exact: true });
  await expect(documentLink).toBeVisible();
  const documentUrl = await documentLink.getAttribute("href");
  expect(documentUrl).toMatch(/^\/documents\//);
  expect((await page.request.get(documentUrl!)).status()).toBe(200);
  expect((await page.request.get(`${documentUrl}/preview`)).status()).toBe(200);

  await page.goto("/");
  await page.getByRole("button", { name: "Add application", exact: true }).click();
  const creation = page.getByRole("dialog", { name: "Add application", exact: true });
  await creation.getByRole("button", { name: "Enter details manually" }).click();
  await creation.getByRole("textbox", { name: "Company", exact: true }).fill("Attachment Test Co");
  await creation.getByRole("textbox", { name: "Role", exact: true }).fill("Engineer");
  await creation.getByRole("button", { name: "Save application" }).click();
  const detailsResponse = page.waitForResponse((response) => response.request().method() === "GET" && /\/applications\/[^/]+\/details$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "View details", exact: true }).click();
  const applicationDetailsUrl = new URL((await detailsResponse).url()).pathname;
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await page.getByLabel("Attach files, up to 10 MB each and 30 MB total").setInputFiles({
    name: "cover-letter.txt", mimeType: "text/plain", buffer: Buffer.from("Owner cover letter"),
  });
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const attachmentLink = page.getByRole("link", { name: "cover-letter.txt", exact: true });
  await expect(attachmentLink).toBeVisible();
  const attachmentUrl = await attachmentLink.getAttribute("href");
  expect(attachmentUrl).toMatch(/^\/files\//);
  expect((await page.request.get(attachmentUrl!)).status()).toBe(200);
  expect((await page.request.get(`${attachmentUrl}/preview`)).status()).toBe(200);
  expect((await page.request.get(attachmentUrl!, { headers: { Range: "bytes=0-4" } })).status()).toBe(206);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm delete applications" }).getByRole("button", { name: "Delete application", exact: true }).click();
  expect((await page.request.get(applicationDetailsUrl)).status()).toBe(404);
  expect((await page.request.get(attachmentUrl!)).status()).toBe(404);
  await page.getByRole("button", { name: "Open recycle bin" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.keyboard.press("Escape");
  expect((await page.request.get(attachmentUrl!)).status()).toBe(200);

  await page.getByRole("button", { name: "Account options" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get(applicationDetailsUrl)).status()).toBe(404);
  expect((await page.request.get(documentUrl!)).status()).toBe(401);
  expect((await page.request.get(`${documentUrl}/preview`)).status()).toBe(401);
  expect((await page.request.get(attachmentUrl!)).status()).toBe(401);
  expect((await page.request.get(`${attachmentUrl}/preview`)).status()).toBe(401);

  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Other Account");
  await page.getByLabel("Email", { exact: true }).fill(`files-other-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Other-files-password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  expect((await page.request.get(applicationDetailsUrl)).status()).toBe(404);
  expect((await page.request.get(documentUrl!)).status()).toBe(404);
  expect((await page.request.get(`${documentUrl}/preview`)).status()).toBe(404);
  expect((await page.request.get(attachmentUrl!)).status()).toBe(404);
  expect((await page.request.get(`${attachmentUrl}/preview`)).status()).toBe(404);
});

test("account controls rotate credentials, revoke old sessions, export and delete", async ({ page, context, browser }) => {
  const email = `settings-${randomUUID()}@example.test`;
  const password = "Settings-only-password!";
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Settings Pilot");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  const oldSession = await browser.newContext({ storageState: await context.storageState() });
  try {
    await page.goto("/settings");
    await page.getByLabel("Current password", { exact: true }).fill(password);
    await page.getByLabel("New password", { exact: true }).fill("New-settings-password!");
    await page.getByLabel("Confirm new password", { exact: true }).fill("New-settings-password!");
    await page.getByRole("button", { name: "Change password", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Password changed. Other sessions have been revoked.");
    expect((await oldSession.request.get("http://localhost:3100/settings/export")).status()).toBe(401);
    const exported = await context.request.get("/settings/export");
    expect(exported.status()).toBe(200);
    const data = await exported.json();
    expect(data.account.email).toBe(email);
    expect(JSON.stringify(data)).not.toContain("passwordHash");
    await page.getByLabel("Current password to delete account", { exact: true }).fill("New-settings-password!");
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Permanently delete account" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.request.get("/settings/export")).status()).toBe(401);
  } finally {
    await oldSession.close();
  }
});
