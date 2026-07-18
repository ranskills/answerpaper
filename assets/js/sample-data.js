/* Demo fixture data ("Load sample data"). Depends on the mutation functions
   in app.js and calls navigate()/render() at the end, so must load after
   app.js and render.js. No DOM access beyond that. */

function backdateAttempt(attempt, daysAgo, durationMinutes) {
  const finished = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  attempt.finishedAt = new Date(finished).toISOString();
  attempt.startedAt = new Date(finished - (durationMinutes || 0) * 60 * 1000).toISOString();
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
  backdateAttempt(attempt1, 14, 9);

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
  backdateAttempt(attempt2, 7, 6);

  const attempt3 = commitRetakeAttempt(ch1.id, {
    [q1]: { chosen: ["B"], flagged: false },
    [q2]: { chosen: ["A"], flagged: false },
    [q3]: { chosen: ["true"], flagged: false },
    [q4]: { chosen: ["A", "C"], flagged: false },
    [q5]: { chosen: [], flagged: true },
  });
  backdateAttempt(attempt3, 0, 5);

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
  backdateAttempt(ch2Attempt, 3, 7);

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
  // Archived afterwards, showing what an archived book looks like.
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
  backdateAttempt(historyAttempt, 5, 8);
  const [h1, h2, h3, h4] = historyCh.questionOrder;
  applyCorrectAnswer(h1, ["C"]);
  applyCorrectAnswer(h2, ["B"]);
  applyCorrectAnswer(h3, ["true"]);
  applyCorrectAnswer(h4, ["D"]);
  archiveBook(historyBook.id);

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
  backdateAttempt(chemAttempt1, 12, 11);
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
  backdateAttempt(chemAttempt2, 6, 6);

  const chemAttempt3 = commitRetakeAttempt(chemCh.id, {
    [c1]: { chosen: ["B"], flagged: false },
    [c2]: { chosen: ["A"], flagged: false },
    [c3]: { chosen: ["D"], flagged: false },
    [c4]: { chosen: ["D"], flagged: false },
  });
  backdateAttempt(chemAttempt3, 1, 4);

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
  backdateAttempt(spanishAttempt, 2, 3);
  const [s1, s2, s3] = spanishCh.questionOrder;
  applyCorrectAnswer(s1, ["true"]);
  applyCorrectAnswer(s2, ["false"]);
  applyCorrectAnswer(s3, ["B"]);

  navigate("/books");
  render();
}
