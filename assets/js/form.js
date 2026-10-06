/* ============================================================
   GeoSofia Sightseeing Tour — registration form logic
   ============================================================ */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    form:        $("regForm"),
    slots:       $("slots"),
    submitBtn:   $("submitBtn"),
    submitLabel: $("submitLabel"),
    msg:         $("formMsg"),
    msgText:     $("formMsgText"),
    formPane:    $("formPane"),
    successPane: $("successPane"),
    againBtn:    $("againBtn"),
    demoBar:     $("demoBar")
  };

  const FIELDS = ["name", "affiliation", "email", "conftool"];
  let counts = null;          // { "29sep": 3, ... }
  let allFull = false;

  /* ---------------- helpers ---------------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Deliberately pragmatic: one @, a dot in the domain, no spaces. */
  const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  function showMsg(text, kind) {
    els.msgText.textContent = text;
    els.msg.className = "msg " + (kind || "err") + " show";
  }
  function hideMsg() {
    els.msg.className = "msg err";
  }

  function markInvalid(field, on) {
    const wrap = $("wrap-" + field);
    if (wrap) wrap.classList.toggle("invalid", !!on);
  }

  /* ---------------- slots ---------------- */

  function buildSlots() {
    els.slots.innerHTML = CONFIG.SLOTS.map((s, i) => `
      <div class="slot" id="slot-${s.key}">
        <input type="radio" name="slot" id="opt-${s.key}" value="${s.key}">
        <label for="opt-${s.key}">
          <span class="tick" aria-hidden="true"></span>
          <span class="slot-body">
            <span class="slot-date">${esc(s.display || s.date)} <span class="slot-time">· ${esc(s.time)}</span></span>
            <span class="slot-meta">
              <span class="bar"><span id="bar-${s.key}"></span></span>
              <span class="left" id="left-${s.key}">checking availability…</span>
            </span>
          </span>
          <span class="badge-full">Fully booked</span>
        </label>
      </div>`).join("");

    els.slots.addEventListener("change", () => {
      markInvalid("slot", false);
      hideMsg();
    });
  }

  function paintSlots() {
    allFull = true;
    CONFIG.SLOTS.forEach(s => {
      const taken = counts && typeof counts[s.key] === "number" ? counts[s.key] : 0;
      const left  = Math.max(0, CONFIG.CAPACITY - taken);
      const full  = left <= 0;
      if (!full) allFull = false;

      const box   = $("slot-" + s.key);
      const input = $("opt-" + s.key);
      const bar   = $("bar-" + s.key);
      const lbl   = $("left-" + s.key);

      box.classList.toggle("full", full);
      input.disabled = full;
      if (full && input.checked) input.checked = false;

      bar.style.width = Math.round((taken / CONFIG.CAPACITY) * 100) + "%";

      if (full) {
        lbl.textContent = CONFIG.CAPACITY + " / " + CONFIG.CAPACITY + " places taken";
      } else if (left === 1) {
        lbl.textContent = "1 place left";
      } else {
        lbl.textContent = left + " of " + CONFIG.CAPACITY + " places left";
      }
      input.setAttribute("aria-label",
        s.label + (full ? " — fully booked" : " — " + left + " places left"));
    });

    if (allFull) {
      els.submitBtn.disabled = true;
      showMsg("All three tour dates are now fully booked. Thank you for your interest — " +
              "please contact the conference desk if you would like to be put on a waiting list.", "warn");
    }
  }

  async function loadStats(silent) {
    const res = await API.stats();
    if (res && res.ok) {
      counts = res.counts || {};
      paintSlots();
    } else if (!silent) {
      CONFIG.SLOTS.forEach(s => {
        const lbl = $("left-" + s.key);
        if (lbl) lbl.textContent = "availability unavailable";
      });
      showMsg((res && res.message) || "Could not load current availability.", "warn");
    }
  }

  /* ---------------- validation ---------------- */

  function validate() {
    let firstBad = null;
    const values = {};

    FIELDS.forEach(f => {
      const input = $("f-" + f);
      /* collapse runs of whitespace so "  maria   petrova " and
         "Maria Petrova" are recognised as the same person */
      const v = input.value.trim().replace(/\s+/g, " ");
      values[f] = v;
      let bad = v.length === 0;
      if (!bad && f === "email") bad = !EMAIL_RE.test(v);
      if (!bad && f === "name")  bad = v.replace(/\s+/g, " ").split(" ").length < 2;
      markInvalid(f, bad);
      if (bad && !firstBad) firstBad = input;
    });

    const picked = els.form.querySelector('input[name="slot"]:checked');
    if (!picked) {
      markInvalid("slot", true);
      $("wrap-slot").classList.add("invalid");
      $("err-slot").style.display = "block";
      if (!firstBad) firstBad = els.slots.querySelector('input[name="slot"]:not(:disabled)');
    } else {
      $("wrap-slot").classList.remove("invalid");
      $("err-slot").style.display = "none";
      values.slot = picked.value;
    }

    if (firstBad) {
      firstBad.focus({ preventScroll: true });
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
      return null;
    }
    return values;
  }

  /* live clean-up of the error state while typing */
  FIELDS.forEach(f => {
    const input = $("f-" + f);
    if (!input) return;
    input.addEventListener("input", () => {
      if ($("wrap-" + f).classList.contains("invalid")) {
        const v = input.value.trim();
        let ok = v.length > 0;
        if (ok && f === "email") ok = EMAIL_RE.test(v);
        if (ok && f === "name")  ok = v.replace(/\s+/g, " ").split(" ").length >= 2;
        if (ok) markInvalid(f, false);
      }
      hideMsg();
    });
  });

  /* ---------------- submit ---------------- */

  function busy(on) {
    els.submitBtn.disabled = on || allFull;
    els.submitLabel.innerHTML = on
      ? '<span class="spinner" aria-hidden="true"></span> Submitting…'
      : "Submit registration";
  }

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsg();

    const data = validate();
    if (!data) {
      showMsg("Please correct the highlighted fields and try again.", "err");
      return;
    }

    busy(true);
    const res = await API.register(data);
    busy(false);

    if (res && res.ok) {
      if (res.counts) { counts = res.counts; paintSlots(); }
      showSuccess(data, res);
      return;
    }

    if (res && res.counts) { counts = res.counts; paintSlots(); }

    const msg = (res && res.message) ||
                "Something went wrong. Please try again in a moment.";
    showMsg(msg, res && res.error === "full" ? "warn" : "err");
    els.msg.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ---------------- success ---------------- */

  function showSuccess(data, res) {
    const slot  = CONFIG.slotByKey(data.slot);
    const guide = CONFIG.GUIDES[data.slot];

    $("r-name").textContent        = data.name;
    $("r-affiliation").textContent = data.affiliation;
    $("r-email").textContent       = data.email;
    $("r-conftool").textContent    = data.conftool;
    $("r-slot").textContent        = slot ? slot.label : data.slot;
    $("r-guide").textContent       = guide ? guide.name : "—";

    $("successNote").textContent = (res && res.mailed === false)
      ? "Demo mode: no e-mail was actually sent. Connect the backend to enable e-mail delivery."
      : "A confirmation with the meeting point and your guide is on its way to " + data.email + ".";

    els.formPane.style.display = "none";
    els.successPane.classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  els.againBtn.addEventListener("click", async () => {
    els.form.reset();
    FIELDS.forEach(f => markInvalid(f, false));
    $("err-slot").style.display = "none";
    hideMsg();
    els.successPane.classList.remove("show");
    els.formPane.style.display = "";
    await loadStats(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("f-name").focus();
  });

  /* ---------------- boot ---------------- */

  if (API.demoMode()) els.demoBar.classList.add("show");

  /* Registration closed: show the closing notice instead of the form and
     stop talking to the server altogether. */
  if (CONFIG.REGISTRATION_OPEN === false) {
    els.formPane.style.display = "none";
    const selectLine = $("selectLine");
    if (selectLine) selectLine.style.display = "none";
    $("closedPane").classList.add("show");
    return;
  }

  buildSlots();
  loadStats(false);

  /* keep availability fresh if the page is left open */
  setInterval(() => { if (!document.hidden) loadStats(true); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadStats(true); });
})();
