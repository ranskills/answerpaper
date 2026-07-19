# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, and other AGENTS.md-compatible tools) when working with code in this repository.

## What this is

See `README.md` for what the app does and how it works. In short: a single self-contained static web app, no backend/login/build step, meant to be hosted as-is on GitHub Pages.

The one dependency is Preact + htm, vendored directly into `assets/js/vendor/` as classic UMD builds (no CDN, no npm, no build step — see `assets/js/vendor/README.md` for provenance). Every script, including everything in `assets/js/screens/`, is a plain classic `<script>` (not `type="module"`) — ES module scripts are fetched in CORS mode, which browsers refuse for `file://` origins, and this app is meant to be opened directly from disk with no server. `assets/js/vendor/preact.min.js`/`assets/js/vendor/htm.js` attach `self.preact`/`self.htm` globals; `assets/js/screens/core.js` reads those directly (`const html = self.htm.bind(self.preact.h);`).

There is no build/lint/test command — this is intentional. Verify changes by opening `index.html` directly in a browser and clicking through the flow (or driving it with Playwright/`chromium-cli`, which is how this app was originally verified end-to-end: book → chapter → attempt → review/grade → retake → trends → print).

## File layout

Plain files loaded via `<script>` tags in `index.html`, in dependency order — no bundler. JS lives in `assets/js/`, CSS in `assets/css/`:

- `logic.js` — pure functions only, no DOM access: grading (`gradeResponse`), regrading (`setCorrectAnswer`), trend computation (`computeQuestionTrend`, `computeChapterTrend`, `computeChapterScoreTrend`, `weakestQuestions`), and the Home dashboard aggregates (`computeOverallStats`, `computeStudyStreak`, `computeContinueChapter`, `computeNeedsAttention`). Classic script.
- `i18n.js` — the string dictionary (`STRINGS.en`, `STRINGS.fr`) and the `t()`/`tn()` lookup functions every UI string goes through (see "Internationalization" below). Loaded before `app.js` and `assets/js/screens/` since all of them call `t()`/`tn()`.
- `dialog.js` — `showConfirm()`/`showAlert()`, a Promise-based replacement for `window.confirm()`/`alert()` built on a single lazily-created native `<dialog>` element (see "Design conventions to preserve" below). Loaded after `i18n.js` (it calls `t()` for default button labels) and before `assets/js/screens/`.
- `app.js` — the `Store` object (in-memory state), `loadStore`/`saveStore` (localStorage persistence), id generation, export-to-JSON-file / import-from-JSON-file, and the hash-based router. Classic script; exposes globals (`Store`, `addBook`, `navigate`, ...) that `assets/js/screens/` reads.
- `assets/js/screens/` — one classic script per screen, all sharing top-level scope like every other file here (no modules, no imports — a function in `wizard-new.js` can call one defined in `core.js` purely because both ran in the same global scope before anything is invoked). Order in `index.html` only matters where something runs at parse time rather than inside a function body — see the comment at the top of `core.js`. Files:
  - `core.js` — must load first: binds `html`/`preactRender` from the vendored Preact/htm globals, the format helpers (`formatDate`, `formatBytes`, ...), `mount()` (Preact render + focus-preservation), `focusById()`, the hash router (`render()`, exposed as `window.render` at the bottom), the shared `uiState` object, and `renderScoreLineChart()` (the hand-rolled inline-SVG chart used by both Chapter detail and Trends).
  - `home.js`, `books.js`, `data.js`, `chapters.js` — Home, Book list, Data management, Chapter list. One screen each, no shared state beyond `uiState`/`Store`.
  - `chapter-detail.js` — Chapter detail (Attempts + Questions tabs) and the print trigger it links to.
  - `wizard.js` — the New Attempt/Retake wizard's shared dispatcher (`renderAttemptWizard`), the `Wizard` state object, answer-fieldset/flag/progress-bar helpers reused by both flows, and the keyboard shortcuts (`handleWizardKeydown`).
  - `wizard-new.js` / `wizard-retake.js` — the two wizard flows proper (first-time question authoring vs. answering existing questions). Largely parallel, non-overlapping code paths — this is why they're split rather than kept as one file.
  - `review.js`, `trends.js` — Review/Grade, Trends.
