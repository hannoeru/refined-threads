# Privacy policy

Refined Threads runs only in your browser. It has no server, no account, no analytics, and no tracking. The developers receive no data from it.

## What it reads

- **Threads pages.** On `threads.com` and `threads.net`, it reads the posts and account details that Threads already sends to your browser. It uses them to run the features you turn on.
- **Account lookups.** Some features need details that the feed does not have: an account's country, join date, follower count, and post count. For these, the extension sends requests to `threads.com`, the same requests Threads makes when you open a profile or "About this profile". These requests:
  - run only when a feature or rule that needs them is on;
  - run only for posts near the screen, and never in a hidden tab;
  - go only to Threads, with your own Threads session.

## What it stores

| Data                                                                                           | Where                                                                                               | How long                                             |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Your settings and rules                                                                        | `storage.sync` in your browser. If browser sync is on, your browser syncs it to your other devices. | Until you change or remove them                      |
| Daily counts of hidden and tagged posts                                                        | `storage.local`                                                                                     | Replaced every day                                   |
| Accounts whose posts the spam filter hid or tagged, with their counts, up to 500 accounts      | `storage.local`                                                                                     | Until you clear the ranking                          |
| Looked-up account details (country, join date, follower and post counts), up to 5,000 accounts | `storage.local`                                                                                     | 30 days for country and join date, 7 days for counts |

Removing the extension deletes all of this data.

## What it sends to others

Nothing. The only network requests are the account lookups to `threads.com` described above. "Report a problem" opens the GitHub issues page in a new tab.

## Permissions

- `storage` saves your settings, the daily counts, the ranking, and the lookup cache.
- `contextMenus` adds "Hide posts from this account" and "Never hide this account" to links to Threads profiles.
- Access to `threads.com` and `threads.net` lets the extension run on Threads. It has no access to other sites.

## Contact

Open an issue at https://github.com/hannoeru/refined-threads/issues.
