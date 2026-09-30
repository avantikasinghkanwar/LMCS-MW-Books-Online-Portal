/**
 * Settings.gs — the only file you edit when you connect a new Google Sheet.
 *
 * Every Google Sheet the hub can write to is listed here by its ID.
 * The ID is the long code in the Sheet's web address, between /d/ and /edit:
 *   https://docs.google.com/spreadsheets/d/THIS_LONG_CODE/edit
 */
var SHEETS = {
  portal: 'PASTE_THE_SHEET_ID_HERE'   // LMCS MW Books Online Portal- Class Records
  // Later, one line per new app, e.g.:  homework: 'ANOTHER_SHEET_ID',
};

// A shared password. The portal sends it with every message; anything without it is ignored.
// It must match TOKEN in the portal's config.js.
var TOKEN = 'lmcs-m1-2026';
