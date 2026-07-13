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

function mount(html) {
  document.getElementById("main").innerHTML = html;
}

function render() {
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
  const attempts = Store.attempts
    .slice()
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 8);

  const rows = attempts.map((attempt) => {
    const chapter = Store.chapters.find((c) => c.id === attempt.chapterId);
    if (!chapter) return "";
    const book = Store.books.find((b) => b.id === chapter.bookId);
    const graded = attempt.responses.filter((r) => r.correct !== null);
    const correctCount = graded.filter((r) => r.correct === true).length;
    const score = graded.length ? Math.round((correctCount / graded.length) * 100) + "%" : "Ungraded";
    return (
      '<tr>' +
      '<td><a href="#/books/' + book.id + '/chapters/' + chapter.id + '">' + esc(book.title) + " &rsaquo; " + esc(chapter.title) + '</a></td>' +
      "<td>" + formatDate(attempt.finishedAt) + "</td>" +
      "<td>" + score + "</td>" +
      "</tr>"
    );
  }).join("");

  mount(
    '<h1>Home</h1>' +
    '<div class="card">' +
    "<h2>Recent activity</h2>" +
    (attempts.length
      ? '<div class="table-wrap"><table><thead><tr><th>Chapter</th><th>Date</th><th>Score</th></tr></thead><tbody>' + rows + "</tbody></table></div>"
      : "<p>No attempts yet. <a href=\"#/books\">Start with your books</a>.</p>") +
    "</div>" +
    '<div class="btn-row"><a class="btn primary" href="#/books">View all books</a></div>'
  );
}

/* ---------- Books ---------- */

function renderBookList() {
  const cards = Store.books.map((book) => {
    const chapterCount = Store.chapters.filter((c) => c.bookId === book.id).length;
    return (
      '<div class="card">' +
      '<a class="card-link" href="#/books/' + book.id + '/chapters"><h3>' + esc(book.title) + "</h3></a>" +
      '<p class="card-meta">' + chapterCount + " chapter(s)</p>" +
      '<div class="btn-row">' +
      '<button type="button" onclick="promptRenameBook(\'' + book.id + '\')">Rename</button>' +
      '<button type="button" class="danger" onclick="promptDeleteBook(\'' + book.id + '\')">Delete</button>' +
      "</div>" +
      "</div>"
    );
  }).join("");

  mount(
    "<h1>Books</h1>" +
    '<div class="card">' +
    '<label for="new-book-title">New book title</label>' +
    '<input id="new-book-title" type="text" placeholder="e.g. Organic Chemistry" />' +
    '<div class="btn-row"><button type="button" class="primary" onclick="handleAddBook()">Add book</button></div>' +
    "</div>" +
    '<div class="card-list">' + (cards || "<p>No books yet.</p>") + "</div>"
  );
}

function handleAddBook() {
  const input = document.getElementById("new-book-title");
  const title = input.value.trim();
  if (!title) return;
  addBook(title);
  renderBookList();
}

function promptRenameBook(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  const title = prompt("Rename book", book.title);
  if (title && title.trim()) {
    renameBook(bookId, title);
    renderBookList();
  }
}

