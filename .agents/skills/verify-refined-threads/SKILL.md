---
name: verify-refined-threads
description: Drive the Refined Threads browser extension on the real threads.com in a disposable agent-browser Chrome, and capture proof. Use it to verify a feature (spam filter, account info, real dates, keyboard navigation, settings page, popup) after a change, to reproduce a bug on the real surface, or before reporting a UI change as done.
---

# Verify Refined Threads

Refined Threads is a Manifest V3 extension (WXT, Vue Vapor). Users touch three surfaces:

- **threads.com page.** Content scripts add bars, chips, badges, and date text to posts.
- **Extension pages.** `options.html` (settings), `popup.html`, `welcome.html`.
- **Storage.** `chrome.storage.sync` keys `features` and `settings`, and `chrome.storage.local` keys `stats` and `profiles`.

The harness is the `agent_browser` tool with `--extension`. It launches a managed Chrome with a new, empty profile, so every run is isolated and logged out of Threads. Never drive the user's own browser (Zen, Chrome) for verification. A Firefox build exists (`pnpm build:firefox`), but this skill does not drive it.

## Launch

1. Build and prepare evidence. Run from the repository root:

   ```sh
   .agents/skills/verify-refined-threads/bin/prepare [run-id]
   ```

   It prints `RUN_ID`, `EXTENSION_DIR`, `EXTENSION_ID` (normally `jgaoncmdbnopkmiedbpldgoeibefnfad`), `EVIDENCE` (`.agent/verify/<run-id>/`), and `BUILD`. Write `BUILD` into your report.

2. Start the browser on an extension page:

   ```json
   { "args": ["--extension", "<EXTENSION_DIR>", "open", "chrome-extension://<EXTENSION_ID>/popup.html"], "sessionMode": "fresh", "timeoutMs": 60000 }
   ```

   Note the `sessionName` in the result, and pass `["--session", "<sessionName>", ...]` on every later call.

3. Ready means the popup title is `Refined Threads`. If the open fails with `net::ERR_BLOCKED_BY_CLIENT`, the extension did not load. Close that session and launch again. One retry is normal.

4. Set preconditions **from an extension page**, because `chrome.storage` exists only there. A fresh profile has default settings (spam filter on, everything else off):

   ```json
   { "args": ["--session", "<s>", "eval", "chrome.storage.sync.set({ features: { 'absolute-timestamps': { enabled: true, options: { style: 'iso', time: false } } } }).then(() => 'saved')"] }
   ```

   Content scripts follow storage changes live. A Threads tab opened afterwards starts with these settings.

After any rebuild, close the session and launch again. Chrome does not reload an unpacked extension by itself.

## Doctor

Run these read-only checks first, and again whenever something looks wrong. All must pass.

1. **Extension pages load.** `open chrome-extension://<EXTENSION_ID>/popup.html` gives the title `Refined Threads`.
2. **Content scripts run on Threads.** Open `https://www.threads.com/`, then:

   ```json
   { "args": ["--session", "<s>", "eval", "({ hooked: !XMLHttpRequest.prototype.open.toString().includes('[native code]'), styles: [...document.querySelectorAll('style[data-refined-threads]')].map(s => s.dataset.refinedThreads), posts: document.querySelectorAll('[data-pressable-container=\"true\"]').length, visible: document.visibilityState })"] }
   ```

   Expect `hooked: true`, `styles` with every enabled feature (at least `spam-filter`), `posts > 0`, and `visible: "visible"`.

   - `hooked: false` means the extension is not loaded. Relaunch.
   - `visible: "hidden"` means run `tab t1`, then `get url`, then check again.
3. **Right build.** `.output/chrome-mv3/manifest.json` must be newer than your last source change. If in doubt, run `prepare` again and relaunch.

## Drive

Use the recipes in [features/](features/README.md). Rules that apply to every recipe:

- **Post handles.** A post is `[data-pressable-container="true"]`. Its permalink is the `a[href*="/post/"]` that contains a `<time>`. The author link is `a[href="/@<user>"]` with text. Threads class names are generated, so never select by class, except the extension's own `rt-*` classes.
- **Extension handles.**

  | Handle | What it is |
  | --- | --- |
  | `.rt-bar` | Hidden-post or fallback tag bar, with buttons `Show`, `Not spam`, `Keep hiding` |
  | `.rt-chip` | Tag chip after the author name, with a `×` button |
  | `.rt-account-info` | Account details line, with item classes `rt-ai-flag`, `rt-ai-age`, `rt-ai-followers`, `rt-ai-posts`, `rt-ai-follows-you`, `rt-ai-loading` |
  | `time[data-rt-original-time]` | A rewritten date |
  | `.rt-keyboard-current` | The post selected by keyboard navigation |
  | `[data-rt-key]` | A post the spam filter has decided on |

- **Tab changes.** After `tab <id>`, call `get url` alone before any `eval`. The wrapper rejects page reads after a tab change, including inside a batch.
- **Waiting.** Wait for a condition with `["wait", "--fn", "<js>"]` and `timeoutMs` 25000 or less. One call must finish in 30 s, so split long scripts. Use fixed sleeps only inside an `eval` that measures a time window.
- **Settings page.** It is at `options.html#features` and `options.html#feature/<id>`. To toggle a switch, use `find role switch click --name "<label>"`. `check` on these visually hidden checkboxes is unreliable, and `find ... uncheck` does not exist.
- **Login dialog.** Logged out, Threads shows a dialog over the feed. Press `Escape` before screenshots. It does not block the extension.

## Evidence

Save everything under the `EVIDENCE` directory that `prepare` printed (`.agent/verify/<run-id>/`). Git ignores it, and cleanup never deletes it.

- **Screenshot.** `["--session", "<s>", "screenshot", "<EVIDENCE>/<feature>-<step>.png"]`. Check that `artifactVerification.verified` is true.
- **State.** Save the JSON result of each assertion `eval` to `<EVIDENCE>/<feature>-<step>.json` with the `write` tool.
- **Report.** Write `<EVIDENCE>/report.md` with the build, the feature IDs, the entry points used, the commands, and pass or fail for each.

Proof standards:

- **Use the real user path.** Change settings through the settings page or the popup when the feature is about them. Writing storage directly is only for preconditions.
- **Capture the action and the result.** For example, the dates before and after turning on Real dates, not only the final screen.
- **Check side effects.**
  - "Not spam" must add the author to `allowed-accounts` in `chrome.storage.sync`. Read it back from an extension page.
  - Stats must change in `chrome.storage.local`.
- **Check the network when it matters.** Use `performance.getEntriesByType('resource')` for `/@user` profile requests and `/async/wbloks/fetch/` About requests, or `network har start|stop`. HAR sizes for canceled streams are not reliable, so count requests.
- **State the logged-out limit.** Country, account age, and follow status need a logged-in Threads session, which this harness does not have. Report those as unverified unless the user gives a logged-in path.

## Cleanup

Close only the session you launched:

```json
{ "args": ["--session", "<s>", "close"] }
```

Do not use `close --all`, and do not kill browsers by name. The managed profile is thrown away with the session. Keep `.agent/verify/<run-id>/`. After cleanup, confirm the evidence files still exist with `ls <EVIDENCE>`.

## Helpers

- `.agents/skills/verify-refined-threads/bin/prepare [run-id]` builds, creates the evidence directory, and prints the run values.
- `.agents/skills/verify-refined-threads/bin/extension-id [build-dir]` prints the extension ID that Chrome gives the unpacked build. The ID depends on the absolute path.
- `pnpm bench` measures spam filter work (timings and full scans) in a simulated page. It is not proof of real-page behavior.
