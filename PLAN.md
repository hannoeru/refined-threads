# Lint Roller for Threads: research and draft plan

License: MIT (`LICENSE`).

## Goal

Hide bot and spam posts on Threads web (`threads.com`, `threads.net`). Anyone can install it from their browser's extension store. It works with no setup. Users who want more control can change it with simple switches, and advanced users can edit a rule file. It works in the feed, in replies, on profiles, and in search.

## Research summary

### Existing tools

| Tool | Type | How it gets post data | What it filters | Gap |
| --- | --- | --- | --- | --- |
| [Bobbin Threads Filter](https://github.com/Artificial-Sweetener/bobbin-threads-filter) | Userscript, GPL-3.0 | DOM, plus a fetch/XHR hook on `/graphql/query`, plus the bootstrap `script[type="application/json"]` tags | Username, verified, phrase or regex, AI label, trending, "Suggested for you" | Needs a userscript manager. Fixed rule types. No combined conditions. |
| [threads-shopee-filter](https://github.com/eryet/threads-shopee-filter) | MV3 extension | DOM anchors, GraphQL hook in the MAIN world, background fetch of post permalinks | One fixed pattern: the author replies to their own post with a Shopee link | One hard-coded bot pattern. |
| [threads-view-counts](https://github.com/yohanology/threads-view-counts) | MV3 extension | GraphQL hook, replays `BarcelonaPostViewCountQuery` with captured auth fields | Not a filter | Shows that extra per-post queries work, with throttling. |
| Greasy Fork keyword scripts, ThreadsFilter, Spool (Safari) | Userscript or extension | DOM text | Keywords and user lists | Keywords only. |
| SlopRadar, AI Slop Blocker | Extension, multi-site | DOM text, on-device model | "AI slop" text | Text only. No account signals. |

No existing tool combines a zero-setup install, combined bot signals, and a portable rule file.

### Technical facts

Facts 1, 5, and 8 come from a check on the real site on 2026-11-12. The check used Zen (Firefox engine), a logged-in account, and the two-column home layout ("おすすめ" and "フォロー中"). A console probe read the bootstrap JSON, hooked `fetch` and XHR, and scrolled every column. The probe scripts are not kept in the repository.

1. **Two data sources carry post data.**
   - The first page arrives in 4 server-rendered `script[type="application/json"]` tags that contain `logging_info_token`. On the checked page they held 27 posts.
   - Later pages arrive from `POST /graphql/query` through **XMLHttpRequest, not `fetch`**. During the check, 0 GraphQL requests used `fetch`.
   - The query name is in the `X-FB-Friendly-Name` request header. Queries that carried posts:
     - `BarcelonaFeedPaginationDirectQuery` (home feed)
     - `BarcelonaCustomFeedRefetchableQuery` (custom feeds)
     - `BarcelonaSearchResultsRefetchableQuery` (search)
     - `BarcelonaActivityFeedV2ListPaginationQuery` (activity)
   - `useBarcelonaBatchedDynamicPostCountsSubscriptionQuery` runs very often and carries no posts. Skip it early to save work.
2. **The page hook must run in the MAIN world at `document_start`.** Chrome supports `"world": "MAIN"` in the manifest. Firefox supports it from version 128 ([Mozilla blog](https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/)). MAIN world scripts cannot use extension APIs, so the hook sends records to the isolated content script with `CustomEvent`.
3. **WXT splits the work the same way.** A MAIN world content script gets no context object, so WXT UI helpers such as `createShadowRootUi` must run in the isolated content script ([WXT discussion #1451](https://github.com/wxt-dev/wxt/discussions/1451)).
4. **Post records are recognizable by shape, not by query name.** Bobbin walks the full JSON and takes every object with `code` and `pk` (plus `logging_info_token`). This survives `doc_id` changes, which Meta rotates.
5. **The DOM is obfuscated.** Class names are generated (`x1n2onr6 ...`).
   - `[data-pressable-container="true"]` is the post container. The check found 181, none nested, and 169 of them had a `/post/` link. The others are not posts, for example suggestion cards.
   - `[role="article"]` and `<article>` match nothing. Do not use them as a fallback.
   - The permalink code joins a DOM node to its data record. Avatar `alt` text is localized ("…のプロフィール写真"), so never match on visible text.
   - The home page can show more than one column, each with its own scroll container. Hide logic must work per post, not per column.
6. **Do not remove nodes.** Threads uses list virtualization. Collapse a post in place.
7. **SPA navigation and infinite scroll.** Use a `MutationObserver` on the feed. Watch URL changes to reset per-page state.
8. **Fields in each post record (checked).**
   - Post: `code`, `pk`, `taken_at`, `like_count`, `caption.text`, `detected_language`, `is_paid_partnership`, and `gen_ai_detection_method.detection_method` (`"NONE"` when there is no label).
   - `text_post_app_info`: `is_reply`, `reply_to_author`, `root_post_author`, `direct_reply_count`, `repost_count`, `quote_count`, `link_preview_attachment`, `text_fragments` (with `link_fragment` and `mention_fragment`), `share_info.reposted_post` and `quoted_post`, and `self_thread_info`.
   - `user`: `pk`, `username`, `full_name`, `is_verified`, `biography`, `text_post_app_is_private`, `is_meta_ai_bot`, `transparency_label`, and `friendship_status` (`following`, `followed_by`, `muting`, `blocking`).
   - **Not present:** follower count, account creation date, and view count. Rules that need them depend on Phase 8 lookups.

### Install cost per store

| Store | Cost to publish | Covers |
| --- | --- | --- |
| Chrome Web Store | One-time $5 fee | Chrome, Brave, Arc, Opera, Vivaldi |
| Microsoft Edge Add-ons | Free | Edge |
| Firefox Add-ons (AMO) | Free | Firefox desktop and Firefox for Android |
| Safari (App Store) | Apple Developer Program, $99 per year, plus an Xcode wrapper | Safari on macOS and iOS. Later phase. |

## Product decisions

0. **Name: Lint Roller for Threads.** Chinese name: 黏毛滾輪 for Threads. A lint roller removes fuzz from fabric. The tool removes bot fuzz from threads. No browser extension uses this name (web search on 2026-11-12). Put "for Threads" at the end, so the name does not look like an official Meta product.
1. **One product: a store-listed browser extension.** The userscript build from the first draft is removed. A userscript manager is an extra install step that most users will not take.
2. **Works on install.** Protection is on at "Balanced" level. The user does not have to open any settings.
3. **Small permission request.** Host access to `threads.com` and `threads.net` only, plus `storage`. The store shows "Read and change your data on threads.com", not "all websites". This lowers fear at install.
4. **No data leaves the browser.** No server, no account, no analytics. Say this on the store page and in the welcome page.
5. **Plain words everywhere.** The UI says "Spam and bot posts", not "rules", "regex", or "threshold". The rule file exists, but only the Advanced page shows it.
6. **Languages at launch:** English and Traditional Chinese, through `chrome.i18n` (`_locales/en`, `_locales/zh_TW`).

## User interface

### 1. Welcome page (opens once after install)

- One headline: "You are protected on Threads."
- Three cards to pick the protection level. "Balanced" is preselected:
  - **Light:** hides only clear spam, such as affiliate links in the author's own reply.
  - **Balanced:** also hides engagement bait and copy-paste reply bots.
  - **Strict:** also hides suspicious accounts you do not follow.
- A "Open Threads" button. No other steps.

### 2. Toolbar popup (click the extension icon)

- Big on/off switch for this browser.
- Protection level: Light, Balanced, Strict.
- "Hidden today: 37" with a short list of the top reasons.
- Links: "Settings" and "Report a problem".

### 3. In-page controls (on threads.com)

- A hidden post shows as one thin bar: "Hidden: affiliate spam. Show". It keeps the feed layout stable.
- After "Show", the bar offers "Not spam" (adds the author to Allowed accounts) and "Keep hiding".
- Each visible post gets a small item in a hover menu: "Hide posts from @user" and "Hide posts like this". The second one opens a short dialog that suggests a word or a link host from the post, with checkboxes.
- All in-page UI lives in a shadow root, so Threads styles do not break it, and it follows the Threads light or dark theme.

### 4. Settings page (options page)

Tabs, in this order:

1. **Protection.** The same three levels, and below them a list of filter switches with a one-line plain description each:
   - Affiliate links in the author's own reply
   - Engagement bait ("comment +1", "DM me for the link")
   - Copy-paste replies (the same reply text from many accounts)
   - Posts with an AI label
   - Accounts with auto-generated looking names (Strict only by default)
   - Posts from accounts you do not follow in replies (Strict only by default)
2. **Words and links.** Chip inputs: "Hide posts that contain these words" and "Hide posts that link to these sites".
3. **Accounts.** Two lists, Hidden accounts and Allowed accounts, with search and remove.
4. **How it looks.** Collapse to a bar, blur, or only mark. "Mark only" is a safe test mode.
5. **Backup.** Export settings to a file, import a file, and sync between your computers through `chrome.storage.sync`.
6. **Advanced.** Hidden behind a "Show advanced" switch:
   - Rule file editor with validation messages in plain words and line numbers.
   - Subscribe to a shared rule list by URL.
   - Per-rule hit counts, to tune rules.

### Mapping the UI to the rule file

The UI is a view of one rule file. Each switch turns on a built-in rule set. Each chip adds a condition. Hidden and Allowed accounts are lists. Advanced users who edit the file see the same data. One data model drives the UI, the rule engine, and export.

## Data shape

```ts
type Post = {
  code: string
  pk: string
  surface: 'feed' | 'replies' | 'profile' | 'search'
  author: {
    pk: string
    username: string
    fullName: string
    bio: string
    isVerified: boolean
    isPrivate: boolean
    following: boolean
    followedBy: boolean
  }
  text: string
  language: string
  isPaidPartnership: boolean
  links: string[]
  hashtags: string[]
  mentions: string[]
  hasAiLabel: boolean
  isRepost: boolean
  replyTo?: { code: string; authorUsername: string }
  counts: { likes: number; replies: number; reposts: number; quotes: number }
  takenAt: number
  selfRepliesWithLinks: string[]
}

type Settings = {
  enabled: boolean
  level: 'light' | 'balanced' | 'strict'
  display: 'collapse' | 'blur' | 'mark'
  ruleFile: RuleFile
  subscriptions: { url: string; lastFetched: number }[]
}
```

A `PostCatalog` keyed by `code` holds `Post` records. The MAIN world hook fills it. The DOM layer reads it by permalink code. A post with no record yet waits, then falls back to fields read from the DOM.

## Rule file format

A versioned JSON file, validated with valibot at load. The same schema exports a JSON Schema for editor autocomplete in the Advanced tab. JSON is chosen over YAML because the UI writes this file and most users never see it.

```json
{
  "version": 1,
  "threshold": 3,
  "presets": ["affiliate-self-reply", "engagement-bait", "copy-paste-replies"],
  "lists": { "affiliate_hosts": ["shopee.tw", "shp.ee", "amzn.to"] },
  "rules": [
    { "id": "my-words", "weight": 3, "when": { "field": "text", "contains_any": ["私訊我", "link in bio"] } },
    { "id": "my-hosts", "weight": 3, "when": { "field": "links", "host_in": "affiliate_hosts" } }
  ],
  "hiddenAccounts": ["spam_account_123"],
  "allowedAccounts": ["friend_one"]
}
```

Semantics:

- Each matching rule adds its `weight`. A post at or above `threshold` is hidden.
- `allowedAccounts` and accounts you follow always win.
- `hiddenAccounts` always hide.
- Operators: `is`, `in`, `matches`, `contains_any`, `host_in`, `gt`, `lt`, combined with `all`, `any`, and `not`.
- No JavaScript in rule files. Shared files must be safe to import.

## Tech stack

- **WXT** for the extension build, Manifest V3, one source for Chrome, Edge, and Firefox. WXT runs on Vite, so each UI page is a normal Vite entry.
- **Vue Vapor mode** for the settings page, popup, welcome page, and in-page UI.
  - Every component uses `<script setup vapor lang="ts">`, and every app starts with `createVaporApp`. This keeps the virtual DOM runtime out of the bundle, which matters most for the content script.
  - Vapor needs Vue 3.6. On 2026-11-12, npm has `vue@3.6.0-rc.15` on the `rc` tag, and `latest` is still `3.5.45`. Pin the exact RC version and update on purpose.
  - Vapor supports only the Composition API with `<script setup>`. Do not use a virtual-DOM component library. Write the few components this UI needs (switch, segmented control, chip input, list, dialog) by hand.
  - If a Vapor bug blocks a screen, change that one component to a normal component and use `vaporInteropPlugin`. Do not move the whole app off Vapor.
- **valibot** for the rule file and settings schemas.
- **Vitest** for the rule engine and parser tests, with recorded real payloads as fixtures.
- **Playwright** with the built extension loaded, for end-to-end checks on saved Threads pages.

## Phases

Each phase ends with a working extension.

1. **Capture.** WXT skeleton. MAIN world hook, bootstrap JSON parser, `PostCatalog`, bridge to the isolated script. Check: the console lists every post in the home feed, a profile, and a reply page.
2. **Rule engine and presets.** Pure `evaluate(post, ruleFile)`. Built-in presets for the three levels. Check: Vitest with recorded payloads.
3. **Hide in the page.** Collapse bar with "Show", "Not spam", and "Keep hiding". Default level Balanced, on at install. Check: live site in "Mark only", then "Collapse", through infinite scroll and SPA navigation. This is the first version a non-technical user can use.
4. **Popup and welcome page.** On/off, level, hidden count. Check: install the unpacked build in a clean browser profile and finish setup with no reading.
5. **Settings page.** Protection, Words and links, Accounts, How it looks, Backup. In-page "Hide posts from @user" and "Hide posts like this".
6. **Store release.** Final icon from `assets/icon/option-3.png`, with transparent corners and a simpler 16 px version. The generated PNGs have no alpha channel, and the robot details disappear at 16 px. Screenshots, privacy policy, store text in English and Traditional Chinese. Submit to Chrome Web Store, Edge Add-ons, and Firefox Add-ons.
7. **Advanced.** Rule file editor, shared list subscriptions, per-rule hit counts.
8. **Extra signals.** Opt-in, throttled profile lookups for follower count and account age, cached in storage.
9. **Safari.** Xcode wrapper and App Store release, if demand justifies $99 per year.

## Risks

| Risk | Effect | Response |
| --- | --- | --- |
| Meta changes the DOM | Posts are not found | Few anchors in one module. Playwright smoke test on saved pages. Fast store updates. |
| Meta changes the payload shape | No records | Detect posts by shape, not by query name. Fall back to DOM text. |
| False positives hide real people | Users lose trust and uninstall | Balanced default stays conservative. Every hidden post shows its reason and a one-click "Not spam". "Mark only" mode for testing. |
| Store review rejects the MAIN world hook | No release | Single purpose, narrow host permissions, no remote code, clear privacy policy. Rule lists are data, not code. |
| Extra requests trigger rate limits or account flags | User account risk | Phase 8 only, opt-in, throttled, cached. |
| Automatic "Not interested", mute, or block | Account actions done by a script, possible Terms of Use problems | Out of scope. |
| Regex from shared lists is slow (ReDoS) | Feed freezes | Regex only in Advanced. Limit pattern length and time-box evaluation. |
| Threads app users | The tool does not work in the iOS or Android app | Web only. State this on the store page. Firefox for Android covers mobile web. |

## Open decisions

1. Final icon choice. Three Codex options are in `assets/icon/`. The recommendation is option 3, a purple background with green robot fuzz on the roller. It is the easiest to read at 32 px.
2. Who owns the store developer accounts.

The project is MIT. Bobbin is GPL-3.0, so do not copy its code. The plan needs none of it.
