/* Trends screen. */

function renderTrends(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount(html`<p>${t("common.notFound")}</p>`);
  document.title = t("trends.docTitle") + " " + chapter.title + " — " + t("common.appName");

  const chapterSeries = computeChapterTrend(Store, chapterId);
  const weakest = weakestQuestions(Store, chapterId, 5);
  const anyGraded = chapter.questionOrder.some((qid) =>
    computeQuestionTrend(Store, qid).sequence.some((s) => s.correct !== null),
  );

  const weakestRows = weakest.map(
    (w) => html`
      <tr key=${w.questionId}>
        <td>
          <button
            type="button"
            class="link-inline"
            onClick=${() => jumpToWeakestQuestion(bookId, chapterId, w.questionNumber)}
          >
            ${t("common.questionN", { n: w.questionNumber })}
          </button>
        </td>
        <td>${Math.round(w.incorrectRate * 100)}%</td>
        <td>${w.gradedCount}</td>
      </tr>
    `,
  );

  const questionRows = chapter.questionOrder.map((qid, idx) => {
    const trend = computeQuestionTrend(Store, qid);
    const seq = trend.sequence.map((s) => {
      const statusClass =
        s.correct === null ? "status-ungraded" : s.correct ? "status-correct" : "status-incorrect";
      const symbol = s.correct === null ? "–" : s.correct ? "✓" : "✗";
      return html`<span class=${statusClass} key=${s.attemptId}>${symbol}</span>`;
    });
    return html`<tr key=${qid}>
      <td>${t("common.questionN", { n: idx + 1 })}</td>
      <td>${seq.length ? seq : t("trends.noAttempts")}</td>
    </tr>`;
  });

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>${t("trends.trendsTitle", { title: chapter.title })}</h1>
    ${
      chapterSeries.length
        ? html`<div class="card">
            <h2>${t("common.scoreOverTime")}</h2>
            ${renderScoreLineChart(chapterSeries)}
          </div>`
        : null
    }
    <div class="card">
      <h2>${t("trends.weakestQuestions")}</h2>
      ${
        weakestRows.length
          ? html`<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">${t("trends.colQuestion")}</th>
                    <th scope="col">${t("trends.colIncorrectRate")}</th>
                    <th scope="col">${t("trends.colGradedAttempts")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${weakestRows}
                </tbody>
              </table>
            </div>`
          : anyGraded
            ? html`<p>${t("trends.noIncorrectYet")}</p>`
            : html`<p>${t("trends.notEnoughGraded")}</p>`
      }
    </div>
    <div class="card">
      <h2>${t("trends.perQuestionHistory")}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">${t("trends.colQuestion")}</th>
              <th scope="col">${t("trends.colAttemptSequence")}</th>
            </tr>
          </thead>
          <tbody>
            ${questionRows}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function jumpToWeakestQuestion(bookId, chapterId, questionNumber) {
  const attempts = attemptsForChapter(Store, chapterId);
  if (!attempts.length) return;
  const latest = attempts[attempts.length - 1];
  scrollToQuestionNum = questionNumber;
  uiState.reviewCompact = false; // the scroll/highlight target only exists in detailed view
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + latest.id + "/review");
  render();
}
