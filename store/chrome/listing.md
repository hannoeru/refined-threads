# Chrome Web Store listing

Copy each field into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). The links work after the GitHub repository is public.

## Package

Upload `refined-threads-<version>-chrome.zip` from the draft GitHub release.

## Store listing tab

**Short description.** The store takes it from the manifest (`extDescription` in `public/_locales/*/messages.json`). It is not a dashboard field.

**Category.** Social & Communication, or the closest social category the dashboard offers.

**Language.** English. Add Traditional Chinese (Taiwan) as a second listing with the text below.

**Store icon.** `public/icon/128.png`.

**Screenshots** (1280×800, in this order). The Chrome Web Store accepts at most 5 screenshots. Each language has its own set: `en/` for the English listing and `zh_TW/` for the Traditional Chinese listing. Upload screenshots 1 to 5 of each set to its own language in the dashboard.

1. `0-feed.png`. An example feed with hidden posts, a tag from a user rule, account details, real dates, and the keyboard selection. The accounts and posts are made up, and the image says so.
2. `1-features.png`. The list of features, each with its own switch.
3. `2-protection.png`. Spam filter levels and checks.
4. `3-lists.png`. Blocked words, sites, and accounts.
5. `4-welcome.png`. The page that opens after install.

Do not upload `5-popup.png` (the toolbar popup) to the Chrome Web Store. It is an extra screenshot.

**Small promo tile.** `en/promo-tile-440x280.png` and `zh_TW/promo-tile-440x280.png`, one per language.

**Homepage URL.** https://github.com/hannoeru/refined-threads

**Support URL.** https://github.com/hannoeru/refined-threads/issues

### Description (English)

```text
Refined Threads runs on threads.com and threads.net.

SPAM FILTER (on by default)
• Hides spam and bot posts, or only tags them so you can check.
• Three levels: Light, Balanced, and Strict.
• Checks for affiliate links, engagement bait ("comment +1", "link in bio"), copy-paste replies, AI labels, auto-made usernames, and strangers who drop links in replies.
• Your own lists of blocked words, blocked sites, hidden accounts, and accounts that are never hidden.
• Optional account checks: country, account age, follower count, and post count.
• Your own rules with points, plus ready-made presets. Export your settings as a file and share them.
• A hidden post folds into one line with the reason and a Show button. "Not spam" allows the author with one click.
• A ranking of the accounts the filter hid or tagged most, with a button to hide each one for good.

ACCOUNT INFO (on by default)
A small line under each author name: whether they follow you, the country flag, and how long the account has been on Threads. You can also show whether you follow them, the country name, and follower and post counts.

KEYBOARD NAVIGATION (on by default)
Press J and K to move between posts, and O to open the selected post.

REAL DATES (off by default)
Shows the date of each post instead of "5h" or "2d". Choose a format or write your own pattern.

PRIVACY
• No server, no account, no analytics, and no tracking.
• Your settings stay in your browser.
• The extension talks only to Threads, with your own Threads session. It looks up account details only for features you turn on, and only for posts on your screen.
• It never likes, follows, or blocks anything for you.

Refined Threads is open source (MIT). It is not affiliated with Meta.
```

### Description (Traditional Chinese)

```text
Refined Threads 適用於 threads.com 與 threads.net。

垃圾過濾（預設開啟）
• 隱藏垃圾與機器人貼文，或只加上標記讓你先確認。
• 三種等級：輕度、平衡、嚴格。
• 偵測聯盟行銷連結、互動誘餌（「留言 +1」、「連結在簡介」）、複製貼上的回覆、AI 標籤、自動產生的帳號名稱，以及在回覆中貼連結的陌生人。
• 自訂封鎖字詞、封鎖網站、隱藏帳號，以及永不隱藏的帳號。
• 可選的帳號檢查：國家、帳號年齡、粉絲數與貼文數。
• 用分數自訂規則，也可套用現成的預設組合。設定可以匯出成檔案並分享。
• 被隱藏的貼文會收合成一行，顯示原因與「顯示」按鈕。按「不是垃圾」即可一鍵放行該作者。
• 排行榜列出被隱藏或標記最多的帳號，可一鍵永久隱藏。

帳號資訊（預設開啟）
在每個作者名稱下方顯示一行小字：對方是否追蹤你、國旗，以及帳號加入 Threads 多久。也可以顯示你是否追蹤對方、國家名稱、粉絲數與貼文數。

鍵盤瀏覽（預設開啟）
按 J 和 K 在貼文之間移動，按 O 開啟選取的貼文。

實際日期（預設關閉）
把「5 小時」或「2 天」換成貼文的實際日期。可選擇格式，或自訂樣式。

隱私
• 沒有伺服器、不需帳號、沒有分析與追蹤。
• 設定只存在你的瀏覽器。
• 擴充功能只與 Threads 連線，並使用你自己的 Threads 登入狀態。只有在你開啟相關功能時，才會為畫面上的貼文查詢帳號資訊。
• 不會替你按讚、追蹤或封鎖任何人。

Refined Threads 是開放原始碼軟體（MIT）。與 Meta 無關。
```

## Privacy practices tab

**Single purpose.**

```text
Refined Threads improves the Threads website (threads.com and threads.net) with small features the user turns on or off: a spam filter, account details next to author names, real post dates, and keyboard navigation.
```

**Permission justification: storage.**

```text
Saves the user's settings and rules, the daily count of hidden posts shown in the popup, a local ranking of the accounts the spam filter hid or tagged most, and a local cache of account details so the same account is not looked up again.
```

**Permission justification: contextMenus.**

```text
Adds "Hide posts from this account" and "Never hide this account" to the right-click menu on links to Threads profiles.
```

**Permission justification: host permissions (threads.com, threads.net).**

```text
The extension runs only on Threads. It reads the posts Threads already sends to the page to filter spam and show account details, and it changes the page to hide or tag posts and show dates. For account checks the user turns on, it sends the same "About this profile" and profile requests that Threads makes, only to the Threads site that is open (threads.com or threads.net), with the user's own session. For the "About this profile" request, it reuses the session tokens that the page itself sends to Threads. It keeps them only in the page's memory, sends them only to that same Threads site, and never stores them. It has no access to other sites.
```

**Remote code.** No, I am not using remote code.

```text
All JavaScript is in the package. The extension does not load or run code from any server.
```

**Data usage.** Check **Website content**. Leave every other type unchecked.

```text
The extension reads posts and public account details on threads.com to run its features. This data stays in the browser. It is never sent to the developer or to any third party.
```

Then check all three certifications: no sale or transfer to third parties, no use for purposes unrelated to the single purpose, and no use for creditworthiness or lending.

**Privacy policy URL.** https://github.com/hannoeru/refined-threads/blob/main/PRIVACY.md

## Distribution tab

**Visibility.** Public. **Regions.** All regions.

## Update this listing

Use the `store-listing` skill in `.agents/skills/store-listing/`. Its check script finds stale images and text, and `capture.md` has the recipe for each image. The "14 hidden today" numbers in the popup are example counts.
