/* Central store, persistence, and mutation functions. No DOM rendering here. */

const APP_VERSION = "v0.1.0";

const STORAGE_KEY = "answerpaper.store.v1";
const THEME_KEY = "answerpaper.theme";
const LAST_EXPORT_KEY = "answerpaper.lastExport";
const WIZARD_DRAFT_KEY = "answerpaper.wizardDraft.v1";

/* ---------- Theme ---------- */

// null/absent means "follow the system" (prefers-color-scheme); index.html
// applies any stored override synchronously, before first paint, to avoid a
// flash of the wrong theme.
function getStoredTheme() {
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" ? t : null;
}

function setTheme(theme) {
  if (theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    localStorage.removeItem(THEME_KEY);
    document.documentElement.removeAttribute("data-theme");
  }
  updateThemeToggleButton();
}

function cycleTheme() {
  const current = getStoredTheme();
  setTheme(current === null ? "light" : current === "light" ? "dark" : null);
}

function updateThemeToggleButton() {
  const btn = document.getElementById("theme-toggle");
  const current = getStoredTheme();
  const label =
    current === "light" ? t("theme.light") : current === "dark" ? t("theme.dark") : t("theme.auto");
  btn.textContent = t("theme.label", { mode: label });
}

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
  } catch {
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

function dataStorageBytes() {
  return new Blob([JSON.stringify(Store)]).size;
}

function resetStore() {
  Store = emptyStore();
  saveStore();
}

/* ---------- Wizard draft (in-progress attempt, survives reload) ---------- */

function saveWizardDraft(wizard) {
  localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(wizard));
}

function loadWizardDraft() {
  const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearWizardDraft() {
  localStorage.removeItem(WIZARD_DRAFT_KEY);
}

function wizardDraftExistsFor(chapterId) {
  const draft = loadWizardDraft();
  return !!draft && draft.chapterId === chapterId;
}

/* ---------- Books ---------- */

function addBook(title) {
  const book = {
    id: uid("b"),
    title: title.trim(),
    archived: false,
    createdAt: new Date().toISOString(),
  };
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

function archiveBook(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  if (book) {
    book.archived = true;
    saveStore();
  }
}

function unarchiveBook(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  if (book) {
    book.archived = false;
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

function commitNewAttempt(chapterId, questionDefs, answers, startedAt) {
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
    startedAt: startedAt || new Date().toISOString(),
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

function commitRetakeAttempt(chapterId, responsesByQuestionId, startedAt) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const responses = chapter.questionOrder.map((qid) => {
    const question = Store.questions.find((q) => q.id === qid);
    const entry = responsesByQuestionId[qid] || { chosen: [], flagged: false };
    const correct =
      entry.chosen.length === 0 ? null : gradeResponse(entry.chosen, question.correctAnswer);
    return { questionId: qid, chosen: entry.chosen, flagged: !!entry.flagged, correct };
  });
  const attempt = {
    id: uid("a"),
    chapterId,
    startedAt: startedAt || new Date().toISOString(),
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
  const attempts = Store.attempts.filter(
    (a) => a.chapterId === chapterId && a.responses.some((r) => r.questionId === questionId),
  );
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
  localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  showToast(t("data.exportedToast", { filename }));
}

function getLastExportAt() {
  return localStorage.getItem(LAST_EXPORT_KEY);
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
        throw new Error(t("data.invalidFileFormat"));
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
  updateThemeToggleButton();
  document.getElementById("theme-toggle").addEventListener("click", cycleTheme);
  render();
});
