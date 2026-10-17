import { test, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(path.join(import.meta.dirname, "../extension/fields.js"), "utf8");
function page(html) {
  const dom = new JSDOM(`<body>${html}</body>`, { runScripts: "outside-only" });
  dom.window.eval(SRC);
  const api = dom.window.APPLYFILL_FIELDS;
  const fields = api.scan({ visible: () => true });
  return { dom, api, fields, doc: dom.window.document };
}

test("signals are ranked: autocomplete > accessible name > label text > name/id > site hook", () => {
  const { api, fields } = page(`
    <label for="a">Email</label><input id="a" autocomplete="given-name">
    <div><span class="label">Phone</span><input aria-label="Last name" name="email"></div>
    <div><span class="label">Postcode</span><input name="city"></div>
    <input name="candidate[first_name]" data-automation-id="email">
    <input data-automation-id="addressSection_city">`);
  expect(fields.map(f => api.explain(f))).toEqual([
    { key: "firstName", signal: "autocomplete" },
    { key: "lastName", signal: "accessible" },
    { key: "postcode", signal: "label" },
    { key: "firstName", signal: "attrs" },
    { key: "city", signal: "site" }]);
});

test("long yes/no questions still match; essay prompts don't", () => {
  const { api, fields } = page(`
    <label for="a">Will you now or in the future require sponsorship for a visa to remain in your current location or country of residence?</label><input id="a">
    <label for="b">Tell us your name and the story of a project you are proud of, and why it mattered to the team</label><input id="b">
    <label for="c">Your name</label><textarea id="c"></textarea>`);
  expect(fields.map(api.classify)).toEqual(["needsSponsorship", null, null]);
});

test("word boundaries: ethnicity is not a city, preferred is not a referral", () => {
  const { api, fields } = page(`<label for="a">Race and Ethnicity</label><input id="a"><label for="b">Preferred First Name</label><input id="b">`);
  expect(fields.map(api.classify)).toEqual([null, "firstName"]);
});

test("radio group question comes from the text around the options (Lever layout)", () => {
  const { fields } = page(`<li><div class="text">Are you legally authorized to work in the country?</div>
    <ul><li><label><input type="radio" name="q1" value="Yes">Yes</label></li><li><label><input type="radio" name="q1" value="No">No</label></li></ul></li>`);
  expect(fields[0].label).toBe("Are you legally authorized to work in the country");
});

test("fill uses the native setter, so a React-style value tracker sees the change", () => {
  const { api, fields, dom } = page(`<label for="a">First name</label><input id="a">`);
  const el = fields[0].el, seen = [];
  // React swaps in an instance-level value property and ignores events whose value it already knows.
  let tracked = "";
  Object.defineProperty(el, "value", { configurable: true, get() { return dom.window.HTMLInputElement.prototype.__lookupGetter__("value").call(this); }, set(v) { tracked = v; dom.window.HTMLInputElement.prototype.__lookupSetter__("value").call(this, v); } });
  el.addEventListener("input", () => seen.push(el.value !== tracked)); // React only handles input when DOM value != tracked value
  api.fill(fields[0], "Ada");
  expect(el.value).toBe("Ada");
  expect(seen).toEqual([true]);
});

test("webITrent radios: label for= points at the value", () => {
  const { api, fields } = page(`<fieldset><legend>Do you have the right to work in the UK?</legend><table><tr>
    <td><input type="radio" name="r" value="111" id="s111"></td><td><label for="111">Yes</label></td>
    <td><input type="radio" name="r" value="222" id="s222"></td><td><label for="222">No</label></td></tr></table></fieldset>`);
  expect(api.classify(fields[0])).toBe("rightToWork");
  expect(api.fill(fields[0], "No")).toBe('Chose "No"');
  expect(fields[0].opts[1].checked).toBe(true);
});