- `sample-data.js` — `loadSampleData()` ("Load sample data" button) and its `backdateAttempt()` helper. Pure fixture data built entirely out of `app.js`'s own mutation functions (`addBook`, `commitNewAttempt`, ...) plus a call to `navigate()`/`render()` at the end, so it loads after both `app.js` and `assets/js/screens/`.
- `print.js` — `buildPrintView(chapterId)`, builds the print-only DOM from question structure into `#print-root` via plain string `innerHTML` (not Preact — it's a one-shot static build, not interactively re-rendered, so it wasn't worth converting). Has its own tiny `esc()` helper, since it's the only script here doing raw `innerHTML` string-building rather than going through Preact's auto-escaping vdom. Deliberately never touches `correctAnswer` or attempts — it's meant to produce a blank, answer-free paper copy.
- `assets/css/styles.css` — design tokens (CSS custom properties) for light/dark mode, app chrome, and `@media print` rules.
- `assets/js/vendor/` — vendored Preact + htm classic UMD builds (see `assets/js/vendor/README.md`). `core.js` binds htm's tagged-template parser to Preact's `h()` itself (`self.htm.bind(self.preact.h)`).

**htm entity gotcha:** htm's parser does not decode HTML entities anywhere, including static markup — `&amp;`/`&mdash;`/etc. render as the literal text `&amp;` rather than being decoded. Always use the literal Unicode character (`&`, `—`, `←`, `·`, `–`, `✓`, `✗`) directly in template strings instead.

## Data model (`Store`, persisted as one JSON blob in `localStorage`)

```
Store = {
  version: 1,
  books:     [{ id, title, archived, createdAt }],
  chapters:  [{ id, bookId, title, questionOrder: [questionId, ...], createdAt }],
  questions: [{ id, chapterId, type: "mcq" | "truefalse", config, correctAnswer }],
  attempts:  [{ id, chapterId, startedAt, finishedAt, responses: [{ questionId, chosen, correct }] }],
}
```

Key invariants:
- `chosen` and `correctAnswer` are always arrays, even for single-select/true-false — grading is just set-equality (`gradeResponse` in `logic.js`), so there's no cardinality special-casing.
- `correctAnswer` is `null` until the user locks it in on the Review screen; `response.correct` is `null` (ungraded) until then.
- `questionOrder` on the chapter (not an order field on the question) is the single source of truth for question numbering — both the wizard and the print view number questions by this array, not by insertion order.
- Editing a question's `correctAnswer` must regrade **every** past attempt's response for that question, not just future ones — this is what `setCorrectAnswer` in `logic.js` does. Don't special-case "already graded" attempts when editing.
- The whole `Store` object is the export/import envelope. The `version` field exists for future migrations — bump it if the shape changes in a breaking way.
- `attempt.startedAt` is captured when the wizard is first opened for that attempt (`Wizard.startedAt` in `assets/js/screens/wizard.js`), not at commit time — `finishedAt - startedAt` is how attempt duration (shown on the chapter detail Past Attempts table) is derived. Wall-clock, so it includes any time the wizard sat open/unattended; there's no pause/resume tracking.

## State management

No client-side reactivity beyond Preact's DOM diffing — there's no component state, no props, no hooks. `app.js` holds a single in-memory `Store`. Every mutation (`addBook`, `deleteChapter`, `commitNewAttempt`, `applyCorrectAnswer`, ...) mutates `Store`, calls `saveStore()`, then a full `render()` re-derives the current screen from `location.hash` and rebuilds that screen's entire vdom tree from scratch. Preact then diffs that tree against what's already in `#main` and patches only what changed — so a full top-down rebuild-in-JS is cheap, but the actual DOM keeps focus/scroll position and doesn't flash, unlike the plain-string/`innerHTML` approach this replaced.

The one exception is the New Attempt / Retake wizard: it holds transient in-memory state in a module-level `Wizard` object in `assets/js/screens/wizard.js` (question-by-question progress, draft answers) that is *not* persisted to `Store`/`localStorage` until the user finishes the attempt. Abandoning a wizard mid-flow currently discards it.

## Routing

Hash-based, parsed in `render()` in `assets/js/screens/core.js`, which dispatches to each screen's `render*` function:
- `#/` — Home/dashboard (recent activity)
- `#/books` — Book list
- `#/data` — Data management (see "Data & backups" in `README.md` for what it shows)
- `#/books/:bookId/chapters` — Chapter list
- `#/books/:bookId/chapters/:chapterId` — Chapter detail
- `#/books/:bookId/chapters/:chapterId/attempt` — New Attempt/Retake wizard (mode is inferred from whether `chapter.questionOrder` is empty, not from a URL param)
- `#/books/:bookId/chapters/:chapterId/attempt/:attemptId/review` — Review/Grade
- `#/books/:bookId/chapters/:chapterId/trends` — Trends
- `#/books/:bookId/chapters/:chapterId/print` — Print trigger (builds `#print-root` then calls `window.print()`)

