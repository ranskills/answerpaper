/* Chapter list screen (#/books/:bookId/chapters). */

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

async function promptDeleteChapter(bookId, chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const counts = chapterCascadeCounts(chapterId);
  const ok = await showConfirm(t("chapters.confirmDeleteChapter", { title: chapter.title, attempts: tn("common.attempt", counts.attemptCount) }), { confirmLabel: t("common.delete"), danger: true });
  if (ok) {
    deleteChapter(chapterId);
    renderChapterList(bookId);
  }
}

