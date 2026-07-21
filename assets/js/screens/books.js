/* Books list screen (#/books). */

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
            <button type="button" onClick=${() => toggleRenameBookForm(null)}>
              ${t("common.cancel")}
            </button>
          </div>
        </form>
      </li>
    `;
  }
  return html`
    <li class="card" key=${book.id}>
      <a class="card-link" href=${"#/books/" + book.id + "/chapters"}><h2>${book.title}</h2></a>
      <p class="card-meta">
        ${tn("common.chapter", chapterCount)}${book.archived ? html` · <span class="status-ungraded">${t("books.archived")}</span>` : null}
      </p>
      <div class="btn-row">
        <button
          type="button"
          id=${"book-rename-" + book.id}
          onClick=${() => toggleRenameBookForm(book.id)}
        >
          ${t("common.rename")}
        </button>
        ${
          book.archived
            ? html`<button
                type="button"
                id=${"book-unarchive-" + book.id}
                onClick=${() => handleUnarchiveBook(book.id)}
              >
                ${t("common.unarchive")}
              </button>`
            : html`<button
                type="button"
                id=${"book-archive-" + book.id}
                onClick=${() => handleArchiveBook(book.id)}
              >
                ${t("common.archive")}
              </button>`
        }
        <button
          type="button"
          id=${"book-delete-" + book.id}
          class="danger"
          onClick=${() => promptDeleteBook(book.id)}
        >
          ${t("common.delete")}
        </button>
      </div>
    </li>
  `;
}

function renderBookList() {
  document.title = t("books.title") + " — " + t("common.appName");
  const sortByActivity = (a, b) =>
    new Date(bookLastActivity(Store, b.id)) - new Date(bookLastActivity(Store, a.id));
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
          <button
            type="button"
            aria-pressed=${filter === "all"}
            onClick=${() => setBookFilter("all")}
          >
            ${t("books.filterAll", { count: allBooks.length })}
          </button>
          <button
            type="button"
            aria-pressed=${filter === "active"}
            onClick=${() => setBookFilter("active")}
          >
            ${t("books.filterActive", { count: activeBooks.length })}
          </button>
          <button
            type="button"
            aria-pressed=${filter === "archived"}
            onClick=${() => setBookFilter("archived")}
          >
            ${t("books.filterArchived", { count: archivedBooks.length })}
          </button>
        </div>
      `
    : null;

  const addForm = uiState.addBookOpen
    ? html`
        <div class="card">
          <form onSubmit=${handleAddBook}>
            <label for="new-book-title">${t("books.newBookTitle")}</label>
            <input
              id="new-book-title"
              type="text"
              placeholder=${t("books.newBookPlaceholder")}
              required
              autofocus
            />
            <div class="btn-row">
              <button type="submit" class="primary">${t("books.addBook")}</button>
              <button type="button" onClick=${() => toggleAddBookForm(false)}>
                ${t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      `
    : html`<div class="btn-row">
        <button
          type="button"
          id="add-book-toggle"
          class="primary"
          onClick=${() => toggleAddBookForm(true)}
        >
          ${t("books.addBookToggle")}
        </button>
      </div>`;

  const sortHint =
    booksForFilter.length > 1 ? html`<p class="list-sort-hint">${t("common.sortHint")}</p>` : null;

  let booksSection;
  if (cards.length) {
    booksSection = html`<ul class="card-list">
      ${cards}
    </ul>`;
  } else if (filter === "archived") {
    booksSection = html`<div class="card"><p>${t("books.noArchivedBooks")}</p></div>`;
  } else if (filter === "active" && archivedBooks.length) {
    booksSection = html`<div class="card"><p>${t("books.noActiveBooks")}</p></div>`;
  } else {
    booksSection = html`<div class="card"><p>${t("books.noBooksYet")}</p></div>`;
  }

  mount(html`
    <h1>${t("books.title")}</h1>
    ${
      Store.books.length === 0
        ? html`
            <p class="onboarding-hint">${t("books.onboardingHint")}</p>
            <div class="btn-row">
              <button type="button" onClick=${handleLoadSampleData}>
                ${t("common.loadSampleData")}
              </button>
            </div>
          `
        : null
    }
    ${filterBar} ${sortHint} ${addForm} ${booksSection}
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

async function promptResetAllData() {
  const counts = allDataCounts();
  const ok = await showConfirm(
    t("books.confirmDeleteAll", {
      books: tn("common.book", counts.bookCount),
      chapters: tn("common.chapter", counts.chapterCount),
      attempts: tn("common.attempt", counts.attemptCount),
    }),
    { confirmLabel: t("data.clearAllData"), danger: true },
  );
  if (ok) {
    resetStore();
    renderData();
  }
}
