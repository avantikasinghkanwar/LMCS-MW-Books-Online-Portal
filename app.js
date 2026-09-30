/* LMCS Books Portal — M1 English, Books 1 and 2, for classroom smart panels.
   Plain JavaScript with no build step, so it runs on older Android panel browsers.
   Content lives in content.js; settings (Google Sheet link) in config.js. */
(function () {
  'use strict';

  var C = CONTENT;
  var APP_VERSION = 'm1-v3';
  var app = document.getElementById('app');
  var online = /^https?:/.test(location.protocol);

  // ---------- Small helpers ----------
  function $(id) { return document.getElementById(id); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function pageLabel(pages) { return pages.length > 1 ? 'pages ' + pages[0] + '–' + pages[pages.length - 1] : 'page ' + pages[0]; }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function setTheme(color, tint) {
    document.documentElement.style.setProperty('--theme', color || '#1E7BE0');
    document.documentElement.style.setProperty('--tint', tint || '#E8F1FC');
  }
  function cheer() {
    var c = $('cheer');
    c.hidden = true; void c.offsetWidth; c.hidden = false;
    setTimeout(function () { c.hidden = true; }, 1000);
  }

  // ---------- Audio ----------
  var currentAudio = null;
  function play(names) {
    if (typeof names === 'string') names = [names];
    if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; }
    var i = 0;
    function next() {
      if (i >= names.length) return;
      var a = new Audio('audio/' + names[i++] + '.m4a');
      currentAudio = a;
      a.onended = next;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    }
    next();
    Tracker.count('sounds');
  }

  // ---------- Pictures (emoji, with a fallback for older panels) ----------
  var SVG_PICS = {
    igloo: '<svg viewBox="0 0 100 80" width="1em" height="0.8em"><path d="M8 72 A42 42 0 0 1 92 72 Z" fill="#E8F4FF" stroke="#6AA9E0" stroke-width="3"/><path d="M20 50 H80 M12 62 H88 M36 36 H64 M30 36 V50 M50 36 V50 M70 36 V50 M40 50 V62 M60 50 V62" stroke="#6AA9E0" stroke-width="2.5" fill="none"/><path d="M38 72 V60 A12 12 0 0 1 62 60 V72 Z" fill="#35577A"/></svg>',
    quilt: '<svg viewBox="0 0 100 80" width="1em" height="0.8em"><rect x="6" y="6" width="88" height="68" rx="6" fill="#FFF3D6" stroke="#C98A50" stroke-width="3"/><g stroke="#fff" stroke-width="2"><rect x="10" y="10" width="26" height="20" fill="#E5484D"/><rect x="37" y="10" width="26" height="20" fill="#2FB45A"/><rect x="64" y="10" width="26" height="20" fill="#1E7BE0"/><rect x="10" y="31" width="26" height="19" fill="#E8A800"/><rect x="37" y="31" width="26" height="19" fill="#A445C9"/><rect x="64" y="31" width="26" height="19" fill="#E8457A"/><rect x="10" y="51" width="26" height="19" fill="#13A8B8"/><rect x="37" y="51" width="26" height="19" fill="#F5883A"/><rect x="64" y="51" width="26" height="19" fill="#5B4FE0"/></g></svg>'
  };
  var emojiOk = {};
  function canShow(emoji) {
    if (emojiOk[emoji] !== undefined) return emojiOk[emoji];
    var ok = true;
    try {
      var cv = document.createElement('canvas'); cv.width = cv.height = 24;
      var ctx = cv.getContext('2d');
      ctx.textBaseline = 'top'; ctx.font = '20px sans-serif';
      function draw(t) { ctx.clearRect(0, 0, 24, 24); ctx.fillText(t, 0, 0); return ctx.getImageData(0, 0, 24, 24).data.join(','); }
      var tofu = draw('🯿'); // unassigned character: shows as an empty box
      ok = draw(emoji) !== tofu;
    } catch (e) { ok = true; }
    emojiOk[emoji] = ok;
    return ok;
  }
  function pic(main, alt) {
    if (main.indexOf('svg:') === 0) return SVG_PICS[main.slice(4)];
    if (alt && !canShow(main)) return alt;
    return main;
  }

  // ---------- Tracking: one record per page visit ----------
  var Tracker = (function () {
    var visit = null, lastInfo = null;
    var QUEUE = 'lmcs.queue';

    function setup() { return store('lmcs.setup'); }
    function now() { return Date.now(); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function stamp(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

    function start(info) {
      end();
      lastInfo = info;
      visit = {
        info: info, start: now(), last: now(), active: 0,
        n: { touches: 0, traces: 0, sounds: 0, right: 0, wrong: 0, videos: 0, colours: 0, activity: 0 }
      };
    }
    function activity() {
      if (!visit) return;
      var t = now(), gap = t - visit.last;
      visit.active += Math.min(gap, CONFIG.IDLE_MINUTES * 60000);
      visit.last = t;
    }
    function count(what) { if (visit) { visit.n[what]++; activity(); } }

    function end() {
      if (!visit) return;
      var v = visit; visit = null;
      var s = setup() || {};
      var t = now();
      // Time after the last touch counts only up to the idle limit.
      var active = v.active + Math.min(t - v.last, CONFIG.IDLE_MINUTES * 60000);
      var seconds = Math.round((t - v.start) / 1000);
      var acted = 0;
      for (var k in v.n) if (k !== 'touches') acted += v.n[k]; // the tap that leaves the page doesn't count
      // Passing through a page doesn't count as a visit, unless something was actually done on it.
      if (seconds < 2 && !acted) return;
      var row = {
        start: stamp(v.start), end: stamp(t), seconds: seconds, active_seconds: Math.round(active / 1000),
        campus: s.campus || '', class_name: s.cls || '', teacher: s.teacher || '', panel: s.panel || '',
        book: v.info.book, page: v.info.page, item: v.info.item, part: v.info.part,
        touches: v.n.touches, traces: v.n.traces, sound_taps: v.n.sounds, game_right: v.n.right,
        game_wrong: v.n.wrong, video_plays: v.n.videos, colour_taps: v.n.colours, activity_done: v.n.activity ? 1 : 0, version: APP_VERSION
      };
      var q = store(QUEUE) || [];
      q.push(row);
      if (q.length > 5000) q = q.slice(-5000); // keep the newest if a panel is offline for weeks
      store(QUEUE, q);
      store('lmcs.last', { book: v.info.book, hash: v.info.hash, when: row.end });
    }

    var sending = false;
    function flush(useBeacon) {
      var q = store(QUEUE) || [];
      if (!q.length || !CONFIG.SHEET_URL || !online || sending) return;
      if (navigator.onLine === false) return;
      var batch = q.slice(0, 200);
      var body = JSON.stringify({ token: CONFIG.TOKEN, app: 'portal', rows: batch });
      function done() {
        var rest = (store(QUEUE) || []).slice(batch.length);
        store(QUEUE, rest);
        sending = false;
      }
      if (useBeacon && navigator.sendBeacon) {
        if (navigator.sendBeacon(CONFIG.SHEET_URL, body)) done();
        return;
      }
      sending = true;
      // text/plain + no-cors: the only way a static page can post to Google Apps Script.
      fetch(CONFIG.SHEET_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: body })
        .then(done, function () { sending = false; });
    }

    function waiting() { return (store(QUEUE) || []).length; }

    setInterval(function () { flush(false); }, 60000);
    window.addEventListener('online', function () { flush(false); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { end(); flush(true); }
      else if (!visit && lastInfo) start(lastInfo); // back on screen: carry on counting the same page
    });
    window.addEventListener('pagehide', function () { end(); flush(true); });
    app.addEventListener('pointerdown', function () { count('touches'); });

    function clearLast() { lastInfo = null; }

    return { start: start, end: end, count: count, flush: flush, setup: setup, waiting: waiting, clearLast: clearLast };
  })();

  // ---------- Finger tracing (canvas on top of a drawing) ----------
  function makeTracer(wrap, color) {
    var canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var last = {};

    function size() {
      var r = wrap.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.lineWidth = Math.max(14, Math.min(r.width, r.height) / 22);
    }
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function start(id, p) {
      last[id] = p;
      ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, 7); ctx.fill();
      Tracker.count('traces');
    }
    function move(id, p) {
      var l = last[id]; if (!l) return;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last[id] = p;
    }
    function end(id) { delete last[id]; }

    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', function (e) { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); start(e.pointerId, pos(e)); });
      canvas.addEventListener('pointermove', function (e) { move(e.pointerId, pos(e)); });
      canvas.addEventListener('pointerup', function (e) { end(e.pointerId); });
      canvas.addEventListener('pointercancel', function (e) { end(e.pointerId); });
    } else {
      canvas.addEventListener('touchstart', function (e) { e.preventDefault(); each(e.changedTouches, function (t) { start(t.identifier, pos(t)); }); });
      canvas.addEventListener('touchmove', function (e) { e.preventDefault(); each(e.changedTouches, function (t) { move(t.identifier, pos(t)); }); });
      canvas.addEventListener('touchend', function (e) { each(e.changedTouches, function (t) { end(t.identifier); }); });
    }
    size();
    window.addEventListener('resize', size);
    return {
      clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); },
      destroy: function () { window.removeEventListener('resize', size); }
    };
  }

  // Draws strokes one after another, like a teacher writing on the board.
  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function animateStrokes(svg, ms) {
    clearTimers();
    ms = ms || 1300;
    var delay = 0;
    each(svg.querySelectorAll('.anim'), function (p) {
      var len = p.getTotalLength();
      p.style.transition = 'none';
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.getBoundingClientRect();
      timers.push(setTimeout(function () {
        p.style.transition = 'stroke-dashoffset ' + ms / 1000 + 's ease-in-out';
        p.style.strokeDashoffset = 0;
      }, delay));
      delay += ms + 200;
    });
  }
  function hideStrokes(svg) {
    clearTimers();
    each(svg.querySelectorAll('.anim'), function (p) {
      var len = p.getTotalLength();
      p.style.transition = 'none';
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
  }

  // Numbered start dots: placed just before each stroke's start, nudged apart if two share a start.
  function addStartDots(svg, r) {
    var placed = [];
    each(svg.querySelectorAll('.anim'), function (p, i) {
      var a = p.getPointAtLength(0), b = p.getPointAtLength(Math.min(8, p.getTotalLength()));
      var dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var x = a.x + dx / d * r * 2, y = a.y + dy / d * r * 2;
      placed.forEach(function (q) {
        if (Math.abs(q.x - x) < r * 2 && Math.abs(q.y - y) < r * 2) { x += (dy / d) * r * 2.4; y -= (dx / d) * r * 2.4; }
      });
      placed.push({ x: x, y: y });
      var ns = 'http://www.w3.org/2000/svg';
      var g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'start-dot');
      var c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
      var t = document.createElementNS(ns, 'text'); t.setAttribute('x', x); t.setAttribute('y', y + r * 0.45); t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', r * 1.4); t.textContent = i + 1;
      g.appendChild(c); g.appendChild(t); svg.appendChild(g);
    });
  }

  function letterSvg(strokes) {
    var s = '<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">';
    strokes.forEach(function (d) { s += '<path class="track" stroke-width="46" d="' + d + '"/>'; });
    strokes.forEach(function (d) { s += '<path class="guide" stroke-width="7" d="' + d + '"/>'; });
    strokes.forEach(function (d) { s += '<path class="anim" stroke-width="30" d="' + d + '"/>'; });
    return s + '</svg>';
  }

  // ---------- Pre-writing shapes ----------
  function shapePaths(shape, x, y, w, h) {
    var cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
    switch (shape) {
      case 'standing': return ['M' + cx + ' ' + y + ' L' + cx + ' ' + (y + h)];
      case 'sleeping': return ['M' + x + ' ' + cy + ' L' + (x + w) + ' ' + cy];
      // Circle starts at the top and goes round anticlockwise.
      case 'circle': return ['M' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 1 0 ' + cx + ' ' + (cy + r) + ' A' + r + ' ' + r + ' 0 1 0 ' + cx + ' ' + (cy - r)];
      case 'cross': return ['M' + cx + ' ' + y + ' L' + cx + ' ' + (y + h), 'M' + x + ' ' + cy + ' L' + (x + w) + ' ' + cy];
      case 'square': return ['M' + x + ' ' + y + ' L' + x + ' ' + (y + h) + ' L' + (x + w) + ' ' + (y + h) + ' L' + (x + w) + ' ' + y + ' L' + x + ' ' + y];
      case 'diagonal': return ['M' + x + ' ' + y + ' L' + (x + w) + ' ' + (y + h)];
      case 'triangle': return ['M' + cx + ' ' + y + ' L' + x + ' ' + (y + h) + ' L' + (x + w) + ' ' + (y + h) + ' L' + cx + ' ' + y];
    }
    return [];
  }
  function shapeSvg(paths, guideW, animW) {
    var s = '';
    paths.forEach(function (d) { s += '<path class="guide" stroke-width="' + guideW + '" d="' + d + '"/>'; });
    paths.forEach(function (d) { s += '<path class="anim" stroke-width="' + animW + '" d="' + d + '"/>'; });
    return s;
  }

  // ---------- Video (online only) ----------
  function videoButton(id) {
    if (!online || navigator.onLine === false || !id) return '';
    return '<button class="btn yt" data-video="' + id + '">▶ Watch video</button>';
  }
  function openVideo(id) {
    $('videoFrame').innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1&autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    $('videoOverlay').hidden = false;
    Tracker.count('videos');
  }
  function closeVideo() { $('videoFrame').innerHTML = ''; $('videoOverlay').hidden = true; }

  // ---------- Book structure ----------
  function itemTitle(it) {
    if (it.type === 'letter') return C.LETTERS[it.letter].title;
    if (it.type === 'prewriting') return C.SKILLS[it.skill].title;
    if (it.type === 'chart') return 'A–Z Chart';
    if (it.type === 'colourletters') return 'Read the Alphabet and Colour';
    if (it.type === 'blank') return 'Free Colouring';
    return '';
  }
  function itemIcon(it) {
    if (it.type === 'letter') return '<span class="glyph" style="color:' + C.LETTERS[it.letter].color + '">' + it.letter + '</span>';
    if (it.type === 'prewriting') return '<span class="emoji">' + pic(it.scene, it.alt) + '</span>';
    if (it.type === 'chart') return '<span class="emoji">🔤</span>';
    if (it.type === 'colourletters') return '<span class="emoji">🖍️</span>';
    return '<span class="emoji">🎨</span>';
  }
  function tabsFor(it) {
    if (it.type === 'letter') return [['meet', '1 · Meet ' + it.letter, it.pages[0]], ['words', '2 · Words & game', it.pages[1]], ['activity', '3 · Activity', it.pages[0]]];
    if (it.type === 'prewriting') return [['trace', '1 · Trace the picture', it.pages[0]], ['practice', '2 · Practice', it.pages[1]]];
    return [['main', '', it.pages.join('–')]];
  }

  // ---------- Screens ----------
  var cleanup = null;

  function renderSetup() {
    setTheme();
    var s = Tracker.setup() || {};
    var opts = CONFIG.CAMPUSES.map(function (c) { return '<option' + (s.campus === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    app.innerHTML =
      '<div class="setup">' +
      '<h1>Panel setup</h1>' +
      '<p class="muted">Done once per panel. It tells the school which class is using this panel. No student names are recorded.</p>' +
      '<label>Campus<select id="sCampus"><option value="">Choose…</option>' + opts + '</select></label>' +
      '<label>Class and section<input id="sClass" placeholder="e.g. M1-A" value="' + esc(s.cls || '') + '"></label>' +
      '<label>Class teacher<input id="sTeacher" placeholder="e.g. Ms Neha" value="' + esc(s.teacher || '') + '"></label>' +
      '<p class="error" id="sErr" hidden>Please fill in all three.</p>' +
      '<button class="btn" id="sSave">Save and start</button>' +
      '</div>';
    $('sSave').onclick = function () {
      var campus = $('sCampus').value, cls = $('sClass').value.trim(), teacher = $('sTeacher').value.trim();
      if (!campus || !cls || !teacher) { $('sErr').hidden = false; return; }
      var panel = s.panel || ('P' + Math.random().toString(36).slice(2, 8).toUpperCase());
      store('lmcs.setup', { campus: campus, cls: cls, teacher: teacher, panel: panel });
      location.hash = 'home';
      route();
    };
  }

  function renderHome() {
    setTheme();
    var s = Tracker.setup() || {};
    var last = store('lmcs.last');
    var resume = last && last.hash ? '<button class="btn resume" data-go="' + last.hash + '">↩ Continue where we stopped</button>' : '';
    app.innerHTML =
      '<div class="home">' +
      '<h1>M1 English</h1>' + resume +
      '<div class="tiles two">' +
      '<button class="tile" style="--c:#E5484D" data-go="book/1"><div class="glyph">A–N</div><div class="label">Book 1</div><div class="sub">Term 1 · 47 pages</div></button>' +
      '<button class="tile" style="--c:#1E7BE0" data-go="book/2"><div class="glyph">O–Z</div><div class="label">Book 2</div><div class="sub">Term 2 · 43 pages</div></button>' +
      '</div>' +
      '<p class="panel-id">' + esc([s.campus, s.cls, s.teacher].join(' · ')) + '</p>' +
      '</div>';
  }

  function renderBook(b) {
    var book = C.BOOKS[b];
    setTheme(b === '1' ? '#E5484D' : '#1E7BE0', b === '1' ? '#FDECEC' : '#E8F1FC');
    var cards = book.items.map(function (it, i) {
      return '<button class="page-card" data-go="b' + b + '/' + i + '/' + tabsFor(it)[0][0] + '">' +
        itemIcon(it) + '<span class="pc-title">' + itemTitle(it) + '</span>' +
        '<span class="pc-pages">' + pageLabel(it.pages) + '</span></button>';
    }).join('');
    app.innerHTML =
      '<div class="screen"><div class="screen-head"><h1>' + book.title + '</h1><span class="pill">Tap the page the class is on</span></div>' +
      '<div class="page-grid">' + cards + '</div></div>';
  }

  function head(it, b, i, tab) {
    var tabs = tabsFor(it);
    var tabHtml = tabs.length > 1 ? '<div class="tabs">' + tabs.map(function (t) {
      return '<button class="tab' + (t[0] === tab ? ' on' : '') + '" data-go="b' + b + '/' + i + '/' + t[0] + '">' + esc(t[1]) + (t[0] === 'activity' && it.type === 'letter' && activityDone(it.letter) ? ' ✔' : '') + '</button>';
    }).join('') + '</div>' : '';
    return '<div class="screen-head"><h1>' + itemTitle(it) + '</h1><span class="page-tag">Book ' + b + ' · ' + pageLabel(it.pages) + '</span>' + tabHtml + '</div>';
  }

  function navBar(b, i) {
    var items = C.BOOKS[b].items;
    var prev = items[i - 1], next = items[i + 1];
    return '<div class="navbar">' +
      (prev ? '<button class="btn soft" data-go="b' + b + '/' + (i - 1) + '/' + tabsFor(prev)[0][0] + '">◀ ' + itemTitle(prev) + '</button>' : '<span></span>') +
      '<button class="btn soft" data-go="book/' + b + '">☰ All pages</button>' +
      (next ? '<button class="btn soft" data-go="b' + b + '/' + (i + 1) + '/' + tabsFor(next)[0][0] + '">' + itemTitle(next) + ' ▶</button>' : '<span></span>') +
      '</div>';
  }

  function renderMeet(L) {
    var k = L.key.toLowerCase();
    var html =
      '<div class="split">' +
      '<div class="panel"><div class="trace-wrap" id="trace">' + letterSvg(L.strokes) + '</div>' +
      '<div class="controls"><button class="btn" id="showMe">▶ Show me</button><button class="btn soft" id="clear">🧽 Clear</button>' + videoButton(L.video) + '</div></div>' +
      '<div class="panel sound-panel">' +
      '<button class="big-letter-btn" id="bigLetter">' + L.key + '</button>' +
      '<div class="sound-row"><button class="btn" id="name">🔊 Name</button><button class="btn" id="sound">🔊 Sound</button><button class="btn" id="cue">🔊 Hindi cue</button></div>' +
      '<div class="cue">' + esc(L.cue) + '</div></div></div>';
    return {
      html: html,
      init: function () {
        var wrap = $('trace'), svg = wrap.querySelector('svg');
        addStartDots(svg, 15);
        hideStrokes(svg);
        var tracer = makeTracer(wrap, L.color);
        $('showMe').onclick = function () { tracer.clear(); animateStrokes(svg); };
        $('clear').onclick = function () { tracer.clear(); hideStrokes(svg); };
        $('bigLetter').onclick = function () { play(['l_' + k + '_name', 'l_' + k + '_sound']); };
        $('name').onclick = function () { play('l_' + k + '_name'); };
        $('sound').onclick = function () { play('l_' + k + '_sound'); };
        $('cue').onclick = function () { play('l_' + k + '_cue'); };
        return tracer.destroy;
      }
    };
  }

  function renderWords(L) {
    var k = L.key.toLowerCase();
    var cards = L.words.map(function (w) {
      return '<button class="word-card" data-audio="' + w.audio + '"><div class="pic">' + pic(w.pic, w.alt) + '</div>' +
        '<div class="name"><b>' + esc(w.name.charAt(0)) + '</b>' + esc(w.name.slice(1)) + '</div></button>';
    }).join('');
    // Wrong answers come from other letters' words.
    var others = [];
    Object.keys(C.LETTERS).forEach(function (key) {
      if (key !== L.key) C.LETTERS[key].words.forEach(function (w) { if (w.name.charAt(0) !== L.key) others.push(w); });
    });
    var html =
      '<div class="panel grow">' +
      '<div class="word-row">' + cards + '</div>' +
      '<div class="game"><h2>Which one starts with ' + L.key + '?</h2><div class="game-row" id="game"></div>' +
      '<div class="controls"><button class="btn soft" id="ask">🔊 Ask</button><button class="btn soft" id="again">🔁 New round</button></div></div></div>';
    return {
      html: html,
      init: function () {
        each(app.querySelectorAll('.word-card'), function (b) { b.onclick = function () { play(b.getAttribute('data-audio')); }; });
        var round = 0;
        function newRound() {
          var target = L.words[round++ % L.words.length];
          var wrong = shuffle(others).slice(0, 2);
          var opts = shuffle([{ w: target, ok: true }, { w: wrong[0], ok: false }, { w: wrong[1], ok: false }]);
          var row = $('game'); row.innerHTML = '';
          opts.forEach(function (o) {
            var b = document.createElement('button');
            b.className = 'choice';
            b.innerHTML = pic(o.w.pic, o.w.alt);
            b.onclick = function () {
              if (o.ok) { b.classList.add('right'); play('p_well_done'); Tracker.count('right'); cheer(); }
              else { b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); play('p_try_again'); Tracker.count('wrong'); }
            };
            row.appendChild(b);
          });
        }
        $('again').onclick = newRound;
        $('ask').onclick = function () { play('l_' + k + '_question'); };
        newRound();
      }
    };
  }

  // Which activities this panel has marked as done (kept on the panel, sent to the sheet when ticked).
  function activityDone(key) { var d = store('lmcs.done') || {}; return d[key] || ''; }
  function setActivityDone(key, val) {
    var d = store('lmcs.done') || {};
    if (val) d[key] = val; else delete d[key];
    store('lmcs.done', d);
  }
  function today() { var d = new Date(); return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]; }

  function renderActivity(L) {
    var A = ACTIVITIES[L.key];
    var mats = /^none/i.test(A.materials) ? 'No materials needed' : A.materials;
    var html =
      '<div class="split act">' +
      '<div class="panel">' +
      '<div class="act-label">🧺 Montessori activity</div><div class="act-text">' + esc(A.montessori) + '</div>' +
      '<div class="act-label">🧰 Materials</div><div class="act-mats">' + esc(mats) + '</div>' +
      '</div>' +
      '<div class="panel">' +
      '<div class="act-label">🗣️ Listening &amp; speaking</div><div class="act-text">' + esc(A.speaking) + '</div>' +
      '<div class="controls"><button class="btn soft" id="hear">🔊 Hear the words</button></div>' +
      '<div class="done-box" id="doneBox"></div>' +
      '</div></div>';
    return {
      html: html,
      init: function () {
        $('hear').onclick = function () { play(L.words.map(function (w) { return w.audio; })); };
        function paint() {
          var when = activityDone(L.key);
          $('doneBox').innerHTML = when
            ? '<div class="done yes">✔ Done on ' + esc(when) + '</div><button class="btn soft small-btn" id="undo">Undo</button>'
            : '<button class="btn big-done" id="markDone">✓ We did this activity</button>';
          if (when) $('undo').onclick = function () { setActivityDone(L.key, ''); paint(); refreshTabs(); };
          else $('markDone').onclick = function () { setActivityDone(L.key, today()); Tracker.count('activity'); cheer(); paint(); refreshTabs(); };
        }
        function refreshTabs() {
          each(app.querySelectorAll('.tab'), function (t) {
            if (/activity$/.test(t.getAttribute('data-go'))) t.innerHTML = '3 · Activity' + (activityDone(L.key) ? ' ✔' : '');
          });
        }
        paint();
      }
    };
  }

  function renderTrace(it) {
    var shape = C.SKILLS[it.skill].shape;
    var wide = shape === 'sleeping';
    var svg = '<svg viewBox="0 0 900 500" preserveAspectRatio="xMidYMid meet">';
    svg += '<rect x="0" y="420" width="900" height="80" fill="#9ED36A" opacity=".6"/>';
    var xs = [150, 450, 750], paths = [];
    xs.forEach(function (x) {
      svg += '<text x="' + x + '" y="110" text-anchor="middle" font-size="90">' + pic(it.scene, it.alt) + '</text>';
      var w = wide ? 230 : 170, h = wide ? 120 : 250;
      if (shape === 'standing') { w = 60; }
      paths = paths.concat(shapePaths(shape, x - w / 2, 150, w, h));
    });
    svg += shapeSvg(paths, 8, 18) + '</svg>';
    var html =
      '<div class="panel grow"><div class="line-scene" id="scene">' + svg + '</div>' +
      '<div class="controls"><button class="btn" id="showMe">▶ Show me</button><button class="btn soft" id="say">🔊 Listen</button><button class="btn soft" id="clear">🧽 Clear</button>' +
      '<span class="new-word">New word: <b>' + esc(it.word) + '</b></span></div></div>';
    return {
      html: html,
      init: function () {
        var scene = $('scene'), svgEl = scene.querySelector('svg');
        addStartDots(svgEl, 14);
        hideStrokes(svgEl);
        var tracer = makeTracer(scene, '#5B4FE0');
        $('showMe').onclick = function () { tracer.clear(); animateStrokes(svgEl, 1100); };
        $('say').onclick = function () { play('pw_' + it.word); };
        $('clear').onclick = function () { tracer.clear(); hideStrokes(svgEl); };
        return tracer.destroy;
      }
    };
  }

  function renderPractice(it) {
    var shape = C.SKILLS[it.skill].shape;
    var svg = '<svg viewBox="0 0 900 500" preserveAspectRatio="xMidYMid meet">';
    var rows = [30, 190, 350], paths = [], firsts = [];
    rows.forEach(function (y) {
      svg += '<line x1="20" x2="880" y1="' + (y + 120) + '" y2="' + (y + 120) + '" stroke="#C9D6E8" stroke-width="3"/>';
      svg += '<line x1="20" x2="880" y1="' + y + '" y2="' + y + '" stroke="#E3EAF3" stroke-width="2"/>';
      for (var c = 0; c < 6; c++) {
        var p = shapePaths(shape, 50 + c * 140, y + 10, shape === 'sleeping' ? 100 : 100, 100);
        if (c === 0) firsts = firsts.concat(p); else paths = paths.concat(p);
      }
    });
    // Only the first shape in each row animates; the rest are dotted guides to trace.
    svg += shapeSvg(firsts, 6, 12);
    paths.forEach(function (d) { svg += '<path class="guide" stroke-width="6" d="' + d + '"/>'; });
    svg += '</svg>';
    var html =
      '<div class="panel grow"><div class="line-scene ruled" id="scene">' + svg + '</div>' +
      '<div class="controls"><button class="btn" id="showMe">▶ Show me</button><button class="btn soft" id="clear">🧽 Clear</button>' +
      '<span class="new-word">Trace the dotted shapes, then draw your own</span></div></div>';
    return {
      html: html,
      init: function () {
        var scene = $('scene'), svgEl = scene.querySelector('svg');
        hideStrokes(svgEl);
        var tracer = makeTracer(scene, '#5B4FE0');
        $('showMe').onclick = function () { tracer.clear(); animateStrokes(svgEl, 900); };
        $('clear').onclick = function () { tracer.clear(); hideStrokes(svgEl); };
        return tracer.destroy;
      }
    };
  }

  function renderChart() {
    var s = '';
    Object.keys(C.LETTERS).forEach(function (key) {
      var L = C.LETTERS[key];
      s += '<button style="--c:' + L.color + '" data-letter="' + key + '">' + key + '<small>' + pic(L.words[0].pic, L.words[0].alt) + '</small></button>';
    });
    return {
      html: '<div class="controls top"><span class="pill">👆 Point &amp; say the name and sound</span><button class="btn soft" id="say">🔊 Listen</button></div><div class="chart">' + s + '</div>',
      init: function () {
        each(app.querySelectorAll('[data-letter]'), function (b) {
          var k = b.getAttribute('data-letter').toLowerCase();
          b.onclick = function () { play(['l_' + k + '_name', 'l_' + k + '_sound']); };
        });
        $('say').onclick = function () { play('p_chart'); };
      }
    };
  }

  function renderColourLetters() {
    var s = '';
    Object.keys(C.LETTERS).forEach(function (key) { s += '<button class="outline-letter" style="--c:' + C.LETTERS[key].color + '" data-letter="' + key + '">' + key + '</button>'; });
    return {
      html: '<div class="controls top"><span class="pill">🖍️ Read each letter and tap to colour it</span><button class="btn soft" id="say">🔊 Listen</button><button class="btn soft" id="clearAll">🧽 Clear all</button></div><div class="chart colour">' + s + '</div>',
      init: function () {
        each(app.querySelectorAll('[data-letter]'), function (b) {
          var k = b.getAttribute('data-letter').toLowerCase();
          b.onclick = function () {
            b.classList.toggle('filled');
            if (b.classList.contains('filled')) { play('l_' + k + '_name'); Tracker.count('colours'); }
          };
        });
        $('say').onclick = function () { play('p_colour_letters'); };
        $('clearAll').onclick = function () { each(app.querySelectorAll('.filled'), function (b) { b.classList.remove('filled'); }); };
      }
    };
  }

  function renderBlank() {
    return { html: '<div class="panel grow center"><div class="emoji-big">🎨</div><h2>Free colouring</h2><p class="muted">The picture for this page is coming soon. Use the book for now.</p></div>' };
  }

  function renderItem(b, i, tab) {
    var it = C.BOOKS[b].items[i];
    var body;
    if (it.type === 'letter') {
      var L = C.LETTERS[it.letter];
      setTheme(L.color, L.tint);
      body = tab === 'words' ? renderWords(L) : tab === 'activity' ? renderActivity(L) : renderMeet(L);
    } else if (it.type === 'prewriting') {
      setTheme('#8b7bd8', '#EFEBFB');
      body = tab === 'practice' ? renderPractice(it) : renderTrace(it);
    } else {
      setTheme('#2FB45A', '#E6F7EC');
      body = it.type === 'chart' ? renderChart() : it.type === 'colourletters' ? renderColourLetters() : renderBlank();
    }
    app.innerHTML = '<div class="screen">' + head(it, b, i, tab) + body.html + navBar(b, i) + '</div>';
    if (body.init) cleanup = body.init() || null;

    var t = tabsFor(it).filter(function (x) { return x[0] === tab; })[0] || tabsFor(it)[0];
    Tracker.start({ book: b, page: String(t[2]), item: itemTitle(it), part: t[1] || itemTitle(it), hash: location.hash.slice(1) });
    fillNotes(it, b, t[2]);
  }

  // ---------- Teacher notes ----------
  var NOTES = {
    letter: [
      '<b>Meet the letter:</b> tap the big letter, <b>Sound</b> and <b>Hindi cue</b>. Children repeat each one.',
      'Tap <b>▶ Show me</b>. The letter draws itself (1, 2, 3…). Children air-draw with you.',
      'Call 2–3 children to trace on the panel. <b>Clear</b> between turns.',
      '<b>Words &amp; game:</b> tap each picture; children repeat and listen for the first sound. Then a child taps the picture that starts with the letter.',
      '<b>Activity:</b> do the Montessori activity, then the listening-speaking task. Tap <b>We did this activity</b> so the school can see it was done.',
      'Book: intro page = <b>finger-trace only</b>, no pencil. Colouring page = colour the big picture.'
    ],
    prewriting: [
      '<b>Trace the picture:</b> tap <b>▶ Show me</b> and say where to start and which way to go.',
      'Children air-draw, then 2–3 children trace on the panel. <b>Clear</b> between turns.',
      'Teach the new word shown at the bottom.',
      '<b>Practice:</b> show the first shape in each row, children trace the dotted ones.',
      'Book: picture page = finger + colour; practice page = pencil.'
    ],
    chart: ['Point to a letter; children say its name and sound.', 'Tap a letter to check the sound together.'],
    colourletters: ['Children read each letter aloud, then tap it to colour it.', 'Book: colour the letters with crayons.'],
    blank: ['Picture for this page still to be chosen. Use the book.'],
    home: ['Choose the book, then the page the class is on.', '<b>Continue where we stopped</b> opens the last page used on this panel.']
  };
  function fillNotes(it, b, page) {
    var type = it ? it.type : 'home';
    var ref = it ? '<div class="book-ref">📖 Book ' + b + ' · page ' + page + '</div>' : '';
    var waiting = Tracker.waiting();
    var tip = it && it.type === 'letter' && ACTIVITIES[it.letter] && ACTIVITIES[it.letter].sound
      ? '<div class="sound-tip">🗣️ <b>How to say the sound:</b> ' + esc(ACTIVITIES[it.letter].sound) + '</div>' : '';
    $('drawerBody').innerHTML = ref + tip + '<ol>' + NOTES[type].map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      '<hr><p class="muted small">Class records waiting to send: ' + waiting + (CONFIG.SHEET_URL ? '' : ' (sheet not connected yet)') + '</p>' +
      '<button class="btn soft" data-go="setup">⚙ Panel setup</button>';
  }

  // ---------- Router ----------
  // #home · #setup · #book/1 · #b1/5/meet (book 1, item 5, tab)
  function route() {
    Tracker.end();
    Tracker.clearLast();
    Tracker.flush(false);
    if (cleanup) { cleanup(); cleanup = null; }
    clearTimers();
    closeVideo();
    $('drawer').classList.remove('open');
    var h = location.hash.slice(1) || 'home';
    var m;
    if (!Tracker.setup() || h === 'setup') { renderSetup(); fillNotes(null); }
    else if ((m = h.match(/^book\/([12])$/))) { renderBook(m[1]); fillNotes(null); }
    else if ((m = h.match(/^b([12])\/(\d+)\/(\w+)$/)) && C.BOOKS[m[1]].items[+m[2]]) { renderItem(m[1], +m[2], m[3]); }
    else { renderHome(); fillNotes(null); }
    app.scrollTop = 0;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-go],[data-video]') : null;
    if (!t) return;
    if (t.hasAttribute('data-video')) { openVideo(t.getAttribute('data-video')); return; }
    var go = t.getAttribute('data-go');
    if (location.hash.slice(1) === go) route(); else location.hash = go;
  });
  $('btnHome').onclick = function () { location.hash = 'home'; };
  $('btnTeacher').onclick = function () { $('drawer').classList.toggle('open'); };
  $('drawerClose').onclick = function () { $('drawer').classList.remove('open'); };
  $('videoClose').onclick = closeVideo;
  window.addEventListener('hashchange', route);
  route();

  // Save everything on the panel after the first visit, so it works without internet.
  if (online && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
