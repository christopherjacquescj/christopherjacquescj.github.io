/* Le Coffre à Jeux — les jouets de la page.
   Ce sont de petits aperçus pour s’amuser : le vrai jeu est dans l’app.
   Aucune requête vers un site tiers ; le son (piano) ne démarre qu’après un toucher. */
(function () {
  'use strict';
  var live = document.getElementById('live');
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function stage(n) { return document.querySelector('.stage[data-toy="' + n + '"]'); }
  function rand(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function say(t) { if (!live) return; live.textContent = ''; setTimeout(function () { live.textContent = t; }, 40); }
  function chipper(st) {
    var c = el('p', 'chip'), tm, toy = st.parentNode; c.setAttribute('aria-hidden', 'true'); st.appendChild(c);
    function off() { c.classList.remove('on'); toy.classList.remove('say'); }
    return function (t, ms) {
      clearTimeout(tm); if (!t) { off(); return; }
      c.textContent = t; c.classList.add('on'); toy.classList.add('say'); if (ms) tm = setTimeout(off, ms);
    };
  }


  /* Clavier : un seul arrêt « Tab » par jouet, puis les flèches (et Début / Fin) pour se déplacer.
     On utilise aria-disabled plutôt que disabled : la case qui vient d'être jouée garde le focus. */
  function off(b, on) { if (on) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); }
  function rove(root, sel, skip) {
    var cur = null, KEYS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    function all() { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
    function usable(e) { return !(skip && e.matches(skip)); }
    function apply() {
      var list = all(), ok = list.filter(usable);
      if (!ok.length) return;
      if (!cur || list.indexOf(cur) < 0 || (!usable(cur) && cur !== document.activeElement)) cur = ok[0];
      list.forEach(function (e) { e.tabIndex = e === cur ? 0 : -1; });
    }
    root.addEventListener('focusin', function (ev) { if (ev.target.matches && ev.target.matches(sel)) { cur = ev.target; apply(); } });
    root.addEventListener('keydown', function (ev) {
      var t = ev.target, d = KEYS[ev.key], ok, r, best = null, bs = 1e9;
      if (ev.altKey || ev.ctrlKey || ev.metaKey || !t.matches || !t.matches(sel)) return;
      ok = all().filter(usable);
      if (ev.key === 'Home' || ev.key === 'End') best = ok[ev.key === 'Home' ? 0 : ok.length - 1];
      else if (d) {
        r = t.getBoundingClientRect();
        ok.forEach(function (e) {
          if (e === t) return;
          var q = e.getBoundingClientRect(), dx = q.left + q.width / 2 - (r.left + r.width / 2), dy = q.top + q.height / 2 - (r.top + r.height / 2);
          var along = dx * d[0] + dy * d[1], across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
          if (along > 2 && along + across * 3 < bs) { bs = along + across * 3; best = e; }
        });
      } else return;
      if (best && best !== t) { ev.preventDefault(); best.focus(); }
    });
    new MutationObserver(apply).observe(root, { childList: true, subtree: true });
    apply();
    return apply;
  }

  /* ---------- Mini Piano (avec du son) ---------- */
  var AC = null;
  function audio() {
    if (!AC) {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      AC = new A(); var comp = AC.createDynamicsCompressor(); comp.connect(AC.destination); AC.out = comp;
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function note(f) {
    var a = audio(); if (!a) return;
    var t = a.currentTime, g = a.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.34, t + .01); g.gain.exponentialRampToValueAtTime(.0008, t + 1.6);
    g.connect(a.out);
    [[1, 1], [2, .32], [3, .1], [4, .04]].forEach(function (h) {
      var o = a.createOscillator(), og = a.createGain();
      o.type = 'sine'; o.frequency.value = f * h[0]; og.gain.value = h[1]; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.7);
    });
  }
  function piano() {
    var st = stage('piano'); if (!st) return;
    var WHITE = [['Do', 261.63], ['Ré', 293.66], ['Mi', 329.63], ['Fa', 349.23], ['Sol', 392], ['La', 440], ['Si', 493.88], ['Do aigu', 523.25]];
    var BLACK = [[1, 'Do dièse', 277.18], [2, 'Ré dièse', 311.13], [4, 'Fa dièse', 369.99], [5, 'Sol dièse', 415.3], [6, 'La dièse', 466.16]];
    var keys = el('div', 'keys'), held = {}, timers = [], playing = false;
    keys.setAttribute('role', 'group'); keys.setAttribute('aria-label', 'Clavier du mini piano');
    var whites = WHITE.map(function (n) {
      var b = el('button', 'k w'); b.type = 'button'; b.setAttribute('aria-label', n[0]); b.dataset.f = n[1]; keys.appendChild(b); return b;
    });
    BLACK.forEach(function (n) {
      var b = el('button', 'k b'); b.type = 'button'; b.style.setProperty('--x', n[0]); b.setAttribute('aria-label', n[1]); b.dataset.f = n[2]; keys.appendChild(b);
    });
    var song = el('button', 'mini', 'Mélodie'); song.type = 'button';
    st.appendChild(keys); st.appendChild(song); rove(keys, '.k');

    function press(k, id) { k.classList.add('on'); note(+k.dataset.f); held[id] = k; }
    function release(id) { var k = held[id]; if (k) { k.classList.remove('on'); delete held[id]; } }
    function keyAt(x, y) { var e = document.elementFromPoint(x, y); return e && e.closest ? e.closest('.k') : null; }
    keys.addEventListener('pointerdown', function (e) { var k = e.target.closest('.k'); if (!k) return; stop(); press(k, e.pointerId); });
    keys.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in held)) return;
      var k = keyAt(e.clientX, e.clientY);
      if (k && k !== held[e.pointerId] && keys.contains(k)) { release(e.pointerId); press(k, e.pointerId); }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { keys.addEventListener(t, function (e) { release(e.pointerId); }); });
    keys.addEventListener('keydown', function (e) {
      if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('k') && !e.repeat) {
        e.preventDefault(); var k = e.target; stop(); k.classList.add('on'); note(+k.dataset.f);
        setTimeout(function () { k.classList.remove('on'); }, 160);
      }
    });
    /* « Au clair de la lune » (domaine public) : [touche blanche, temps] */
    var SONG = [[0, 1], [0, 1], [0, 1], [1, 1], [2, 2], [1, 2], [0, 1], [2, 1], [1, 1], [1, 1], [0, 4]];
    function stop() {
      timers.forEach(clearTimeout); timers = [];
      if (playing) { playing = false; song.textContent = 'Mélodie'; whites.forEach(function (k) { k.classList.remove('on'); }); }
    }
    song.addEventListener('click', function () {
      if (playing) { stop(); return; }
      playing = true; song.textContent = 'Stop';
      var t = 0, beat = 400;
      SONG.concat(SONG).forEach(function (n) {
        var k = whites[n[0]];
        timers.push(setTimeout(function () { k.classList.add('on'); note(+k.dataset.f); }, t));
        timers.push(setTimeout(function () { k.classList.remove('on'); }, t + n[1] * beat - 70));
        t += n[1] * beat;
      });
      timers.push(setTimeout(stop, t + 150));
    });
  }

  /* ---------- Yam's ---------- */
  function yams() {
    var st = stage('yams'); if (!st) return;
    var vals = [3, 5, 2, 6, 1], held = [false, false, false, false, false], rolling = false, dice = [], tray = el('div', 'tray'), say_ = chipper(st);
    function label(d, i) { d.setAttribute('aria-label', 'Dé ' + (i + 1) + ' : ' + vals[i] + (held[i] ? ', gardé' : ', touche pour le garder')); }
    vals.forEach(function (v, i) {
      var d = el('button', 'die', '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>');
      d.type = 'button'; d.dataset.v = v; d.setAttribute('aria-pressed', 'false'); label(d, i);
      d.addEventListener('click', function () { held[i] = !held[i]; d.classList.toggle('hold', held[i]); d.setAttribute('aria-pressed', String(held[i])); label(d, i); });
      tray.appendChild(d); dice.push(d);
    });
    var btn = el('button', 'mini', 'Lancer'); btn.type = 'button';
    st.appendChild(tray); st.appendChild(btn);
    function combo(v) {
      var c = [0, 0, 0, 0, 0, 0, 0], i; v.forEach(function (x) { c[x]++; });
      var n = c.slice(1).sort(function (a, b) { return b - a; }), u = '';
      for (i = 1; i <= 6; i++) if (c[i]) u += i;
      if (n[0] === 5) return 'Yam’s !'; if (n[0] === 4) return 'Carré'; if (n[0] === 3 && n[1] === 2) return 'Full';
      if (u === '12345' || u === '23456') return 'Grande suite';
      if (/1234|2345|3456/.test(u)) return 'Petite suite'; if (n[0] === 3) return 'Brelan'; return '';
    }
    btn.addEventListener('click', function () {
      if (rolling) return;
      var n = 0; say_('');
      dice.forEach(function (d, i) {
        if (held[i]) return; n++;
        d.classList.add('rolling');
        setTimeout(function () { vals[i] = 1 + rand(6); d.dataset.v = vals[i]; label(d, i); }, 300 + i * 40);
        setTimeout(function () { d.classList.remove('rolling'); }, 650 + i * 50);
      });
      if (!n) return;
      rolling = true;
      setTimeout(function () {
        rolling = false; var c = combo(vals);
        say('Yam’s : ' + vals.join(', ') + (c ? ', ' + c : '') + '.');
        if (c) say_(c);
      }, 920);
    });
  }

  /* ---------- Tic Tac Toe ---------- */
  function ttt() {
    var st = stage('ttt'); if (!st) return;
    var say_ = chipper(st), board = el('div', 'board'), cells = [], g, over, busy, timer;
    var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    var X = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 8L32 32M32 8L8 32" stroke="#2f6fe4" stroke-width="6" stroke-linecap="round" fill="none" pathLength="1"/></svg>';
    var O = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12.5" stroke="#e8473b" stroke-width="6" fill="none" pathLength="1"/></svg>';
    for (var i = 0; i < 9; i++) (function (i) {
      var b = el('button', 'c'); b.type = 'button'; b.addEventListener('click', function () { human(i); }); cells.push(b); board.appendChild(b);
    })(i);
    st.appendChild(board);
    function lab(i) {
      var v = g[i]; cells[i].setAttribute('aria-label', 'Ligne ' + (Math.floor(i / 3) + 1) + ', colonne ' + (i % 3 + 1) + ' : ' + (v === 1 ? 'croix' : v === 2 ? 'rond' : 'vide'));
    }
    function reset() {
      g = [0, 0, 0, 0, 0, 0, 0, 0, 0]; over = false; busy = false;
      cells.forEach(function (b, i) { b.className = 'c'; b.innerHTML = ''; off(b, false); lab(i); }); say_('');
    }
    function line(b) {
      for (var k = 0; k < 8; k++) { var l = LINES[k]; if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return l; }
      return null;
    }
    function mark(i, p) { g[i] = p; cells[i].className = 'c ' + (p === 1 ? 'x' : 'o'); cells[i].innerHTML = p === 1 ? X : O; off(cells[i], true); lab(i); }
    function finish() {
      var l = line(g);
      if (l) {
        over = true; l.forEach(function (i) { cells[i].classList.add('win'); });
        var w = g[l[0]]; say_(w === 1 ? 'Bravo !' : 'Perdu !'); say('Tic Tac Toe : ' + (w === 1 ? 'tu as gagné.' : 'j’ai gagné.'));
      } else if (g.every(Boolean)) { over = true; say_('Égalité'); say('Tic Tac Toe : égalité.'); }
      if (over) { cells.forEach(function (b) { off(b, true); }); timer = setTimeout(reset, 2400); }
      return over;
    }
    function human(i) {
      if (over || busy || g[i]) return;
      clearTimeout(timer); mark(i, 1); if (finish()) return;
      busy = true;
      setTimeout(function () { var m = best(); if (m >= 0) mark(m, 2); busy = false; finish(); }, 420);
    }
    function score(b, p, d) {
      var l = line(b); if (l) return b[l[0]] === 2 ? 10 - d : d - 10;
      if (b.every(Boolean)) return 0;
      var s = p === 2 ? -99 : 99;
      for (var i = 0; i < 9; i++) if (!b[i]) { b[i] = p; var v = score(b, p === 2 ? 1 : 2, d + 1); b[i] = 0; s = p === 2 ? Math.max(s, v) : Math.min(s, v); }
      return s;
    }
    function best() {
      var empty = []; g.forEach(function (v, i) { if (!v) empty.push(i); });
      if (!empty.length) return -1;
      if (Math.random() < .2) return empty[rand(empty.length)];
      var bs = -99, bl = [];
      empty.forEach(function (i) { g[i] = 2; var s = score(g, 1, 1); g[i] = 0; if (s > bs) { bs = s; bl = [i]; } else if (s === bs) bl.push(i); });
      return bl[rand(bl.length)];
    }
    reset(); rove(board, '.c', '[aria-disabled="true"]');
  }

  /* ---------- 4 alignés ---------- */
  function c4() {
    var st = stage('c4'); if (!st) return;
    var R = 6, C = 7, say_ = chipper(st), board = el('div', 'board'), discs = el('div', 'discs'), front = el('div', 'front'), cols = el('div', 'cols');
    var g, els, over, busy, timer, i;
    for (i = 0; i < C; i++) (function (c) {
      var b = el('button', 'col'); b.type = 'button'; b.setAttribute('aria-label', 'Colonne ' + (c + 1)); b.addEventListener('click', function () { human(c); }); cols.appendChild(b);
    })(i);
    board.appendChild(discs); board.appendChild(front); board.appendChild(el('div', 'rings')); board.appendChild(cols); st.appendChild(board);
    function rowFor(c) { for (var r = R - 1; r >= 0; r--) if (!g[r][c]) return r; return -1; }
    function setCols(on) { Array.prototype.forEach.call(cols.children, function (b, c) { off(b, !on || g[0][c] !== 0); }); }
    function reset() {
      g = []; els = [];
      for (var r = 0; r < R; r++) { g.push(new Array(C).fill(0)); els.push(new Array(C).fill(null)); }
      discs.innerHTML = ''; over = false; busy = false; say_(''); setCols(true);
    }
    function put(c, p) {
      var r = rowFor(c); if (r < 0) return -1;
      g[r][c] = p;
      var d = el('div', 'disc p' + p); d.style.setProperty('--r', r); d.style.left = (c * 100 / C) + '%'; d.style.top = (r * 100 / R) + '%';
      discs.appendChild(d); els[r][c] = d; return r;
    }
    function four() {
      var D = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
        var p = g[r][c]; if (!p) continue;
        for (var k = 0; k < 4; k++) {
          var cells = [[r, c]];
          for (var s = 1; s < 4; s++) {
            var rr = r + D[k][0] * s, cc = c + D[k][1] * s;
            if (rr < 0 || rr >= R || cc < 0 || cc >= C || g[rr][cc] !== p) break;
            cells.push([rr, cc]);
          }
          if (cells.length === 4) return cells;
        }
      }
      return null;
    }
    function done() {
      var f = four();
      if (f) {
        over = true; f.forEach(function (q) { els[q[0]][q[1]].classList.add('win'); });
        var w = g[f[0][0]][f[0][1]]; say_(w === 1 ? 'Bravo !' : 'Perdu !'); say('4 alignés : ' + (w === 1 ? 'tu as gagné.' : 'j’ai gagné.'));
      } else if (g[0].every(Boolean)) { over = true; say_('Égalité'); say('4 alignés : égalité.'); }
      if (over) { setCols(false); timer = setTimeout(reset, 3400); }
      return over;
    }
    function wins(c, p) { var r = rowFor(c); if (r < 0) return false; g[r][c] = p; var w = !!four(); g[r][c] = 0; return w; }
    function ai() {
      var v = [], k, c;
      for (c = 0; c < C; c++) if (rowFor(c) >= 0) v.push(c);
      for (k = 0; k < v.length; k++) if (wins(v[k], 2)) return v[k];
      for (k = 0; k < v.length; k++) if (wins(v[k], 1)) return v[k];
      var safe = v.filter(function (c) {
        var r = rowFor(c); if (r < 1) return true;
        g[r][c] = 2; var bad = wins(c, 1); g[r][c] = 0; return !bad;
      });
      var pool = safe.length ? safe : v, pick = pool[0], bs = -9;
      pool.forEach(function (c) { var s = 4 - Math.abs(3 - c) + Math.random() * 2.4; if (s > bs) { bs = s; pick = c; } });
      return pick;
    }
    function human(c) {
      if (over || busy || rowFor(c) < 0) return;
      clearTimeout(timer); put(c, 1); setCols(false);
      if (done()) return;
      busy = true;
      setTimeout(function () { put(ai(), 2); busy = false; if (!done()) setCols(true); }, 760);
    }
    reset(); rove(cols, '.col', '[aria-disabled="true"]');
  }

  /* ---------- Jeu de paires ---------- */
  function paires() {
    var st = stage('paires'); if (!st) return;
    var SYM = {
      star: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2.5 14.9,8.6 21.6,9.4 16.6,14 18,20.6 12,17.3 6,20.6 7.4,14 2.4,9.4 9.1,8.6" fill="#f5a300"/></svg>',
      heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.7-8 10.6-8 10.6z" fill="#e8473b"/></svg>',
      moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.5 6.5 0 0 0 10.1 10.1z" fill="#2f6fe4"/></svg>',
      sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="#ff8a00"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="#ff8a00" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
      bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2.5 5.5 13.2h5.6L10 21.5l8.5-11.2h-5.7z" fill="#8e44ad"/></svg>',
      drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3.6 4.6 6.2 7.7 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 10.7 8.4 7.6 12 3z" fill="#1fb5c6"/></svg>'
    };
    var NAMES = { star: 'étoile', heart: 'cœur', moon: 'lune', sun: 'soleil', bolt: 'éclair', drop: 'goutte' };
    var say_ = chipper(st), deck = el('div', 'deck'), cards = [], first = null, lock = false, found = 0, timer;
    st.appendChild(deck);
    function lab(b, i) {
      var state = b.classList.contains('ok') ? 'trouvée, ' + NAMES[b.dataset.s] : b.classList.contains('up') ? NAMES[b.dataset.s] : 'face cachée';
      b.setAttribute('aria-label', 'Carte ' + (i + 1) + ' : ' + state);
    }
    function build() {
      deck.innerHTML = ''; cards = []; first = null; lock = false; found = 0; say_('');
      var keys = Object.keys(SYM);
      shuffle(keys.concat(keys)).forEach(function (s, i) {
        var b = el('button', 'card', '<span class="in"><span class="b"></span><span class="f">' + SYM[s] + '</span></span>');
        b.type = 'button'; b.dataset.s = s; lab(b, i);
        b.addEventListener('click', function () { flip(b); });
        deck.appendChild(b); cards.push(b);
      });
    }
    function flip(b) {
      if (lock || b.classList.contains('up') || b.classList.contains('ok')) return;
      b.classList.add('up'); lab(b, cards.indexOf(b));
      if (!first) { first = b; return; }
      var a = first; first = null;
      if (a.dataset.s === b.dataset.s) {
        [a, b].forEach(function (x) { x.classList.remove('up'); x.classList.add('ok'); lab(x, cards.indexOf(x)); });
        found++;
        if (found === 6) { say_('Bravo !'); say('Jeu de paires : toutes les paires sont trouvées.'); timer = setTimeout(build, 2800); }
      } else {
        lock = true;
        setTimeout(function () { [a, b].forEach(function (x) { x.classList.remove('up'); lab(x, cards.indexOf(x)); }); lock = false; }, 900);
      }
    }
    build(); rove(deck, '.card');
  }

  /* ---------- Jeu de dames : quelques coups, un par toucher ---------- */
  function dames() {
    var st = stage('dames'); if (!st) return;
    var board = el('div', 'board'), pcs = el('div', 'pcs'), pieces = {}, step = 0, i;
    for (i = 0; i < 64; i++) board.appendChild(el('i', ((Math.floor(i / 8) + i % 8) % 2) ? 'sq d' : 'sq'));
    board.appendChild(pcs);
    var btn = el('button', 'mini ic', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>'); btn.type = 'button'; btn.setAttribute('aria-label', 'Coup suivant');
    var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>', ICON_AGAIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M19.2 4.2v4.4h-4.4"/></svg>';
    function label(again) { btn.innerHTML = again ? ICON_AGAIN : ICON_PLAY; btn.setAttribute('aria-label', again ? 'Rejouer' : 'Coup suivant'); }
    st.appendChild(board); st.appendChild(btn);
    /* [ligne départ, colonne départ, ligne arrivée, colonne arrivée, (ligne prise, colonne prise)] */
    var SCRIPT = [[5, 2, 4, 3], [2, 5, 3, 4], [4, 3, 2, 5, 3, 4], [1, 4, 3, 6, 2, 5], [5, 6, 4, 5], [3, 6, 4, 7]];
    function pos(e, r, c) { e.style.left = (c * 12.5) + '%'; e.style.top = (r * 12.5) + '%'; }
    function add(r, c, p) { var e = el('span', 'pc p' + p); pos(e, r, c); pcs.appendChild(e); pieces[r + ',' + c] = e; }
    function setup() {
      pcs.innerHTML = ''; pieces = {}; step = 0; label(false);
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) if ((r + c) % 2) { if (r < 3) add(r, c, 2); else if (r > 4) add(r, c, 1); }
    }
    btn.addEventListener('click', function () {
      if (step >= SCRIPT.length) { setup(); return; }
      var m = SCRIPT[step++], from = m[0] + ',' + m[1], to = m[2] + ',' + m[3], e = pieces[from];
      if (!e) { setup(); return; }
      delete pieces[from]; pos(e, m[2], m[3]); pieces[to] = e;
      if (m.length > 4) {
        var k = m[4] + ',' + m[5], v = pieces[k];
        if (v) { v.classList.add('out'); delete pieces[k]; setTimeout(function () { v.remove(); }, 420); }
      }
      if (step >= SCRIPT.length) label(true);
    });
    setup();
  }

  /* ---------- Sudoku : touche une case, elle se remplit ---------- */
  function sudoku() {
    var st = stage('sudoku'); if (!st) return;
    var P = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
    var S = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
    var say_ = chipper(st), grid = el('div', 'grid'), cells = [], left = 0, timer, i;
    for (i = 0; i < 81; i++) (function (i) {
      var b = el('button', 'n'); b.type = 'button'; b.addEventListener('click', function () { fill(i); }); cells.push(b); grid.appendChild(b);
    })(i);
    st.appendChild(grid);
    function lab(i) {
      var b = cells[i], t = 'Ligne ' + (Math.floor(i / 9) + 1) + ', colonne ' + (i % 9 + 1) + ' : ';
      b.setAttribute('aria-label', t + (b.textContent ? b.textContent : 'vide, touche pour la remplir'));
    }
    function reset() {
      left = 0;
      for (var i = 0; i < 81; i++) {
        var b = cells[i], given = P.charAt(i) !== '.';
        b.className = 'n' + (given ? '' : ' e'); b.textContent = given ? P.charAt(i) : ''; off(b, given); if (!given) left++; lab(i);
      }
    }
    function fill(i) {
      var b = cells[i]; if (!b.classList.contains('e')) return;
      b.classList.remove('e'); b.classList.add('u'); b.textContent = S.charAt(i); off(b, true); lab(i); left--;
      if (left > 0) { say_(''); return; }
      say_('Résolu !'); say('Sudoku : résolu.'); timer = setTimeout(reset, 2600);
    }
    reset(); rove(grid, '.n', '[aria-disabled="true"]');
  }

  /* ---------- Mot mystère : les lettres se retournent ---------- */
  function mot() {
    var st = stage('mot'); if (!st) return;
    var WORDS = ['JOUER', 'PIANO', 'BILLE', 'DAMES', 'PAIRE', 'CARTE', 'POINT', 'COUPS'], cur = 0, tiles = [], box = el('div', 'word'), busy = false;
    for (var i = 0; i < 5; i++) { var t = el('button', 't', WORDS[0].charAt(i)); t.type = 'button'; t.tabIndex = -1; t.setAttribute('aria-hidden', 'true'); tiles.push(t); box.appendChild(t); }
    var btn = el('button', 'mini ic', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M19.2 4.2v4.4h-4.4"/></svg>'); btn.type = 'button'; btn.setAttribute('aria-label', 'Autre mot : ' + WORDS[0]);
    st.appendChild(box); st.appendChild(btn);
    function next() {
      if (busy) return; busy = true;
      var n = cur; while (n === cur) n = rand(WORDS.length); cur = n;
      tiles.forEach(function (t, i) {
        setTimeout(function () {
          t.classList.remove('flip'); void t.offsetWidth; t.classList.add('flip');
          setTimeout(function () { t.textContent = WORDS[cur].charAt(i); }, 190);
        }, i * 90);
      });
      setTimeout(function () { busy = false; btn.setAttribute('aria-label', 'Autre mot : ' + WORDS[cur]); say('Mot mystère : ' + WORDS[cur].split('').join(' ') + '.'); }, 5 * 90 + 450);
    }
    btn.addEventListener('click', next);
    tiles.forEach(function (t) { t.addEventListener('click', next); });
  }

  /* ---------- Air Hockey : bouge le maillet rouge ---------- */
  function hockey() {
    var st = stage('hockey'); if (!st) return;
    var cv = el('canvas'), say_ = chipper(st), ctx = cv.getContext('2d');
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Air Hockey : bouge le maillet rouge pour frapper le palet.');
    st.appendChild(cv);
    var LW = 300, LH = 400, GOAL = 124, k = 1, dpr = 1, visible = true, running = false, raf = 0, lastMove = 0, over = false, timer;
    var puck = { x: 150, y: 215, vx: 0, vy: 0, r: 11 }, me = { x: 150, y: 330, r: 23, vx: 0, vy: 0 }, ai = { x: 150, y: 70, r: 23, vx: 0, vy: 0 };
    var tx = 150, ty = 330, score = [0, 0], touchId = null;
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function size() {
      var b = cv.getBoundingClientRect(); if (!b.width) return;
      dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(b.width * dpr); cv.height = Math.round(b.height * dpr); k = cv.width / LW; draw();
    }
    function ball(o, c1, c2, c3) {
      var g = ctx.createRadialGradient(o.x - o.r * .35, o.y - o.r * .4, o.r * .1, o.x, o.y, o.r);
      g.addColorStop(0, c1); g.addColorStop(.55, c2); g.addColorStop(1, c3);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832); ctx.fill();
    }
    function mallet(o, c1, c2, c3) {
      ball(o, c1, c2, c3); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .74, 0, 6.2832); ctx.stroke();
      ball({ x: o.x, y: o.y, r: o.r * .44 }, c1, c2, c3);
    }
    function draw() {
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, LW, LH);
      var g = ctx.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, '#f3fbff'); g.addColorStop(1, '#dff3fb'); ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
      ctx.strokeStyle = 'rgba(232,71,59,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, LH / 2); ctx.lineTo(LW, LH / 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(47,111,228,.45)'; ctx.beginPath(); ctx.arc(LW / 2, LH / 2, 42, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(LW / 2, 0, 74, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(LW / 2, LH, 74, Math.PI, 6.2832); ctx.stroke();
      ctx.strokeStyle = '#7fbad6'; ctx.lineWidth = 8; var a = LW / 2 - GOAL / 2, b = LW / 2 + GOAL / 2;
      ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(0, 0); ctx.lineTo(0, LH); ctx.lineTo(a, LH); ctx.moveTo(b, 0); ctx.lineTo(LW, 0); ctx.lineTo(LW, LH); ctx.lineTo(b, LH); ctx.stroke();
      ctx.fillStyle = 'rgba(10,40,70,.35)'; ctx.beginPath(); ctx.ellipse(puck.x + 3, puck.y + 5, puck.r, puck.r * .9, 0, 0, 6.2832); ctx.fill();
      ball(puck, '#7d858d', '#2f353a', '#0b0d0f');
      ctx.fillStyle = 'rgba(0,0,0,.3)'; [me, ai].forEach(function (o) { ctx.beginPath(); ctx.ellipse(o.x + 4, o.y + 7, o.r, o.r * .9, 0, 0, 6.2832); ctx.fill(); });
      mallet(ai, '#a9c8ff', '#2f6fe4', '#17389a'); mallet(me, '#ff9a90', '#e8473b', '#9b1c13');
    }
    function hit(m) {
      var dx = puck.x - m.x, dy = puck.y - m.y, d = Math.hypot(dx, dy), min = puck.r + m.r;
      if (d < min && d > .001) {
        var nx = dx / d, ny = dy / d; puck.x = m.x + nx * min; puck.y = m.y + ny * min;
        var dot = (puck.vx - m.vx) * nx + (puck.vy - m.vy) * ny;
        if (dot < 0) { puck.vx -= 1.9 * dot * nx; puck.vy -= 1.9 * dot * ny; }
        puck.vx += m.vx * .3; puck.vy += m.vy * .3;
      }
    }
    function goal(side) {
      score[side]++; puck.x = 150; puck.y = 215; puck.vx = puck.vy = 0;
      if (score[side] >= 5) { over = true; say_(side === 0 ? 'Bravo !' : 'Perdu !'); say('Air Hockey : ' + (side === 0 ? 'tu as gagné.' : 'j’ai gagné.')); timer = setTimeout(function () { score = [0, 0]; over = false; say_(''); }, 2600); }
      else say_(score[0] + ' – ' + score[1], 1800);
    }
    function update() {
      var dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy);
      if (d > 17) { dx *= 17 / d; dy *= 17 / d; }
      me.vx = dx; me.vy = dy; me.x = clamp(me.x + dx, me.r, LW - me.r); me.y = clamp(me.y + dy, LH / 2 + me.r * .3, LH - me.r);
      var gx, gy;
      if (puck.y < LH / 2 + 15) { gx = puck.x; gy = clamp(puck.y - 20, ai.r, LH / 2 - ai.r); } else { gx = LW / 2; gy = 66; }
      var ax = gx - ai.x, ay = gy - ai.y, ad = Math.hypot(ax, ay), mx = 3.6;
      if (ad > mx) { ax *= mx / ad; ay *= mx / ad; }
      ai.vx = ax; ai.vy = ay; ai.x = clamp(ai.x + ax, ai.r, LW - ai.r); ai.y = clamp(ai.y + ay, ai.r, LH / 2 - ai.r * .3);
      puck.x += puck.vx; puck.y += puck.vy; puck.vx *= .993; puck.vy *= .993;
      var sp = Math.hypot(puck.vx, puck.vy); if (sp > 13) { puck.vx *= 13 / sp; puck.vy *= 13 / sp; }
      if (puck.x < puck.r) { puck.x = puck.r; puck.vx = Math.abs(puck.vx) * .95; }
      if (puck.x > LW - puck.r) { puck.x = LW - puck.r; puck.vx = -Math.abs(puck.vx) * .95; }
      var inGoal = Math.abs(puck.x - LW / 2) < GOAL / 2 - puck.r * .5;
      if (puck.y < puck.r && !inGoal) { puck.y = puck.r; puck.vy = Math.abs(puck.vy) * .95; }
      if (puck.y > LH - puck.r && !inGoal) { puck.y = LH - puck.r; puck.vy = -Math.abs(puck.vy) * .95; }
      if (puck.y < -puck.r * 2) goal(0); else if (puck.y > LH + puck.r * 2) goal(1);
      hit(me); hit(ai);
    }
    function active() {
      return Math.hypot(puck.vx, puck.vy) > .06 || Math.hypot(me.x - tx, me.y - ty) > 1 || Math.hypot(ai.vx, ai.vy) > .05 || performance.now() - lastMove < 900;
    }
    function tick() {
      update(); draw();
      if (visible && active()) raf = requestAnimationFrame(tick); else running = false;
    }
    function wake() { lastMove = performance.now(); if (!running && visible) { running = true; raf = requestAnimationFrame(tick); } }
    function aim(cx, cy) {
      var b = cv.getBoundingClientRect(); tx = (cx - b.left) / b.width * LW; ty = (cy - b.top) / b.height * LH; wake();
    }
    cv.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') aim(e.clientX, e.clientY); });
    cv.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') aim(e.clientX, e.clientY); });
    cv.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0], b = cv.getBoundingClientRect();
      var x = (t.clientX - b.left) / b.width * LW, y = (t.clientY - b.top) / b.height * LH;
      if (Math.hypot(x - me.x, y - me.y) > me.r * 2.4 || touchId !== null) return;
      e.preventDefault(); touchId = t.identifier; aim(t.clientX, t.clientY);
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === touchId) { e.preventDefault(); aim(e.changedTouches[i].clientX, e.changedTouches[i].clientY); }
    }, { passive: false });
    function tend(e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === touchId) touchId = null; }
    cv.addEventListener('touchend', tend); cv.addEventListener('touchcancel', tend);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { size(); if (active()) wake(); } }, { threshold: 0 }).observe(st);
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(cv); else window.addEventListener('resize', size);
    size();
  }

  /* ---------- Tri de billes : trie les couleurs ---------- */
  /* Les 12 billes et les 5 tubes sont créés une seule fois, puis seulement déplacés :
     on ne détruit ni ne redessine rien à chaque coup, donc aucune image ne peut rester affichée à tort. */
  function billes() {
    var st = stage('billes'); if (!st) return;
    var CAP = 4, NAMES = ['rouge', 'jaune', 'bleue'], say_ = chipper(st), box = el('div', 'tubes'), tubes = [], btns = [], balls = [], sel = -1, done = false, timer, i, c, k;
    st.appendChild(box);
    for (c = 0; c < 3; c++) for (k = 0; k < CAP; k++) balls.push({ c: c, el: el('span', 'ball c' + c) });
    for (i = 0; i < 5; i++) (function (i) {
      var b = el('button', 'tube'); b.type = 'button';
      b.addEventListener('click', function () { pick(i); });
      btns.push(b); box.appendChild(b);
    })(i);
    function top(t) { return t[t.length - 1]; }
    function chosen(i) { return 'Tube ' + (i + 1) + ' : bille ' + NAMES[top(tubes[i]).c] + ' choisie.'; }
    function many(n, c) { return n + (n > 1 ? ' billes ' : ' bille ') + NAMES[c] + (n > 1 ? 's' : ''); }
    function solved() { return tubes.every(function (t) { return !t.length || (t.length === CAP && t.every(function (b) { return b.c === t[0].c; })); }); }
    function newGame() {
      clearTimeout(timer);
      do {
        shuffle(balls); tubes = [[], [], [], [], []];
        balls.forEach(function (b, i) { tubes[Math.floor(i / CAP)].push(b); });
      } while (solved());
      sel = -1; done = false; say_(''); render();
    }
    function render() {
      tubes.forEach(function (t, i) {
        var b = btns[i], ok = b.children.length === t.length;
        t.forEach(function (ball, j) { if (b.children[j] !== ball.el) ok = false; });
        if (!ok) t.forEach(function (ball) { b.appendChild(ball.el); });      // on déplace les billes, on ne les refabrique jamais
        t.forEach(function (ball, j) { ball.el.classList.toggle('up', sel === i && j === t.length - 1); });
        b.classList.toggle('sel', sel === i);
        b.setAttribute('aria-label', 'Tube ' + (i + 1) + ' : ' + (t.length ? t.map(function (x) { return NAMES[x.c]; }).join(', ') + ' (du bas vers le haut)' : 'vide') + (sel === i ? ', choisi' : ''));
      });
    }
    function pick(i) {
      var s, t, c, n;
      if (done) return;
      if (sel < 0) { if (tubes[i].length) { sel = i; say(chosen(i)); } }
      else if (sel === i) { sel = -1; say('Choix annulé.'); }
      else {
        s = tubes[sel]; t = tubes[i]; c = top(s).c;
        if (t.length < CAP && (!t.length || top(t).c === c)) {
          n = 0; while (s.length && top(s).c === c && t.length < CAP) { t.push(s.pop()); n++; }
          sel = -1;
          if (solved()) { done = true; say_('Bravo !'); say('Tri de billes : réussi.'); timer = setTimeout(newGame, 2800); }
          else { say_(''); say(many(n, c) + ' dans le tube ' + (i + 1) + '.'); }
        } else if (t.length) { sel = i; say(chosen(i)); }
      }
      render();
    }
    newGame(); rove(box, '.tube');
  }

  /* ---------- Démineur ---------- */
  function mines() {
    var st = stage('mines'); if (!st) return;
    var N = 6, M = 5, say_ = chipper(st), board = el('div', 'board'), cells = [], g, open, flag, first, over, flagMode = false, timer, i;
    var MINE = '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#161616" stroke-width="2.4" stroke-linecap="round"><path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3 5.3 18.7"/></g><circle cx="12" cy="12" r="6.4" fill="#222"/><circle cx="9.8" cy="9.6" r="1.8" fill="#fff" opacity=".85"/></svg>';
    var FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v18" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><path d="M8.5 4 19 8.4 8.5 13z" fill="#e8473b"/><path d="M4.5 21h8" stroke="#222" stroke-width="2.4" stroke-linecap="round"/></svg>';
    for (i = 0; i < N * N; i++) (function (i) {
      var b = el('button', 'm'); b.type = 'button';
      b.addEventListener('click', function () { flagMode ? toggle(i) : reveal(i); });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); toggle(i); });
      cells.push(b); board.appendChild(b);
    })(i);
    var fb = el('button', 'mini ic', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M7.8 4 19 8.5 7.8 13.5z" fill="currentColor"/></svg>'); fb.type = 'button'; fb.setAttribute('aria-pressed', 'false'); fb.setAttribute('aria-label', 'Mode drapeau');
    fb.addEventListener('click', function () { flagMode = !flagMode; fb.setAttribute('aria-pressed', String(flagMode)); });
    st.appendChild(board); st.appendChild(fb);
    function nb(i) {
      var r = Math.floor(i / N), c = i % N, out = [];
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
      }
      return out;
    }
    function count(i) { return nb(i).filter(function (j) { return g[j]; }).length; }
    function lab(i) {
      var b = cells[i], r = Math.floor(i / N) + 1, c = i % N + 1, t;
      if (open[i]) t = g[i] ? 'mine' : count(i) ? count(i) + ' mine(s) autour' : 'vide'; else t = flag[i] ? 'drapeau' : 'cachée';
      b.setAttribute('aria-label', 'Ligne ' + r + ', colonne ' + c + ' : ' + t);
    }
    function paint() {
      for (var i = 0; i < N * N; i++) {
        var b = cells[i], n = count(i);
        b.className = 'm' + (open[i] ? ' open' + (!g[i] && n ? ' n' + n : '') : '');
        b.innerHTML = open[i] ? (g[i] ? MINE : (n ? String(n) : '')) : (flag[i] ? FLAG : ''); lab(i);
      }
    }
    function reset() {
      g = []; open = []; flag = [];
      for (var i = 0; i < N * N; i++) { g.push(0); open.push(false); flag.push(false); }
      first = true; over = false; paint(); say_('');
    }
    function place(safe) {
      var ban = [safe].concat(nb(safe)), cand = [];
      for (var i = 0; i < N * N; i++) if (ban.indexOf(i) < 0) cand.push(i);
      shuffle(cand).slice(0, M).forEach(function (j) { g[j] = 1; });
    }
    function flood(i) {
      var stack = [i];
      while (stack.length) {
        var k = stack.pop(); if (open[k] || flag[k]) continue;
        open[k] = true; if (count(k) === 0) nb(k).forEach(function (j) { if (!open[j]) stack.push(j); });
      }
    }
    function toggle(i) { if (over || open[i]) return; flag[i] = !flag[i]; paint(); }
    function reveal(i) {
      if (over || open[i] || flag[i]) return;
      if (first) { place(i); first = false; }
      if (g[i]) {
        over = true; for (var j = 0; j < N * N; j++) if (g[j]) open[j] = true;
        paint(); cells[i].classList.add('boom'); say_('Boum !'); say('Démineur : perdu.'); timer = setTimeout(reset, 2600); return;
      }
      flood(i); paint();
      for (var k = 0; k < N * N; k++) if (!g[k] && !open[k]) return;
      over = true; say_('Bravo !'); say('Démineur : gagné.'); timer = setTimeout(reset, 2800);
    }
    reset(); rove(board, '.m');
  }

  /* ---------- Solitaire (cartes) : on touche une carte, elle va là où elle peut ---------- */
  function solitaire() {
    var st = stage('sol'); if (!st) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var CW = 12.83, CH = 17.7, P = 1.8, G = 1.1, FU = 4.5, FD = 1.7, Y0 = P + CH + 2.3;   // tout en « cqw » : la table est carrée
    var SUITS = ['pique', 'cœur', 'carreau', 'trèfle'];
    var RL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];
    var RN = ['', 'As', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi'];
    var PATH = [
      '<path d="M12 2C9.5 6.2 3 9.7 3 14.3a4.6 4.6 0 0 0 7.5 3.6c-.2 1.6-.9 3-2.3 4.1h7.6c-1.4-1.1-2.1-2.5-2.3-4.1A4.6 4.6 0 0 0 21 14.3C21 9.7 14.5 6.2 12 2z"/>',
      '<path d="M12 21.4l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.6L12 21.4z"/>',
      '<path d="M12 2l7.5 10L12 22 4.5 12z"/>',
      '<circle cx="12" cy="7.3" r="4.4"/><circle cx="6.6" cy="14.8" r="4.4"/><circle cx="17.4" cy="14.8" r="4.4"/><path d="M10.8 14h2.4l1.8 8H9z"/>'
    ];
    function suit(s) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + PATH[s] + '</svg>'; }
    function isRed(c) { return c.s === 1 || c.s === 2; }
    function name(c) { return RN[c.r] + ' de ' + SUITS[c.s]; }
    function colX(k) { return P + k * (CW + G); }

    var say_ = chipper(st), cards = [], tab, stock, waste, found, over = false, lift = [], timer, s, r;
    for (s = 0; s < 4; s++) for (r = 1; r <= 13; r++) cards.push({ s: s, r: r, up: false, el: null });

    // fond : les places vides
    var k;
    function slot(x, y) { var d = el('div', 'slot'); d.style.left = x + 'cqw'; d.style.top = y + 'cqw'; d.setAttribute('aria-hidden', 'true'); st.appendChild(d); }
    slot(colX(0), P); for (k = 0; k < 4; k++) slot(colX(3 + k), P); for (k = 0; k < 7; k++) slot(colX(k), Y0);

    var stockBtn = el('button', 'stockbtn', '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>');
    stockBtn.type = 'button'; stockBtn.style.left = colX(0) + 'cqw'; stockBtn.style.top = P + 'cqw'; st.appendChild(stockBtn);
    cards.forEach(function (c) {
      var b = el('button', 'cd dn', '<span class="ix"><b>' + RL[c.r] + '</b>' + suit(c.s) + '</span><span class="pip">' + suit(c.s) + '</span>');
      b.type = 'button'; b._c = c; c.el = b; st.appendChild(b);
    });
    var again = el('button', 'mini ic', '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.4c1.9 0 3.1.9 4 2.4l3.2 5.2c.9 1.5 2.1 2.4 4 2.4H21"/><path d="M18.2 14.2 21 17l-2.8 2.8"/><path d="M3 17h3.4c1.9 0 3.1-.9 4-2.4M13.6 9.4c.9-1.5 2.1-2.4 4-2.4H21"/><path d="M18.2 4.2 21 7l-2.8 2.8"/></svg>');   // « mélanger » : on ne le confond pas avec la flèche de la pioche vide
    again.type = 'button'; again.setAttribute('aria-label', 'Nouvelle donne'); again.style.setProperty('--x', colX(2)); st.appendChild(again);

    function put(c, act, x, y, z, where, show) {
      var e = c.el, li = lift.indexOf(c);
      e.className = 'cd ' + (c.up ? 'up' + (isRed(c) ? ' red' : '') : 'dn');
      e.style.left = x.toFixed(2) + 'cqw'; e.style.top = y.toFixed(2) + 'cqw'; e.style.zIndex = li >= 0 ? 60 + li : z;
      if (act) { e.removeAttribute('aria-disabled'); e.setAttribute('aria-label', name(c) + (where ? ', ' + where : '')); }
      else { e.setAttribute('aria-disabled', 'true'); e.setAttribute('aria-label', name(c) + (where ? ', ' + where : '')); }
      if (act || show) e.removeAttribute('aria-hidden'); else e.setAttribute('aria-hidden', 'true');
    }
    function render() {
      var kk, i, p, y, sd, su, f, avail, c;
      stock.forEach(function (c, i) { put(c, 0, colX(0), P, 1 + i); });
      waste.forEach(function (c, i) { var top = i === waste.length - 1; put(c, top, colX(1), P, 30 + i, 'défausse', top); });
      found.forEach(function (p, kk) { p.forEach(function (c, i) { put(c, 0, colX(3 + kk), P, 100 + i, 'fondation', i === p.length - 1); }); });
      for (kk = 0; kk < 7; kk++) {
        p = tab[kk]; sd = 0; su = 0;
        for (i = 0; i < p.length - 1; i++) { if (p[i].up) su++; else sd++; }
        avail = 100 - P - Y0 - CH - sd * FD;                       // place restante pour étaler les cartes visibles
        f = su > 0 && su * FU > avail ? Math.max(.3, avail / (su * FU)) : 1;
        y = Y0;
        for (i = 0; i < p.length; i++) { c = p[i]; put(c, c.up, colX(kk), y, 10 + i, 'colonne ' + (kk + 1), c.up); y += c.up ? FU * f : FD; }
      }
      stockBtn.classList.toggle('empty', !stock.length);
      stockBtn.setAttribute('aria-label', stock.length ? 'Pioche, ' + stock.length + (stock.length > 1 ? ' cartes' : ' carte') : 'Pioche vide : remélanger');
      refresh();
    }

    function deal() {
      var all = shuffle(cards.slice()), kk;
      clearTimeout(timer); over = false; lift = [];
      cards.forEach(function (c) { c.up = false; });
      tab = []; for (kk = 0; kk < 7; kk++) { tab.push(all.splice(0, kk + 1)); tab[kk][kk].up = true; }
      stock = all; waste = []; found = [[], [], [], []];
      say_(''); render();
    }
    function where(c) {
      var kk, i;
      for (kk = 0; kk < 7; kk++) { i = tab[kk].indexOf(c); if (i >= 0) return { z: 't', k: kk, i: i }; }
      return { z: waste.indexOf(c) >= 0 ? 'w' : 'o' };
    }
    function foundOf(c) {
      var i, p, t;
      for (i = 0; i < 4; i++) { p = found[i]; t = p[p.length - 1]; if (t ? (t.s === c.s && t.r === c.r - 1) : c.r === 1) return i; }
      return -1;
    }
    function fits(c, kk) { var p = tab[kk], t = p[p.length - 1]; return t ? (t.up && isRed(t) !== isRed(c) && t.r === c.r + 1) : c.r === 13; }
    function take(w, run) {
      if (w.z === 'w') { waste.pop(); return; }
      var p = tab[w.k]; p.splice(w.i, run.length);
      if (p.length && !p[p.length - 1].up) p[p.length - 1].up = true;
    }
    function moved(run, c, dest) {
      lift = run; render();
      setTimeout(function () { lift = []; render(); }, 340);
      say(name(c) + ' sur ' + dest + '.');
      if (found.every(function (p) { return p.length === 13; })) { over = true; say_('Bravo !'); say('Solitaire : gagné !'); timer = setTimeout(deal, 3800); }
    }
    function nope(c) {
      if (!reduce && c.el.animate) c.el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7%)' }, { transform: 'translateX(7%)' }, { transform: 'translateX(0)' }], { duration: 260 });
      say_('Pas possible', 1100); say('Pas de coup possible pour ' + name(c) + '.');
    }
    function tap(c) {
      if (over) return;
      var w = where(c), run, f, kk;
      if (w.z === 'w') { if (waste[waste.length - 1] !== c) return; run = [c]; }
      else if (w.z === 't') { if (!c.up) return; run = tab[w.k].slice(w.i); }
      else return;
      if (run.length === 1 && (f = foundOf(c)) >= 0) { take(w, run); found[f].push(c); moved(run, c, 'la fondation'); return; }
      for (kk = 0; kk < 7; kk++) {
        if (w.z === 't' && kk === w.k) continue;
        if (!fits(c, kk)) continue;
        if (w.z === 't' && w.i === 0 && c.r === 13) continue;      // un roi déjà tout en haut ne bouge pas
        take(w, run); tab[kk] = tab[kk].concat(run); moved(run, c, 'la colonne ' + (kk + 1)); return;
      }
      nope(c);
    }
    function draw() {
      var c;
      if (over) return;
      if (stock.length) { c = stock.pop(); c.up = true; waste.push(c); lift = [c]; render(); setTimeout(function () { lift = []; render(); }, 340); say('Pioche : ' + name(c) + '.'); }
      else if (waste.length) { stock = waste.reverse(); waste = []; stock.forEach(function (c) { c.up = false; }); render(); say('Pioche remélangée.'); }
      else say_('Plus de cartes', 1100);
    }
    st.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button') : null;
      if (!b || !st.contains(b)) return;
      if (b === again) { deal(); say('Nouvelle donne.'); return; }
      if (b === stockBtn) { draw(); return; }
      if (b._c && b.getAttribute('aria-disabled') !== 'true') tap(b._c);
    });

    var refresh = rove(st, '.cd, .stockbtn', '[aria-disabled="true"]');
    st.classList.add('still'); deal(); requestAnimationFrame(function () { requestAnimationFrame(function () { st.classList.remove('still'); }); });
  }

  /* ---------- Outils communs aux jouets dessinés (canvas) ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  /* Ajuste le canvas à sa boîte. f.k = pixels par unité, f.LH = hauteur en unités (la largeur vaut toujours LW). */
  function fit(cv, LW, after) {
    var f = { k: 1, LH: LW };
    function size() {
      var b = cv.getBoundingClientRect(); if (!b.width) return;
      var d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(b.width * d); cv.height = Math.round(b.height * d);
      f.k = cv.width / LW; f.LH = LW * b.height / b.width; if (after) after();
    }
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(cv); else window.addEventListener('resize', size);
    f.size = size; return f;
  }
  function seen(st, cb) {
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { cb(en[0].isIntersecting); }, { threshold: 0 }).observe(st);
  }
  function shade(ctx, x, y, r, c1, c2, c3) {
    var g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
    g.addColorStop(0, c1); g.addColorStop(.55, c2); g.addColorStop(1, c3);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  /* ---------- Tour de blocs ---------- */
  function tour() {
    var st = stage('tour'); if (!st) return;
    var btn = el('button', 'tap'), cv = el('canvas'), say_ = chipper(st), ctx = cv.getContext('2d');
    btn.type = 'button'; btn.setAttribute('aria-label', 'Tour de blocs : poser le bloc'); cv.setAttribute('aria-hidden', 'true');
    btn.appendChild(cv); st.appendChild(btn);
    var LW = 200, BH = 17, BASE = 112, f = fit(cv, LW, draw);
    var stack = [], cur = null, dir = 1, speed = 90, falls = [], state = 'wait', streak = 0, cam = 0, visible = true, running = false, last = 0, timer;
    function ground() { return f.LH - 64; }
    function spawn() {
      var top = stack[stack.length - 1];
      dir = stack.length % 2 ? 1 : -1; speed = Math.min(86 + stack.length * 6.5, 270);
      cur = { x: dir > 0 ? -top.w * .7 : LW - top.w * .3, w: top.w };
    }
    function reset() { stack = [{ x: (LW - BASE) / 2, w: BASE }]; falls = []; streak = 0; cam = 0; spawn(); state = 'wait'; say_('Touche pour jouer'); draw(); }
    function count() { return stack.length - 1; }
    function lose() {
      var n = count(); state = 'over';
      say_('Perdu ! ' + n + (n > 1 ? ' blocs' : ' bloc')); say('Tour de blocs : partie finie avec ' + n + (n > 1 ? ' blocs.' : ' bloc.'));
      clearTimeout(timer); timer = setTimeout(reset, 2600);
    }
    function drop() {
      var top = stack[stack.length - 1], d = cur.x - top.x, ad = Math.abs(d), y = stack.length;
      if (ad >= top.w) { falls.push({ x: cur.x, w: cur.w, lv: y, dy: 0, vy: 0, vx: dir * 30 }); cur = null; lose(); return; }
      if (ad < 4.5) {
        cur.x = top.x; streak++;
        if (streak >= 4 && cur.w < BASE) { var g = Math.min(8, BASE - cur.w); cur.w += g; cur.x = clamp(cur.x - g / 2, 0, LW - cur.w); }
        say_('Parfait !', 900);
      } else {
        streak = 0;
        falls.push({ x: d > 0 ? top.x + top.w : cur.x, w: ad, lv: y, dy: 0, vy: 0, vx: d > 0 ? 40 : -40 });
        cur.x = Math.max(cur.x, top.x); cur.w = top.w - ad;
      }
      stack.push({ x: cur.x, w: cur.w }); spawn();
    }
    function block(x, y, w, i) {
      var h = (205 + i * 13) % 360;
      ctx.fillStyle = 'hsl(' + h + ',72%,62%)'; ctx.fillRect(x, y, w, BH);
      ctx.fillStyle = 'hsl(' + h + ',85%,78%)'; ctx.fillRect(x, y, w, 3.5);
      ctx.fillStyle = 'hsl(' + h + ',60%,44%)'; ctx.fillRect(x, y + BH - 3.5, w, 3.5);
    }
    function draw() {
      if (!stack.length) return;
      var G = ground(), i, s;
      ctx.setTransform(f.k, 0, 0, f.k, 0, 0); ctx.clearRect(0, 0, LW, f.LH);
      ctx.fillStyle = 'rgba(255,244,214,.9)'; ctx.textAlign = 'center'; ctx.font = '400 44px "Paytone One", "Arial Rounded MT Bold", system-ui, sans-serif';
      ctx.fillText(String(count()), LW / 2, 62);
      ctx.fillStyle = 'rgba(10,8,30,.55)'; ctx.fillRect(0, G + cam, LW, f.LH);
      for (i = 0; i < stack.length; i++) { s = stack[i]; block(s.x, G - (i + 1) * BH + cam, s.w, i); }
      if (cur) block(cur.x, G - (stack.length + 1) * BH + cam, cur.w, stack.length);
      for (i = 0; i < falls.length; i++) { s = falls[i]; ctx.globalAlpha = .85; block(s.x, G - (s.lv + 1) * BH + cam + s.dy, s.w, s.lv); ctx.globalAlpha = 1; }
    }
    function tick(t) {
      var dt = Math.min(.04, (t - last) / 1000 || 0), i, s, room, goal; last = t;
      if (state === 'play' && cur) {
        cur.x += dir * speed * dt;
        if (cur.x > LW - cur.w + 26) { cur.x = LW - cur.w + 26; dir = -1; }
        if (cur.x < -26) { cur.x = -26; dir = 1; }
      }
      for (i = falls.length - 1; i >= 0; i--) { s = falls[i]; s.vy += 900 * dt; s.dy += s.vy * dt; s.x += s.vx * dt; if (s.dy > f.LH) falls.splice(i, 1); }
      room = Math.floor((ground() - f.LH * .36) / BH); goal = Math.max(0, (stack.length + 1 - room) * BH); cam += (goal - cam) * Math.min(1, dt * 8);
      draw();
      if (visible && (state === 'play' || falls.length)) requestAnimationFrame(tick); else running = false;
    }
    function wake() { if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
    btn.addEventListener('click', function () {
      if (state === 'wait') { state = 'play'; say_(''); wake(); }
      else if (state === 'play') { drop(); wake(); }
    });
    seen(st, function (v) { visible = v; if (v) { f.size(); wake(); } });
    f.size(); reset();
  }

  /* ---------- Flipper (table « Nébuleuse », comme dans l'app) ---------- */
  function flipper() {
    var st = stage('flipper'); if (!st) return;
    var cv = el('canvas'), L = el('button', 'flip l'), R = el('button', 'flip r'), say_ = chipper(st), ctx = cv.getContext('2d');
    cv.setAttribute('aria-hidden', 'true'); L.type = R.type = 'button';
    L.setAttribute('aria-label', 'Flipper : batte gauche (maintenir puis relâcher pour lancer la bille)'); R.setAttribute('aria-label', 'Flipper : batte droite (maintenir puis relâcher pour lancer la bille)');
    st.appendChild(cv); st.appendChild(L); st.appendChild(R);
    var LW = 200, S = .93, OX = 7, OY = 8, FL = 38, FR = 4.5, UP = -.52, DOWN = .5, H = 1 / 240, PI = Math.PI, HINT = 'Maintiens puis relâche';
    var DISP = '"Paytone One", "Arial Rounded MT Bold", system-ui, sans-serif';
    var B = 430, YF = 338, REST = 394, bg = null, top = null, NX = 0, NY = 0;
    var b = null, flips = [{ a: DOWN, t: DOWN, w: 0, s: 1, px: 44 }, { a: DOWN, t: DOWN, w: 0, s: -1, px: 136 }];
    var bumps = [{ x: 68, y: 108, c: 0 }, { x: 112, y: 108, c: 1 }, { x: 90, y: 138, c: 2 }, { x: 68, y: 167, c: 1 }, { x: 112, y: 167, c: 0 }], rally = 0;
    var BC = [['#ffc4ee', '#ff4fc3', '#a01478'], ['#c9f6ff', '#35d6f5', '#0b7f9c'], ['#fff3b8', '#ffd23f', '#b98300']];
    var POSTS = [[25, 60, '#6cf07a'], [18, 82, '#ff9a3d'], [33, 99, '#a98bff']];   /* petites cibles « Tempête » */
    var slings = [], hole = { x: 90, y: 200, cd: 0 }, state = 'ready', score = 0, left = 3, down = 0, charge = 0, charging = false;
    var visible = true, running = false, last = 0, acc = 0, still = 0, timer;
    var f = fit(cv, LW, function () { paint(); draw(); });
    bumps.forEach(function (m) { m.r = 10; m.f = 0; });

    function geo() {
      B = (f.LH - OY - 5) / S; YF = B - 92; REST = B - 37;
      slings = [{ p: [[22, B - 176], [22, B - 136], [48, B - 122]], f: 0 }, { p: [[158, B - 176], [158, B - 136], [132, B - 122]], f: 0 }];
      if (b && b.rest) b.y = REST;
    }
    function tip(fl) { return { x: fl.px + fl.s * FL * Math.cos(fl.a), y: YF + FL * Math.sin(fl.a) }; }
    function newBall() { b = { x: 191.5, y: REST, vx: 0, vy: 0, r: 6.5, rest: true, play: false, held: 0 }; state = 'ready'; still = 0; say_(HINT); }
    function seg(ax, ay, bx, by, rad, wx, wy, w, e) {
      var dx = bx - ax, dy = by - ay, t = clamp(((b.x - ax) * dx + (b.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      var px = ax + dx * t, qy = ay + dy * t, nx = b.x - px, ny = b.y - qy, d = Math.hypot(nx, ny), min = b.r + rad;
      if (d >= min || d < 1e-6) return 0;
      nx /= d; ny /= d; b.x = px + nx * min; b.y = qy + ny * min; NX = nx; NY = ny;
      var sx = -w * (qy - wy), sy = w * (px - wx), rx = b.vx - sx, ry = b.vy - sy, vn = rx * nx + ry * ny;
      if (vn < 0) { rx -= (1 + e) * vn * nx; ry -= (1 + e) * vn * ny; b.vx = rx + sx; b.vy = ry + sy; return vn; }
      return -1e-9;
    }
    function step() {
      var i, fl, p, prev, dx, dy, d, vn, sp, m, s;
      for (i = 0; i < 2; i++) { fl = flips[i]; prev = fl.a; fl.a += clamp(fl.t - fl.a, -24 * H, 24 * H); fl.w = (fl.a - prev) / H; }
      for (i = 0; i < 5; i++) if (bumps[i].f > 0) bumps[i].f -= H;
      for (i = 0; i < 2; i++) if (slings[i].f > 0) slings[i].f -= H;
      if (hole.cd > 0) hole.cd -= H;
      if (charging) charge = Math.min(1, charge + H / .8);
      if (!b || b.rest) return;
      if (b.held > 0) {                                   /* la bille est dans le « coffre » */
        b.held -= H;
        if (b.held <= 0) { b.held = 0; hole.cd = 1.2; b.y = hole.y + 7; b.vx = (Math.random() - .5) * 240; b.vy = 250; }
        return;
      }
      b.vy += 880 * H; b.x += b.vx * H; b.y += b.vy * H;
      if (b.y < 100) {                                    /* voûte arrondie en haut */
        dx = b.x - 100; dy = b.y - 100; d = Math.hypot(dx, dy);
        if (d > 97.5 - b.r) { dx /= d; dy /= d; b.x = 100 + dx * (97.5 - b.r); b.y = 100 + dy * (97.5 - b.r); vn = b.vx * dx + b.vy * dy; if (vn > 0) { b.vx -= 1.55 * vn * dx; b.vy -= 1.55 * vn * dy; } }
      }
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * .6; }
      if (b.x > LW - b.r) { b.x = LW - b.r; b.vx = -Math.abs(b.vx) * .6; }
      seg(181, 150, 181, B + 60, 2, 0, 0, 0, .35);                         /* cloison du couloir de lancement */
      if (b.play) seg(181, 150, 200, 118, 2, 0, 0, 0, .4);                 /* clapet : la bille ne retombe pas dans le couloir */
      else if (b.x < 168) b.play = true;
      else if (b.x > 183 && b.y >= REST && b.vy > 0) { b.y = REST; b.vx = b.vy = 0; b.rest = true; state = 'ready'; say_(HINT); return; }
      for (i = 0; i < 5; i++) {
        m = bumps[i]; dx = b.x - m.x; dy = b.y - m.y; d = Math.hypot(dx, dy);
        if (d < m.r + b.r && d > 1e-6) {
          dx /= d; dy /= d; b.x = m.x + dx * (m.r + b.r); b.y = m.y + dy * (m.r + b.r);
          vn = b.vx * dx + b.vy * dy; if (vn < 0) { b.vx -= 2 * vn * dx; b.vy -= 2 * vn * dy; }
          rally++;                                        /* après une longue série, les bumpers poussent moins : la bille ressort */
          sp = rally > 9 ? 170 : Math.max(Math.hypot(b.vx, b.vy), 430); b.vx = dx * sp * .9 + b.vx * .1; b.vy = dy * sp * .9 + b.vy * .1;
          if (m.f <= 0) score += 10; m.f = .16;
        }
      }
      if (b.y > 205) rally = 0;
      for (i = 0; i < 3; i++) {
        m = POSTS[i]; dx = b.x - m[0]; dy = b.y - m[1]; d = Math.hypot(dx, dy);
        if (d < 4.6 + b.r && d > 1e-6) {
          dx /= d; dy /= d; b.x = m[0] + dx * (4.6 + b.r); b.y = m[1] + dy * (4.6 + b.r);
          vn = b.vx * dx + b.vy * dy; if (vn < 0) { b.vx -= 1.8 * vn * dx; b.vy -= 1.8 * vn * dy; if (vn < -120) score += 5; }
        }
      }
      for (i = 0; i < 4; i++) seg(67 + i * 22, 58, 67 + i * 22, 84, 1.3, 0, 0, 0, .45);      /* couloirs du haut */
      for (i = 0; i < 2; i++) {
        s = slings[i]; p = s.p;
        vn = seg(p[0][0], p[0][1], p[2][0], p[2][1], 2, 0, 0, 0, .5);
        if (vn < -90) { b.vx += NX * 330; b.vy += NY * 330; if (s.f <= 0) score += 5; s.f = .14; }
        seg(p[0][0], p[0][1], p[1][0], p[1][1], 2, 0, 0, 0, .4); seg(p[1][0], p[1][1], p[2][0], p[2][1], 2, 0, 0, 0, .4);
      }
      seg(0, B - 122, 42, B - 95, 3, 0, 0, 0, .3); seg(181, B - 122, 138, B - 95, 3, 0, 0, 0, .3);
      for (i = 0; i < 2; i++) { fl = flips[i]; p = tip(fl); seg(fl.px, YF, p.x, p.y, FR, fl.px, YF, fl.w * fl.s, .35); }
      if (b.play && hole.cd <= 0 && Math.hypot(b.x - hole.x, b.y - hole.y) < 6.5) {
        b.x = hole.x; b.y = hole.y; b.vx = b.vy = 0; b.held = .6; score += 100; say_('Coffre ! +100', 1100);
      }
      sp = Math.hypot(b.vx, b.vy); if (sp > 1100) { b.vx *= 1100 / sp; b.vy *= 1100 / sp; }
      if (b.play && sp < 14) { still += H; if (still > 1.6) { b.vx += (Math.random() - .5) * 240; b.vy -= 170; still = 0; } } else still = 0;
      if (b.y > B + 26) lost();
    }
    function lost() {
      b = null; left--;
      if (left > 0) { say_(left > 1 ? 'Encore ' + left + ' billes' : 'Dernière bille', 1000); timer = setTimeout(function () { newBall(); draw(); }, 1000); }
      else {
        state = 'over'; say_('Score : ' + score); say('Flipper : partie finie, ' + score + ' points.');
        timer = setTimeout(function () { score = 0; left = 3; newBall(); draw(); }, 2800);
      }
    }

    /* --- dessin : le décor ne change pas, il est peint une seule fois dans deux calques --- */
    function field(c) { c.beginPath(); c.moveTo(0, B + 9); c.lineTo(0, 100); c.arc(100, 100, 100, PI, 0); c.lineTo(200, B + 9); c.closePath(); }
    function star(c, x, y, r, n, inner) { var i, a, q; c.beginPath(); for (i = 0; i < n * 2; i++) { a = -PI / 2 + i * PI / n; q = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
    function layer() { var o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; return o; }
    function into(c) { c.setTransform(f.k * S, 0, 0, f.k * S, f.k * OX, f.k * OY); c.lineCap = 'round'; c.lineJoin = 'round'; }
    function arch(c, mir, col, core) {                   /* rampe en néon, purement décorative */
      function X(x) { return mir ? 180 - x : x; }
      var i, y, a;
      c.shadowColor = col; c.shadowBlur = 7 * f.k * S;
      [[13, 49, 18], [18.5, 43.5, 12.5]].forEach(function (q) {
        c.strokeStyle = col; c.lineWidth = 2.2; c.globalAlpha = .9;
        c.beginPath(); c.moveTo(X(q[0]), B - 182); c.lineTo(X(q[0]), 198); c.arc(X(31), 198, q[2], mir ? 0 : PI, mir ? PI : 0, mir); c.lineTo(X(q[1]), 228); c.stroke();
        c.strokeStyle = core; c.lineWidth = .8; c.globalAlpha = 1; c.stroke();
      });
      c.shadowBlur = 0; c.strokeStyle = core; c.globalAlpha = .55; c.lineWidth = .7;
      for (y = B - 186; y > 200; y -= 11) { c.beginPath(); c.moveTo(X(13), y); c.lineTo(X(18.5), y); c.stroke(); }
      for (i = 0; i <= 6; i++) { a = PI + i * PI / 6; c.beginPath(); c.moveTo(X(31 + Math.cos(a) * 18), 198 + Math.sin(a) * 18); c.lineTo(X(31 + Math.cos(a) * 12.5), 198 + Math.sin(a) * 12.5); c.stroke(); }
      c.globalAlpha = .3; c.fillStyle = col; c.beginPath(); c.moveTo(X(40), 226); c.lineTo(X(52), 226); c.lineTo(X(55), 242); c.lineTo(X(37), 242); c.closePath(); c.fill();
      c.globalAlpha = 1; c.strokeStyle = core; c.lineWidth = 1; c.stroke();
    }
    function paint() {
      if (!cv.width) return;
      geo(); bg = layer(); top = layer();
      var c = bg.getContext('2d'), g, i, x, y, r, seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      c.setTransform(f.k, 0, 0, f.k, 0, 0);
      g = c.createLinearGradient(0, 0, LW, 0); g.addColorStop(0, '#4f2c13'); g.addColorStop(.5, '#7c4a23'); g.addColorStop(1, '#4a2811');
      c.fillStyle = g; c.fillRect(0, 0, LW, f.LH);
      c.strokeStyle = 'rgba(30,12,2,.3)'; c.lineWidth = .7;
      for (i = 0; i < 30; i++) { x = rnd() * LW; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 5, f.LH * .3, x - 5, f.LH * .7, x + rnd() * 6 - 3, f.LH); c.stroke(); }
      into(c);
      field(c); g = c.createLinearGradient(0, 0, 0, B); g.addColorStop(0, '#3a2184'); g.addColorStop(.45, '#1f2c96'); g.addColorStop(1, '#141c68'); c.fillStyle = g; c.fill();
      c.save(); field(c); c.clip();
      [[55, 95, 95, 'rgba(160,70,220,.42)'], [150, 190, 80, 'rgba(60,110,255,.3)'], [70, B - 150, 90, 'rgba(120,60,220,.3)']].forEach(function (n) {
        g = c.createRadialGradient(n[0], n[1], 0, n[0], n[1], n[2]); g.addColorStop(0, n[3]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 200, B + 10);
      });
      c.strokeStyle = 'rgba(140,170,255,.2)'; c.lineWidth = .6;                    /* constellations */
      for (i = 0; i < 7; i++) { x = rnd() * 180; y = 40 + rnd() * (B - 60); c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd() * 50 - 25, y + rnd() * 44); c.lineTo(x + rnd() * 70 - 35, y + 30 + rnd() * 50); c.stroke(); }
      for (i = 0; i < 80; i++) { c.fillStyle = 'rgba(255,255,255,' + (.25 + rnd() * .65) + ')'; c.beginPath(); c.arc(rnd() * 200, rnd() * B, .35 + rnd() * .75, 0, 2 * PI); c.fill(); }
      for (i = 0; i < 6; i++) { x = 20 + rnd() * 150; y = 50 + rnd() * (B - 160); g = c.createRadialGradient(x, y, 0, x, y, 4); g.addColorStop(0, 'rgba(255,214,120,.95)'); g.addColorStop(1, 'rgba(255,190,80,0)'); c.fillStyle = g; c.fillRect(x - 4, y - 4, 8, 8); }
      /* planète, lumières « Tempête », couloirs du haut */
      g = c.createRadialGradient(145, 68, 1, 150, 74, 14); g.addColorStop(0, '#ffb07a'); g.addColorStop(.6, '#d9632e'); g.addColorStop(1, '#7c2b12'); c.fillStyle = g; c.beginPath(); c.arc(150, 74, 13, 0, 2 * PI); c.fill();
      c.strokeStyle = 'rgba(255,225,170,.8)'; c.lineWidth = 1.1; c.beginPath(); c.ellipse(150, 74, 20, 4.5, -.35, 0, 2 * PI); c.stroke();
      POSTS.forEach(function (o) { shade(c, o[0], o[1], 4.6, '#fff', o[2], '#222'); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = .7; c.beginPath(); c.arc(o[0], o[1], 5.6, 0, 2 * PI); c.stroke(); });
      for (i = 0; i < 3; i++) { x = 78 + i * 22; c.fillStyle = 'rgba(10,8,40,.45)'; c.fillRect(x - 6, 56, 12, 30); c.fillStyle = '#d9b84a'; c.beginPath(); c.arc(x, 78, 2.2, 0, 2 * PI); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = .7; c.beginPath(); c.moveTo(x - 1.4, 76); c.lineTo(x, 62); c.lineTo(x + 1.4, 76); c.stroke(); }
      c.strokeStyle = '#3d4152'; c.lineWidth = 2.6; for (i = 0; i < 4; i++) { x = 67 + i * 22; c.beginPath(); c.moveTo(x, 56); c.lineTo(x, 86); c.stroke(); }
      /* couloir de lancement */
      c.fillStyle = 'rgba(6,8,36,.7)'; c.fillRect(182, 118, 18, B);
      c.strokeStyle = '#6fd64f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(187, B - 78); c.lineTo(191.5, B - 84); c.lineTo(196, B - 78); c.stroke();
      c.strokeStyle = '#cfd6e6'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(181, 150); c.lineTo(181, B + 9); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.moveTo(181, 150); c.lineTo(200, 118); c.stroke();
      /* bas de table : fosse, tablier gris, cartons de règles */
      c.fillStyle = '#0e1552'; c.fillRect(42, B - 95, 96, 110);
      shade(c, 90, B - 40, 3.4, '#9be28a', '#3f8f3a', '#173d17');
      [[0, 42, 1], [181, 138, -1]].forEach(function (q) {
        g = c.createLinearGradient(0, B - 122, 0, B); g.addColorStop(0, '#e3e5ea'); g.addColorStop(1, '#a9adb8'); c.fillStyle = g;
        c.beginPath(); c.moveTo(q[0], B - 122); c.lineTo(q[1], B - 95); c.lineTo(q[1], B + 10); c.lineTo(q[0], B + 10); c.closePath(); c.fill();
        c.strokeStyle = '#f4f6fb'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(q[0], B - 122); c.lineTo(q[1], B - 95); c.stroke();
        x = q[2] > 0 ? 5 : 144; c.fillStyle = '#fbf3df'; c.fillRect(x, B - 62, 32, 38);
        c.fillStyle = '#d43a2f'; c.fillRect(x + 6, B - 57, 20, 2.6);
        c.fillStyle = 'rgba(40,30,20,.55)'; for (i = 0; i < 4; i++) c.fillRect(x + 4, B - 48 + i * 5.2, 24 - (i % 2) * 5, 1.5);
      });
      /* rosace « Nébuleuse » et bonus */
      x = 90; y = B - 150;
      c.shadowColor = '#a070ff'; c.shadowBlur = 10 * f.k * S; c.fillStyle = '#0f1550'; c.beginPath(); c.arc(x, y, 24, 0, 2 * PI); c.fill(); c.shadowBlur = 0;
      c.strokeStyle = '#8f6bff'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, 25, 0, 2 * PI); c.stroke();
      c.strokeStyle = '#e2b24a'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 22, 0, 2 * PI); c.stroke(); c.lineWidth = 1; c.beginPath(); c.arc(x, y, 13.5, 0, 2 * PI); c.stroke();
      for (i = 0; i < 12; i++) { c.fillStyle = ['#7a8f3a', '#8a3a7a', '#2f7f8f', '#8f7a2f'][i % 4]; c.beginPath(); c.arc(x + Math.cos(i * PI / 6) * 17.6, y + Math.sin(i * PI / 6) * 17.6, 2.1, 0, 2 * PI); c.fill(); }
      c.fillStyle = '#f0b545'; star(c, x, y, 12, 4, .2); c.fill(); c.fillStyle = '#c98a22'; star(c, x, y, 5.5, 4, .35); c.fill();
      c.fillStyle = '#f0c14f'; c.textAlign = 'center'; c.font = '400 7.4px ' + DISP; c.fillText('NÉBULEUSE', x, B - 112);
      for (i = 0; i < 4; i++) { c.fillStyle = '#123c4a'; c.beginPath(); c.arc(72 + i * 12, B - 184, 4.3, 0, 2 * PI); c.fill(); c.strokeStyle = 'rgba(120,230,255,.7)'; c.lineWidth = .7; c.stroke(); c.fillStyle = '#d8f6ff'; c.font = '700 4.2px system-ui, sans-serif'; c.fillText('×' + (i + 2), 72 + i * 12, B - 182.5); }
      c.restore();
      /* bord en néon */
      field(c); c.shadowColor = '#ff2e55'; c.shadowBlur = 8 * f.k * S; c.strokeStyle = '#ff5468'; c.lineWidth = 3.2; c.stroke();
      c.shadowBlur = 0; c.strokeStyle = 'rgba(150,215,255,.85)'; c.lineWidth = .9; c.beginPath(); c.arc(100, 100, 96.5, PI * 1.08, PI * 1.92); c.stroke();
      c = top.getContext('2d'); into(c); arch(c, false, '#35e0ff', '#eaffff'); arch(c, true, '#ff5fd0', '#ffe9fb');
    }
    function flipShape(fl) {
      var p = tip(fl), a = Math.atan2(p.y - YF, p.x - fl.px), r1 = 6.4, r2 = 3.7;
      ctx.beginPath(); ctx.arc(fl.px, YF, r1, a + PI / 2, a - PI / 2); ctx.arc(p.x, p.y, r2, a - PI / 2, a + PI / 2); ctx.closePath();
      ctx.fillStyle = '#f6efe2'; ctx.fill(); ctx.strokeStyle = '#e0352b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#9aa0ad'; ctx.beginPath(); ctx.arc(fl.px, YF, 2, 0, 2 * PI); ctx.fill();
    }
    function draw() {
      if (!bg) return;
      var i, m, s, p, y, n;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(bg, 0, 0); into(ctx);
      /* le coffre */
      ctx.shadowColor = '#b06bff'; ctx.shadowBlur = (b && b.held > 0 ? 14 : 7) * f.k * S; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(hole.x, hole.y, 7.5, 0, 2 * PI); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = b && b.held > 0 ? '#fff' : '#b88cff'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#ff7ad0'; ctx.textAlign = 'center'; ctx.font = '400 5.2px ' + DISP; ctx.fillText('COFFRE', hole.x, hole.y - 11);
      /* bumpers */
      for (i = 0; i < 5; i++) {
        m = bumps[i]; n = BC[m.c];
        shade(ctx, m.x, m.y, m.r + 2.4, '#f2f4f8', '#9ba1ad', '#474b57');
        if (m.f > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 14 * f.k * S; }
        shade(ctx, m.x, m.y, m.r - .4, m.f > 0 ? '#fff' : n[0], n[1], n[2]); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.9)'; star(ctx, m.x, m.y, 4.4, 5, .45); ctx.fill();
      }
      /* lance-billes (triangles) */
      for (i = 0; i < 2; i++) {
        s = slings[i]; p = s.p;
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.closePath();
        ctx.fillStyle = s.f > 0 ? '#ff9be6' : '#e83aa8'; ctx.fill();
        ctx.shadowColor = '#35e0ff'; ctx.shadowBlur = (s.f > 0 ? 12 : 5) * f.k * S; ctx.strokeStyle = s.f > 0 ? '#fff' : '#8ff0ff'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.shadowBlur = 0;
      }
      flipShape(flips[0]); flipShape(flips[1]);
      /* lanceur à ressort */
      y = B - 25 + charge * 11;
      ctx.strokeStyle = '#e9ecf3'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(186, y + 4);
      for (i = 1; i <= 6; i++) ctx.lineTo(i % 2 ? 197 : 186, y + 4 + (B + 6 - y - 4) * i / 6);
      ctx.stroke(); shade(ctx, 191.5, y, 5.2, '#ff9a90', '#e0352b', '#7c120c');
      if (b && !(b.held > 0)) {
        y = b.rest ? REST + charge * 11 : b.y;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(b.x + 1.6, y + 2.6, b.r, 0, 2 * PI); ctx.fill();
        shade(ctx, b.x, y, b.r, '#ffffff', '#cfd6e4', '#5d6578');
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(top, 0, 0); into(ctx);
      /* afficheur */
      var gr = ctx.createLinearGradient(52, 0, 148, 0); gr.addColorStop(0, '#35e0ff'); gr.addColorStop(.5, '#ffb347'); gr.addColorStop(1, '#ff4f9a');
      ctx.fillStyle = 'rgba(8,6,26,.92)'; ctx.beginPath(); ctx.moveTo(62, 20); ctx.arcTo(148, 20, 148, 42, 11); ctx.arcTo(148, 42, 52, 42, 11); ctx.arcTo(52, 42, 52, 20, 11); ctx.arcTo(52, 20, 148, 20, 11); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = gr; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffa53a'; ctx.shadowColor = '#ff8a1e'; ctx.shadowBlur = 5 * f.k * S;
      ctx.textAlign = 'left'; ctx.font = '700 7.5px ui-monospace, Menlo, Consolas, monospace'; ctx.fillText('B' + Math.min(3, 4 - left) + '/3', 60, 34);
      ctx.textAlign = 'right'; ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace'; ctx.fillText(String(score), 141, 35.6); ctx.shadowBlur = 0;
    }
    function busy() { return (b && !b.rest) || charging || charge > 0 || flips[0].a !== flips[0].t || flips[1].a !== flips[1].t || bumps.some(function (m) { return m.f > 0; }) || slings.some(function (s) { return s.f > 0; }); }
    function tick(t) {
      acc += Math.min(.05, (t - last) / 1000 || 0); last = t;
      while (acc >= H) { step(); acc -= H; }
      draw();
      if (visible && busy()) requestAnimationFrame(tick); else running = false;
    }
    function wake() { if (!running && visible) { running = true; last = performance.now(); acc = 0; requestAnimationFrame(tick); } }
    function press(i, on) {
      var was = flips[i].t === UP;
      if (on === was) return;
      flips[i].t = on ? UP : DOWN; down += on ? 1 : -1;
      if (on && state === 'ready' && b && b.rest && !charging) { charging = true; charge = 0; }
      else if (!on && down <= 0 && charging) {            /* on relâche : la bille part */
        charging = false; b.rest = false; b.play = false; b.y = REST; b.vx = 0; b.vy = -(950 + charge * 150); charge = 0; state = 'play'; say_('');
      }
      wake();
    }
    [L, R].forEach(function (bt, i) {
      bt.addEventListener('pointerdown', function (e) { e.preventDefault(); try { bt.setPointerCapture(e.pointerId); } catch (x) {} press(i, true); });
      ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(function (n) { bt.addEventListener(n, function () { press(i, false); if (n === 'blur') press(1 - i, false); }); });
      bt.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      bt.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) press(i, true); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (!e.repeat) press(e.key === 'ArrowLeft' ? 0 : 1, true); }
      });
      bt.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter') press(i, false);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') press(e.key === 'ArrowLeft' ? 0 : 1, false);
      });
    });
    seen(st, function (v) { visible = v; if (v) { f.size(); if (busy()) wake(); } });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { paint(); draw(); });
    f.size(); newBall(); draw();
  }

  /* ---------- Billard ---------- */
  function billard() {
    var st = stage('billard'); if (!st) return;
    var cv = el('canvas'), info = el('p', 'pool-info'), again = el('button', 'mini', 'Rejouer'), say_ = chipper(st), ctx = cv.getContext('2d');
    cv.tabIndex = 0; cv.setAttribute('role', 'application');
    cv.setAttribute('aria-label', 'Billard : tire en arrière puis lâche pour frapper la blanche. Au clavier : flèches gauche et droite pour viser, haut et bas pour la force, Espace pour tirer.');
    again.type = 'button'; info.setAttribute('aria-hidden', 'true');
    st.appendChild(cv); st.appendChild(info); st.appendChild(again);
    var W = 400, HH = 200, M = 16, LW = W + 2 * M, BR = 7.5, H = 1 / 240, f = fit(cv, LW, draw);
    var COLORS = [['#fff3b0', '#ffc933', '#b98300'], ['#b9d2ff', '#2f6fe4', '#17389a'], ['#ffb3ab', '#e8473b', '#9b1c13'], ['#d9c2ff', '#7a4bc8', '#44238a'], ['#ffd2a6', '#f0842c', '#a34d0c'], ['#6b6f76', '#22262b', '#000']];
    var POCKETS = [[0, 0, 15], [200, -4, 13], [400, 0, 15], [0, 200, 15], [200, 204, 13], [400, 200, 15]];
    var balls = [], cue = null, potted = 0, shots = 0, aim = 0, power = 0, drag = null, kb = false, scratch = false, visible = true, running = false, last = 0, acc = 0, done = false, timer;
    function rack() {
      var d = BR * 2 + .6, s = d * .866, i = 0;
      balls = []; potted = 0; shots = 0; aim = 0; power = 0; drag = null; scratch = false; done = false; clearTimeout(timer);
      cue = { x: 100, y: 100, vx: 0, vy: 0, cue: true }; balls.push(cue);
      [[0, 0], [1, -.5], [1, .5], [2, -1], [2, 0], [2, 1]].forEach(function (p) { balls.push({ x: 285 + p[0] * s, y: 100 + p[1] * d, vx: 0, vy: 0, c: COLORS[i++] }); });
      text(); draw();
    }
    function text() { info.innerHTML = '<b>' + potted + '/6</b> billes<br><b>' + shots + '</b> ' + (shots > 1 ? 'coups' : 'coup'); }
    function moving() { return balls.some(function (o) { return o.vx || o.vy; }); }
    function step() {
      var i, j, o, p, dx, dy, d, sp, nx, ny, vn, q;
      for (i = balls.length - 1; i >= 0; i--) {
        o = balls[i]; if (!o.vx && !o.vy) continue;
        o.x += o.vx * H; o.y += o.vy * H;
        sp = Math.hypot(o.vx, o.vy); q = Math.max(0, sp - (55 + sp * .85) * H);
        if (q < 5) { o.vx = o.vy = 0; } else { o.vx *= q / sp; o.vy *= q / sp; }
        for (j = 0, p = null; j < 6; j++) if (Math.hypot(o.x - POCKETS[j][0], o.y - POCKETS[j][1]) < POCKETS[j][2]) p = POCKETS[j];
        if (p) {
          if (o.cue) { scratch = true; o.vx = o.vy = 0; o.x = -99; o.y = -99; o.out = true; }
          else { balls.splice(i, 1); potted++; text(); }
          continue;
        }
        if (o.x < BR) { o.x = BR; o.vx = Math.abs(o.vx) * .78; } else if (o.x > W - BR) { o.x = W - BR; o.vx = -Math.abs(o.vx) * .78; }
        if (o.y < BR) { o.y = BR; o.vy = Math.abs(o.vy) * .78; } else if (o.y > HH - BR) { o.y = HH - BR; o.vy = -Math.abs(o.vy) * .78; }
      }
      for (i = 0; i < balls.length; i++) for (j = i + 1; j < balls.length; j++) {
        o = balls[i]; p = balls[j]; if (o.out || p.out) continue;
        dx = p.x - o.x; dy = p.y - o.y; d = Math.hypot(dx, dy);
        if (d < BR * 2 && d > 1e-6) {
          nx = dx / d; ny = dy / d; q = (BR * 2 - d) / 2; o.x -= nx * q; o.y -= ny * q; p.x += nx * q; p.y += ny * q;
          vn = (p.vx - o.vx) * nx + (p.vy - o.vy) * ny;
          if (vn < 0) { vn *= .98; o.vx += vn * nx; o.vy += vn * ny; p.vx -= vn * nx; p.vy -= vn * ny; }
        }
      }
    }
    function settle() {
      if (scratch) {
        scratch = false; cue.out = false; cue.x = 100; cue.y = 100;
        while (balls.some(function (o) { return o !== cue && Math.hypot(o.x - cue.x, o.y - cue.y) < BR * 2 + 1; })) cue.x += BR * 2;
        say_('Blanche dans le trou !', 1600); say('Billard : la blanche est tombée, elle revient sur la table.');
      }
      if (potted >= 6 && !done) {
        done = true; say_('Bravo ! ' + shots + (shots > 1 ? ' coups' : ' coup')); say('Billard : toutes les billes sont rentrées en ' + shots + ' coups.');
        timer = setTimeout(function () { say_(''); rack(); }, 3000);
      }
    }
    function reach() {                                   /* distance jusqu'au premier obstacle sur la ligne de visée */
      var cx = Math.cos(aim), cy = Math.sin(aim), t = 1e9, i, o, ox, oy, pr, pp;
      if (cx > 0) t = Math.min(t, (W - BR - cue.x) / cx); else if (cx < 0) t = Math.min(t, (BR - cue.x) / cx);
      if (cy > 0) t = Math.min(t, (HH - BR - cue.y) / cy); else if (cy < 0) t = Math.min(t, (BR - cue.y) / cy);
      for (i = 0; i < balls.length; i++) {
        o = balls[i]; if (o === cue) continue;
        ox = o.x - cue.x; oy = o.y - cue.y; pr = ox * cx + oy * cy; pp = ox * ox + oy * oy - pr * pr;
        if (pr > 0 && pp < BR * BR * 4) t = Math.min(t, pr - Math.sqrt(BR * BR * 4 - pp));
      }
      return Math.max(0, t);
    }
    function draw() {
      var i, o, t, cx, cy, back;
      ctx.setTransform(f.k, 0, 0, f.k, 0, 0); ctx.clearRect(0, 0, LW, f.LH);
      ctx.fillStyle = '#7a4a22'; rr(0, 0, LW, HH + 2 * M, 14); ctx.fill();
      ctx.fillStyle = '#5c3414'; rr(3, 3, LW - 6, HH + 2 * M - 6, 12); ctx.fill();
      ctx.fillStyle = '#126b46'; rr(M - 6, M - 6, W + 12, HH + 12, 6); ctx.fill();
      var g = ctx.createRadialGradient(M + W / 2, M + HH / 2, 20, M + W / 2, M + HH / 2, W * .6); g.addColorStop(0, '#27a06a'); g.addColorStop(1, '#17794f');
      ctx.fillStyle = g; ctx.fillRect(M, M, W, HH);
      ctx.translate(M, M);
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(100, HH); ctx.stroke();
      ctx.fillStyle = '#07130d'; for (i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(POCKETS[i][0], POCKETS[i][1], POCKETS[i][2] - 3, 0, 6.2832); ctx.fill(); }
      if (cue && !cue.out && !moving() && !done && (drag || kb) && power > 0) {
        cx = Math.cos(aim); cy = Math.sin(aim); t = reach();
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(cue.x + cx * BR, cue.y + cy * BR); ctx.lineTo(cue.x + cx * t, cue.y + cy * t); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(cue.x + cx * t, cue.y + cy * t, BR, 0, 6.2832); ctx.stroke();
        back = BR + 5 + power * 34; ctx.lineCap = 'round';
        ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cue.x - cx * (back + 40), cue.y - cy * (back + 40)); ctx.lineTo(cue.x - cx * (back + 170), cue.y - cy * (back + 170)); ctx.stroke();
        ctx.strokeStyle = '#e9c98a'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(cue.x - cx * back, cue.y - cy * back); ctx.lineTo(cue.x - cx * (back + 120), cue.y - cy * (back + 120)); ctx.stroke();
        ctx.strokeStyle = '#bfe3ff'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(cue.x - cx * back, cue.y - cy * back); ctx.lineTo(cue.x - cx * (back + 4), cue.y - cy * (back + 4)); ctx.stroke(); ctx.lineCap = 'butt';
      }
      for (i = 0; i < balls.length; i++) {
        o = balls[i]; if (o.out) continue;
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(o.x + 1.8, o.y + 2.6, BR, 0, 6.2832); ctx.fill();
        if (o.cue) shade(ctx, o.x, o.y, BR, '#ffffff', '#f1ede2', '#b9b2a2'); else shade(ctx, o.x, o.y, BR, o.c[0], o.c[1], o.c[2]);
      }
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function tick(t) {
      var was = moving();
      acc += Math.min(.05, (t - last) / 1000 || 0); last = t;
      while (acc >= H) { if (moving()) step(); acc -= H; }
      if (was && !moving()) settle();
      draw();
      if (visible && (moving() || drag)) requestAnimationFrame(tick); else running = false;
    }
    function wake() { if (!running && visible) { running = true; last = performance.now(); acc = 0; requestAnimationFrame(tick); } }
    function shoot() {
      if (moving() || done || cue.out || power <= 0) return;
      cue.vx = Math.cos(aim) * (150 + power * 800); cue.vy = Math.sin(aim) * (150 + power * 800);
      shots++; text(); power = 0; say_(''); wake();
    }
    function pt(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width * LW, y: (e.clientY - b.top) / b.width * LW }; }
    cv.addEventListener('pointerdown', function (e) {
      if (moving() || done) return;
      e.preventDefault(); drag = pt(e); power = 0; kb = false; try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      wake();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = pt(e), dx = p.x - drag.x, dy = p.y - drag.y, d = Math.hypot(dx, dy);
      if (d > 7) { aim = Math.atan2(-dy, -dx); power = clamp((d - 7) / 95, .02, 1); } else power = 0;
    });
    function up() { if (!drag) return; drag = null; if (power > 0) shoot(); else draw(); }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', function () { drag = null; power = 0; draw(); });
    cv.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') aim += (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? .01 : .05);
      else if (k === 'ArrowUp' || k === 'ArrowDown') power = clamp((power || .5) + (k === 'ArrowUp' ? .1 : -.1), .1, 1);
      else if (k === ' ' || k === 'Enter') { e.preventDefault(); if (!power) power = .5; kb = true; shoot(); power = .5; draw(); return; }
      else return;
      e.preventDefault(); kb = true; if (!power) power = .5; draw();
    });
    cv.addEventListener('blur', function () { if (kb) { kb = false; power = 0; draw(); } });
    again.addEventListener('click', function () { say_(''); rack(); say('Billard : nouvelle partie.'); });
    seen(st, function (v) { visible = v; if (v) { f.size(); if (moving()) wake(); } });
    f.size(); rack(); say_('Tire en arrière et lâche', 4200);
  }

  [piano, yams, ttt, solitaire, c4, paires, dames, sudoku, mot, hockey, billes, flipper, tour, billard, mines].forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } });
})();
