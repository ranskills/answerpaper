# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, and other AGENTS.md-compatible tools) when working with code in this repository.

## What this is

A single self-contained static web app (no backend, no login, no build step) for practicing exam-style questions from a book's chapters, grading yourself, retaking chapters, and tracking trends. It's meant to be hosted as-is on GitHub Pages.

The one dependency is Preact + htm, vendored directly into `vendor/` as classic UMD builds (no CDN, no npm, no build step — see `vendor/README.md` for provenance). Every script, including `render.js`, is a plain classic `<script>` (not `type="module"`) — ES module scripts are fetched in CORS mode, which browsers refuse for `file://` origins, and this app is meant to be opened directly from disk with no server. `vendor/preact.min.js`/`vendor/htm.js` attach `self.preact`/`self.htm` globals; `render.js` reads those directly (`const html = self.htm.bind(self.preact.h);`).

There is no build/lint/test command — this is intentional. Verify changes by opening `index.html` directly in a browser and clicking through the flow (or driving it with Playwright/`chromium-cli`, which is how this app was originally verified end-to-end: book → chapter → attempt → review/grade → retake → trends → print).

## File layout

Plain files loaded via `<script>` tags in `index.html`, in dependency order — no bundler:

- `app.js` — the `Store` object (in-memory state), `loadStore`/`saveStore` (localStorage persistence), id generation, export-to-JSON-file / import-from-JSON-file, and the hash-based router. Classic script; exposes globals (`Store`, `addBook`, `navigate`, ...) that `render.js` reads.
- `logic.js` — pure functions only, no DOM access: grading (`gradeResponse`), regrading (`setCorrectAnswer`), and trend computation (`computeQuestionTrend`, `computeChapterTrend`, `weakestQuestions`). Classic script.
- `render.js` — every screen's render function (Home, Book list, Chapter list, Chapter detail, New Attempt wizard, Review/Grade, Trends), plus the hand-rolled inline-SVG score chart. Reads `Store`, builds a vdom tree with `html` (bound from the vendored `self.htm`/`self.preact` globals) per screen, and hands it to `mount()`, which calls Preact's `render()` into `#main`. Classic script like the others, so `window.render` at the bottom, `Wizard`, `uiState`, and the format helpers are all shared top-level scope with `app.js`.
- `print.js` — `buildPrintView(chapterId)`, builds the print-only DOM from question structure into `#print-root` via plain string `innerHTML` (not Preact — it's a one-shot static build, not interactively re-rendered, so it wasn't worth converting). Has its own tiny `esc()` copy since `render.js`'s helpers aren't guaranteed to load first. Deliberately never touches `correctAnswer` or attempts — it's meant to produce a blank, answer-free paper copy.
- `styles.css` — design tokens (CSS custom properties) for light/dark mode, app chrome, and `@media print` rules.
- `vendor/` — vendored Preact + htm classic UMD builds (see `vendor/README.md`). `render.js` binds htm's tagged-template parser to Preact's `h()` itself (`self.htm.bind(self.preact.h)`).

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
- `attempt.startedAt` is captured when the wizard is first opened for that attempt (`Wizard.startedAt` in `render.js`), not at commit time — `finishedAt - startedAt` is how attempt duration (shown on the chapter detail Past Attempts table) is derived. Wall-clock, so it includes any time the wizard sat open/unattended; there's no pause/resume tracking.

## State management

No client-side reactivity beyond Preact's DOM diffing — there's no component state, no props, no hooks. `app.js` holds a single in-memory `Store`. Every mutation (`addBook`, `deleteChapter`, `commitNewAttempt`, `applyCorrectAnswer`, ...) mutates `Store`, calls `saveStore()`, then a full `render()` re-derives the current screen from `location.hash` and rebuilds that screen's entire vdom tree from scratch. Preact then diffs that tree against what's already in `#main` and patches only what changed — so a full top-down rebuild-in-JS is cheap, but the actual DOM keeps focus/scroll position and doesn't flash, unlike the plain-string/`innerHTML` approach this replaced.

The one exception is the New Attempt / Retake wizard: it holds transient in-memory state in a module-level `Wizard` object in `render.js` (question-by-question progress, draft answers) that is *not* persisted to `Store`/`localStorage` until the user finishes the attempt. Abandoning a wizard mid-flow currently discards it.

## Routing

Hash-based, parsed in `render()` in `render.js`:
- `#/` — Home/dashboard (recent activity)
- `#/books` — Book list
- `#/books/:bookId/chapters` — Chapter list
- `#/books/:bookId/chapters/:chapterId` — Chapter detail
- `#/books/:bookId/chapters/:chapterId/attempt` — New Attempt/Retake wizard (mode is inferred from whether `chapter.questionOrder` is empty, not from a URL param)
- `#/books/:bookId/chapters/:chapterId/attempt/:attemptId/review` — Review/Grade
- `#/books/:bookId/chapters/:chapterId/trends` — Trends
- `#/books/:bookId/chapters/:chapterId/print` — Print trigger (builds `#print-root` then calls `window.print()`)

## Design conventions to preserve

- All colors go through the CSS custom properties defined in `:root` / `prefers-color-scheme: dark` in `styles.css` (`--bg`, `--surface`, `--text`, `--accent`, `--series-1`, status colors, etc.) — never hard-code a hex value in new UI.
- Status (correct/incorrect/ungraded) is never color-only — always pair the color with text or a glyph (see the Trends per-question ✓/✗ tables and Review screen).
- Deletions (book, chapter) always cascade and always go through a `confirm()` dialog stating what will be removed, built from `bookCascadeCounts`/`chapterCascadeCounts` in `app.js`.
- Keep accessibility basics intact when touching markup: real `<button>`/`<a>`/`<label>` elements (not `<div onclick>`), visible `:focus-visible` outlines, the skip-to-content link in `index.html`.
