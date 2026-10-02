/**
 * Settings.gs — the only file you edit when you connect a new Google Sheet or change who may sign in.
 *
 * Every Google Sheet the hub can write to is listed here by its ID.
 * The ID is the long code in the Sheet's web address, between /d/ and /edit:
 *   https://docs.google.com/spreadsheets/d/THIS_LONG_CODE/edit
 */
var SHEETS = {
  portal: '1_qnMmeJWGa8-M6Tg0FAOHFe2Wq-mFWMhIPOWQfW4MWM'   // LMCS MW Portal Data
  // Later, one line per new app, e.g.:  homework: 'ANOTHER_SHEET_ID',
};

// ---------- Old shared password (used until Google sign-in is switched on for everyone) ----------
var TOKEN = 'lmcs-m1-2026';
var ALLOW_LEGACY = true;   // set to false when every panel uses Google sign-in

// ---------- Google sign-in ----------
// The sign-in ID from Google Cloud. Must be the same value as CLIENT_ID in the portal's config.js.
var CLIENT_ID = '359213788301-6chrh8kkbr5733hf2oekolm7bdbggdv0.apps.googleusercontent.com';
// Anyone with an email on this school domain may sign in.
var DOMAIN = 'lms.org.in';
// Masters can always sign in (even from a personal Gmail) and can change everyone's details.
var MASTERS = ['avantika.hazri@gmail.com', 'uday.kanwar@lms.org.in'];
// A panel stays signed in for this many days.
var SESSION_DAYS = 30;
// The campus choices shown on the sign-in and admin screens.
var CAMPUSES = ['LMS-1 Dhalpur', 'LMS-2 Kelheli', 'LMS-3 Dunkhra', 'LMS-4 Nerchowk', 'LMS-5 Sayoli',
  'GILMS-6 Joginder Nagar', 'Head office', 'Home office (testing)'];
