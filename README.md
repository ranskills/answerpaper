# AnswerPaper

**Live app: https://ranskills.github.io/answerpaper/**

A self-contained exam-practice app for working through a book's chapters, grading your own answers, retaking chapters over time, and tracking trends in what you get right and wrong.

No backend, no login, no build step, no dependencies — it's a handful of static files you can open directly in a browser or host on GitHub Pages.

## Running it

Just open `index.html` in a browser. There is nothing to install and nothing to build.

To host it on GitHub Pages: push this repo to GitHub and enable Pages for the default branch (root folder). No configuration is needed since it's already a static site.

## How it works

- **Books → Chapters → Questions.** Create a book, add chapters to it. Each chapter is its own question bank.
- **First attempt defines the questions as you go.** There's no pre-built question schema. When you start a chapter for the first time, you're asked how many questions it has, then for each one you pick a type (Multiple Choice — single or multi-select — or True/False), configure its options, and immediately record your answer. Structure and your first attempt are captured together in one pass. If you don't know the count yet, choose "Add questions one at a time instead" — you'll get "Add another question" / "Finish attempt" buttons and can stop whenever you've covered them all. If you add one too many by mistake, "Remove this question & finish" on that extra question discards it and finishes with what you already have.
- **Review & grade afterward.** Once you've finished a pass, go to the Review screen and lock in what the correct answer is for each question — that's when grading actually happens. You can come back and edit a correct answer later; every past attempt for that question is automatically re-graded against the new answer.
- **Retake anytime.** Once a chapter's structure exists, hit "Retake" to answer the same questions again. It's graded immediately against the correct answers already on file.
- **Trends.** Every attempt is kept in full (not just a rolling score), so the chapter detail and Trends views show your score over time, your weakest questions, and the per-question history of getting something right/wrong across attempts.
- **Print a blank paper copy.** Each chapter has a "Print blank paper" view — an answer-free, print-friendly layout (`Cmd/Ctrl+P` → Save as PDF) if you'd rather do it the hard way with a pen.
- **Delete with confirmation.** Books and chapters can be deleted; both cascade (chapter deletion removes its questions/attempts, book deletion removes all its chapters too), and both ask for confirmation first.

## Data & backups

All data lives in the browser's `localStorage` — there is no server and no account. The **Data** page (in the header nav) is where you manage it: counts of everything you've created, how much storage it's using, and **Export**/**Import** buttons for downloading a full JSON snapshot of your books/chapters/questions/attempts or loading one back in (import replaces whatever is currently stored, after a confirmation prompt). This is the only way to move your data between browsers or machines.

The same page has a **Clear all data** action in its "Danger zone", which wipes everything in one step (all books, chapters, questions, and attempts) after a confirmation showing exactly what will be removed. Useful on a shared machine, or to start over without deleting books one at a time.

## Design

Supports light/dark mode automatically (follows your OS setting), is responsive from mobile to desktop, and follows basic accessibility practices (keyboard-operable, semantic HTML, status never conveyed by color alone).
