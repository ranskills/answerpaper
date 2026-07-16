# UX/UI Review Fix Progress

Source: `.scratchpad/ux-ui-review-2026-07-14.md`
Branch: `ux-review-fixes-2026-07-14`
Status: **All items implemented and verified with playwright-cli.**

## High-impact
- [x] H1 — Partially-graded attempts show misleading score. Fixed via `computeAttemptScore` in logic.js: unanswered-but-locked questions count as incorrect in the denominator; score labels now read e.g. "67% (1 unanswered)". Review screen distinguishes "Unanswered" from "Not yet graded".
- [x] H2 — Question structure frozen after first attempt. Added a "Questions (N)" manage card on chapter detail: add/delete/reorder questions, cascade-warns on delete.
- [x] H3 — In-progress attempts lost silently. `beforeunload` guard added while wizard has progress.
- [x] H4 — Enter doesn't submit forms. Add-book/add-chapter/rename/add-question now real `<form>` elements.
- [x] H5 — Empty submits fail silently. `required` on all the above inputs.
- [x] H6 — Review & grade ergonomics. Auto-saves on selection with "Saved ✓" flash; live "Graded X of Y · Z correct" header.

## Medium
- [x] M1 — Mobile chart clipped. SVG now `width:100%;height:auto` instead of fixed 560px min-width.
- [x] M2 — Mobile tables no scroll hint. CSS scroll-shadow gradient added to `.table-wrap`.
- [x] M3 — No active nav state. `aria-current="page"` + accent underline, driven by `updateNavActiveState()`.
- [x] M4 — Import undercooked. Styled as a real button with visible focus-within ring.
- [x] M5 — Rename via `prompt()`. Replaced with inline form matching Add pattern.
- [x] M6 — No exit from wizard. "Cancel attempt" button added at every wizard stage.
- [x] M7 — Document title never changes. Set per-screen in each render function.
- [x] M8 — Chart readability. First/last date labels on x-axis; value labels shown for all points when ≤6, else endpoints; points are focusable.
- [x] M9 — Sticky config invisible. "Same as previous question" hint shown when i>0.

## Low / polish
- [x] L1 — Real pluralization via `pluralize()` helper, applied everywhere (incl. the two "question(s) flagged" spots caught during verification).
- [x] L2 — Add-chapter/add-book/add-question forms all autofocus consistently.
- [x] L3 — First-run Home/Books onboarding blurb explaining the workflow.
- [x] L4 — Weakest-questions rows now link and jump to that question's card in the latest attempt's review (scroll + highlight).
- [x] L5 — Print header block (Name/Date/Score ___ of ___) added, still answer-free.
- [x] L6 — Redundant "View all books" button removed from Home (only shows "Get started" when no books exist).
- [x] L7 — Export shows a toast acknowledgement with the filename.

## Verification
Ran a full playwright-cli walkthrough against `localhost:8000`: empty states → add book (Enter-submit) → add chapter (empty-submit blocked by `required`) → inline rename → 3-question attempt with one flagged/unanswered question → review & grade (auto-save, Unanswered label, honest "67% (1 unanswered)" score) → question management (add/move/delete with cascade-warning confirm) → trends (weakest-questions jump link, per-question history now reflects unanswered-as-incorrect) → mobile viewport (375×812, chart + table scroll shadow) → print (emulated print media, header block) → dark mode. No console errors observed during the walkthrough.
