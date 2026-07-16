/* Central store, persistence, and mutation functions. No DOM rendering here. */

const APP_VERSION = "v0.1.0";

const STORAGE_KEY = "answerpaper.store.v1";

function emptyStore() {
  return { version: 1, books: [], chapters: [], questions: [], attempts: [] };
}

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.books)) {
      return emptyStore();
    }
    return Object.assign(emptyStore(), parsed);
  } catch (e) {
    return emptyStore();
  }
}

let Store = loadStore();

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Store));
}

function allDataCounts() {
  return {
    bookCount: Store.books.length,
    chapterCount: Store.chapters.length,
    attemptCount: Store.attempts.length,
  };
}

function resetStore() {
  Store = emptyStore();
  saveStore();
}

/* ---------- Books ---------- */

function addBook(title) {
  const book = { id: uid("b"), title: title.trim(), createdAt: new Date().toISOString() };
  Store.books.push(book);
  saveStore();
  return book;
}

function renameBook(bookId, title) {
  const book = Store.books.find((b) => b.id === bookId);
  if (book) {
    book.title = title.trim();
    saveStore();
  }
}

function bookCascadeCounts(bookId) {
  const chapters = Store.chapters.filter((c) => c.bookId === bookId);
  const chapterIds = new Set(chapters.map((c) => c.id));
  const attempts = Store.attempts.filter((a) => chapterIds.has(a.chapterId));
  return { chapterCount: chapters.length, attemptCount: attempts.length };
}

function deleteBook(bookId) {
  const chapterIds = new Set(Store.chapters.filter((c) => c.bookId === bookId).map((c) => c.id));
  Store.attempts = Store.attempts.filter((a) => !chapterIds.has(a.chapterId));
  Store.questions = Store.questions.filter((q) => !chapterIds.has(q.chapterId));
  Store.chapters = Store.chapters.filter((c) => c.bookId !== bookId);
  Store.books = Store.books.filter((b) => b.id !== bookId);
  saveStore();
}

/* ---------- Chapters ---------- */

function addChapter(bookId, title) {
  const chapter = {
    id: uid("c"),
    bookId,
    title: title.trim(),
    questionOrder: [],
    createdAt: new Date().toISOString(),
  };
  Store.chapters.push(chapter);
  saveStore();
  return chapter;
}

function renameChapter(chapterId, title) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (chapter) {
    chapter.title = title.trim();
    saveStore();
  }
}

function chapterCascadeCounts(chapterId) {
  const attempts = Store.attempts.filter((a) => a.chapterId === chapterId);
  const questions = Store.questions.filter((q) => q.chapterId === chapterId);
  return { attemptCount: attempts.length, questionCount: questions.length };
}

function deleteChapter(chapterId) {
  Store.attempts = Store.attempts.filter((a) => a.chapterId !== chapterId);
  Store.questions = Store.questions.filter((q) => q.chapterId !== chapterId);
  Store.chapters = Store.chapters.filter((c) => c.id !== chapterId);
  saveStore();
}

/* ---------- Attempts ---------- */

function commitNewAttempt(chapterId, questionDefs, answers) {
  // questionDefs: [{type, config}], answers: [{chosen: [...], flagged}], same order/length
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const questionIds = [];
  questionDefs.forEach((def) => {
    const question = {
      id: uid("q"),
      chapterId,
      type: def.type,
      config: def.config,
      correctAnswer: null,
    };
    Store.questions.push(question);
    questionIds.push(question.id);
  });
  chapter.questionOrder = questionIds;

  const attempt = {
    id: uid("a"),
    chapterId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    responses: questionIds.map((qid, i) => ({
      questionId: qid,
      chosen: answers[i].chosen,
      flagged: !!answers[i].flagged,
      correct: null,
    })),
  };
  Store.attempts.push(attempt);
  saveStore();
  return attempt;
}

function commitRetakeAttempt(chapterId, responsesByQuestionId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const responses = chapter.questionOrder.map((qid) => {
    const question = Store.questions.find((q) => q.id === qid);
    const entry = responsesByQuestionId[qid] || { chosen: [], flagged: false };
    const correct = entry.chosen.length === 0 ? null : gradeResponse(entry.chosen, question.correctAnswer);
    return { questionId: qid, chosen: entry.chosen, flagged: !!entry.flagged, correct };
  });
  const attempt = {
    id: uid("a"),
    chapterId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    responses,
  };
  Store.attempts.push(attempt);
  saveStore();
  return attempt;
}

function applyCorrectAnswer(questionId, correctAnswer) {
  setCorrectAnswer(Store, questionId, correctAnswer);
  saveStore();
}

/* ---------- Question management ---------- */

