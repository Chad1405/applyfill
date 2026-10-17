// Captures live application forms into tests/fixtures/<site>/<name>.{html,aria.yml,fields.json}.
// Usage: node scripts/capture.mjs [site]   (needs `npx playwright install chromium`)
//        node scripts/capture.mjs --manual <site> <name> <url>
// --manual opens a visible browser with its own profile in .capture-profile/. Sign in, solve any
// CAPTCHA and click through to the form yourself, then press Enter here to save the page. Workday
// (account wall), SmartRecruiters (DataDome CAPTCHA) and most webITrent forms (registration) need it.
// Every visible form control gets a data-af-id attribute before the DOM is saved, so the
// hand-written labels in fields.json can point at it. Forms named holdout-* were labelled after the
// matcher was tuned and are scored separately, as a check that it isn't fitted to the others. Existing "truth" labels are kept on re-capture.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = "tests/fixtures";
const clickIf = async (page, sel) => { const l = page.locator(sel).first(); if (await l.count()) { await l.click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(2500); } };

const TARGETS = {
  greenhouse: [
    ["gitlab", "https://job-boards.greenhouse.io/gitlab/jobs/8860302002"],
    ["discord", "https://job-boards.greenhouse.io/discord/jobs/8806482002"],
    ["monzo", "https://job-boards.greenhouse.io/monzo/jobs/8143930"],
    ["holdout-reddit", "https://job-boards.greenhouse.io/reddit/jobs/8089959"]
  ].map(([n, u]) => ({ name: n, url: u, go: p => clickIf(p, "button:has-text('Apply')") })),
  lever: [
    ["palantir", "https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply"],
    ["spotify", "https://jobs.lever.co/spotify/223f9722-3579-4ff2-b123-e4cc7b0c1a64/apply"],
    ["holdout-zoox", "https://jobs.lever.co/zoox/e8a190f0-7a89-4c11-a6a0-452ff6234749/apply"]
  ].map(([n, u]) => ({ name: n, url: u })),
  ashby: [
    ["ramp", "https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245/application"],
    ["notion", "https://jobs.ashbyhq.com/notion/1fc309c8-da20-4ff2-84c7-8b863ece2b0a/application"],
    ["linear", "https://jobs.ashbyhq.com/linear/d3bc1ced-3ce4-4086-a050-555055dbb1ff/application"],
    ["holdout-openai", "https://jobs.ashbyhq.com/openai/8fb1615c-34bf-47c4-a1d1-b7b2f836bbd3/application"]
  ].map(([n, u]) => ({ name: n, url: u })),
  teamtailor: [
    ["teamtailor", "https://career.teamtailor.com/jobs/8118064-uk-account-executive-smb"],
    ["polestar", "https://polestar.teamtailor.com/jobs/8551558-head-of-customer-engagement-benelux"],
    ["holdout-lunar", "https://jobs.lunar.app/jobs/8563466-team-lead-ongoing-due-diligence"]
  ].map(([n, u]) => ({ name: n, url: u, go: p => clickIf(p, "a:has-text('Apply'), button:has-text('Apply')") })),
  webitrent: [
    ["newark-sherwood", "https://ce0799li.webitrent.com/ce0799li_webrecruitment/wrd/run/ETREC179GF.open?WVID=3373962BPM"]
  ].map(([n, u]) => ({ name: n, url: u, go: p => clickIf(p, "a:has-text('Apply'), input[value*='Apply' i], button:has-text('Apply')") }))
};

// Runs in the page: tag visible controls and describe them for labelling.
function tagFields() {
  const out = [];
  let n = 0;
  document.querySelectorAll("input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], button[aria-haspopup='listbox']").forEach(el => {
    const type = (el.type || "").toLowerCase();
    if (el.tagName === "INPUT" && /^(hidden|submit|button|reset|image)$/.test(type)) return;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const shown = (r.width > 0 && r.height > 0 || /radio|checkbox|file/.test(type)) && cs.visibility !== "hidden" && cs.display !== "none";
    if (!shown) return;
    const id = String(++n);
    el.setAttribute("data-af-id", id);
    const lab = (el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute("aria-label") || "";
    out.push({ id, tag: el.tagName.toLowerCase(), type, name: el.name || "", elId: el.id || "", autocomplete: el.getAttribute("autocomplete") || "",
      automationId: el.getAttribute("data-automation-id") || "", label: lab.trim().slice(0, 160), placeholder: el.placeholder || "" });
  });
  return out;
}

async function capture(browser, site, t, manualPage) {
  const dir = path.join(OUT, site); fs.mkdirSync(dir, { recursive: true });
  const page = manualPage || await browser.newPage({ locale: "en-GB", viewport: { width: 1280, height: 2000 } });
  try {
    if (!manualPage) await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await clickIf(page, "button:has-text('Accept all'), button:has-text('Reject all'), #onetrust-reject-all-handler");
    if (t.go && !manualPage) await t.go(page);
    await page.waitForTimeout(2000);
    const fields = await page.evaluate(tagFields);
    const base = path.join(dir, t.name);
    fs.writeFileSync(base + ".html", `<!-- captured from ${page.url()} on ${new Date().toISOString().slice(0, 10)} -->\n` + await page.content());
    fs.writeFileSync(base + ".aria.yml", await page.locator("body").ariaSnapshot());
    const old = fs.existsSync(base + ".fields.json") ? JSON.parse(fs.readFileSync(base + ".fields.json", "utf8")) : { fields: [] };
    const truth = Object.fromEntries(old.fields.map(f => [f.id + "|" + f.name + "|" + f.label, f.truth]));
    fields.forEach(f => { f.truth = truth[f.id + "|" + f.name + "|" + f.label] ?? null; });
    fs.writeFileSync(base + ".fields.json", JSON.stringify({ site, url: page.url(), fields }, null, 1) + "\n");
    console.log(`${site}/${t.name}: ${fields.length} fields  (${page.url()})`);
  } catch (e) { console.log(`${site}/${t.name}: FAILED ${e.message.split("\n")[0]}`); }
  if (!manualPage) await page.close();
}

if (process.argv[2] === "--manual") {
  const [, , , site, name, url] = process.argv;
  const ctx = await chromium.launchPersistentContext(".capture-profile", { headless: false, locale: "en-GB", viewport: { width: 1280, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(url);
  process.stdout.write("Get to the application form in the browser, then press Enter here to capture it… ");
  await new Promise(r => process.stdin.once("data", r));
  await capture(null, site, { name }, page);
  await ctx.close(); process.exit(0);
}
const only = process.argv[2];
const browser = await chromium.launch();
for (const [site, list] of Object.entries(TARGETS)) if (!only || only === site) for (const t of list) if (!process.env.ONLY || t.name.startsWith(process.env.ONLY)) await capture(browser, site, t);
await browser.close();
