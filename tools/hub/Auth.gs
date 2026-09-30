/**
 * Auth.gs — Google sign-in, sessions, and the Teachers list.
 *
 * How it works, in short:
 *  1. The portal shows "Sign in with Google". Google gives the portal a short-lived proof of who the person is.
 *  2. The portal sends that proof here (action "login"). We ask Google to confirm it is real,
 *     check the person is allowed, and hand back a "session" — a signed pass valid for SESSION_DAYS.
 *  3. Every later message carries the session. We work out who sent it from the pass, never from what the panel claims.
 *  4. The Teachers tab in your Sheet holds each person's name, campus, class and role (teacher or master).
 */
var TEACHER_HEADERS = ['Email', 'Name', 'Campus', 'Class', 'Role', 'Status', 'Last login'];

function jsonOut(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Sorting desk for everything that has an "action" (the signed-in portal).
function handleAction(data) {
  try {
    switch (data.action) {
      case 'login': return doLogin(data);
      case 'me': return doMe(data);
      case 'setprofile': return doSetProfile(data);
      case 'records': return doRecords(data);
      case 'admin_list': return doAdminList(data);
      case 'admin_save': return doAdminSave(data);
      case 'admin_delete': return doAdminDelete(data);
    }
    return { error: 'unknown action' };
  } catch (err) {
    return { error: 'server', detail: String(err) };
  }
}

// ---------- Teachers tab ----------

function teachersSheet() { return sheet(openSheetFor('portal'), 'Teachers', TEACHER_HEADERS); }

function lower(s) { return String(s || '').trim().toLowerCase(); }

function isMasterEmail(email) { return MASTERS.map(lower).indexOf(email) >= 0; }

function inSchoolDomain(email) { return email.slice(-(DOMAIN.length + 1)) === '@' + DOMAIN; }

// { "name@school.in": { row: 2, email, name, campus, cls, role, status } }
function readRoster() {
  var vals = teachersSheet().getDataRange().getValues();
  var out = {};
  for (var i = 1; i < vals.length; i++) {
    var e = lower(vals[i][0]);
    if (e) out[e] = { row: i + 1, email: e, name: String(vals[i][1] || ''), campus: String(vals[i][2] || ''), cls: String(vals[i][3] || ''),
      role: lower(vals[i][4]) === 'master' ? 'master' : 'teacher', status: String(vals[i][5] || '') };
  }
  return out;
}

// Adds a row, or updates the fields given. Returns the fresh record.
function upsertTeacher(email, fields) {
  var sh = teachersSheet();
  var rec = readRoster()[email];
  var now = new Date();
  if (!rec) {
    sh.appendRow([email, fields.name || '', fields.campus || '', fields.cls || '',
      fields.role || (isMasterEmail(email) ? 'master' : 'teacher'), fields.status || 'new', fields.lastLogin ? now : '']);
  } else {
    var r = sh.getRange(rec.row, 1, 1, TEACHER_HEADERS.length).getValues()[0];
    if (fields.name !== undefined) r[1] = fields.name;
    if (fields.campus !== undefined) r[2] = fields.campus;
    if (fields.cls !== undefined) r[3] = fields.cls;
    if (fields.role !== undefined) r[4] = fields.role;
    if (fields.status !== undefined) r[5] = fields.status;
    if (fields.lastLogin) r[6] = now;
    sh.getRange(rec.row, 1, 1, TEACHER_HEADERS.length).setValues([r]);
  }
  return readRoster()[email];
}

// What the portal needs to know about a person. Masters never have to pick a class.
function profileOf(email, rec) {
  var master = isMasterEmail(email) || !!(rec && rec.role === 'master');
  var campus = rec ? rec.campus : '', cls = rec ? rec.cls : '';
  if (master) { campus = campus || 'Head office'; cls = cls || 'ADMIN'; }
  return { email: email, name: (rec && rec.name) || email, role: master ? 'master' : 'teacher',
    campus: campus, cls: cls, needsProfile: !master && (!campus || !cls) };
}

// ---------- Google check ----------

function verifyGoogle(idToken) {
  if (!CLIENT_ID || !idToken) return null;
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  var t = JSON.parse(res.getContentText());
  if (t.aud !== CLIENT_ID) return null;                       // must have been issued for OUR portal
  if (String(t.email_verified) !== 'true') return null;
  if (Number(t.exp) * 1000 < Date.now()) return null;
  return { email: lower(t.email), name: t.name || '', hd: t.hd || '' };
}

// ---------- Sessions (a signed pass; nothing is stored) ----------

function secret() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('SESSION_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SESSION_SECRET', s); }
  return s;
}
function sign(payload) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret()));
}
function makeSession(email) {
  var payload = email + '|' + (Date.now() + SESSION_DAYS * 86400000);
  return Utilities.base64EncodeWebSafe(payload) + '.' + sign(payload);
}
// Returns the email inside a valid, unexpired pass — or null.
function readSession(token) {
  if (!token || String(token).indexOf('.') < 0) return null;
  var parts = String(token).split('.');
  var payload;
  try { payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(); } catch (e) { return null; }
  if (sign(payload) !== parts[1]) return null;
  var bits = payload.split('|');
  if (Number(bits[1]) < Date.now()) return null;
  return bits[0];
}

