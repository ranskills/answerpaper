/* Screen rendering. Reads Store, writes into #main. Full re-render on every change. */

function esc(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatAnswerValue(value) {
  if (value === "true") return "True";
  if (value === "false") return "False";
  return value;
}

function formatChosenSummary(chosen) {
  return chosen.length ? chosen.map(formatAnswerValue).join(", ") : "";
}

function pluralize(count, noun) {
  return count + " " + noun + (count === 1 ? "" : "s");
}

function formatScoreLabel(score) {
  if (score.lockedCount === 0) return "Ungraded";
  const parts = [score.scorePercent + "%"];
  const notes = [];
  if (score.unansweredCount > 0) notes.push(score.unansweredCount + " unanswered");
  if (score.trulyUngradedCount > 0) notes.push(pluralize(score.trulyUngradedCount, "question") + " not yet graded");
  if (notes.length) parts.push("(" + notes.join(", ") + ")");
  return parts.join(" ");
}

function mount(html) {
  const main = document.getElementById("main");
  const active = document.activeElement;
  const hadFocusInMain = !!(active && main.contains(active));
  const focusId = hadFocusInMain && active.id ? active.id : null;

  main.innerHTML = html;

  // Exact match wins first: e.g. changing a wizard step's own config controls
  // (question type, option count) re-renders the same step, and the control
  // the user is mid-interaction with keeps the same id, so it should keep focus
  // rather than being overridden by that step's autofocus marker below.
  if (focusId) {
    const restored = document.getElementById(focusId);
    if (restored) {
      restored.focus();
      return;
    }
  }
  // Otherwise, if the new screen declares its own focus target (a fresh
  // form's first field, a wizard step's progress marker, ...), focus it
  // explicitly — the native autofocus attribute is only honored by browsers
  // for markup present at initial parse time, not for innerHTML insertion,
  // so it's used here purely as a declarative marker for us to act on.
  const marked = main.querySelector("[autofocus]");
  if (marked) {
    marked.focus();
    return;
  }

  if (hadFocusInMain) {
    // Either the focused element had no stable id, or its id (or the element
    // itself) no longer exists after this mutation (deleted, moved out of
    // range, replaced by a different step/screen) — move focus to the new
    // screen's heading rather than silently dropping it to <body>.
    const heading = main.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }
}

// For actions with an obvious place to return focus to (closing an inline
// form back to the button that opened it, saving a rename back onto that
// row's Rename button) — call after the re-render so it overrides mount()'s
// generic heading fallback, which has no way to know about that specific spot.
function focusById(id) {
  const el = document.getElementById(id);
  if (el) el.focus();
}

function updateNavActiveState() {
  const parts = currentRoute();
  const homeLink = document.querySelector('nav a[href="#/"]');
  const booksLink = document.querySelector('nav a[href="#/books"]');
  const isHome = parts.length === 0;
  const isBooks = parts[0] === "books";
  if (homeLink) {
    if (isHome) homeLink.setAttribute("aria-current", "page");
    else homeLink.removeAttribute("aria-current");
  }
  if (booksLink) {
    if (isBooks) booksLink.setAttribute("aria-current", "page");
    else booksLink.removeAttribute("aria-current");
  }
}

function render() {
  updateNavActiveState();
  const parts = currentRoute();
  if (parts.length === 0) return renderHome();
  if (parts[0] === "books" && parts.length === 1) return renderBookList();
  if (parts[0] === "books" && parts[1] && parts[2] === "chapters" && parts.length === 3) {
    return renderChapterList(parts[1]);
  }
  if (parts[0] === "books" && parts[2] === "chapters" && parts[3] && parts.length === 4) {
    return renderChapterDetail(parts[1], parts[3]);
  }
  if (parts[4] === "attempt" && parts.length === 5) {
    return renderAttemptWizard(parts[1], parts[3]);
  }
  if (parts[4] === "attempt" && parts[5] && parts[6] === "review") {
    return renderReview(parts[1], parts[3], parts[5]);
  }
  if (parts[4] === "trends") {
    return renderTrends(parts[1], parts[3]);
  }
  if (parts[4] === "print") {
    return renderPrintTrigger(parts[1], parts[3]);
  }
  mount('<p>Page not found. <a href="#/">Go home</a>.</p>');
}

/* ---------- Home ---------- */

function renderHome() {
  document.title = "AnswerPaper";
  const attempts = Store.attempts
    .slice()
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 8);

  const rows = attempts.map((attempt) => {
    const chapter = Store.chapters.find((c) => c.id === attempt.chapterId);
    if (!chapter) return "";
    const book = Store.books.find((b) => b.id === chapter.bookId);
    const score = formatScoreLabel(computeAttemptScore(Store, attempt));
    return (
      '<tr>' +
      '<td><a href="#/books/' + book.id + '/chapters/' + chapter.id + '">' + esc(book.title) + " &rsaquo; " + esc(chapter.title) + '</a></td>' +
      "<td>" + formatDate(attempt.finishedAt) + "</td>" +
      "<td>" + score + "</td>" +
      "</tr>"
    );
  }).join("");

  const onboarding = Store.books.length === 0
    ? '<p class="onboarding-hint">New here? The workflow is: create a <strong>book</strong> &rarr; add a <strong>chapter</strong> to it &rarr; take an <strong>attempt</strong> on the chapter &rarr; grade your answers &rarr; retake and track trends over time.</p>'
    : "";

  mount(
    '<h1>Home</h1>' +
    onboarding +
    '<div class="card">' +
    "<h2>Recent activity</h2>" +
    (attempts.length
      ? '<div class="table-wrap"><table><thead><tr><th scope="col">Chapter</th><th scope="col">Date</th><th scope="col">Score</th></tr></thead><tbody>' + rows + "</tbody></table></div>"
      : "<p>No attempts yet. <a href=\"#/books\">Start with your books</a>.</p>") +
    "</div>" +
    (Store.books.length === 0
      ? '<div class="btn-row"><a class="btn primary" href="#/books">Get started</a><button type="button" onclick="handleLoadSampleData()">Load sample data</button></div>'
      : "")
  );
}

/* ---------- Books ---------- */

let uiState = {
  addBookOpen: false, addChapterOpen: false, renameBookId: null, renameChapterId: null,
  addQuestionOpen: false, addQuestionDraft: null,
};

