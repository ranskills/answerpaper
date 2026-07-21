/* Chapter detail screen (#/books/:bookId/chapters/:chapterId): Attempts +
   Questions tabs, plus the print trigger it links to. */

function renderChapterDetail(bookId, chapterId) {
  const book = Store.books.find((b) => b.id === bookId);
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!book || !chapter)
    return mount(html`<p>${t("common.notFound")} <a href="#/books">${t("common.goBack")}</a>.</p>`);
  document.title = chapter.title + " — " + t("common.appName");

  const attempts = attemptsForChapter(Store, chapterId).slice().reverse();
  const isFirstTime = chapter.questionOrder.length === 0;

  const rows = attempts.map((attempt) => {
    const attemptScore = computeAttemptScore(Store, attempt);
    const score = formatScoreLabel(attemptScore);
    const needsReview = attemptScore.trulyUngradedCount > 0;
    return html`
      <tr key=${attempt.id}>
        <td>${formatDate(attempt.finishedAt)}</td>
        <td>${formatDuration(attempt.startedAt, attempt.finishedAt)}</td>
        <td>${score}</td>
        <td>
          <a
            href=${"#/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review"}
            >${needsReview ? t("chapterDetail.reviewGrade") : t("chapterDetail.viewEditAnswers")}</a
          >
        </td>
      </tr>
    `;
  });

  const chartSeries = computeChapterTrend(Store, chapterId);

  const attemptsCard = html`
    <div class="card">
      <h2>${t("chapterDetail.pastAttempts")}</h2>
      ${
        attempts.length
          ? html`<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">${t("home.colDate")}</th>
                    <th scope="col">${t("chapterDetail.colDuration")}</th>
                    <th scope="col">${t("home.colScore")}</th>
                    <th scope="col">
                      <span class="sr-only">${t("chapterDetail.colActions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>`
          : html`<p>${t("chapterDetail.noAttemptsYet")}</p>`
      }
    </div>
  `;

  let detailSection;
  if (isFirstTime) {
    detailSection = attemptsCard;
  } else {
    const tab = uiState.chapterDetailTab === "questions" ? "questions" : "attempts";
    detailSection = html`
      <div class="filter-tabs" role="group" aria-label=${t("chapterDetail.sectionsGroupLabel")}>
        <button
          type="button"
          aria-pressed=${tab === "attempts"}
          onClick=${() => setChapterDetailTab(bookId, chapterId, "attempts")}
        >
          ${t("chapterDetail.attemptsTab", { count: attempts.length })}
        </button>
        <button
          type="button"
          aria-pressed=${tab === "questions"}
          onClick=${() => setChapterDetailTab(bookId, chapterId, "questions")}
        >
          ${t("chapterDetail.questionsTab", { count: chapter.questionOrder.length })}
        </button>
      </div>
      ${tab === "attempts" ? attemptsCard : renderQuestionManageCard(bookId, chapterId, chapter)}
    `;
  }

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters"}>← ${book.title}</a></p>
    <h1>${chapter.title}</h1>
    <div class="btn-row">
      <a class="btn primary" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/attempt"}
        >${isFirstTime ? t("chapterDetail.startAttempt") : t("home.retake")}</a
      >
      ${
        isFirstTime
          ? null
          : html`
              <a class="btn" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/trends"}
                >${t("home.viewTrends")}</a
              >
              <a class="btn" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/print"}
                >${t("chapterDetail.printBlankPaper")}</a
              >
            `
      }
    </div>
    ${
      chartSeries.length
        ? html`<div class="card">
            <h2>${t("common.scoreOverTime")}</h2>
            ${renderScoreLineChart(chartSeries)}
          </div>`
        : null
    }
    ${detailSection}
  `);
}

function setChapterDetailTab(bookId, chapterId, tab) {
  uiState.chapterDetailTab = tab;
  renderChapterDetail(bookId, chapterId);
}

/* ---------- Manage chapter questions ---------- */

const DEFAULT_NEW_QUESTION_CONFIG = { optionLabels: ["A", "B", "C", "D"], multiSelect: false };

