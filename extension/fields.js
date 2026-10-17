// Finds the fields on an application form, works out what each one asks for, and fills them.
// Loaded before content.js in the page, and by the tests in jsdom.
var APPLYFILL_FIELDS = (() => {
  // What a field asks for is decided from these signals, strongest first; the first one that matches wins:
  //   1. the autocomplete attribute   2. the accessible name (aria-labelledby / aria-label / <label>)
  //   3. nearby label text and placeholder   4. name / id   5. site hooks (Workday's data-automation-id etc.)
  const AUTOCOMPLETE = {
    "given-name": "firstName", "family-name": "lastName", "name": "fullName", "email": "email",
    "tel": "phone", "tel-national": "phone", "tel-country-code": "phoneIntl",
    "address-level2": "city", "country": "country", "country-name": "country", "postal-code": "postcode",
    "street-address": "address", "address-line1": "address", "url": "website",
    "organization": "currentCompany", "organization-title": "currentTitle"
  };

  // Rules for label text. Partly after Chrome's autofill regexes (components/autofill/core/common/
  // autofill_regex_constants.h), cut down to job forms. [key, regex, also for long labels?]
  // Yes/no questions are often long sentences, so those rules run on labels of any length;
  // the rest only on short labels of text boxes, so a prompt that mentions "your name" isn't taken
  // for one. Dropdowns and radio groups can't take an essay, so every rule runs on them.
  const RULES = [
    ["needsSponsorship", /sponsor|\bvisa\b/, true],
    ["rightToWork", /right to work|eligib\w* to work|authori[sz]ed to work|work permit|legally (able|entitled|allowed|permitted) to work|permission to work|work authori[sz]ation/, true],
    ["pronouns", /\bpronouns?\b/, true],
    ["howHeard", /how (did )?you (first )?(hear|heard|find|found|learn|learned) (about|of)|where did you (hear|find|see)|referr\w* source|^source$/, true],
    ["email", /e-?mail|courriel|correo/],
    ["firstName", /first.?name|given.?name|forename|preferred (first )?name|name you(?:'|’)?d (like|prefer)|(like|prefer) (us )?to call you|vorname|förnamn|fornavn|voornaam|prénom|^nombre\b/],
    ["lastName", /last.?name|surname|family.?name|nachname|efternamn|etternavn|achternaam|apellido/],
    ["fullName", /full.?name|legal name|your name|^name\b|candidate name|^(namn|navn|naam|nom)$/],
    ["phoneIntl", /country code|dial(l)?ing code/],
    ["phone", /phone|mobile|telephone|contact number|\bcell\b|telefon|telefoon|téléphone/],
    ["linkedin", /linkedin/],
    ["github", /github/],
    ["website", /website|portfolio|personal (site|url)|^url\b|homepage/],
    ["postcode", /post ?code|\bzip\b|postal code|postnummer|postleitzahl|code postal/],
    ["address", /street|address line|home address|^address\b|^adress\b|anschrift/],
    ["country", /\bcountry\b|\bcountries\b|^land$|\bpaís\b|^pays$/],
    ["city", /\bcity\b|\btown\b|\blocation\b|where are you (currently )?(based|located)|where do you live|working from|^ort$|^stadt$|^stad$|^ville$|^ciudad$/],
    ["currentCompany", /current (company|employer|organi[sz]ation)|most recent (company|employer)|^company( name)?$|^employer$/],
    ["currentTitle", /current (job )?title|job title|current role|current position|most recent (title|role)/],
    ["yearsExperience", /years of (\w+ )?experience|how many years/],
    ["university", /university|\bschool\b|college|institution/],
    ["degree", /\bdegree\b|qualification|field of study|discipline|\bmajor\b/],
    ["graduationYear", /graduat/],
    ["noticePeriod", /notice period|when can you start|earliest start|start date|availability to start/],
    ["salaryExpectation", /salary|compensation|pay expectation|expected pay|remuneration|desired pay/],
    ["nationality", /nationality|citizenship/]
  ];
  // A rule match is dropped when the label also matches its exclusion.
  const NOT = {
    firstName: /company|employer|school|university|\breferr|pronounc|manager|emergency|reference/,
    lastName: /company|employer|school|university|\breferr|pronounc|manager|emergency|reference/,
    fullName: /company|employer|school|university|\breferr|pronounc|manager|emergency|reference/,
    city: /relocat|willing/,
    website: /^other\b/
  };
  // Rules for name / id / site-hook attributes, after they're split into words ("candidate[first_name]",
  // "legalNameSection_firstName" -> "legal name section first name").
  const ATTR_RULES = [
    ["phoneIntl", /\bcountry (phone )?code\b|\bdial code\b/],
    ["firstName", /\b(first|given) ?name\b|\bfname\b/],
    ["lastName", /\b(last|family) ?name\b|\blname\b|\bsurname\b/],
    ["fullName", /\bfull ?name\b|^name$/],
    ["email", /\be ?mail\b/],
    ["phone", /\bphone( number)?$|\btel\b|\bmobile\b/],
    ["linkedin", /\blinked ?in\b/],
    ["github", /\bgit ?hub\b/],
    ["postcode", /\b(postal|post) ?code\b|\bzip\b/],
    ["address", /\baddress (line )?1\b|\bstreet\b/],
    ["city", /\bcity\b/],
    ["country", /\bcountry\b/],
    ["website", /\b(website|portfolio)\b/]
  ];
  const SITE_ATTRS = ["data-automation-id", "data-qa", "data-testid"];

  const norm = s => (s || "").replace(/\s+/g, " ").replace(/[*:?✱]+\s*$/, "").trim();
  const low = s => norm(s).toLowerCase();
  const words = s => (s || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([a-zA-Z])(\d)/g, "$1 $2").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
  const uniq = parts => parts.map(norm).filter((p, i, a) => p && a.findIndex(q => q === p) === i);

  // ---------- reading the page ----------
  function visible(el) {
    if (el.disabled || el.readOnly) return false;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return (r.width > 0 && r.height > 0 || el.type === "radio" || el.type === "checkbox") && cs.visibility !== "hidden" && cs.display !== "none";
  }
  function textOf(el) { return el ? norm(el.innerText || el.textContent || "") : ""; }
  const byIds = ids => (ids || "").split(/\s+/).map(id => textOf(document.getElementById(id))).join(" ");

  // The accessible name: aria-labelledby, then aria-label, then <label for>.
  function accessibleName(el) {
    return uniq([byIds(el.getAttribute("aria-labelledby")), el.getAttribute("aria-label") || "",
      ...(el.labels ? [...el.labels].map(textOf) : [])]).join(" ");
  }
  // Text near the field that looks like its label, for forms that don't wire labels up.
  function nearbyText(el) {
    let n = el;
    for (let i = 0; i < 4 && n; i++) {
      n = n.parentElement; if (!n) break;
      const cand = n.querySelector(":scope > label, :scope > legend, :scope > [class*='label' i], :scope > [class*='question' i], :scope > [data-automation-id*='label' i]");
      // text that belongs to another control (a <label> wrapping its own input) isn't this field's label
      // (Ashby points for= at the question's container, so only another *control* disqualifies it.)
      const other = c => { const t = c.htmlFor && document.getElementById(c.htmlFor); return t && t !== el && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName); };
      const own = c => c && !c.contains(el) && !c.querySelector("input, select, textarea") && !other(c) && textOf(c);
      if (own(cand)) return textOf(cand);
      const prev = n.previousElementSibling; if (own(prev) && textOf(prev).length < 300) return textOf(prev);
    }
    return "";
  }
  function optLabel(r) {
    const lab = (r.labels && r.labels[0]) || (r.value && document.querySelector(`label[for="${CSS.escape(r.value)}"]`)); // webITrent points for= at the value
    const after = norm((r.nextSibling && r.nextSibling.textContent) || (r.parentElement && r.parentElement.tagName === "TD" && textOf(r.parentElement.nextElementSibling)) || "");
    return norm((lab && textOf(lab)) || r.getAttribute("aria-label") || (after.length < 60 && after) || r.value);
  }
  // The question a radio group asks: its radiogroup's name, its fieldset legend, or the text around
  // the options with the option labels taken out.
  function groupName(radio) {
    const rg = radio.closest("[role=radiogroup]");
    if (rg) { const t = norm(byIds(rg.getAttribute("aria-labelledby")) || rg.getAttribute("aria-label")); if (t) return t; }
    const fs = radio.closest("fieldset");
    if (fs) { const lg = fs.querySelector("legend"); if (lg && textOf(lg)) return textOf(lg); }
    return "";
  }
  function groupText(radio) {
    let n = radio.parentElement;
    for (let i = 0; i < 6 && n; i++, n = n.parentElement) {
      const radios = [...n.querySelectorAll(`input[type=radio][name="${CSS.escape(radio.name)}"]`)];
      if (radios.length < 2) continue;
      let t = textOf(n);
      for (const o of radios.map(optLabel).sort((a, b) => b.length - a.length)) t = t.split(o).join(" ");
      t = norm(t); if (t.length > 3) return t.slice(0, 300);
      const prev = n.previousElementSibling; if (prev && textOf(prev)) return textOf(prev).slice(0, 300);
    }
    return "";
  }
  // The texts each signal level offers for a field, strongest first.
  function signals(f) {
    const el = f.el, attr = a => el.getAttribute(a) || "";
    const isRadio = f.kind === "radio";
    return {
      autocomplete: attr("autocomplete").toLowerCase().split(/\s+/).pop(),
      accessible: isRadio ? groupName(el) : accessibleName(el),
      label: isRadio ? groupText(el) : uniq([nearbyText(el), el.placeholder || ""])[0] || "",
      attrs: isRadio ? [words(el.name)] : uniq([words(el.name), words(el.id)]),
      site: uniq(SITE_ATTRS.map(a => words(attr(a))))
    };
  }
  function labelFor(el) {
    const s = signals({ el, kind: el.type === "radio" ? "radio" : "" });
    return (s.accessible || s.label || norm(el.title) || s.attrs[0] || "").slice(0, 300);
  }

  // skip: an element whose fields to ignore (the panel). visible: override for tests (jsdom has no layout).
  function scan({ skip, visible: isVisible = visible } = {}) {
    const out = [], seenRadio = new Set();
    const els = document.querySelectorAll("input, textarea, select, [contenteditable='true'], [role='textbox'], button[aria-haspopup='listbox']");
    els.forEach(el => {
      if (skip && skip.contains(el)) return;
      const tag = el.tagName.toLowerCase(), type = (el.type || "").toLowerCase();
      if (tag === "input" && /hidden|submit|button|reset|image|password|search|checkbox|range|color/.test(type)) return;
      if (el.getAttribute("aria-hidden") === "true" && el.tabIndex < 0) return; // validation shadows behind custom selects
      if (!isVisible(el)) return;
      if (type === "radio") {
        if (!el.name || seenRadio.has(el.name)) return; seenRadio.add(el.name);
        const opts = [...document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`)];
        const f = { el, kind: "radio", opts }; const s = signals(f);
        f.label = norm(s.accessible || s.label || el.name).slice(0, 300); out.push(f); return;
      }
      if (type === "file") { out.push({ el, kind: "file", label: labelFor(el) }); return; }
      const kind = tag === "button" || el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") ? "combo"
        : tag === "select" ? "select" : tag === "textarea" || el.isContentEditable || el.getAttribute("role") === "textbox" ? "long" : "short";
      out.push({ el, kind, label: labelFor(el) });
    });
    out.forEach((f, i) => {
      f.i = i;
      f.required = !!(f.el.required || f.el.getAttribute("aria-required") === "true" || /[*✱]\s*$/.test(f.label) || /\(required\)/i.test(f.label));
    });
    return out;
  }

  // ---------- matching ----------
  const COUNTRY_OPTS = /^(afghanistan|albania|algeria|andorra|angola)$/;
  function textRule(f, text) {
    const l = low(text); if (!l) return null;
    for (const [k, re, anyLength] of RULES) {
      if (f.kind === "long" || (!anyLength && l.length > 80 && f.kind !== "select" && f.kind !== "radio")) continue;
      if (re.test(l) && !(NOT[k] && NOT[k].test(l))) return k;
    }
    return null;
  }
  const attrRule = text => { for (const [k, re] of ATTR_RULES) if (text && re.test(text)) return k; return null; };

  // Returns { key, signal } for the first signal that names a profile field, or { key: null }.
  function explain(f) {
    if (f.kind === "file") return { key: null };
    const s = signals(f);
    let hit = null;
    if (AUTOCOMPLETE[s.autocomplete]) hit = { key: AUTOCOMPLETE[s.autocomplete], signal: "autocomplete" };
    else for (const sig of ["accessible", "label"]) { const k = textRule(f, s[sig]); if (k) { hit = { key: k, signal: sig }; break; } }
    if (!hit && f.kind !== "long") for (const sig of ["attrs", "site"]) { const k = s[sig].map(attrRule).find(Boolean); if (k) { hit = { key: k, signal: sig }; break; } }
    // A list of countries is a country field, whatever its label says ("What is your location?").
    if (f.kind === "select" && (!hit || hit.key === "city") && [...f.el.options].filter(o => COUNTRY_OPTS.test(low(o.text))).length >= 2)
      hit = { key: "country", signal: "options" };
    return hit || { key: null };
  }
  const classify = f => explain(f).key;

  // ---------- filling ----------
  // Set the value through the native setter so React-controlled inputs see the change,
  // then fire the events frameworks listen for.
  function setNative(el, v) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function bestOf(opts, v) {
    const t = low(v); if (!t) return null;
    opts = opts.filter(o => o.value !== "" || o.text);
    return opts.find(o => o.text === t || o.value === t)
      || opts.find(o => o.text.startsWith(t) || t.startsWith(o.text) && o.text.length > 1)
      || opts.find(o => o.text.includes(t) || (o.text.length > 2 && t.includes(o.text)));
  }
  function bestOption(sel, v) {
    const hit = bestOf([...sel.options].map(o => ({ o, text: low(o.text), value: low(o.value) })), v);
    return hit && hit.o;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // A whole pointer press, at the element, with the button held: react-select ignores a bare mousedown.
  function press(el) {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1, clientX: r.x + Math.min(5, r.width / 2), clientY: r.y + r.height / 2, pointerType: "mouse", isPrimary: true };
    const P = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
    el.dispatchEvent(new P("pointerdown", o)); el.dispatchEvent(new MouseEvent("mousedown", o));
    if (el.focus) el.focus();
    el.dispatchEvent(new P("pointerup", { ...o, buttons: 0 })); el.dispatchEvent(new MouseEvent("mouseup", { ...o, buttons: 0 })); el.dispatchEvent(new MouseEvent("click", { ...o, buttons: 0 }));
  }
  function listOptions(el) {
    const id = el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
    const box = id && document.getElementById(id);
    // only options on screen: Greenhouse keeps a hidden phone-country list with role=option on the page
    return [...(box || document).querySelectorAll("[role=option]")].filter(o => o.getClientRects().length);
  }
  // Custom dropdowns (react-select on Greenhouse, Workday's button + listbox): open the list
  // (press it, and type into a combobox to filter), wait for the options, click the one that matches.
  async function pickFromList(el, v) {
    if (el.getAttribute("aria-expanded") !== "true") press(el);
    if (el.tagName !== "BUTTON") setNative(el, v);
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      const hit = bestOf(listOptions(el).map(o => ({ o, text: low(textOf(o)), value: low(o.getAttribute("data-value") || "") })), v);
      if (hit) { press(hit.o); await sleep(50); return `Chose "${textOf(hit.o)}"`; }
    }
    return el.tagName === "BUTTON" ? "No matching option. Pick it yourself." : "Typed it in. Pick the matching option from the list.";
  }
  // Returns a status message, or a Promise of one for custom dropdowns.
  function fill(f, v) {
    const el = f.el;
    if (f.kind === "short" || (f.kind === "long" && !el.isContentEditable && el.getAttribute("role") !== "textbox")) {
      let val = v; if (el.maxLength > 0 && val.length > el.maxLength) val = val.slice(0, el.maxLength);
      el.focus(); setNative(el, val); el.dispatchEvent(new Event("blur")); el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      return val.length === v.length ? "Filled" : `Filled (cut to ${el.maxLength} characters)`;
    }
    if (f.kind === "long") { el.focus(); document.execCommand("selectAll"); document.execCommand("insertText", false, v); return "Filled"; }
    if (f.kind === "select") {
      const o = bestOption(el, v); if (!o) return "No matching option. Pick it yourself.";
      setNative(el, o.value); return `Selected "${norm(o.text)}"`;
    }
    if (f.kind === "radio") {
      const t = low(v); const o = f.opts.find(r => low(optLabel(r)) === t) || f.opts.find(r => low(optLabel(r)).startsWith(t));
      if (!o) return "No matching option. Pick it yourself."; o.click(); return `Chose "${optLabel(o)}"`;
    }
    if (f.kind === "combo") return pickFromList(el, v);
    return "Can't fill this type of field";
  }

  return { scan, classify, explain, fill, bestOption, optLabel, labelFor, norm, low, textOf };
})();
