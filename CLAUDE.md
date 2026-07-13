# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single self-contained static web app (no backend, no login, no build step, zero external dependencies) for practicing exam-style questions from a book's chapters, grading yourself, retaking chapters, and tracking trends. It's meant to be hosted as-is on GitHub Pages.

There is no build/lint/test command — this is intentional. Verify changes by opening `index.html` directly in a browser and clicking through the flow (or driving it with Playwright/`chromium-cli`, which is how this app was originally verified end-to-end: book → chapter → attempt → review/grade → retake → trends → print).

## File layout

Plain files loaded via `<script>` tags in `index.html`, in dependency order — no bundler:

- `app.js` — the `Store` object (in-memory state), `loadStore`/`saveStore` (localStorage persistence), id generation, export-to-JSON-file / import-from-JSON-file, and the hash-based router.
- `logic.js` — pure functions only, no DOM access: grading (`gradeResponse`), regrading (`setCorrectAnswer`), and trend computation (`computeQuestionTrend`, `computeChapterTrend`, `weakestQuestions`).
- `render.js` — every screen's render function (Home, Book list, Chapter list, Chapter detail, New Attempt wizard, Review/Grade, Trends), plus the hand-rolled inline-SVG score chart. Reads `Store`, writes into `#main`.
- `print.js` — `buildPrintView(chapterId)`, builds the print-only DOM from question structure into `#print-root`. Deliberately never touches `correctAnswer` or attempts — it's meant to produce a blank, answer-free paper copy.
- `styles.css` — design tokens (CSS custom properties) for light/dark mode, app chrome, and `@media print` rules.

## Data model (`Store`, persisted as one JSON blob in `localStorage`)

```
Store = {
  version: 1,
  books:     [{ id, title, createdAt }],
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

## State management

No framework, no virtual DOM. `app.js` holds a single in-memory `Store`. Every mutation (`addBook`, `deleteChapter`, `commitNewAttempt`, `applyCorrectAnswer`, ...) mutates `Store`, calls `saveStore()`, then a full `render()` re-derives the current screen from `location.hash` and re-renders `#main` from scratch. There is no diffing — at this data scale (hundreds of questions/attempts) a full re-render on every action is cheap and much simpler than tracking partial updates.

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
