// Live check against the real sites (their own React code running): fills, never submits.
// Off by default because live pages change; run with LIVE=1 npx playwright test live
import { test, expect, runApplyFill } from "./fixture.js";

const PAGES = [
  ["greenhouse", "https://job-boards.greenhouse.io/gitlab/jobs/8860302002"],
  ["lever", "https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply"],
  ["ashby", "https://jobs.ashbyhq.com/notion/1fc309c8-da20-4ff2-84c7-8b863ece2b0a/application"]
];
test.skip(!process.env.LIVE, "set LIVE=1 to run against the live sites");

for (const [site, url] of PAGES) test(`live ${site}: filled values survive the site's own re-renders`, async ({ context, sw }) => {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("button:has-text('Apply')").first().click({ timeout: 5000 }).catch(() => {});
  await runApplyFill(page, sw);
  // Click away and wait: a controlled input whose framework missed the change snaps back to empty here.
  await page.mouse.click(5, 5); await page.waitForTimeout(1500);
  const values = await page.evaluate(() => [...document.querySelectorAll("input[type=text], input[type=email], input[type=tel], input:not([type])")]
    .filter(e => e.offsetParent).map(e => e.value).filter(Boolean));
  // what the site itself now shows in its custom dropdowns (react-select renders the pick as *single-value*)
  const shown = await page.locator("[class*='single-value'], [class*='singleValue']").allTextContents();
  const status = await page.locator("#applyfill-host .it").evaluateAll(its => its.map(i => [i.querySelector(".lbl b").textContent.slice(0, 60), i.querySelector(".st")?.textContent]).filter(([, s]) => s));
  console.log(site, JSON.stringify({ values, shown, status }, null, 1));
  expect(values).toContain("ada@example.com"); expect(values.join("|")).toMatch(/\bAda\b/);
  expect(status.filter(([, s]) => /^Typed it in/.test(s))).toEqual([]); // every dropdown got an option picked
  if (site === "greenhouse") expect(shown.join("|")).toMatch(/United Kingdom.*\|No\|United Kingdom|No.*United Kingdom/s); // and react-select shows it
});
