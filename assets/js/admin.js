/* ============================================================
   GeoSofia Sightseeing Tour — administration panel
   ============================================================ */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SESSION_KEY = "geosofia2026_admin_pwd";

  let pwd  = "";
  let rows = [];                                    // raw records from the server
  let sort = { key: "slot", dir: 1 };                // default: by date, ascending
  const slotOrder = {};
  CONFIG.SLOTS.forEach((s, i) => { slotOrder[s.key] = i; });

  /* ---------------- utils ---------------- */

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function slotDate(key) {
    const s = CONFIG.slotByKey(key);
    return s ? s.date : key;
  }

  function toast(text, bad) {
    const t = $("toast");
    t.textContent = text;
    t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = "toast" + (bad ? " bad" : ""); }, 3200);
  }

  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           "_" + p(d.getHours()) + p(d.getMinutes());
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------------- login ---------------- */

  function showPanel() {
    $("loginView").style.display = "none";
    $("panelView").style.display = "";
    load();
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = $("f-pwd").value;
    $("wrap-pwd").classList.remove("invalid");

    if (!value) { $("wrap-pwd").classList.add("invalid"); return; }

    $("loginBtn").disabled = true;
    $("loginLabel").innerHTML = '<span class="spinner" aria-hidden="true"></span> Checking…';

    /* the password is verified by the server on every call */
    const res = await API.list(value);

    $("loginBtn").disabled = false;
    $("loginLabel").textContent = "Sign in";

    if (res && res.ok) {
      pwd = value;
      try { sessionStorage.setItem(SESSION_KEY, value); } catch (e) {}
      applyResult(res);
      $("loginView").style.display = "none";
      $("panelView").style.display = "";
      render();
      return;
    }
    if (res && res.error === "auth") {
      $("wrap-pwd").classList.add("invalid");
      $("err-pwd").textContent = "Wrong password. Please try again.";
      $("f-pwd").select();
      return;
    }
    $("wrap-pwd").classList.add("invalid");
    $("err-pwd").textContent = (res && res.message) || "Could not reach the server.";
  });

  $("logoutBtn").addEventListener("click", () => {
    pwd = "";
    rows = [];
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    $("f-pwd").value = "";
    $("panelView").style.display = "none";
    $("loginView").style.display = "";
    window.scrollTo({ top: 0 });
  });

  /* ---------------- data ---------------- */

  function applyResult(res) {
    rows = (res.rows || []).map(r => ({
      ts:          r.ts || "",
      name:        r.name || "",
      affiliation: r.affiliation || "",
      email:       r.email || "",
      conftool:    String(r.conftool === undefined ? "" : r.conftool),
      slot:        r.slot || ""
    }));
  }

  async function load(silent) {
    if (!silent) $("refreshBtn").disabled = true;
    const res = await API.list(pwd);
    $("refreshBtn").disabled = false;

    if (!res || !res.ok) {
      if (res && res.error === "auth") { $("logoutBtn").click(); return; }
      toast((res && res.message) || "Could not load the data.", true);
      return;
    }
    applyResult(res);
    render();
    if (!silent) toast("Data refreshed — " + rows.length + " registration" + (rows.length === 1 ? "" : "s") + ".");
  }

  $("refreshBtn").addEventListener("click", () => load(false));

  /* ---------------- render ---------------- */

  function counts() {
    const c = {};
    CONFIG.SLOTS.forEach(s => { c[s.key] = 0; });
    rows.forEach(r => { if (c[r.slot] !== undefined) c[r.slot]++; });
    return c;
  }

  function filtered() {
    const q = $("search").value.trim().toLowerCase();
    let out = rows.slice();
    if (q) {
      out = out.filter(r =>
        (r.name + " " + r.affiliation + " " + r.email + " " + r.conftool + " " + slotDate(r.slot))
          .toLowerCase().indexOf(q) !== -1);
    }
    const k = sort.key, dir = sort.dir;
    out.sort((a, b) => {
      let va, vb;
      if (k === "slot") {
        va = slotOrder[a.slot] === undefined ? 99 : slotOrder[a.slot];
        vb = slotOrder[b.slot] === undefined ? 99 : slotOrder[b.slot];
        if (va === vb) return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      } else if (k === "conftool") {
        const na = parseFloat(a.conftool), nb = parseFloat(b.conftool);
        const bothNum = !isNaN(na) && !isNaN(nb) &&
                        /^\s*\d+(\.\d+)?\s*$/.test(a.conftool) && /^\s*\d+(\.\d+)?\s*$/.test(b.conftool);
        if (bothNum) { va = na; vb = nb; }
        else return dir * String(a.conftool).localeCompare(String(b.conftool), "en", { numeric: true, sensitivity: "base" });
      } else {
        return dir * String(a[k]).localeCompare(String(b[k]), "en", { sensitivity: "base" });
      }
      return dir * (va < vb ? -1 : va > vb ? 1 : 0);
    });
    return out;
  }

  function renderStats() {
    const c = counts();
    let html = "";
    CONFIG.SLOTS.forEach((s, i) => {
      const taken = c[s.key] || 0;
      const full  = taken >= CONFIG.CAPACITY;
      html += `<div class="stat s${i}">
          <div class="k">${esc(s.display || s.date)} · ${esc(s.time)}</div>
          <div class="v">${taken}<small> / ${CONFIG.CAPACITY}</small></div>
          <div class="tag ${full ? "is-full" : ""}">${full ? "Fully booked" : (CONFIG.CAPACITY - taken) + " place" + (CONFIG.CAPACITY - taken === 1 ? "" : "s") + " left"}</div>
        </div>`;
    });
    html += `<div class="stat total">
        <div class="k">Total registrations</div>
        <div class="v">${rows.length}<small> / ${CONFIG.CAPACITY * CONFIG.SLOTS.length}</small></div>
        <div class="tag" style="color:var(--muted)">All dates</div>
      </div>`;
    $("stats").innerHTML = html;
  }

  function render() {
    renderStats();

    const list = filtered();
    const tbody = $("tbody");

    tbody.innerHTML = list.map((r, i) => {
      const idx = CONFIG.SLOTS.findIndex(s => s.key === r.slot);
      return `<tr>
        <td class="idx">${i + 1}</td>
        <td class="name">${esc(r.name)}</td>
        <td>${esc(r.affiliation)}</td>
        <td class="mail"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
        <td>${esc(r.conftool)}</td>
        <td><span class="pill d${idx < 0 ? 0 : idx}">${esc(slotDate(r.slot))}</span></td>
      </tr>`;
    }).join("");

    const empty = list.length === 0;
    $("table").style.display = empty ? "none" : "";
    $("emptyState").style.display = empty ? "" : "none";
    $("emptyText").textContent = rows.length === 0
      ? "No registrations yet."
      : "No registration matches your search.";

    document.querySelectorAll("thead th[data-key]").forEach(th => {
      th.setAttribute("aria-sort",
        th.dataset.key === sort.key ? (sort.dir === 1 ? "ascending" : "descending") : "none");
      const arrow = th.querySelector(".arrow");
      if (arrow) arrow.textContent = (th.dataset.key === sort.key && sort.dir === -1) ? "▼" : "▲";
    });

    $("footNote").textContent = "Showing " + list.length + " of " + rows.length +
      " registration" + (rows.length === 1 ? "" : "s") +
      ". Click a column header to sort" + (rows.length ? "." : ".");
  }

  document.querySelectorAll("thead th[data-key]").forEach(th => {
    th.addEventListener("click", () => {
      const k = th.dataset.key;
      if (sort.key === k) sort.dir = -sort.dir;
      else { sort.key = k; sort.dir = 1; }
      render();
    });
  });

  $("search").addEventListener("input", render);

  /* ---------------- export ---------------- */

  const HEADERS = ["First and Last Name", "Affiliation", "email", "ConfTool Participant ID", "Date"];

  function exportRows() {
    return filtered().map(r => [r.name, r.affiliation, r.email, r.conftool, slotDate(r.slot)]);
  }

  $("csvBtn").addEventListener("click", () => {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [HEADERS.map(q).join(",")];
    exportRows().forEach(r => lines.push(r.map(q).join(",")));
    /* BOM so Excel opens UTF-8 correctly */
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    download(blob, "GeoSofia2026_SightseeingTour_" + stamp() + ".csv");
    toast("CSV exported.");
  });

  $("xlsBtn").addEventListener("click", () => {
    const th = HEADERS.map(h =>
      '<th style="background:#F3A81B;color:#fff;border:1px solid #ccc;padding:6px;text-align:left">' + esc(h) + "</th>").join("");
    const tr = exportRows().map(r =>
      "<tr>" + r.map(c =>
        '<td style="border:1px solid #ddd;padding:6px">' + esc(c) + "</td>").join("") + "</tr>").join("");
    const html =
      '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">' +
      "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
      "<x:Name>Registrations</x:Name><x:WorksheetOptions><x:DisplayGridlines/>" +
      "</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
      "</head><body><table><thead><tr>" + th + "</tr></thead><tbody>" + tr + "</tbody></table></body></html>";
    const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    download(blob, "GeoSofia2026_SightseeingTour_" + stamp() + ".xls");
    toast("Excel file exported.");
  });

  /* ---------------- reset ---------------- */

  const overlay = $("resetOverlay");

  function openReset() {
    $("resetCount").textContent = rows.length + " registration" + (rows.length === 1 ? "" : "s");
    overlay.classList.add("show");
    $("resetCancel").focus();
  }
  function closeReset() {
    overlay.classList.remove("show");
    $("resetBtn").focus();
  }

  $("resetBtn").addEventListener("click", openReset);
  $("resetCancel").addEventListener("click", closeReset);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeReset(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) closeReset();
  });

  $("resetConfirm").addEventListener("click", async () => {
    $("resetConfirm").disabled = true;
    $("resetCancel").disabled = true;
    $("resetConfirmLabel").innerHTML = '<span class="spinner" aria-hidden="true"></span> Deleting…';

    const res = await API.reset(pwd);

    $("resetConfirm").disabled = false;
    $("resetCancel").disabled = false;
    $("resetConfirmLabel").textContent = "Yes, delete everything";
    closeReset();

    if (res && res.ok) {
      rows = [];
      render();
      toast("All records deleted. " + (res.deleted || 0) + " removed.");
      load(true);
    } else {
      toast((res && res.message) || "Could not reset the database.", true);
    }
  });

  /* ---------------- boot ---------------- */

  if (API.demoMode()) $("demoBar").classList.add("show");

  (async function boot() {
    let saved = "";
    try { saved = sessionStorage.getItem(SESSION_KEY) || ""; } catch (e) {}
    if (!saved) { $("f-pwd").focus(); return; }
    const res = await API.list(saved);
    if (res && res.ok) {
      pwd = saved;
      applyResult(res);
      $("loginView").style.display = "none";
      $("panelView").style.display = "";
      render();
    } else {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      $("f-pwd").focus();
    }
  })();

  /* auto-refresh while the panel is open */
  setInterval(() => { if (pwd && !document.hidden && $("panelView").style.display !== "none") load(true); }, 60000);
})();
