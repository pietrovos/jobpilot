// Runs on the job page in the user's browser, where the posting is already loaded
// and any bot check or login has been passed. It reads the page and opens
// JobPilot's /capture page with the result in the URL fragment, which browsers
// never send to a server. Opening a window is not limited by the job site's
// Content-Security-Policy the way a direct request to JobPilot would be.
const captureScript = `(() => {
  const text = (el) => ((el && el.innerText) || "").trim();
  const pick = (selectors) => {
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const value = text(el);
        if (value) return value;
      }
    }
    return "";
  };
  // Only accept a description container long enough to be the real posting, so a
  // tiny stray match cannot win over the actual job description.
  const pickLong = (selectors, minLength) => {
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const value = text(el);
        if (value.length >= minLength) return value;
      }
    }
    return "";
  };
  // The company is usually a link to its profile next to the job title.
  const companyNearHeading = () => {
    let node = document.querySelector("h1");
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      const link = node.querySelector('a[href*="/company/"]');
      if (text(link)) return text(link);
    }
    return "";
  };
  const meta = {};
  for (const tag of document.querySelectorAll("meta[property],meta[name]")) {
    const name = (tag.getAttribute("property") || tag.getAttribute("name") || "").toLowerCase();
    if (/^(og:|twitter:)|^description$/.test(name) && tag.content && Object.keys(meta).length < 40) meta[name.slice(0, 100)] = tag.content.slice(0, 1000);
  }
  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => script.textContent || "")
    .filter((json) => /jobposting/i.test(json) && json.length <= 20000)
    .slice(0, 3);
  const selection = String(getSelection() || "").trim();
  // A user selection is deliberate, so trust it; otherwise read only a container
  // that is actually a job description. Broad elements like main/article are
  // deliberately excluded: they captured whole pages and hid the real posting.
  const description = selection.length >= 80 ? selection : pickLong([
    "#jobDescriptionText",
    "[data-testid='jobsearch-JobComponent-description']",
    "[data-automation-id='jobPostingDescription']",
    "[data-automation-id*='jobPostingDescription']",
    "#job-details",
    "[class*='jobs-description-content']",
    "[class*='jobs-description__content']",
    "[class*='jobs-box__html-content']",
    ".show-more-less-html__markup",
    "[class*='description__text']",
    "[class*='job__description']",
    "#app_body",
    "[data-testid*='jobDescription']",
    "[data-testid*='job-description']",
    "[id*='job-description']",
    "[id*='jobDescription']",
    "[class*='jobDescription']",
    "[class*='job-description']",
  ], 40);
  const payload = {
    v: 1,
    url: location.href.slice(0, 2048),
    title: document.title.slice(0, 300),
    h1: text(document.querySelector("h1")).slice(0, 300),
    company: (pick([".job-details-jobs-unified-top-card__company-name", ".jobs-unified-top-card__company-name", "[data-testid='inlineHeader-companyName']", "[data-company-name]", ".topcard__org-name-link"]) || companyNearHeading()).slice(0, 200),
    location: pick(["[data-testid='inlineHeader-companyLocation']", "[data-testid='job-location']", ".job-details-jobs-unified-top-card__tertiary-description-container", ".job-details-jobs-unified-top-card__bullet", ".topcard__flavor--bullet"]).slice(0, 200),
    description: description.slice(0, 20000),
    meta,
    ld,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const target = "__ORIGIN__/capture#" + btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
  if (!window.open(target, "_blank")) location.href = target;
})();`;

export function bookmarkletHref(origin: string) {
  return `javascript:${encodeURIComponent(captureScript.replace("__ORIGIN__", origin))}`;
}

export function decodeCapturePayload(fragment: string): unknown {
  const base64 = fragment.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
}
