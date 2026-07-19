/* Review / Grade screen. */

let scrollToQuestionNum = null;

function renderReview(bookId, chapterId, attemptId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const attempt = Store.attempts.find((a) => a.id === attemptId);
  if (!chapter || !attempt) return mount(html`<p>${t("common.notFound")}</p>`);
  document.title = t("review.docTitle") + " " + chapter.title + " — " + t("common.appName");

  const gradedCount = attempt.responses.filter((r) => {
    const q = Store.questions.find((qq) => qq.id === r.questionId);
    return q && q.correctAnswer !== null && q.correctAnswer !== undefined;
  }).length;
  const correctCount = attempt.responses.filter((r) => r.correct === true).length;

  const compact = uiState.reviewCompact;

  const rows = attempt.responses.map((response, idx) => {
    const question = Store.questions.find((q) => q.id === response.questionId);
    const chosenLabel = response.chosen.length
      ? response.chosen.map(formatAnswerValue).join(", ") + (response.flagged ? t("review.flaggedSuffix") : "")
      : (response.flagged ? t("review.flaggedNoAnswer") : t("review.noAnswer"));
    const isLocked = question.correctAnswer !== null && question.correctAnswer !== undefined;
    const unanswered = response.chosen.length === 0;
    const statusClass = !isLocked ? "status-ungraded" : unanswered ? "status-incorrect" : response.correct ? "status-correct" : "status-incorrect";
    const statusText = !isLocked ? t("review.statusNotGraded") : unanswered ? t("review.statusUnanswered") : response.correct ? t("review.statusCorrect") : t("review.statusIncorrect");

    if (compact) {
      return renderCompactReviewRow(bookId, chapterId, attemptId, question, idx, chosenLabel, statusClass, statusText, isLocked);
    }

    let correctInput;
    if (question.type === "mcq") {
      const inputType = question.config.multiSelect ? "checkbox" : "radio";
      correctInput = question.config.optionLabels.map((label) => {
        const checked = question.correctAnswer && question.correctAnswer.includes(label);
        return html`
          <div class="choice-row" key=${label}>
            <input type=${inputType} name=${"correct-" + question.id} id=${"correct-" + question.id + "-" + label} value=${label} checked=${checked}
              onChange=${() => handleCorrectAnswerChange(question.id, bookId, chapterId, attemptId)} />
            <label for=${"correct-" + question.id + "-" + label} style="margin:0">${label}</label>
          </div>
        `;
      });
    } else {
      const trueChecked = question.correctAnswer && question.correctAnswer.includes("true");
      const falseChecked = question.correctAnswer && question.correctAnswer.includes("false");
      correctInput = html`
        <div class="choice-row">
          <input type="radio" name=${"correct-" + question.id} id=${"correct-" + question.id + "-true"} value="true" checked=${trueChecked}
            onChange=${() => handleCorrectAnswerChange(question.id, bookId, chapterId, attemptId)} />
          <label for=${"correct-" + question.id + "-true"} style="margin:0">${t("common.trueLabel")}</label>
        </div>
        <div class="choice-row">
          <input type="radio" name=${"correct-" + question.id} id=${"correct-" + question.id + "-false"} value="false" checked=${falseChecked}
            onChange=${() => handleCorrectAnswerChange(question.id, bookId, chapterId, attemptId)} />
          <label for=${"correct-" + question.id + "-false"} style="margin:0">${t("common.falseLabel")}</label>
        </div>
      `;
    }

    return html`
      <div class="card" id=${"q-card-" + (idx + 1)} key=${response.questionId}>
        <h2>${t("common.questionN", { n: idx + 1 })}</h2>
        <p>${t("review.yourAnswerLine")} <strong>${chosenLabel}</strong> — <span class=${statusClass}>${statusText}</span></p>
        <fieldset><legend>${t("chapterDetail.colCorrectAnswer")}</legend>${correctInput}</fieldset>
        <p class="save-flash" id=${"save-flash-" + question.id} aria-live="polite">${isLocked ? t("review.saved") : ""}</p>
      </div>
    `;
  });

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>${t("review.reviewAndGrade")}</h1>
    <p class="wizard-progress">${t("review.gradedProgress", { graded: gradedCount, total: attempt.responses.length, correct: correctCount })}</p>
    <p>${t("review.hint")}</p>
    <div class="filter-tabs" role="group" aria-label=${t("review.displayModeLabel")}>
      <button type="button" aria-pressed=${!compact} onClick=${() => setReviewCompact(bookId, chapterId, attemptId, false)}>${t("review.detailed")}</button>
      <button type="button" aria-pressed=${compact} onClick=${() => setReviewCompact(bookId, chapterId, attemptId, true)}>${t("review.compact")}</button>
    </div>
    ${compact
      ? html`<div class="table-wrap"><table><thead><tr><th scope="col">${t("chapterDetail.colNum")}</th><th scope="col">${t("review.colYourAnswer")}</th><th scope="col">${t("review.colStatus")}</th><th scope="col">${t("chapterDetail.colCorrectAnswer")}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : rows}
  `);

  if (scrollToQuestionNum !== null) {
    const target = document.getElementById("q-card-" + scrollToQuestionNum);
    scrollToQuestionNum = null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("highlight-card");
      setTimeout(() => target.classList.remove("highlight-card"), 2000);
    }
  }
}

