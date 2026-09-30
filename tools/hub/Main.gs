/**
 * Main.gs — the "sorting desk".
 *
 * Every message from a portal or app arrives here (doPost). It carries a label
 * saying which app it is for, e.g. app: "portal". The desk checks the password,
 * then hands the message to the right file. To add a new app later:
 *   1. add its Sheet ID in Settings.gs
 *   2. add a new file with a handler function
 *   3. add one "case" line below
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) return text('ignored');
    switch (data.app || 'portal') {
      case 'portal': return text(handlePortal(data));
      // case 'homework': return text(handleHomework(data));
      default: return text('unknown app');
    }
  } finally {
    lock.releaseLock();
  }
}

// Opening the hub's link in a browser shows this, so you can check it is alive.
function doGet() { return text('LMCS hub: working'); }

// ---------- Small helpers used by every file ----------

function text(s) { return ContentService.createTextOutput(s); }

// Opens the Sheet listed under this name in Settings.gs.
function openSheetFor(app) {
  var id = SHEETS[app];
  if (!id || id.indexOf('PASTE') === 0) throw new Error('No Sheet ID set for "' + app + '" in Settings.gs');
  return SpreadsheetApp.openById(id);
}

// Finds a tab by name, or makes it (with a bold yellow header row) if it is missing.
function sheet(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FFF1C2');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Turns "2026-09-30 14:05:31" (what the portal sends) into a real date.
function toDate(s) {
  var m = String(s).match(/(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : s;
}
