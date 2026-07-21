/* New Attempt wizard (first pass through a chapter with no questions yet). */

function renderNewWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "count") {
    return mount(html`
      <h1>${t("wizard.newAttemptTitle", { title: chapter.title })}</h1>
      <div class="card">
        <label for="q-count">${t("wizard.howManyQuestions")}</label>
        <input
          id="q-count"
          type="number"
          min="1"
          max="200"
          placeholder=${t("wizard.howManyQuestionsPlaceholder")}
          autofocus
        />
        ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
        <div class="btn-row">
          <button type="button" class="primary" onClick=${startNewWizardQuestions}>
            ${t("wizard.begin")}
          </button>
          <button type="button" onClick=${cancelWizard}>${t("common.cancel")}</button>
        </div>
      </div>
      <p class="wizard-unsure-hint">
        ${t("wizard.unsureHint")}
        <button type="button" class="link-inline" onClick=${startNewWizardUnbounded}>
          ${t("wizard.addOneAtATime")}</button
        >${t("wizard.unsureHintEnd")}
      </p>
    `);
  }

  if (Wizard.stage === "flagged-review") return renderNewFlaggedReview(bookId, chapterId, chapter);
  if (Wizard.stage === "reviewing-one") return renderNewReviewOne(bookId, chapterId, chapter);

  const i = Wizard.index;
  const type = Wizard.currentType;
  const config = Wizard.currentConfig;
  const unbounded = Wizard.total === null;
  const isLast = !unbounded && i === Wizard.total - 1;
  const pendingChosen = Wizard.pendingChosen || [];
  const flaggedSoFar = Wizard.draftAnswers.filter((a) => a.flagged).length;

  const configHtml =
    type === "mcq"
      ? html`
          <label for="opt-count">${t("chapterDetail.numOptions")}</label>
          <input
            id="opt-count"
            type="number"
            min="2"
            max="8"
            value=${config.optionLabels.length}
            onChange=${(e) => wizardUpdateOptionCount(e.target.value)}
          />
          <div class="choice-row">
            <input
              id="multi-select"
              type="checkbox"
              checked=${config.multiSelect}
              onChange=${(e) => wizardUpdateMultiSelect(e.target.checked)}
            />
            <label for="multi-select" style="margin:0"
              >${t("chapterDetail.allowMultiSelect")}</label
            >
          </div>
          ${i > 0 ? html`<p class="card-meta">${t("wizard.samePrevious")}</p>` : null}
        `
      : null;

  const buttonsHtml = unbounded
    ? html`
        <button
          type="button"
          id="wizard-primary-action"
          onClick=${() => wizardCommitQuestion(false)}
        >
          ${t("wizard.addAnother")}
        </button>
        <button
          type="button"
          id="wizard-secondary-action"
          class="primary"
          onClick=${() => wizardCommitQuestion(true)}
        >
          ${t("wizard.finishAttempt")}
        </button>
      `
    : html`
        <button
          type="button"
          id="wizard-primary-action"
          class="primary"
          onClick=${() => wizardCommitQuestion(isLast)}
        >
          ${isLast ? t("wizard.finishAttempt") : t("wizard.nextQuestion")}
        </button>
      `;

  mount(html`
    <h1>${chapter.title}</h1>
    <p class="wizard-progress" tabindex="-1" autofocus>
      ${unbounded ? t("wizard.questionUnbounded", { i: i + 1 }) : t("wizard.questionOf", { i: i + 1, total: Wizard.total })}${flaggedSoFar > 0 ? t("wizard.flaggedSoFar", { count: flaggedSoFar }) : ""}
    </p>
    ${unbounded ? null : progressBar(i + 1, Wizard.total)}
    <div class="card">
      <label for="q-type">${t("chapterDetail.questionType")}</label>
      <select id="q-type" onChange=${(e) => wizardUpdateType(e.target.value)}>
        <option value="mcq" selected=${type === "mcq"}>${t("chapterDetail.multipleChoice")}</option>
        <option value="truefalse" selected=${type === "truefalse"}>
          ${t("chapterDetail.trueFalse")}
        </option>
      </select>
      ${configHtml} ${renderAnswerFieldset(type, config, pendingChosen)}
      ${flagCheckbox(Wizard.pendingFlagged, t("wizard.flagUnsure"))} ${keyboardHint(type)}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        ${i > 0 ? html`<button type="button" id="wizard-back-action" onClick=${wizardGoBack}>${t("wizard.previousQuestion")}</button>` : null}
        ${unbounded && i > 0 ? html`<button type="button" class="danger" onClick=${wizardRemoveAndFinish}>${t("wizard.removeAndFinish")}</button>` : null}
        ${buttonsHtml}
        <button type="button" onClick=${cancelWizard}>${t("wizard.cancelAttempt")}</button>
      </div>
    </div>
  `);
}

function wizardGoBack() {
  if (Wizard.index === 0) return;
  const prev = Wizard.draftQuestions.pop();
  const prevAnswer = Wizard.draftAnswers.pop();
  Wizard.index -= 1;
  Wizard.currentType = prev.type;
  Wizard.currentConfig = Object.assign(
    {},
    prev.config,
    prev.config.optionLabels ? { optionLabels: prev.config.optionLabels.slice() } : {},
  );
  Wizard.pendingChosen = prevAnswer.chosen.slice();
  Wizard.pendingFlagged = !!prevAnswer.flagged;
  Wizard.error = null;
  render();
}

function startNewWizardQuestions() {
  const count = parseInt(document.getElementById("q-count").value, 10);
  if (!count || count < 1) {
    Wizard.error = t("wizard.errorEnterQuestionCount");
    render();
    return;
  }
  Wizard.error = null;
  Wizard.total = count;
  Wizard.stage = "questions";
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, {
    optionLabels: Wizard.lastMcqConfig.optionLabels.slice(),
  });
  render();
}

