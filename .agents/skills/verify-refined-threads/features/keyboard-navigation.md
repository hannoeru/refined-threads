# Keyboard navigation

Keyboard navigation lets the user move between posts with j and k and open the selected post with o.

## Sub-features

- `kbd-next` selects the next post with `j`.
- `kbd-previous` selects the previous post with `k`.
- `kbd-open` opens the selected post with `o`.
- `kbd-typing` ignores keys while a text field has focus.
- `kbd-off` removes the selection and stops reacting when the feature is turned off.

## How to get to it (user POV)

- Settings page: Features, then "Keyboard navigation". Its page lists the shortcuts.
- Popup: the "Keyboard navigation" switch.

## Driving it with agent_browser

Preconditions:

- Doctor passes.
- Written from an extension page: `chrome.storage.sync.set({ features: { 'keyboard-navigation': { enabled: true } } })`.

- **Next and previous.** Real key presses do not reach the page in this harness (see Gotchas), so dispatch keydown events. Eval: `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))`, twice, then `k`. After each one, read the index of `.rt-keyboard-current` among the posts. Expect `0, 1, 0`.
- **Open.** Dispatch `o`. `location.pathname` becomes the permalink `href` of the selected post.
- **Typing.** Focus a `textarea` that you add, and dispatch `j` on it. No `.rt-keyboard-current` appears.
- **Proof.** Save the index sequence and the URL as JSON, and take a screenshot showing the blue left-edge highlight.

## Gotchas

- agent-browser `press`, `keyboard type`, and `mouse` input did not reach threads.com in this harness. A page counter saw 0 keydowns. Dispatched events run the same handler. State in the report that trusted key presses were not verified.
- The handler listens on `window` in the capture phase, so the Threads login dialog does not swallow keys.
