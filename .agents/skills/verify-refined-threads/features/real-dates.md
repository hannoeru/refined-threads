# Real dates

Real dates replaces "5h" style times with a real date in the format the user chooses. Turning it off restores the original text.

## Sub-features

- `dates-off-default` keeps relative times while the feature is off.
- `dates-format` shows the chosen style: medium, short, long, ISO, US, European, or a custom pattern.
- `dates-time` adds or omits the time.
- `dates-relative` keeps "5h ·" in front.
- `dates-preview` updates the settings page preview when the format changes.
- `dates-restore` brings back the original text when the feature is turned off, without a reload.

## How to get to it (user POV)

- Settings page: Features, then "Real dates". The format options are at `#feature/absolute-timestamps`.
- Popup: the "Real dates" switch.

## Driving it with agent_browser

Preconditions:

- Doctor passes. Default settings, so Real dates is off.

- **Off by default.** On the feed, eval `[...document.querySelectorAll('a[href*="/post/"] time')].slice(0,3).map(t => t.textContent)`. The values are relative, such as `12時間` or `5h`.
- **Choose a format.** In a second tab, open `chrome-extension://<id>/options.html#feature/absolute-timestamps`. Run `["--session","<s>","snapshot","-i"]`, then select `ISO (2026-11-13)` in the combobox "Date format". The preview shows `YYYY-MM-DD HH:mm`.
- **Turn it on.** Run `["--session","<s>","find","role","switch","click","--name","Real dates"]`. Read back with eval `chrome.storage.sync.get('features')`: `absolute-timestamps.enabled` is true.
- **Applied live.** Run `tab t1` and `get url`, then eval the same `time` texts. They now match `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$`, and each `time` has `data-rt-original-time` and a `title`.
- **Restore.** Turn the switch off on the settings tab, then on `t1` eval again. The texts are relative again, and no `time[data-rt-original-time]` remains.
- **Proof.** Save the before, on, and after JSON, and screenshot the settings page with the preview.

## Gotchas

- Dates follow the browser language. The managed Chrome may use Japanese, which gives `2026年11月3日` for Long. Assert ISO for stable checks.
- Only the time inside a post permalink is rewritten, not other `time` elements.
- The custom pattern is used only when the format is "Custom pattern".
