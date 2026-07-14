/* Screen rendering. Reads Store, writes into #main via Preact. Full re-render on every change. */

import { html, render as preactRender } from "./vendor/htm-preact.js";

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

function mount(vnode) {
  preactRender(vnode, document.getElementById("main"));
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
  mount(html`<p>Page not found. <a href="#/">Go home</a>.</p>`);
}

/* ---------- Home ---------- */

function renderHome() {
  const attempts = Store.attempts
    .slice()
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 8);

  const rows = attempts.map((attempt) => {
    const chapter = Store.chapters.find((c) => c.id === attempt.chapterId);
    if (!chapter) return null;
    const book = Store.books.find((b) => b.id === chapter.bookId);
    const graded = attempt.responses.filter((r) => r.correct !== null);
    const correctCount = graded.filter((r) => r.correct === true).length;
    const score = graded.length ? Math.round((correctCount / graded.length) * 100) + "%" : "Ungraded";
    return html`
      <tr key=${attempt.id}>
        <td><a href=${"#/books/" + book.id + "/chapters/" + chapter.id}>${book.title} › ${chapter.title}</a></td>
        <td>${formatDate(attempt.finishedAt)}</td>
        <td>${score}</td>
      </tr>
    `;
  });

  mount(html`
    <h1>Home</h1>
    <div class="card">
      <h2>Recent activity</h2>
      ${attempts.length
        ? html`<div class="table-wrap"><table><thead><tr><th>Chapter</th><th>Date</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : html`<p>No attempts yet. <a href="#/books">Start with your books</a>.</p>`}
    </div>
    <div class="btn-row"><a class="btn primary" href="#/books">View all books</a></div>
  `);
}

/* ---------- Books ---------- */

let uiState = { addBookOpen: false, addChapterOpen: false };

function renderBookList() {
  const cards = Store.books.map((book) => {
    const chapterCount = Store.chapters.filter((c) => c.bookId === book.id).length;
    return html`
      <div class="card" key=${book.id}>
        <a class="card-link" href=${"#/books/" + book.id + "/chapters"}><h3>${book.title}</h3></a>
        <p class="card-meta">${chapterCount} chapter(s)</p>
        <div class="btn-row">
          <button type="button" onClick=${() => promptRenameBook(book.id)}>Rename</button>
          <button type="button" class="danger" onClick=${() => promptDeleteBook(book.id)}>Delete</button>
        </div>
      </div>
    `;
  });

  const addForm = uiState.addBookOpen
    ? html`
      <div class="card">
        <label for="new-book-title">New book title</label>
        <input id="new-book-title" type="text" placeholder="e.g. Organic Chemistry" autofocus />
        <div class="btn-row">
          <button type="button" class="primary" onClick=${handleAddBook}>Add book</button>
          <button type="button" onClick=${() => toggleAddBookForm(false)}>Cancel</button>
        </div>
      </div>
    `
    : html`<div class="btn-row"><button type="button" class="primary" onClick=${() => toggleAddBookForm(true)}>+ Add book</button></div>`;

  mount(html`
    <h1>Books</h1>
    ${addForm}
    <div class="card-list">${cards.length ? cards : html`<div class="card"><p>No books yet.</p></div>`}</div>
  `);
}

function toggleAddBookForm(open) {
  uiState.addBookOpen = open;
  renderBookList();
}

function handleAddBook() {
  const input = document.getElementById("new-book-title");
  const title = input.value.trim();
  if (!title) return;
  addBook(title);
  uiState.addBookOpen = false;
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
  if (!book) return mount(html`<p>Book not found. <a href="#/books">Go back</a>.</p>`);

  const chapters = Store.chapters.filter((c) => c.bookId === bookId);
  const cards = chapters.map((chapter) => {
    const attemptCount = Store.attempts.filter((a) => a.chapterId === chapter.id).length;
    return html`
      <div class="card" key=${chapter.id}>
        <a class="card-link" href=${"#/books/" + bookId + "/chapters/" + chapter.id}><h3>${chapter.title}</h3></a>
        <p class="card-meta">${attemptCount} attempt(s)</p>
        <div class="btn-row">
          <button type="button" onClick=${() => promptRenameChapter(bookId, chapter.id)}>Rename</button>
          <button type="button" class="danger" onClick=${() => promptDeleteChapter(bookId, chapter.id)}>Delete</button>
        </div>
      </div>
    `;
  });

  const addForm = uiState.addChapterOpen
    ? html`
      <div class="card">
        <label for="new-chapter-title">New chapter title</label>
        <input id="new-chapter-title" type="text" placeholder="e.g. Chapter 4: Alkenes" autofocus />
        <div class="btn-row">
          <button type="button" class="primary" onClick=${() => handleAddChapter(bookId)}>Add chapter</button>
          <button type="button" onClick=${() => toggleAddChapterForm(false, bookId)}>Cancel</button>
        </div>
      </div>
    `
    : html`<div class="btn-row"><button type="button" class="primary" onClick=${() => toggleAddChapterForm(true, bookId)}>+ Add chapter</button></div>`;

  mount(html`
    <p><a href="#/books">← All books</a></p>
    <h1>${book.title}</h1>
    ${addForm}
    <div class="card-list">${cards.length ? cards : html`<div class="card"><p>No chapters yet.</p></div>`}</div>
  `);
}

function toggleAddChapterForm(open, bookId) {
  uiState.addChapterOpen = open;
  renderChapterList(bookId);
}

function handleAddChapter(bookId) {
  const input = document.getElementById("new-chapter-title");
  const title = input.value.trim();
  if (!title) return;
  addChapter(bookId, title);
  uiState.addChapterOpen = false;
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
  if (!book || !chapter) return mount(html`<p>Not found. <a href="#/books">Go back</a>.</p>`);

  const attempts = attemptsForChapter(Store, chapterId).slice().reverse();
  const isFirstTime = chapter.questionOrder.length === 0;

  const rows = attempts.map((attempt) => {
    const graded = attempt.responses.filter((r) => r.correct !== null);
    const correctCount = graded.filter((r) => r.correct === true).length;
    const score = graded.length ? Math.round((correctCount / graded.length) * 100) + "%" : "Ungraded";
    const needsReview = graded.length < attempt.responses.length;
    return html`
      <tr key=${attempt.id}>
        <td>${formatDate(attempt.finishedAt)}</td>
        <td>${score}</td>
        <td><a href=${"#/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review"}>${needsReview ? "Review / grade" : "View / edit answers"}</a></td>
      </tr>
    `;
  });

  const chartSeries = computeChapterTrend(Store, chapterId);

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters"}>← ${book.title}</a></p>
    <h1>${chapter.title}</h1>
    <div class="btn-row">
      <a class="btn primary" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/attempt"}>${isFirstTime ? "Start attempt" : "Retake"}</a>
      ${isFirstTime ? null : html`
        <a class="btn" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/trends"}>View trends</a>
        <a class="btn" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/print"}>Print blank paper</a>
      `}
    </div>
    ${chartSeries.length ? html`<div class="card"><h2>Score over time</h2>${renderScoreLineChart(chartSeries)}</div>` : null}
    <div class="card">
      <h2>Past attempts</h2>
      ${attempts.length
        ? html`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Score</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : html`<p>No attempts yet.</p>`}
    </div>
  `);
}

function renderScoreLineChart(series) {
  const width = 560, height = 200, padL = 36, padR = 16, padT = 28, padB = 28;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (pct) => padT + innerH - (innerH * (pct === null ? 0 : pct)) / 100;

  const gridLines = [0, 25, 50, 75, 100].map((pct) => {
    const gy = y(pct);
    return html`
      <g key=${pct}>
        <line class="chart-grid" x1=${padL} y1=${gy} x2=${width - padR} y2=${gy}></line>
        <text x=${padL - 8} y=${gy + 3} text-anchor="end">${pct}</text>
      </g>
    `;
  });

  const points = series.map((s, i) => ({ x: x(i), y: y(s.scorePercent || 0), s }));
  const path = points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");

  const circles = points.map((p, i) => {
    const label = p.s.scorePercent === null ? "Ungraded" : p.s.scorePercent + "%";
    return html`
      <circle class="chart-point" key=${p.s.attemptId || i} cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r="4">
        <title>${formatDate(p.s.date)}: ${label}</title>
      </circle>
    `;
  });

  const last = points[points.length - 1];
  const lastLabel = series[series.length - 1].scorePercent === null ? null : html`
    <text class="chart-label" x=${last.x.toFixed(1)} y=${(last.y - 10).toFixed(1)} text-anchor="middle">${series[series.length - 1].scorePercent}%</text>
  `;

  return html`
    <div class="chart-wrap">
      <svg viewBox=${"0 0 " + width + " " + height} role="img" aria-label="Chapter score percentage over time">
        ${gridLines}
        <path class="chart-line" d=${path}></path>
        ${circles}
        ${lastLabel}
      </svg>
    </div>
  `;
}

/* ---------- New Attempt / Retake wizard ---------- */

let Wizard = null;

const DEFAULT_MCQ_CONFIG = { optionLabels: ["A", "B", "C", "D"], multiSelect: false };

function renderAttemptWizard(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount(html`<p>Chapter not found.</p>`);
  const isFirstTime = chapter.questionOrder.length === 0;

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
    return html`
      <fieldset>
        <legend>Your answer</legend>
        ${config.optionLabels.map((label) => html`
          <div class="choice-row" key=${label}>
            <input type=${inputType} name="answer" id=${"opt-" + label} value=${label} checked=${chosenValues.includes(label)} />
            <label for=${"opt-" + label} style="margin:0">${label}</label>
          </div>
        `)}
      </fieldset>
    `;
  }
  return html`
    <fieldset>
      <legend>Your answer</legend>
      <div class="choice-row">
        <input type="radio" name="answer" id="opt-true" value="true" checked=${chosenValues.includes("true")} />
        <label for="opt-true" style="margin:0">True</label>
      </div>
      <div class="choice-row">
        <input type="radio" name="answer" id="opt-false" value="false" checked=${chosenValues.includes("false")} />
        <label for="opt-false" style="margin:0">False</label>
      </div>
    </fieldset>
  `;
}

function flagCheckbox(checked, label) {
  return html`
    <div class="choice-row">
      <input type="checkbox" id="flag-question" checked=${checked} />
      <label for="flag-question" style="margin:0">${label}</label>
    </div>
  `;
}

function renderNewWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "count") {
    return mount(html`
      <h1>${chapter.title} — new attempt</h1>
      <div class="card">
        <label for="q-count">How many questions in this chapter?</label>
        <input id="q-count" type="number" min="1" max="200" value="20" />
        <div class="btn-row"><button type="button" class="primary" onClick=${startNewWizardQuestions}>Begin</button></div>
      </div>
    `);
  }

  if (Wizard.stage === "flagged-review") return renderNewFlaggedReview(bookId, chapterId, chapter);
  if (Wizard.stage === "reviewing-one") return renderNewReviewOne(bookId, chapterId, chapter);

  const i = Wizard.index;
  const type = Wizard.currentType;
  const config = Wizard.currentConfig;
  const isLast = i === Wizard.total - 1;
  const pendingChosen = Wizard.pendingChosen || [];
  const flaggedSoFar = Wizard.draftAnswers.filter((a) => a.flagged).length;

  const configHtml = type === "mcq" ? html`
    <label for="opt-count">Number of options</label>
    <input id="opt-count" type="number" min="2" max="8" value=${config.optionLabels.length} onChange=${(e) => wizardUpdateOptionCount(e.target.value)} />
    <div class="choice-row">
      <input id="multi-select" type="checkbox" checked=${config.multiSelect} onChange=${(e) => wizardUpdateMultiSelect(e.target.checked)} />
      <label for="multi-select" style="margin:0">Allow selecting more than one option</label>
    </div>
  ` : null;

  mount(html`
    <h1>${chapter.title}</h1>
    <p class="wizard-progress">Question ${i + 1} of ${Wizard.total}${flaggedSoFar > 0 ? ` · ${flaggedSoFar} flagged` : ""}</p>
    <div class="card">
      <label for="q-type">Question type</label>
      <select id="q-type" onChange=${(e) => wizardUpdateType(e.target.value)}>
        <option value="mcq" selected=${type === "mcq"}>Multiple choice</option>
        <option value="truefalse" selected=${type === "truefalse"}>True / False</option>
      </select>
      ${configHtml}
      ${renderAnswerFieldset(type, config, pendingChosen)}
      ${flagCheckbox(Wizard.pendingFlagged, "Not sure yet — flag this question to review before submitting")}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        ${i > 0 ? html`<button type="button" onClick=${wizardGoBack}>Previous question</button>` : null}
        <button type="button" class="primary" onClick=${() => wizardCommitQuestion(isLast)}>${isLast ? "Finish attempt" : "Next question"}</button>
      </div>
    </div>
  `);
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

  const items = flaggedIdx.map((idx) => html`
    <li class="flagged-item" key=${idx}>
      <button type="button" onClick=${() => reviewNewFlaggedQuestion(idx)}>Question ${idx + 1}</button>
      <span class="card-meta">${formatChosenSummary(Wizard.draftAnswers[idx].chosen)}</span>
    </li>
  `);

  mount(html`
    <h1>${chapter.title}</h1>
    <div class="card">
      <h2>${flaggedIdx.length} question(s) flagged for review</h2>
      <p>Take another look before submitting, or submit as-is.</p>
      <ul class="flagged-list">${items.length ? items : html`<li>None left — you're all set.</li>`}</ul>
      <div class="btn-row"><button type="button" class="primary" onClick=${finishNewAttempt}>Submit attempt</button></div>
    </div>
  `);
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

  mount(html`
    <h1>${chapter.title}</h1>
    <p class="wizard-progress">Reviewing question ${idx + 1}</p>
    <div class="card">
      ${renderAnswerFieldset(q.type, q.config, a.chosen)}
      ${flagCheckbox(a.flagged, "Still not sure — keep this question flagged")}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        <button type="button" class="primary" onClick=${saveNewReviewedQuestion}>Save and return to flagged list</button>
      </div>
    </div>
  `);
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

  mount(html`
    <h1>${chapter.title} — retake</h1>
    <p class="wizard-progress">Question ${i + 1} of ${chapter.questionOrder.length}${flaggedSoFar > 0 ? ` · ${flaggedSoFar} flagged` : ""}</p>
    <div class="card">
      ${renderAnswerFieldset(question.type, question.config, priorEntry.chosen)}
      ${flagCheckbox(priorEntry.flagged, "Not sure yet — flag this question to review before submitting")}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        ${i > 0 ? html`<button type="button" onClick=${retakeGoBack}>Previous question</button>` : null}
        <button type="button" class="primary" onClick=${() => retakeCommitQuestion(questionId, isLast)}>${isLast ? "Finish attempt" : "Next question"}</button>
      </div>
    </div>
  `);
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
    return html`
      <li class="flagged-item" key=${qid}>
        <button type="button" onClick=${() => reviewRetakeFlaggedQuestion(qid)}>Question ${num}</button>
        <span class="card-meta">${formatChosenSummary(Wizard.responses[qid].chosen)}</span>
      </li>
    `;
  });

  mount(html`
    <h1>${chapter.title} — retake</h1>
    <div class="card">
      <h2>${flaggedQids.length} question(s) flagged for review</h2>
      <p>Take another look before submitting, or submit as-is.</p>
      <ul class="flagged-list">${items.length ? items : html`<li>None left — you're all set.</li>`}</ul>
      <div class="btn-row"><button type="button" class="primary" onClick=${finishRetakeAttempt}>Submit attempt</button></div>
    </div>
  `);
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

  mount(html`
    <h1>${chapter.title} — retake</h1>
    <p class="wizard-progress">Reviewing question ${num}</p>
    <div class="card">
      ${renderAnswerFieldset(question.type, question.config, entry.chosen)}
      ${flagCheckbox(entry.flagged, "Still not sure — keep this question flagged")}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        <button type="button" class="primary" onClick=${saveRetakeReviewedQuestion}>Save and return to flagged list</button>
      </div>
    </div>
  `);
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

function renderReview(bookId, chapterId, attemptId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const attempt = Store.attempts.find((a) => a.id === attemptId);
  if (!chapter || !attempt) return mount(html`<p>Not found.</p>`);

  const rows = attempt.responses.map((response, idx) => {
    const question = Store.questions.find((q) => q.id === response.questionId);
    const chosenLabel = response.chosen.length
      ? response.chosen.map(formatAnswerValue).join(", ") + (response.flagged ? " (flagged)" : "")
      : (response.flagged ? "Flagged — no answer given" : "(no answer)");

    let correctInput;
    if (question.type === "mcq") {
      const inputType = question.config.multiSelect ? "checkbox" : "radio";
      correctInput = question.config.optionLabels.map((label) => {
        const checked = question.correctAnswer && question.correctAnswer.includes(label);
        return html`
          <div class="choice-row" key=${label}>
            <input type=${inputType} name=${"correct-" + question.id} id=${"correct-" + question.id + "-" + label} value=${label} checked=${checked} />
            <label for=${"correct-" + question.id + "-" + label} style="margin:0">${label}</label>
          </div>
        `;
      });
    } else {
      const trueChecked = question.correctAnswer && question.correctAnswer.includes("true");
      const falseChecked = question.correctAnswer && question.correctAnswer.includes("false");
      correctInput = html`
        <div class="choice-row">
          <input type="radio" name=${"correct-" + question.id} id=${"correct-" + question.id + "-true"} value="true" checked=${trueChecked} />
          <label for=${"correct-" + question.id + "-true"} style="margin:0">True</label>
        </div>
        <div class="choice-row">
          <input type="radio" name=${"correct-" + question.id} id=${"correct-" + question.id + "-false"} value="false" checked=${falseChecked} />
          <label for=${"correct-" + question.id + "-false"} style="margin:0">False</label>
        </div>
      `;
    }

    const statusClass = response.correct === null ? "status-ungraded" : response.correct ? "status-correct" : "status-incorrect";
    const statusText = response.correct === null ? "Ungraded" : response.correct ? "Correct" : "Incorrect";

    return html`
      <div class="card" key=${response.questionId}>
        <h3>Question ${idx + 1}</h3>
        <p>Your answer: <strong>${chosenLabel}</strong> — <span class=${statusClass}>${statusText}</span></p>
        <fieldset><legend>Correct answer</legend>${correctInput}</fieldset>
        <button type="button" onClick=${() => saveCorrectAnswer(question.id, bookId, chapterId, attemptId)}>Save correct answer</button>
      </div>
    `;
  });

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>Review & grade</h1>
    <p>Lock in the correct answer for each question. Editing a correct answer later will re-grade every past attempt for that question.</p>
    ${rows}
  `);
}