function renderBookList() {
  document.title = "Books — AnswerPaper";
  const cards = Store.books.map((book) => {
    const chapterCount = Store.chapters.filter((c) => c.bookId === book.id).length;
    if (uiState.renameBookId === book.id) {
      return (
        '<li class="card">' +
        '<form onsubmit="return handleRenameBook(event,\'' + book.id + '\')">' +
        '<label for="rename-book-title">Rename book</label>' +
        '<input id="rename-book-title" type="text" value="' + esc(book.title) + '" required autofocus />' +
        '<div class="btn-row">' +
        '<button type="submit" class="primary">Save</button>' +
        '<button type="button" onclick="toggleRenameBookForm(null)">Cancel</button>' +
        "</div></form></li>"
      );
    }
    return (
      '<li class="card">' +
      '<a class="card-link" href="#/books/' + book.id + '/chapters"><h2>' + esc(book.title) + "</h2></a>" +
      '<p class="card-meta">' + pluralize(chapterCount, "chapter") + "</p>" +
      '<div class="btn-row">' +
      '<button type="button" id="book-rename-' + book.id + '" onclick="toggleRenameBookForm(\'' + book.id + '\')">Rename</button>' +
      '<button type="button" id="book-delete-' + book.id + '" class="danger" onclick="promptDeleteBook(\'' + book.id + '\')">Delete</button>' +
      "</div>" +
      "</li>"
    );
  }).join("");

  const addForm = uiState.addBookOpen
    ? '<div class="card">' +
      '<form onsubmit="return handleAddBook(event)">' +
      '<label for="new-book-title">New book title</label>' +
      '<input id="new-book-title" type="text" placeholder="e.g. Organic Chemistry" required autofocus />' +
      '<div class="btn-row">' +
      '<button type="submit" class="primary">Add book</button>' +
      '<button type="button" onclick="toggleAddBookForm(false)">Cancel</button>' +
      "</div></form></div>"
    : '<div class="btn-row"><button type="button" id="add-book-toggle" class="primary" onclick="toggleAddBookForm(true)">+ Add book</button></div>';

  const wipeLink = Store.books.length
    ? '<p class="wipe-data-row"><button type="button" class="link-danger" onclick="promptResetAllData()">Clear all data</button></p>'
    : "";

  mount(
    "<h1>Books</h1>" +
    (Store.books.length
      ? ""
      : '<p class="onboarding-hint">Start here: add a book, then add chapters to it, then take an attempt on a chapter to start practicing.</p>' +
        '<div class="btn-row"><button type="button" onclick="handleLoadSampleData()">Load sample data</button></div>') +
    addForm +
    (cards ? '<ul class="card-list">' + cards + "</ul>" : '<div class="card"><p>No books yet.</p></div>') +
    wipeLink
  );
}

function handleLoadSampleData() {
  loadSampleData();
}

function promptResetAllData() {
  const counts = allDataCounts();
  const ok = confirm(
    "Delete ALL data — " + pluralize(counts.bookCount, "book") + ", " + pluralize(counts.chapterCount, "chapter") +
    ", " + pluralize(counts.attemptCount, "attempt") + " total? This cannot be undone. " +
    "Consider using Export first if you want a backup."
  );
  if (ok) {
    resetStore();
    renderBookList();
  }
}

function toggleAddBookForm(open) {
  uiState.addBookOpen = open;
  renderBookList();
  if (!open) focusById("add-book-toggle");
}

function handleAddBook(event) {
  event.preventDefault();
  const input = document.getElementById("new-book-title");
  const title = input.value.trim();
  if (!title) return false;
  addBook(title);
  uiState.addBookOpen = false;
  renderBookList();
  focusById("add-book-toggle");
  return false;
}

function toggleRenameBookForm(bookId) {
  const wasRenamingId = uiState.renameBookId;
  uiState.renameBookId = bookId;
  renderBookList();
  if (bookId === null && wasRenamingId) focusById("book-rename-" + wasRenamingId);
}

function handleRenameBook(event, bookId) {
  event.preventDefault();
  const input = document.getElementById("rename-book-title");
  const title = input.value.trim();
  if (!title) return false;
  renameBook(bookId, title);
  uiState.renameBookId = null;
  renderBookList();
  focusById("book-rename-" + bookId);
  return false;
}

function promptDeleteBook(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  const counts = bookCascadeCounts(bookId);
  const ok = confirm(
    "Delete book '" + book.title + "' and all " + pluralize(counts.chapterCount, "chapter") +
    " (" + pluralize(counts.attemptCount, "attempt") + " total)? This cannot be undone."
  );
  if (ok) {
    deleteBook(bookId);
    renderBookList();
  }
}

/* ---------- Chapters ---------- */

function renderChapterList(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  if (!book) return mount('<p>Book not found. <a href="#/books">Go back</a>.</p>');
  document.title = book.title + " — AnswerPaper";

  const chapters = Store.chapters.filter((c) => c.bookId === bookId);
  const cards = chapters.map((chapter) => {
    const attemptCount = Store.attempts.filter((a) => a.chapterId === chapter.id).length;
    if (uiState.renameChapterId === chapter.id) {
      return (
        '<li class="card">' +
        '<form onsubmit="return handleRenameChapter(event,\'' + bookId + '\',\'' + chapter.id + '\')">' +
        '<label for="rename-chapter-title">Rename chapter</label>' +
        '<input id="rename-chapter-title" type="text" value="' + esc(chapter.title) + '" required autofocus />' +
        '<div class="btn-row">' +
        '<button type="submit" class="primary">Save</button>' +
        '<button type="button" onclick="toggleRenameChapterForm(null, \'' + bookId + '\')">Cancel</button>' +
        "</div></form></li>"
      );
    }
    return (
      '<li class="card">' +
      '<a class="card-link" href="#/books/' + bookId + '/chapters/' + chapter.id + '"><h2>' + esc(chapter.title) + "</h2></a>" +
      '<p class="card-meta">' + pluralize(attemptCount, "attempt") + "</p>" +
      '<div class="btn-row">' +
      '<button type="button" id="chapter-rename-' + chapter.id + '" onclick="toggleRenameChapterForm(\'' + chapter.id + '\', \'' + bookId + '\')">Rename</button>' +
      '<button type="button" id="chapter-delete-' + chapter.id + '" class="danger" onclick="promptDeleteChapter(\'' + bookId + '\',\'' + chapter.id + '\')">Delete</button>' +
      "</div>" +
      "</li>"
    );
  }).join("");

  const addForm = uiState.addChapterOpen
    ? '<div class="card">' +
      '<form onsubmit="return handleAddChapter(event, \'' + bookId + '\')">' +
      '<label for="new-chapter-title">New chapter title</label>' +
      '<input id="new-chapter-title" type="text" placeholder="e.g. Chapter 4: Alkenes" required autofocus />' +
      '<div class="btn-row">' +
      '<button type="submit" class="primary">Add chapter</button>' +
      '<button type="button" onclick="toggleAddChapterForm(false, \'' + bookId + '\')">Cancel</button>' +
      "</div></form></div>"
    : '<div class="btn-row"><button type="button" id="add-chapter-toggle" class="primary" onclick="toggleAddChapterForm(true, \'' + bookId + '\')">+ Add chapter</button></div>';

  mount(
    '<p><a href="#/books">&larr; All books</a></p>' +
    "<h1>" + esc(book.title) + "</h1>" +
    addForm +
    (cards ? '<ul class="card-list">' + cards + "</ul>" : '<div class="card"><p>No chapters yet.</p></div>')
  );
}

