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
        response.correct = gradeResponse(response.chosen, correctAnswer);
      }
    });
  });
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
  attempts.forEach((attempt) => {
    const response = attempt.responses.find((r) => r.questionId === questionId);
    if (response) {
      sequence.push({ attemptId: attempt.id, date: attempt.finishedAt, correct: response.correct });
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
    const graded = attempt.responses.filter((r) => r.correct !== null);
    const correctCount = graded.filter((r) => r.correct === true).length;
    const scorePercent = graded.length ? Math.round((correctCount / graded.length) * 100) : null;
    return {
      attemptId: attempt.id,
      date: attempt.finishedAt,
      scorePercent,
      gradedCount: graded.length,
      totalCount: attempt.responses.length,
    };
  });
  return series;
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
    .filter((s) => s.gradedCount > 0)
    .sort((a, b) => b.incorrectRate - a.incorrectRate)
    .slice(0, n);
}
