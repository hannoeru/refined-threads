# Spam filter

**ID** `spam-filter` · **On by default** · **Code** [`src/features/spam-filter/`](../../src/features/spam-filter/)

Hides or tags spam and bot posts on Threads. The settings page has seven tabs: Protection, Words and accounts, Account filters, My rules, How it looks, Presets, and Ranking.

## On the page

- A hidden post folds into one line with the reason, such as "Hidden · affiliate link", and a **Show** button. After Show, the line offers **Not spam** and **Keep hiding**.
- A tagged post gets a small chip after the author name. Its × button means "Not spam".
- **Not spam** adds the author to the allowed accounts.
- Right-click a link to a Threads profile for **Hide posts from this account** and **Never hide this account**.
- The popup shows how many posts were hidden and tagged today, the top reasons, and the level.

## Levels

A level turns a set of built-in checks on or off. Each of these checks adds 3 points, except auto-made names and strangers in replies, which add 1 point.

| Level              | Checks                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| Light              | Affiliate links                                                           |
| Balanced (default) | Affiliate links, engagement bait, copy-paste replies                      |
| Strict             | All of Balanced, plus AI label, auto-made names, and strangers in replies |

By default, a post is tagged at 2 points and hidden at 3 points. Replies use their own two thresholds, with the same defaults. The thresholds are on the My rules tab.

## Built-in checks

| Check                | What it matches                                                                                               | Default         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | --------------- |
| People you follow    | Authors you follow. Their posts are never hidden.                                                             | On              |
| Allowed accounts     | Accounts on your allowed list. Never hidden.                                                                  | On              |
| Hidden accounts      | Accounts on your hidden list. Always hidden.                                                                  | On              |
| Blocked words        | Posts that contain a word from your list. Hidden.                                                             | On              |
| Blocked sites        | Posts that link to a site from your list, or its subdomains. Hidden.                                          | On              |
| Account country      | Accounts based in a country you pick. Hidden.                                                                 | On, empty list  |
| New accounts         | Accounts that joined less than 6 months ago. Tagged.                                                          | Off             |
| Few followers        | Fewer than 10 followers. 1 point.                                                                             | Off             |
| Few posts            | Fewer than 5 posts. 1 point.                                                                                  | Off             |
| Affiliate links      | Shopee, Amazon, Rakuten, and other affiliate hosts, also in the author's own replies in the thread. 3 points. | Light and up    |
| Engagement bait      | Phrases such as "comment +1" and "link in bio", in English, Chinese, and Japanese. 3 points.                  | Balanced and up |
| Copy-paste replies   | The same reply text from three or more accounts. 3 points.                                                    | Balanced and up |
| AI label             | Posts that Threads marks as made with AI. 3 points.                                                           | Strict          |
| Auto-made names      | Usernames like `name_83921`. 1 point.                                                                         | Strict          |
| Strangers in replies | Replies with links or mentions from people who do not follow you. 1 point.                                    | Strict          |

The Protection and Account filters tabs let you change the effect (hide, tag, add points) and the points of their checks.

## Account checks

Account country, new accounts, few followers, and few posts need details that the feed does not have. The extension looks them up through the same requests Threads makes for "About this profile" and the profile page:

- only when one of these checks is on;
- only for posts near the screen, and never in a hidden tab;
- one account every 1.5 seconds (About) or 2 seconds (profile page), with results kept for 30 or 7 days.

Country and join date need a logged-in Threads session. Follower counts that Threads already loaded are used without a request.

## How it looks

- **Fold away** (default) shows the one-line bar. **Blur** keeps the post in place, blurred, until you choose Show.
- **Tag only, never hide** is a test mode. Every post that would be hidden gets a tag instead.

## My rules and presets

A rule has a name, a target (all posts, posts, or replies), a condition, and an effect: **Hide**, **Tag**, **Add points**, or **Never hide**. Never hide wins over every other rule.

Presets add a ready-made set of rules and keep your other rules: Affiliate spam, Engagement bait, New and empty accounts, Reply guard, and Test mode.

## Ranking

The Ranking tab lists the 50 accounts whose posts the filter hid or tagged most. Each row shows the account, its hidden and tagged counts, its most common reason, and the day it was last seen. The list is sorted by hidden plus tagged posts, then by the newest day.

- Each post counts once, also after a reload. The extension keeps the newest 30 post codes of each account to check this.
- The list keeps up to 500 accounts in `storage.local`. When it is full, the accounts seen longest ago go first, then the accounts with the lowest counts.
- **Hide account** adds the account to your hidden accounts list. It changes only your settings, never your Threads account.
- **Clear ranking** deletes the list.

## Settings file

The **Import and export** page of the settings exports this format. Its import and its advanced editor accept it, and presets use it too. A full export also has a `features` field with each feature's switch and options, in the same shape as the `features` key in `storage.sync`. Presets have no `features` field, so they never change feature switches.

```json
{
  "format": "refined-threads-settings",
  "name": "My spam filter",
  "description": "Optional text for the people you share it with.",
  "features": {
    "absolute-timestamps": { "enabled": true, "options": { "style": "iso" } }
  },
  "settings": {
    "level": "balanced",
    "tagOnly": false,
    "display": "collapse",
    "ruleFile": {
      "version": 1,
      "scoring": {
        "posts": { "tagAt": 2, "hideAt": 3 },
        "replies": { "tagAt": 2, "hideAt": 3 }
      },
      "rules": [
        {
          "id": "giveaway-bots",
          "name": "Giveaway bots",
          "enabled": true,
          "target": "replies",
          "effect": "score",
          "score": 2,
          "when": {
            "all": [
              { "field": "text", "contains_any": ["giveaway", "抽獎"] },
              { "field": "author.followers", "lt": 50 }
            ]
          }
        }
      ]
    }
  }
}
```

Rule fields:

| Key      | Values                                                                                      |
| -------- | ------------------------------------------------------------------------------------------- |
| `id`     | Lower-case letters, digits, and `-`. Import merges rules by `id`.                           |
| `effect` | `hide`, `tag`, `score` (adds `score` points, -100 to 100), `allow` (never act on the post). |
| `target` | `all`, `posts`, `replies`.                                                                  |
| `when`   | A condition. Combine with `all`, `any`, and `not`.                                          |

Condition operators: `is`, `in`, `matches`, `contains_any`, `host_in` (link host or its subdomains), `gt`, `lt`. On list fields, `gt` and `lt` compare the list length.

`matches` takes a case-insensitive regular expression of at most 200 characters. It runs on RE2, which takes linear time, so a pattern cannot freeze the page. RE2 has no lookahead and no backreferences. A rule that uses them does nothing.

Fields: `text`, `links`, `mentions`, `language`, `hasAiLabel`, `isPaidPartnership`, `isReply`, `selfReplyLinks` (links in the author's own replies in the same thread), `copies` (accounts that posted the same text), `author.username`, `author.fullName`, `author.bio`, `author.isVerified`, `author.isPrivate`, `author.following`, `author.followedBy`, `author.country` (ISO code), `author.ageMonths`, `author.followers`, `author.posts`, `counts.likes`, `counts.replies`, `counts.reposts`, `counts.quotes`.

Built-in rules have fixed ids: `followed`, `allowed-accounts`, `hidden-accounts`, `blocked-words`, `blocked-sites`, `countries`, `new-accounts`, `few-followers`, `few-posts`, `affiliate-links`, `engagement-bait`, `copy-paste-replies`, `ai-label`, `generated-names`, `strangers-in-replies`. The settings page edits them. Rule files contain no code.
