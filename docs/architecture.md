# Architecture reference

Detailed reference for AnswerPaper's file layout, data model, state management, routing, design conventions, and i18n system. See `AGENTS.md` for the high-level overview and dev tooling; read this file before making structural changes (new screens, data model edits, routing, state management) or touching design conventions/i18n.

## File layout

Plain files loaded via `<script>` tags in `index.html`, in dependency order — no bundler. JS lives in `assets/js/`, CSS in `assets/css/`:

- `logic.js` — pure functions, no DOM access: grading (`gradeResponse`), regrading (`setCorrectAnswer`), trend computation (`computeQuestionTrend`, `computeChapterTrend`, `computeChapterScoreTrend`, `weakestQuestions`), Home dashboard aggregates (`computeOverallStats`, `computeStudyStreak`, `computeContinueChapter`, `computeNeedsAttention`).
- `i18n.js` — string dictionary (`STRINGS.en`, `STRINGS.fr`) and the `t()`/`tn()` lookups (see "Internationalization" below). Loads before `app.js` and `assets/js/screens/`, which all call `t()`/`tn()`.
- `dialog.js` — `showConfirm()`/`showAlert()`, a Promise-based replacement for `confirm()`/`alert()` on one lazily-created `<dialog>` (see "Design conventions" below). Loads after `i18n.js` (needs `t()` for default labels), before `assets/js/screens/`.
- `app.js` — the `Store` object, `loadStore`/`saveStore` (localStorage), id generation, JSON export/import, the hash router. Exposes globals (`Store`, `addBook`, `navigate`, ...) that `assets/js/screens/` reads.
- `assets/js/screens/` — one classic script per screen, sharing top-level scope (no modules/imports — e.g. `wizard-new.js` calls a function defined in `core.js` because both ran in the same global scope). Load order in `index.html` only matters for parse-time side effects — see the comment atop `core.js`. Files:
  - `core.js` — loads first: `html`/`preactRender` bindings, format helpers (`formatDate`, `formatBytes`, ...), `mount()`, `focusById()`, the hash router (`render()`, exposed as `window.render`), shared `uiState`, `renderScoreLineChart()` (used by Chapter detail and Trends).
  - `home.js`, `books.js`, `data.js`, `chapters.js` — Home, Book list, Data management, Chapter list. One screen each.
  - `chapter-detail.js` — Chapter detail (Attempts + Questions tabs) and its print trigger.
  - `wizard.js` — wizard dispatcher (`renderAttemptWizard`), the `Wizard` state object, shared helpers, keyboard shortcuts (`handleWizardKeydown`).
  - `wizard-new.js` / `wizard-retake.js` — the two wizard flows (question authoring vs. answering existing questions). Split because the paths barely overlap.
  - `review.js`, `trends.js` — Review/Grade, Trends.
- `sample-data.js` — `loadSampleData()` fixture data, built entirely from `app.js`'s own mutation functions; loads after `app.js` and `assets/js/screens/`.
- `print.js` — `buildPrintView(chapterId)`, builds the print-only DOM via raw `innerHTML` (one-shot, not Preact) with its own `esc()` helper. Never touches `correctAnswer`/attempts — blank paper only.
- `assets/css/styles.css` — design tokens, app chrome, `@media print` rules.
- `assets/js/vendor/` — vendored Preact + htm UMD builds (see `assets/js/vendor/README.md`). `core.js` binds htm's parser to Preact's `h()`.

**htm entity gotcha:** htm never decodes HTML entities, even in static markup — `&amp;`/`&mdash;` render as the literal text, not the character. Use the literal Unicode character (`&`, `—`, `←`, `·`, `–`, `✓`, `✗`) directly in template strings.

## Data model (`Store`, persisted as one JSON blob in `localStorage`)

```
Store = {
  version: 1,
  books:     [{ id, title, archived, createdAt }],
  chapters:  [{ id, bookId, title, questionOrder: [questionId, ...], createdAt }],
  questions: [{ id, chapterId, type: "mcq" | "truefalse", config, correctAnswer }],
  attempts:  [{ id, chapterId, startedAt, finishedAt, responses: [{ questionId, chosen, flagged, correct }] }],
}
```

Key invariants:

- Questions/options carry no free-text content field — referenced only by number and by letter (auto-generated in `wizardUpdateOptionCount`, `assets/js/screens/wizard-new.js`) or True/False. The real content lives in whatever the user is practicing from (see README's "not a trivia/quiz-content app" callout) — don't add a text field.
- `correctAnswer` is user-declared on the Review screen, never computed — grading is pure set-equality against whatever the user says is correct.
- `chosen`/`correctAnswer` are always arrays, even for single-select/true-false — `gradeResponse` (`logic.js`) is just set-equality, no cardinality special-casing.
- `correctAnswer` is `null` until locked in on Review; `response.correct` is `null` (ungraded) until then.
- `response.flagged` — boolean set during the attempt ("not sure"), independent of grading. Drives Review's display (`review.flaggedSuffix`/`flaggedNoAnswer`) and `computeNeedsAttention`'s `flaggedWrongCount` (a flagged question that turned out wrong).
- `questionOrder` on the chapter, not an order field on the question, is the single source of truth for numbering — both the wizard and print view number by this array.
- Editing `correctAnswer` regrades **every** past attempt's response for that question (`setCorrectAnswer`, `logic.js`), not just future ones — don't special-case already-graded attempts.
- `Store` is the whole export/import envelope; `version` exists for future migrations — bump on breaking shape changes.
- `attempt.startedAt` is captured when the wizard first opens (`Wizard.startedAt`), not at commit — `finishedAt - startedAt` is the duration shown on Past Attempts. Wall-clock, so idle time counts; no pause tracking.

## State management

No client-side reactivity beyond Preact's diffing — no component state, props, or hooks. `app.js` holds one in-memory `Store`; every mutation (`addBook`, `deleteChapter`, `commitNewAttempt`, ...) calls `saveStore()`, then a full `render()` rebuilds the current screen's vdom from scratch. Preact diffs that against `#main` and patches only what changed — cheap rebuild, no flash, focus/scroll preserved.

Exception: the New Attempt/Retake wizard keeps live state in a module-level `Wizard` object (`assets/js/screens/wizard.js`), separate from `Store` until commit (`commitNewAttempt`/`commitRetakeAttempt`). It's also mirrored to `localStorage` (`answerpaper.wizardDraft.v1`) on every render via `saveWizardDraft`/`loadWizardDraft`/`clearWizardDraft`, so reloading or closing the tab mid-attempt resumes rather than discards — `renderAttemptWizard` reloads the draft, and `wizardDraftIsUsable` rejects a stale one if `questionOrder` changed underneath it (e.g. a question got deleted elsewhere). The draft clears on commit or explicit cancel (`cancelWizard`); it's still not part of the `Store` export/import envelope, and navigating away without cancelling just leaves it to resume later.

## Routing

Hash-based, parsed in `render()` in `assets/js/screens/core.js`, which dispatches to each screen's `render*` function:

- `#/` — Home/dashboard (recent activity)
- `#/books` — Book list
- `#/data` — Data management (see "Data & backups" in `README.md`)
- `#/books/:bookId/chapters` — Chapter list
- `#/books/:bookId/chapters/:chapterId` — Chapter detail
- `#/books/:bookId/chapters/:chapterId/attempt` — New Attempt/Retake wizard (mode inferred from whether `chapter.questionOrder` is empty, not a URL param)
- `#/books/:bookId/chapters/:chapterId/attempt/:attemptId/review` — Review/Grade
- `#/books/:bookId/chapters/:chapterId/trends` — Trends
- `#/books/:bookId/chapters/:chapterId/print` — Print trigger (builds `#print-root`, calls `window.print()`)

## Design conventions to preserve

- Colors always go through the CSS custom properties in `styles.css` (`--bg`, `--surface`, `--text`, `--accent`, `--series-1`, status colors, ...) — never hard-code a hex value in new UI.
- Theme defaults to "Auto" (`prefers-color-scheme`); the header's Theme button (`cycleTheme`/`setTheme`, `app.js`) cycles Auto → Light → Dark, persisted to `localStorage` (`answerpaper.theme`) as `data-theme` on `<html>`. A blocking inline script in `index.html`'s `<head>` applies it before first paint to avoid a flash; dark tokens are duplicated under `:root[data-theme="dark"]`, and the `prefers-color-scheme` query is scoped to `:root:not([data-theme])`.
- Status (correct/incorrect/ungraded) is never color-only — pair with text or a glyph (Trends ✓/✗ tables, Review screen).
- Deletions (book, chapter) always cascade and always confirm first, showing counts from `bookCascadeCounts`/`chapterCascadeCounts` (`app.js`).
- Keep accessibility basics intact: real `<button>`/`<a>`/`<label>` elements (not `<div onclick>`), visible `:focus-visible` outlines, the skip-to-content link.
- Confirmations/alerts always go through `showConfirm(message, opts)`/`showAlert(message, opts)` in `dialog.js` (Promise-based, caller must be `async`) — never native `confirm()`/`alert()`. Use a specific verb for `opts.confirmLabel`/`cancelLabel` ("Delete", not "OK"); `opts.danger: true` styles the confirm button red. See any `prompt*`/`confirmFinish*`/`cancelWizard` function for the pattern.

## Internationalization (i18n)

There is currently only one language: `getLang()` in `i18n.js` is hardcoded to return `"en"` (a comment there notes a language switcher can be added back — one existed before and was removed). Despite that, every user-facing string in `assets/js/screens/`, `print.js`, and `app.js` still goes through `t()`/`tn()` from `i18n.js` rather than a hardcoded literal, so the dictionary indirection is already in place if a second language comes back. New UI text follows the same rule: add a key to `STRINGS.en` and call `t()`/`tn()`, even for a one-off label.

- `t("namespace.key", vars)` — plain lookup with `{placeholder}` interpolation, e.g. `t("home.lastAttempt", { score, date })`.
- `tn("namespace.key", count, vars)` — for strings whose wording changes with count. The dictionary value is a `{ one, other }` pair selected via `Intl.PluralRules(getLang())`, not a `count === 1` check, so plural handling is already locale-correct rather than English-shaped if another language is added.
- Keys are namespaced by screen (`home.*`, `books.*`, `chapterDetail.*`, `wizard.*`, `review.*`, `trends.*`, `print.*`), plus `common.*` for anything reused across screens — check `common` before adding a duplicate.
- Missing-key lookups fall back to the raw key silently (`t`/`tn` return `key` if even `STRINGS.en` doesn't have it) — harmless today since `en` is the only language, but keep populating `STRINGS.en` rather than assuming a fallback will paper over a missing key.
- The header/nav and the skip-to-content link (`index.html`) are the one exception: they're plain hardcoded English text, not wired through `t()`/`tn()`, since there's no language switch to react to.
- `formatDate`/`formatDateShort` (`core.js`) still pass `getLang()` as the locale to `toLocaleDateString`/`toLocaleTimeString` rather than hardcoding `"en"`, so date formatting would follow a real language switch if one comes back.
