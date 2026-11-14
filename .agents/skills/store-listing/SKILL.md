---
name: store-listing
description: Generate or update the Chrome Web Store listing in store/chrome (description text, privacy answers, screenshots, promo tile). Use it before a store release, or after a change to a feature, a permission, the settings page, the popup, the welcome page, or the on-page bars, chips, and account line.
---

# Store listing

`store/chrome/` holds everything the Chrome Web Store dashboard asks for:

- `listing.md` has the text for each dashboard field, in English and Traditional Chinese.
- `screenshots/` holds six images at 1280×800, numbered in upload order. `promo-tile-440x280.png` is the small promo tile.
- `src/` holds the HTML pages behind `0-feed.png`, `5-popup.png`, and the promo tile. `feed-shot.html` is a mock feed that copies the extension's real CSS and strings.
- `sources.json` records a hash of the source files behind each image. `bin/check.mjs` compares it with the code.

The listing is **truthful**: every image and sentence shows behaviour the current build has, with the default settings unless the text says otherwise. The mock feed and the example popup counts are labelled as examples.

## Steps

1. **Find the drift.** From the repository root, run `node .agents/skills/store-listing/bin/check.mjs`. Done when you have its list of problems. An empty list after a feature change still means step 2 applies.

2. **Update the text.** Read the diff since the last change to `store/chrome/` (`git log -1 --format=%h -- store/chrome`). Update `listing.md` and `extDescription` in `public/_locales/*/messages.json` for every change in a feature, a default, a permission, a level, or what the extension sends to the network. Edit both languages in one pass, and take each feature, level, and button name from the locale files, so the listing uses the words the UI shows. Done when every user-visible change in the diff is either in both descriptions or deliberately left out, and the privacy answers still match `PRIVACY.md` and `wxt.config.ts`.

3. **Render the stale images.** Follow [capture.md](capture.md) for each image that the check marks stale or missing, and for any image whose content step 2 changed. Look at every new image before you go on. Done when each new image shows the current UI, at the right size, with no other users' content.

4. **Record and check.** Run `node .agents/skills/store-listing/bin/check.mjs --update`, then run `pnpm check`. Done when both exit with code 0.

5. **Commit.** Use `docs: update the Chrome Web Store listing`, and list in the body what changed and which images were rendered again. Done when the commit is pushed and CI passes.

## Accuracy rules for `feed-shot.html`

- Each bar and chip must be one the extension can show with default settings. A built-in check that scores 3 or more hides the post (Balanced hides at 3). A tag chip therefore comes from a user rule with the **Tag** effect, and it shows that rule's name.
- Only Balanced-level reasons appear in bars: `affiliate link`, `engagement bait`, `copy-paste reply`. The check script verifies each bar reason against the `reason_*` strings.
- After a change to `STYLE` in `src/features/spam-filter/view.ts`, the account-info `STYLE`, or the keyboard-navigation style, copy the new CSS into the matching block of `feed-shot.html`.
- Names, avatars, and posts are made up, and the page says so in its note.
