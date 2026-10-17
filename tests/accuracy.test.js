import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { score, markdown } from "./accuracy.js";

const BASE = path.join(import.meta.dirname, "baseline.json");

test("field matching does not fall below the recorded baseline", () => {
  const s = score();
  fs.writeFileSync(path.join(import.meta.dirname, "accuracy-report.md"), markdown(s) + "\n");
  const now = { precision: s.overall.precision, recall: s.overall.recall,
    bySite: Object.fromEntries(Object.entries(s.bySite).map(([k, v]) => [k, { precision: v.precision, recall: v.recall }])) };
  if (process.env.UPDATE_BASELINE) fs.writeFileSync(BASE, JSON.stringify(now, null, 1) + "\n");
  const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
  const eps = 1e-9;
  expect(now.precision).toBeGreaterThanOrEqual(base.precision - eps);
  expect(now.recall).toBeGreaterThanOrEqual(base.recall - eps);
  for (const [site, b] of Object.entries(base.bySite)) {
    expect(now.bySite[site]?.precision, `${site} precision`).toBeGreaterThanOrEqual(b.precision - eps);
    expect(now.bySite[site]?.recall, `${site} recall`).toBeGreaterThanOrEqual(b.recall - eps);
  }
}, 60000);
