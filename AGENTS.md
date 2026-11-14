# Refined Threads

A Manifest V3 browser extension for Threads web, built with WXT, Vue 3.6 Vapor, valibot, and Vitest. Each feature is a folder in `src/features/`. `CONTRIBUTING.md` explains the feature model, and `package.json` lists the scripts.

## Done means

- `pnpm check` passes. It runs lint, typecheck, tests, and both builds, and CI runs the same command.
- A **UI change** is verified on the real surface with the `verify-refined-threads` skill. A UI change is any change to the settings page, the popup, the welcome page, or what the extension draws on Threads (bars, chips, the account line, dates, the keyboard selection).
- After a **UI change**, the store listing is up to date too. Run `node .agents/skills/store-listing/bin/check.mjs`, and when it reports a problem, update `store/chrome/` with the `store-listing` skill in the same change.
- After a change to a **feature, a default, a permission, or a network request**, these documents still match the code: the feature's page in `docs/features/`, its line in the Features list of `README.md`, `PRIVACY.md`, and the descriptions in `store/chrome/listing.md`.

## Conventions

- Vue components use `<script setup vapor lang="ts">`. Use no virtual-DOM UI libraries.
- Every locale key exists in `public/_locales/en` and `public/_locales/zh_TW`, and every key is used. `src/__tests__/locales.test.ts` checks both.
- On Threads pages, style with Threads' `--barcelona-*` CSS variables (`THREADS_THEME` in `src/threads/dom.ts`), so light and dark mode both work.
- The extension acts on the user's account (like, follow, block) only after the user clicks.
- Use Conventional Commits. Pin GitHub Actions to full commit SHAs.

## Releases

`RELEASING.md` covers tags, the draft GitHub release, and the store workflow for Chrome, Firefox, and Edge.
