# Edge Add-ons listing

Copy each field into [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview). Text and images that all stores share live in [`../chrome/listing.md`](../chrome/listing.md), so you update them in one place.

## Package

Upload `refined-threads-<version>-chrome.zip` from the GitHub release. Edge uses the Chrome build.

## Availability

**Visibility.** Public. **Markets.** All markets.

## Properties

**Category.** Social.

**Privacy policy.** Yes, https://github.com/hannoeru/refined-threads/blob/main/PRIVACY.md

**Website.** https://github.com/hannoeru/refined-threads

**Support contact.** https://github.com/hannoeru/refined-threads/issues

## Store listings

Add English and Chinese (Traditional).

**Description.** The description in [`../chrome/listing.md`](../chrome/listing.md#description-english) for each language.

**Extension store logo.** `logo-300x300.png`.

**Small promotional tile.** `../chrome/<language>/promo-tile-440x280.png`, with `en` or `zh_TW` for each listing language.

**Screenshots.** The six screenshots in `../chrome/<language>/`, in the order of their numbers.

**Search terms.**

```text
Threads, spam filter, bot filter, Threads web, account info, keyboard shortcuts
```

## Submission options

**Notes for certification.** The same text as the notes to reviewer in [`../firefox/listing.md`](../firefox/listing.md#notes-to-reviewer), with `pnpm build` in place of `pnpm build:firefox` and `.output/chrome-mv3` in place of `.output/firefox-mv3`.
