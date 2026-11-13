# Spam filter

The spam filter hides or tags posts that match the user's rules. A hidden post becomes one bar with a reason and Show. A tagged post gets a chip after the author name. "Not spam" allows the author everywhere.

## Sub-features

- `spam-hide` folds a matching post into a `.rt-bar` with the text `Hidden · <reason>` and a `Show` button.
- `spam-reveal` reveals the post with Show, offers `Not spam` and `Keep hiding`, and Keep hiding folds it again.
- `spam-allow` adds the author to `allowed-accounts` through Not spam on a bar or `×` on a chip.
- `spam-tag` adds a `.rt-chip` after the author name for a tag rule or in "Tag only" mode.
- `spam-live-settings` applies a settings change to an open Threads tab without a reload.
- `spam-stats` counts hidden and tagged posts for today in the popup.

## How to get to it (user POV)

- It is on by default. Open threads.com.
- Settings page: `options.html#feature/spam-filter`, with the tabs Protection, Words and accounts, Account filters, My rules, How it looks, Share and presets.
- Popup: the spam card with today's count and the level picker.
- Right-click an author link and choose "Hide posts from this account" or "Never hide this account".

## Driving it with agent_browser

Preconditions:

- Doctor passes on `https://www.threads.com/`.
- These test rules were written from an extension page, because the logged-out feed rarely has real spam:
  `chrome.storage.sync.set({ settings: { ruleFile: { version: 1, rules: [ { id: 'liked', name: 'Liked post', effect: 'tag', when: { field: 'counts.likes', gt: 5 } }, { id: 'busy', name: 'Busy thread', effect: 'hide', when: { field: 'counts.replies', gt: 30 } } ] } } })`
  Note that a `rules` array replaces the built-in rules for this run.

- **Hide and tag.** Load the feed. Run `["--session","<s>","open","https://www.threads.com/"]`, then `["--session","<s>","wait","--fn","document.querySelectorAll('.rt-chip, .rt-bar').length >= 2"]`. Bars read `Hidden · …` and chips read `Liked post×`.
- **Show.** Choose Show. Run `["--session","<s>","find","role","button","click","--name","Show"]`. The URL stays on `/`, the container class becomes `rt-revealed`, and the bar offers `Not spam` and `Keep hiding`.
- **Keep hiding.** Run `["--session","<s>","find","role","button","click","--name","Keep hiding"]`. The container is `rt-collapse` again.
- **Not spam.** Choose Show, then Not spam. The bar disappears. Open `chrome-extension://<id>/options.html#feature/spam-filter`, then the "Words and accounts" tab. The "Never hide these accounts" list has the author. Or eval `chrome.storage.sync.get('settings')` and read the `allowed-accounts` rule.
- **Live settings.** In a second tab, use the settings page to add a visible author under "Always hide these accounts" (fill the textbox, press Enter). Switch back with `tab t1` and `get url`. That author's post now has a `.rt-bar`.
- **Stats.** Open `popup.html`. The number shows hidden posts for today, and the top reasons list the rule names.
- **Proof.** Screenshot the feed after Escape, and save the bar and chip text from `eval` as JSON.

## Gotchas

- Clicks on the bar or chip must not open the post. Check that the URL did not change after each click.
- A hidden tab pauses lookups but not rule checks. Rule checks run on a timer, so they work in background tabs.
- Writing `rules` replaces every built-in rule. To test a built-in preset, write only `level` or use the Protection tab instead.
- The copy-paste rule needs three accounts with the same reply text. The logged-out feed does not supply that. Use unit tests (`src/features/spam-filter/__tests__`) and report the live case as skipped.
