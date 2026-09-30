/* Where the class records are sent: the Google Sheet's web-app link (see tools/apps-script.gs).
   Empty = records wait on the panel and are sent once a link is added. */
var CONFIG = {
  SHEET_URL: '',
  TOKEN: 'lmcs-m1-2026',
  CAMPUSES: ['LMS-1 Dhalpur', 'LMS-2 Kelheli', 'LMS-3 Dunkhra', 'LMS-4 Nerchowk', 'LMS-5 Sayoli', 'GILMS-6 Joginder Nagar', 'Home office (testing)'],
  // Stop counting time on a page after this many minutes with no touch.
  IDLE_MINUTES: 5
};