function toggleAddChapterForm(open, bookId) {
  uiState.addChapterOpen = open;
  renderChapterList(bookId);
  if (!open) focusById("add-chapter-toggle");
}

function handleAddChapter(event, bookId) {
  event.preventDefault();
  const input = document.getElementById("new-chapter-title");
  const title = input.value.trim();
  if (!title) return false;
  addChapter(bookId, title);
  uiState.addChapterOpen = false;
  renderChapterList(bookId);
  focusById("add-chapter-toggle");
  return false;
}

function toggleRenameChapterForm(chapterId, bookId) {
  const wasRenamingId = uiState.renameChapterId;
  uiState.renameChapterId = chapterId;
  renderChapterList(bookId);
  if (chapterId === null && wasRenamingId) focusById("chapter-rename-" + wasRenamingId);
}

function handleRenameChapter(event, bookId, chapterId) {
  event.preventDefault();
  const input = document.getElementById("rename-chapter-title");
  const title = input.value.trim();
  if (!title) return false;
  renameChapter(chapterId, title);
  uiState.renameChapterId = null;
  renderChapterList(bookId);
  focusById("chapter-rename-" + chapterId);
  return false;
}

function promptDeleteChapter(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const counts = chapterCascadeCounts(chapterId);
  const ok = confirm(
    "Delete chapter '" + chapter.title + "' and its " + pluralize(counts.attemptCount, "attempt") +
    "? This cannot be undone."
  );
  if (ok) {
    deleteChapter(chapterId);
    renderChapterList(bookId);
  }
}

/* ---------- Chapter detail ---------- */

function renderChapterDetail(bookId, chapterId) {
  const book = Store.books.find((b) => b.id === bookId);
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!book || !chapter) return mount('<p>Not found. <a href="#/books">Go back</a>.</p>');
  document.title = chapter.title + " — AnswerPaper";

  const attempts = attemptsForChapter(Store, chapterId).slice().reverse();
  const isFirstTime = chapter.questionOrder.length === 0;

  const rows = attempts.map((attempt) => {
    const attemptScore = computeAttemptScore(Store, attempt);
    const score = formatScoreLabel(attemptScore);
    const needsReview = attemptScore.trulyUngradedCount > 0;
    return (
      "<tr>" +
      "<td>" + formatDate(attempt.finishedAt) + "</td>" +
      "<td>" + score + "</td>" +
      '<td><a href="#/books/' + bookId + '/chapters/' + chapterId + '/attempt/' + attempt.id + '/review">' +
      (needsReview ? "Review / grade" : "View / edit answers") + "</a></td>" +
      "</tr>"
    );
  }).join("");

  const chartSeries = computeChapterTrend(Store, chapterId);

  mount(
    '<p><a href="#/books/' + bookId + '/chapters">&larr; ' + esc(book.title) + "</a></p>" +
    "<h1>" + esc(chapter.title) + "</h1>" +
    '<div class="btn-row">' +
    '<a class="btn primary" href="#/books/' + bookId + '/chapters/' + chapterId + '/attempt">' +
    (isFirstTime ? "Start attempt" : "Retake") + "</a>" +
    (isFirstTime ? "" :
      '<a class="btn" href="#/books/' + bookId + '/chapters/' + chapterId + '/trends">View trends</a>' +
      '<a class="btn" href="#/books/' + bookId + '/chapters/' + chapterId + '/print">Print blank paper</a>') +
    "</div>" +
    (chartSeries.length ? '<div class="card"><h2>Score over time</h2>' + renderScoreLineChart(chartSeries) + "</div>" : "") +
    renderQuestionManageCard(bookId, chapterId, chapter) +
    '<div class="card"><h2>Past attempts</h2>' +
    (attempts.length
      ? '<div class="table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Score</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' + rows + "</tbody></table></div>"
      : "<p>No attempts yet.</p>") +
    "</div>"
  );
}

/* ---------- Manage chapter questions ---------- */

const DEFAULT_NEW_QUESTION_CONFIG = { optionLabels: ["A", "B", "C", "D"], multiSelect: false };

function describeQuestion(question) {
  if (question.type === "truefalse") return "True / False";
  return question.config.optionLabels.length + " options" + (question.config.multiSelect ? ", multi-select" : "");
}

function renderQuestionManageCard(bookId, chapterId, chapter) {
  const questions = chapter.questionOrder.map((qid) => Store.questions.find((q) => q.id === qid)).filter(Boolean);

  const rows = questions.map((q, idx) => {
    const locked = q.correctAnswer !== null && q.correctAnswer !== undefined;
    return (
      "<tr>" +
      "<td>Question " + (idx + 1) + "</td>" +
      "<td>" + esc(describeQuestion(q)) + "</td>" +
      "<td>" + (locked ? '<span class="status-correct">Answer set</span>' : '<span class="status-ungraded">No answer yet</span>') + "</td>" +
      "<td class=\"btn-row\">" +
      (idx > 0 ? '<button type="button" id="q-up-' + q.id + '" onclick="moveQuestion(\'' + bookId + '\',\'' + chapterId + '\',\'' + q.id + '\',-1)" aria-label="Move question ' + (idx + 1) + ' up">&uarr;</button>' : "") +
      (idx < questions.length - 1 ? '<button type="button" id="q-down-' + q.id + '" onclick="moveQuestion(\'' + bookId + '\',\'' + chapterId + '\',\'' + q.id + '\',1)" aria-label="Move question ' + (idx + 1) + ' down">&darr;</button>' : "") +
      '<button type="button" id="q-delete-' + q.id + '" class="danger" onclick="promptDeleteQuestion(\'' + bookId + '\',\'' + chapterId + '\',\'' + q.id + '\')">Delete</button>' +
      "</td></tr>"
    );
  }).join("");

  const addForm = uiState.addQuestionOpen ? renderAddQuestionForm(bookId, chapterId) :
    '<div class="btn-row"><button type="button" id="add-question-toggle" onclick="toggleAddQuestionForm(true, \'' + bookId + '\', \'' + chapterId + '\')">+ Add question</button></div>';

  return (
    '<div class="card">' +
    "<h2>" + pluralize(questions.length, "Question") + "</h2>" +
    (questions.length
      ? '<div class="table-wrap"><table><thead><tr><th scope="col">#</th><th scope="col">Type</th><th scope="col">Correct answer</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' + rows + "</tbody></table></div>"
      : "<p>No questions yet.</p>") +
    addForm +
    "</div>"
  );
}