// The signed-in person for this message, with their record. null = not signed in.
function whoIs(data) {
  var email = readSession(data.session);
  if (!email) return null;
  var rec = readRoster()[email];
  if (!rec && !isMasterEmail(email) && !inSchoolDomain(email)) return null;   // removed from the list
  return { email: email, rec: rec, profile: profileOf(email, rec) };
}

// ---------- Actions ----------

function doLogin(data) {
  var g = verifyGoogle(data.idToken);
  if (!g) return { error: 'google' };
  var rec = readRoster()[g.email];
  var master = isMasterEmail(g.email) || !!(rec && rec.role === 'master');
  var inDomain = g.hd === DOMAIN || inSchoolDomain(g.email);
  if (!rec && !master && !inDomain) return { error: 'notallowed' };
  rec = upsertTeacher(g.email, { name: (rec && rec.name) || g.name, lastLogin: true,
    role: master ? 'master' : (rec ? rec.role : 'teacher'), status: rec ? undefined : 'new' });
  return { ok: true, session: makeSession(g.email), profile: profileOf(g.email, rec) };
}

function doMe(data) {
  var w = whoIs(data);
  return w ? { ok: true, profile: w.profile } : { error: 'session' };
}

// First sign-in only: the teacher picks their campus and class. After that it is locked; masters can change it.
function doSetProfile(data) {
  var w = whoIs(data);
  if (!w) return { error: 'session' };
  var campus = String(data.campus || '').trim(), cls = String(data.cls || '').trim().slice(0, 20);
  if (CAMPUSES.indexOf(campus) < 0 || !cls) return { error: 'invalid' };
  var alreadySet = w.rec && w.rec.campus && w.rec.cls;
  if (alreadySet && w.profile.role !== 'master') return { error: 'locked' };
  var rec = upsertTeacher(w.email, { campus: campus, cls: cls, status: 'active' });
  return { ok: true, profile: profileOf(w.email, rec) };
}

function doRecords(data) {
  var w = whoIs(data);
  if (!w) return { error: 'session' };
  if (w.profile.needsProfile) return { error: 'profile' };
  var out = handlePortal({ rows: data.rows }, w.profile);
  return { ok: true, result: out };
}

function requireMaster(data) {
  var w = whoIs(data);
  return w && w.profile.role === 'master' ? w : null;
}

function doAdminList(data) {
  if (!requireMaster(data)) return { error: 'master' };
  var roster = readRoster();
  var list = Object.keys(roster).map(function (k) { var r = roster[k]; return { email: r.email, name: r.name, campus: r.campus, cls: r.cls, role: isMasterEmail(r.email) ? 'master' : r.role, status: r.status }; });
  MASTERS.forEach(function (m) { if (!roster[lower(m)]) list.push({ email: lower(m), name: '', campus: '', cls: '', role: 'master', status: 'not signed in yet' }); });
  list.sort(function (a, b) { return a.campus === b.campus ? (a.cls < b.cls ? -1 : 1) : (a.campus < b.campus ? -1 : 1); });
  return { ok: true, teachers: list, campuses: CAMPUSES };
}

function doAdminSave(data) {
  if (!requireMaster(data)) return { error: 'master' };
  var email = lower(data.email);
  if (email.indexOf('@') < 1) return { error: 'invalid' };
  var role = isMasterEmail(email) ? 'master' : (data.role === 'master' ? 'master' : 'teacher');
  var campus = String(data.campus || '').trim();
  if (campus && CAMPUSES.indexOf(campus) < 0) return { error: 'invalid' };
  upsertTeacher(email, { name: String(data.name || '').trim(), campus: campus, cls: String(data.cls || '').trim().slice(0, 20),
    role: role, status: 'set by admin' });
  return { ok: true };
}

function doAdminDelete(data) {
  if (!requireMaster(data)) return { error: 'master' };
  var email = lower(data.email);
  if (isMasterEmail(email)) return { error: 'protected' };
  var rec = readRoster()[email];
  if (rec) teachersSheet().deleteRow(rec.row);
  return { ok: true };
}

// ---------- One-time setup and a self-check (run these from the editor) ----------

// Run once: makes the Teachers tab, adds the masters, and creates the secret used to sign sessions.
function setupAuth() {
  secret();
  teachersSheet();
  MASTERS.forEach(function (m) {
    var e = lower(m);
    if (!readRoster()[e]) upsertTeacher(e, { role: 'master', status: 'master' });
  });
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=x', { muteHttpExceptions: true }); // asks Google for permission to check sign-ins
  Logger.log('Auth ready. Masters: ' + MASTERS.join(', '));
}

// Run any time: checks that sessions and the Teachers tab behave. Should end with "ALL OK".
function selfTest() {
  var problems = [];
  var s = makeSession('someone@example.com');
  if (readSession(s) !== 'someone@example.com') problems.push('session round trip failed');
  if (readSession(s + 'x') !== null) problems.push('tampered session was accepted');
  if (readSession('garbage') !== null) problems.push('garbage session was accepted');
  var e = 'selftest.delete.me@example.com';
  upsertTeacher(e, { name: 'Self Test', campus: 'Home office (testing)', cls: 'T1', status: 'test' });
  var rec = readRoster()[e];
  if (!rec || rec.cls !== 'T1') problems.push('could not write to the Teachers tab');
  if (rec) teachersSheet().deleteRow(rec.row);
  if (readRoster()[e]) problems.push('could not remove the test row');
  Logger.log(problems.length ? 'PROBLEMS: ' + problems.join('; ') : 'ALL OK');
}
