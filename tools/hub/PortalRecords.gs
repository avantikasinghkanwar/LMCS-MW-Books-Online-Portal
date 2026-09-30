/**
 * PortalRecords.gs — class records from the M1 English smart-panel portal.
 * Run setupPortal() once to build the tabs in the class-records Sheet.
 */
var PORTAL_HEADERS = ['Start', 'End', 'Seconds', 'Active seconds', 'Campus', 'Class', 'Teacher', 'Panel',
  'Book', 'Page', 'Item', 'Part', 'Touches', 'Traces', 'Sound taps', 'Game right', 'Game wrong',
  'Video plays', 'Colour taps', 'Version', 'Received', 'Activity done'];
var PORTAL_KEYS = ['start', 'end', 'seconds', 'active_seconds', 'campus', 'class_name', 'teacher', 'panel',
  'book', 'page', 'item', 'part', 'touches', 'traces', 'sound_taps', 'game_right', 'game_wrong',
  'video_plays', 'colour_taps', 'version'];
var PORTAL_LAST_KEY = 'activity_done';   // goes in column V, after "Received"
var PORTAL_CLASS_HEADERS = ['Campus', 'Class', 'Teacher', 'Panel', 'Last seen', 'Book', 'Page', 'On screen',
  'Visits', 'Active minutes'];

// Called by the sorting desk for every batch of records from a panel.
function handlePortal(data) {
  if (!data.rows || !data.rows.length) return 'nothing to save';
  var ss = openSheetFor('portal');
  var visits = sheet(ss, 'Visits', PORTAL_HEADERS);
  var now = new Date();
  var rows = data.rows.map(function (r) {
    return PORTAL_KEYS.map(function (k) {
      if (k === 'start' || k === 'end') return toDate(r[k]);
      return r[k] === undefined ? '' : r[k];
    }).concat([now, r[PORTAL_LAST_KEY] === undefined ? '' : r[PORTAL_LAST_KEY]]);
  });
  var first = visits.getLastRow() + 1;
  // Page is stored as text, because some pages are ranges like "46–47". Mixed numbers and text confuse the summaries.
  visits.getRange(first, 10, rows.length, 1).setNumberFormat('@');
  visits.getRange(first, 1, rows.length, PORTAL_HEADERS.length).setValues(rows);
  updateClasses(ss, data.rows);
  return 'ok ' + rows.length;
}

// "Where is each class": one row per panel, updated with its latest page.
function updateClasses(ss, rows) {
  var sh = sheet(ss, 'Where classes are', PORTAL_CLASS_HEADERS);
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
  sh.getRange(1, 1, values.length, PORTAL_CLASS_HEADERS.length).setValues(values);
}

// Run once (choose "setupPortal" in the dropdown, then press Run): builds the tabs and summaries.
function setupPortal() {
  var ss = openSheetFor('portal');
  ss.setSpreadsheetTimeZone('Asia/Kolkata');
  sheet(ss, 'Where classes are', PORTAL_CLASS_HEADERS);
  var visitsTab = sheet(ss, 'Visits', PORTAL_HEADERS);
  // Make sure row 1 has every header, including the newest one (Activity done).
  visitsTab.getRange(1, 1, 1, PORTAL_HEADERS.length).setValues([PORTAL_HEADERS]).setFontWeight('bold').setBackground('#FFF1C2');
  visitsTab.getRange('J2:J').setNumberFormat('@');   // Page column = text
  summary(ss, 'Activities done',
    "=QUERY(Visits!A:V, \"select E, F, G, K, count(A), max(B) where V = 1 group by E, F, G, K order by E, F, K " +
    "label count(A) 'Times marked done', max(B) 'Last done'\", 1)");
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

function summary(ss, name, formula) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange('A1').setFormula(formula);
  sh.getRange('1:1').setFontWeight('bold').setBackground('#FFF1C2');
  sh.setFrozenRows(1);
}
