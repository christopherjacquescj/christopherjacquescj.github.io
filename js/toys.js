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
  function billes() {
    var st = stage('billes'); if (!st) return;
    var CAP = 4, NAMES = ['rouge', 'jaune', 'bleue'], say_ = chipper(st), box = el('div', 'tubes'), tubes = [], sel = -1, done = false, timer;
    st.appendChild(box);
    function solved() { return tubes.every(function (t) { return !t.length || (t.length === CAP && t.every(function (c) { return c === t[0]; })); }); }
    function newGame() {
      var balls = [], c, k;
      for (c = 0; c < 3; c++) for (k = 0; k < CAP; k++) balls.push(c);
      do {
        shuffle(balls); tubes = [[], [], [], [], []];
        balls.forEach(function (b, i) { tubes[Math.floor(i / CAP)].push(b); });
      } while (solved());
      sel = -1; done = false; say_(''); render(false);
    }
    function render(keepFocus) {
      var idx = -1;
      if (keepFocus) Array.prototype.forEach.call(box.children, function (b, i) { if (b === document.activeElement) idx = i; });
      box.innerHTML = '';
      tubes.forEach(function (t, i) {
        var b = el('button', 'tube' + (sel === i ? ' sel' : '')); b.type = 'button';
        b.setAttribute('aria-label', 'Tube ' + (i + 1) + ' : ' + (t.length ? t.map(function (c) { return NAMES[c]; }).join(', ') + ' (du bas vers le haut)' : 'vide') + (sel === i ? ', choisi' : ''));
        t.forEach(function (c, j) { var ball = el('span', 'ball c' + c); if (sel === i && j === t.length - 1) ball.classList.add('up'); b.appendChild(ball); });
        b.addEventListener('click', function () { pick(i); }); box.appendChild(b);
      });
      if (idx >= 0 && box.children[idx]) box.children[idx].focus();
    }
    function pick(i) {
      if (done) return;
      if (sel < 0) { if (tubes[i].length) sel = i; }
      else if (sel === i) sel = -1;
      else {
        var s = tubes[sel], t = tubes[i], c = s[s.length - 1];
        if (t.length < CAP && (!t.length || t[t.length - 1] === c)) {
          while (s.length && s[s.length - 1] === c && t.length < CAP) t.push(s.pop());
          sel = -1;
          if (solved()) { done = true; say_('Bravo !'); say('Tri de billes : réussi.'); timer = setTimeout(newGame, 2800); }
          else say_('');
        } else if (t.length) sel = i;
      }
      render(true);
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

  [piano, yams, ttt, solitaire, c4, paires, dames, sudoku, mot, hockey, billes, mines].forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } });
})();
