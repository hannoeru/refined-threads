# Settings page and popup

The settings page lists every feature with a switch, a search box, and a page per feature. The popup has a switch per feature and the spam filter card. All of them follow Threads' monochrome design in light and dark mode.

## Sub-features

- `settings-list` shows every feature, its description, a switch, and a Settings button when it has options.
- `settings-search` filters the list by name or description.
- `settings-feature-page` shows the feature switch, the generated option form, any custom page, and shortcuts.
- `settings-hash-route` opens `#feature/<id>` directly and follows hash changes.
- `popup-switches` turns features on and off and stays in sync with the settings page.
- `popup-spam-card` shows today's count, the top reasons, and the level picker (Light, Balanced, Strict).
- `theme` renders light and dark with Threads tokens.

## How to get to it (user POV)

- The toolbar icon opens the popup. There, choose "Settings" or "Spam filter settings".
- `chrome://extensions`, then Details, then Extension options.
- The welcome page, which opens on install, has "See all features".

## Driving it with agent_browser

Preconditions:

- A session is launched. No Threads tab is needed.

- **List.** Open `chrome-extension://<id>/options.html#features` and run `snapshot -i`. There are switches named after each feature, and "Spam filter" is checked.
- **Search.** Fill the searchbox "Search features" with `date`. Only "Real dates" remains.
- **Feature page.** Open `#feature/account-info`. Switches exist for "Country flag", "Country name", "How long on Threads", "Follower count", "Post count", "Follows you", and "You follow them".
- **Option persists.** Choose the "Follower count" switch with `find role switch click`. Eval `chrome.storage.sync.get('features')`: `account-info.options.followers` is true.
- **Popup sync.** Open `popup.html`. The "Account info" switch matches the settings page. Change the level to Strict, then eval storage: `settings.level` is `strict`.
- **Theme.** Launch with `--color-scheme light` and then `dark`, and screenshot `#feature/spam-filter` in each. The six sub-tabs fit on one line.
- **Proof.** Save the snapshots and screenshots, plus the storage JSON after each change.

## Gotchas

- `check` on a switch can report success without changing it. Use `find role switch click` and read storage back.
- The popup opened as a tab is wider than the real popup, which is 340 px. Judge only the left 340 px.
- The welcome tab may not open on install in this harness. Report it as unverified, and use the background unit test as the evidence for that path.
