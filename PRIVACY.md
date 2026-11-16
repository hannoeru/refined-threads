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

## Settings files and links

You can export your settings, or only the parts you choose, as a file or as a link. A settings link holds those settings in the part of the address after `#`. Browsers do not send that part to the server, so opening the link does not send your settings to Threads. When the extension sees a settings link on `threads.com`, it removes the settings from the address bar and opens the import in its settings page. The extension does not send files or links anywhere. You decide where to share them, and anyone with a link can read the settings in it.

## Permissions

- `storage` saves your settings, the daily counts, the ranking, and the lookup cache.
- `contextMenus` adds "Hide posts from this account" and "Never hide this account" to links to Threads profiles.
- Access to `threads.com` and `threads.net` lets the extension run on Threads. It has no access to other sites.

## Contact

Open an issue at https://github.com/hannoeru/refined-threads/issues.