function addQuestionToChapter(chapterId, type, config) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const question = { id: uid("q"), chapterId, type, config, correctAnswer: null };
  Store.questions.push(question);
  chapter.questionOrder.push(question.id);
  saveStore();
  return question;
}

function questionCascadeCounts(chapterId, questionId) {
  const attempts = Store.attempts.filter((a) => a.chapterId === chapterId && a.responses.some((r) => r.questionId === questionId));
  return { attemptCount: attempts.length };
}

function deleteQuestion(chapterId, questionId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  chapter.questionOrder = chapter.questionOrder.filter((qid) => qid !== questionId);
  Store.questions = Store.questions.filter((q) => q.id !== questionId);
  Store.attempts.forEach((attempt) => {
    if (attempt.chapterId !== chapterId) return;
    attempt.responses = attempt.responses.filter((r) => r.questionId !== questionId);
  });
  saveStore();
}

function reorderQuestion(chapterId, questionId, direction) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const order = chapter.questionOrder;
  const idx = order.indexOf(questionId);
  const swapWith = idx + direction;
  if (idx < 0 || swapWith < 0 || swapWith >= order.length) return;
  [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
  saveStore();
}

/* ---------- Export / Import ---------- */

function exportData() {
  const blob = new Blob([JSON.stringify(Store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = "answerpaper-export-" + stamp + ".json";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Exported " + filename);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function importData(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.books)) {
        throw new Error("Invalid file format");
      }
      Store = Object.assign(emptyStore(), parsed);
      saveStore();
      onDone(null);
    } catch (e) {
      onDone(e);
    }
  };
  reader.onerror = () => onDone(reader.error);
  reader.readAsText(file);
}

/* ---------- Sample data ---------- */

function backdateAttempt(attempt, daysAgo) {
  const iso = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  attempt.startedAt = iso;
  attempt.finishedAt = iso;
  saveStore();
}

