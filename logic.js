/* Pure functions: grading, regrading, trend computation. No DOM access. */

function sameSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

function gradeResponse(chosen, correctAnswer) {
  if (correctAnswer === null || correctAnswer === undefined) return null;
  return sameSet(chosen, correctAnswer);
}

function setCorrectAnswer(store, questionId, correctAnswer) {
  const question = store.questions.find((q) => q.id === questionId);
  if (!question) return;
  question.correctAnswer = correctAnswer;
  store.attempts.forEach((attempt) => {
    attempt.responses.forEach((response) => {
      if (response.questionId === questionId) {
        response.correct = response.chosen.length === 0 ? null : gradeResponse(response.chosen, correctAnswer);
      }
    });
  });
}

function computeAttemptScore(store, attempt) {
  let lockedCount = 0, correctCount = 0, unansweredCount = 0, trulyUngradedCount = 0;
  attempt.responses.forEach((response) => {
    const question = store.questions.find((q) => q.id === response.questionId);
    if (!question || question.correctAnswer === null || question.correctAnswer === undefined) {
      trulyUngradedCount += 1;
      return;
    }
    lockedCount += 1;
    if (response.chosen.length === 0) {
      unansweredCount += 1;
      return;
    }
    if (response.correct) correctCount += 1;
  });
  return {
    lockedCount,
    correctCount,
    unansweredCount,
    trulyUngradedCount,
    totalCount: attempt.responses.length,
    scorePercent: lockedCount ? Math.round((correctCount / lockedCount) * 100) : null,
  };
}

function attemptsForChapter(store, chapterId) {
  return store.attempts
    .filter((a) => a.chapterId === chapterId)
    .slice()
    .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));
}

function computeQuestionTrend(store, questionId) {
  const question = store.questions.find((q) => q.id === questionId);
  if (!question) return { sequence: [], firstAttemptCorrect: null, mostRecentCorrect: null };
  const attempts = attemptsForChapter(store, question.chapterId);
  const sequence = [];
  const isLocked = question.correctAnswer !== null && question.correctAnswer !== undefined;
  attempts.forEach((attempt) => {
    const response = attempt.responses.find((r) => r.questionId === questionId);
    if (response) {
      const unanswered = response.chosen.length === 0;
      const correct = isLocked && unanswered ? false : response.correct;
      sequence.push({ attemptId: attempt.id, date: attempt.finishedAt, correct, unanswered });
    }
  });
  return {
    sequence,
    firstAttemptCorrect: sequence.length ? sequence[0].correct : null,
    mostRecentCorrect: sequence.length ? sequence[sequence.length - 1].correct : null,
  };
}

function computeChapterTrend(store, chapterId) {
  const attempts = attemptsForChapter(store, chapterId);
  const series = attempts.map((attempt) => {
    const score = computeAttemptScore(store, attempt);
    return {
      attemptId: attempt.id,
      date: attempt.finishedAt,
      scorePercent: score.scorePercent,
      gradedCount: score.lockedCount,
      totalCount: attempt.responses.length,
      unansweredCount: score.unansweredCount,
      trulyUngradedCount: score.trulyUngradedCount,
    };
  });
  return series;
}

function chapterLastActivity(store, chapterId) {
  const chapter = store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  let latest = chapter.createdAt;
  store.attempts.forEach((a) => {
    if (a.chapterId === chapterId && new Date(a.finishedAt) > new Date(latest)) latest = a.finishedAt;
  });
  return latest;
}

function bookLastActivity(store, bookId) {
  const book = store.books.find((b) => b.id === bookId);
  if (!book) return null;
  let latest = book.createdAt;
  store.chapters.forEach((c) => {
    if (c.bookId !== bookId) return;
    const chapterActivity = chapterLastActivity(store, c.id);
    if (chapterActivity && new Date(chapterActivity) > new Date(latest)) latest = chapterActivity;
  });
  return latest;
}