function saveCorrectAnswer(questionId, bookId, chapterId, attemptId) {
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
  if (!chapter) return mount(html`<p>Not found.</p>`);

  const chapterSeries = computeChapterTrend(Store, chapterId);
  const weakest = weakestQuestions(Store, chapterId, 5);
  const anyGraded = chapter.questionOrder.some((qid) =>
    computeQuestionTrend(Store, qid).sequence.some((s) => s.correct !== null)
  );

  const weakestRows = weakest.map((w) => html`
    <tr key=${w.questionId}><td>Question ${w.questionNumber}</td><td>${Math.round(w.incorrectRate * 100)}%</td><td>${w.gradedCount}</td></tr>
  `);

  const questionRows = chapter.questionOrder.map((qid, idx) => {
    const trend = computeQuestionTrend(Store, qid);
    const seq = trend.sequence.length
      ? trend.sequence.map((s) => (s.correct === null ? "–" : s.correct ? "✓" : "✗")).join(" ")
      : "No attempts";
    return html`<tr key=${qid}><td>Question ${idx + 1}</td><td>${seq}</td></tr>`;
  });

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>Trends: ${chapter.title}</h1>
    ${chapterSeries.length ? html`<div class="card"><h2>Score over time</h2>${renderScoreLineChart(chapterSeries)}</div>` : null}
    <div class="card">
      <h2>Weakest questions</h2>
      ${weakestRows.length
        ? html`<div class="table-wrap"><table><thead><tr><th>Question</th><th>Incorrect rate</th><th>Graded attempts</th></tr></thead><tbody>${weakestRows}</tbody></table></div>`
        : anyGraded
          ? html`<p>No incorrect answers yet — nice work!</p>`
          : html`<p>Not enough graded attempts yet.</p>`}
    </div>
    <div class="card">
      <h2>Per-question history</h2>
      <div class="table-wrap"><table><thead><tr><th>Question</th><th>Attempt sequence</th></tr></thead><tbody>${questionRows}</tbody></table></div>
    </div>
  `);
}

/* ---------- Print trigger ---------- */

function renderPrintTrigger(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount(html`<p>Not found.</p>`);
  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>Print: ${chapter.title}</h1>
    <p>Click print, then choose "Save as PDF" in the print dialog.</p>
    <div class="btn-row"><button type="button" class="primary" onClick=${() => triggerPrint(chapterId)}>Print</button></div>
  `);
  buildPrintView(chapterId);
}

function triggerPrint(chapterId) {
  buildPrintView(chapterId);
  window.print();
}

window.render = render;
