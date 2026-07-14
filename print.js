/* Builds a blank, answer-free printable view of a chapter's questions. */

function buildPrintView(chapterId) {
  const chapter = Store.chapters.find((c) => c.id === chapterId);
  const root = document.getElementById("print-root");
  if (!chapter) {
    root.innerHTML = "";
    return;
  }
  const book = Store.books.find((b) => b.id === chapter.bookId);

  const questionsHtml = chapter.questionOrder.map((qid, idx) => {
    const question = Store.questions.find((q) => q.id === qid);
    let optionsHtml = "";
    if (question.type === "mcq") {
      optionsHtml = question.config.optionLabels.map((label) =>
        '<li class="print-option"><span class="print-marker"></span>' + esc(label) + "</li>"
      ).join("");
    } else {
      optionsHtml =
        '<li class="print-option"><span class="print-marker"></span>True</li>' +
        '<li class="print-option"><span class="print-marker"></span>False</li>';
    }
    return (
      '<li class="print-question">' +
      "<div><strong>Q" + (idx + 1) + ".</strong></div>" +
      '<ul class="print-options">' + optionsHtml + "</ul>" +
      "</li>"
    );
  }).join("");

  root.innerHTML =
    '<section aria-label="Printable exam paper">' +
    "<h1>" + esc(book ? book.title : "") + " &mdash; " + esc(chapter.title) + "</h1>" +
    '<div class="print-header-block">' +
    '<span class="print-field">Name: <span class="print-fill-line"></span></span>' +
    '<span class="print-field">Date: <span class="print-fill-line"></span></span>' +
    '<span class="print-field">Score: <span class="print-fill-line short"></span> of ' + chapter.questionOrder.length + "</span>" +
    "</div>" +
    '<ol class="print-question-list">' + questionsHtml + "</ol>" +
    "</section>";
}