function renderAddQuestionForm(bookId, chapterId) {
  const draft = uiState.addQuestionDraft || (uiState.addQuestionDraft = { type: "mcq", config: Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) });
  const configHtml = draft.type === "mcq"
    ? '<label for="new-q-opt-count">Number of options</label>' +
      '<input id="new-q-opt-count" type="number" min="2" max="8" value="' + draft.config.optionLabels.length + '" onchange="manageAddQuestionUpdateOptionCount(this.value)" />' +
      '<div class="choice-row"><input id="new-q-multi-select" type="checkbox" ' + (draft.config.multiSelect ? "checked" : "") +
      ' onchange="manageAddQuestionUpdateMultiSelect(this.checked)" /><label for="new-q-multi-select" style="margin:0">Allow selecting more than one option</label></div>'
    : "";

  return (
    '<form class="add-question-form" onsubmit="return handleAddQuestion(event, \'' + bookId + '\', \'' + chapterId + '\')">' +
    '<label for="new-q-type">Question type</label>' +
    '<select id="new-q-type" autofocus onchange="manageAddQuestionUpdateType(this.value)">' +
    '<option value="mcq" ' + (draft.type === "mcq" ? "selected" : "") + '>Multiple choice</option>' +
    '<option value="truefalse" ' + (draft.type === "truefalse" ? "selected" : "") + '>True / False</option>' +
    "</select>" +
    configHtml +
    '<p class="card-meta">The correct answer is set later, from the Review screen of an attempt that includes this question.</p>' +
    '<div class="btn-row">' +
    '<button type="submit" class="primary">Add question</button>' +
    '<button type="button" onclick="toggleAddQuestionForm(false, \'' + bookId + '\', \'' + chapterId + '\')">Cancel</button>' +
    "</div></form>"
  );
}

function toggleAddQuestionForm(open, bookId, chapterId) {
  uiState.addQuestionOpen = open;
  uiState.addQuestionDraft = open ? { type: "mcq", config: Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) } : null;
  renderChapterDetail(bookId, chapterId);
  if (!open) focusById("add-question-toggle");
}

function manageAddQuestionUpdateType(type) {
  uiState.addQuestionDraft.type = type;
  uiState.addQuestionDraft.config = type === "mcq" ? Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) : {};
}

function manageAddQuestionUpdateOptionCount(value) {
  const n = Math.max(2, Math.min(8, parseInt(value, 10) || 4));
  uiState.addQuestionDraft.config.optionLabels = "ABCDEFGH".split("").slice(0, n);
}

function manageAddQuestionUpdateMultiSelect(checked) {
  uiState.addQuestionDraft.config.multiSelect = checked;
}

function handleAddQuestion(event, bookId, chapterId) {
  event.preventDefault();
  const draft = uiState.addQuestionDraft;
  addQuestionToChapter(chapterId, draft.type, Object.assign({}, draft.config, draft.config.optionLabels ? { optionLabels: draft.config.optionLabels.slice() } : {}));
  uiState.addQuestionOpen = false;
  uiState.addQuestionDraft = null;
  renderChapterDetail(bookId, chapterId);
  focusById("add-question-toggle");
  return false;
}

function moveQuestion(bookId, chapterId, questionId, direction) {
  reorderQuestion(chapterId, questionId, direction);
  renderChapterDetail(bookId, chapterId);
}

function promptDeleteQuestion(bookId, chapterId, questionId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const idx = chapter.questionOrder.indexOf(questionId);
  const counts = questionCascadeCounts(chapterId, questionId);
  const ok = confirm(
    "Delete question " + (idx + 1) + "? This removes it from " + pluralize(counts.attemptCount, "past attempt") +
    " too, and cannot be undone."
  );
  if (ok) {
    deleteQuestion(chapterId, questionId);
    renderChapterDetail(bookId, chapterId);
  }
}