function weakestQuestions(store, chapterId, n) {
  const chapter = store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return [];
  const stats = chapter.questionOrder.map((qid, idx) => {
    const trend = computeQuestionTrend(store, qid);
    const graded = trend.sequence.filter((s) => s.correct !== null);
    const incorrectCount = graded.filter((s) => s.correct === false).length;
    const incorrectRate = graded.length ? incorrectCount / graded.length : 0;
    return { questionId: qid, questionNumber: idx + 1, incorrectRate, gradedCount: graded.length };
  });
  return stats
    .filter((s) => s.gradedCount > 0 && s.incorrectRate > 0)
    .sort((a, b) => b.incorrectRate - a.incorrectRate)
    .slice(0, n);
}

// Home dashboard stat tiles. Archived books are excluded from the book/chapter
// counts (they're retired), but their attempts still count toward lifetime
// totals like attempt count, average score, and time studied.
// Deliberately just sums (book/attempt counts, time studied) — no
// cross-chapter score average, since averaging scores across unrelated
// subjects doesn't mean anything a user could act on.
function localDateKey(iso) {
  const d = new Date(iso);
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}

// Consecutive calendar days (local time) with at least one finished attempt,
// counting back from today. Today doesn't have to have an attempt yet for the
// streak to still be "alive" — it only breaks once a full day is skipped.
function computeStudyStreak(store, now) {
  now = now || new Date();
  const activeDates = new Set(store.attempts.map((a) => localDateKey(a.finishedAt)));
  if (activeDates.size === 0) return 0;

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeDates.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDates.has(localDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (activeDates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeOverallStats(store, now) {
  const activeBookIds = new Set(store.books.filter((b) => !b.archived).map((b) => b.id));
  const activeChapterCount = store.chapters.filter((c) => activeBookIds.has(c.bookId)).length;

  let totalMs = 0;
  store.attempts.forEach((attempt) => {
    const ms = new Date(attempt.finishedAt) - new Date(attempt.startedAt);
    if (Number.isFinite(ms) && ms > 0) totalMs += ms;
  });

  return {
    bookCount: activeBookIds.size,
    chapterCount: activeChapterCount,
    attemptCount: store.attempts.length,
    totalStudyMinutes: Math.round(totalMs / 60000),
    streakDays: computeStudyStreak(store, now),
  };
}

// Chapters worth surfacing on Home: ones created but never attempted, ones
// with an ungraded latest attempt, or ones whose latest attempt has a
// question the user flagged "not sure" about and got wrong (the flag was
// warranted). Archived books are excluded — they're retired, not neglected.
// Each chapter surfaces at most one reason, in that priority order, so it
// doesn't show up twice for two different reasons at once.
function computeNeedsAttention(store, limit) {
  const activeBookIds = new Set(store.books.filter((b) => !b.archived).map((b) => b.id));
  const items = [];

  store.chapters.forEach((chapter) => {
    if (!activeBookIds.has(chapter.bookId)) return;
    const book = store.books.find((b) => b.id === chapter.bookId);

    if (chapter.questionOrder.length === 0) {
      items.push({ type: "not-started", book, chapter, sortDate: chapter.createdAt });
      return;
    }

    const attempts = attemptsForChapter(store, chapter.id);
    if (!attempts.length) return;
    const latest = attempts[attempts.length - 1];
    const score = computeAttemptScore(store, latest);

    if (score.trulyUngradedCount > 0) {
      items.push({
        type: "ungraded",
        book, chapter,
        attemptId: latest.id,
        ungradedCount: score.trulyUngradedCount,
        sortDate: latest.finishedAt,
      });
      return;
    }

    const flaggedWrongCount = latest.responses.filter((r) => r.flagged && r.correct === false).length;
    if (flaggedWrongCount > 0) {
      items.push({
        type: "flagged",
        book, chapter,
        attemptId: latest.id,
        flaggedWrongCount,
        sortDate: latest.finishedAt,
      });
    }
  });

  items.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
  return typeof limit === "number" ? items.slice(0, limit) : items;
}
