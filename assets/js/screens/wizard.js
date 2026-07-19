/* New Attempt / Retake wizard: shared dispatcher, state helpers, and
   keyboard shortcuts. Screen-specific flows are in wizard-new.js and
   wizard-retake.js. */

let Wizard = null;

function wizardHasProgress() {
  if (!Wizard) return false;
  if (Wizard.mode === "new") return Wizard.stage !== "count" && (Wizard.draftQuestions.length > 0 || Wizard.index > 0);
  return Wizard.index > 0 || Object.keys(Wizard.responses).length > 0 || Wizard.stage !== "questions";
}

async function cancelWizard() {
  const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
  if (wizardHasProgress() && !(await showConfirm(t("wizard.confirmCancelAttempt"), { confirmLabel: t("wizard.discardAttempt"), cancelLabel: t("wizard.keepEditing"), danger: true }))) return;
  Wizard = null;
  navigate("/books/" + bookId + "/chapters/" + chapterId);
  render();
}

const DEFAULT_MCQ_CONFIG = { optionLabels: ["A", "B", "C", "D"], multiSelect: false };

function renderAttemptWizard(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount(html`<p>Chapter not found.</p>`);
  const isFirstTime = chapter.questionOrder.length === 0;
  document.title = (isFirstTime ? t("wizard.docTitleNew") : t("wizard.docTitleRetake")) + " " + chapter.title + " — " + t("common.appName");

  if (!Wizard || Wizard.chapterId !== chapterId || Wizard.mode !== (isFirstTime ? "new" : "retake")) {
    if (isFirstTime) {
      Wizard = {
        chapterId, bookId, mode: "new",
        stage: "count", total: null, index: 0,
        lastMcqConfig: Object.assign({}, DEFAULT_MCQ_CONFIG),
        draftQuestions: [], draftAnswers: [],
        currentType: "mcq", currentConfig: Object.assign({}, DEFAULT_MCQ_CONFIG),
        error: null, pendingFlagged: false, reviewIndex: null,
        startedAt: new Date().toISOString(),
      };
    } else {
      Wizard = {
        chapterId, bookId, mode: "retake",
        stage: "questions", index: 0, responses: {}, error: null, reviewQuestionId: null,
        startedAt: new Date().toISOString(),
      };
    }
  }

  if (Wizard.mode === "new") return renderNewWizard(bookId, chapterId, chapter);
  return renderRetakeWizard(bookId, chapterId, chapter);
}

function renderAnswerFieldset(type, config, chosenValues) {
  chosenValues = chosenValues || [];
  if (type === "mcq") {
    const inputType = config.multiSelect ? "checkbox" : "radio";
    return html`
      <fieldset>
        <legend>${t("wizard.yourAnswer")}</legend>
        ${config.optionLabels.map((label) => html`
          <div class="choice-row" key=${label}>
            <input type=${inputType} name="answer" id=${"opt-" + label} value=${label} checked=${chosenValues.includes(label)} />
            <label for=${"opt-" + label} style="margin:0">${label}</label>
          </div>
        `)}
      </fieldset>
    `;
  }
  return html`
    <fieldset>
      <legend>${t("wizard.yourAnswer")}</legend>
      <div class="choice-row">
        <input type="radio" name="answer" id="opt-true" value="true" checked=${chosenValues.includes("true")} />
        <label for="opt-true" style="margin:0">${t("common.trueLabel")}</label>
      </div>
      <div class="choice-row">
        <input type="radio" name="answer" id="opt-false" value="false" checked=${chosenValues.includes("false")} />
        <label for="opt-false" style="margin:0">${t("common.falseLabel")}</label>
      </div>
    </fieldset>
  `;
}

function flagCheckbox(checked, label) {
  return html`
    <div class="choice-row">
      <input type="checkbox" id="flag-question" checked=${checked} />
      <label for="flag-question" style="margin:0">${label}</label>
    </div>
  `;
}

function keyboardHint(type) {
  const answerKeys = type === "mcq" ? t("wizard.keyboardHintLetter") : t("wizard.keyboardHintTF");
  return html`<p class="wizard-unsure-hint">${t("wizard.keyboardHint", { keys: answerKeys })}</p>`;
}

function progressBar(current, total) {
  const pct = Math.round((current / total) * 100);
  return html`
    <div class="progress-bar" role="progressbar" aria-valuenow=${current} aria-valuemin="0" aria-valuemax=${total} aria-label=${t("wizard.progressLabel", { current, total })}>
      <div class="progress-bar-fill" style=${`width:${pct}%`}></div>
    </div>
  `;
}

/* ---------- Wizard keyboard shortcuts ---------- */

// Accelerators on top of the existing pointer/tab flow, not a replacement --
// they act on the same ids/handlers the on-screen controls already use, so
// screen reader / keyboard-only users relying on Tab+Space still work
// exactly as before.
function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return el.type !== "radio" && el.type !== "checkbox";
  return !!el.isContentEditable;
}

function handleWizardKeydown(e) {
  if (!Wizard) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isEditableTarget(e.target)) return;
  // A focused button/link already activates on Enter/Space natively --
  // don't also fire our own action and double-trigger it.
  if (e.target && (e.target.tagName === "BUTTON" || e.target.tagName === "A")) return;

  const key = e.key;

  if (e.shiftKey) {
    if (key.toLowerCase() === "f") {
      const flag = document.getElementById("flag-question");
      if (flag) { e.preventDefault(); flag.click(); }
    } else if (key === "Enter") {
      const secondary = document.getElementById("wizard-secondary-action");
      if (secondary) { e.preventDefault(); secondary.click(); }
    }
    return;
  }

  if (/^[a-h]$/i.test(key)) {
    const opt = document.getElementById("opt-" + key.toUpperCase());
    if (opt) { e.preventDefault(); opt.click(); return; }
  }
  if (key.toLowerCase() === "t") {
    const opt = document.getElementById("opt-true");
    if (opt) { e.preventDefault(); opt.click(); return; }
  }
  if (key.toLowerCase() === "f") {
    const opt = document.getElementById("opt-false");
    if (opt) { e.preventDefault(); opt.click(); return; }
  }
  if (key === "Enter") {
    const primary = document.getElementById("wizard-primary-action");
    if (primary) { e.preventDefault(); primary.click(); }
    return;
  }
  if (key === "Backspace") {
    const back = document.getElementById("wizard-back-action");
    if (back) { e.preventDefault(); back.click(); }
  }
}

window.addEventListener("keydown", handleWizardKeydown);