function startNewWizardUnbounded() {
  Wizard.total = null;
  Wizard.stage = "questions";
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, {
    optionLabels: Wizard.lastMcqConfig.optionLabels.slice(),
  });
  render();
}

function wizardRemoveAndFinish() {
  if (Wizard.index === 0) return;
  const anyFlagged = Wizard.draftAnswers.some((a) => a.flagged);
  if (anyFlagged) {
    Wizard.stage = "flagged-review";
    render();
    return;
  }
  finishNewAttempt();
}

function wizardUpdateType(type) {
  Wizard.currentType = type;
  Wizard.pendingChosen = null;
  Wizard.pendingFlagged = false;
  if (type === "mcq") {
    Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, {
      optionLabels: Wizard.lastMcqConfig.optionLabels.slice(),
    });
  } else {
    Wizard.currentConfig = {};
  }
  render();
}

function wizardUpdateOptionCount(value) {
  const n = Math.max(2, Math.min(8, parseInt(value, 10) || 4));
  const letters = "ABCDEFGH".split("");
  Wizard.currentConfig.optionLabels = letters.slice(0, n);
  render();
}

function wizardUpdateMultiSelect(checked) {
  Wizard.currentConfig.multiSelect = checked;
  render();
}

function wizardCommitQuestion(isLast) {
  const type = Wizard.currentType;
  const config = Wizard.currentConfig;
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

  Wizard.draftQuestions.push({ type, config: Object.assign({}, config) });
  Wizard.draftAnswers.push({ chosen: checked, flagged });
  Wizard.pendingChosen = null;
  Wizard.pendingFlagged = false;

  if (type === "mcq") {
    Wizard.lastMcqConfig = Object.assign({}, config, { optionLabels: config.optionLabels.slice() });
  }

  if (isLast) {
    const anyFlagged = Wizard.draftAnswers.some((a) => a.flagged);
    if (anyFlagged) {
      Wizard.stage = "flagged-review";
      render();
      return;
    }
    finishNewAttempt();
    return;
  }

  Wizard.index += 1;
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, {
    optionLabels: Wizard.lastMcqConfig.optionLabels.slice(),
  });
  render();
}

function finishNewAttempt() {
  const attempt = commitNewAttempt(
    Wizard.chapterId,
    Wizard.draftQuestions,
    Wizard.draftAnswers,
    Wizard.startedAt,
  );
  const bookId = Wizard.bookId,
    chapterId = Wizard.chapterId;
  Wizard = null;
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
  render();
}

function renderNewFlaggedReview(bookId, chapterId, chapter) {
  const flaggedIdx = [];
  Wizard.draftAnswers.forEach((a, idx) => {
    if (a.flagged) flaggedIdx.push(idx);
  });

  const items = flaggedIdx.map(
    (idx) => html`
      <li class="flagged-item" key=${idx}>
        <button type="button" onClick=${() => reviewNewFlaggedQuestion(idx)}>
          ${t("common.questionN", { n: idx + 1 })}
        </button>
        <span class="card-meta">${formatChosenSummary(Wizard.draftAnswers[idx].chosen)}</span>
      </li>
    `,
  );

  mount(html`
    <h1>${chapter.title}</h1>
    <div class="card">
      <h2 tabindex="-1" autofocus>${tn("wizard.flaggedForReview", flaggedIdx.length)}</h2>
      <p>${t("wizard.takeAnotherLook")}</p>
      <ul class="flagged-list">
        ${items.length ? items : html`<li>${t("wizard.noneLeft")}</li>`}
      </ul>
      <div class="btn-row">
        <button type="button" class="primary" onClick=${confirmFinishNewAttempt}>
          ${t("wizard.submitAttempt")}
        </button>
      </div>
    </div>
  `);
}

async function confirmFinishNewAttempt() {
  const unanswered = Wizard.draftAnswers.filter((a) => a.flagged && a.chosen.length === 0).length;
  if (unanswered > 0) {
    const ok = await showConfirm(tn("wizard.confirmSubmitUnanswered", unanswered), {
      confirmLabel: t("wizard.submitAttempt"),
      cancelLabel: t("wizard.keepEditing"),
    });
    if (!ok) return;
  }
  finishNewAttempt();
}

function reviewNewFlaggedQuestion(idx) {
  Wizard.reviewIndex = idx;
  Wizard.stage = "reviewing-one";
  render();
}

function renderNewReviewOne(bookId, chapterId, chapter) {
  const idx = Wizard.reviewIndex;
  const q = Wizard.draftQuestions[idx];
  const a = Wizard.draftAnswers[idx];

  mount(html`
    <h1>${chapter.title}</h1>
    <p class="wizard-progress" tabindex="-1" autofocus>
      ${t("wizard.reviewingQuestion", { n: idx + 1 })}
    </p>
    <div class="card">
      ${renderAnswerFieldset(q.type, q.config, a.chosen)}
      ${flagCheckbox(a.flagged, t("wizard.flagStillUnsure"))} ${keyboardHint(q.type)}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        <button
          type="button"
          id="wizard-primary-action"
          class="primary"
          onClick=${saveNewReviewedQuestion}
        >
          ${t("wizard.saveAndReturn")}
        </button>
      </div>
    </div>
  `);
}

function saveNewReviewedQuestion() {
  const idx = Wizard.reviewIndex;
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
  Wizard.draftAnswers[idx] = { chosen: checked, flagged };
  Wizard.reviewIndex = null;
  Wizard.stage = "flagged-review";
  render();
}
