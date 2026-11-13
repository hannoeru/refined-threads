# Contributing a feature

Refined Threads is a collection of small features. Each feature changes one thing on Threads web, and each user can turn it on or off. A new feature is one folder. You do not need to change any other code.

## 1. Pick an idea

A good feature:

- Changes one thing that people can see or use.
- Works on its own. Another feature can be on or off without breaking it.
- Removes every change it made when the user turns it off.
- Sends no requests to anyone except Threads itself. If it reads account data, it uses the shared `ctx.lookups`, which throttles and caches requests. Say so in the description.

Open an issue first if the feature is large or changes how Threads behaves for other people (for example, likes or follows). Features must never act on the user's account without a click from the user.

## 2. Create the folder

```text
src/features/<feature-id>/
  index.ts        required: the feature
  Settings.vue    optional: a custom settings page
  __tests__/      recommended: tests for the feature
```

The folder name is the feature id. Use lower-case words joined by `-`, for example `hide-like-counts`.

## 3. Write `index.ts`

```ts
import { authorLinkOf, POST_CONTAINER, postCodeOf } from '../../threads/dom'
import { defineFeature } from '../api'

export default defineFeature({
  id: 'highlight-followed',
  enabledByDefault: false,
  options: {
    color: {
      type: 'select',
      default: 'lime',
      choices: ['lime', 'purple']
    },
  },
  init(ctx) {
    const color = ctx.options.color === 'lime'
      ? '#a6e22e'
      : '#b48cf0'
    ctx.addStyle(`.rt-followed { text-decoration: underline 2px ${color}; }`)
    const mark = (container: HTMLElement) => {
      const code = postCodeOf(container)
      const post = code
        ? ctx.posts.get(code)
        : undefined
      if (post?.author.following)
        authorLinkOf(container, post.author.username)?.classList.add('rt-followed')
    }
    ctx.observe<HTMLElement>(POST_CONTAINER, mark)
    ctx.posts.subscribe(() => ctx.document.querySelectorAll<HTMLElement>(POST_CONTAINER).forEach(mark), ctx.signal)
    ctx.signal.addEventListener('abort', () => {
      for (const link of ctx.document.querySelectorAll('.rt-followed')) link.classList.remove('rt-followed')
    })
  },
})
```

`init(ctx)` runs when the feature turns on, and again when its options change. `ctx` gives you:

| Member                            | Use                                                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.signal`                      | An `AbortSignal`. It aborts when the user turns the feature off or changes its options. Pass it to every listener (`{ signal: ctx.signal }`) and undo your DOM changes in `ctx.signal.addEventListener('abort', …)`. |
| `ctx.options`                     | The option values, typed from your `options` spec and already validated.                                                                                                                                             |
| `ctx.observe(selector, callback)` | Calls `callback` once for each element that matches, now and when Threads adds more. It stops on abort.                                                                                                              |
| `ctx.addStyle(css)`               | Adds a style sheet. It is removed on abort.                                                                                                                                                                          |
| `ctx.posts`                       | Post data captured from Threads: `get(code)` and `subscribe(listener, signal)`. A `Post` has the author, text, links, counts, and more (see `src/model.ts`).                                                         |
| `ctx.lookups`                     | Account country, age, followers, and post count. `want(pk, username, needs)` queues a lookup. `data(pk)` reads the cache. `subscribe(listener, signal)` tells you when data arrives.                                 |
| `ctx.t(key, substitutions)`       | Translated text from `public/_locales`.                                                                                                                                                                              |
| `ctx.document`                    | The Threads page document.                                                                                                                                                                                           |

Helpers for the Threads page live in `src/threads/dom.ts`: `POST_CONTAINER`, `postCodeOf`, `permalinkOf`, and `authorLinkOf`. Threads uses generated class names, so never select by class. Use the selectors in this file, `href` patterns, `time[datetime]`, roles, or `aria-*` attributes. If you need a new selector, add it to `src/threads/dom.ts` so every feature shares the fix when Threads changes.

Optional fields:

- `include(url)` runs the feature only on some pages, for example `(url) => url.pathname.startsWith('/@')`. The feature starts and stops as the user moves between pages.
- `shortcuts` lists keyboard shortcuts, for example `{ j: 'next' }`. The settings page shows them.

## 4. Options and settings pages

Simple options need no UI code. The settings page builds a form from your `options` spec:

| Type   | Spec                                                    |
| ------ | ------------------------------------------------------- |
| Switch | `{ type: 'boolean', default: false }`                   |
| List   | `{ type: 'select', default: 'a', choices: ['a', 'b'] }` |
| Number | `{ type: 'number', default: 10, min: 1, max: 100 }`     |
| Text   | `{ type: 'text', default: '', maxLength: 200 }`         |

For a richer page, add `Settings.vue` next to `index.ts`. It must use `<script setup vapor lang="ts">`. The settings page shows it below the generated form. See `src/features/spam-filter/Settings.vue`.

## 5. Add the text

Add these keys to both `public/_locales/en/messages.json` and `public/_locales/zh_TW/messages.json`. In key names, the `-` in the feature id becomes `_`.

| Key                                  | Text                                              |
| ------------------------------------ | ------------------------------------------------- |
| `feature_<id>_name`                  | The name in the features list.                    |
| `feature_<id>_description`           | One or two plain sentences that say what changes. |
| `feature_<id>_option_<key>`          | The label of each option.                         |
| `feature_<id>_option_<key>_<choice>` | The label of each `select` choice.                |
| `feature_<id>_shortcut_<action>`     | The label of each shortcut.                       |

If you cannot write Traditional Chinese, copy the English text and say so in the pull request.

## 6. Test

Write tests that show what the user sees. `src/features/__tests__/features.test.ts` shows how to run a feature on a small fake Threads page with `postContainer()` from `src/testing/feature.ts`.

The registry test checks every feature. It fails when the id does not match the folder, when an option default is not valid, or when a text key is missing in one language.

```sh
pnpm lint:fix
pnpm check
```

`pnpm check` runs lint, the typecheck, the tests, and both builds, the same as CI.

Then load the extension (`pnpm dev`), turn the feature on in the settings page, and try it on threads.com. Turn it off and check that the page looks as before. In the pull request, add a screenshot and the Threads URLs you tested.
