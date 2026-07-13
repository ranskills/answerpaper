/* Central store, persistence, and mutation functions. No DOM rendering here. */

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
  // questionDefs: [{type, config}], answers: [{chosen: [...]}], same order/length
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
      correct: null,
    })),
  };
  Store.attempts.push(attempt);
  saveStore();
  return attempt;
}

function commitRetakeAttempt(chapterId, chosenByQuestionId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const responses = chapter.questionOrder.map((qid) => {
    const question = Store.questions.find((q) => q.id === qid);
    const chosen = chosenByQuestionId[qid] || [];
    return { questionId: qid, chosen, correct: gradeResponse(chosen, question.correctAnswer) };
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

/* ---------- Export / Import ---------- */

function exportData() {
  const blob = new Blob([JSON.stringify(Store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = "answerpaper-export-" + stamp + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

/* ---------- Router ---------- */

function currentRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  return parts;
}

function navigate(hash) {
  location.hash = hash;
}

window.addEventListener("hashchange", () => render());
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("export-btn").addEventListener("click", exportData);
  document.getElementById("import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const summary = { books: Store.books.length, chapters: Store.chapters.length, attempts: Store.attempts.length };
    const ok = confirm(
      "Importing will replace your current data (" +
        summary.books + " book(s), " + summary.chapters + " chapter(s), " +
        summary.attempts + " attempt(s)). Continue?"
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