function handleCorrectAnswerChange(questionId, bookId, chapterId, attemptId) {
  const inputs = document.querySelectorAll('input[name="correct-' + questionId + '"]:checked');
  const values = Array.from(inputs).map((el) => el.value);
  if (!values.length) return;
  applyCorrectAnswer(questionId, values);
  renderReview(bookId, chapterId, attemptId);
  const flash = document.getElementById("save-flash-" + questionId);
  if (flash) flash.textContent = t("review.savedCheck");
}

function setReviewCompact(bookId, chapterId, attemptId, compact) {
  uiState.reviewCompact = compact;
  uiState.compactEditQuestionId = null;
  renderReview(bookId, chapterId, attemptId);
}

// Multi-select MCQ correct answers don't fit a single <select>, so compact
// mode shows them as a summary with an inline expand-to-edit instead.
function toggleCompactEdit(bookId, chapterId, attemptId, questionId) {
  uiState.compactEditQuestionId = uiState.compactEditQuestionId === questionId ? null : questionId;
  renderReview(bookId, chapterId, attemptId);
}

function handleCompactSelectChange(questionId, value, bookId, chapterId, attemptId) {
  if (!value) return;
  applyCorrectAnswer(questionId, [value]);
  renderReview(bookId, chapterId, attemptId);
}

function renderCompactReviewRow(bookId, chapterId, attemptId, question, idx, chosenLabel, statusClass, statusText, isLocked) {
  let correctCell;
  if (question.type === "mcq" && question.config.multiSelect) {
    if (uiState.compactEditQuestionId === question.id) {
      const checkboxes = question.config.optionLabels.map((label) => {
        const checked = question.correctAnswer && question.correctAnswer.includes(label);
        return html`
          <div class="choice-row" key=${label}>
            <input type="checkbox" name=${"correct-" + question.id} id=${"correct-" + question.id + "-" + label} value=${label} checked=${checked}
              onChange=${() => handleCorrectAnswerChange(question.id, bookId, chapterId, attemptId)} />
            <label for=${"correct-" + question.id + "-" + label} style="margin:0">${label}</label>
          </div>
        `;
      });
      correctCell = html`
        <fieldset><legend class="sr-only">${t("review.correctAnswerForQuestion", { n: idx + 1 })}</legend>${checkboxes}</fieldset>
        <button type="button" class="link-inline" onClick=${() => toggleCompactEdit(bookId, chapterId, attemptId, question.id)}>${t("review.done")}</button>
      `;
    } else {
      const label = isLocked ? question.correctAnswer.map(formatAnswerValue).join(", ") : t("review.notSet");
      correctCell = html`<button type="button" class="link-inline" onClick=${() => toggleCompactEdit(bookId, chapterId, attemptId, question.id)}>${label}</button>`;
    }
  } else {
    const options = question.type === "mcq" ? question.config.optionLabels : ["true", "false"];
    correctCell = html`
      <select aria-label=${t("review.correctAnswerForQuestion", { n: idx + 1 })}
        onChange=${(e) => handleCompactSelectChange(question.id, e.target.value, bookId, chapterId, attemptId)}>
        <option value="" selected=${!isLocked}>${t("review.notSet")}</option>
        ${options.map((opt) => html`
          <option value=${opt} selected=${isLocked && question.correctAnswer.includes(opt)} key=${opt}>${question.type === "truefalse" ? formatAnswerValue(opt) : opt}</option>
        `)}
      </select>
    `;
  }

  return html`
    <tr id=${"q-row-" + (idx + 1)} key=${question.id}>
      <td>${idx + 1}</td>
      <td>${chosenLabel}</td>
      <td><span class=${statusClass}>${statusText}</span></td>
      <td>${correctCell}</td>
    </tr>
  `;
}
