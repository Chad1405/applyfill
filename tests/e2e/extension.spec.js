// End-to-end: loads the unpacked extension in Chromium, opens a page, injects ApplyFill the way the
// toolbar button does, presses "Fill N quick fields" and checks what landed in the form.
import { expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fixtures, KEY2TRUTH } from "../accuracy.js";
import { test, ROOT, PROFILE, runApplyFill } from "./fixture.js";

const TRUTH2KEY = Object.fromEntries(Object.entries(KEY2TRUTH).map(([k, t]) => [t, k]));

test("fills React-controlled inputs and custom dropdowns so React state updates", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.route("https://react-test.greenhouse.io/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/react.js") return route.fulfill({ path: path.join(ROOT, "node_modules/react/umd/react.development.js") });
    if (p === "/react-dom.js") return route.fulfill({ path: path.join(ROOT, "node_modules/react-dom/umd/react-dom.development.js") });
    return route.fulfill({ path: path.join(import.meta.dirname, "react-form.html") });
  });
  await page.goto("https://react-test.greenhouse.io/apply");
  await runApplyFill(page, sw);
  const state = JSON.parse(await page.locator("#state").textContent());
  expect(state).toEqual({ firstName: "Ada", email: "ada@example.com", lastName: "Lovelace", noticePeriod: "1 month", country: "United Kingdom", wdCountry: "United Kingdom" });
});

// The captured real forms, served offline with their scripts removed (so this checks what the
// extension writes, not the sites' own JavaScript). Scored per site like the unit accuracy test.
test("fill accuracy on captured real forms", async ({ context, sw }) => {
  test.setTimeout(240000);
  const results = {};
  for (const [site, form] of fixtures()) {
    const html = fs.readFileSync(path.join(ROOT, "tests/fixtures", site, form + ".html"), "utf8").replace(/<script\b[\s\S]*?<\/script>/gi, "");
    const labels = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures", site, form + ".fields.json"), "utf8")).fields;
    const page = await context.newPage();
    // any host the extension has permission for will do; *.teamtailor.com is one
    const url = `https://applyfill-e2e.teamtailor.com/${site}/${form}`;
    await page.route("**/*", r => r.request().url() === url ? r.fulfill({ body: html, contentType: "text/html" }) : r.abort());
    await page.goto(url);
    const read = () => page.evaluate(ids => ids.map(id => {
      const el = document.querySelector(`[data-af-id="${id}"]`);
      if (el.type === "radio") { const c = [...document.getElementsByName(el.name)].find(r => r.checked); if (!c) return ""; const lab = c.labels[0] || document.querySelector(`label[for="${CSS.escape(c.value)}"]`); return lab ? lab.innerText : c.value; }
      if (el.tagName === "SELECT") return el.selectedIndex > 0 ? el.options[el.selectedIndex].text : "";
      return el.type === "checkbox" || el.type === "file" ? "" : el.value;
    }), labels.map(l => l.id));
    const before = await read();
    await runApplyFill(page, sw);
    const got = (await read()).map((v, i) => v === before[i] ? "" : v); // only what ApplyFill changed
    const r = results[site] = results[site] || { tp: 0, fp: 0, fn: 0, failures: [] };
    labels.forEach((l, i) => {
      if (l.truth === "skip") return;
      const want = l.truth === "none" ? "" : PROFILE[TRUTH2KEY[l.truth] || l.truth] || "";
      const v = (got[i] || "").trim().toLowerCase(), w = want.toLowerCase();
      const ok = want && v && (v === w || v.startsWith(w) || w.startsWith(v));
      if (ok) r.tp++;
      else if (v || want) { if (v) r.fp++; if (want) r.fn++; r.failures.push(`${form}: ${l.label.replace(/\s+/g, " ").slice(0, 60)} → expected "${want}", got "${got[i] || ""}"`); }
    });
    await page.close();
  }
  const rows = Object.entries(results).map(([s, r]) => ({ site: s, precision: r.tp / (r.tp + r.fp || 1), recall: r.tp / (r.tp + r.fn || 1), ...r }));
  fs.writeFileSync(path.join(ROOT, "tests/e2e-report.json"), JSON.stringify(rows, null, 1) + "\n");
  const basePath = path.join(ROOT, "tests/baseline-e2e.json");
  if (process.env.UPDATE_BASELINE) fs.writeFileSync(basePath, JSON.stringify(Object.fromEntries(rows.map(r => [r.site, { precision: r.precision, recall: r.recall }])), null, 1) + "\n");
  const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
  for (const r of rows) {
    expect.soft(r.precision, `${r.site} fill precision`).toBeGreaterThanOrEqual(base[r.site].precision - 1e-9);
    expect.soft(r.recall, `${r.site} fill recall`).toBeGreaterThanOrEqual(base[r.site].recall - 1e-9);
  }
});

test("filling a saved answer logs which answer went to which company", async ({ context, sw }) => {
  const page = await context.newPage();
  await page.route("**/*", r => r.fulfill({ path: path.join(ROOT, "tests/injection/question-label.html"), contentType: "text/html" }));
  await page.goto("https://northwind.teamtailor.com/jobs/1-data-analyst/applications/new");
  await page.bringToFront();
  await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); await inject(t.id); });
  const panel = page.locator("#applyfill-host");
  await panel.locator("#c-co").fill("Northwind Trading");
  const item = panel.locator(".it").filter({ hasText: /Why do you want/ });
  await item.getByRole("button", { name: "Fill", exact: true }).click();
  await expect.poll(() => sw.evaluate(() => chrome.storage.local.get("fillLog").then(d => d.fillLog))).toEqual([
    expect.objectContaining({ company: "Northwind Trading", url: "https://northwind.teamtailor.com/jobs/1-data-analyst/applications/new",
      answers: [expect.objectContaining({ answer: "Why this company", edited: false })] })]);
});
