# Refined Threads verification map

This directory is the maintained source for verifying what Refined Threads users can see and do. Read this index, then use the matching feature file as the recipe. The launch, doctor, evidence, and cleanup steps are in [../SKILL.md](../SKILL.md).

## Baseline preconditions

- `bin/prepare` has built the current checkout, and a fresh agent-browser session has the extension loaded.
- Doctor passes. The Threads tab is `visible`, `hooked` is true, and there is at least one post.
- The profile is new and logged out of Threads. Default settings: spam filter on (Balanced), all other features off.
- Preconditions are written with `chrome.storage.sync.set` from an extension page, before the Threads tab loads.

## Driving conventions

- In tables and recipes, `<s>` is the session name and `<id>` is the extension ID.
- Commands are `agent_browser` argument arrays. Run them literally.
- Prefer the extension's `rt-*` handles, `data-*` attributes, `href` patterns, roles, and accessible names. Never select by Threads class names.
- The logged-out feed shows about 5 posts and does not scroll much further. A recipe that needs more posts must open a profile through Threads' own navigation by clicking an author link.

## Proof and skip reporting

- Capture the state before and after the user action.
- Read back side effects from an extension page (`chrome.storage`).
- Put each artifact in `.agent/verify/<run-id>/`, named `<feature>-<step>`.
- A logged-out run cannot prove country, account age, or follow status. Report those sub-features as skipped, with the reason. Do not count them as verified through another sub-feature.

## Features

- [Spam filter](./spam-filter.md) covers hiding, tag chips, Show, Not spam, Keep hiding, rules, and stats.
- [Account info](./account-info.md) covers the details line under the username, its switches, the loading placeholder, and lookup requests.
- [Real dates](./real-dates.md) covers date formats, the live preview, and restoring relative times.
- [Keyboard navigation](./keyboard-navigation.md) covers j, k, and o.
- [Settings page and popup](./settings-and-popup.md) covers the feature list, per-feature pages, the popup switches, and the spam level.
