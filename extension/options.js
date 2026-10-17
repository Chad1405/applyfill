const LABELS = { firstName:"First name", lastName:"Last name", fullName:"Full name", email:"Email", phone:"Phone", phoneIntl:"Phone (international)", city:"City", country:"Country", postcode:"Postcode", address:"Address", linkedin:"LinkedIn URL", website:"Website", github:"GitHub URL", currentCompany:"Current company", currentTitle:"Current title", yearsExperience:"Years of experience", university:"University", degree:"Degree", graduationYear:"Graduation year", noticePeriod:"Notice period", salaryExpectation:"Salary expectation", rightToWork:"Right to work in the UK (Yes/No)", needsSponsorship:"Need visa sponsorship (Yes/No)", nationality:"Nationality", pronouns:"Pronouns", howHeard:"How you heard about roles" };
const $ = s => document.querySelector(s);
let state;

function load() {
  chrome.storage.local.get(["profile", "library", "settings"], d => {
    state = {
      profile: Object.assign({}, APPLYFILL_DEFAULTS.profile, d.profile || {}),
      library: d.library || structuredClone(APPLYFILL_DEFAULTS.library),
      settings: Object.assign({}, APPLYFILL_DEFAULTS.settings, d.settings || {})
    };
    draw();
  });
}
function draw() {
  $("#profile").innerHTML = Object.keys(LABELS).map(k => `<label>${LABELS[k]}<input id="p-${k}" data-k="${k}"></label>`).join("");
  Object.keys(LABELS).forEach(k => $("#p-" + k).value = state.profile[k] || "");
  drawLib();
  $("#apiKey").value = state.settings.apiKey || ""; $("#model").value = state.settings.model || ""; $("#cvText").value = state.settings.cvText || "";
}
function drawLib() {
  const box = $("#library"); box.innerHTML = "";
  state.library.forEach((e, i) => {
    const d = document.createElement("div"); d.className = "entry";
    d.innerHTML = `<label>Title<input id="l-t-${i}"></label><label>Matches<input id="l-m-${i}"></label>
      <label class="wide">Answer<textarea id="l-x-${i}" rows="5"></textarea></label><button class="del wide" id="l-d-${i}">Delete this answer</button>`;
    box.appendChild(d);
    $(`#l-t-${i}`).value = e.title; $(`#l-m-${i}`).value = e.match; $(`#l-x-${i}`).value = e.text;
    $(`#l-d-${i}`).onclick = () => { collect(); state.library.splice(i, 1); drawLib(); };
  });
}
function collect() {
  Object.keys(LABELS).forEach(k => state.profile[k] = $("#p-" + k).value.trim());
  state.library = state.library.map((e, i) => ({ title: $(`#l-t-${i}`).value.trim(), match: $(`#l-m-${i}`).value.trim(), text: $(`#l-x-${i}`).value.trim() })).filter(e => e.title || e.text);
  state.settings.apiKey = $("#apiKey").value.trim(); state.settings.model = $("#model").value.trim() || "claude-sonnet-5-5"; state.settings.cvText = $("#cvText").value.trim();
}
function say(t, bad) { $("#status").textContent = t; $("#status").style.color = bad ? "var(--bad)" : "var(--ok)"; setTimeout(() => $("#status").textContent = "", 3000); }

$("#save").onclick = () => { collect(); chrome.storage.local.set(state, () => say("Saved")); };
$("#add").onclick = () => { collect(); state.library.push({ title: "New answer", match: "", text: "" }); drawLib(); $(`#l-t-${state.library.length - 1}`).focus(); };
$("#export").onclick = () => {
  collect(); const copy = structuredClone(state); copy.settings.apiKey = "";
  const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "applyfill-backup.json" }); a.click(); URL.revokeObjectURL(url);
  say("Exported (API key left out)");
};
$("#importFile").onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try { const d = JSON.parse(await file.text()); state.profile = Object.assign({}, state.profile, d.profile || {}); if (Array.isArray(d.library)) state.library = d.library;
    state.settings = Object.assign({}, state.settings, d.settings || {}, { apiKey: state.settings.apiKey || (d.settings && d.settings.apiKey) || "" }); draw(); say("Restored. Press Save to keep it."); }
  catch (err) { say("That file isn't a valid ApplyFill backup.", true); }
  e.target.value = "";
};
$("#setup").onclick = async () => {
  collect();
  const st = $("#setupStatus"), b = $("#setup");
  if (!state.settings.apiKey) { st.textContent = "Add your API key above first."; return; }
  await chrome.storage.local.set({ settings: state.settings });
  b.disabled = true; st.textContent = "Reading your CV…";
  const r = await chrome.runtime.sendMessage({ type: "applyfill:setup", cvText: state.settings.cvText });
  b.disabled = false;
  if (!r || !r.ok) { st.textContent = (r && r.error) || "Setup failed."; return; }
  const { profile = {}, answers = {} } = r.data || {};
  Object.keys(LABELS).forEach(k => { if (typeof profile[k] === "string" && profile[k].trim() && !state.profile[k]) state.profile[k] = profile[k].trim(); });
  state.library = state.library.map(e => (answers[e.title] && /\[[^\]]+\]/.test(e.text)) ? { ...e, text: answers[e.title] } : e);
  draw(); st.textContent = "Done. Check everything below, fill in anything still blank, then press Save.";
};
$("#reset").onclick = () => {
  if ($("#reset").dataset.armed) { state = { profile: { ...APPLYFILL_DEFAULTS.profile }, library: structuredClone(APPLYFILL_DEFAULTS.library), settings: { ...APPLYFILL_DEFAULTS.settings, apiKey: state.settings.apiKey } }; draw(); delete $("#reset").dataset.armed; $("#reset").textContent = "Reset to defaults"; say("Reset. Press Save to keep it."); }
  else { $("#reset").dataset.armed = "1"; $("#reset").textContent = "Press again to reset"; }
};
load();
