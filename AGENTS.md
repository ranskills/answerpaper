# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, and other AGENTS.md-compatible tools) when working with code in this repository.

## What this is

See `README.md` for what the app does, how it works, and what its "no dependencies" claim actually means (it's vendored, not absent — see "Running it" there). In short: a single self-contained static web app, no backend/login/build step, meant to be hosted as-is on GitHub Pages.

Every script, including everything in `assets/js/screens/`, is a plain classic `<script>` (not `type="module"`) — ES module scripts are fetched in CORS mode, which browsers refuse for `file://` origins, and this app is meant to be opened directly from disk with no server. `assets/js/vendor/preact.min.js`/`assets/js/vendor/htm.js` attach `self.preact`/`self.htm` globals; `assets/js/screens/core.js` reads those directly (`const html = self.htm.bind(self.preact.h);`).

This guarantee — `index.html` opened directly (including via `file://`) requires zero install — must not be broken. Verify functional changes by opening `index.html` directly in a browser and clicking through the flow (or driving it with Playwright/`chromium-cli`, which is how this app was originally verified end-to-end: book → chapter → attempt → review/grade → retake → trends → print).

## Dev tooling

Dev-only tooling is a separate concern from the runtime: ESLint + Prettier, enforced via a pre-commit hook (Husky + lint-staged) and CI (`.github/workflows/lint.yml`). This repo uses **pnpm**, not npm/yarn; the Node version is pinned in `.node-version` (pnpm hard-fails with a clear version-mismatch error, not a broken install, if the active Node doesn't satisfy it — switch Node versions, e.g. via `nvm`, if you hit that). Install with `pnpm install`, then `pnpm run lint` / `pnpm run format`. **Before considering a JS or CSS change complete, run `pnpm run lint:fix` and `pnpm run format`** and resolve anything that surfaces. `eslint.config.mjs` turns off `no-undef` and scopes `no-unused-vars` to local (non-top-level) bindings only — necessary because files share an implicit global scope across `<script>` tags (see "File layout" in `docs/architecture.md`), so a top-level function used only by a later script looks "unused"/"undefined" from a single file's perspective.

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, ...), enforced by a `commit-msg` hook (Husky + commitlint, config in `commitlint.config.mjs`) — a non-conforming message is rejected at commit time, not just flagged.

## Architecture reference

Before making structural changes (new screens, data model edits, routing, state management) or touching design conventions/i18n, read `docs/architecture.md` — it covers file layout, the `Store` data model and its invariants, state management, routing, design conventions, and the i18n (`t()`/`tn()`) system in full detail.