## Design conventions to preserve

- All colors go through the CSS custom properties defined in `:root` / `prefers-color-scheme: dark` in `styles.css` (`--bg`, `--surface`, `--text`, `--accent`, `--series-1`, status colors, etc.) — never hard-code a hex value in new UI.
- Theme is "Auto" (follows `prefers-color-scheme`) by default; the header's "Theme" button (`cycleTheme`/`setTheme` in `app.js`) cycles Auto → Light → Dark and persists the choice to `localStorage` (`answerpaper.theme`) as a `data-theme` attribute on `<html>`. A blocking inline script in `index.html`'s `<head>` applies any stored override before first paint to avoid a flash of the wrong theme — the dark token block in `styles.css` is duplicated under `:root[data-theme="dark"]`, and the `prefers-color-scheme` media query is scoped to `:root:not([data-theme])` so it only applies in Auto mode.
- Status (correct/incorrect/ungraded) is never color-only — always pair the color with text or a glyph (see the Trends per-question ✓/✗ tables and Review screen).
- Deletions (book, chapter) always cascade and always go through a confirmation dialog stating what will be removed, built from `bookCascadeCounts`/`chapterCascadeCounts` in `app.js`.
- Keep accessibility basics intact when touching markup: real `<button>`/`<a>`/`<label>` elements (not `<div onclick>`), visible `:focus-visible` outlines, the skip-to-content link in `index.html`.
- Confirmations and alerts go through `showConfirm(message, opts)` / `showAlert(message, opts)` in `dialog.js` (returns a Promise, so the caller must be `async`), never the native `window.confirm()`/`alert()`. `opts.confirmLabel`/`opts.cancelLabel` override the default OK/Cancel button text (use a specific verb like "Delete" or "Discard attempt" rather than a generic OK), and `opts.danger: true` styles the confirm button red for destructive actions. See any of the `prompt*`/`confirmFinish*`/`cancelWizard` functions in `assets/js/screens/` for the pattern.

## Internationalization (i18n)

Every user-facing string in `assets/js/screens/`, `print.js`, and `app.js` — labels, buttons, headings, table headers, `aria-label`s, dialog messages, error text, `document.title` — goes through `t()` or `tn()` from `i18n.js`, never a hardcoded literal. **Any new UI text you add must follow this too**, even a one-off label — add a key to `STRINGS.en` in `i18n.js` and call `t()`/`tn()` for it rather than writing the string inline.

- `t("namespace.key", vars)` — plain string lookup with `{placeholder}` interpolation, e.g. `t("home.lastAttempt", { score, date })` against `lastAttempt: "Last attempt: {score} · {date}"`.
- `tn("namespace.key", count, vars)` — for strings whose noun/wording changes with count. The dictionary value is a `{ one, other }` pair selected via `Intl.PluralRules(getLang())`, not a `count === 1` check, so it generalizes to languages with different pluralization rules than English. Reuse existing `common.*` count+noun keys (`common.book`, `common.chapter`, `common.attempt`, `common.question`, ...) instead of adding new ones when the noun already exists.
- Keys are namespaced roughly by screen (`home.*`, `books.*`, `chapterDetail.*`, `wizard.*`, `review.*`, `trends.*`, `print.*`) with a `common.*` namespace for anything reused across screens (True/False, Cancel/Save/Delete, "Not found.", score/trend formatting, etc.) — check `common` first before adding a duplicate.
- Missing-key and missing-language lookups fall back to English silently (`t`/`tn` in `i18n.js` fall back to `STRINGS.en` and return the raw key only if even that's missing) — so it's safe to add an English-only key without breaking the French build. **Only `home` and parts of `common` currently have French translations**; every other namespace is English-only pending a proper French pass. Don't hand-write French translations for new keys yourself — leave them English-only unless the user explicitly asks for translated copy.
- The language toggle (`#lang-toggle` in `index.html`, wired via `cycleLang`/`setLang` in `i18n.js`) persists to `localStorage` (`answerpaper.lang`) and re-renders, mirroring the existing theme-toggle pattern (`cycleTheme` in `app.js`).
- Header/nav/skip-link live outside Preact's `#main`, so per-screen `render()` calls don't touch them — `updateStaticChrome()` in `i18n.js` updates that static chrome on load and on language switch. If you add new static (non-`#main`) chrome with visible text, wire it into `updateStaticChrome()` too.
- `formatDate`/`formatDateShort` in `assets/js/screens/core.js` pass `getLang()` as the locale to `toLocaleDateString`/`toLocaleTimeString`, so date formatting follows the app's language toggle, not just the OS locale.
