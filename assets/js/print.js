/* Builds a blank, answer-free printable view of a chapter's questions. */

function esc(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

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
        '<li class="print-option"><span class="print-marker"></span>' + esc(t("common.trueLabel")) + "</li>" +
        '<li class="print-option"><span class="print-marker"></span>' + esc(t("common.falseLabel")) + "</li>";
    }
    return (
      '<li class="print-question">' +
      "<div><strong>" + esc(t("print.question", { n: idx + 1 })) + "</strong></div>" +
      '<ul class="print-options">' + optionsHtml + "</ul>" +
      "</li>"
    );
  }).join("");

  root.innerHTML =
    '<section aria-label="' + esc(t("print.ariaLabel")) + '">' +
    "<h1>" + esc(book ? book.title : "") + " &mdash; " + esc(chapter.title) + "</h1>" +
    '<div class="print-header-block">' +
    '<span class="print-field">' + esc(t("print.name")) + ' <span class="print-fill-line"></span></span>' +
    '<span class="print-field">' + esc(t("print.date")) + ' <span class="print-fill-line"></span></span>' +
    '<span class="print-field">' + esc(t("print.score")) + ' <span class="print-fill-line short"></span> ' + esc(t("print.ofTotal", { total: chapter.questionOrder.length })) + "</span>" +
    "</div>" +
    '<ol class="print-question-list">' + questionsHtml + "</ol>" +
    "</section>";
}
