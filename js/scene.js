/* Le Coffre à Jeux — la scène du haut de page.
   Les pièces des 11 jeux tombent sur le tapis ; on peut les attraper, les lancer, les secouer.
   Physique : Matter.js (licence MIT), hébergé dans vendor/. Aucune requête vers un site tiers. */
(function () {
  'use strict';
  var M = window.Matter, hero = document.querySelector('.hero'), cv = document.getElementById('pile');
  if (!M || !hero || !cv) return;

  var Engine = M.Engine, Bodies = M.Bodies, Body = M.Body, Composite = M.Composite,
      Constraint = M.Constraint, Query = M.Query, Sleeping = M.Sleeping;
  var TAU = Math.PI * 2;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, U = 28, PLANK = 22, builtU = 0, builtW = 0;
  var engine = null, pieces = [], walls = [], spawnQ = [], running = false, visible = true, started = false;
  var last = 0, acc = 0, calm = 0, drag = null, lastMouse = null, touched = false;
  var cache = {}, shadow = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- dessin des pièces (lumière en haut à gauche) ---------- */
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function lin(c, x0, y0, x1, y1, stops) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  function sphere(c, x, y, r, base, light, dark) {
    var g = c.createRadialGradient(x - r * .35, y - r * .4, r * .08, x, y, r * 1.02);
    g.addColorStop(0, light); g.addColorStop(.5, base); g.addColorStop(1, dark);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(1, r * .05); c.strokeStyle = 'rgba(0,0,0,.3)'; c.stroke();
  }
  function glint(c, x, y, r, a) {
    var gx = x - r * .4, gy = y - r * .45, g = c.createRadialGradient(gx, gy, 0, gx, gy, r * .42);
    g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(gx, gy, r * .42, 0, TAU); c.fill();
  }
  function ringLine(c, r, w, col, a0, a1) {
    c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.arc(0, 0, r, a0 || 0, a1 || TAU); c.stroke();
  }
  function tile(c, u, s, top, mid, bot, edge) {
    var h = s / 2, rad = s * .2;
    rr(c, -h, -h, s, s, rad); c.fillStyle = lin(c, -h, -h, h, h, [[0, top], [.6, mid], [1, bot]]); c.fill();
    c.lineWidth = u * .06; c.strokeStyle = edge; c.stroke();
    rr(c, -h + u * .08, -h + u * .08, s - u * .16, s - u * .16, rad * .75);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = u * .05; c.stroke();
  }
  var MARBLES = [['#ff9a90', '#e8473b', '#8e1b14'], ['#9cc0ff', '#2f6fe4', '#142f78'], ['#a6f2bd', '#27ae60', '#0d5a2e'],
                 ['#ffe9a0', '#ffc933', '#a8740a'], ['#e0b8ff', '#8e44ad', '#4a1666'], ['#ffc99a', '#f08a24', '#8a3f05'],
                 ['#a8f0f5', '#1fb5c6', '#0a5560']];
  var LETTERS = ['A', 'E', 'I', 'M', 'O', 'R', 'S', 'T', 'J', 'U', 'D', 'L'];
  var PTS = { A: 1, E: 1, I: 1, M: 2, O: 1, R: 1, S: 1, T: 1, J: 8, U: 1, D: 2, L: 1 };
  var FONT = '"Paytone One","Arial Rounded MT Bold",system-ui,sans-serif';

  var DEF = {
    marble: { shape: 'circle', r: .62, rest: .5, fric: .1, bw: function (u) { return 1.24 * u; }, bh: function (u) { return 1.24 * u; },
      draw: function (c, u, v) {
        var r = .62 * u, P = MARBLES[v % MARBLES.length];
        sphere(c, 0, 0, r, P[1], P[0], P[2]);
        c.save(); c.rotate(.7); c.globalAlpha = .38; c.fillStyle = P[0]; c.beginPath(); c.ellipse(0, 0, r * .74, r * .2, 0, 0, TAU); c.fill(); c.restore();
        glint(c, 0, 0, r, .9);
      } },
    c4: { shape: 'circle', r: .92, rest: .4, fric: .2, bw: function (u) { return 1.84 * u; }, bh: function (u) { return 1.84 * u; },
      draw: function (c, u, v) {
        var r = .92 * u, P = v % 2 ? ['#ffe58a', '#ffc72c', '#c48a00'] : ['#ff8a7d', '#e63e32', '#9b1c13'];
        sphere(c, 0, 0, r, P[1], P[0], P[2]);
        ringLine(c, r * .62, r * .1, 'rgba(0,0,0,.24)');
        ringLine(c, r * .62, r * .06, 'rgba(255,255,255,.4)', Math.PI * .95, Math.PI * 1.7);
        glint(c, 0, 0, r, .45);
      } },
    checker: { shape: 'circle', r: .95, rest: .35, fric: .3, bw: function (u) { return 1.9 * u; }, bh: function (u) { return 1.9 * u; },
      draw: function (c, u, v) {
        var r = .95 * u, light = v % 2, P = light ? ['#fffaea', '#efe0bd', '#b9a46f'] : ['#6a645f', '#2b2927', '#0b0a0a'];
        sphere(c, 0, 0, r, P[1], P[0], P[2]);
        ringLine(c, r * .8, r * .06, light ? 'rgba(120,90,40,.4)' : 'rgba(255,255,255,.16)');
        ringLine(c, r * .58, r * .06, light ? 'rgba(120,90,40,.35)' : 'rgba(255,255,255,.14)');
        glint(c, 0, 0, r, .35);
      } },
    mallet: { shape: 'circle', r: 1, rest: .45, fric: .2, bw: function (u) { return 2 * u; }, bh: function (u) { return 2 * u; },
      draw: function (c, u, v) {
        var r = u, P = v % 2 ? ['#9cc0ff', '#2f6fe4', '#17389a'] : ['#ff8a80', '#e8473b', '#9b1c13'];
        sphere(c, 0, 0, r, P[1], P[0], P[2]);
        ringLine(c, r * .78, r * .08, 'rgba(0,0,0,.22)');
        sphere(c, 0, 0, r * .44, P[1], P[0], P[2]); glint(c, 0, 0, r * .44, .75);
      } },
    puck: { shape: 'circle', r: .72, rest: .5, fric: .05, bw: function (u) { return 1.44 * u; }, bh: function (u) { return 1.44 * u; },
      draw: function (c, u) {
        var r = .72 * u; sphere(c, 0, 0, r, '#3a3f44', '#767e86', '#0f1113');
        ringLine(c, r * .66, r * .08, 'rgba(255,255,255,.2)'); glint(c, 0, 0, r, .35);
      } },
    mine: { shape: 'circle', r: .98, rest: .4, fric: .2, bw: function (u) { return 2.1 * u; }, bh: function (u) { return 2.1 * u; },
      draw: function (c, u) {
        var r = .72 * u; c.strokeStyle = '#161616'; c.lineWidth = u * .15; c.lineCap = 'round';
        for (var i = 0; i < 8; i++) {
          var a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * r * .7, Math.sin(a) * r * .7);
          c.lineTo(Math.cos(a) * r * 1.34, Math.sin(a) * r * 1.34); c.stroke();
        }
        sphere(c, 0, 0, r, '#2b2b2b', '#6a6a6a', '#050505'); glint(c, 0, 0, r, .95);
      } },
    o: { shape: 'circle', r: .86, rest: .4, fric: .25, bw: function (u) { return 1.72 * u; }, bh: function (u) { return 1.72 * u; },
      draw: function (c, u) {
        var R = .86 * u, rin = .5 * u;
        c.fillStyle = lin(c, -R, -R, R, R, [[0, '#ff9a90'], [.5, '#e8473b'], [1, '#8e1b14']]);
        c.beginPath(); c.arc(0, 0, R, 0, TAU); c.arc(0, 0, rin, 0, TAU, true); c.fill('evenodd');
        c.lineWidth = u * .05; c.strokeStyle = 'rgba(0,0,0,.3)';
        c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, rin, 0, TAU); c.stroke();
        ringLine(c, (R + rin) / 2, u * .07, 'rgba(255,255,255,.5)', Math.PI * 1.05, Math.PI * 1.6);
      } },
    x: { shape: 'x', L: 1.9, T: .52, rest: .3, fric: .45, bw: function (u) { return 1.75 * u; }, bh: function (u) { return 1.75 * u; },
      draw: function (c, u) {
        var L = 1.9 * u, T = .52 * u, a, i, angs = [Math.PI / 4, -Math.PI / 4];
        for (i = 0; i < 2; i++) {
          a = angs[i]; c.save(); c.rotate(a); rr(c, -L / 2, -T / 2, L, T, T * .45);
          c.fillStyle = lin(c, 0, -T / 2, 0, T / 2, [[0, '#9cc0ff'], [.5, '#2f6fe4'], [1, '#17389a']]); c.fill();
          c.lineWidth = u * .045; c.strokeStyle = 'rgba(0,0,0,.3)'; c.stroke();
          rr(c, -L / 2 + T * .25, -T / 2 + T * .12, L - T * .5, T * .22, T * .1); c.fillStyle = 'rgba(255,255,255,.28)'; c.fill();
          c.restore();
        }
      } },
    die: { shape: 'rect', w: 1.5, h: 1.5, ch: .3, rest: .3, fric: .5, bw: function (u) { return 1.5 * u; }, bh: function (u) { return 1.5 * u; },
      draw: function (c, u, v) {
        var s = 1.5 * u, h = s / 2, rad = s * .24, face = 1 + (v % 6), p = s * .25;
        rr(c, -h, -h, s, s, rad); c.fillStyle = lin(c, -h, -h, h, h, [[0, '#fffdf5'], [.6, '#f6ead0'], [1, '#d6c395']]); c.fill();
        c.lineWidth = u * .06; c.strokeStyle = 'rgba(60,40,10,.38)'; c.stroke();
        rr(c, -h + u * .07, -h + u * .07, s - u * .14, s - u * .14, rad * .8); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = u * .05; c.stroke();
        var map = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
                    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
        c.fillStyle = face === 1 ? '#d3362b' : '#1c1b1a';
        map[face].forEach(function (q) { c.beginPath(); c.arc(q[0] * p, q[1] * p, u * .17, 0, TAU); c.fill(); });
      } },
    letter: { shape: 'rect', w: 1.45, h: 1.45, ch: .22, rest: .25, fric: .55, bw: function (u) { return 1.45 * u; }, bh: function (u) { return 1.45 * u; },
      draw: function (c, u, v) {
        var s = 1.45 * u, h = s / 2, L = LETTERS[v % LETTERS.length];
        tile(c, u, s, '#fbeac0', '#eed08c', '#c9a15a', 'rgba(80,50,10,.42)');
        c.fillStyle = '#3a2410'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = (u * 1.02) + 'px ' + FONT; c.fillText(L, -u * .04, u * .03);
        c.font = '700 ' + (u * .3) + 'px system-ui,sans-serif'; c.fillText(String(PTS[L] || 1), h - u * .2, h - u * .2);
      } },
    sudoku: { shape: 'rect', w: 1.45, h: 1.45, ch: .22, rest: .25, fric: .55, bw: function (u) { return 1.45 * u; }, bh: function (u) { return 1.45 * u; },
      draw: function (c, u, v) {
        var s = 1.45 * u;
        tile(c, u, s, '#ffffff', '#f7f4ea', '#d9d4c2', 'rgba(60,60,60,.35)');
        c.fillStyle = '#2f6fe4'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = (u * 1.05) + 'px ' + FONT; c.fillText(String(1 + (v % 9)), 0, u * .04);
      } },
    card: { shape: 'rect', w: 1.15, h: 1.6, ch: .16, rest: .25, fric: .5, bw: function (u) { return 1.15 * u; }, bh: function (u) { return 1.6 * u; },
      draw: function (c, u, v) {
        var w = 1.15 * u, h = 1.6 * u;
        rr(c, -w / 2, -h / 2, w, h, u * .16); c.fillStyle = '#fffdf7'; c.fill();
        c.lineWidth = u * .05; c.strokeStyle = 'rgba(0,0,0,.32)'; c.stroke();
        var iw = w - u * .22, ih = h - u * .22;
        if (v % 2 === 0) {
          rr(c, -iw / 2, -ih / 2, iw, ih, u * .1); c.fillStyle = '#2f6fe4'; c.fill();
          c.save(); rr(c, -iw / 2, -ih / 2, iw, ih, u * .1); c.clip();
          c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = u * .05;
          for (var i = -8; i <= 8; i++) {
            c.beginPath(); c.moveTo(-w, i * u * .3 - h); c.lineTo(w, i * u * .3 + h); c.stroke();
            c.beginPath(); c.moveTo(-w, i * u * .3 + h); c.lineTo(w, i * u * .3 - h); c.stroke();
          }
          c.restore();
        } else {
          c.fillStyle = v % 4 === 1 ? '#e8473b' : '#2f6fe4'; c.beginPath();
          if (v % 4 === 1) { // cœur
            var k = u * .52; c.moveTo(0, k * .9); c.bezierCurveTo(-k * 1.5, -k * .1, -k * .9, -k * 1.1, 0, -k * .35);
            c.bezierCurveTo(k * .9, -k * 1.1, k * 1.5, -k * .1, 0, k * .9);
          } else { // étoile
            for (var j = 0; j < 10; j++) { var rr2 = j % 2 ? u * .22 : u * .52, a = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
          }
          c.closePath(); c.fill();
        }
      } },
    key: { shape: 'rect', w: 2.1, h: 1.4, ch: .14, rest: .25, fric: .5, bw: function (u) { return 2.1 * u; }, bh: function (u) { return 1.4 * u; },
      draw: function (c, u) {
        var w = 2.1 * u, h = 1.4 * u;
        rr(c, -w / 2, -h / 2, w, h, u * .14); c.fillStyle = lin(c, 0, -h / 2, 0, h / 2, [[0, '#ffffff'], [1, '#e4d9bd']]); c.fill();
        c.lineWidth = u * .05; c.strokeStyle = 'rgba(0,0,0,.34)'; c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = u * .04;
        for (var i = -1; i <= 1; i += 2) { c.beginPath(); c.moveTo(i * w / 6, -h / 2 + u * .1); c.lineTo(i * w / 6, h / 2 - u * .1); c.stroke(); }
        for (var j = -1; j <= 1; j += 2) {
          rr(c, j * w / 6 - u * .17, -h / 2 + u * .02, u * .34, h * .6, u * .06);
          c.fillStyle = lin(c, 0, -h / 2, 0, h * .1, [[0, '#4a4a4a'], [1, '#111']]); c.fill();
        }
      } }
  };
  var WEIGHTS = [['marble', 6], ['c4', 5], ['checker', 4], ['die', 4], ['letter', 3], ['sudoku', 2], ['card', 3], ['key', 1.4],
                 ['mallet', 2], ['puck', 2], ['mine', 2], ['x', 2.4], ['o', 2.4]];
  var GUARANTEED = [['x', 0], ['o', 0], ['c4', 0], ['c4', 1], ['checker', 0], ['checker', 1], ['sudoku', 4], ['letter', 3], ['key', 0],
                    ['die', 3], ['mallet', 0], ['mallet', 1], ['puck', 0], ['mine', 0], ['card', 0], ['card', 1], ['marble', 1], ['marble', 0]];

  function sprite(type, v) {
    var key = type + ':' + v + ':' + Math.round(U) + ':' + dpr;
    if (cache[key]) return cache[key];
    var d = DEF[type], pad = Math.ceil(U * .3), bw = Math.ceil(d.bw(U) + pad * 2), bh = Math.ceil(d.bh(U) + pad * 2);
    var c = document.createElement('canvas'); c.width = Math.ceil(bw * dpr); c.height = Math.ceil(bh * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr); g.translate(bw / 2, bh / 2); d.draw(g, U, v);
    return (cache[key] = { c: c, w: bw, h: bh });
  }
  function makeShadow() {
    var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'), r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(.55, 'rgba(0,0,0,.28)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s); return c;
  }

  /* ---------- monde physique ---------- */
  function makeBody(type, v, x, y) {
    var d = DEF[type], o = { restitution: d.rest, friction: d.fric, frictionStatic: .6, frictionAir: .004, density: .001, sleepThreshold: 50, slop: .06 }, b;
    if (d.shape === 'circle') b = Bodies.circle(x, y, d.r * U, o, 26);
    else if (d.shape === 'rect') b = Bodies.rectangle(x, y, d.w * U, d.h * U, Object.assign({ chamfer: { radius: d.ch * U } }, o));
    else {
      var L = d.L * U, T = d.T * U;
      var p1 = Bodies.rectangle(x, y, L, T, Object.assign({ angle: Math.PI / 4 }, o)), p2 = Bodies.rectangle(x, y, L, T, Object.assign({ angle: -Math.PI / 4 }, o));
      b = Body.create(Object.assign({ parts: [p1, p2] }, o));
    }
    var rad = d.shape === 'circle' ? d.r * U : d.shape === 'rect' ? Math.hypot(d.w, d.h) * U / 2 : (d.L * .72) * U / 1.1;
    return { body: b, type: type, v: v, spr: sprite(type, v), rad: rad };
  }
  function addWalls() {
    var t = 400, fy = H - PLANK + 3;
    walls = [
      Bodies.rectangle(W / 2, fy + t / 2, W + t * 2, t, { isStatic: true, friction: .7, restitution: .15 }),
      Bodies.rectangle(-t / 2, H / 2 - 500, t, H + 1400, { isStatic: true, friction: .2 }),
      Bodies.rectangle(W + t / 2, H / 2 - 500, t, H + 1400, { isStatic: true, friction: .2 }),
      Bodies.rectangle(W / 2, -1300 - t / 2, W + t * 2, t, { isStatic: true })
    ];
    Composite.add(engine.world, walls);
  }
  function newWorld() {
    engine = Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 6 });
    engine.gravity.y = 1.15;
    pieces = []; spawnQ = []; drag = null; calm = 0;
    addWalls();
  }
  function pieceCount() {
    var copy = hero.querySelector('.hero-copy'), top = hero.getBoundingClientRect().top;
    var cb = copy ? copy.getBoundingClientRect().bottom - top : H * .55;
    var th = clamp((H - PLANK - cb - 14) * .9, 90, 340);        // hauteur visée du tas
    var area = Math.PI * Math.pow(U * .85, 2);                   // surface moyenne d'une pièce
    return Math.round(clamp(W * th / (area * 1.45), 24, 84));
  }
  function markPile() {
    var floor = H - PLANK, top = floor, cx = W / 2, half = Math.min(170, W * .32), i, b, p, copy, gap;
    for (i = 0; i < pieces.length; i++) {
      p = pieces[i]; b = p.body;
      if (b.position.y < 0 || Math.abs(b.position.x - cx) > half) continue;
      top = Math.min(top, b.position.y - p.rad * .85);
    }
    hero.style.setProperty('--pile', Math.round(floor - top) + 'px');
    copy = hero.querySelector('.hero-copy');
    if (copy) {
      gap = top - (copy.getBoundingClientRect().bottom - hero.getBoundingClientRect().top);
      hero.classList.toggle('no-hint-room', gap < 46);
    }
  }
  function lineup(n) {
    var list = GUARANTEED.slice(), tot = 0, i, k;
    for (i = 0; i < WEIGHTS.length; i++) tot += WEIGHTS[i][1];
    while (list.length < n) {
      var r = Math.random() * tot, t = WEIGHTS[0][0];
      for (i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i][1]; if (r <= 0) { t = WEIGHTS[i][0]; break; } }
      list.push([t, Math.floor(Math.random() * 12)]);
    }
    for (i = list.length - 1; i > 0; i--) { k = Math.floor(Math.random() * (i + 1)); var tmp = list[i]; list[i] = list[k]; list[k] = tmp; }
    return list;
  }
  function addPiece(type, v, x, y) {
    var p = makeBody(type, v, x, y);
    Body.setAngle(p.body, rnd(0, TAU));
    Composite.add(engine.world, p.body); pieces.push(p); return p;
  }
  function populate(instant) {
    newWorld();
    builtU = U; builtW = W;
    var list = lineup(pieceCount()), i;
    if (instant) {
      var floorY = H - PLANK;
      for (i = 0; i < list.length; i++) addPiece(list[i][0], list[i][1], rnd(U * 1.6, W - U * 1.6), floorY - U * 1.4 - i * U * .55);
      for (i = 0; i < 520; i++) Engine.update(engine, 1000 / 60);
      draw(); markPile();
    } else {
      spawnQ = list;
    }
  }

  /* ---------- boucle ---------- */
  function spawnSome() {
    if (!spawnQ.length) return;
    var t = spawnQ.pop(), tries = 0, x;
    do { x = rnd(U * 1.5, W - U * 1.5); tries++; } while (tries < 6 && lastSpawnX !== null && Math.abs(x - lastSpawnX) < U * 1.7);
    lastSpawnX = x;
    var p = addPiece(t[0], t[1], x, -U * 2.2);
    Body.setVelocity(p.body, { x: rnd(-1.6, 1.6), y: rnd(1, 3) }); Body.setAngularVelocity(p.body, rnd(-.12, .12));
  }
  var lastSpawnX = null, spawnTick = 0;
  function step() {
    if (spawnQ.length && (++spawnTick % 2 === 0)) spawnSome();
    Engine.update(engine, 1000 / 60);
    var mv = 0, i, b, sp;
    for (i = 0; i < pieces.length; i++) {
      b = pieces[i].body; sp = Math.abs(b.velocity.x) + Math.abs(b.velocity.y);
      if (sp > 26) Body.setVelocity(b, { x: b.velocity.x * 26 / sp, y: b.velocity.y * 26 / sp });
      if (!b.isSleeping) mv = Math.max(mv, sp + Math.abs(b.angularVelocity) * 20);
      if (b.position.y > H + 400 || b.position.x < -300 || b.position.x > W + 300) {
        Body.setPosition(b, { x: rnd(U * 2, W - U * 2), y: -U * 3 }); Body.setVelocity(b, { x: 0, y: 2 });
      }
    }
    calm = mv < .35 ? calm + 1 : 0;
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var i, p, b, r;
    for (i = 0; i < pieces.length; i++) {
      p = pieces[i]; b = p.body; if (b.position.y < -p.rad * 2) continue;
      r = p.rad * 1.18; ctx.drawImage(shadow, b.position.x - r + p.rad * .16, b.position.y - r + p.rad * .3, r * 2, r * 2);
    }
    for (i = 0; i < pieces.length; i++) {
      p = pieces[i]; b = p.body; if (b.position.y < -p.spr.h) continue;
      ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
      ctx.drawImage(p.spr.c, -p.spr.w / 2, -p.spr.h / 2, p.spr.w, p.spr.h); ctx.restore();
    }
  }
  var frames = 0;
  function showHint() {
    var hint = hero.querySelector('.hint');
    if (hint && !touched) hint.classList.add('is-on');
  }
  function tick(t) {
    if (!running) return;
    var dt = Math.min(48, t - last); last = t; acc += dt;
    var n = 0; while (acc >= 16.667 && n < 4) { step(); acc -= 16.667; n++; }
    if (acc > 60) acc = 0;
    draw();
    if ((++frames % 20) === 0) markPile();
    if (!drag && !spawnQ.length && calm > 100) { running = false; markPile(); showHint(); return; }
    requestAnimationFrame(tick);
  }
  function wake() {
    calm = 0;
    if (running || !visible || !engine) return;
    running = true; last = performance.now(); acc = 0; requestAnimationFrame(tick);
  }

  /* ---------- toucher, attraper, lancer ---------- */
  function toLocal(cx, cy) { var r = hero.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; }
  function pickAt(p, slack) {
    var i, bs = [], best = null, bd = 1e9, d;
    for (i = 0; i < pieces.length; i++) bs.push(pieces[i].body);
    var hit = Query.point(bs, p);
    if (hit.length) return hit[hit.length - 1];
    for (i = 0; i < pieces.length; i++) {
      d = Math.hypot(pieces[i].body.position.x - p.x, pieces[i].body.position.y - p.y) - pieces[i].rad;
      if (d < slack && d < bd) { bd = d; best = pieces[i].body; }
    }
    return best;
  }
  function startDrag(b, p, kind) {
    Sleeping.set(b, false);
    var dx = p.x - b.position.x, dy = p.y - b.position.y, c = Math.cos(-b.angle), s = Math.sin(-b.angle);
    var con = Constraint.create({ pointA: { x: p.x, y: p.y }, bodyB: b, pointB: { x: dx * c - dy * s, y: dx * s + dy * c }, stiffness: .2, damping: .14, length: 0 });
    Composite.add(engine.world, con);
    drag = { con: con, b: b, kind: kind, t0: performance.now(), x0: p.x, y0: p.y, moved: 0 };
    hero.classList.add('is-dragging'); touchedOnce(); wake();
  }
  function moveDrag(p) {
    if (!drag) return;
    drag.con.pointA.x = clamp(p.x, 0, W); drag.con.pointA.y = clamp(p.y, -300, H);
    drag.moved = Math.max(drag.moved, Math.hypot(p.x - drag.x0, p.y - drag.y0));
    wake();
  }
  function endDrag() {
    if (!drag) return;
    var b = drag.b, tap = drag.moved < 8 && performance.now() - drag.t0 < 320;
    Composite.remove(engine.world, drag.con); drag = null; hero.classList.remove('is-dragging');
    if (tap) { Sleeping.set(b, false); Body.setVelocity(b, { x: rnd(-3, 3), y: -rnd(8, 12) }); Body.setAngularVelocity(b, rnd(-.25, .25)); }
    wake();
  }
  function touchedOnce() {
    if (touched) return; touched = true; var h = hero.querySelector('.hint'); if (h) h.classList.add('is-gone');
  }
  hero.addEventListener('mousedown', function (e) {
    if (e.button !== 0 || !engine) return;
    var p = toLocal(e.clientX, e.clientY), b = pickAt(p, 6);
    if (!b) return;
    e.preventDefault(); startDrag(b, p, 'mouse');
    var mv = function (ev) { moveDrag(toLocal(ev.clientX, ev.clientY)); };
    var up = function () { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); endDrag(); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });
  hero.addEventListener('mousemove', function (e) {
    if (drag || !engine) return;
    var p = toLocal(e.clientX, e.clientY), over = pickAt(p, 0);
    hero.style.cursor = over ? 'grab' : '';
    if (lastMouse) {
      var vx = p.x - lastMouse.x, vy = p.y - lastMouse.y, sp = Math.hypot(vx, vy);
      if (sp > 7) {
        for (var i = 0; i < pieces.length; i++) {
          var b = pieces[i].body;
          if (Math.hypot(b.position.x - p.x, b.position.y - p.y) < pieces[i].rad + 26) {
            Sleeping.set(b, false);
            Body.setVelocity(b, { x: clamp(b.velocity.x + vx * .1, -12, 12), y: clamp(b.velocity.y + vy * .1, -12, 12) });
            wake();
          }
        }
      }
    }
    lastMouse = p;
  });
  hero.addEventListener('mouseleave', function () { lastMouse = null; });
  hero.addEventListener('touchstart', function (e) {
    if (drag || !engine) return;
    var t = e.changedTouches[0], p = toLocal(t.clientX, t.clientY), b = pickAt(p, 10);
    if (!b) return;
    e.preventDefault(); startDrag(b, p, 'touch'); drag.id = t.identifier;
  }, { passive: false });
  hero.addEventListener('touchmove', function (e) {
    if (!drag || drag.kind !== 'touch') return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === drag.id) { e.preventDefault(); moveDrag(toLocal(t.clientX, t.clientY)); }
    }
  }, { passive: false });
  function touchEnd(e) {
    if (!drag || drag.kind !== 'touch') return;
    for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === drag.id) endDrag();
  }
  hero.addEventListener('touchend', touchEnd); hero.addEventListener('touchcancel', touchEnd);

  var shakeBtn = hero.querySelector('.shake');
  if (shakeBtn) shakeBtn.addEventListener('click', function () {
    if (!engine) return;
    pieces.forEach(function (p) {
      Sleeping.set(p.body, false);
      Body.setVelocity(p.body, { x: rnd(-7, 7), y: -rnd(9, 17) }); Body.setAngularVelocity(p.body, rnd(-.3, .3));
    });
    touchedOnce(); wake();
  });

  /* ---------- mise en place, taille, visibilité ---------- */
  function layout() {
    var r = hero.getBoundingClientRect(), nw = Math.round(r.width), nh = Math.round(r.height);
    if (nw < 10 || nh < 10) return;
    var plankEl = hero.querySelector('.plank'); PLANK = plankEl ? plankEl.offsetHeight : 22;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var wChanged = Math.abs(nw - W) > 1, hChanged = Math.abs(nh - H) > 80;
    if (!wChanged && !hChanged && started) return;
    W = nw; H = nh;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    U = clamp(W / 30, 24, 36);
    if (!started) return;
    if (Math.abs(U - builtU) > 3 || Math.abs(W - builtW) > W * .35) { populate(true); return; }
    Composite.remove(engine.world, walls); addWalls();
    pieces.forEach(function (p) {
      var b = p.body; Sleeping.set(b, false);
      if (b.position.x > W - U) Body.setPosition(b, { x: W - U * 1.6, y: b.position.y });
      if (b.position.y > H - PLANK) Body.setPosition(b, { x: b.position.x, y: H - PLANK - U * 1.5 });
    });
    wake();
  }
  function start() {
    if (started) return;
    started = true; layout(); shadow = makeShadow();
    populate(reduce);
    if (!reduce) wake();
    if (reduce) showHint(); else setTimeout(showHint, 9000);   // sinon, le message apparaît dès que le tas est posé
  }
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(hero); else window.addEventListener('resize', layout);
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
    visible = en[0].isIntersecting; if (visible) wake(); else running = false;
  }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else wake(); });

  var go = function () { layout(); start(); };
  var fontsReady = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load('40px "Paytone One"'), new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
  fontsReady.then(go, go);
})();
