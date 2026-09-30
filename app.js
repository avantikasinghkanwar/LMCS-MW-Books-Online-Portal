/* LMCS Books Portal — M1 English pilot (Standing Line, A, B).
   Plain JavaScript, no build step, so it runs on older Android panel browsers
   and straight from a copied folder. */
(function () {
  'use strict';

  // ---------- Content (mirrors Book 1 of M1 English) ----------
  var LETTERS = {
    A: {
      color: '#E5484D', tint: '#FDECEC',
      title: 'A is for Apple',
      cue: 'A says ऐ, as in apple',
      book: 'Book 1 · pages 4–5',
      youtube: 'y6X_8nsZwec',
      words: [
        { name: 'APPLE', pic: '🍎', audio: 'apple' },
        { name: 'ANT', pic: '🐜', audio: 'ant' },
        { name: 'AXE', pic: '🪓', audio: 'axe' }
      ],
      distractors: [{ name: 'BALL', pic: '⚽' }, { name: 'CAT', pic: '🐱' }],
      // Stroke order for print capital A, drawn in a 300 x 300 box.
      strokes: ['M150 34 L62 266', 'M150 34 L238 266', 'M96 180 L204 180'],
      // Where each numbered start dot sits, relative to its stroke's first point.
      dots: [[-30, -6], [30, -6], [-28, 0]]
    },
    B: {
      color: '#1E7BE0', tint: '#E8F1FC',
      title: 'B is for Ball',
      cue: 'B says ब्, as in ball',
      book: 'Book 1 · pages 6–7',
      youtube: 'F4m2w7irgUg',
      words: [
        { name: 'BALL', pic: '⚽', audio: 'ball' },
        { name: 'BANANA', pic: '🍌', audio: 'banana' },
        { name: 'BUS', pic: '🚌', audio: 'bus' }
      ],
      distractors: [{ name: 'APPLE', pic: '🍎' }, { name: 'DOG', pic: '🐶' }],
      strokes: [
        'M92 34 L92 266',
        'M92 34 L168 34 C236 34 236 150 168 150 L92 150',
        'M92 150 L178 150 C252 150 252 266 178 266 L92 266'
      ],
      dots: [[-30, 0], [26, -28], [-30, 0]]
    }
  };

  var NOTES = {
    home: {
      book: 'M1 English · Book 1',
      steps: [
        'Open the tile that matches today\'s book page.',
        'Every screen has its own notes here.',
        'Sound needs the panel volume turned up.'
      ]
    },
    line: {
      book: 'Book 1 · pages 2–3',
      steps: [
        'Tap <b>▶ Show me</b>. The strings draw from top to bottom. Say: "Start at the top… go down."',
        'Children draw the line in the air with one finger, with you.',
        'Call 2–3 children to trace the strings on the panel. Tap <b>Clear</b> between turns.',
        'Open the book: finger-trace page 2, then pencil on page 3.'
      ]
    },
    meet: {
      steps: [
        'Tap the big letter: children hear its <b>name</b>. Tap <b>Sound</b> and <b>Hindi cue</b> too. Children repeat each one.',
        'Tap <b>▶ Show me</b>. The letter draws itself stroke by stroke (1, 2, 3). Children air-draw with you.',
        'Call 2–3 children to trace the letter on the panel. Tap <b>Clear</b> between turns.',
        'Open the book, intro page: <b>finger-trace only</b>, no pencil.'
      ]
    },
    words: {
      steps: [
        'Tap each picture. Children repeat the word and listen for the first sound.',
        'Play the game: a child taps the picture that starts with the letter.',
        'Open the book, colouring page: colour the big picture.'
      ]
    },
    chart: {
      book: 'Book 1 · page 1',
      steps: [
        'Point to a letter. Children say its name and sound.',
        'In the pilot only A and B play sound. The other letters come later.'
      ]
    }
  };

  // ---------- Helpers ----------
  var app = document.getElementById('app');
  var online = /^https?:/.test(location.protocol);
  var currentAudio = null;

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function play(names) {
    if (typeof names === 'string') names = [names];
    if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; }
    var i = 0;
    function next() {
      if (i >= names.length) return;
      var a = new Audio('audio/' + names[i++] + '.m4a');
      currentAudio = a;
      a.onended = next;
      a.play().catch(function () {});
    }
    next();
  }

  function setTheme(color, tint) {
    document.documentElement.style.setProperty('--theme', color || '#1E7BE0');
    document.documentElement.style.setProperty('--tint', tint || '#E8F1FC');
  }

  function cheer() {
    var c = document.getElementById('cheer');
    c.hidden = true;
    void c.offsetWidth; // restart animation
    c.hidden = false;
    setTimeout(function () { c.hidden = true; }, 1000);
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function firstPoint(d) {
    var m = d.match(/M\s*([\d.]+)[ ,]+([\d.]+)/);
    return { x: +m[1], y: +m[2] };
  }

  // ---------- Finger tracing (canvas on top of the letter) ----------
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
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(14, r.width / 30);
    }
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function start(id, p) { last[id] = p; ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, 7); ctx.fillStyle = color; ctx.fill(); }
    function move(id, p) {
      var l = last[id]; if (!l) return;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last[id] = p;
    }
    function end(id) { delete last[id]; }

    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); start(e.pointerId, pos(e)); });
      canvas.addEventListener('pointermove', function (e) { move(e.pointerId, pos(e)); });
      canvas.addEventListener('pointerup', function (e) { end(e.pointerId); });
      canvas.addEventListener('pointercancel', function (e) { end(e.pointerId); });
    } else {
      canvas.addEventListener('touchstart', function (e) { e.preventDefault(); [].forEach.call(e.changedTouches, function (t) { start(t.identifier, pos(t)); }); });
      canvas.addEventListener('touchmove', function (e) { e.preventDefault(); [].forEach.call(e.changedTouches, function (t) { move(t.identifier, pos(t)); }); });
      canvas.addEventListener('touchend', function (e) { [].forEach.call(e.changedTouches, function (t) { end(t.identifier); }); });
      canvas.addEventListener('mousedown', function (e) { start('m', pos(e)); });
      canvas.addEventListener('mousemove', function (e) { move('m', pos(e)); });
      window.addEventListener('mouseup', function () { end('m'); });
    }

    size();
    window.addEventListener('resize', size);
    return {
      clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); },
      destroy: function () { window.removeEventListener('resize', size); }
    };
  }

  // Draws each stroke one after another, like a teacher writing on the board.
  function animateStrokes(svg) {
    var paths = svg.querySelectorAll('.anim');
    var delay = 0;
    [].forEach.call(paths, function (p) {
      var len = p.getTotalLength();
      p.style.transition = 'none';
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.getBoundingClientRect();
      setTimeout(function () {
        p.style.transition = 'stroke-dashoffset 1.3s ease-in-out';
        p.style.strokeDashoffset = 0;
      }, delay);
      delay += 1500;
    });
  }

  function hideStrokes(svg) {
    [].forEach.call(svg.querySelectorAll('.anim'), function (p) {
      var len = p.getTotalLength();
      p.style.transition = 'none';
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
  }

  function letterSvg(strokes, dots) {
    var s = '<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">';
    strokes.forEach(function (d) { s += '<path class="track" stroke-width="46" d="' + d + '"/>'; });
    strokes.forEach(function (d) { s += '<path class="guide" stroke-width="7" d="' + d + '"/>'; });
    strokes.forEach(function (d) { s += '<path class="anim" stroke-width="30" d="' + d + '"/>'; });
    strokes.forEach(function (d, i) {
      var p = firstPoint(d);
      var cx = p.x + dots[i][0], cy = p.y + dots[i][1];
      s += '<g class="start-dot"><circle cx="' + cx + '" cy="' + cy + '" r="15"/>' +
           '<text x="' + cx + '" y="' + (cy + 7) + '" text-anchor="middle">' + (i + 1) + '</text></g>';
    });
    return s + '</svg>';
  }

  // ---------- Video (online only) ----------
  function videoButton(id) {
    if (!online || !navigator.onLine || !id) return '';
    return '<button class="btn yt" data-video="' + id + '">▶ Watch video</button>';
  }
  function openVideo(id) {
    document.getElementById('videoFrame').innerHTML =
      '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0&playsinline=1&autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    document.getElementById('videoOverlay').hidden = false;
  }
  function closeVideo() {
    document.getElementById('videoFrame').innerHTML = '';
    document.getElementById('videoOverlay').hidden = true;
  }

  // ---------- Screens ----------
  var cleanup = null;

  function renderHome() {
    setTheme();
    app.innerHTML =
      '<div class="home">' +
      '<h1>Let\'s learn!</h1>' +
      '<div class="tiles">' +
      '<button class="tile" style="--c:#8b7bd8" data-go="line"><div class="emoji">🎈</div><div class="label">Standing Line</div><div class="sub">Book 1 · p. 2–3</div></button>' +
      '<button class="tile" style="--c:' + LETTERS.A.color + '" data-go="A"><div class="glyph">A</div><div class="label">A is for Apple</div><div class="sub">Book 1 · p. 4–5</div></button>' +
      '<button class="tile" style="--c:' + LETTERS.B.color + '" data-go="B"><div class="glyph">B</div><div class="label">B is for Ball</div><div class="sub">Book 1 · p. 6–7</div></button>' +
      '<button class="tile" style="--c:#2FB45A" data-go="chart"><div class="emoji">🔤</div><div class="label">A–Z Chart</div><div class="sub">Book 1 · p. 1</div></button>' +
      '</div></div>';
  }

  function renderLine() {
    setTheme('#8b7bd8', '#EFEBFB');
    var xs = [110, 230, 350, 470];
    var svg = '<svg viewBox="0 0 580 400" preserveAspectRatio="xMidYMid meet">';
    svg += '<rect x="0" y="330" width="580" height="70" fill="#9ED36A"/>';
    for (var f = 20; f < 580; f += 40) svg += '<rect x="' + f + '" y="300" width="18" height="60" rx="6" fill="#D9A066"/>';
    svg += '<rect x="0" y="318" width="580" height="10" fill="#C98A50"/>';
    xs.forEach(function (x, i) {
      var colors = ['#E5484D', '#1E7BE0', '#E8A800', '#2FB45A'];
      svg += '<ellipse cx="' + x + '" cy="62" rx="38" ry="46" fill="' + colors[i] + '"/>';
      svg += '<path d="M' + (x - 6) + ' 106 L' + (x + 6) + ' 106 L' + x + ' 116 Z" fill="' + colors[i] + '"/>';
    });
    xs.forEach(function (x) { svg += '<path class="guide" stroke-width="6" d="M' + x + ' 118 L' + x + ' 310"/>'; });
    xs.forEach(function (x) { svg += '<path class="anim" stroke-width="14" d="M' + x + ' 118 L' + x + ' 310"/>'; });
    xs.forEach(function (x) { svg += '<g class="start-dot"><circle cx="' + (x + 26) + '" cy="126" r="13"/><text x="' + (x + 26) + '" y="133" text-anchor="middle" style="font-size:18px">↓</text></g>'; });
    svg += '</svg>';

    app.innerHTML =
      '<div class="screen">' +
      '<div class="screen-head"><h1>Standing Line</h1><span class="pill">☝ Trace the strings, top to bottom</span></div>' +
      '<div class="panel" style="flex:1">' +
      '<div class="line-scene" id="scene">' + svg + '</div>' +
      '<div class="controls">' +
      '<button class="btn" id="showMe">▶ Show me</button>' +
      '<button class="btn soft" id="say">🔊 Listen</button>' +
      '<button class="btn soft" id="clear">🧽 Clear</button>' +
      '</div></div></div>';

    var scene = document.getElementById('scene');
    var svgEl = scene.querySelector('svg');
    hideStrokes(svgEl);
    var tracer = makeTracer(scene, '#5B4FE0');
    document.getElementById('showMe').onclick = function () { tracer.clear(); animateStrokes(svgEl); };
    document.getElementById('say').onclick = function () { play('line_prompt'); };
    document.getElementById('clear').onclick = function () { tracer.clear(); hideStrokes(svgEl); };
    cleanup = tracer.destroy;
  }

  function letterHead(key, tab) {
    var L = LETTERS[key];
    return '<div class="screen-head"><h1>' + L.title + '</h1>' +
      '<div class="tabs">' +
      '<button class="tab' + (tab === 'meet' ? ' on' : '') + '" data-go="' + key + '">1 · Meet ' + key + '</button>' +
      '<button class="tab' + (tab === 'words' ? ' on' : '') + '" data-go="' + key + '-words">2 · Words &amp; game</button>' +
      '</div></div>';
  }

  function renderMeet(key) {
    var L = LETTERS[key];
    var k = key.toLowerCase();
    setTheme(L.color, L.tint);
    app.innerHTML =
      '<div class="screen">' + letterHead(key, 'meet') +
      '<div class="split">' +
      '<div class="panel">' +
      '<div class="trace-wrap" id="trace">' + letterSvg(L.strokes, L.dots) + '</div>' +
      '<div class="controls">' +
      '<button class="btn" id="showMe">▶ Show me</button>' +
      '<button class="btn soft" id="clear">🧽 Clear</button>' +
      videoButton(L.youtube) +
      '</div></div>' +
      '<div class="panel sound-panel">' +
      '<button class="big-letter-btn" id="bigLetter">' + key + '</button>' +
      '<div class="sound-row">' +
      '<button class="btn" id="name">🔊 Name</button>' +
      '<button class="btn" id="sound">🔊 Sound</button>' +
      '<button class="btn" id="cue">🔊 Hindi cue</button>' +
      '</div>' +
      '<div class="cue">' + L.cue + '</div>' +
      '</div></div></div>';

    var wrap = document.getElementById('trace');
    var svgEl = wrap.querySelector('svg');
    hideStrokes(svgEl);
    var tracer = makeTracer(wrap, L.color);
    document.getElementById('showMe').onclick = function () { tracer.clear(); animateStrokes(svgEl); };
    document.getElementById('clear').onclick = function () { tracer.clear(); hideStrokes(svgEl); };
    document.getElementById('bigLetter').onclick = function () { play([k + '_name', k + '_sound']); };
    document.getElementById('name').onclick = function () { play(k + '_name'); };
    document.getElementById('sound').onclick = function () { play(k + '_sound'); };
    document.getElementById('cue').onclick = function () { play(k + '_cue'); };
    cleanup = tracer.destroy;
  }

  function renderWords(key) {
    var L = LETTERS[key];
    var k = key.toLowerCase();
    setTheme(L.color, L.tint);

    var cards = L.words.map(function (w) {
      return '<button class="word-card" data-audio="' + w.audio + '"><div class="pic">' + w.pic + '</div>' +
        '<div class="name"><b>' + w.name.charAt(0) + '</b>' + w.name.slice(1) + '</div></button>';
    }).join('');

    app.innerHTML =
      '<div class="screen">' + letterHead(key, 'words') +
      '<div class="panel" style="flex:1">' +
      '<div class="word-row">' + cards + '</div>' +
      '<div class="game"><h2>Which one starts with ' + key + '?</h2><div class="game-row" id="game"></div>' +
      '<div class="controls"><button class="btn soft" id="again">🔁 New round</button><button class="btn soft" id="ask">🔊 Ask</button></div></div>' +
      '</div></div>';

    [].forEach.call(app.querySelectorAll('.word-card'), function (b) {
      b.onclick = function () { play(b.getAttribute('data-audio')); };
    });

    var round = 0;
    function newRound() {
      var target = L.words[round % L.words.length];
      round++;
      var opts = shuffle([{ pic: target.pic, ok: true }].concat(L.distractors.map(function (d) { return { pic: d.pic, ok: false }; })));
      var row = document.getElementById('game');
      row.innerHTML = '';
      opts.forEach(function (o) {
        var b = el('<button class="choice">' + o.pic + '</button>');
        b.onclick = function () {
          if (o.ok) { b.classList.add('right'); play('well_done'); cheer(); }
          else { b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); play('try_again'); }
        };
        row.appendChild(b);
      });
    }
    document.getElementById('again').onclick = newRound;
    document.getElementById('ask').onclick = function () { play(k + '_question'); };
    newRound();
  }

  function renderChart() {
    setTheme('#2FB45A', '#E6F7EC');
    var pics = { A: '🍎', B: '⚽' };
    var s = '';
    for (var i = 0; i < 26; i++) {
      var ch = String.fromCharCode(65 + i);
      var L = LETTERS[ch];
      s += L
        ? '<button class="on" style="--c:' + L.color + '" data-letter="' + ch + '">' + ch + '<small>' + pics[ch] + '</small></button>'
        : '<button class="off">' + ch + '</button>';
    }
    app.innerHTML =
      '<div class="screen">' +
      '<div class="screen-head"><h1>Let\'s say our letters!</h1><span class="pill">👆 Point &amp; say the name and sound</span>' +
      '<button class="btn soft" id="say" style="margin-left:auto">🔊 Listen</button></div>' +
      '<div class="chart">' + s + '</div></div>';
    [].forEach.call(app.querySelectorAll('[data-letter]'), function (b) {
      var k = b.getAttribute('data-letter').toLowerCase();
      b.onclick = function () { play([k + '_name', k + '_sound']); };
    });
    document.getElementById('say').onclick = function () { play('chart_prompt'); };
  }

  // ---------- Teacher notes ----------
  function noteKey() {
    var h = location.hash.slice(1) || 'home';
    if (LETTERS[h]) return { k: 'meet', book: LETTERS[h].book };
    if (/-words$/.test(h)) return { k: 'words', book: LETTERS[h.charAt(0)].book };
    return { k: NOTES[h] ? h : 'home' };
  }
  function fillNotes() {
    var n = noteKey();
    var note = NOTES[n.k];
    document.getElementById('drawerBody').innerHTML =
      '<div class="book-ref">📖 ' + (n.book || note.book) + '</div>' +
      '<ol>' + note.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
  }

  // ---------- Router ----------
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    closeVideo();
    var h = location.hash.slice(1) || 'home';
    if (h === 'line') renderLine();
    else if (h === 'chart') renderChart();
    else if (LETTERS[h]) renderMeet(h);
    else if (/^[A-Z]-words$/.test(h) && LETTERS[h.charAt(0)]) renderWords(h.charAt(0));
    else renderHome();
    fillNotes();
    app.scrollTop = 0;
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-go],[data-video]') : null;
    if (!t) return;
    if (t.hasAttribute('data-video')) { openVideo(t.getAttribute('data-video')); return; }
    location.hash = t.getAttribute('data-go');
  });

  document.getElementById('btnHome').onclick = function () { location.hash = 'home'; };
  document.getElementById('btnTeacher').onclick = function () {
    document.getElementById('drawer').classList.toggle('open');
  };
  document.getElementById('drawerClose').onclick = function () {
    document.getElementById('drawer').classList.remove('open');
  };
  document.getElementById('videoClose').onclick = closeVideo;
  window.addEventListener('hashchange', route);
  route();

  // Save everything on the panel after the first visit, so it works without internet.
  if (online && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
