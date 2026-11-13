# Account info

Account info shows a small line of details under each author name: follow relationship, country flag or name, account age, follower count, and post count. Each detail has its own switch.

## Sub-features

- `ai-line` puts one `.rt-account-info.rt-ai-line` in the author header, under the name, without moving the `⋯` menu.
- `ai-loading` shows a pulsing `.rt-ai-loading` item while a lookup waits or runs.
- `ai-counts` shows `N followers` and `N posts` after profile lookups.
- `ai-place-age` shows the flag, country name, or 🏴, and the age. It needs a logged-in session.
- `ai-follow` shows "Follows you" and "Following". It needs a logged-in session.
- `ai-seen-followers` reuses follower counts that Threads loaded itself, for example when a profile is opened.
- `ai-request-budget` looks up only posts near the screen, and none while the tab is hidden.

## How to get to it (user POV)

- Settings page: Features, then switch on "Account info". Then go to `#feature/account-info` and the detail switches.
- Popup: the "Account info" switch.

## Driving it with agent_browser

Preconditions:

- Doctor passes.
- Written from an extension page: `chrome.storage.sync.set({ features: { 'account-info': { enabled: true, options: { flag: false, age: false, followsYou: false, followers: true, posts: true } } } })`.

- **Loading then filled.** Open the feed, run `tab t1` and `get url`, then sample for up to 12 s with `eval`, collecting each `.rt-account-info` state (`loading`, `hidden`, `filled`). Posts near the screen go from `loading` to `filled` about 2 s apart.
- **Placement.** Eval for each badge: `parentElement` has computed `display: grid`, it is under the name, and the menu `top` did not change. The badge text looks like `559 followers · 2432 posts`.
- **Request budget.** After about 15 s, count `performance.getEntriesByType('resource')` entries matching `/threads\.com\/@[^/?]+$/`. Expect at most one per post within 200 px of the screen. Reload while the tab is hidden: expect 0.
- **Seen followers.** Add a listener for `refined-threads:users` in the page, click an author link, and wait 8 s. The event carries `{ pk, followers }`. The author's posts on the profile show that count.
- **Proof.** Save the sampled states and request counts as JSON, and take a screenshot after Escape.

## Gotchas

- Lookups pause in hidden tabs. After any `tab` switch, check that `document.visibilityState` is `visible` before you measure.
- Logged out, About lookups fail, so `ai-place-age` and `ai-follow` cannot be proven. Report them as skipped.
- The queue is throttled (1.5 s for About, 2 s for profile pages). A wait shorter than 2 s × the number of posts times out without meaning a bug.
- To prove `ai-seen-followers` saved a request, the author must not have been looked up before in this profile. Use a fresh session.
