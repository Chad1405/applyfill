// Scores APPLYFILL_FIELDS against the labelled fixtures in tests/fixtures/<site>/<name>.*
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const FIX = path.join(import.meta.dirname, "fixtures");
const SRC = fs.readFileSync(process.env.APPLYFILL_FIELDS_SRC || path.join(import.meta.dirname, "../extension/fields.js"), "utf8");

// Profile key -> label used in fixtures (the HTML autocomplete name where one exists).
export const KEY2TRUTH = {
  firstName: "given-name", lastName: "family-name", fullName: "name", email: "email", phone: "tel", phoneIntl: "tel-country-code",
  city: "address-level2", country: "country-name", postcode: "postal-code", address: "street-address", website: "url",
  currentCompany: "organization", currentTitle: "organization-title"
};
const truthOf = k => k ? KEY2TRUTH[k] || k : "none";

export function loadFixture(site, name) {
  const html = fs.readFileSync(path.join(FIX, site, name + ".html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/" });
  dom.window.eval(SRC);
  const labels = JSON.parse(fs.readFileSync(path.join(FIX, site, name + ".fields.json"), "utf8")).fields;
  return { dom, api: dom.window.APPLYFILL_FIELDS, labels };
}

export function fixtures() {
  return fs.readdirSync(FIX).flatMap(site => fs.readdirSync(path.join(FIX, site))
    .filter(f => f.endsWith(".fields.json")).map(f => [site, f.replace(".fields.json", "")]));
}

// Returns one row per scored field: { site, form, id, label, truth, pred }
export function predictions() {
  const rows = [];
  for (const [site, form] of fixtures()) {
    const { dom, api, labels } = loadFixture(site, form);
    const truth = Object.fromEntries(labels.map(l => [l.id, l.truth]));
    const found = api.scan({ visible: el => el.hasAttribute("data-af-id") });
    const seen = new Set();
    for (const f of found) {
      const els = f.opts || [f.el];
      els.forEach(e => seen.add(e.getAttribute("data-af-id")));
      const id = f.el.getAttribute("data-af-id"), t = truth[id];
      if (!t || t === "skip") continue;
      rows.push({ site, form, id, label: f.label, truth: t, pred: truthOf(api.classify(f)) });
    }
    // labelled fields the scanner never picked up count as misses
    for (const l of labels) if (!seen.has(l.id) && l.truth !== "none" && l.truth !== "skip")
      rows.push({ site, form, id: l.id, label: l.label, truth: l.truth, pred: "none", unseen: true });
    dom.window.close();
  }
  return rows;
}

const pr = (tp, fp, fn) => ({ tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 });
function tally(rows) {
  let tp = 0, fp = 0, fn = 0;
  for (const r of rows) { if (r.pred !== "none" && r.pred === r.truth) tp++; else { if (r.pred !== "none") fp++; if (r.truth !== "none") fn++; } }
  return pr(tp, fp, fn);
}

export function score(rows = predictions()) {
  const types = [...new Set(rows.flatMap(r => [r.truth, r.pred]).filter(t => t !== "none"))].sort();
  const byType = Object.fromEntries(types.map(t => [t, tally(rows.filter(r => r.truth === t || r.pred === t).map(r => ({ truth: r.truth === t ? t : "none", pred: r.pred === t ? t : "none" })))]));
  const bySite = Object.fromEntries([...new Set(rows.map(r => r.site))].map(s => [s, tally(rows.filter(r => r.site === s))]));
  const failures = rows.filter(r => r.pred !== r.truth);
  return { overall: tally(rows), byType, bySite, failures };
}

const pct = x => (x * 100).toFixed(0) + "%";
export function markdown(s) {
  const t = (title, o) => [`| ${title} | Precision | Recall | TP | FP | FN |`, "|---|---|---|---|---|---|",
    ...Object.entries(o).map(([k, v]) => `| ${k} | ${pct(v.precision)} | ${pct(v.recall)} | ${v.tp} | ${v.fp} | ${v.fn} |`)].join("\n");
  return [t("Site", { ...s.bySite, "**All**": s.overall }), "", t("Field type", s.byType), "",
    "| Site / form | Field | Expected | Got |", "|---|---|---|---|",
    ...s.failures.map(f => `| ${f.site}/${f.form} | ${f.label.replace(/\|/g, "/").slice(0, 70)}${f.unseen ? " (not found)" : ""} | ${f.truth} | ${f.pred} |`)].join("\n");
}
