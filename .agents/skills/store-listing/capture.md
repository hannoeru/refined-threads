# Capture the store images

Every image comes from a disposable agent-browser Chrome in **light** mode. Never use the user's own browser or a logged-in Threads session.

## Launch

1. Build and get the extension values:

   ```sh
   .agents/skills/verify-refined-threads/bin/prepare store
   ```

2. Open the settings page in a fresh session with the extension and light mode:

   ```json
   { "args": ["--extension", "<EXTENSION_DIR>", "--color-scheme", "light", "open", "chrome-extension://<EXTENSION_ID>/options.html#features"], "sessionMode": "fresh", "timeoutMs": 60000 }
   ```

3. Set the viewport with `["set", "viewport", "1280", "800"]`.

## Browser rules

- After each `open` or `reload`, run `["get", "url"]` before `eval` or `screenshot`. Without it, the next page-content call fails.
- One `agent_browser_code` call runs at most 25 browser commands. Split longer captures.
- Inside `agent_browser_code`, leave `--session` out of the commands, or pass the session to the code call itself.
- Write `chrome.storage` only from an extension page. Settings live in sync keys `settings` (the part count) and `settings_0`, `settings_1`, and so on.
- Close the session when you finish.

## Recipes

Save each image into `store/chrome/` under the name in the first column.

| Image | Page and setup |
| --- | --- |
| `screenshots/1-features.png` | Run `chrome.storage.sync.set({ features: { 'absolute-timestamps': { enabled: true } } })`, reload `options.html#features`, then take the screenshot. All four switches are on. |
| `screenshots/2-protection.png` | `options.html#feature/spam-filter`, Protection tab, with the default settings. |
| `screenshots/3-lists.png` | On the "Words and accounts" tab, add `free followers, giveaway, crypto signal` to the words list, `spam-shop.example, cheap-deals.example` to the sites list, and `spam_account_123` to the hidden accounts. Press Enter after each, then blur the input. |
| `screenshots/4-welcome.png` | `welcome.html`, with the default settings. |
| `src/popup.png` | First remove the `settings` and `settings_*` sync keys. Then write example stats to `chrome.storage.local.stats`: today's local date as `day`, `hidden: 14`, `tagged: 3`, and `byRule` with `affiliate-links: 8`, `engagement-bait: 4`, `copy-paste-replies: 2`. Open `popup.html` at a 340 px wide viewport. Read the height of `.popup`, set the viewport to that height rounded up, then take the screenshot. Set the same height on the `<img>` in `src/popup-shot.html`. |
| `screenshots/5-popup.png` | Open `file://<repo>/store/chrome/src/popup-shot.html` at 1280×800. |
| `screenshots/0-feed.png` | Open `file://<repo>/store/chrome/src/feed-shot.html` at 1280×800. Check that the feed column fits inside the viewport. |
| `promo-tile-440x280.png` | Open `file://<repo>/store/chrome/src/promo-tile.html` at 440×280. |

The screenshots show what each page looks like with real settings. They do not use the Threads site, which shows a login dialog and real people's posts when logged out.
