/* Shared render helpers: html/mount/format/router. Every screens/*.js file
   depends on this being loaded first; see index.html script order. */

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

/* ---------- Shared UI state ---------- */

let uiState = {
  addBookOpen: false, addChapterOpen: false, renameBookId: null, renameChapterId: null,
  addQuestionOpen: false, addQuestionDraft: null, bookFilter: "active", chapterDetailTab: "attempts",
  reviewCompact: false, compactEditQuestionId: null,
};

/* ---------- Shared chart helper (Chapter detail + Trends) ---------- */

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

window.render = render;
