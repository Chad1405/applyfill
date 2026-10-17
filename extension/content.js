// ApplyFill content script. Injected on demand (toolbar click / Alt+Shift+F).
// Scans the form, matches each field to your profile or answer library, and shows a panel
// where you can fill or copy each answer.
(() => {
  if (window.__applyfill) { window.__applyfill.toggle(); return; }

  const KEY_LABEL = { firstName:"First name", lastName:"Last name", fullName:"Full name", email:"Email", phone:"Phone", phoneIntl:"Phone (intl)", city:"City", country:"Country", postcode:"Postcode", address:"Address", linkedin:"LinkedIn", website:"Website", github:"GitHub", currentCompany:"Current company", currentTitle:"Current title", yearsExperience:"Years of experience", university:"University", degree:"Degree", graduationYear:"Graduation year", noticePeriod:"Notice period", salaryExpectation:"Salary expectation", rightToWork:"Right to work", needsSponsorship:"Needs sponsorship", nationality:"Nationality", pronouns:"Pronouns", howHeard:"How you heard" };

  let profile = {}, library = [], settings = {}, fields = [], host, root, open = true;
  const isTop = window.top === window;

  const { scan: scanPage, classify, fill: fillField, bestOption, optLabel, norm, low, textOf } = APPLYFILL_FIELDS;
  const scan = () => { const out = scanPage({ skip: host }); out.forEach(suggest); return out; };
  const fill = fillField;
  const QUICK = /^(short|select|radio|combo)$/; // kinds "Fill N quick fields" fills, when the answer is from your details

  // ---------- matching ----------
  function company() {
    const og = document.querySelector("meta[property='og:site_name']");
    if (og && og.content && !/greenhouse|lever|workday|ashby|workable|smartrecruiters/i.test(og.content)) return og.content;
    const m = location.pathname.match(/^\/(?:embed\/job_app\?for=)?([a-z0-9\-]+)/i);
    const h = location.hostname;
    if (/greenhouse\.io|lever\.co|ashbyhq\.com/.test(h) && m) return m[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (/myworkdayjobs\.com/.test(h)) return h.split(".")[0].replace(/\b\w/g, c => c.toUpperCase());
    const parts = h.replace(/^www\.|^careers\.|^jobs\./, "").split(".");
    return parts[0].replace(/\b\w/g, c => c.toUpperCase());
  }
  function role() {
    const h1 = document.querySelector("h1"); const t = h1 ? textOf(h1) : document.title;
    return norm(t).slice(0, 120);
  }
  const ctx = { company: "", role: "" };
  const fillTpl = s => (s || "").replace(/\{company\}/g, ctx.company || "the company").replace(/\{role\}/g, ctx.role || "this role");

  function yesNo(key) {
    const v = low(profile[key]);
    if (!v) return "";
    if (/^(y|yes|true)\b/.test(v)) return "Yes";
    if (/^(n|no|false)\b/.test(v)) return "No";
    return profile[key];
  }
  function libMatches(label) {
    const l = low(label);
    return library.map((e, idx) => ({ idx, e, score: (e.match || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).reduce((a, k) => a + (l.includes(k) ? k.length : 0), 0) }))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  }
  function suggest(f) {
    f.key = null; f.value = ""; f.lib = []; f.libIdx = -1;
    if (f.kind === "file") return;
    f.key = classify(f);
    if (f.key) f.value = (f.key === "rightToWork" || f.key === "needsSponsorship") ? yesNo(f.key) : (profile[f.key] || "");
    f.lib = libMatches(f.label);
    if (!f.value && f.lib.length && f.kind !== "radio" && f.kind !== "select") { f.libIdx = f.lib[0].idx; f.value = fillTpl(library[f.libIdx].text); }
    if (f.kind === "select" && f.value) f.value = bestOption(f.el, f.value) ? f.value : f.value;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
    }
  }

  // ---------- panel ----------
  const CSS_TEXT = `
  :host{all:initial}
  .p{position:fixed;top:12px;right:12px;width:min(400px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#A8B197;color:#2B3123;border:1px solid #EDD3DB;border-radius:14px;box-shadow:0 12px 40px rgba(20,25,20,.18);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;z-index:2147483647;overflow:hidden}
  @media (prefers-color-scheme:dark){.p{background:#21251C;color:#E4E8DC;border-color:#4A3139}.it{border-color:#3A2A30!important}.ta,.ctx input,select.lib{background:#191C15!important;color:#E4E8DC!important;border-color:#4A3139!important}.sub,.lbl small,.hint{color:#E59BB0!important}.b2{background:#33242A!important;color:#F0789A!important}.tag:not(.miss){background:#33242A;color:#F0789A}}
  .hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #949C83}
  .hd h1{font:700 15px/1 -apple-system,system-ui,sans-serif;margin:0;flex:1}
  .hd h1 span{font-weight:500;color:#6E1F38;margin-left:6px}
  .x{border:0;background:transparent;font-size:18px;cursor:pointer;color:inherit;padding:2px 6px;border-radius:6px}
  .ctx{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 14px;border-bottom:1px solid #949C83}
  .ctx label{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6E1F38;display:flex;flex-direction:column;gap:3px;font-weight:600}
  .ctx input{font:13px system-ui,sans-serif;padding:5px 7px;border:1px solid #EDD3DB;border-radius:7px;background:#fff;color:#2B3123;text-transform:none;letter-spacing:0}
  .bar{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #949C83}
  button.b{font:600 12.5px system-ui,sans-serif;border:0;border-radius:8px;padding:7px 11px;cursor:pointer;background:#7E5E9A;color:#fff}
  button.b2{background:#FBEBEF;color:#C82151}
  button.b:disabled{opacity:.5;cursor:default}
  button:focus-visible,.ta:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #7E5E9A;outline-offset:1px}
  .list{overflow:auto;padding:4px 0}
  .it{padding:10px 14px;border-bottom:1px solid #99A189;display:flex;flex-direction:column;gap:6px}
  .it.cur{background:rgba(126,94,154,.10)}
  .lbl{display:flex;gap:6px;align-items:baseline;cursor:pointer}
  .lbl b{font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .lbl small{color:#6E1F38;font-size:11px;white-space:nowrap}
  .req{color:#8E1430}
  .tag{font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:99px;background:#FBEBEF;color:#C82151;white-space:nowrap}
  .tag.miss{background:#f6e8cf;color:#8a5200}
  .ta{width:100%;box-sizing:border-box;font:13px/1.4 system-ui,sans-serif;border:1px solid #EDD3DB;border-radius:8px;padding:6px 8px;background:#fff;color:#2B3123;resize:vertical;min-height:32px}
  .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  select.lib{font:12px system-ui,sans-serif;border:1px solid #EDD3DB;border-radius:7px;padding:5px;max-width:100%;background:#fff;color:#2B3123}
  .st{font-size:11.5px;color:#2F6B3C}
  .st.err{color:#8E1430}
  .hint{color:#6E1F38;font-size:12px;padding:10px 14px}
  .hint a{color:#7E5E9A;font-weight:600}
  .done .lbl b::before{content:"✓ ";color:#2F6B3C}
  `;

  function render() {
    if (!host) {
      host = document.createElement("div"); host.id = "applyfill-host";
      root = host.attachShadow({ mode: "open" });
      document.documentElement.appendChild(host);
    }
    const filledShort = fields.filter(f => QUICK.test(f.kind) && f.key && f.value).length;
    root.innerHTML = `<style>${CSS_TEXT}</style>
      <div class="p" role="dialog" aria-label="ApplyFill">
        <div class="hd"><h1>ApplyFill<span>${fields.length} field${fields.length === 1 ? "" : "s"}</span></h1>
          <button class="x" id="opt" title="Edit your answers">⚙</button><button class="x" id="close" title="Close (Alt+Shift+F)">×</button></div>
        <div class="ctx"><label>Company<input id="c-co" value=""></label><label>Role<input id="c-ro" value=""></label></div>
        <div class="bar"><button class="b" id="fillall" ${filledShort ? "" : "disabled"}>Fill ${filledShort} quick field${filledShort === 1 ? "" : "s"}</button>
          <button class="b b2" id="rescan">Rescan page</button></div>
        ${!profile.email && !profile.firstName ? `<div class="hint">Your details are empty, so most fields have nothing to suggest yet. <a href="#" id="setup-link">Add them in settings</a>.</div>` : ""}
        <div class="list" id="list"></div>
      </div>`;
    root.getElementById("c-co").value = ctx.company; root.getElementById("c-ro").value = ctx.role;
    const list = root.getElementById("list");
    if (!fields.length) list.innerHTML = `<div class="hint">No form fields found here. If the form opens after you click "Apply", open it and press Rescan. If it's embedded from another site, open the form in its own tab and try again.</div>`;
    fields.forEach(f => list.appendChild(item(f)));
    root.getElementById("close").onclick = () => toggle(false);
    root.getElementById("opt").onclick = () => chrome.runtime.sendMessage({ type: "applyfill:options" });
    const sl = root.getElementById("setup-link"); if (sl) sl.onclick = e => { e.preventDefault(); chrome.runtime.sendMessage({ type: "applyfill:options" }); };
    root.getElementById("rescan").onclick = () => { fields = scan(); render(); };
    root.getElementById("fillall").onclick = async () => {
      let n = 0;
      root.getElementById("fillall").disabled = true;
      // one at a time: a custom dropdown's option list has to close before the next one opens
      for (const f of fields) if (QUICK.test(f.kind) && f.key && f.value && !f.done) { const r = await fill(f, f.value); f.status = r; if (!/^No|^Can't/.test(r)) { f.done = true; n++; } }
      render(); flash(`Filled ${n} field${n === 1 ? "" : "s"}. Check them before you submit.`);
    };
    const upd = () => { ctx.company = root.getElementById("c-co").value; ctx.role = root.getElementById("c-ro").value;
      fields.forEach(f => { if (f.libIdx >= 0 && !f.edited) { f.value = fillTpl(library[f.libIdx].text); const ta = root.querySelector(`.it[data-i="${f.i}"] .ta`); if (ta) ta.value = f.value; } }); };
    root.getElementById("c-co").oninput = upd; root.getElementById("c-ro").oninput = upd;
  }
  function flash(msg) { const h = root.querySelector(".hint.flash") || Object.assign(document.createElement("div"), { className: "hint flash" }); h.textContent = msg; root.querySelector(".bar").after(h); }

  function item(f) {
    const d = document.createElement("div"); d.className = "it" + (f.done ? " done" : ""); d.dataset.i = f.i;
    const tag = f.kind === "file" ? `<span class="tag">Upload</span>` : f.key ? (f.value ? `<span class="tag">${KEY_LABEL[f.key]}</span>` : `<span class="tag miss">Add ${KEY_LABEL[f.key]} in settings</span>`)
      : f.libIdx >= 0 ? `<span class="tag">${esc(library[f.libIdx].title)}</span>` : (f.kind === "long" ? `<span class="tag miss">Open question</span>` : "");
    const opts = f.kind === "select" ? [...f.el.options].map(o => norm(o.text)).filter(Boolean).slice(0, 8).join(" · ") : f.kind === "radio" ? f.opts.map(optLabel).join(" · ") : "";
    d.innerHTML = `<div class="lbl"><b title="${esc(f.label)}">${esc(f.label || "(no label)")}${f.required ? ' <span class="req">*</span>' : ""}</b>${tag}</div>
      ${opts ? `<div class="lbl"><small>Options: ${esc(opts)}</small></div>` : ""}`;
    d.querySelector(".lbl").onclick = () => { f.el.scrollIntoView({ block: "center", behavior: "smooth" }); pulse(f.el); };
    if (f.kind === "file") { d.insertAdjacentHTML("beforeend", `<div class="hint" style="padding:0">Browsers don't let extensions attach files. Upload your CV PDF here yourself.</div>`); return d; }
    const ta = document.createElement("textarea"); ta.className = "ta"; ta.value = f.value; ta.rows = f.kind === "long" ? 5 : 1;
    ta.placeholder = f.kind === "long" ? "Pick a saved answer or draft one with Claude" : "Type an answer";
    d.appendChild(ta);
    const max = f.el.maxLength > 0 ? f.el.maxLength : 0;
    const cnt = document.createElement("small"); cnt.className = "hint"; cnt.style.padding = "0";
    const count = () => { if (!max) return; const n = ta.value.length; cnt.textContent = `${n} / ${max} characters` + (n > max ? ". Too long, trim it before filling" : ""); cnt.style.color = n > max ? "#8E1430" : ""; };
    if (max) { d.appendChild(cnt); count(); }
    ta.oninput = () => { f.value = ta.value; f.edited = true; count(); };
    const row = document.createElement("div"); row.className = "row";
    const bFill = btn("Fill", "b"), bCopy = btn("Copy", "b b2");
    row.append(bFill, bCopy);
    if (f.kind === "long" || f.kind === "short" && !f.key) {
      const bDraft = btn("Draft with Claude", "b b2"); row.append(bDraft);
      bDraft.onclick = async () => {
        bDraft.disabled = true; st.className = "st"; st.textContent = "Drafting…";
        const r = await chrome.runtime.sendMessage({ type: "applyfill:draft", question: f.label, company: ctx.company, role: ctx.role, maxChars: f.el.maxLength > 0 ? f.el.maxLength : 0, pageText: document.body.innerText.slice(0, 8000) });
        bDraft.disabled = false;
        if (r && r.ok) { f.value = r.text; f.edited = true; f.drafted = true; ta.value = r.text; ta.rows = 6; count();
          if (r.unexpected && r.unexpected.length) { st.className = "st err"; st.textContent = `Check this draft: it includes ${r.unexpected.join(", ")}, which isn't in your CV. The job page may contain hidden instructions.`; }
          else st.textContent = "Draft ready. Read it and edit before filling."; }
        else { st.className = "st err"; st.textContent = (r && r.error) || "Drafting failed."; }
      };
    }
    if (f.kind === "long" || (f.kind === "short" && !f.key)) {
      const sel = document.createElement("select"); sel.className = "lib"; sel.setAttribute("aria-label", "Saved answers");
      const ranked = [...f.lib.map(x => x.idx), ...library.map((_, i) => i).filter(i => !f.lib.some(x => x.idx === i))];
      sel.innerHTML = `<option value="">Saved answers…</option>` + ranked.map(i => `<option value="${i}" ${i === f.libIdx ? "selected" : ""}>${esc(library[i].title)}</option>`).join("");
      sel.onchange = () => { if (sel.value === "") return; f.libIdx = +sel.value; f.edited = false; f.drafted = false; f.value = fillTpl(library[f.libIdx].text); ta.value = f.value; ta.rows = 5; count(); };
      row.append(sel);
    }
    const st = document.createElement("span"); st.className = "st" + (f.status && /^No|^Can't/.test(f.status) ? " err" : ""); st.textContent = f.status || "";
    row.append(st); d.appendChild(row);
    bFill.onclick = async () => { if (!f.value.trim()) { st.className = "st err"; st.textContent = "Nothing to fill yet."; return; } const r0 = await fill(f, f.value); const r = /\[[^\]]+\]/.test(f.value) && !/^No|^Can't/.test(r0) ? r0 + ". It still has [bracketed] text to replace" : r0; f.status = r; st.className = "st" + (/^No|^Can't|bracketed/.test(r) ? " err" : ""); st.textContent = r; if (!/^No|^Can't/.test(r)) { f.done = true; d.classList.add("done"); logFill(f); } };
    bCopy.onclick = async () => { const ok = await copy(f.value); st.className = "st" + (ok ? "" : " err"); st.textContent = ok ? "Copied" : "Couldn't copy. Select the text and press Ctrl+C."; };
    return d;
  }
  // Remember which saved answer (or Claude draft) went to which company, so the AI Role Tracker can
  // compare reply rates per answer. Kept in this browser; exported from the settings page.
  function logFill(f) {
    const answer = f.drafted ? "Claude draft" : f.libIdx >= 0 ? library[f.libIdx].title : null;
    if (!answer) return;
    chrome.storage.local.get("fillLog", ({ fillLog = [] }) => {
      const url = location.origin + location.pathname;
      let e = fillLog.find(x => x.url === url);
      if (!e) fillLog.push(e = { url, date: new Date().toISOString().slice(0, 10), answers: [] });
      Object.assign(e, { company: ctx.company, role: ctx.role });
      e.answers = e.answers.filter(a => a.question !== f.label).concat({ question: f.label.slice(0, 200), answer, edited: !f.drafted && !!f.edited });
      chrome.storage.local.set({ fillLog: fillLog.slice(-1000) });
    });
  }
  function btn(t, c) { const b = document.createElement("button"); b.className = c; b.textContent = t; b.type = "button"; return b; }
  function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function pulse(el) { const o = el.style.outline; el.style.outline = "3px solid #7E5E9A"; setTimeout(() => el.style.outline = o, 1400); }

  // highlight the panel item for the field you're in
  document.addEventListener("focusin", e => {
    if (!root || !open) return; const f = fields.find(x => x.el === e.target || (x.opts && x.opts.includes(e.target))); if (!f) return;
    root.querySelectorAll(".it.cur").forEach(n => n.classList.remove("cur"));
    const n = root.querySelector(`.it[data-i="${f.i}"]`); if (n) { n.classList.add("cur"); n.scrollIntoView({ block: "nearest" }); }
  }, true);

  function toggle(force) {
    open = typeof force === "boolean" ? force : !open;
    if (open) { fields = scan(); if (!fields.length && !isTop) return; if (!fields.length && isTop && document.querySelector("iframe")) { /* form may be in a frame */ } render(); host.style.display = ""; }
    else if (host) host.style.display = "none";
  }

  chrome.storage.local.get(["profile", "library", "settings"], d => {
    profile = Object.assign({}, APPLYFILL_DEFAULTS.profile, d.profile || {});
    library = d.library || APPLYFILL_DEFAULTS.library;
    settings = Object.assign({}, APPLYFILL_DEFAULTS.settings, d.settings || {});
    ctx.company = company(); ctx.role = role();
    fields = scan();
    if (!fields.length && !isTop) return; // stay quiet in frames without forms
    render();
  });
  window.__applyfill = { toggle };
})();