function loadSampleData() {
  const book = addBook("Introduction to Psychology");

  const ch1 = addChapter(book.id, "Chapter 1: Foundations of Psychology");
  const ch1Defs = [
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "truefalse", config: {} },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D", "E"], multiSelect: true } },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
  ];
  const attempt1 = commitNewAttempt(ch1.id, ch1Defs, [
    { chosen: ["A"], flagged: false },
    { chosen: ["A"], flagged: false },
    { chosen: ["false"], flagged: false },
    { chosen: ["A"], flagged: false },
    { chosen: ["B"], flagged: false },
  ]);
  backdateAttempt(attempt1, 14);

  const [q1, q2, q3, q4] = ch1.questionOrder;
  applyCorrectAnswer(q1, ["B"]);
  applyCorrectAnswer(q2, ["A"]);
  applyCorrectAnswer(q3, ["true"]);
  applyCorrectAnswer(q4, ["A", "C"]);
  // Q5's correct answer is deliberately left unset, showing a permanently
  // ungraded question, which happens in real usage.
  const q5 = ch1.questionOrder[4];

  const attempt2 = commitRetakeAttempt(ch1.id, {
    [q1]: { chosen: ["B"], flagged: false },
    [q2]: { chosen: ["A"], flagged: false },
    [q3]: { chosen: ["true"], flagged: false },
    [q4]: { chosen: ["A"], flagged: false },
    [q5]: { chosen: [], flagged: true },
  });
  backdateAttempt(attempt2, 7);

  const attempt3 = commitRetakeAttempt(ch1.id, {
    [q1]: { chosen: ["B"], flagged: false },
    [q2]: { chosen: ["A"], flagged: false },
    [q3]: { chosen: ["true"], flagged: false },
    [q4]: { chosen: ["A", "C"], flagged: false },
    [q5]: { chosen: [], flagged: true },
  });
  backdateAttempt(attempt3, 0);

  const ch2 = addChapter(book.id, "Chapter 2: Learning & Memory");
  const ch2Defs = [
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "truefalse", config: {} },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
  ];
  const ch2Attempt = commitNewAttempt(ch2.id, ch2Defs, [
    { chosen: ["C"], flagged: false },
    { chosen: [], flagged: true },
    { chosen: ["true"], flagged: false },
    { chosen: ["A"], flagged: false },
  ]);
  backdateAttempt(ch2Attempt, 3);

  const [r1, r2, r3] = ch2.questionOrder;
  applyCorrectAnswer(r1, ["C"]);
  applyCorrectAnswer(r2, ["B"]);
  applyCorrectAnswer(r3, ["true"]);
  // r4 (Learning & Memory Q4) is deliberately left ungraded too.

  // "Calculus I" — a book with a chapter that's been created but not yet
  // attempted, showing the freshest possible state.
  const calcBook = addBook("Calculus I");
  addChapter(calcBook.id, "Chapter 1: Limits and Continuity");

  // "World History: Modern Era" — a single attempt, fully graded right
  // away (no ungraded/unanswered questions), showing "View / edit answers".
  const historyBook = addBook("World History: Modern Era");
  const historyCh = addChapter(historyBook.id, "Chapter 3: The Cold War");
  const historyDefs = [
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "truefalse", config: {} },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
  ];
  const historyAttempt = commitNewAttempt(historyCh.id, historyDefs, [
    { chosen: ["C"], flagged: false },
    { chosen: ["B"], flagged: false },
    { chosen: ["true"], flagged: false },
    { chosen: ["D"], flagged: false },
  ]);
  backdateAttempt(historyAttempt, 5);
  const [h1, h2, h3, h4] = historyCh.questionOrder;
  applyCorrectAnswer(h1, ["C"]);
  applyCorrectAnswer(h2, ["B"]);
  applyCorrectAnswer(h3, ["true"]);
  applyCorrectAnswer(h4, ["D"]);

  // "Organic Chemistry" — three fully-graded retakes with a wavy (not just
  // improving) trend line: 50% -> 100% -> 75%.
  const chemBook = addBook("Organic Chemistry");
  const chemCh = addChapter(chemBook.id, "Chapter 2: Alkenes & Alkynes");
  const chemDefs = [
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
  ];
  const chemAttempt1 = commitNewAttempt(chemCh.id, chemDefs, [
    { chosen: ["B"], flagged: false },
    { chosen: ["B"], flagged: false },
    { chosen: ["C"], flagged: false },
    { chosen: ["A"], flagged: false },
  ]);
  backdateAttempt(chemAttempt1, 12);
  const [c1, c2, c3, c4] = chemCh.questionOrder;
  applyCorrectAnswer(c1, ["B"]);
  applyCorrectAnswer(c2, ["A"]);
  applyCorrectAnswer(c3, ["C"]);
  applyCorrectAnswer(c4, ["D"]);

  const chemAttempt2 = commitRetakeAttempt(chemCh.id, {
    [c1]: { chosen: ["B"], flagged: false },
    [c2]: { chosen: ["A"], flagged: false },
    [c3]: { chosen: ["C"], flagged: false },
    [c4]: { chosen: ["D"], flagged: false },
  });
  backdateAttempt(chemAttempt2, 6);

  const chemAttempt3 = commitRetakeAttempt(chemCh.id, {
    [c1]: { chosen: ["B"], flagged: false },
    [c2]: { chosen: ["A"], flagged: false },
    [c3]: { chosen: ["D"], flagged: false },
    [c4]: { chosen: ["D"], flagged: false },
  });
  backdateAttempt(chemAttempt3, 1);

  // "Spanish Vocabulary" — a mostly true/false chapter, one attempt,
  // fully correct, with a flag left on a question the user still nailed.
  const spanishBook = addBook("Spanish Vocabulary");
  const spanishCh = addChapter(spanishBook.id, "Chapter 1: Common Verbs");
  const spanishDefs = [
    { type: "truefalse", config: {} },
    { type: "truefalse", config: {} },
    { type: "mcq", config: { optionLabels: ["A", "B", "C", "D"], multiSelect: false } },
  ];
  const spanishAttempt = commitNewAttempt(spanishCh.id, spanishDefs, [
    { chosen: ["true"], flagged: false },
    { chosen: ["false"], flagged: true },
    { chosen: ["B"], flagged: false },
  ]);
  backdateAttempt(spanishAttempt, 2);
  const [s1, s2, s3] = spanishCh.questionOrder;
  applyCorrectAnswer(s1, ["true"]);
  applyCorrectAnswer(s2, ["false"]);
  applyCorrectAnswer(s3, ["B"]);

  navigate("/books");
  render();
}

/* ---------- Router ---------- */

function currentRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  return parts;
}

function navigate(hash) {
  location.hash = hash;
}

window.addEventListener("beforeunload", (e) => {
  if (typeof wizardHasProgress === "function" && wizardHasProgress()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

window.addEventListener("hashchange", () => render());
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("version-tag").textContent = APP_VERSION;
  document.getElementById("export-btn").addEventListener("click", exportData);
  document.getElementById("import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const summary = { books: Store.books.length, chapters: Store.chapters.length, attempts: Store.attempts.length };
    const ok = confirm(
      "Importing will replace your current data (" +
        pluralize(summary.books, "book") + ", " + pluralize(summary.chapters, "chapter") +
        ", " + pluralize(summary.attempts, "attempt") + "). Continue?"
    );
    if (!ok) {
      e.target.value = "";
      return;
    }
    importData(file, (err) => {
      e.target.value = "";
      if (err) {
        alert("Import failed: " + err.message);
        return;
      }
      navigate("/");
      render();
    });
  });
  render();
});