function renderScoreLineChart(series) {
  const width = 560, height = 200, padL = 36, padR = 16, padT = 28, padB = 28;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (pct) => padT + innerH - (innerH * (pct === null ? 0 : pct)) / 100;

  const gridLines = [0, 25, 50, 75, 100].map((pct) => {
    const gy = y(pct);
    return (
      '<line class="chart-grid" x1="' + padL + '" y1="' + gy + '" x2="' + (width - padR) + '" y2="' + gy + '"></line>' +
      '<text x="' + (padL - 8) + '" y="' + (gy + 3) + '" text-anchor="end">' + pct + "</text>"
    );
  }).join("");

  const points = series.map((s, i) => ({ x: x(i), y: y(s.scorePercent || 0), s }));
  const path = points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const showAllLabels = n <= 6;

  const circles = points.map((p, i) => {
    const label = p.s.scorePercent === null ? "Ungraded" : p.s.scorePercent + "%";
    const isEndpoint = i === 0 || i === n - 1;
    const valueLabel = p.s.scorePercent === null ? "" :
      (showAllLabels || isEndpoint
        ? '<text class="chart-label" x="' + p.x.toFixed(1) + '" y="' + (p.y - 10).toFixed(1) + '" text-anchor="middle">' + p.s.scorePercent + "%</text>"
        : "");
    return (
      '<circle class="chart-point" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" tabindex="0">' +
      "<title>" + formatDate(p.s.date) + ": " + label + "</title>" +
      "</circle>" + valueLabel
    );
  }).join("");

  const dateLabels = n > 1
    ? '<text class="chart-date-label" x="' + points[0].x.toFixed(1) + '" y="' + (height - 6) + '" text-anchor="start">' + formatDateShort(series[0].date) + "</text>" +
      '<text class="chart-date-label" x="' + points[n - 1].x.toFixed(1) + '" y="' + (height - 6) + '" text-anchor="end">' + formatDateShort(series[n - 1].date) + "</text>"
    : "";

  return (
    '<div class="chart-wrap"><svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Chapter score percentage over time">' +
    gridLines + '<path class="chart-line" d="' + path + '"></path>' + circles + dateLabels +
    "</svg></div>"
  );
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------- New Attempt / Retake wizard ---------- */

let Wizard = null;

function wizardHasProgress() {
  if (!Wizard) return false;
  if (Wizard.mode === "new") return Wizard.stage !== "count" && (Wizard.draftQuestions.length > 0 || Wizard.index > 0);
  return Wizard.index > 0 || Object.keys(Wizard.responses).length > 0 || Wizard.stage !== "questions";
}

function cancelWizard() {
  if (wizardHasProgress() && !confirm("Cancel this attempt? Your progress on it will be lost.")) return;
  const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
  Wizard = null;
  navigate("/books/" + bookId + "/chapters/" + chapterId);
  render();
}

const DEFAULT_MCQ_CONFIG = { optionLabels: ["A", "B", "C", "D"], multiSelect: false };

function renderAttemptWizard(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount("<p>Chapter not found.</p>");
  const isFirstTime = chapter.questionOrder.length === 0;
  document.title = (isFirstTime ? "New attempt: " : "Retake: ") + chapter.title + " — AnswerPaper";

  if (!Wizard || Wizard.chapterId !== chapterId || Wizard.mode !== (isFirstTime ? "new" : "retake")) {
    if (isFirstTime) {
      Wizard = {
        chapterId, bookId, mode: "new",
        stage: "count", total: null, index: 0,
        lastMcqConfig: Object.assign({}, DEFAULT_MCQ_CONFIG),
        draftQuestions: [], draftAnswers: [],
        currentType: "mcq", currentConfig: Object.assign({}, DEFAULT_MCQ_CONFIG),
        error: null, pendingFlagged: false, reviewIndex: null,
      };
    } else {
      Wizard = {
        chapterId, bookId, mode: "retake",
        stage: "questions", index: 0, responses: {}, error: null, reviewQuestionId: null,
      };
    }
  }

  if (Wizard.mode === "new") return renderNewWizard(bookId, chapterId, chapter);
  return renderRetakeWizard(bookId, chapterId, chapter);
}

function renderAnswerFieldset(type, config, chosenValues) {
  chosenValues = chosenValues || [];
  if (type === "mcq") {
    const inputType = config.multiSelect ? "checkbox" : "radio";
    return '<fieldset><legend>Your answer</legend>' + config.optionLabels.map((label) =>
      '<div class="choice-row"><input type="' + inputType + '" name="answer" id="opt-' + label + '" value="' + label + '" ' +
      (chosenValues.includes(label) ? "checked" : "") + ' />' +
      '<label for="opt-' + label + '" style="margin:0">' + label + "</label></div>"
    ).join("") + "</fieldset>";
  }
  return (
    '<fieldset><legend>Your answer</legend>' +
    '<div class="choice-row"><input type="radio" name="answer" id="opt-true" value="true" ' + (chosenValues.includes("true") ? "checked" : "") + ' /><label for="opt-true" style="margin:0">True</label></div>' +
    '<div class="choice-row"><input type="radio" name="answer" id="opt-false" value="false" ' + (chosenValues.includes("false") ? "checked" : "") + ' /><label for="opt-false" style="margin:0">False</label></div>' +
    "</fieldset>"
  );
}

function flagCheckboxHtml(checked, label) {
  return '<div class="choice-row"><input type="checkbox" id="flag-question" ' + (checked ? "checked" : "") + ' />' +
    '<label for="flag-question" style="margin:0">' + label + "</label></div>";
}

function renderNewWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "count") {
    return mount(
      "<h1>" + esc(chapter.title) + " &mdash; new attempt</h1>" +
      '<div class="card">' +
      '<label for="q-count">How many questions in this chapter?</label>' +
      '<input id="q-count" type="number" min="1" max="200" value="20" autofocus />' +
      '<div class="btn-row"><button type="button" class="primary" onclick="startNewWizardQuestions()">Begin</button>' +
      '<button type="button" onclick="cancelWizard()">Cancel</button></div>' +
      "</div>" +
      '<p class="wizard-unsure-hint">Not sure how many yet? ' +
      '<button type="button" class="link-inline" onclick="startNewWizardUnbounded()">Add questions one at a time instead</button>, ' +
      "and finish whenever you've covered them all." +
      "</p>"
    );
  }

  if (Wizard.stage === "flagged-review") return renderNewFlaggedReview(bookId, chapterId, chapter);
  if (Wizard.stage === "reviewing-one") return renderNewReviewOne(bookId, chapterId, chapter);

  const i = Wizard.index;
  const type = Wizard.currentType;
  const config = Wizard.currentConfig;
  const unbounded = Wizard.total === null;
  const isLast = !unbounded && i === Wizard.total - 1;
  const pendingChosen = Wizard.pendingChosen || [];
  const flaggedSoFar = Wizard.draftAnswers.filter((a) => a.flagged).length;

  let configHtml = "";

  if (type === "mcq") {
    configHtml =
      '<label for="opt-count">Number of options</label>' +
      '<input id="opt-count" type="number" min="2" max="8" value="' + config.optionLabels.length + '" onchange="wizardUpdateOptionCount(this.value)" />' +
      '<div class="choice-row"><input id="multi-select" type="checkbox" ' + (config.multiSelect ? "checked" : "") +
      ' onchange="wizardUpdateMultiSelect(this.checked)" /><label for="multi-select" style="margin:0">Allow selecting more than one option</label></div>' +
      (i > 0 ? '<p class="card-meta">Same as previous question &mdash; change above if this one is different.</p>' : "");
  }

  const buttonsHtml = unbounded
    ? '<button type="button" onclick="wizardCommitQuestion(false)">Add another question</button>' +
      '<button type="button" class="primary" onclick="wizardCommitQuestion(true)">Finish attempt</button>'
    : '<button type="button" class="primary" onclick="wizardCommitQuestion(' + isLast + ')">' +
      (isLast ? "Finish attempt" : "Next question") + "</button>";

  mount(
    "<h1>" + esc(chapter.title) + "</h1>" +
    '<p class="wizard-progress" tabindex="-1" autofocus>Question ' + (i + 1) + (unbounded ? "" : " of " + Wizard.total) +
    (flaggedSoFar > 0 ? " &middot; " + flaggedSoFar + " flagged" : "") + "</p>" +
    '<div class="card">' +
    '<label for="q-type">Question type</label>' +
    '<select id="q-type" onchange="wizardUpdateType(this.value)">' +
    '<option value="mcq" ' + (type === "mcq" ? "selected" : "") + '>Multiple choice</option>' +
    '<option value="truefalse" ' + (type === "truefalse" ? "selected" : "") + '>True / False</option>' +
    "</select>" +
    configHtml +
    renderAnswerFieldset(type, config, pendingChosen) +
    flagCheckboxHtml(Wizard.pendingFlagged, "Not sure yet &mdash; flag this question to review before submitting") +
    (Wizard.error ? '<p class="field-error" role="alert">' + esc(Wizard.error) + "</p>" : "") +
    '<div class="btn-row">' +
    (i > 0 ? '<button type="button" onclick="wizardGoBack()">Previous question</button>' : "") +
    (unbounded && i > 0 ? '<button type="button" class="danger" onclick="wizardRemoveAndFinish()">Remove this question &amp; finish</button>' : "") +
    buttonsHtml +
    '<button type="button" onclick="cancelWizard()">Cancel attempt</button>' +
    "</div>" +
    "</div>"
  );
}