function describeQuestion(question) {
  if (question.type === "truefalse") return t("chapterDetail.trueFalse");
  return (
    tn("chapterDetail.optionsCount", question.config.optionLabels.length) +
    (question.config.multiSelect ? t("chapterDetail.multiSelectSuffix") : "")
  );
}

function renderQuestionManageCard(bookId, chapterId, chapter) {
  const questions = chapter.questionOrder
    .map((qid) => Store.questions.find((q) => q.id === qid))
    .filter(Boolean);

  const rows = questions.map(
    (q, idx) => html`
      <tr key=${q.id}>
        <td>${t("common.questionN", { n: idx + 1 })}</td>
        <td>${describeQuestion(q)}</td>
        <td>
          ${
            q.correctAnswer !== null && q.correctAnswer !== undefined
              ? html`<span class="status-correct">${t("chapterDetail.answerSet")}</span>`
              : html`<span class="status-ungraded">${t("chapterDetail.noAnswerYet")}</span>`
          }
        </td>
        <td class="btn-row">
          ${idx > 0 ? html`<button type="button" id=${"q-up-" + q.id} onClick=${() => moveQuestion(bookId, chapterId, q.id, -1)} aria-label=${t("chapterDetail.moveUp", { n: idx + 1 })}>↑</button>` : null}
          ${idx < questions.length - 1 ? html`<button type="button" id=${"q-down-" + q.id} onClick=${() => moveQuestion(bookId, chapterId, q.id, 1)} aria-label=${t("chapterDetail.moveDown", { n: idx + 1 })}>↓</button>` : null}
          <button
            type="button"
            id=${"q-delete-" + q.id}
            class="danger"
            onClick=${() => promptDeleteQuestion(bookId, chapterId, q.id)}
          >
            ${t("common.delete")}
          </button>
        </td>
      </tr>
    `,
  );

  const addForm = uiState.addQuestionOpen
    ? renderAddQuestionForm(bookId, chapterId)
    : html`<div class="btn-row">
        <button
          type="button"
          id="add-question-toggle"
          onClick=${() => toggleAddQuestionForm(true, bookId, chapterId)}
        >
          ${t("chapterDetail.addQuestionToggle")}
        </button>
      </div>`;

  return html`
    <div class="card">
      <h2>${tn("chapterDetail.questionsHeading", questions.length)}</h2>
      ${
        questions.length
          ? html`<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">${t("chapterDetail.colNum")}</th>
                    <th scope="col">${t("chapterDetail.colType")}</th>
                    <th scope="col">${t("chapterDetail.colCorrectAnswer")}</th>
                    <th scope="col">
                      <span class="sr-only">${t("chapterDetail.colActions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>`
          : html`<p>${t("chapterDetail.noQuestionsYet")}</p>`
      }
      ${addForm}
    </div>
  `;
}

function renderAddQuestionForm(bookId, chapterId) {
  const draft =
    uiState.addQuestionDraft ||
    (uiState.addQuestionDraft = {
      type: "mcq",
      config: Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG),
    });
  const configHtml =
    draft.type === "mcq"
      ? html`
          <label for="new-q-opt-count">${t("chapterDetail.numOptions")}</label>
          <input
            id="new-q-opt-count"
            type="number"
            min="2"
            max="8"
            value=${draft.config.optionLabels.length}
            onChange=${(e) => manageAddQuestionUpdateOptionCount(e.target.value)}
          />
          <div class="choice-row">
            <input
              id="new-q-multi-select"
              type="checkbox"
              checked=${draft.config.multiSelect}
              onChange=${(e) => manageAddQuestionUpdateMultiSelect(e.target.checked)}
            />
            <label for="new-q-multi-select" style="margin:0"
              >${t("chapterDetail.allowMultiSelect")}</label
            >
          </div>
        `
      : null;

  return html`
    <form class="add-question-form" onSubmit=${(e) => handleAddQuestion(e, bookId, chapterId)}>
      <label for="new-q-type">${t("chapterDetail.questionType")}</label>
      <select
        id="new-q-type"
        autofocus
        onChange=${(e) => manageAddQuestionUpdateType(e.target.value)}
      >
        <option value="mcq" selected=${draft.type === "mcq"}>
          ${t("chapterDetail.multipleChoice")}
        </option>
        <option value="truefalse" selected=${draft.type === "truefalse"}>
          ${t("chapterDetail.trueFalse")}
        </option>
      </select>
      ${configHtml}
      <p class="card-meta">${t("chapterDetail.correctAnswerHint")}</p>
      <div class="btn-row">
        <button type="submit" class="primary">${t("chapterDetail.addQuestion")}</button>
        <button type="button" onClick=${() => toggleAddQuestionForm(false, bookId, chapterId)}>
          ${t("common.cancel")}
        </button>
      </div>
    </form>
  `;
}

function toggleAddQuestionForm(open, bookId, chapterId) {
  uiState.addQuestionOpen = open;
  uiState.addQuestionDraft = open
    ? { type: "mcq", config: Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) }
    : null;
  renderChapterDetail(bookId, chapterId);
  if (!open) focusById("add-question-toggle");
}

function manageAddQuestionUpdateType(type) {
  uiState.addQuestionDraft.type = type;
  uiState.addQuestionDraft.config =
    type === "mcq" ? Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) : {};
}

function manageAddQuestionUpdateOptionCount(value) {
  const n = Math.max(2, Math.min(8, parseInt(value, 10) || 4));
  uiState.addQuestionDraft.config.optionLabels = "ABCDEFGH".split("").slice(0, n);
}

function manageAddQuestionUpdateMultiSelect(checked) {
  uiState.addQuestionDraft.config.multiSelect = checked;
}

function handleAddQuestion(event, bookId, chapterId) {
  event.preventDefault();
  const draft = uiState.addQuestionDraft;
  addQuestionToChapter(
    chapterId,
    draft.type,
    Object.assign(
      {},
      draft.config,
      draft.config.optionLabels ? { optionLabels: draft.config.optionLabels.slice() } : {},
    ),
  );
  uiState.addQuestionOpen = false;
  uiState.addQuestionDraft = null;
  renderChapterDetail(bookId, chapterId);
  focusById("add-question-toggle");
  return false;
}

function moveQuestion(bookId, chapterId, questionId, direction) {
  reorderQuestion(chapterId, questionId, direction);
  renderChapterDetail(bookId, chapterId);
  // Reordering moves this row's DOM node during Preact's reconciliation,
  // which blurs it in most browsers even though the node itself survives —
  // so unlike a simple add/remove, this needs an explicit refocus. Falls
  // through silently (leaving mount()'s heading fallback) if this question
  // moved into the first/last slot and lost the button it was clicked from.
  focusById((direction < 0 ? "q-up-" : "q-down-") + questionId);
}

async function promptDeleteQuestion(bookId, chapterId, questionId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const idx = chapter.questionOrder.indexOf(questionId);
  const counts = questionCascadeCounts(chapterId, questionId);
  const ok = await showConfirm(
    t("chapterDetail.confirmDeleteQuestion", {
      n: idx + 1,
      attempts: tn("common.pastAttempt", counts.attemptCount),
    }),
    { confirmLabel: t("common.delete"), danger: true },
  );
  if (ok) {
    deleteQuestion(chapterId, questionId);
    renderChapterDetail(bookId, chapterId);
  }
}

/* ---------- Print trigger ---------- */

function renderPrintTrigger(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount(html`<p>${t("common.notFound")}</p>`);
  document.title = t("print.docTitle") + " " + chapter.title + " — " + t("common.appName");
  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>${t("print.printTitle", { title: chapter.title })}</h1>
    <p>${t("print.printHint")}</p>
    <div class="btn-row">
      <button type="button" class="primary" onClick=${() => triggerPrint(chapterId)}>
        ${t("print.print")}
      </button>
    </div>
  `);
  buildPrintView(chapterId);
}

function triggerPrint(chapterId) {
  buildPrintView(chapterId);
  window.print();
}
