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
