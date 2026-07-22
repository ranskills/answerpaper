/* Home screen (#/). */

function renderHome() {
  document.title = t("common.appName");
  const attempts = Store.attempts
    .slice()
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 8);

  const rows = attempts.map((attempt) => {
    const chapter = Store.chapters.find((c) => c.id === attempt.chapterId);
    if (!chapter) return null;
    const book = Store.books.find((b) => b.id === chapter.bookId);
    const score = formatScoreLabel(computeAttemptScore(Store, attempt), true);
    return html`
      <tr key=${attempt.id}>
        <td>
          <a href=${"#/books/" + book.id + "/chapters/" + chapter.id}
            >${book.title} › ${chapter.title}</a
          >
        </td>
        <td>${formatDate(attempt.finishedAt)}</td>
        <td>${score}</td>
      </tr>
    `;
  });

  const onboarding =
    Store.books.length === 0
      ? html`<p class="onboarding-hint">
            ${t("home.onboardingPre")}
            <strong>${t("home.onboardingBook")}</strong> ${t("home.onboardingMid1")}
            <strong>${t("home.onboardingChapter")}</strong> ${t("home.onboardingMid2")}
            <strong>${t("home.onboardingAttempt")}</strong> ${t("home.onboardingPost")}
          </p>
          <p class="onboarding-hint">${t("home.privacyNote")}</p>`
      : null;

  const continueChapter = Store.attempts.length ? computeContinueChapter(Store) : null;
  const continueTrend = continueChapter
    ? renderTrendBadge(computeChapterScoreTrend(Store, continueChapter.chapter.id))
    : null;
  const continueCard = continueChapter
    ? html`
        <div class="card">
          <h2>${t("home.continueStudying")}</h2>
          <p class="card-meta" style="margin: 0">
            <a href=${"#/books/" + continueChapter.book.id + "/chapters"}
              >${continueChapter.book.title}</a
            >
          </p>
          <p style="margin: 0 0 var(--space-2) 0">
            <a
              class="card-link"
              href=${"#/books/" + continueChapter.book.id + "/chapters/" + continueChapter.chapter.id}
              >${continueChapter.chapter.title}</a
            >
          </p>
          <p class="card-meta" style="margin: 0">
            ${t("home.lastAttempt", { score: formatScoreLabel(computeAttemptScore(Store, continueChapter.attempt), true), date: formatDate(continueChapter.attempt.finishedAt) })}${continueTrend ? html` · ${continueTrend}` : null}
          </p>
          <div class="btn-row">
            <a
              class="btn primary"
              href=${"#/books/" + continueChapter.book.id + "/chapters/" + continueChapter.chapter.id + "/attempt"}
              >${t("home.retake")}</a
            >
            <a
              class="btn"
              href=${"#/books/" + continueChapter.book.id + "/chapters/" + continueChapter.chapter.id + "/trends"}
              >${t("home.viewTrends")}</a
            >
          </div>
        </div>
      `
    : null;

  const stats = Store.books.length ? computeOverallStats(Store) : null;
  const statTiles = stats
    ? html`
        <div class="stat-row">
          <div class="stat-tile">
            <div class="stat-value">
              ${stats.bookCount} <span class="stat-value-secondary">/ ${stats.chapterCount}</span>
            </div>
            <div class="stat-label">${t("home.booksChapters")}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${stats.attemptCount}</div>
            <div class="stat-label">${tn("home.attempts", stats.attemptCount)}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${stats.streakDays}</div>
            <div class="stat-label">${t("home.dayStreak")}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value">${formatMinutes(stats.totalStudyMinutes)}</div>
            <div class="stat-label">${t("home.timeStudied")}</div>
          </div>
        </div>
      `
    : null;

  const needsAttentionItemText = {
    "not-started": () => t("home.notStartedYet"),
    ungraded: (item) => tn("common.questionsNotGraded", item.ungradedCount),
    flagged: (item) => tn("home.flaggedToReview", item.flaggedWrongCount),
  };
  const needsAttention = computeNeedsAttention(Store, 5);
  const needsAttentionCard = needsAttention.length
    ? html`
        <div class="card">
          <h2>${t("home.needsAttention")}</h2>
          <ul class="plain-list">
            ${needsAttention.map((item) => {
              const href =
                item.type === "not-started"
                  ? "#/books/" + item.book.id + "/chapters/" + item.chapter.id
                  : "#/books/" +
                    item.book.id +
                    "/chapters/" +
                    item.chapter.id +
                    "/attempt/" +
                    item.attemptId +
                    "/review";
              return html`
                <li key=${item.chapter.id}>
                  <a href=${href}>${item.book.title} › ${item.chapter.title}</a>
                  <span class="status-ungraded">· ${needsAttentionItemText[item.type](item)}</span>
                </li>
              `;
            })}
          </ul>
        </div>
      `
    : null;

  mount(html`
    <h1>${t("home.title")}</h1>
    ${onboarding} ${continueCard} ${statTiles} ${needsAttentionCard}
    <div class="card">
      <h2>${t("home.recentActivity")}</h2>
      ${
        attempts.length
          ? html`<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">${t("home.colChapter")}</th>
                    <th scope="col">${t("home.colDate")}</th>
                    <th scope="col">${t("home.colScore")}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>`
          : html`<p>
              ${t("home.noAttemptsPre")} <a href="#/books">${t("home.noAttemptsLink")}</a>.
            </p>`
      }
    </div>
    ${
      Store.books.length === 0
        ? html`<div class="btn-row">
            <a class="btn primary" href="#/books">${t("home.getStarted")}</a
            ><button type="button" onClick=${handleLoadSampleData}>
              ${t("home.loadSampleData")}
            </button>
          </div>`
        : null
    }
  `);
}