function promptDeleteBook(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  const counts = bookCascadeCounts(bookId);
  const ok = confirm(
    "Delete book '" + book.title + "' and all " + counts.chapterCount +
    " chapter(s) (" + counts.attemptCount + " attempt(s) total)? This cannot be undone."
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

  const chapters = Store.chapters.filter((c) => c.bookId === bookId);
  const cards = chapters.map((chapter) => {
    const attemptCount = Store.attempts.filter((a) => a.chapterId === chapter.id).length;
    return (
      '<div class="card">' +
      '<a class="card-link" href="#/books/' + bookId + '/chapters/' + chapter.id + '"><h3>' + esc(chapter.title) + "</h3></a>" +
      '<p class="card-meta">' + attemptCount + " attempt(s)</p>" +
      '<div class="btn-row">' +
      '<button type="button" onclick="promptRenameChapter(\'' + bookId + '\',\'' + chapter.id + '\')">Rename</button>' +
      '<button type="button" class="danger" onclick="promptDeleteChapter(\'' + bookId + '\',\'' + chapter.id + '\')">Delete</button>' +
      "</div>" +
      "</div>"
    );
  }).join("");

  mount(
    '<p><a href="#/books">&larr; All books</a></p>' +
    "<h1>" + esc(book.title) + "</h1>" +
    '<div class="card">' +
    '<label for="new-chapter-title">New chapter title</label>' +
    '<input id="new-chapter-title" type="text" placeholder="e.g. Chapter 4: Alkenes" />' +
    '<div class="btn-row"><button type="button" class="primary" onclick="handleAddChapter(\'' + bookId + '\')">Add chapter</button></div>' +
    "</div>" +
    '<div class="card-list">' + (cards || "<p>No chapters yet.</p>") + "</div>"
  );
}

function handleAddChapter(bookId) {
  const input = document.getElementById("new-chapter-title");
  const title = input.value.trim();
  if (!title) return;
  addChapter(bookId, title);
  renderChapterList(bookId);
}

function promptRenameChapter(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const title = prompt("Rename chapter", chapter.title);
  if (title && title.trim()) {
    renameChapter(chapterId, title);
    renderChapterList(bookId);
  }
}

function promptDeleteChapter(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const counts = chapterCascadeCounts(chapterId);
  const ok = confirm(
    "Delete chapter '" + chapter.title + "' and its " + counts.attemptCount +
    " attempt(s)? This cannot be undone."
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

  const attempts = attemptsForChapter(Store, chapterId).slice().reverse();
  const isFirstTime = chapter.questionOrder.length === 0;

  const rows = attempts.map((attempt) => {
    const graded = attempt.responses.filter((r) => r.correct !== null);
    const correctCount = graded.filter((r) => r.correct === true).length;
    const score = graded.length ? Math.round((correctCount / graded.length) * 100) + "%" : "Ungraded";
    const needsReview = graded.length < attempt.responses.length;
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
    (isFirstTime ? "" : '<a class="btn" href="#/books/' + bookId + '/chapters/' + chapterId + '/trends">View trends</a>') +
    '<a class="btn" href="#/books/' + bookId + '/chapters/' + chapterId + '/print">Print blank paper</a>' +
    "</div>" +
    (chartSeries.length ? '<div class="card"><h2>Score over time</h2>' + renderScoreLineChart(chartSeries) + "</div>" : "") +
    '<div class="card"><h2>Past attempts</h2>' +
    (attempts.length
      ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Score</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>"
      : "<p>No attempts yet.</p>") +
    "</div>"
  );
}

function renderScoreLineChart(series) {
  const width = 560, height = 200, padL = 36, padR = 16, padT = 16, padB = 28;
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

  const circles = points.map((p) => {
    const label = p.s.scorePercent === null ? "Ungraded" : p.s.scorePercent + "%";
    return (
      '<circle class="chart-point" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4">' +
      "<title>" + formatDate(p.s.date) + ": " + label + "</title>" +
      "</circle>"
    );
  }).join("");

  const last = points[points.length - 1];
  const lastLabel = series[series.length - 1].scorePercent === null ? "" :
    '<text class="chart-label" x="' + last.x.toFixed(1) + '" y="' + (last.y - 10).toFixed(1) + '" text-anchor="middle">' +
    series[series.length - 1].scorePercent + "%</text>";

  return (
    '<div class="chart-wrap"><svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Chapter score percentage over time">' +
    gridLines + '<path class="chart-line" d="' + path + '"></path>' + circles + lastLabel +
    "</svg></div>"
  );
}

/* ---------- New Attempt / Retake wizard ---------- */

let Wizard = null;

const DEFAULT_MCQ_CONFIG = { optionLabels: ["A", "B", "C", "D"], multiSelect: false };

function renderAttemptWizard(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount("<p>Chapter not found.</p>");
  const isFirstTime = chapter.questionOrder.length === 0;

  if (!Wizard || Wizard.chapterId !== chapterId || Wizard.mode !== (isFirstTime ? "new" : "retake")) {
    if (isFirstTime) {
      Wizard = {
        chapterId, bookId, mode: "new",
        stage: "count", total: null, index: 0,
        lastMcqConfig: Object.assign({}, DEFAULT_MCQ_CONFIG),
        draftQuestions: [], draftAnswers: [],
        currentType: "mcq", currentConfig: Object.assign({}, DEFAULT_MCQ_CONFIG),
        error: null,
      };
    } else {
      Wizard = {
        chapterId, bookId, mode: "retake",
        index: 0, responses: {}, error: null,
      };
    }
  }

  if (Wizard.mode === "new") return renderNewWizard(bookId, chapterId, chapter);
  return renderRetakeWizard(bookId, chapterId, chapter);
}

function renderNewWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "count") {
    return mount(
      "<h1>" + esc(chapter.title) + " &mdash; new attempt</h1>" +
      '<div class="card">' +
      '<label for="q-count">How many questions in this chapter?</label>' +
      '<input id="q-count" type="number" min="1" max="200" value="20" />' +
      '<div class="btn-row"><button type="button" class="primary" onclick="startNewWizardQuestions()">Begin</button></div>' +
      "</div>"
    );
  }

  const i = Wizard.index;
  const type = Wizard.currentType;
  const config = Wizard.currentConfig;
  const isLast = i === Wizard.total - 1;
  const pendingChosen = Wizard.pendingChosen || [];

  let configHtml = "";
  let answerHtml = "";

  if (type === "mcq") {
    configHtml =
      '<label for="opt-count">Number of options</label>' +
      '<input id="opt-count" type="number" min="2" max="8" value="' + config.optionLabels.length + '" onchange="wizardUpdateOptionCount(this.value)" />' +
      '<div class="choice-row"><input id="multi-select" type="checkbox" ' + (config.multiSelect ? "checked" : "") +
      ' onchange="wizardUpdateMultiSelect(this.checked)" /><label for="multi-select" style="margin:0">Allow selecting more than one option</label></div>';

    const inputType = config.multiSelect ? "checkbox" : "radio";
    answerHtml = '<fieldset><legend>Your answer</legend>' + config.optionLabels.map((label) =>
      '<div class="choice-row"><input type="' + inputType + '" name="answer" id="opt-' + label + '" value="' + label + '" ' +
      (pendingChosen.includes(label) ? "checked" : "") + ' />' +
      '<label for="opt-' + label + '" style="margin:0">' + label + "</label></div>"
    ).join("") + "</fieldset>";
  } else {
    answerHtml =
      '<fieldset><legend>Your answer</legend>' +
      '<div class="choice-row"><input type="radio" name="answer" id="opt-true" value="true" ' + (pendingChosen.includes("true") ? "checked" : "") + ' /><label for="opt-true" style="margin:0">True</label></div>' +
      '<div class="choice-row"><input type="radio" name="answer" id="opt-false" value="false" ' + (pendingChosen.includes("false") ? "checked" : "") + ' /><label for="opt-false" style="margin:0">False</label></div>' +
      "</fieldset>";
  }

  mount(
    "<h1>" + esc(chapter.title) + "</h1>" +
    '<p class="wizard-progress">Question ' + (i + 1) + " of " + Wizard.total + "</p>" +
    '<div class="card">' +
    '<label for="q-type">Question type</label>' +
    '<select id="q-type" onchange="wizardUpdateType(this.value)">' +
    '<option value="mcq" ' + (type === "mcq" ? "selected" : "") + '>Multiple choice</option>' +
    '<option value="truefalse" ' + (type === "truefalse" ? "selected" : "") + '>True / False</option>' +
    "</select>" +
    configHtml +
    answerHtml +
    (Wizard.error ? '<p class="field-error" role="alert">' + esc(Wizard.error) + "</p>" : "") +
    '<div class="btn-row">' +
    (i > 0 ? '<button type="button" onclick="wizardGoBack()">Previous question</button>' : "") +
    '<button type="button" class="primary" onclick="wizardCommitQuestion(' + isLast + ')">' +
    (isLast ? "Finish attempt" : "Next question") + "</button></div>" +
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

function wizardUpdateType(type) {
  Wizard.currentType = type;
  Wizard.pendingChosen = null;
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

  if (checked.length === 0) {
    Wizard.error = "Select an answer before continuing.";
    render();
    return;
  }
  Wizard.error = null;

  Wizard.draftQuestions.push({ type, config: Object.assign({}, config) });
  Wizard.draftAnswers.push({ chosen: checked });
  Wizard.pendingChosen = null;

  if (type === "mcq") {
    Wizard.lastMcqConfig = Object.assign({}, config, { optionLabels: config.optionLabels.slice() });
  }

  if (isLast) {
    const attempt = commitNewAttempt(Wizard.chapterId, Wizard.draftQuestions, Wizard.draftAnswers);
    const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
    Wizard = null;
    navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
    render();
    return;
  }

  Wizard.index += 1;
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
  render();
}

function renderRetakeWizard(bookId, chapterId, chapter) {
  const i = Wizard.index;
  const questionId = chapter.questionOrder[i];
  const question = Store.questions.find((q) => q.id === questionId);
  const isLast = i === chapter.questionOrder.length - 1;
  const priorChosen = Wizard.responses[questionId] || [];

  let answerHtml = "";
  if (question.type === "mcq") {
    const inputType = question.config.multiSelect ? "checkbox" : "radio";
    answerHtml = '<fieldset><legend>Your answer</legend>' + question.config.optionLabels.map((label) =>
      '<div class="choice-row"><input type="' + inputType + '" name="answer" id="opt-' + label + '" value="' + label + '" ' +
      (priorChosen.includes(label) ? "checked" : "") + ' />' +
      '<label for="opt-' + label + '" style="margin:0">' + label + "</label></div>"
    ).join("") + "</fieldset>";
  } else {
    answerHtml =
      '<fieldset><legend>Your answer</legend>' +
      '<div class="choice-row"><input type="radio" name="answer" id="opt-true" value="true" ' + (priorChosen.includes("true") ? "checked" : "") + ' /><label for="opt-true" style="margin:0">True</label></div>' +
      '<div class="choice-row"><input type="radio" name="answer" id="opt-false" value="false" ' + (priorChosen.includes("false") ? "checked" : "") + ' /><label for="opt-false" style="margin:0">False</label></div>' +
      "</fieldset>";
  }

  mount(
    "<h1>" + esc(chapter.title) + " &mdash; retake</h1>" +
    '<p class="wizard-progress">Question ' + (i + 1) + " of " + chapter.questionOrder.length + "</p>" +
    '<div class="card">' + answerHtml +
    (Wizard.error ? '<p class="field-error" role="alert">' + esc(Wizard.error) + "</p>" : "") +
    '<div class="btn-row">' +
    (i > 0 ? '<button type="button" onclick="retakeGoBack()">Previous question</button>' : "") +
    '<button type="button" class="primary" onclick="retakeCommitQuestion(\'' + questionId + '\',' + isLast + ')">' +
    (isLast ? "Finish attempt" : "Next question") + "</button></div>" +
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

  if (checked.length === 0) {
    Wizard.error = "Select an answer before continuing.";
    render();
    return;
  }
  Wizard.error = null;

  Wizard.responses[questionId] = checked;

  if (isLast) {
    const attempt = commitRetakeAttempt(Wizard.chapterId, Wizard.responses);
    const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
    Wizard = null;
    navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
    render();
    return;
  }

  Wizard.index += 1;
  render();
}

/* ---------- Review / Grade ---------- */

function renderReview(bookId, chapterId, attemptId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const attempt = Store.attempts.find((a) => a.id === attemptId);
  if (!chapter || !attempt) return mount("<p>Not found.</p>");

  const rows = attempt.responses.map((response, idx) => {
    const question = Store.questions.find((q) => q.id === response.questionId);
    const chosenLabel = response.chosen.length ? response.chosen.join(", ") : "(no answer)";

    let correctInput = "";
    if (question.type === "mcq") {
      const inputType = question.config.multiSelect ? "checkbox" : "radio";
      correctInput = question.config.optionLabels.map((label) => {
        const checked = question.correctAnswer && question.correctAnswer.includes(label);
        return '<div class="choice-row"><input type="' + inputType + '" name="correct-' + question.id + '" id="correct-' + question.id + '-' + label + '" value="' + label + '" ' + (checked ? "checked" : "") + ' />' +
          '<label for="correct-' + question.id + '-' + label + '" style="margin:0">' + label + "</label></div>";
      }).join("");
    } else {
      const trueChecked = question.correctAnswer && question.correctAnswer.includes("true");
      const falseChecked = question.correctAnswer && question.correctAnswer.includes("false");
      correctInput =
        '<div class="choice-row"><input type="radio" name="correct-' + question.id + '" id="correct-' + question.id + '-true" value="true" ' + (trueChecked ? "checked" : "") + ' /><label for="correct-' + question.id + '-true" style="margin:0">True</label></div>' +
        '<div class="choice-row"><input type="radio" name="correct-' + question.id + '" id="correct-' + question.id + '-false" value="false" ' + (falseChecked ? "checked" : "") + ' /><label for="correct-' + question.id + '-false" style="margin:0">False</label></div>';
    }

    const statusClass = response.correct === null ? "status-ungraded" : response.correct ? "status-correct" : "status-incorrect";
    const statusText = response.correct === null ? "Ungraded" : response.correct ? "Correct" : "Incorrect";

    return (
      '<div class="card">' +
      "<h3>Question " + (idx + 1) + '</h3>' +
      "<p>Your answer: <strong>" + esc(chosenLabel) + "</strong> &mdash; <span class=\"" + statusClass + "\">" + statusText + "</span></p>" +
      '<fieldset><legend>Correct answer</legend>' + correctInput + "</fieldset>" +
      '<button type="button" onclick="saveCorrectAnswer(\'' + question.id + '\',\'' + bookId + '\',\'' + chapterId + '\',\'' + attemptId + '\')">Save correct answer</button>' +
      "</div>"
    );
  }).join("");

  mount(
    '<p><a href="#/books/' + bookId + '/chapters/' + chapterId + '">&larr; ' + esc(chapter.title) + "</a></p>" +
    "<h1>Review &amp; grade</h1>" +
    "<p>Lock in the correct answer for each question. Editing a correct answer later will re-grade every past attempt for that question.</p>" +
    rows
  );
}

function saveCorrectAnswer(questionId, bookId, chapterId, attemptId) {
  const question = Store.questions.find((q) => q.id === questionId);
  const inputs = document.querySelectorAll('input[name="correct-' + questionId + '"]:checked');
  const values = Array.from(inputs).map((el) => el.value);
  if (!values.length) {
    alert("Pick the correct answer before saving.");
    return;
  }
  applyCorrectAnswer(questionId, values);
  renderReview(bookId, chapterId, attemptId);
}

/* ---------- Trends ---------- */

function renderTrends(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount("<p>Not found.</p>");

  const chapterSeries = computeChapterTrend(Store, chapterId);
  const weakest = weakestQuestions(Store, chapterId, 5);

  const weakestRows = weakest.map((w) =>
    "<tr><td>Question " + w.questionNumber + "</td><td>" + Math.round(w.incorrectRate * 100) + "%</td><td>" + w.gradedCount + "</td></tr>"
  ).join("");

  const questionRows = chapter.questionOrder.map((qid, idx) => {
    const trend = computeQuestionTrend(Store, qid);
    const seq = trend.sequence.map((s) => (s.correct === null ? "&ndash;" : s.correct ? "&#10003;" : "&#10007;")).join(" ");
    return "<tr><td>Question " + (idx + 1) + "</td><td>" + (seq || "No attempts") + "</td></tr>";
  }).join("");

  mount(
    '<p><a href="#/books/' + bookId + '/chapters/' + chapterId + '">&larr; ' + esc(chapter.title) + "</a></p>" +
    "<h1>Trends: " + esc(chapter.title) + "</h1>" +
    (chapterSeries.length ? '<div class="card"><h2>Score over time</h2>' + renderScoreLineChart(chapterSeries) + "</div>" : "") +
    '<div class="card"><h2>Weakest questions</h2>' +
    (weakestRows
      ? '<div class="table-wrap"><table><thead><tr><th>Question</th><th>Incorrect rate</th><th>Graded attempts</th></tr></thead><tbody>' + weakestRows + "</tbody></table></div>"
      : "<p>Not enough graded attempts yet.</p>") +
    "</div>" +
    '<div class="card"><h2>Per-question history</h2>' +
    '<div class="table-wrap"><table><thead><tr><th>Question</th><th>Attempt sequence</th></tr></thead><tbody>' + questionRows + "</tbody></table></div>" +
    "</div>"
  );
}

/* ---------- Print trigger ---------- */

function renderPrintTrigger(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount("<p>Not found.</p>");
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
