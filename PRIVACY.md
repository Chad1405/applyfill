# Privacy

ApplyFill has no server and collects nothing.

**What's stored, and where.** Your details, saved answers, CV text, settings and Anthropic API key are kept in `chrome.storage.local`, which lives on your computer in your Chrome profile. They are not synced to other devices.

**What leaves your computer.** Only when you press **Draft with Claude** or **Fill in my details and answers from this CV**. Those send a request straight from your browser to `https://api.anthropic.com` with your API key. The request contains your CV text, your profile, the question being answered, and up to about 6,000 characters of text from the job page. Anthropic's handling of API data is described in its privacy policy and commercial terms.

**What the extension can see.** It runs on a page only after you click its icon or press its shortcut (`activeTab`). It reads the form fields on that page so it can suggest answers. The job-board domains in `manifest.json` let it read forms embedded from those sites on the page you clicked.

**Removing your data.** Remove the extension from `chrome://extensions`, or use **Reset to defaults** on the settings page and press Save.

## Fill log

When you fill a saved answer or a Claude draft, ApplyFill records the page address, company, role, the question and the title of the answer you used, in `chrome.storage.local`. It isn't sent anywhere. **Export fill log** on the settings page saves it as a file, which you can import into your own tracker.
