/* i18n scaffold — English only for now. STRINGS is keyed by language so a
   future translation can be added back as a sibling of `en` without
   reshaping t()/tn() or the call sites. */

// Each leaf is either a plain string (with {name} placeholders) or, for
// count-sensitive strings, a { one, other } pair selected via Intl.PluralRules
// — not every language pluralizes the same way, so this shape (rather than a
// naive count===1 check) is what actually generalizes.
const STRINGS = {
  en: {
    home: {
      title: "Home",
      onboardingPre: "New here? The workflow is: create a",
      onboardingBook: "book",
      onboardingMid1: "→ add a",
      onboardingChapter: "chapter",
      onboardingMid2: "to it → take an",
      onboardingAttempt: "attempt",
      onboardingPost: "on the chapter → grade your answers → retake and track trends over time.",
      privacyNote:
        "Everything stays on this device — there's no account and nothing is sent to a server.",
      continueStudying: "Continue studying",
      lastAttempt: "Last attempt: {score} · {date}",
      retake: "Retake",
      viewTrends: "View trends",
      booksChapters: "Books / Chapters",
      attempts: { one: "Attempt", other: "Attempts" },
      dayStreak: "Day streak",
      timeStudied: "Time studied",
      needsAttention: "Needs attention",
      notStartedYet: "Not started yet",
      flaggedToReview: {
        one: "{count} flagged answer to review",
        other: "{count} flagged answers to review",
      },
      recentActivity: "Recent activity",
      colChapter: "Chapter",
      colDate: "Date",
      colScore: "Score",
      noAttemptsPre: "No attempts yet.",
      noAttemptsLink: "Start with your books",
      getStarted: "Get started",
      loadSampleData: "Load sample data",
    },
    common: {
      appName: "AnswerPaper",
      trueLabel: "True",
      falseLabel: "False",
      ungraded: "Ungraded",
      unansweredCount: "{count} unanswered",
      questionsNotGraded: {
        one: "{count} question not yet graded",
        other: "{count} questions not yet graded",
      },
      trendImproving: "↑ Improving",
      trendDeclining: "↓ Declining",
      trendSteady: "→ Steady",
      minutesLessThanOne: "< 1 min",
      minutesShort: "{minutes} min",
      hoursMinutes: "{hours}h {minutes}m",
      cancel: "Cancel",
      ok: "OK",
      save: "Save",
      delete: "Delete",
      rename: "Rename",
      archive: "Archive",
      unarchive: "Unarchive",
      loadSampleData: "Load sample data",
      sortHint: "Sorted by recent activity — most recently added or attempted first.",
      scoreOverTime: "Score over time",
      questionN: "Question {n}",
      notFound: "Not found.",
      goBack: "Go back",
      pageNotFound: "Page not found.",
      goHome: "Go home",
      skipToContent: "Skip to main content",
      primaryNavLabel: "Primary",
      book: { one: "{count} book", other: "{count} books" },
      chapter: { one: "{count} chapter", other: "{count} chapters" },
      attempt: { one: "{count} attempt", other: "{count} attempts" },
      question: { one: "{count} question", other: "{count} questions" },
      archivedBook: { one: "{count} archived book", other: "{count} archived books" },
      pastAttempt: { one: "{count} past attempt", other: "{count} past attempts" },
      flaggedQuestion: { one: "{count} flagged question", other: "{count} flagged questions" },
    },
    theme: {
      auto: "Auto",
      light: "Light",
      dark: "Dark",
      label: "Theme: {mode}",
    },
    books: {
      title: "Books",
      onboardingHint:
        "Start here: add a book, then add chapters to it, then take an attempt on a chapter to start practicing.",
      filterGroupLabel: "Filter books",
      filterAll: "All ({count})",
      filterActive: "Active ({count})",
      filterArchived: "Archived ({count})",
      renameBook: "Rename book",
      newBookTitle: "New book title",
      newBookPlaceholder: "e.g. Organic Chemistry",
      addBook: "Add book",
      addBookToggle: "+ Add book",
      archived: "Archived",
      noArchivedBooks: "No archived books.",
      noActiveBooks: "No active books — all books are archived.",
      noBooksYet: "No books yet.",
      confirmDeleteAll:
        "Delete ALL data — {books}, {chapters}, {attempts} total? This cannot be undone. Consider using Export first if you want a backup.",
      confirmDeleteBook:
        "Delete book '{title}' and all {chapters} ({attempts} total)? This cannot be undone.",
    },
    data: {
      title: "Data",
      emptyHint: "There's no data to manage yet.",
      dangerZone: "Danger zone",
      dangerHint:
        "Permanently erase all books, chapters, questions, and attempts from this browser. This cannot be undone.",
      clearAllData: "Clear all data",
      storage: "Storage",
      privacyNote:
        "Nothing here is uploaded anywhere — no account, no server. It all lives in this browser until you export it below.",
      storedInBrowser: "{size} stored in this browser",
      trackingSince: "Tracking since {date}",
      backup: "Backup",
      lastExported: "Last exported {date}",
      neverExported: "Never exported yet",
      exportData: "Export data",
      importData: "Import data",
      confirmImport:
        "Importing will replace your current data ({books}, {chapters}, {attempts}). Continue?",
      importFailed: "Import failed: {message}",
      exportedToast: "Exported {filename}",
      invalidFileFormat: "Invalid file format",
    },
    chapters: {
      bookNotFound: "Book not found.",
      statsLineWithScores: "{attempts} · avg {avg}% · best {best}%",
      renameChapter: "Rename chapter",
      lastAttempt: "last attempt {date}",
      newChapterTitle: "New chapter title",
      newChapterPlaceholder: "e.g. Chapter 4: Alkenes",
      addChapter: "Add chapter",
      addChapterToggle: "+ Add chapter",
      allBooks: "← All books",
      noChaptersYet: "No chapters yet.",
      confirmDeleteChapter: "Delete chapter '{title}' and its {attempts}? This cannot be undone.",
    },
    chapterDetail: {
      pastAttempts: "Past attempts",
      noAttemptsYet: "No attempts yet.",
      colDuration: "Duration",
      reviewGrade: "Review / grade",
      viewEditAnswers: "View / edit answers",
      attemptsTab: "Attempts ({count})",
      questionsTab: "Questions ({count})",
      sectionsGroupLabel: "Chapter sections",
      startAttempt: "Start attempt",
      printBlankPaper: "Print blank paper",
      trueFalse: "True / False",
      optionsCount: { one: "{count} option", other: "{count} options" },
      multiSelectSuffix: ", multi-select",
      answerSet: "Answer set",
      noAnswerYet: "No answer yet",
      moveUp: "Move question {n} up",
      moveDown: "Move question {n} down",
      addQuestionToggle: "+ Add question",
      questionsHeading: { one: "{count} Question", other: "{count} Questions" },
      colNum: "#",
      colType: "Type",
      colCorrectAnswer: "Correct answer",
      colActions: "Actions",
      noQuestionsYet: "No questions yet.",
      numOptions: "Number of options",
      allowMultiSelect: "Allow selecting more than one option",
      questionType: "Question type",
      multipleChoice: "Multiple choice",
      correctAnswerHint:
        "The correct answer is set later, from the Review screen of an attempt that includes this question.",
      addQuestion: "Add question",
      confirmDeleteQuestion:
        "Delete question {n}? This removes it from {attempts} too, and cannot be undone.",
      chartAriaLabel: "Chapter score percentage over time",
    },
    wizard: {
      yourAnswer: "Your answer",
      flagUnsure: "Not sure yet — flag this question to review before submitting",
      flagStillUnsure: "Still not sure — keep this question flagged",
      keyboardHintLetter: "the option's letter",
      keyboardHintTF: "T or F",
      keyboardHint: "Keyboard: press {keys} to answer, Shift+F to flag, Enter to continue.",
      docTitleNew: "New attempt:",
      docTitleRetake: "Retake:",
      newAttemptTitle: "{title} — new attempt",
      howManyQuestions: "How many questions in this chapter?",
      howManyQuestionsPlaceholder: "e.g. 10",
      errorEnterQuestionCount: "Enter how many questions this chapter has.",
      begin: "Begin",
      unsureHint: "Not sure how many yet?",
      addOneAtATime: "Add questions one at a time instead",
      unsureHintEnd: ", and finish whenever you've covered them all.",
      questionOf: "Question {i} of {total}",
      questionUnbounded: "Question {i}",
      progressLabel: "Question {current} of {total}",
      flaggedSoFar: " · {count} flagged",
      samePrevious: "Same as previous question — change above if this one is different.",
      addAnother: "Add another question",
      finishAttempt: "Finish attempt",
      nextQuestion: "Next question",
      previousQuestion: "Previous question",
      removeAndFinish: "Remove this question & finish",
      cancelAttempt: "Cancel attempt",
      flaggedForReview: {
        one: "{count} question flagged for review",
        other: "{count} questions flagged for review",
      },
      takeAnotherLook: "Take another look before submitting, or submit as-is.",
      noneLeft: "None left — you're all set.",
      submitAttempt: "Submit attempt",
      confirmSubmitUnanswered: {
        one: "{count} flagged question has no answer yet. Submit anyway?",
        other: "{count} flagged questions have no answer yet. Submit anyway?",
      },
      reviewingQuestion: "Reviewing question {n}",
      saveAndReturn: "Save and return to flagged list",
      retakeTitle: "{title} — retake",
      confirmCancelAttempt: "Cancel this attempt? Your progress on it will be lost.",
      discardAttempt: "Discard attempt",
      keepEditing: "Keep editing",
      errorSelectOrFlag: "Select an answer, or flag this question to come back to it later.",
      errorSelectOrKeepFlagged: "Select an answer, or keep this question flagged.",
    },
    review: {
      docTitle: "Review:",
      reviewAndGrade: "Review & grade",
      gradedProgress: "Graded {graded} of {total} · {correct} correct so far",
      hint: "Pick the correct answer for each question — it saves immediately. Editing a correct answer later will re-grade every past attempt for that question.",
      displayModeLabel: "Review display mode",
      detailed: "Detailed",
      compact: "Compact",
      colYourAnswer: "Your answer",
      colStatus: "Status",
      flaggedSuffix: " (flagged)",
      flaggedNoAnswer: "Flagged — no answer given",
      noAnswer: "(no answer)",
      yourAnswerLine: "Your answer:",
      statusNotGraded: "Not yet graded",
      statusUnanswered: "Unanswered",
      statusCorrect: "Correct",
      statusIncorrect: "Incorrect",
      saved: "Saved",
      savedCheck: "Saved ✓",
      correctAnswerForQuestion: "Correct answer for question {n}",
      done: "Done",
      notSet: "Not set",
    },
    trends: {
      docTitle: "Trends:",
      trendsTitle: "Trends: {title}",
      weakestQuestions: "Weakest questions",
      colQuestion: "Question",
      colIncorrectRate: "Incorrect rate",
      colGradedAttempts: "Graded attempts",
      noIncorrectYet: "No incorrect answers yet — nice work!",
      notEnoughGraded: "Not enough graded attempts yet.",
      perQuestionHistory: "Per-question history",
      colAttemptSequence: "Attempt sequence",
      noAttempts: "No attempts",
    },
    print: {
      docTitle: "Print:",
      printTitle: "Print: {title}",
      printHint: 'Click print, then choose "Save as PDF" in the print dialog.',
      print: "Print",
      ariaLabel: "Printable exam paper",
      name: "Name:",
      date: "Date:",
      score: "Score:",
      ofTotal: "of {total}",
      question: "Q{n}.",
    },
  },
};

// Fixed at "en" while only one language is available. A future language
// switcher can replace this with a stored preference again.
function getLang() {
  return "en";
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? vars[key] : "{" + key + "}"));
}

// Looks up "home.retake"-style dotted keys against the current language,
// falling back to English so a missing entry in a future language degrades
// gracefully instead of throwing or showing a raw key.
function t(key, vars) {
  const path = key.split(".");
  const lookup = (dict) => path.reduce((node, part) => (node ? node[part] : undefined), dict);
  const value = lookup(STRINGS[getLang()]) ?? lookup(STRINGS.en);
  if (value === undefined) return key;
  return interpolate(value, vars);
}

// Count-sensitive variant: value is a { one, other } pair, selected via
// Intl.PluralRules so the rule is locale-driven rather than a count===1 check.
function tn(key, count, vars) {
  const path = key.split(".");
  const lookup = (dict) => path.reduce((node, part) => (node ? node[part] : undefined), dict);
  const forms = lookup(STRINGS[getLang()]) ?? lookup(STRINGS.en);
  if (!forms) return key;
  const category = new Intl.PluralRules(getLang()).select(count);
  const str = forms[category] ?? forms.other;
  return interpolate(str, { count, ...vars });
}
