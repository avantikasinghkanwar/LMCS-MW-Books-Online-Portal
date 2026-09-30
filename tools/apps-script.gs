/**
 * LMCS Portal — class records.
 * Paste into the Google Sheet's Extensions → Apps Script, run setup() once, then
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * The web-app link goes into config.js → SHEET_URL.
 */
var TOKEN = 'lmcs-m1-2026'; // must match config.js
var HEADERS = ['Start', 'End', 'Seconds', 'Active seconds', 'Campus', 'Class', 'Teacher', 'Panel',
  'Book', 'Page', 'Item', 'Part', 'Touches', 'Traces', 'Sound taps', 'Game right', 'Game wrong',
  'Video plays', 'Colour taps', 'Version', 'Received'];
var KEYS = ['start', 'end', 'seconds', 'active_seconds', 'campus', 'class_name', 'teacher', 'panel',
  'book', 'page', 'item', 'part', 'touches', 'traces', 'sound_taps', 'game_right', 'game_wrong',
  'video_plays', 'colour_taps', 'version'];
var CLASS_HEADERS = ['Campus', 'Class', 'Teacher', 'Panel', 'Last seen', 'Book', 'Page', 'On screen',
  'Visits', 'Active minutes'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN || !data.rows || !data.rows.length) return text('ignored');
    var ss = SpreadsheetApp.getActive();
    var visits = sheet(ss, 'Visits', HEADERS);
    var now = new Date();
    var rows = data.rows.map(function (r) {
      return KEYS.map(function (k) {
        if (k === 'start' || k === 'end') return toDate(r[k]);
        return r[k] === undefined ? '' : r[k];
      }).concat([now]);
    });
    visits.getRange(visits.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    updateClasses(ss, data.rows);
    return text('ok ' + rows.length);
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return text('LMCS portal records: working'); }

// "Where is each class": one row per panel, updated with its latest page.
function updateClasses(ss, rows) {
  var sh = sheet(ss, 'Where classes are', CLASS_HEADERS);
  var values = sh.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < values.length; i++) index[values[i][3]] = i;
  rows.forEach(function (r) {
    var at = index[r.panel];
    var row = at !== undefined ? values[at] : [r.campus, r.class_name, r.teacher, r.panel, '', '', '', '', 0, 0];
    var end = toDate(r.end);
    if (!row[4] || end >= row[4]) {
      row[0] = r.campus; row[1] = r.class_name; row[2] = r.teacher;
      row[4] = end; row[5] = 'Book ' + r.book; row[6] = r.page; row[7] = r.item + ' — ' + r.part;
    }
    row[8] = (Number(row[8]) || 0) + 1;
    row[9] = Math.round(((Number(row[9]) || 0) + r.active_seconds / 60) * 10) / 10;
    if (at === undefined) { index[r.panel] = values.length; values.push(row); } else values[at] = row;
  });
  sh.getRange(1, 1, values.length, CLASS_HEADERS.length).setValues(values);
}

// Run once: makes the tabs and the summary formulas.
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone('Asia/Kolkata');
  sheet(ss, 'Where classes are', CLASS_HEADERS);
  sheet(ss, 'Visits', HEADERS);
  summary(ss, 'By page',
    "=QUERY(Visits!A:U, \"select I, J, K, L, count(A), sum(D)/60, sum(M), sum(N), sum(O), sum(P), sum(Q) where A is not null group by I, J, K, L order by I, K " +
    "label count(A) 'Visits', sum(D)/60 'Active minutes', sum(M) 'Touches', sum(N) 'Traces', sum(O) 'Sound taps', sum(P) 'Game right', sum(Q) 'Game wrong'\", 1)");
  summary(ss, 'By class',
    "=QUERY(Visits!A:U, \"select E, F, G, count(A), sum(D)/60, sum(M), sum(N), max(B) where A is not null group by E, F, G " +
    "label count(A) 'Visits', sum(D)/60 'Active minutes', sum(M) 'Touches', sum(N) 'Traces', max(B) 'Last used'\", 1)");
  summary(ss, 'By day',
    "=QUERY(Visits!A:U, \"select toDate(A), E, F, G, count(A), sum(D)/60, sum(N) where A is not null group by toDate(A), E, F, G order by toDate(A) desc " +
    "label toDate(A) 'Day', count(A) 'Visits', sum(D)/60 'Active minutes', sum(N) 'Traces'\", 1)");
  var extra = ss.getSheetByName('Sheet1');
  if (extra && ss.getSheets().length > 1 && extra.getLastRow() === 0) ss.deleteSheet(extra);
}

function sheet(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FFF1C2');
    sh.setFrozenRows(1);
  }
  return sh;
}

function summary(ss, name, formula) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange('A1').setFormula(formula);
  sh.getRange('1:1').setFontWeight('bold').setBackground('#FFF1C2');
  sh.setFrozenRows(1);
}

function toDate(s) {
  var m = String(s).match(/(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : s;
}

function text(s) { return ContentService.createTextOutput(s); }
