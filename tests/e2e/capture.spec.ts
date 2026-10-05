import { expect, test, type Page } from "./fixtures";

// An invented posting laid out like a site that blocks server-side fetches.
const jobPage = `<!doctype html><html><head><title>Developer Experience Engineer - Remote | Fictional Board</title></head>
<body><main>
  <h1>Developer Experience Engineer</h1>
  <div data-testid="inlineHeader-companyName">Fictional Signal Bakery</div>
  <div data-testid="inlineHeader-companyLocation">Remote, Canada</div>
  <div id="jobDescriptionText"><p>Improve invented developer tools.</p><ul><li>TypeScript</li><li>Documentation</li></ul></div>
</main></body></html>`;

async function bookmarkletCode(page: Page) {
  await page.goto("/bookmarklet");
  const link = page.getByTestId("bookmarklet");
  await expect(link).toHaveAttribute("href", /^javascript:/);
  const href = (await link.getAttribute("href"))!;
  return decodeURIComponent(href.slice("javascript:".length));
}

test("Save to JobPilot captures a blocked job page, survives login and prefills the form", async ({ page, context }) => {
  const code = await bookmarkletCode(page);
  await context.route("https://jobs.fictional.test/**", (route) => route.fulfill({ contentType: "text/html", body: jobPage }));
  await page.goto("https://jobs.fictional.test/viewjob?jk=f1c71a0a5e");

  const popupPromise = context.waitForEvent("page");
  await page.evaluate(code);
  const popup = await popupPromise;

  // Signed out: the capture is kept while the user logs in or continues as a guest.
  await expect(popup).toHaveURL(/\/login\?next=%2Fcapture|\/login\?next=\/capture/);
  await popup.getByRole("button", { name: "Continue as guest" }).click();
  await expect(popup).toHaveURL("http://localhost:3100/capture");

  const dialog = popup.getByRole("dialog", { name: "Add application" });
  await expect(dialog.getByText("Saved from jobs.fictional.test")).toBeVisible();
  await expect(dialog.getByLabel("Company", { exact: true })).toHaveValue("Fictional Signal Bakery");
  await expect(dialog.getByLabel("Role", { exact: true })).toHaveValue("Developer Experience Engineer");
  await expect(dialog.getByLabel("Location", { exact: true })).toHaveValue("Remote, Canada");
  await expect(dialog.getByLabel("Job ID (optional)", { exact: true })).toHaveValue("f1c71a0a5e");

  await dialog.getByRole("button", { name: "Save application" }).click();
  await expect(popup).toHaveURL("http://localhost:3100/");
  await expect(popup.getByText("Fictional Signal Bakery").first()).toBeVisible();
});

test("Save to JobPilot captures only the job description, not the whole page", async ({ page, context }) => {
  const code = await bookmarkletCode(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await context.route("https://jobs.fictional.test/**", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><title>Cloud Engineer | Fictional Vertex | LinkedIn</title></head><body><main>
    <div>Jobs based on your preferences. 99+ results. Back End Developer. Frontend Developer. Many unrelated job cards.</div>
    <h1>Cloud Engineer</h1>
    <div data-testid="inlineHeader-companyName">Fictional Vertex</div>
    <div data-testid="inlineHeader-companyLocation">Kanata, ON (Hybrid)</div>
    <div class="jobs-description-content__text"><p>Seeking a Cloud Engineer with GCP, Java/Python, Kubernetes, and CI/CD.</p></div>
    <div>More unrelated page footer links and recommendations.</div>
  </main></body></html>` }));
  await page.goto("https://jobs.fictional.test/jobs/view/4470712481/");

  const popupPromise = context.waitForEvent("page");
  await page.evaluate(code);
  const popup = await popupPromise;
  const dialog = popup.getByRole("dialog", { name: "Add application" });
  const description = dialog.getByLabel("Job description", { exact: true });
  await expect(description).toHaveValue(/Seeking a Cloud Engineer with GCP/);
  await expect(description).not.toHaveValue(/Jobs based on your preferences/);
});

test("opening the capture page without a capture explains how to use the button", async ({ page }) => {
  await page.goto("/capture");
  await expect(page.getByText("Nothing was captured.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Save to JobPilot" })).toHaveAttribute("href", "/bookmarklet");
});

test("Save to JobPilot finds the company from the profile link beside the job title", async ({ page, context }) => {
  const code = await bookmarkletCode(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await context.route("https://social.fictional.test/**", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><title>Notifications</title></head><body>
    <section><div><h1>Cloud Engineer</h1><div><a href="https://social.fictional.test/company/fictional-vertex/life/">Fictional Vertex</a></div></div>
    <article>Build invented cloud platforms for a fictional team.</article></section></body></html>` }));
  await page.goto("https://social.fictional.test/jobs/view/123456/");

  const popupPromise = context.waitForEvent("page");
  await page.evaluate(code);
  const popup = await popupPromise;
  const dialog = popup.getByRole("dialog", { name: "Add application" });
  await expect(dialog.getByLabel("Company", { exact: true })).toHaveValue("Fictional Vertex");
  await expect(dialog.getByLabel("Role", { exact: true })).toHaveValue("Cloud Engineer");
});

test("Save to JobPilot shows the job site beside the ID and refuses a job already saved", async ({ page, context }) => {
  const code = await bookmarkletCode(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await context.route("https://jobs.fictional.test/**", (route) => route.fulfill({ contentType: "text/html", body: jobPage }));
  await page.goto("https://jobs.fictional.test/viewjob?jk=d0bb1e5a7e");

  const firstPromise = context.waitForEvent("page");
  await page.evaluate(code);
  const first = await firstPromise;
  const dialog = first.getByRole("dialog", { name: "Add application" });
  await expect(dialog.getByLabel("Job ID (optional)", { exact: true })).toHaveValue("d0bb1e5a7e");
  await expect(dialog.getByText("(fictional)", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save application" }).click();
  await expect(first).toHaveURL("http://localhost:3100/");

  const secondPromise = context.waitForEvent("page");
  await page.evaluate(code);
  const second = await secondPromise;
  await expect(second.getByText("You already saved this job: Developer Experience Engineer at Fictional Signal Bakery, job ID d0bb1e5a7e (fictional).")).toBeVisible();
  await expect(second.getByRole("dialog", { name: "Add application" })).toHaveCount(0);
});
