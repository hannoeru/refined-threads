# Firefox Add-ons listing

Copy each field into the [Add-on Developer Hub](https://addons.mozilla.org/developers/). Text and images that all stores share live in [`../chrome/listing.md`](../chrome/listing.md), so you update them in one place.

## Upload

1. Choose **Submit a New Add-on**, then **On this site**.
2. Upload `refined-threads-<version>-firefox.zip` from the GitHub release. The add-on ID `refined-threads@hannoeru.me` and the data collection setting come from `wxt.config.ts`.
3. When asked whether the add-on uses minified, concatenated, or machine-generated code, answer **Yes**. Upload `refined-threads-<version>-sources.zip` from the same release.

## Describe the add-on

**Name.** Refined Threads

**Summary** (at most 250 characters):

```text
A collection of small, switchable features that make Threads web better, including a spam and bot filter. Inspired by Refined GitHub.
```

**Description.** The English description in [`../chrome/listing.md`](../chrome/listing.md#description-english). Add the Traditional Chinese description as a zh-TW translation.

**Categories.** Social & Communication, and Privacy & Security.

**Support website.** https://github.com/hannoeru/refined-threads/issues

**Homepage.** https://github.com/hannoeru/refined-threads

**License.** MIT License.

**Privacy policy.** Paste the text of [`PRIVACY.md`](../../PRIVACY.md). The add-on collects no data, so the policy is optional, but it answers the questions reviewers and users ask.

**Screenshots.** The images in `../chrome/screenshots/`, in the same order.

## Notes to reviewer

```text
Build steps (the same as CI):
1. Install Node 24 and pnpm 12 (corepack enable).
2. pnpm install --frozen-lockfile
3. pnpm build:firefox
The add-on is in .output/firefox-mv3.

The add-on runs only on threads.com and threads.net. The page-hook content script runs in the MAIN world to read the post data that Threads loads for itself (XHR, fetch, and the server-rendered JSON). It sends requests only to threads.com, and only for account checks the user turns on. Settings are in storage.sync. There is no server, no analytics, and no remote code. User regular expressions run with re2js (bundled), not eval.

To test: open https://www.threads.com. The spam filter, account info, and keyboard navigation are on by default. Press j and k to move between posts. The toolbar popup and the settings page list every feature.
```
