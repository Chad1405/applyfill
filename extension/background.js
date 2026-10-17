// Injects the scanner when you click the toolbar icon or press Alt+Shift+F,
// and makes the Claude API calls (the API key never touches the web page).

importScripts("defaults.js", "prompt.js");

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});

async function inject(tabId) {
  const files = ["defaults.js", "fields.js", "content.js"];
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files });
  } catch (e) {
    // Some frames (cross-site embeds without permission) refuse injection; fall back to the top frame.
    await chrome.scripting.executeScript({ target: { tabId }, files });
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/.test(tab.url || "")) return;
  try { await inject(tab.id); } catch (e) { console.warn("ApplyFill: cannot run on this page", e); }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const reply = p => p.then(r => sendResponse({ ok: true, ...r }), err => sendResponse({ ok: false, error: String(err.message || err) }));
  if (msg && msg.type === "applyfill:draft") { reply(draft(msg)); return true; }
  if (msg && msg.type === "applyfill:setup") { reply(setupFromCv(msg).then(data => ({ data }))); return true; }
  if (msg && msg.type === "applyfill:options") { chrome.runtime.openOptionsPage(); }
});

async function loadState() {
  const stored = await chrome.storage.local.get(["settings", "profile"]);
  return {
    settings: Object.assign({}, APPLYFILL_DEFAULTS.settings, stored.settings || {}),
    profile: Object.assign({}, APPLYFILL_DEFAULTS.profile, stored.profile || {})
  };
}

async function callClaude({ apiKey, model, system, user, maxTokens }) {
  if (!apiKey) throw new Error("Add your Anthropic API key on the Options page first.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({ model: model || "claude-sonnet-5-5", max_tokens: maxTokens || 800, system, messages: [{ role: "user", content: user }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || `Claude API error ${res.status}`);
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
}

async function draft(msg) {
  const { settings: s, profile } = await loadState();
  const own = { cvText: s.cvText, profile };
  const { system, user } = APPLYFILL_PROMPT.draft({ ...msg, ...own });
  const text = await callClaude({ apiKey: s.apiKey, model: s.model, system, user });
  return { text, unexpected: APPLYFILL_PROMPT.unexpected(text, own) };
}

// One-off setup: read the CV text and return profile fields plus saved answers written from it.
async function setupFromCv({ cvText }) {
  const { settings: s } = await loadState();
  if (!cvText || cvText.length < 200) throw new Error("Paste your CV text first (at least a few paragraphs).");
  const keys = Object.keys(APPLYFILL_DEFAULTS.profile);
  const titles = APPLYFILL_DEFAULTS.library.map(e => e.title);
  const system = "You extract job application details from a CV. Reply with one JSON object and nothing else. Use only facts stated in the CV; leave a value as an empty string when the CV doesn't say. Never guess right to work, visa sponsorship, nationality, pronouns or salary.";
  const user = `CV:\n${cvText}\n\nReturn JSON with two keys:\n"profile": an object with exactly these keys (strings): ${keys.join(", ")}. Leave rightToWork, needsSponsorship, nationality, pronouns, salaryExpectation and noticePeriod empty.\n"answers": an object whose keys are exactly these titles: ${JSON.stringify(titles)}. Each value is a first-person answer of 60 to 120 words written only from the CV, using {company} where the employer's name goes. For "Notice period" and "Salary expectations" use "[fill in]".`;
  const text = await callClaude({ apiKey: s.apiKey, model: s.model, system, user, maxTokens: 3000 });
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(json); } catch (e) { throw new Error("Claude's reply wasn't readable. Try again."); }
}
