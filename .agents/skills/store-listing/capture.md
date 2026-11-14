# Capture the store images

Every image comes from a disposable agent-browser Chrome in **light** mode. Never use the user's own browser or a logged-in Threads session.

## Launch

Do one pass per language, each in its own fresh session. `<language>` is `en` or `zh_TW`, and `<apple>` is `en-US` or `zh-TW`.

1. Build and get the extension values:

   ```sh
   .agents/skills/verify-refined-threads/bin/prepare store
   ```

2. Open the settings page in a fresh session with the extension, light mode, and the language. On macOS, Chrome ignores `--lang`. The `-AppleLanguages` argument sets the language that `chrome.i18n` uses:

   ```json
   { "args": ["--extension", "<EXTENSION_DIR>", "--color-scheme", "light", "--args", "-AppleLanguages\n(<apple>)", "open", "chrome-extension://<EXTENSION_ID>/options.html#features"], "sessionMode": "fresh", "timeoutMs": 60000 }
   ```

3. Check that `chrome.i18n.getUILanguage()` returns `<apple>`, then set the viewport with `["set", "viewport", "1280", "800"]`.

## Browser rules

- After each `open` or `reload`, run `["get", "url"]` before `eval` or `screenshot`. Without it, the next page-content call fails.
- One `agent_browser_code` call runs at most 25 browser commands. Split longer captures.
- Inside `agent_browser_code`, leave `--session` out of the commands, or pass the session to the code call itself.
- Write `chrome.storage` only from an extension page. Settings live in sync keys `settings` (the part count) and `settings_0`, `settings_1`, and so on.
- Close the session when you finish. `close` often times out after 30 to 45 seconds. Files saved before it are complete, so check them and start the next pass with `"sessionMode": "fresh"`.

## Recipes

Save each image into `store/chrome/<language>/`. Find tabs and inputs by position, because their names change with the language: the spam filter tabs are `.subtab:nth-child(1)` to `(6)`, and the list inputs are `.chips:nth-of-type(1)` to `(4)` with `.chips-add input`.

| Image | Page and setup |
| --- | --- |
| `1-features.png` | Run `chrome.storage.sync.set({ features: { 'absolute-timestamps': { enabled: true } } })`, reload `options.html#features`, move the mouse to a corner, then take the screenshot. All four switches are on. |
| `2-protection.png` | `options.html#feature/spam-filter`, first tab, with the default settings. |
| `3-lists.png` | Second tab. Add example words to the first list, `spam-shop.example, cheap-deals.example` to the second, and `spam_account_123` to the third. Press Enter after each, blur the input, and move the mouse to a corner. Words: `free followers, giveaway, crypto signal` in English, `免費粉絲, 抽獎, 飆股明牌` in Chinese. |
| `4-welcome.png` | `welcome.html`. |
| `src/popup-<language>.png` | Remove the `settings` and `settings_*` sync keys. Write example stats to `chrome.storage.local.stats`: today's local date as `day`, `hidden: 14`, `tagged: 3`, and `byRule` with `affiliate-links: 8`, `engagement-bait: 4`, `copy-paste-replies: 2`. Open `popup.html` at 340 px wide, read the height of `.popup`, set the viewport to that height rounded up, then take the screenshot. If the height changed, update the `<img>` height in `src/popup-shot.html`. |
| `5-popup.png` | Open `file://<repo>/store/chrome/src/popup-shot.html?lang=<language>` at 1280×800. |
| `0-feed.png` | Open `file://<repo>/store/chrome/src/feed-shot.html?lang=<language>` at 1280×800. Check that the feed column fits inside the viewport. |
| `promo-tile-440x280.png` | Open `file://<repo>/store/chrome/src/promo-tile.html?lang=<language>` at 440×280. |
| `../edge/logo-300x300.png` | No browser, one file for every language. Run `sips -z 300 300 assets/icon/source.png --out store/edge/logo-300x300.png`. |

A new language needs a folder, a JSON entry in each page in `src/`, and an entry in `LOCALES` in `bin/check.mjs`.

The screenshots show what each page looks like with real settings. They do not use the Threads site, which shows a login dialog and real people's posts when logged out.
