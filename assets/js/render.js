/* Screen rendering. Reads Store, writes into #main via Preact. Full re-render on every change. */

const html = self.htm.bind(self.preact.h);
const preactRender = self.preact.render;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(getLang(), { year: "numeric", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(getLang(), { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString(getLang(), { month: "short", day: "numeric" });
}

function formatMinutes(totalMinutes) {
  if (totalMinutes < 1) return t("common.minutesLessThanOne");
  if (totalMinutes < 60) return t("common.minutesShort", { minutes: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return t("common.hoursMinutes", { hours, minutes });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(kb < 10 ? 1 : 0) + " KB";
  return (kb / 1024).toFixed(2) + " MB";
}

function formatDuration(startedAt, finishedAt) {
  const ms = new Date(finishedAt) - new Date(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return formatMinutes(Math.round(ms / 60000));
}

function formatAnswerValue(value) {
  if (value === "true") return t("common.trueLabel");
  if (value === "false") return t("common.falseLabel");
  return value;
}

function formatChosenSummary(chosen) {
  return chosen.length ? chosen.map(formatAnswerValue).join(", ") : "";
}

function renderTrendBadge(trend) {
  if (trend === "improving") return html`<span class="status-correct">${t("common.trendImproving")}</span>`;
  if (trend === "declining") return html`<span class="status-incorrect">${t("common.trendDeclining")}</span>`;
  if (trend === "steady") return html`<span class="status-ungraded">${t("common.trendSteady")}</span>`;
  return null;
}

function formatScoreLabel(score, compact) {
  if (score.lockedCount === 0) return t("common.ungraded");
  const parts = [score.scorePercent + "%"];
  if (compact) return parts[0];
  const notes = [];
  if (score.unansweredCount > 0) notes.push(t("common.unansweredCount", { count: score.unansweredCount }));
  if (score.trulyUngradedCount > 0) notes.push(tn("common.questionsNotGraded", score.trulyUngradedCount));
  if (notes.length) parts.push("(" + notes.join(", ") + ")");
  return parts.join(" ");
}

// Preact's keyed diffing already preserves focus across re-renders for
// elements that keep the same position/key, so unlike the plain-string
// innerHTML approach this replaced, we only need to handle the case where
// the previously-focused element's vnode genuinely didn't exist before this
// render (a brand-new wizard stage, a freshly-opened form) — there's no old
// vnode to diff against, so Preact creates a fresh DOM node and focus is
// otherwise silently dropped to <body>.
function mount(vnode) {
  const main = document.getElementById("main");
  const hadFocusInMain = !!(document.activeElement && main.contains(document.activeElement));

  preactRender(vnode, main);

  if (document.activeElement && main.contains(document.activeElement)) return;

  const marked = main.querySelector("[autofocus]");
  if (marked) {
    marked.focus();
    return;
  }

  if (hadFocusInMain) {
    const heading = main.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }
}

// For actions with an obvious place to return focus to (closing an inline
// form back to the button that opened it, saving a rename back onto that
// row's Rename button) — call after the re-render so it overrides mount()'s
// generic heading fallback, which has no way to know about that specific spot.
function focusById(id) {
  const el = document.getElementById(id);
  if (el) el.focus();
}

function updateNavActiveState() {
  const parts = currentRoute();
  const homeLink = document.querySelector('nav a[href="#/"]');
  const booksLink = document.querySelector('nav a[href="#/books"]');
  const dataLink = document.querySelector('nav a[href="#/data"]');
  const isHome = parts.length === 0;
  const isBooks = parts[0] === "books";
  const isData = parts[0] === "data";
  if (homeLink) {
    if (isHome) homeLink.setAttribute("aria-current", "page");
    else homeLink.removeAttribute("aria-current");
  }
  if (booksLink) {
    if (isBooks) booksLink.setAttribute("aria-current", "page");
    else booksLink.removeAttribute("aria-current");
  }
  if (dataLink) {
    if (isData) dataLink.setAttribute("aria-current", "page");
    else dataLink.removeAttribute("aria-current");
  }
}

function render() {
  updateNavActiveState();
  const parts = currentRoute();
  if (parts.length === 0) return renderHome();
  if (parts[0] === "data" && parts.length === 1) return renderData();
  if (parts[0] === "books" && parts.length === 1) return renderBookList();
  if (parts[0] === "books" && parts[1] && parts[2] === "chapters" && parts.length === 3) {
    return renderChapterList(parts[1]);
  }
  if (parts[0] === "books" && parts[2] === "chapters" && parts[3] && parts.length === 4) {
    return renderChapterDetail(parts[1], parts[3]);
  }
  if (parts[4] === "attempt" && parts.length === 5) {
    return renderAttemptWizard(parts[1], parts[3]);
  }
  if (parts[4] === "attempt" && parts[5] && parts[6] === "review") {
    return renderReview(parts[1], parts[3], parts[5]);
  }
  if (parts[4] === "trends") {
    return renderTrends(parts[1], parts[3]);
  }
  if (parts[4] === "print") {
    return renderPrintTrigger(parts[1], parts[3]);
  }
  mount(html`<p>${t("common.pageNotFound")} <a href="#/">${t("common.goHome")}</a>.</p>`);
}

/* ---------- Home ---------- */

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
        <td><a href=${"#/books/" + book.id + "/chapters/" + chapter.id}>${book.title} › ${chapter.title}</a></td>
        <td>${formatDate(attempt.finishedAt)}</td>
        <td>${score}</td>
      </tr>
    `;
  });

  const onboarding = Store.books.length === 0
    ? html`<p class="onboarding-hint">${t("home.onboardingPre")} <strong>${t("home.onboardingBook")}</strong> ${t("home.onboardingMid1")} <strong>${t("home.onboardingChapter")}</strong> ${t("home.onboardingMid2")} <strong>${t("home.onboardingAttempt")}</strong> ${t("home.onboardingPost")}</p>`
    : null;

  const continueChapter = Store.attempts.length ? computeContinueChapter(Store) : null;
  const continueTrend = continueChapter ? renderTrendBadge(computeChapterScoreTrend(Store, continueChapter.chapter.id)) : null;
  const continueCard = continueChapter ? html`
    <div class="card">
      <h2>${t("home.continueStudying")}</h2>
      <p class="card-meta" style="margin: 0"><a href=${"#/books/" + continueChapter.book.id + "/chapters"}>${continueChapter.book.title}</a></p>
      <p style="margin: 0 0 var(--space-2) 0"><a class="card-link" href=${"#/books/" + continueChapter.book.id + "/chapters/" + continueChapter.chapter.id}>${continueChapter.chapter.title}</a></p>
      <p class="card-meta" style="margin: 0">${t("home.lastAttempt", { score: formatScoreLabel(computeAttemptScore(Store, continueChapter.attempt), true), date: formatDate(continueChapter.attempt.finishedAt) })}${continueTrend ? html` · ${continueTrend}` : null}</p>
      <div class="btn-row">
        <a class="btn primary" href=${"#/books/" + continueChapter.book.id + "/chapters/" + continueChapter.chapter.id + "/attempt"}>${t("home.retake")}</a>
        <a class="btn" href=${"#/books/" + continueChapter.book.id + "/chapters/" + continueChapter.chapter.id + "/trends"}>${t("home.viewTrends")}</a>
      </div>
    </div>
  ` : null;

  const stats = Store.books.length ? computeOverallStats(Store) : null;
  const statTiles = stats ? html`
    <div class="stat-row">
      <div class="stat-tile">
        <div class="stat-value">${stats.bookCount} <span class="stat-value-secondary">/ ${stats.chapterCount}</span></div>
        <div class="stat-label">${t("home.booksChapters")}</div>
      </div>
      <div class="stat-tile"><div class="stat-value">${stats.attemptCount}</div><div class="stat-label">${tn("home.attempts", stats.attemptCount)}</div></div>
      <div class="stat-tile"><div class="stat-value">${stats.streakDays}</div><div class="stat-label">${t("home.dayStreak")}</div></div>
      <div class="stat-tile"><div class="stat-value">${formatMinutes(stats.totalStudyMinutes)}</div><div class="stat-label">${t("home.timeStudied")}</div></div>
    </div>
  ` : null;

  const needsAttentionItemText = {
    "not-started": () => t("home.notStartedYet"),
    "ungraded": (item) => tn("common.questionsNotGraded", item.ungradedCount),
    "flagged": (item) => tn("home.flaggedToReview", item.flaggedWrongCount),
  };
  const needsAttention = computeNeedsAttention(Store, 5);
  const needsAttentionCard = needsAttention.length ? html`
    <div class="card">
      <h2>${t("home.needsAttention")}</h2>
      <ul class="plain-list">
        ${needsAttention.map((item) => {
          const href = item.type === "not-started"
            ? "#/books/" + item.book.id + "/chapters/" + item.chapter.id
            : "#/books/" + item.book.id + "/chapters/" + item.chapter.id + "/attempt/" + item.attemptId + "/review";
          return html`
            <li key=${item.chapter.id}>
              <a href=${href}>${item.book.title} › ${item.chapter.title}</a> <span class="status-ungraded">· ${needsAttentionItemText[item.type](item)}</span>
            </li>
          `;
        })}
      </ul>
    </div>
  ` : null;

  mount(html`
    <h1>${t("home.title")}</h1>
    ${onboarding}
    ${continueCard}
    ${statTiles}
    ${needsAttentionCard}
    <div class="card">
      <h2>${t("home.recentActivity")}</h2>
      ${attempts.length
        ? html`<div class="table-wrap"><table><thead><tr><th scope="col">${t("home.colChapter")}</th><th scope="col">${t("home.colDate")}</th><th scope="col">${t("home.colScore")}</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : html`<p>${t("home.noAttemptsPre")} <a href="#/books">${t("home.noAttemptsLink")}</a>.</p>`}
    </div>
    ${Store.books.length === 0
      ? html`<div class="btn-row"><a class="btn primary" href="#/books">${t("home.getStarted")}</a><button type="button" onClick=${handleLoadSampleData}>${t("home.loadSampleData")}</button></div>`
      : null}
  `);
}

/* ---------- Books ---------- */

let uiState = {
  addBookOpen: false, addChapterOpen: false, renameBookId: null, renameChapterId: null,
  addQuestionOpen: false, addQuestionDraft: null, bookFilter: "active", chapterDetailTab: "attempts",
  reviewCompact: false, compactEditQuestionId: null,
};

function renderBookCard(book) {
  const chapterCount = Store.chapters.filter((c) => c.bookId === book.id).length;
  if (uiState.renameBookId === book.id) {
    return html`
      <li class="card" key=${book.id}>
        <form onSubmit=${(e) => handleRenameBook(e, book.id)}>
          <label for="rename-book-title">${t("books.renameBook")}</label>
          <input id="rename-book-title" type="text" value=${book.title} required autofocus />
          <div class="btn-row">
            <button type="submit" class="primary">${t("common.save")}</button>
            <button type="button" onClick=${() => toggleRenameBookForm(null)}>${t("common.cancel")}</button>
          </div>
        </form>
      </li>
    `;
  }
  return html`
    <li class="card" key=${book.id}>
      <a class="card-link" href=${"#/books/" + book.id + "/chapters"}><h2>${book.title}</h2></a>
      <p class="card-meta">${tn("common.chapter", chapterCount)}${book.archived ? html` · <span class="status-ungraded">${t("books.archived")}</span>` : null}</p>
      <div class="btn-row">
        <button type="button" id=${"book-rename-" + book.id} onClick=${() => toggleRenameBookForm(book.id)}>${t("common.rename")}</button>
        ${book.archived
          ? html`<button type="button" id=${"book-unarchive-" + book.id} onClick=${() => handleUnarchiveBook(book.id)}>${t("common.unarchive")}</button>`
          : html`<button type="button" id=${"book-archive-" + book.id} onClick=${() => handleArchiveBook(book.id)}>${t("common.archive")}</button>`}
        <button type="button" id=${"book-delete-" + book.id} class="danger" onClick=${() => promptDeleteBook(book.id)}>${t("common.delete")}</button>
      </div>
    </li>
  `;
}

function renderBookList() {
  document.title = t("books.title") + " — " + t("common.appName");
  const sortByActivity = (a, b) => new Date(bookLastActivity(Store, b.id)) - new Date(bookLastActivity(Store, a.id));
  const allBooks = Store.books.slice().sort(sortByActivity);
  const activeBooks = allBooks.filter((b) => !b.archived);
  const archivedBooks = allBooks.filter((b) => b.archived);

  // The filter only matters once there's at least one archived book — otherwise
  // "All"/"Active" are identical and "Archived" is always empty.
  const filter = archivedBooks.length ? uiState.bookFilter : "active";
  const booksForFilter = { all: allBooks, active: activeBooks, archived: archivedBooks }[filter];
  const cards = booksForFilter.map(renderBookCard);

  const filterBar = archivedBooks.length
    ? html`
      <div class="filter-tabs" role="group" aria-label=${t("books.filterGroupLabel")}>
        <button type="button" aria-pressed=${filter === "all"} onClick=${() => setBookFilter("all")}>${t("books.filterAll", { count: allBooks.length })}</button>
        <button type="button" aria-pressed=${filter === "active"} onClick=${() => setBookFilter("active")}>${t("books.filterActive", { count: activeBooks.length })}</button>
        <button type="button" aria-pressed=${filter === "archived"} onClick=${() => setBookFilter("archived")}>${t("books.filterArchived", { count: archivedBooks.length })}</button>
      </div>
    `
    : null;

  const addForm = uiState.addBookOpen
    ? html`
      <div class="card">
        <form onSubmit=${handleAddBook}>
          <label for="new-book-title">${t("books.newBookTitle")}</label>
          <input id="new-book-title" type="text" placeholder=${t("books.newBookPlaceholder")} required autofocus />
          <div class="btn-row">
            <button type="submit" class="primary">${t("books.addBook")}</button>
            <button type="button" onClick=${() => toggleAddBookForm(false)}>${t("common.cancel")}</button>
          </div>
        </form>
      </div>
    `
    : html`<div class="btn-row"><button type="button" id="add-book-toggle" class="primary" onClick=${() => toggleAddBookForm(true)}>${t("books.addBookToggle")}</button></div>`;

  const sortHint = booksForFilter.length > 1
    ? html`<p class="list-sort-hint">${t("common.sortHint")}</p>`
    : null;

  let booksSection;
  if (cards.length) {
    booksSection = html`<ul class="card-list">${cards}</ul>`;
  } else if (filter === "archived") {
    booksSection = html`<div class="card"><p>${t("books.noArchivedBooks")}</p></div>`;
  } else if (filter === "active" && archivedBooks.length) {
    booksSection = html`<div class="card"><p>${t("books.noActiveBooks")}</p></div>`;
  } else {
    booksSection = html`<div class="card"><p>${t("books.noBooksYet")}</p></div>`;
  }

  mount(html`
    <h1>${t("books.title")}</h1>
    ${Store.books.length === 0 ? html`
      <p class="onboarding-hint">${t("books.onboardingHint")}</p>
      <div class="btn-row"><button type="button" onClick=${handleLoadSampleData}>${t("common.loadSampleData")}</button></div>
    ` : null}
    ${filterBar}
    ${sortHint}
    ${addForm}
    ${booksSection}
  `);
}

function setBookFilter(filter) {
  uiState.bookFilter = filter;
  renderBookList();
}

function handleArchiveBook(bookId) {
  archiveBook(bookId);
  renderBookList();
}

function handleUnarchiveBook(bookId) {
  unarchiveBook(bookId);
  renderBookList();
}

function handleLoadSampleData() {
  loadSampleData();
  renderHome();
}

function promptResetAllData() {
  const counts = allDataCounts();
  const ok = confirm(t("books.confirmDeleteAll", {
    books: tn("common.book", counts.bookCount),
    chapters: tn("common.chapter", counts.chapterCount),
    attempts: tn("common.attempt", counts.attemptCount),
  }));
  if (ok) {
    resetStore();
    renderData();
  }
}

/* ---------- Data ---------- */

function renderData() {
  document.title = t("data.title") + " — " + t("common.appName");
  const archivedCount = Store.books.filter((b) => b.archived).length;
  const earliestBookDate = Store.books.reduce(
    (earliest, b) => (!earliest || b.createdAt < earliest ? b.createdAt : earliest),
    null
  );
  const lastExportAt = getLastExportAt();

  const emptyState = Store.books.length === 0
    ? html`
      <div class="card">
        <p>${t("data.emptyHint")}</p>
        <div class="btn-row"><button type="button" onClick=${handleLoadSampleData}>${t("common.loadSampleData")}</button></div>
      </div>
    `
    : null;

  const dangerCard = Store.books.length
    ? html`
      <div class="card card-danger">
        <h2>${t("data.dangerZone")}</h2>
        <p class="card-meta" style="margin: 0">${t("data.dangerHint")}</p>
        <div class="btn-row"><button type="button" class="danger" onClick=${promptResetAllData}>${t("data.clearAllData")}</button></div>
      </div>
    `
    : null;

  mount(html`
    <h1>${t("data.title")}</h1>
    ${emptyState}
    <div class="card">
      <h2>${t("data.storage")}</h2>
      <p class="card-meta" style="margin: 0">${t("data.storedInBrowser", { size: formatBytes(dataStorageBytes()) })}${archivedCount ? html` · ${tn("common.archivedBook", archivedCount)}` : null}</p>
      ${earliestBookDate ? html`<p class="card-meta" style="margin: 0">${t("data.trackingSince", { date: formatDateShort(earliestBookDate) })}</p>` : null}
    </div>
    <div class="card">
      <h2>${t("data.backup")}</h2>
      <p class="card-meta" style="margin: 0">${lastExportAt ? t("data.lastExported", { date: formatDate(lastExportAt) }) : t("data.neverExported")}</p>
      <div class="btn-row">
        <button type="button" class="primary" onClick=${handleExportData}>${t("data.exportData")}</button>
        <label class="import-label" for="import-input">${t("data.importData")}
          <input id="import-input" type="file" accept="application/json" onChange=${handleImportFile} />
        </label>
      </div>
    </div>
    ${dangerCard}
  `);
}

function handleExportData() {
  exportData();
  renderData();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const summary = { books: Store.books.length, chapters: Store.chapters.length, attempts: Store.attempts.length };
  const ok = confirm(t("data.confirmImport", {
    books: tn("common.book", summary.books),
    chapters: tn("common.chapter", summary.chapters),
    attempts: tn("common.attempt", summary.attempts),
  }));
  if (!ok) {
    e.target.value = "";
    return;
  }
  importData(file, (err) => {
    e.target.value = "";
    if (err) {
      alert(t("data.importFailed", { message: err.message }));
      return;
    }
    navigate("/");
    render();
  });
}

function toggleAddBookForm(open) {
  uiState.addBookOpen = open;
  renderBookList();
  if (!open) focusById("add-book-toggle");
}

function handleAddBook(event) {
  event.preventDefault();
  const input = document.getElementById("new-book-title");
  const title = input.value.trim();
  if (!title) return false;
  addBook(title);
  uiState.addBookOpen = false;
  renderBookList();
  focusById("add-book-toggle");
  return false;
}

function toggleRenameBookForm(bookId) {
  const wasRenamingId = uiState.renameBookId;
  uiState.renameBookId = bookId;
  renderBookList();
  if (bookId === null && wasRenamingId) focusById("book-rename-" + wasRenamingId);
}

function handleRenameBook(event, bookId) {
  event.preventDefault();
  const input = document.getElementById("rename-book-title");
  const title = input.value.trim();
  if (!title) return false;
  renameBook(bookId, title);
  uiState.renameBookId = null;
  renderBookList();
  focusById("book-rename-" + bookId);
  return false;
}

function promptDeleteBook(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  const counts = bookCascadeCounts(bookId);
  const ok = confirm(t("books.confirmDeleteBook", {
    title: book.title,
    chapters: tn("common.chapter", counts.chapterCount),
    attempts: tn("common.attempt", counts.attemptCount),
  }));
  if (ok) {
    deleteBook(bookId);
    renderBookList();
  }
}

/* ---------- Chapters ---------- */

function renderChapterList(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  if (!book) return mount(html`<p>${t("chapters.bookNotFound")} <a href="#/books">${t("common.goBack")}</a>.</p>`);
  document.title = book.title + " — " + t("common.appName");

  const chapters = Store.chapters
    .filter((c) => c.bookId === bookId)
    .sort((a, b) => new Date(chapterLastActivity(Store, b.id)) - new Date(chapterLastActivity(Store, a.id)));

  const cards = chapters.map((chapter) => {
    const chapterAttempts = Store.attempts.filter((a) => a.chapterId === chapter.id);
    const attemptCount = chapterAttempts.length;
    const scores = computeChapterTrend(Store, chapter.id)
      .map((s) => s.scorePercent)
      .filter((p) => p !== null);
    const statsLine = scores.length
      ? t("chapters.statsLineWithScores", {
          attempts: tn("common.attempt", attemptCount),
          avg: Math.round(scores.reduce((sum, p) => sum + p, 0) / scores.length),
          best: Math.max(...scores),
        })
      : tn("common.attempt", attemptCount);
    const trendLine = renderTrendBadge(computeChapterScoreTrend(Store, chapter.id));
    const lastAttemptDate = chapterAttempts.length
      ? chapterAttempts.reduce((latest, a) => (new Date(a.finishedAt) > new Date(latest) ? a.finishedAt : latest), chapterAttempts[0].finishedAt)
      : null;

    if (uiState.renameChapterId === chapter.id) {
      return html`
        <li class="card" key=${chapter.id}>
          <form onSubmit=${(e) => handleRenameChapter(e, bookId, chapter.id)}>
            <label for="rename-chapter-title">${t("chapters.renameChapter")}</label>
            <input id="rename-chapter-title" type="text" value=${chapter.title} required autofocus />
            <div class="btn-row">
              <button type="submit" class="primary">${t("common.save")}</button>
              <button type="button" onClick=${() => toggleRenameChapterForm(null, bookId)}>${t("common.cancel")}</button>
            </div>
          </form>
        </li>
      `;
    }
    return html`
      <li class="card" key=${chapter.id}>
        <a class="card-link" href=${"#/books/" + bookId + "/chapters/" + chapter.id}><h2>${chapter.title}</h2></a>
        <p class="card-meta">${statsLine}${lastAttemptDate ? html` · ${t("chapters.lastAttempt", { date: formatDateShort(lastAttemptDate) })}` : null}${trendLine ? html` · ${trendLine}` : null}</p>
        <div class="btn-row">
          <button type="button" id=${"chapter-rename-" + chapter.id} onClick=${() => toggleRenameChapterForm(chapter.id, bookId)}>${t("common.rename")}</button>
          <button type="button" id=${"chapter-delete-" + chapter.id} class="danger" onClick=${() => promptDeleteChapter(bookId, chapter.id)}>${t("common.delete")}</button>
        </div>
      </li>
    `;
  });

  const addForm = uiState.addChapterOpen
    ? html`
      <div class="card">
        <form onSubmit=${(e) => handleAddChapter(e, bookId)}>
          <label for="new-chapter-title">${t("chapters.newChapterTitle")}</label>
          <input id="new-chapter-title" type="text" placeholder=${t("chapters.newChapterPlaceholder")} required autofocus />
          <div class="btn-row">
            <button type="submit" class="primary">${t("chapters.addChapter")}</button>
            <button type="button" onClick=${() => toggleAddChapterForm(false, bookId)}>${t("common.cancel")}</button>
          </div>
        </form>
      </div>
    `
    : html`<div class="btn-row"><button type="button" id="add-chapter-toggle" class="primary" onClick=${() => toggleAddChapterForm(true, bookId)}>${t("chapters.addChapterToggle")}</button></div>`;

  const sortHint = chapters.length > 1
    ? html`<p class="list-sort-hint">${t("common.sortHint")}</p>`
    : null;

  mount(html`
    <p><a href="#/books">${t("chapters.allBooks")}</a></p>
    <h1>${book.title}${book.archived ? html` <span class="status-ungraded">(${t("books.archived")})</span>` : null}</h1>
    ${sortHint}
    ${addForm}
    ${cards.length ? html`<ul class="card-list">${cards}</ul>` : html`<div class="card"><p>${t("chapters.noChaptersYet")}</p></div>`}
  `);
}

function toggleAddChapterForm(open, bookId) {
  uiState.addChapterOpen = open;
  renderChapterList(bookId);
  if (!open) focusById("add-chapter-toggle");
}

function handleAddChapter(event, bookId) {
  event.preventDefault();
  const input = document.getElementById("new-chapter-title");
  const title = input.value.trim();
  if (!title) return false;
  addChapter(bookId, title);
  uiState.addChapterOpen = false;
  renderChapterList(bookId);
  focusById("add-chapter-toggle");
  return false;
}

function toggleRenameChapterForm(chapterId, bookId) {
  const wasRenamingId = uiState.renameChapterId;
  uiState.renameChapterId = chapterId;
  renderChapterList(bookId);
  if (chapterId === null && wasRenamingId) focusById("chapter-rename-" + wasRenamingId);
}

function handleRenameChapter(event, bookId, chapterId) {
  event.preventDefault();
  const input = document.getElementById("rename-chapter-title");
  const title = input.value.trim();
  if (!title) return false;
  renameChapter(chapterId, title);
  uiState.renameChapterId = null;
  renderChapterList(bookId);
  focusById("chapter-rename-" + chapterId);
  return false;
}

function promptDeleteChapter(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const counts = chapterCascadeCounts(chapterId);
  const ok = confirm(t("chapters.confirmDeleteChapter", { title: chapter.title, attempts: tn("common.attempt", counts.attemptCount) }));
  if (ok) {
    deleteChapter(chapterId);
    renderChapterList(bookId);
  }
}

/* ---------- Chapter detail ---------- */

function renderChapterDetail(bookId, chapterId) {
  const book = Store.books.find((b) => b.id === bookId);
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!book || !chapter) return mount(html`<p>${t("common.notFound")} <a href="#/books">${t("common.goBack")}</a>.</p>`);
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
        <td><a href=${"#/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review"}>${needsReview ? t("chapterDetail.reviewGrade") : t("chapterDetail.viewEditAnswers")}</a></td>
      </tr>
    `;
  });

  const chartSeries = computeChapterTrend(Store, chapterId);

  const attemptsCard = html`
    <div class="card">
      <h2>${t("chapterDetail.pastAttempts")}</h2>
      ${attempts.length
        ? html`<div class="table-wrap"><table><thead><tr><th scope="col">${t("home.colDate")}</th><th scope="col">${t("chapterDetail.colDuration")}</th><th scope="col">${t("home.colScore")}</th><th scope="col"><span class="sr-only">${t("chapterDetail.colActions")}</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : html`<p>${t("chapterDetail.noAttemptsYet")}</p>`}
    </div>
  `;

  let detailSection;
  if (isFirstTime) {
    detailSection = attemptsCard;
  } else {
    const tab = uiState.chapterDetailTab === "questions" ? "questions" : "attempts";
    detailSection = html`
      <div class="filter-tabs" role="group" aria-label=${t("chapterDetail.sectionsGroupLabel")}>
        <button type="button" aria-pressed=${tab === "attempts"} onClick=${() => setChapterDetailTab(bookId, chapterId, "attempts")}>${t("chapterDetail.attemptsTab", { count: attempts.length })}</button>
        <button type="button" aria-pressed=${tab === "questions"} onClick=${() => setChapterDetailTab(bookId, chapterId, "questions")}>${t("chapterDetail.questionsTab", { count: chapter.questionOrder.length })}</button>
      </div>
      ${tab === "attempts" ? attemptsCard : renderQuestionManageCard(bookId, chapterId, chapter)}
    `;
  }

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters"}>← ${book.title}</a></p>
    <h1>${chapter.title}</h1>
    <div class="btn-row">
      <a class="btn primary" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/attempt"}>${isFirstTime ? t("chapterDetail.startAttempt") : t("home.retake")}</a>
      ${isFirstTime ? null : html`
        <a class="btn" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/trends"}>${t("home.viewTrends")}</a>
        <a class="btn" href=${"#/books/" + bookId + "/chapters/" + chapterId + "/print"}>${t("chapterDetail.printBlankPaper")}</a>
      `}
    </div>
    ${chartSeries.length ? html`<div class="card"><h2>${t("common.scoreOverTime")}</h2>${renderScoreLineChart(chartSeries)}</div>` : null}
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
  return tn("chapterDetail.optionsCount", question.config.optionLabels.length) + (question.config.multiSelect ? t("chapterDetail.multiSelectSuffix") : "");
}

function renderQuestionManageCard(bookId, chapterId, chapter) {
  const questions = chapter.questionOrder.map((qid) => Store.questions.find((q) => q.id === qid)).filter(Boolean);

  const rows = questions.map((q, idx) => html`
    <tr key=${q.id}>
      <td>${t("common.questionN", { n: idx + 1 })}</td>
      <td>${describeQuestion(q)}</td>
      <td>${q.correctAnswer !== null && q.correctAnswer !== undefined
        ? html`<span class="status-correct">${t("chapterDetail.answerSet")}</span>`
        : html`<span class="status-ungraded">${t("chapterDetail.noAnswerYet")}</span>`}</td>
      <td class="btn-row">
        ${idx > 0 ? html`<button type="button" id=${"q-up-" + q.id} onClick=${() => moveQuestion(bookId, chapterId, q.id, -1)} aria-label=${t("chapterDetail.moveUp", { n: idx + 1 })}>↑</button>` : null}
        ${idx < questions.length - 1 ? html`<button type="button" id=${"q-down-" + q.id} onClick=${() => moveQuestion(bookId, chapterId, q.id, 1)} aria-label=${t("chapterDetail.moveDown", { n: idx + 1 })}>↓</button>` : null}
        <button type="button" id=${"q-delete-" + q.id} class="danger" onClick=${() => promptDeleteQuestion(bookId, chapterId, q.id)}>${t("common.delete")}</button>
      </td>
    </tr>
  `);

  const addForm = uiState.addQuestionOpen
    ? renderAddQuestionForm(bookId, chapterId)
    : html`<div class="btn-row"><button type="button" id="add-question-toggle" onClick=${() => toggleAddQuestionForm(true, bookId, chapterId)}>${t("chapterDetail.addQuestionToggle")}</button></div>`;

  return html`
    <div class="card">
      <h2>${tn("chapterDetail.questionsHeading", questions.length)}</h2>
      ${questions.length
        ? html`<div class="table-wrap"><table><thead><tr><th scope="col">${t("chapterDetail.colNum")}</th><th scope="col">${t("chapterDetail.colType")}</th><th scope="col">${t("chapterDetail.colCorrectAnswer")}</th><th scope="col"><span class="sr-only">${t("chapterDetail.colActions")}</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : html`<p>${t("chapterDetail.noQuestionsYet")}</p>`}
      ${addForm}
    </div>
  `;
}

function renderAddQuestionForm(bookId, chapterId) {
  const draft = uiState.addQuestionDraft || (uiState.addQuestionDraft = { type: "mcq", config: Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) });
  const configHtml = draft.type === "mcq" ? html`
    <label for="new-q-opt-count">${t("chapterDetail.numOptions")}</label>
    <input id="new-q-opt-count" type="number" min="2" max="8" value=${draft.config.optionLabels.length} onChange=${(e) => manageAddQuestionUpdateOptionCount(e.target.value)} />
    <div class="choice-row">
      <input id="new-q-multi-select" type="checkbox" checked=${draft.config.multiSelect} onChange=${(e) => manageAddQuestionUpdateMultiSelect(e.target.checked)} />
      <label for="new-q-multi-select" style="margin:0">${t("chapterDetail.allowMultiSelect")}</label>
    </div>
  ` : null;

  return html`
    <form class="add-question-form" onSubmit=${(e) => handleAddQuestion(e, bookId, chapterId)}>
      <label for="new-q-type">${t("chapterDetail.questionType")}</label>
      <select id="new-q-type" autofocus onChange=${(e) => manageAddQuestionUpdateType(e.target.value)}>
        <option value="mcq" selected=${draft.type === "mcq"}>${t("chapterDetail.multipleChoice")}</option>
        <option value="truefalse" selected=${draft.type === "truefalse"}>${t("chapterDetail.trueFalse")}</option>
      </select>
      ${configHtml}
      <p class="card-meta">${t("chapterDetail.correctAnswerHint")}</p>
      <div class="btn-row">
        <button type="submit" class="primary">${t("chapterDetail.addQuestion")}</button>
        <button type="button" onClick=${() => toggleAddQuestionForm(false, bookId, chapterId)}>${t("common.cancel")}</button>
      </div>
    </form>
  `;
}

function toggleAddQuestionForm(open, bookId, chapterId) {
  uiState.addQuestionOpen = open;
  uiState.addQuestionDraft = open ? { type: "mcq", config: Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) } : null;
  renderChapterDetail(bookId, chapterId);
  if (!open) focusById("add-question-toggle");
}

function manageAddQuestionUpdateType(type) {
  uiState.addQuestionDraft.type = type;
  uiState.addQuestionDraft.config = type === "mcq" ? Object.assign({}, DEFAULT_NEW_QUESTION_CONFIG) : {};
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
  addQuestionToChapter(chapterId, draft.type, Object.assign({}, draft.config, draft.config.optionLabels ? { optionLabels: draft.config.optionLabels.slice() } : {}));
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

function promptDeleteQuestion(bookId, chapterId, questionId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const idx = chapter.questionOrder.indexOf(questionId);
  const counts = questionCascadeCounts(chapterId, questionId);
  const ok = confirm(t("chapterDetail.confirmDeleteQuestion", { n: idx + 1, attempts: tn("common.pastAttempt", counts.attemptCount) }));
  if (ok) {
    deleteQuestion(chapterId, questionId);
    renderChapterDetail(bookId, chapterId);
  }
}

function renderScoreLineChart(series) {
  const width = 560, height = 200, padL = 36, padR = 16, padT = 28, padB = 28;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (pct) => padT + innerH - (innerH * (pct === null ? 0 : pct)) / 100;

  const gridLines = [0, 25, 50, 75, 100].map((pct) => {
    const gy = y(pct);
    return html`
      <g key=${pct}>
        <line class="chart-grid" x1=${padL} y1=${gy} x2=${width - padR} y2=${gy}></line>
        <text x=${padL - 8} y=${gy + 3} text-anchor="end">${pct}</text>
      </g>
    `;
  });

  const points = series.map((s, i) => ({ x: x(i), y: y(s.scorePercent || 0), s }));
  const path = points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const showAllLabels = n <= 6;

  const circles = points.map((p, i) => {
    const label = p.s.scorePercent === null ? t("common.ungraded") : p.s.scorePercent + "%";
    const isEndpoint = i === 0 || i === n - 1;
    const valueLabel = p.s.scorePercent === null || !(showAllLabels || isEndpoint) ? null : html`
      <text class="chart-label" x=${p.x.toFixed(1)} y=${(p.y - 10).toFixed(1)} text-anchor="middle">${p.s.scorePercent}%</text>
    `;
    return html`
      <g key=${p.s.attemptId || i}>
        <circle class="chart-point" cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r="4" tabindex="0">
          <title>${formatDate(p.s.date)}: ${label}</title>
        </circle>
        ${valueLabel}
      </g>
    `;
  });

  const dateLabels = n > 1 ? html`
    <text class="chart-date-label" x=${points[0].x.toFixed(1)} y=${height - 6} text-anchor="start">${formatDateShort(series[0].date)}</text>
    <text class="chart-date-label" x=${points[n - 1].x.toFixed(1)} y=${height - 6} text-anchor="end">${formatDateShort(series[n - 1].date)}</text>
  ` : null;

  return html`
    <div class="chart-wrap">
      <svg viewBox=${"0 0 " + width + " " + height} role="img" aria-label=${t("chapterDetail.chartAriaLabel")}>
        ${gridLines}
        <path class="chart-line" d=${path}></path>
        ${circles}
        ${dateLabels}
      </svg>
    </div>
  `;
}

/* ---------- New Attempt / Retake wizard ---------- */

let Wizard = null;

function wizardHasProgress() {
  if (!Wizard) return false;
  if (Wizard.mode === "new") return Wizard.stage !== "count" && (Wizard.draftQuestions.length > 0 || Wizard.index > 0);
  return Wizard.index > 0 || Object.keys(Wizard.responses).length > 0 || Wizard.stage !== "questions";
}

function cancelWizard() {
  if (wizardHasProgress() && !confirm(t("wizard.confirmCancelAttempt"))) return;
  const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
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

function renderNewWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "count") {
    return mount(html`
      <h1>${t("wizard.newAttemptTitle", { title: chapter.title })}</h1>
      <div class="card">
        <label for="q-count">${t("wizard.howManyQuestions")}</label>
        <input id="q-count" type="number" min="1" max="200" placeholder=${t("wizard.howManyQuestionsPlaceholder")} autofocus />
        ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
        <div class="btn-row">
          <button type="button" class="primary" onClick=${startNewWizardQuestions}>${t("wizard.begin")}</button>
          <button type="button" onClick=${cancelWizard}>${t("common.cancel")}</button>
        </div>
      </div>
      <p class="wizard-unsure-hint">${t("wizard.unsureHint")}
        <button type="button" class="link-inline" onClick=${startNewWizardUnbounded}>${t("wizard.addOneAtATime")}</button>${t("wizard.unsureHintEnd")}
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

  const configHtml = type === "mcq" ? html`
    <label for="opt-count">${t("chapterDetail.numOptions")}</label>
    <input id="opt-count" type="number" min="2" max="8" value=${config.optionLabels.length} onChange=${(e) => wizardUpdateOptionCount(e.target.value)} />
    <div class="choice-row">
      <input id="multi-select" type="checkbox" checked=${config.multiSelect} onChange=${(e) => wizardUpdateMultiSelect(e.target.checked)} />
      <label for="multi-select" style="margin:0">${t("chapterDetail.allowMultiSelect")}</label>
    </div>
    ${i > 0 ? html`<p class="card-meta">${t("wizard.samePrevious")}</p>` : null}
  ` : null;

  const buttonsHtml = unbounded ? html`
    <button type="button" id="wizard-primary-action" onClick=${() => wizardCommitQuestion(false)}>${t("wizard.addAnother")}</button>
    <button type="button" id="wizard-secondary-action" class="primary" onClick=${() => wizardCommitQuestion(true)}>${t("wizard.finishAttempt")}</button>
  ` : html`
    <button type="button" id="wizard-primary-action" class="primary" onClick=${() => wizardCommitQuestion(isLast)}>${isLast ? t("wizard.finishAttempt") : t("wizard.nextQuestion")}</button>
  `;

  mount(html`
    <h1>${chapter.title}</h1>
    <p class="wizard-progress" tabindex="-1" autofocus>${unbounded ? t("wizard.questionUnbounded", { i: i + 1 }) : t("wizard.questionOf", { i: i + 1, total: Wizard.total })}${flaggedSoFar > 0 ? t("wizard.flaggedSoFar", { count: flaggedSoFar }) : ""}</p>
    ${unbounded ? null : progressBar(i + 1, Wizard.total)}
    <div class="card">
      <label for="q-type">${t("chapterDetail.questionType")}</label>
      <select id="q-type" onChange=${(e) => wizardUpdateType(e.target.value)}>
        <option value="mcq" selected=${type === "mcq"}>${t("chapterDetail.multipleChoice")}</option>
        <option value="truefalse" selected=${type === "truefalse"}>${t("chapterDetail.trueFalse")}</option>
      </select>
      ${configHtml}
      ${renderAnswerFieldset(type, config, pendingChosen)}
      ${flagCheckbox(Wizard.pendingFlagged, t("wizard.flagUnsure"))}
      ${keyboardHint(type)}
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
  Wizard.currentConfig = Object.assign({}, prev.config, prev.config.optionLabels ? { optionLabels: prev.config.optionLabels.slice() } : {});
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
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
  render();
}

function startNewWizardUnbounded() {
  Wizard.total = null;
  Wizard.stage = "questions";
  Wizard.currentType = "mcq";
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
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
    Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
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
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
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
  Wizard.currentConfig = Object.assign({}, Wizard.lastMcqConfig, { optionLabels: Wizard.lastMcqConfig.optionLabels.slice() });
  render();
}

function finishNewAttempt() {
  const attempt = commitNewAttempt(Wizard.chapterId, Wizard.draftQuestions, Wizard.draftAnswers, Wizard.startedAt);
  const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
  Wizard = null;
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
  render();
}

function renderNewFlaggedReview(bookId, chapterId, chapter) {
  const flaggedIdx = [];
  Wizard.draftAnswers.forEach((a, idx) => { if (a.flagged) flaggedIdx.push(idx); });

  const items = flaggedIdx.map((idx) => html`
    <li class="flagged-item" key=${idx}>
      <button type="button" onClick=${() => reviewNewFlaggedQuestion(idx)}>${t("common.questionN", { n: idx + 1 })}</button>
      <span class="card-meta">${formatChosenSummary(Wizard.draftAnswers[idx].chosen)}</span>
    </li>
  `);

  mount(html`
    <h1>${chapter.title}</h1>
    <div class="card">
      <h2 tabindex="-1" autofocus>${tn("wizard.flaggedForReview", flaggedIdx.length)}</h2>
      <p>${t("wizard.takeAnotherLook")}</p>
      <ul class="flagged-list">${items.length ? items : html`<li>${t("wizard.noneLeft")}</li>`}</ul>
      <div class="btn-row"><button type="button" class="primary" onClick=${confirmFinishNewAttempt}>${t("wizard.submitAttempt")}</button></div>
    </div>
  `);
}

function confirmFinishNewAttempt() {
  const unanswered = Wizard.draftAnswers.filter((a) => a.flagged && a.chosen.length === 0).length;
  if (unanswered > 0) {
    const ok = confirm(tn("wizard.confirmSubmitUnanswered", unanswered));
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
    <p class="wizard-progress" tabindex="-1" autofocus>${t("wizard.reviewingQuestion", { n: idx + 1 })}</p>
    <div class="card">
      ${renderAnswerFieldset(q.type, q.config, a.chosen)}
      ${flagCheckbox(a.flagged, t("wizard.flagStillUnsure"))}
      ${keyboardHint(q.type)}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        <button type="button" id="wizard-primary-action" class="primary" onClick=${saveNewReviewedQuestion}>${t("wizard.saveAndReturn")}</button>
      </div>
    </div>
  `);
}

function saveNewReviewedQuestion() {
  const idx = Wizard.reviewIndex;
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
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

function renderRetakeWizard(bookId, chapterId, chapter) {
  if (Wizard.stage === "flagged-review") return renderRetakeFlaggedReview(bookId, chapterId, chapter);
  if (Wizard.stage === "reviewing-one") return renderRetakeReviewOne(bookId, chapterId, chapter);

  const i = Wizard.index;
  const questionId = chapter.questionOrder[i];
  const question = Store.questions.find((q) => q.id === questionId);
  const isLast = i === chapter.questionOrder.length - 1;
  const priorEntry = Wizard.responses[questionId] || { chosen: [], flagged: false };
  const flaggedSoFar = Object.values(Wizard.responses).filter((r) => r.flagged).length;

  mount(html`
    <h1>${t("wizard.retakeTitle", { title: chapter.title })}</h1>
    <p class="wizard-progress" tabindex="-1" autofocus>${t("wizard.questionOf", { i: i + 1, total: chapter.questionOrder.length })}${flaggedSoFar > 0 ? t("wizard.flaggedSoFar", { count: flaggedSoFar }) : ""}</p>
    ${progressBar(i + 1, chapter.questionOrder.length)}
    <div class="card">
      ${renderAnswerFieldset(question.type, question.config, priorEntry.chosen)}
      ${flagCheckbox(priorEntry.flagged, t("wizard.flagUnsure"))}
      ${keyboardHint(question.type)}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        ${i > 0 ? html`<button type="button" id="wizard-back-action" onClick=${retakeGoBack}>${t("wizard.previousQuestion")}</button>` : null}
        <button type="button" id="wizard-primary-action" class="primary" onClick=${() => retakeCommitQuestion(questionId, isLast)}>${isLast ? t("wizard.finishAttempt") : t("wizard.nextQuestion")}</button>
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
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
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
    const anyFlagged = chapter.questionOrder.some((qid) => Wizard.responses[qid] && Wizard.responses[qid].flagged);
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
  const bookId = Wizard.bookId, chapterId = Wizard.chapterId;
  Wizard = null;
  navigate("/books/" + bookId + "/chapters/" + chapterId + "/attempt/" + attempt.id + "/review");
  render();
}

function renderRetakeFlaggedReview(bookId, chapterId, chapter) {
  const flaggedQids = chapter.questionOrder.filter((qid) => Wizard.responses[qid] && Wizard.responses[qid].flagged);
  const items = flaggedQids.map((qid) => {
    const num = chapter.questionOrder.indexOf(qid) + 1;
    return html`
      <li class="flagged-item" key=${qid}>
        <button type="button" onClick=${() => reviewRetakeFlaggedQuestion(qid)}>${t("common.questionN", { n: num })}</button>
        <span class="card-meta">${formatChosenSummary(Wizard.responses[qid].chosen)}</span>
      </li>
    `;
  });

  mount(html`
    <h1>${t("wizard.retakeTitle", { title: chapter.title })}</h1>
    <div class="card">
      <h2 tabindex="-1" autofocus>${tn("wizard.flaggedForReview", flaggedQids.length)}</h2>
      <p>${t("wizard.takeAnotherLook")}</p>
      <ul class="flagged-list">${items.length ? items : html`<li>${t("wizard.noneLeft")}</li>`}</ul>
      <div class="btn-row"><button type="button" class="primary" onClick=${confirmFinishRetakeAttempt}>${t("wizard.submitAttempt")}</button></div>
    </div>
  `);
}

function confirmFinishRetakeAttempt() {
  const unanswered = Object.values(Wizard.responses).filter((r) => r.flagged && r.chosen.length === 0).length;
  if (unanswered > 0) {
    const ok = confirm(tn("wizard.confirmSubmitUnanswered", unanswered));
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
    <p class="wizard-progress" tabindex="-1" autofocus>${t("wizard.reviewingQuestion", { n: num })}</p>
    <div class="card">
      ${renderAnswerFieldset(question.type, question.config, entry.chosen)}
      ${flagCheckbox(entry.flagged, t("wizard.flagStillUnsure"))}
      ${keyboardHint(question.type)}
      ${Wizard.error ? html`<p class="field-error" role="alert">${Wizard.error}</p>` : null}
      <div class="btn-row">
        <button type="button" id="wizard-primary-action" class="primary" onClick=${saveRetakeReviewedQuestion}>${t("wizard.saveAndReturn")}</button>
      </div>
    </div>
  `);
}

function saveRetakeReviewedQuestion() {
  const questionId = Wizard.reviewQuestionId;
  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked')).map((el) => el.value);
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

/* ---------- Review / Grade ---------- */

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

/* ---------- Trends ---------- */

function renderTrends(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount(html`<p>${t("common.notFound")}</p>`);
  document.title = t("trends.docTitle") + " " + chapter.title + " — " + t("common.appName");

  const chapterSeries = computeChapterTrend(Store, chapterId);
  const weakest = weakestQuestions(Store, chapterId, 5);
  const anyGraded = chapter.questionOrder.some((qid) =>
    computeQuestionTrend(Store, qid).sequence.some((s) => s.correct !== null)
  );

  const weakestRows = weakest.map((w) => html`
    <tr key=${w.questionId}>
      <td><button type="button" class="link-inline" onClick=${() => jumpToWeakestQuestion(bookId, chapterId, w.questionNumber)}>${t("common.questionN", { n: w.questionNumber })}</button></td>
      <td>${Math.round(w.incorrectRate * 100)}%</td>
      <td>${w.gradedCount}</td>
    </tr>
  `);

  const questionRows = chapter.questionOrder.map((qid, idx) => {
    const trend = computeQuestionTrend(Store, qid);
    const seq = trend.sequence.map((s) => {
      const statusClass = s.correct === null ? "status-ungraded" : s.correct ? "status-correct" : "status-incorrect";
      const symbol = s.correct === null ? "–" : s.correct ? "✓" : "✗";
      return html`<span class=${statusClass} key=${s.attemptId}>${symbol}</span>`;
    });
    return html`<tr key=${qid}><td>${t("common.questionN", { n: idx + 1 })}</td><td>${seq.length ? seq : t("trends.noAttempts")}</td></tr>`;
  });

  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>${t("trends.trendsTitle", { title: chapter.title })}</h1>
    ${chapterSeries.length ? html`<div class="card"><h2>${t("common.scoreOverTime")}</h2>${renderScoreLineChart(chapterSeries)}</div>` : null}
    <div class="card">
      <h2>${t("trends.weakestQuestions")}</h2>
      ${weakestRows.length
        ? html`<div class="table-wrap"><table><thead><tr><th scope="col">${t("trends.colQuestion")}</th><th scope="col">${t("trends.colIncorrectRate")}</th><th scope="col">${t("trends.colGradedAttempts")}</th></tr></thead><tbody>${weakestRows}</tbody></table></div>`
        : anyGraded
          ? html`<p>${t("trends.noIncorrectYet")}</p>`
          : html`<p>${t("trends.notEnoughGraded")}</p>`}
    </div>
    <div class="card">
      <h2>${t("trends.perQuestionHistory")}</h2>
      <div class="table-wrap"><table><thead><tr><th scope="col">${t("trends.colQuestion")}</th><th scope="col">${t("trends.colAttemptSequence")}</th></tr></thead><tbody>${questionRows}</tbody></table></div>
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

/* ---------- Print trigger ---------- */

function renderPrintTrigger(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  if (!chapter) return mount(html`<p>${t("common.notFound")}</p>`);
  document.title = t("print.docTitle") + " " + chapter.title + " — " + t("common.appName");
  mount(html`
    <p><a href=${"#/books/" + bookId + "/chapters/" + chapterId}>← ${chapter.title}</a></p>
    <h1>${t("print.printTitle", { title: chapter.title })}</h1>
    <p>${t("print.printHint")}</p>
    <div class="btn-row"><button type="button" class="primary" onClick=${() => triggerPrint(chapterId)}>${t("print.print")}</button></div>
  `);
  buildPrintView(chapterId);
}

function triggerPrint(chapterId) {
  buildPrintView(chapterId);
  window.print();
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

window.render = render;