function wizardGoBack() {
  if (Wizard.index === 0) return;
  const prev = Wizard.draftQuestions.pop();
  const prevAnswer = Wizard.draftAnswers.pop();
  Wizard.index -= 1;
  Wizard.currentType = prev.type;
  Wizard.currentConfig = Object.assign({}, prev.config, prev.config.optionLabels ? { optionLabels: prev.config.optionLabels.slice() } : {});
  Wizard.pendingChosen = prevAnswer.chosen.slice();
  Wizard.pendingFlagged = !!prevAnswer.flagged;
  Wizard.error = null;
  render();
}

function startNewWizardQuestions() {
  const count = parseInt(document.getElementById("q-count").value, 10);
  if (!count || count < 1) return;
  Wizard.total = count;
  Wizard.stage = "questions";
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
  render();
}

function startNewWizardUnbounded() {
  Wizard.total = null;
  Wizard.stage = "questions";
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
  render();
}

function wizardRemoveAndFinish() {
  if (Wizard.index === 0) return;
  const anyFlagged = Wizard.draftAnswers.some((a) => a.flagged);
  if (anyFlagged) {
    Wizard.stage = "flagged-review";
    render();
    return;
  }
  finishNewAttempt();
}

function wizardUpdateType(type) {
  Wizard.currentType = type;
  Wizard.pendingChosen = null;
  Wizard.pendingFlagged = false;
  if (type === "mcq") {
    Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
  } else {
    Wizard.currentConfig = {};
  }
  render();
}

function wizardUpdateOptionCount(value) {
  const n = Math.max(2, Math.min(8, parseInt(value, 10) || 4));
  const letters = "ABCDEFGH".split("");
  Wizard.currentConfig.optionLabels = letters.slice(0, n);
  render();
}

function wizardUpdateMultiSelect(checked) {
  Wizard.currentConfig.multiSelect = checked;
  render();
}

function wizardCommitQuestion(isLast) {
  const type = Wizard.currentType;
  const config = Wizard.currentConfig;
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
  const flagged = document.getElementById("flag-question").checked;

  if (checked.length === 0 && !flagged) {
    Wizard.error = "Select an answer, or flag this question to come back to it later.";
    render();
    return;
  }
  Wizard.error = null;

  Wizard.draftQuestions.push({ type, config: Object.assign({}, config) });
  Wizard.draftAnswers.push({ chosen: checked, flagged });
  Wizard.pendingChosen = null;
  Wizard.pendingFlagged = false;

  if (type === "mcq") {
    Wizard.lastMcqConfig = Object.assign({}, config, { optionLabels: config.optionLabels.slice() });
  }

  if (isLast) {
    const anyFlagged = Wizard.draftAnswers.some((a) => a.flagged);
    if (anyFlagged) {
      Wizard.stage = "flagged-review";
      render();
      return;
    }
    finishNewAttempt();
    return;
  }

  Wizard.index += 1;
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
  render();
}

function finishNewAttempt() {
  const attempt = commitNewAttempt(Wizard.chapterId, Wizard.draftQuestions, Wizard.draftAnswers);
  const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
  Wizard = null;
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
  render();
}

function renderNewFlaggedReview(bookId, chapterId, chapter) {
  const flaggedIdx = [];
  Wizard.draftAnswers.forEach((a, idx) => { if (a.flagged) flaggedIdx.push(idx); });

  const items = flaggedIdx.map((idx) =>
    '<li class="flagged-item"><button type="button" onclick="reviewNewFlaggedQuestion(' + idx + ')">Question ' + (idx + 1) + "</button>" +
    '<span class="card-meta">' + esc(formatChosenSummary(Wizard.draftAnswers[idx].chosen)) + "</span></li>"
  ).join("");

  mount(
    "<h1>" + esc(chapter.title) + "</h1>" +
    '<div class="card">' +
    '<h2 tabindex="-1" autofocus>' + pluralize(flaggedIdx.length, "question") + " flagged for review</h2>" +
    "<p>Take another look before submitting, or submit as-is.</p>" +
    '<ul class="flagged-list">' + (items || "<li>None left &mdash; you're all set.</li>") + "</ul>" +
    '<div class="btn-row"><button type="button" class="primary" onclick="finishNewAttempt()">Submit attempt</button></div>' +
    "</div>"
  );
}

function reviewNewFlaggedQuestion(idx) {
  Wizard.reviewIndex = idx;
  Wizard.stage = "reviewing-one";
  render();
}

function renderNewReviewOne(bookId, chapterId, chapter) {
  const idx = Wizard.reviewIndex;
  const q = Wizard.draftQuestions[idx];
  const a = Wizard.draftAnswers[idx];

  mount(
    "<h1>" + esc(chapter.title) + "</h1>" +
    '<p class="wizard-progress" tabindex="-1" autofocus>Reviewing question ' + (idx + 1) + "</p>" +
    '<div class="card">' +
    renderAnswerFieldset(q.type, q.config, a.chosen) +
    flagCheckboxHtml(a.flagged, "Still not sure &mdash; keep this question flagged") +
    (Wizard.error ? '<p class="field-error" role="alert">' + esc(Wizard.error) + "</p>" : "") +
    '<div class="btn-row">' +
    '<button type="button" class="primary" onclick="saveNewReviewedQuestion()">Save and return to flagged list</button>' +
    "</div>" +
    "</div>"
  );
}

function saveNewReviewedQuestion() {
  const idx = Wizard.reviewIndex;
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
  const flagged = document.getElementById("flag-question").checked;

  if (checked.length === 0 && !flagged) {
    Wizard.error = "Select an answer, or keep this question flagged.";
    render();
    return;
  }
  Wizard.error = null;
  Wizard.draftAnswers[idx] = { chosen: checked, flagged };
  Wizard.reviewIndex = null;
  Wizard.stage = "flagged-review";
  render();
}

function renderRetakeWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "flagged-review") return renderRetakeFlaggedReview(bookId, chapterId, chapter);
  if (Wizard.stage === "reviewing-one") return renderRetakeReviewOne(bookId, chapterId, chapter);

  const i = Wizard.index;
  const questionId = chapter.questionOrder[i];
  const question = Store.questions.find((q) => q.id === questionId);
  const isLast = i === chapter.questionOrder.length - 1;
  const priorEntry = Wizard.responses[questionId] || { chosen: [], flagged: false };
  const flaggedSoFar = Object.values(Wizard.responses).filter((r) => r.flagged).length;

  mount(
    "<h1>" + esc(chapter.title) + " &mdash; retake</h1>" +
    '<p class="wizard-progress" tabindex="-1" autofocus>Question ' + (i + 1) + " of " + chapter.questionOrder.length +
    (flaggedSoFar > 0 ? " &middot; " + flaggedSoFar + " flagged" : "") + "</p>" +
    '<div class="card">' +
    renderAnswerFieldset(question.type, question.config, priorEntry.chosen) +
    flagCheckboxHtml(priorEntry.flagged, "Not sure yet &mdash; flag this question to review before submitting") +
    (Wizard.error ? '<p class="field-error" role="alert">' + esc(Wizard.error) + "</p>" : "") +
    '<div class="btn-row">' +
    (i > 0 ? '<button type="button" onclick="retakeGoBack()">Previous question</button>' : "") +
    '<button type="button" class="primary" onclick="retakeCommitQuestion(\'' + questionId + '\',' + isLast + ')">' +
    (isLast ? "Finish attempt" : "Next question") + "</button>" +
    '<button type="button" onclick="cancelWizard()">Cancel attempt</button></div>' +
    "</div>"
  );
}

