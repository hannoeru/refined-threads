# Account info

**ID** `account-info` · **On by default** · **Code** [`src/features/account-info/`](../../src/features/account-info/)

Shows a small gray line of details under each author name. The line sits inside Threads' own header grid, so the post menu does not move.

## Details

Each detail has its own switch.

| Detail              | Example        | Default | Needs                                               |
| ------------------- | -------------- | ------- | --------------------------------------------------- |
| Follows you         | Follows you    | On      | Nothing extra                                       |
| You follow them     | Following      | Off     | Nothing extra                                       |
| Country flag        | 🇯🇵             | On      | An About lookup and a logged-in session             |
| Country name        | Japan          | Off     | An About lookup and a logged-in session             |
| How long on Threads | 3y, or 8mo     | On      | An About lookup and a logged-in session             |
| Follower count      | 1.2K followers | Off     | A profile lookup, or a count Threads already loaded |
| Post count          | 340 posts      | Off     | A profile lookup                                    |

An account that hides its location shows 🏴, or "🏴 Location hidden" when the country name is on. While the first lookup for an account runs, the line shows a small loading bar. When cached details have expired, the line keeps showing them while the new lookup runs, with no loading bar.

Threads does not publish how many accounts someone follows, so there is no following count.

## Lookups

- Lookups run only for details that are switched on, only for posts near the screen, and never in a hidden tab.
- One account every 1.5 seconds for About, and every 2 seconds for the profile page, newest first.
- Results are kept for 30 days (country and join date) or 7 days (counts). A failed lookup waits a day before it runs again.
- Logged out, Threads has no session for About lookups. The loading bar stops, and the extension tries again with a growing wait, up to 5 minutes.
- Turning the feature off stops its queued lookups.
