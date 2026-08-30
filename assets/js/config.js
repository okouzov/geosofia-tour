/* ============================================================
   GeoSofia 2026 - Sightseeing Tour :: CONFIGURATION
   ------------------------------------------------------------
   THE ONLY FILE YOU NEED TO EDIT.

   1. Deploy backend/Code.gs as a Google Apps Script Web App
      (see README.md, step by step).
   2. Paste the /exec URL you get into API_URL below.
   3. Commit + push. Done.

   While API_URL is left at the placeholder, the site runs in
   DEMO MODE: everything works, but data is kept in the browser
   only (localStorage) and no e-mail is actually sent.
   ============================================================ */

const CONFIG = {

  /* Google Apps Script Web App URL.
     Looks like: https://script.google.com/macros/s/AKfy..../exec   */
  API_URL: "https://script.google.com/macros/s/AKfycbwknvsMkedSz2sMLijtkJkOhgMNULbt2RwMKi-mkO9AMBEUHuDeE4GxaHGK3-h-Dok/exec",

  /* Maximum participants per tour slot. Must match CAPACITY in Code.gs */
  CAPACITY: 25,

  /* The three tour slots. Keys and `date` must match Code.gs exactly —
     `date` is what is written into the Date column of the database,
     of the admin table and of the CSV / Excel export. */
  SLOTS: [
    { key: "29sep", date: "29 Sep", display: "29 Sept", time: "18:00 - 20:00", label: "29 Sept 18:00-20:00", full: "Tuesday, 29 September 2026" },
    { key: "30sep", date: "30 Sep", display: "30 Sept", time: "18:00 - 20:00", label: "30 Sept 18:00-20:00", full: "Wednesday, 30 September 2026" },
    { key: "01oct", date: "01 Oct", display: "01 Oct",  time: "18:00 - 20:00", label: "01 Oct 18:00-20:00",  full: "Thursday, 1 October 2026" }
  ],

  /* Guides. 29 Sept + 01 Oct -> Nikolay Mindov; 30 Sept -> Petya Angelova.
     Kept in sync with Code.gs (the server copy is the authoritative one). */
  GUIDES: {
    "29sep": { name: "Nikolay Mindov",  phone: "+ 359 883 605 747", email: "nikimindov@gmail.com" },
    "30sep": { name: "Petya Angelova",  phone: "+ 359 899 235 740", email: "petyaangelova@abv.bg" },
    "01oct": { name: "Nikolay Mindov",  phone: "+ 359 883 605 747", email: "nikimindov@gmail.com" }
  },

  MEETING_POINT_URL: "https://maps.app.goo.gl/L1sayGPZ3ZN9Q9696"
};

CONFIG.isConfigured = function () {
  return typeof CONFIG.API_URL === "string" &&
         CONFIG.API_URL.indexOf("script.google.com") !== -1 &&
         CONFIG.API_URL.indexOf("PASTE_") === -1;
};

CONFIG.slotByKey = function (key) {
  for (let i = 0; i < CONFIG.SLOTS.length; i++) {
    if (CONFIG.SLOTS[i].key === key) return CONFIG.SLOTS[i];
  }
  return null;
};