function retakeGoBack() {
  if (Wizard.index === 0) return;
  Wizard.index -= 1;
  Wizard.error = null;
  render();
}

function retakeCommitQuestion(questionId, isLast) {
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
  const flagged = document.getElementById("flag-question").checked;

  if (checked.length === 0 && !flagged) {
    Wizard.error = "Select an answer, or flag this question to come back to it later.";
    render();
    return;
  }
  Wizard.error = null;

  Wizard.responses[questionId] = { chosen: checked, flagged };

  if (isLast) {
    const chapter = Store.chapters.find((c) => c.id === Wizard.chapterId);
    const anyFlagged = chapter.questionOrder.some((qid) => Wizard.responses[qid] && Wizard.responses[qid].flagged);
    if (anyFlagged) {
      Wizard.stage = "flagged-review";
      render();
      return;
    }
    finishRetakeAttempt();
    return;
  }

  Wizard.index += 1;
  render();
}

function finishRetakeAttempt() {
  const attempt = commitRetakeAttempt(Wizard.chapterId, Wizard.responses);
  const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
  Wizard = null;
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
  render();
}

function renderRetakeFlaggedReview(bookId, chapterId, chapter) {
  const flaggedQids = chapter.questionOrder.filter((qid) => Wizard.responses[qid] && Wizard.responses[qid].flagged);
  const items = flaggedQids.map((qid) => {
    const num = chapter.questionOrder.indexOf(qid) + 1;
    return '<li class="flagged-item"><button type="button" onclick="reviewRetakeFlaggedQuestion(\'' + qid + '\')">Question ' + num + "</button>" +
      '<span class="card-meta">' + esc(formatChosenSummary(Wizard.responses[qid].chosen)) + "</span></li>";
  }).join("");

  mount(
    "<h1>" + esc(chapter.title) + " &mdash; retake</h1>" +
    '<div class="card">' +
    '<h2 tabindex="-1" autofocus>' + pluralize(flaggedQids.length, "question") + " flagged for review</h2>" +
    "<p>Take another look before submitting, or submit as-is.</p>" +
    '<ul class="flagged-list">' + (items || "<li>None left &mdash; you're all set.</li>") + "</ul>" +
    '<div class="btn-row"><button type="button" class="primary" onclick="finishRetakeAttempt()">Submit attempt</button></div>' +
    "</div>"
  );
}

function reviewRetakeFlaggedQuestion(questionId) {
  Wizard.reviewQuestionId = questionId;
  Wizard.stage = "reviewing-one";
  render();
}

function renderRetakeReviewOne(bookId, chapterId, chapter) {
  const questionId = Wizard.reviewQuestionId;
  const question = Store.questions.find((q) => q.id === questionId);
  const entry = Wizard.responses[questionId] || { chosen: [], flagged: false };
  const num = chapter.questionOrder.indexOf(questionId) + 1;

  mount(
    "<h1>" + esc(chapter.title) + " &mdash; retake</h1>" +
    '<p class="wizard-progress" tabindex="-1" autofocus>Reviewing question ' + num + "</p>" +
    '<div class="card">' +
    renderAnswerFieldset(question.type, question.config, entry.chosen) +
    flagCheckboxHtml(entry.flagged, "Still not sure &mdash; keep this question flagged") +
    (Wizard.error ? '<p class="field-error" role="alert">' + esc(Wizard.error) + "</p>" : "") +
    '<div class="btn-row">' +
    '<button type="button" class="primary" onclick="saveRetakeReviewedQuestion()">Save and return to flagged list</button>' +
    "</div>" +
    "</div>"
  );
}

function saveRetakeReviewedQuestion() {
  const questionId = Wizard.reviewQuestionId;
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
  const flagged = document.getElementById("flag-question").checked;

  if (checked.length === 0 && !flagged) {
    Wizard.error = "Select an answer, or keep this question flagged.";
    render();
    return;
  }
  Wizard.error = null;
  Wizard.responses[questionId] = { chosen: checked, flagged };
  Wizard.reviewQuestionId = null;
  Wizard.stage = "flagged-review";
  render();
}

/* ---------- Review / Grade ---------- */

let scrollToQuestionNum = null;

