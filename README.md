# ApplyFill

A Chrome extension that reads the fields on a job application, suggests an answer for each one from your CV, and fills or copies it with a click. Open questions can be drafted by Claude using your own Anthropic API key.

- **Quick fields in one click:** name, email, phone, LinkedIn, current company, notice period, dropdowns and yes/no questions such as "Do you need visa sponsorship?"
- **Saved answers** for the questions every form asks ("Why do you want to work here?", "Tell us about a project…"), with `{company}` and `{role}` filled in from the page.
- **Draft with Claude (optional):** writes an answer from your CV and the job description. It only uses facts from your CV and marks gaps with `[CHECK]`.
- **Set up from your CV:** paste your CV once and Claude fills in your details and writes your saved answers.
- **Private by default:** everything stays in your browser. The extension only runs on a page when you click it.

Works with most application forms, including Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Teamtailor and Workday.

## Install

1. Download the latest `ApplyFill-x.y.z.zip` from [Releases](../../releases) and unzip it. (Or clone this repo and use the `extension` folder.)
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder (the one containing `manifest.json`).
4. Pin ApplyFill from the puzzle-piece menu. The settings page opens on first install.

It also works in Edge, Brave and Arc.

## Set up

On the settings page:

1. **With an API key (recommended):** paste an Anthropic API key from [console.anthropic.com](https://console.anthropic.com), paste your CV as text, then press **Fill in my details and answers from this CV**. Check the results and press **Save**.
2. **Without a key:** fill in **Your details** and edit the **Saved answers** by hand. Replace any `[bracketed]` text.
3. Fill in **Right to work** and **Need visa sponsorship** with Yes or No. ApplyFill never guesses these.

## Use it

1. Open an application form and click the ApplyFill icon, or press **Alt+Shift+F**.
2. A panel lists every field it found, with a suggested answer you can edit.
3. Press **Fill N quick fields**, then go through the open questions: pick a saved answer or press **Draft with Claude**, edit it, and press **Fill** or **Copy**.
4. Click a field's name in the panel to jump to it. Always read the form before you submit.

## Your API key and data

- Your details, saved answers, CV text and API key are stored in `chrome.storage.local` on your computer. They are not synced or sent anywhere else.
- Only **Draft with Claude** and **Fill in my details from this CV** send anything. They send the question, your CV text and profile, and some text from the job page directly to `api.anthropic.com` using your key. Usage is billed to your Anthropic account.
- The extension can only read a page after you click it (Chrome's `activeTab` permission). The listed job-board domains are there so forms embedded from those sites can be read too.
- Exported backups leave your API key out.

See [PRIVACY.md](PRIVACY.md).

## Limits

- Browsers don't let extensions attach files, so upload your CV yourself.
- Searchable dropdowns (type-to-search boxes) get the text typed in; pick the matching option yourself.
- If a form is embedded from a site that isn't listed and nothing is found, open the form in its own tab.

## Development

```
extension/
  manifest.json   Manifest V3 config
  background.js   Injects the scanner on click; makes Claude API calls
  content.js      Finds fields, matches them to your profile, draws the panel, fills fields
  defaults.js     Empty profile and template saved answers for a fresh install
  options.html/js Settings page
scripts/package.sh  Builds dist/ApplyFill-<version>.zip
```

After editing, press the reload arrow on ApplyFill's card in `chrome://extensions`.

**Field matching** lives in the `RULES` list at the top of `content.js`: each entry maps a profile key to a regular expression tested against the field's label. If a form's field isn't recognised, adding or loosening a rule there is usually the fix.

**Releasing:** bump `version` in `extension/manifest.json`, add an entry to `CHANGELOG.md`, commit, then tag and push:

```
git tag v1.1.0 && git push origin v1.1.0
```

The Release workflow builds the zip and attaches it to a GitHub release.

## Licence

MIT. See [LICENSE](LICENSE).
