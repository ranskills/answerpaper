/* Retake wizard (chapter already has questions). */

function renderRetakeWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "flagged-review")
    return renderRetakeFlaggedReview(bookId, chapterId, chapter);
  if (Wizard.stage === "reviewing-one") return renderRetakeReviewOne(bookId, chapterId, chapter);

  const i = Wizard.index;
  const questionId = chapter.questionOrder[i];
  const question = Store.questions.find((q) => q.id === questionId);
  const isLast = i === chapter.questionOrder.length - 1;
  const priorEntry = Wizard.responses[questionId] || { chosen: [], flagged: false };
  const flaggedSoFar = Object.values(Wizard.responses).filter((r) => r.flagged).length;

  mount(html`
    <h1>${t("wizard.retakeTitle", { title: chapter.title })}</h1>
    <p class="wizard-progress" tabindex="-1" autofocus>
      ${t("wizard.questionOf", { i: i + 1, total: chapter.questionOrder.length })}${flaggedSoFar > 0 ? t("wizard.flaggedSoFar", { count: flaggedSoFar }) : ""}
    </p>
    ${progressBar(i + 1, chapter.questionOrder.length)}
    <div class="card">
      ${renderAnswerFieldset(question.type, question.config, priorEntry.chosen)}
      ${flagCheckbox(priorEntry.flagged, t("wizard.flagUnsure"))} ${keyboardHint(question.type)}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        ${i > 0 ? html`<button type="button" id="wizard-back-action" onClick=${retakeGoBack}>${t("wizard.previousQuestion")}</button>` : null}
        <button
          type="button"
          id="wizard-primary-action"
          class="primary"
          onClick=${() => retakeCommitQuestion(questionId, isLast)}
        >
          ${isLast ? t("wizard.finishAttempt") : t("wizard.nextQuestion")}
        </button>
        <button type="button" onClick=${cancelWizard}>${t("wizard.cancelAttempt")}</button>
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
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map(
    (el) => el.value,
  );
  const flagged = document.getElementById("flag-question").checked;

  if (checked.length === 0 && !flagged) {
    Wizard.error = t("wizard.errorSelectOrFlag");
    render();
    return;
  }
  Wizard.error = null;

  Wizard.responses[questionId] = { chosen: checked, flagged };

  if (isLast) {
    const chapter = Store.chapters.find((c) => c.id === Wizard.chapterId);
    const anyFlagged = chapter.questionOrder.some(
      (qid) => Wizard.responses[qid] && Wizard.responses[qid].flagged,
    );
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
  const attempt = commitRetakeAttempt(Wizard.chapterId, Wizard.responses, Wizard.startedAt);
  const bookId = Wizard.bookId,
    chapterId = Wizard.chapterId;
  Wizard = null;
  clearWizardDraft();
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
  render();
}

function renderRetakeFlaggedReview(bookId, chapterId, chapter) {
  const flaggedQids = chapter.questionOrder.filter(
    (qid) => Wizard.responses[qid] && Wizard.responses[qid].flagged,
  );
  const items = flaggedQids.map((qid) => {
    const num = chapter.questionOrder.indexOf(qid) + 1;
    return html`
      <li class="flagged-item" key=${qid}>
        <button type="button" onClick=${() => reviewRetakeFlaggedQuestion(qid)}>
          ${t("common.questionN", { n: num })}
        </button>
        <span class="card-meta">${formatChosenSummary(Wizard.responses[qid].chosen)}</span>
      </li>
    `;
  });

  mount(html`
    <h1>${t("wizard.retakeTitle", { title: chapter.title })}</h1>
    <div class="card">
      <h2 tabindex="-1" autofocus>${tn("wizard.flaggedForReview", flaggedQids.length)}</h2>
      <p>${t("wizard.takeAnotherLook")}</p>
      <ul class="flagged-list">
        ${items.length ? items : html`<li>${t("wizard.noneLeft")}</li>`}
      </ul>
      <div class="btn-row">
        <button type="button" class="primary" onClick=${confirmFinishRetakeAttempt}>
          ${t("wizard.submitAttempt")}
        </button>
      </div>
    </div>
  `);
}

async function confirmFinishRetakeAttempt() {
  const unanswered = Object.values(Wizard.responses).filter(
    (r) => r.flagged && r.chosen.length === 0,
  ).length;
  if (unanswered > 0) {
    const ok = await showConfirm(tn("wizard.confirmSubmitUnanswered", unanswered), {
      confirmLabel: t("wizard.submitAttempt"),
      cancelLabel: t("wizard.keepEditing"),
    });
    if (!ok) return;
  }
  finishRetakeAttempt();
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
    <h1>${t("wizard.retakeTitle", { title: chapter.title })}</h1>
    <p class="wizard-progress" tabindex="-1" autofocus>
      ${t("wizard.reviewingQuestion", { n: num })}
    </p>
    <div class="card">
      ${renderAnswerFieldset(question.type, question.config, entry.chosen)}
      ${flagCheckbox(entry.flagged, t("wizard.flagStillUnsure"))} ${keyboardHint(question.type)}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        <button
          type="button"
          id="wizard-primary-action"
          class="primary"
          onClick=${saveRetakeReviewedQuestion}
        >
          ${t("wizard.saveAndReturn")}
        </button>
      </div>
    </div>
  `);
}

function saveRetakeReviewedQuestion() {
  const questionId = Wizard.reviewQuestionId;
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map(
    (el) => el.value,
  );
  const flagged = document.getElementById("flag-question").checked;

  if (checked.length === 0 && !flagged) {
    Wizard.error = t("wizard.errorSelectOrKeepFlagged");
    render();
    return;
  }
  Wizard.error = null;
  Wizard.responses[questionId] = { chosen: checked, flagged };
  Wizard.reviewQuestionId = null;
  Wizard.stage = "flagged-review";
  render();
}
