# Changelog

## Unreleased

- Field matching ranks its signals: `autocomplete` first, then the accessible name, label text, `name`/`id`, then site hooks such as Workday's `data-automation-id`. Measured on 15 captured forms from Greenhouse, Lever, Ashby, Teamtailor and webITrent: 90% → 100% precision, 77% → 91% recall.
- Fixes found on real forms: "ethnicity" no longer matches City; "Preferred first name" is no longer skipped as a referral question; long yes/no questions (sponsorship, right to work) are recognised; Lever and webITrent radio groups get their real question; a field no longer borrows a neighbouring field's label.
- Custom dropdowns (Greenhouse's react-select, Workday's button lists) now get the matching option picked instead of just typed in. Only options on screen are considered, so a hidden phone-country list can't be picked by mistake.
- **Fill N quick fields** only fills answers from your details. Saved-answer templates are no longer written into short boxes such as a privacy-notice question.
- Draft with Claude treats job-page text, and the question itself, as length-capped data that can't give instructions. Drafts that include a link, email or phone number that isn't in your CV are flagged.
- New fill log: which saved answer went to which company. Export it from settings and import it into the AI Role Tracker to compare reply rates.
- Tests: Vitest + jsdom accuracy tests on labelled fixtures, Playwright tests with the extension loaded, and a CI check that fails if accuracy drops below the baseline.

## 1.1.0 – 2026-10-17

- Shareable setup: a fresh install starts with empty details and template answers, and the settings page opens on install.
- New **Fill in my details and answers from this CV**: Claude reads your CV and fills your profile and saved answers. It never guesses right to work, sponsorship, nationality, pronouns or salary.
- The panel prompts you to add your details if they're empty, and warns when an answer still has `[bracketed]` text.
- Restore a backup from a file instead of pasting it.
- Swamp, Chive Blossom and Rose Red colour palette.

## 1.0.0 – 2026-10-16

- First version: scans application forms, matches fields to your profile, fills or copies answers, saved answers for open questions, a character counter for limited fields, and Draft with Claude using your own API key.