function renderReview(bookId, chapterId, attemptId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const attempt = Store.attempts.find((a) => a.id === attemptId);
  if (!chapter || !attempt) return mount("<p>Not found.</p>");
  document.title = "Review: " + chapter.title + " — AnswerPaper";

  const gradedCount = attempt.responses.filter((r) => {
    const q = Store.questions.find((qq) => qq.id === r.questionId);
    return q && q.correctAnswer !== null && q.correctAnswer !== undefined;
  }).length;
  const correctCount = attempt.responses.filter((r) => r.correct === true).length;

  const rows = attempt.responses.map((response, idx) => {
    const question = Store.questions.find((q) => q.id === response.questionId);
    const chosenLabel = response.chosen.length
      ? response.chosen.map(formatAnswerValue).join(", ") + (response.flagged ? " (flagged)" : "")
      : (response.flagged ? "Flagged — no answer given" : "(no answer)");
    const isLocked = question.correctAnswer !== null && question.correctAnswer !== undefined;

    let correctInput = "";
    if (question.type === "mcq") {
      const inputType = question.config.multiSelect ? "checkbox" : "radio";
      correctInput = question.config.optionLabels.map((label) => {
        const checked = question.correctAnswer && question.correctAnswer.includes(label);
        return '<div class="choice-row"><input type="' + inputType + '" name="correct-' + question.id + '" id="correct-' + question.id + '-' + label + '" value="' + label + '" ' + (checked ? "checked" : "") +
          ' onchange="handleCorrectAnswerChange(\'' + question.id + '\',\'' + bookId + '\',\'' + chapterId + '\',\'' + attemptId + '\')" />' +
          '<label for="correct-' + question.id + '-' + label + '" style="margin:0">' + label + "</label></div>";
      }).join("");
    } else {
      const trueChecked = question.correctAnswer && question.correctAnswer.includes("true");
      const falseChecked = question.correctAnswer && question.correctAnswer.includes("false");
      const onchange = ' onchange="handleCorrectAnswerChange(\'' + question.id + '\',\'' + bookId + '\',\'' + chapterId + '\',\'' + attemptId + '\')"';
      correctInput =
        '<div class="choice-row"><input type="radio" name="correct-' + question.id + '" id="correct-' + question.id + '-true" value="true" ' + (trueChecked ? "checked" : "") + onchange + ' /><label for="correct-' + question.id + '-true" style="margin:0">True</label></div>' +
        '<div class="choice-row"><input type="radio" name="correct-' + question.id + '" id="correct-' + question.id + '-false" value="false" ' + (falseChecked ? "checked" : "") + onchange + ' /><label for="correct-' + question.id + '-false" style="margin:0">False</label></div>';
    }

    const unanswered = response.chosen.length === 0;
    const statusClass = !isLocked ? "status-ungraded" : unanswered ? "status-incorrect" : response.correct ? "status-correct" : "status-incorrect";
    const statusText = !isLocked ? "Not yet graded" : unanswered ? "Unanswered" : response.correct ? "Correct" : "Incorrect";

    return (
      '<div class="card" id="q-card-' + (idx + 1) + '">' +
      "<h2>Question " + (idx + 1) + '</h2>' +
      "<p>Your answer: <strong>" + esc(chosenLabel) + "</strong> &mdash; <span class=\"" + statusClass + "\">" + statusText + "</span></p>" +
      '<fieldset><legend>Correct answer</legend>' + correctInput + "</fieldset>" +
      '<p class="save-flash" id="save-flash-' + question.id + '" aria-live="polite">' + (isLocked ? "Saved" : "") + "</p>" +
      "</div>"
    );
  }).join("");

  mount(
    '<p><a href="#/books/' + bookId + '/chapters/' + chapterId + '">&larr; ' + esc(chapter.title) + "</a></p>" +
    "<h1>Review &amp; grade</h1>" +
    '<p class="wizard-progress">Graded ' + gradedCount + " of " + attempt.responses.length + " &middot; " + correctCount + " correct so far</p>" +
    "<p>Pick the correct answer for each question — it saves immediately. Editing a correct answer later will re-grade every past attempt for that question.</p>" +
    rows
  );

  if (scrollToQuestionNum !== null) {
    const target = document.getElementById("q-card-" + scrollToQuestionNum);
    scrollToQuestionNum = null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("highlight-card");
      setTimeout(() => target.classList.remove("highlight-card"), 2000);
    }
  }
}

function handleCorrectAnswerChange(questionId, bookId, chapterId, attemptId) {
  const inputs = document.querySelectorAll('input[name="correct-' + questionId + '"]:checked');
  const values = Array.from(inputs).map((el) => el.value);
  if (!values.length) return;
  applyCorrectAnswer(questionId, values);
  renderReview(bookId, chapterId, attemptId);
  const flash = document.getElementById("save-flash-" + questionId);
  if (flash) flash.textContent = "Saved ✓";
}

/* ---------- Trends ---------- */

function renderTrends(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount("<p>Not found.</p>");
  document.title = "Trends: " + chapter.title + " — AnswerPaper";

  const chapterSeries = computeChapterTrend(Store, chapterId);
  const weakest = weakestQuestions(Store, chapterId, 5);
  const anyGraded = chapter.questionOrder.some((qid) =>
    computeQuestionTrend(Store, qid).sequence.some((s) => s.correct !== null)
  );

  const weakestRows = weakest.map((w) =>
    "<tr><td><button type=\"button\" class=\"link-inline\" onclick=\"jumpToWeakestQuestion('" + bookId + "','" + chapterId + "'," + w.questionNumber + ")\">Question " + w.questionNumber + "</button></td><td>" + Math.round(w.incorrectRate * 100) + "%</td><td>" + w.gradedCount + "</td></tr>"
  ).join("");

  const questionRows = chapter.questionOrder.map((qid, idx) => {
    const trend = computeQuestionTrend(Store, qid);
    const seq = trend.sequence.map((s) => {
      const statusClass = s.correct === null ? "status-ungraded" : s.correct ? "status-correct" : "status-incorrect";
      const symbol = s.correct === null ? "&ndash;" : s.correct ? "&#10003;" : "&#10007;";
      return '<span class="' + statusClass + '">' + symbol + "</span>";
    }).join(" ");
    return "<tr><td>Question " + (idx + 1) + "</td><td>" + (seq || "No attempts") + "</td></tr>";
  }).join("");

  mount(
    '<p><a href="#/books/' + bookId + '/chapters/' + chapterId + '">&larr; ' + esc(chapter.title) + "</a></p>" +
    "<h1>Trends: " + esc(chapter.title) + "</h1>" +
    (chapterSeries.length ? '<div class="card"><h2>Score over time</h2>' + renderScoreLineChart(chapterSeries) + "</div>" : "") +
    '<div class="card"><h2>Weakest questions</h2>' +
    (weakestRows
      ? '<div class="table-wrap"><table><thead><tr><th scope="col">Question</th><th scope="col">Incorrect rate</th><th scope="col">Graded attempts</th></tr></thead><tbody>' + weakestRows + "</tbody></table></div>"
      : anyGraded
        ? "<p>No incorrect answers yet &mdash; nice work!</p>"
        : "<p>Not enough graded attempts yet.</p>") +
    "</div>" +
    '<div class="card"><h2>Per-question history</h2>' +
    '<div class="table-wrap"><table><thead><tr><th scope="col">Question</th><th scope="col">Attempt sequence</th></tr></thead><tbody>' + questionRows + "</tbody></table></div>" +
    "</div>"
  );
}

function jumpToWeakestQuestion(bookId, chapterId, questionNumber) {
  const attempts = attemptsForChapter(Store, chapterId);
  if (!attempts.length) return;
  const latest = attempts[attempts.length - 1];
  scrollToQuestionNum = questionNumber;
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + latest.id + "/review");
  render();
}

/* ---------- Print trigger ---------- */

function renderPrintTrigger(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount("<p>Not found.</p>");
  document.title = "Print: " + chapter.title + " — AnswerPaper";
  mount(
    '<p><a href="#/books/' + bookId + '/chapters/' + chapterId + '">&larr; ' + esc(chapter.title) + "</a></p>" +
    "<h1>Print: " + esc(chapter.title) + "</h1>" +
    "<p>Click print, then choose \"Save as PDF\" in the print dialog.</p>" +
    '<div class="btn-row"><button type="button" class="primary" onclick="triggerPrint(\'' + chapterId + '\')">Print</button></div>'
  );
  buildPrintView(chapterId);
}

function triggerPrint(chapterId) {
  buildPrintView(chapterId);
  window.print();
}
