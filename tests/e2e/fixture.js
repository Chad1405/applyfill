// Shared Playwright setup: Chromium with the unpacked extension loaded and a test profile saved.
import { test as base, expect, chromium } from "@playwright/test";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
const EXT = path.join(ROOT, "extension");
export const PROFILE = {
  firstName: "Ada", lastName: "Lovelace", fullName: "Ada Lovelace", email: "ada@example.com", phone: "07700 900123",
  city: "London", country: "United Kingdom", linkedin: "https://www.linkedin.com/in/ada-example", github: "https://github.com/ada-example",
  website: "https://ada.example.com", currentCompany: "Analytical Engines Ltd", currentTitle: "Engineer", yearsExperience: "8",
  university: "University of London", noticePeriod: "1 month", salaryExpectation: "90000", rightToWork: "Yes", needsSponsorship: "No",
  pronouns: "she/her", howHeard: "LinkedIn"
};

export const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium", // the full browser: headless shell can't load extensions
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await sw.evaluate(p => chrome.storage.local.set({ profile: p }), PROFILE);
    await use(sw);
  }
});

// What the toolbar click does: inject into the active tab (background.js's inject()).
export async function runApplyFill(page, sw) {
  await page.bringToFront();
  await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); await inject(t.id); });
  const panel = page.locator("#applyfill-host");
  await panel.locator("#fillall").click();
  await expect(panel.locator(".hint.flash")).toContainText(/Filled \d+ field/, { timeout: 30000 });
}

export { expect };
