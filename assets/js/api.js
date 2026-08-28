/* ============================================================
   Backend adapter.
   - If CONFIG.API_URL points at a deployed Apps Script Web App,
     every call goes there (Google Sheet = database, Gmail = mail).
   - Otherwise a local demo backend backed by localStorage is used
     so the pages are fully clickable before the backend exists.

   Every call returns a plain object:  { ok:true, ... }  or
                                       { ok:false, error:"code", message:"..." }
   ============================================================ */

const API = (function () {

  const DEMO_KEY = "geosofia2026_tour_registrations_demo";

  /* ---------- demo (localStorage) backend ---------- */
  const Demo = {
    read() {
      try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
      catch (e) { return []; }
    },
    write(rows) {
      localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
    },
    counts() {
      const rows = Demo.read();
      const c = {};
      CONFIG.SLOTS.forEach(s => { c[s.key] = 0; });
      rows.forEach(r => { if (c[r.slot] !== undefined) c[r.slot]++; });
      return c;
    },
    handle(payload) {
      const rows = Demo.read();

      if (payload.action === "stats") {
        return { ok: true, capacity: CONFIG.CAPACITY, counts: Demo.counts(), demo: true };
      }

      if (payload.action === "register") {
        const norm  = (s) => String(s || "").trim().replace(/\s+/g, " ");
        const name  = norm(payload.name);
        const email = norm(payload.email);
        const slot  = String(payload.slot || "").trim();

        if (!name || !email || !String(payload.affiliation || "").trim() ||
            !String(payload.conftool || "").trim() || !slot) {
          return { ok: false, error: "missing", message: "Please fill in all required fields." };
        }
        if (!CONFIG.slotByKey(slot)) {
          return { ok: false, error: "badslot", message: "Unknown tour date." };
        }
        const dup = rows.some(r =>
          norm(r.name).toLowerCase()  === name.toLowerCase() &&
          norm(r.email).toLowerCase() === email.toLowerCase());
        if (dup) {
          return { ok: false, error: "duplicate",
                   message: "Sorry, your details already exist in the database, try another submission" };
        }
        if (Demo.counts()[slot] >= CONFIG.CAPACITY) {
          return { ok: false, error: "full", message: "Sorry, that date has just become fully booked. Please pick another one.",
                   counts: Demo.counts() };
        }
        rows.push({
          ts: new Date().toISOString(),
          name: name,
          affiliation: norm(payload.affiliation),
          email: email,
          conftool: norm(payload.conftool),
          slot: slot
        });
        Demo.write(rows);
        return { ok: true, counts: Demo.counts(), mailed: false, demo: true };
      }

      if (payload.action === "list") {
        if (payload.password !== "gategeosofia") {
          return { ok: false, error: "auth", message: "Wrong password." };
        }
        return { ok: true, capacity: CONFIG.CAPACITY, counts: Demo.counts(), rows: Demo.read(), demo: true };
      }

      if (payload.action === "reset") {
        if (payload.password !== "gategeosofia") {
          return { ok: false, error: "auth", message: "Wrong password." };
        }
        const n = rows.length;
        Demo.write([]);
        return { ok: true, deleted: n, counts: Demo.counts(), demo: true };
      }

      return { ok: false, error: "unknown", message: "Unknown action." };
    }
  };

  /* ---------- live (Apps Script) backend ---------- */
  async function live(payload) {
    /* text/plain keeps the request "simple" so the browser skips the
       CORS pre-flight, which Apps Script cannot answer. */
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Server returned HTTP " + res.status);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error("The server did not return valid data. Check that the Web App is deployed with access set to \"Anyone\".");
    }
  }

  async function call(payload) {
    if (!CONFIG.isConfigured()) {
      /* small delay so the UI spinners behave like the real thing */
      await new Promise(r => setTimeout(r, 260));
      return Demo.handle(payload);
    }
    try {
      return await live(payload);
    } catch (err) {
      return { ok: false, error: "network",
               message: "Could not reach the registration server. Please check your connection and try again." };
    }
  }

  return {
    demoMode: () => !CONFIG.isConfigured(),
    stats:    ()      => call({ action: "stats" }),
    register: (data)  => call(Object.assign({ action: "register" }, data)),
    list:     (pwd)   => call({ action: "list",  password: pwd }),
    reset:    (pwd)   => call({ action: "reset", password: pwd })
  };
})();
