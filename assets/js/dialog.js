/* Promise-based replacement for window.confirm()/alert(), built on the
   native <dialog> element so focus-trap, Escape-to-cancel, and the
   ::backdrop come from the browser instead of being hand-rolled. */
(function () {
  let dialogEl = null;
  let messageEl = null;
  let cancelBtn = null;
  let confirmBtn = null;
  let resolveCurrent = null;

  function ensureDialog() {
    if (dialogEl) return;
    dialogEl = document.createElement("dialog");
    dialogEl.className = "app-dialog";
    dialogEl.innerHTML = `
      <form method="dialog" class="app-dialog-form">
        <p class="app-dialog-message"></p>
        <div class="btn-row app-dialog-actions">
          <button type="submit" value="cancel" class="app-dialog-cancel"></button>
          <button type="submit" value="ok" class="app-dialog-confirm primary"></button>
        </div>
      </form>
    `;
    document.body.appendChild(dialogEl);
    messageEl = dialogEl.querySelector(".app-dialog-message");
    cancelBtn = dialogEl.querySelector(".app-dialog-cancel");
    confirmBtn = dialogEl.querySelector(".app-dialog-confirm");

    dialogEl.addEventListener("close", () => {
      document.documentElement.classList.remove("dialog-open");
      if (resolveCurrent) {
        const ok = dialogEl.returnValue === "ok";
        const resolve = resolveCurrent;
        resolveCurrent = null;
        resolve(ok);
      }
    });

    // Native <dialog> only closes on Escape / a form submit by default —
    // clicking the backdrop does nothing unless we wire it up ourselves.
    // A click lands on the dialog element itself (not a descendant) when
    // it's outside the rendered content box, since the dialog element's
    // layout box is the content box, not the full-viewport backdrop.
    dialogEl.addEventListener("click", (e) => {
      if (e.target !== dialogEl) return;
      dialogEl.close("cancel");
    });
  }

  function open(message, { confirmLabel, cancelLabel, danger, showCancel }) {
    ensureDialog();
    messageEl.textContent = message;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = "app-dialog-confirm " + (danger ? "danger" : "primary");
    cancelBtn.hidden = !showCancel;
    if (showCancel) cancelBtn.textContent = cancelLabel;

    // Reset returnValue: Escape closes the dialog without setting it, so a
    // stale "ok" from a previous open would otherwise leak through as a
    // false-positive confirmation.
    dialogEl.returnValue = "";
    document.documentElement.classList.add("dialog-open");
    dialogEl.showModal();
    // Default focus to Cancel (or the sole OK button for alerts) rather than
    // the destructive action, so an unintended Enter press doesn't confirm.
    (showCancel ? cancelBtn : confirmBtn).focus();

    return new Promise((resolve) => {
      resolveCurrent = resolve;
    });
  }

  window.showConfirm = function (message, opts) {
    opts = opts || {};
    return open(message, {
      confirmLabel: opts.confirmLabel || t("common.ok"),
      cancelLabel: opts.cancelLabel || t("common.cancel"),
      danger: !!opts.danger,
      showCancel: true,
    });
  };

  window.showAlert = function (message, opts) {
    opts = opts || {};
    return open(message, {
      confirmLabel: opts.confirmLabel || t("common.ok"),
      danger: false,
      showCancel: false,
    }).then(() => undefined);
  };
})();
