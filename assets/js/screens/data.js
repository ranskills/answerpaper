/* Data management screen (#/data). */

function renderData() {
  document.title = t("data.title") + " — " + t("common.appName");
  const archivedCount = Store.books.filter((b) => b.archived).length;
  const earliestBookDate = Store.books.reduce(
    (earliest, b) => (!earliest || b.createdAt < earliest ? b.createdAt : earliest),
    null,
  );
  const lastExportAt = getLastExportAt();

  const emptyState =
    Store.books.length === 0
      ? html`
          <div class="card">
            <p>${t("data.emptyHint")}</p>
            <div class="btn-row">
              <button type="button" onClick=${handleLoadSampleData}>
                ${t("common.loadSampleData")}
              </button>
            </div>
          </div>
        `
      : null;

  const dangerCard = Store.books.length
    ? html`
        <div class="card card-danger">
          <h2>${t("data.dangerZone")}</h2>
          <p class="card-meta" style="margin: 0">${t("data.dangerHint")}</p>
          <div class="btn-row">
            <button type="button" class="danger" onClick=${promptResetAllData}>
              ${t("data.clearAllData")}
            </button>
          </div>
        </div>
      `
    : null;

  mount(html`
    <h1>${t("data.title")}</h1>
    ${emptyState}
    <div class="card">
      <h2>${t("data.storage")}</h2>
      <p style="margin: 0 0 var(--space-3)">${t("data.privacyNote")}</p>
      <p class="card-meta" style="margin: 0">
        ${t("data.storedInBrowser", { size: formatBytes(dataStorageBytes()) })}${archivedCount ? html` · ${tn("common.archivedBook", archivedCount)}` : null}
      </p>
      ${earliestBookDate ? html`<p class="card-meta" style="margin: 0">${t("data.trackingSince", { date: formatDateShort(earliestBookDate) })}</p>` : null}
    </div>
    <div class="card">
      <h2>${t("data.backup")}</h2>
      <p class="card-meta" style="margin: 0">
        ${lastExportAt ? t("data.lastExported", { date: formatDate(lastExportAt) }) : t("data.neverExported")}
      </p>
      <div class="btn-row">
        <button type="button" class="primary" onClick=${handleExportData}>
          ${t("data.exportData")}
        </button>
        <label class="import-label" for="import-input"
          >${t("data.importData")}
          <input
            id="import-input"
            type="file"
            accept="application/json"
            onChange=${handleImportFile}
          />
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

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const summary = {
    books: Store.books.length,
    chapters: Store.chapters.length,
    attempts: Store.attempts.length,
  };
  const ok = await showConfirm(
    t("data.confirmImport", {
      books: tn("common.book", summary.books),
      chapters: tn("common.chapter", summary.chapters),
      attempts: tn("common.attempt", summary.attempts),
    }),
    { confirmLabel: t("data.importData") },
  );
  if (!ok) {
    e.target.value = "";
    return;
  }
  importData(file, async (err) => {
    e.target.value = "";
    if (err) {
      await showAlert(t("data.importFailed", { message: err.message }));
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
  if (!title) {
    reportCustomValidity(input, t("common.titleRequired"));
    return false;
  }
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
  if (!title) {
    reportCustomValidity(input, t("common.titleRequired"));
    return false;
  }
  renameBook(bookId, title);
  uiState.renameBookId = null;
  renderBookList();
  focusById("book-rename-" + bookId);
  return false;
}

async function promptDeleteBook(bookId) {
  const book = Store.books.find((b) => b.id === bookId);
  const counts = bookCascadeCounts(bookId);
  const ok = await showConfirm(
    t("books.confirmDeleteBook", {
      title: book.title,
      chapters: tn("common.chapter", counts.chapterCount),
      attempts: tn("common.attempt", counts.attemptCount),
    }),
    { confirmLabel: t("common.delete"), danger: true },
  );
  if (ok) {
    deleteBook(bookId);
    renderBookList();
  }
}
