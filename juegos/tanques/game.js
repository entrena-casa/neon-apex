// TANQUES REBOTE — laberinto aleatorio cada ronda, balas que rebotan, un impacto = fuera.
import { $, clamp, lerp, rnd, irnd, pick, dist, wrapA, COLORS, store, toast, big, setupCanvas, loop, down, hit, pad, touchControls, usingTouch, goFull, sfx, SONGS, Particles, neon, glowDot, Room, lobby, backButton, seg } from '../../comun/lib.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(1000);
backButton();
const touch = touchControls({ left: 'stick', right: 'stick' });
const room = new Room('tanques', 6);
let diff = store.get('tanques.diff', 1);
seg($('sDiff'), diff, v => { diff = v; store.set('tanques.diff', v); });
const prog = () => store.get('tanques.prog', { lvl: 1, wins: 0 });
const showBest = () => { const p = prog(); $('best').innerHTML = `🎯 Misión actual: <b style="color:var(--cyan)">${p.lvl}/20</b> · 🏆 Batallas ganadas: <b style="color:var(--gold)">${p.wins}</b>`; };
showBest();

// ================== LABERINTO ==================
const CELL = 150, T = 10;
let COLS = 9, ROWS = 6, MW = COLS * CELL, MH = ROWS * CELL, WALLS = [];
function genMaze(seed) {
  let s = seed >>> 0; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  COLS = 7 + Math.floor(R() * 4); ROWS = 5 + Math.floor(R() * 2); MW = COLS * CELL; MH = ROWS * CELL;
  const right = [], bottom = [], seen = [];
  for (let i = 0; i < COLS * ROWS; i++) { right.push(true); bottom.push(true); seen.push(false); }
  const st = [0]; seen[0] = true;
  while (st.length) {
    const c = st[st.length - 1], x = c % COLS, y = (c / COLS) | 0, nb = [];
    if (x > 0 && !seen[c - 1]) nb.push(c - 1); if (x < COLS - 1 && !seen[c + 1]) nb.push(c + 1);
    if (y > 0 && !seen[c - COLS]) nb.push(c - COLS); if (y < ROWS - 1 && !seen[c + COLS]) nb.push(c + COLS);
    if (!nb.length) { st.pop(); continue; }
    const n = nb[Math.floor(R() * nb.length)];
    if (n === c + 1) right[c] = false; else if (n === c - 1) right[n] = false; else if (n === c + COLS) bottom[c] = false; else bottom[n] = false;
    seen[n] = true; st.push(n);
  }
  for (let i = 0; i < COLS * ROWS; i++) { if (R() < 0.38) right[i] = false; if (R() < 0.38) bottom[i] = false; }
  const W = [[-T, -T, MW + 2 * T, T], [-T, MH, MW + 2 * T, T], [-T, 0, T, MH], [MW, 0, T, MH]];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = y * COLS + x;
    if (x < COLS - 1 && right[c]) W.push([(x + 1) * CELL - T / 2, y * CELL - T / 2, T, CELL + T]);
    if (y < ROWS - 1 && bottom[c]) W.push([x * CELL - T / 2, (y + 1) * CELL - T / 2, CELL + T, T]);
  }
  WALLS = W; return { right, bottom };
}
let MAZE = null;
const inWall = (x, y, pad = 0) => { for (const w of WALLS) if (x > w[0] - pad && x < w[0] + w[2] + pad && y > w[1] - pad && y < w[1] + w[3] + pad) return w; return null; };
function circleWall(o, r) {
  for (const w of WALLS) {
    const cx = clamp(o.x, w[0], w[0] + w[2]), cy = clamp(o.y, w[1], w[1] + w[3]);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.y += dy * k; }
  }
}
// camino por la rejilla (BFS) para los bots
function cellOf(x, y) { return clamp(Math.floor(y / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1); }
function open(a, b) { const { right, bottom } = MAZE; if (b === a + 1) return !right[a]; if (b === a - 1) return !right[b]; if (b === a + COLS) return !bottom[a]; if (b === a - COLS) return !bottom[b]; return false; }
function nextCell(from, to) {
  if (from === to) return to; const prev = new Map([[from, -1]]), q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; const x = c % COLS; for (const n of [c + 1, c - 1, c + COLS, c - COLS]) { if (n < 0 || n >= COLS * ROWS || prev.has(n)) continue; if ((n === c + 1 && x === COLS - 1) || (n === c - 1 && x === 0)) continue; if (open(c, n)) { prev.set(n, c); q.push(n); } } }
  if (!prev.has(to)) return to; let c = to; while (prev.get(c) !== from && prev.get(c) !== -1) c = prev.get(c); return c;
}
const cellCenter = c => [(c % COLS + 0.5) * CELL, (Math.floor(c / COLS) + 0.5) * CELL];
// trayectoria de una bala con rebotes (para que los bots apunten y esquiven)
function traceShot(x, y, a, maxLen = 1100, step = 9) {
  let vx = Math.cos(a) * step, vy = Math.sin(a) * step; const pts = [];
  for (let i = 0; i < maxLen / step; i++) {
    const nx = x + vx, ny = y + vy;
    if (inWall(nx, ny)) { if (!inWall(nx, y)) vy = -vy; else if (!inWall(x, ny)) vx = -vx; else { vx = -vx; vy = -vy; } } else { x = nx; y = ny; }
    pts.push(x, y);
  }
  return pts;
}

// ================== ESTADO ==================
const PICK = { triple: { col: '#ffd200', ic: '⋔' }, rapida: { col: '#ff8a1a', ic: '»' }, escudo: { col: '#39ff88', ic: '◯' }, guia: { col: '#00f0ff', ic: '⌖' } };
let G = null, view = null, myId = 'me', screen = 'menu', paused = false;
const BOTN = ['ACERO', 'RUBÍ', 'JADE', 'ÓNIX', 'TOPO', 'RAYO'];
function newTank(p, i) { return { id: p.id, name: p.name, color: p.color || COLORS[i % COLORS.length], bot: p.bot ? { skill: p.skill ?? [0.35, 0.6, 0.85][diff], t: 0, aimT: 0, tx: 0, ty: 0, dodge: 0 } : null, x: 0, y: 0, a: 0, ta: 0, alive: true, pts: 0, shield: 0, pw: null, pwN: 0, cd: 0, inp: { mx: 0, my: 0, ax: 1, ay: 0, aim: false, fire: false }, vx: 0, vy: 0 }; }
function newMatch(mode, players, lvl) {
  G = { mode, lvl: lvl || 0, round: 0, t: 0, tanks: players.map(newTank), b: [], p: [], over: false, roundT: 0, pickT: 5, goal: 5, ev: [], seed: 0, msg: '' };
  newRound();
}
function newRound() {
  G.round++; G.seed = (Math.random() * 1e9) | 0; MAZE = genMaze(G.seed); G.b = []; G.p = []; G.roundT = 0; G.pickT = 4;
  const cells = []; for (let i = 0; i < COLS * ROWS; i++) cells.push(i);
  const corners = [0, COLS - 1, COLS * ROWS - 1, COLS * (ROWS - 1), Math.floor(COLS / 2), COLS * ROWS - 1 - Math.floor(COLS / 2)];
  G.tanks.forEach((t, i) => { const c = corners[i % corners.length]; const [x, y] = cellCenter(c); t.x = x; t.y = y; t.a = t.ta = Math.atan2(MH / 2 - y, MW / 2 - x); t.alive = true; t.shield = 0; t.pw = null; t.cd = 0.6; t.vx = t.vy = 0; });
  G.ev.push(['r', 0, 0, '', G.round]); roundFx(G.round);
}
function roundFx(n) { big(G && G.mode === 'mission' ? 'MISIÓN ' + G.lvl : 'RONDA ' + n, '#00f0ff', 1100); sfx.play('go'); }
function ev(type, x, y, c, ex) { G.ev.push([type, Math.round(x), Math.round(y), c, ex || 0]); playEv([type, x, y, c, ex]); }
function shoot(t) {
  const mine = G.b.filter(b => b.o === t.id).length; if (mine >= 5) return;
  const angs = t.pw === 'triple' ? [-0.2, 0, 0.2] : [0];
  for (const da of angs) { const a = t.ta + da; G.b.push({ x: t.x + Math.cos(a) * 26, y: t.y + Math.sin(a) * 26, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, o: t.id, c: t.color, life: 7, safe: 0.12, bounces: 0 }); }
  if (t.pw === 'triple' || t.pw === 'rapida') { t.pwN--; if (t.pwN <= 0) t.pw = null; }
  t.cd = t.pw === 'rapida' ? 0.12 : 0.32; ev('s', t.x + Math.cos(t.ta) * 26, t.y + Math.sin(t.ta) * 26, t.color);
}
function kill(t, by) {
  if (t.shield > 0) { t.shield = 0; ev('sh', t.x, t.y, '#39ff88'); return false; }
  t.alive = false; ev('x', t.x, t.y, t.color);
  return true;
}
function botThink(t, dt) {
  const B = t.bot, inp = t.inp; B.t -= dt; B.aimT -= dt; inp.fire = false;
  const foes = G.tanks.filter(o => o.alive && o !== t && !(G.mode === 'mission' && o.bot));
  if (!foes.length) { inp.mx = inp.my = 0; return; }
  let tgt = foes[0], td = 1e9; for (const o of foes) { const d = dist(t.x, t.y, o.x, o.y); if (d < td) { td = d; tgt = o; } }
  // esquivar: ¿alguna bala viene hacia mí?
  let threat = null;
  for (const b of G.b) { const rx = t.x - b.x, ry = t.y - b.y, sp = Math.hypot(b.vx, b.vy), along = (rx * b.vx + ry * b.vy) / sp; if (along > 0 && along < 260 * B.skill + 60) { const perp = Math.abs(rx * b.vy - ry * b.vx) / sp; if (perp < 34) { threat = b; break; } } }
  if (threat && B.skill > 0.3 && Math.random() < B.skill) { const s = Math.sign((t.x - threat.x) * threat.vy - (t.y - threat.y) * threat.vx) || 1; inp.mx = threat.vy / 430 * s; inp.my = -threat.vx / 430 * s; B.dodge = 0.25; }
  else if (B.dodge > 0) B.dodge -= dt;
  else {
    const here = cellOf(t.x, t.y), nc = nextCell(here, cellOf(tgt.x, tgt.y)); const [cx, cy] = cellCenter(nc);
    const keep = td < 170 && B.skill > 0.5; const dx = (keep ? t.x - tgt.x : cx - t.x), dy = (keep ? t.y - tgt.y : cy - t.y), m = Math.hypot(dx, dy) || 1;
    inp.mx = dx / m; inp.my = dy / m;
  }
  // apuntar: prueba ángulos con rebotes y elige uno que dé al objetivo sin darse a sí mismo
  if (B.aimT <= 0) {
    B.aimT = lerp(0.9, 0.18, B.skill);
    const direct = Math.atan2(tgt.y - t.y, tgt.x - t.x); let best = null;
    const N = Math.round(6 + B.skill * 30);
    for (let i = 0; i < N; i++) {
      const a = i === 0 ? direct : rnd(-Math.PI, Math.PI); const pts = traceShot(t.x + Math.cos(a) * 26, t.y + Math.sin(a) * 26, a, 300 + B.skill * 900);
      let hitT = -1, self = false;
      for (let k = 0; k < pts.length; k += 2) { if (k > 12 && dist(pts[k], pts[k + 1], t.x, t.y) < 22) { self = true; break; } if (dist(pts[k], pts[k + 1], tgt.x, tgt.y) < 18) { hitT = k; break; } }
      if (hitT >= 0 && !self && (!best || hitT < best.k)) best = { a, k: hitT };
    }
    if (best) { B.want = best.a; B.fireIn = rnd(0.05, 0.4) * (1.3 - B.skill); } else { B.want = direct; B.fireIn = null; }
  }
  if (B.want != null) { inp.ax = Math.cos(B.want); inp.ay = Math.sin(B.want); inp.aim = true; }
  if (B.fireIn != null) { B.fireIn -= dt; if (B.fireIn <= 0 && Math.abs(wrapA(t.ta - B.want)) < 0.08) { inp.fire = true; B.fireIn = null; B.aimT = 0.25; } }
}
function step(dt) {
  if (!G || G.over) return;
  G.t += dt; G.ev.length = 0;
  const me = G.tanks.find(t => t.id === myId); if (me && !me.bot) Object.assign(me.inp, readInput(me));
  for (const t of G.tanks) {
    if (!t.alive) continue;
    if (t.bot) botThink(t, dt);
    const inp = t.inp; t.cd -= dt; t.shield -= dt;
    const m = Math.hypot(inp.mx, inp.my);
    if (m > 0.2) {
      const want = Math.atan2(inp.my, inp.mx); let d = wrapA(want - t.a);
      // si el destino está detrás, ir marcha atrás
      let rev = 1; if (Math.abs(d) > Math.PI * 0.62) { d = wrapA(d + Math.PI); rev = -1; }
      t.a += clamp(d, -dt * 5.5, dt * 5.5);
      const sp = 175 * Math.min(1, m) * Math.max(0, Math.cos(d)) * rev; t.x += Math.cos(t.a) * sp * dt; t.y += Math.sin(t.a) * sp * dt;
      if (Math.random() < 0.3) fx.emit(t.x - Math.cos(t.a) * 18 * rev, t.y - Math.sin(t.a) * 18 * rev, 1, '#3b2a6a', 20, 0.6, 4);
    }
    circleWall(t, 17);
    const aimA = inp.aim ? Math.atan2(inp.ay, inp.ax) : t.a;
    t.ta += clamp(wrapA(aimA - t.ta), -dt * 9, dt * 9);
    if (inp.fire && t.cd <= 0) shoot(t);
    for (let i = G.p.length - 1; i >= 0; i--) { const p = G.p[i]; if (dist(t.x, t.y, p.x, p.y) < 30) { G.p.splice(i, 1); if (p.k === 'escudo') t.shield = 10; else { t.pw = p.k; t.pwN = p.k === 'guia' ? 999 : p.k === 'rapida' ? 8 : 3; if (p.k === 'guia') t.guiaT = 12; } ev('p', p.x, p.y, PICK[p.k].col); } }
    if (t.pw === 'guia') { t.guiaT -= dt; if (t.guiaT <= 0) t.pw = null; }
  }
  // tanques chocan entre sí
  for (let i = 0; i < G.tanks.length; i++) for (let j = i + 1; j < G.tanks.length; j++) { const a = G.tanks[i], b = G.tanks[j]; if (!a.alive || !b.alive) continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < 34 && d > 0.01) { const k = (34 - d) / d * 0.5; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; } }
  // balas con rebote
  for (let i = G.b.length - 1; i >= 0; i--) {
    const b = G.b[i]; b.life -= dt; b.safe -= dt; let dead = b.life <= 0;
    const sub = 3; for (let s = 0; s < sub && !dead; s++) {
      const nx = b.x + b.vx * dt / sub, ny = b.y + b.vy * dt / sub;
      if (inWall(nx, ny)) { if (!inWall(nx, b.y)) b.vy = -b.vy; else if (!inWall(b.x, ny)) b.vx = -b.vx; else { b.vx = -b.vx; b.vy = -b.vy; } b.bounces++; ev('b', b.x, b.y, b.c); }
      else { b.x = nx; b.y = ny; }
      for (const t of G.tanks) { if (!t.alive) continue; if (t.id === b.o && b.safe > 0) continue; if (dist(b.x, b.y, t.x, t.y) < 19) { dead = true; if (kill(t, b.o)) { const k = G.tanks.find(o => o.id === b.o); G.lastKill = k ? k.name : ''; } break; } }
    }
    if (dead) G.b.splice(i, 1);
  }
  // choque de balas entre sí
  for (let i = 0; i < G.b.length; i++) for (let j = i + 1; j < G.b.length; j++) { const a = G.b[i], c = G.b[j]; if (a.o !== c.o && Math.abs(a.x - c.x) < 7 && Math.abs(a.y - c.y) < 7) { ev('b', a.x, a.y, '#fff'); a.life = c.life = 0; } }
  G.pickT -= dt; if (G.pickT <= 0 && G.p.length < 3) { G.pickT = rnd(5, 9); const c = irnd(0, COLS * ROWS - 1); const [x, y] = cellCenter(c); G.p.push({ x, y, k: pick(Object.keys(PICK)) }); }
  // fin de ronda
  const alive = G.tanks.filter(t => t.alive);
  const humansAlive = alive.filter(t => !t.bot).length, botsAlive = alive.filter(t => t.bot).length;
  const done = G.mode === 'mission' ? (humansAlive === 0 || botsAlive === 0) : alive.length <= 1;
  if (done) {
    G.roundT += dt;
    if (G.roundT > 2.2) {
      if (G.mode === 'mission') return endMatch(humansAlive > 0);
      const w = alive[0]; if (w) { w.pts++; G.ev.push(['w', 0, 0, w.color, w.name]); }
      if (w && w.pts >= G.goal) return endMatch(w); newRound();
    }
  }
}
function endMatch(w) {
  G.over = true;
  const res = { mode: G.mode, lvl: G.lvl, win: G.mode === 'mission' ? !!w : w.id, winName: w && w.name, rows: [...G.tanks].sort((a, b) => b.pts - a.pts).map(t => [t.name, t.color, t.pts, t.id]) };
  if (room.isHost) room.broadcast({ t: 'end', res }); showEnd(res);
}

// ================== ENTRADA ==================
let mouse = { x: 0, y: 0, down: false, moved: false };
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; });
cv.addEventListener('mousedown', () => { mouse.down = true; }); addEventListener('mouseup', () => { mouse.down = false; });
function readInput(meT) {
  const o = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, fire: false };
  o.mx = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0); o.my = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  if (meT && mouse.moved && !usingTouch()) { const s = toScreen(meT.x, meT.y); o.ax = mouse.x - s.x; o.ay = mouse.y - s.y; o.aim = true; }
  o.fire = mouse.down || down('Space', 'Enter', 'KeyJ');
  const g = pad(); if (g) { if (g.lx || g.ly) { o.mx = g.lx; o.my = g.ly; } if (Math.hypot(g.rx, g.ry) > 0.4) { o.ax = g.rx; o.ay = g.ry; o.aim = true; } if (g.a || g.rt > 0.3 || g.rb) o.fire = true; }
  if (touch.la) { o.mx = touch.lx; o.my = touch.ly; }
  if (touch.ra) { if (Math.hypot(touch.rx, touch.ry) > 0.25) { o.ax = touch.rx; o.ay = touch.ry; o.aim = true; } touch.wasR = true; }
  else if (touch.wasR) { o.fire = true; touch.wasR = false; } // suelta el joystick derecho = dispara
  if (touch.ra && Math.hypot(touch.rx, touch.ry) > 0.9) o.fire = true;
  return o;
}

// ================== RED ==================
let sendT = 0;
room.onMsg = (from, d) => {
  if (room.isHost) { if (d.t === 'in' && G) { const t = G.tanks.find(t => t.id === from); if (t) { const f = t.inp.fire || d.i.fire; Object.assign(t.inp, d.i); t.inp.fire = f; } } return; }
  if (d.t === 'snap') applySnap(d); else if (d.t === 'end') showEnd(d.res);
};
room.onStart = cfg => startPlay(cfg.mode, cfg.players);
room.onLeave = id => { if (id === 'host' && screen === 'play') { toast('El anfitrión se ha ido'); toMenu(); } else if (G) { const t = G.tanks.find(t => t.id === id); if (t) t.alive = false; } };
let lastSeed = -1;
function snap() {
  const R = v => Math.round(v);
  return { t: 'snap', sd: G.seed, rd: G.round, g: G.goal, tk: G.tanks.map(t => [t.id, t.name, t.color, R(t.x), R(t.y), +t.a.toFixed(2), +t.ta.toFixed(2), t.alive ? 1 : 0, t.pts, t.shield > 0 ? 1 : 0, t.pw || '']), b: G.b.map(b => [R(b.x), R(b.y), R(b.vx), R(b.vy), b.c]), p: G.p.map(p => [R(p.x), R(p.y), p.k]), e: G.ev.slice(0, 30) };
}
function applySnap(d) {
  if (d.sd !== lastSeed) { lastSeed = d.sd; MAZE = genMaze(d.sd); }
  const old = view ? new Map(view.tanks.map(t => [t.id, t])) : new Map();
  view = { round: d.rd, goal: d.g, mode: 'battle', tanks: d.tk.map(a => { const o = old.get(a[0]); return { id: a[0], name: a[1], color: a[2], tx: a[3], ty: a[4], x: o ? o.x : a[3], y: o ? o.y : a[4], a: a[5], ta: a[6], alive: !!a[7], pts: a[8], shield: a[9], pw: a[10] }; }), b: d.b.map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], c: a[4] })), p: d.p.map(a => ({ x: a[0], y: a[1], k: a[2] })) };
  for (const e of d.e) playEv(e);
}
let shake = 0;
function playEv(e) {
  const [ty, x, y, c, ex] = e;
  if (ty === 's') { fx.emit(x, y, 6, c, 160, 0.2, 3); sfx.play('shoot'); }
  else if (ty === 'b') { fx.emit(x, y, 3, c, 90, 0.2, 2); sfx.play('bounce'); }
  else if (ty === 'x') { fx.emit(x, y, 70, c, 420, 1, 6); fx.emit(x, y, 30, '#fff', 300, 0.5, 3); fx.ring(x, y, c, 120); sfx.play('boom'); shake = 14; }
  else if (ty === 'p') { fx.ring(x, y, c, 50); sfx.play('power'); }
  else if (ty === 'sh') { fx.ring(x, y, c, 60); sfx.play('hit'); }
  else if (ty === 'r') { if (room.online && !room.isHost) roundFx(ex); }
  else if (ty === 'w') { big('¡' + ex + '!', c, 1600); sfx.play('win'); }
}

// ================== DIBUJO ==================
const cam = { z: 1, x: 0, y: 0 };
const toScreen = (x, y) => ({ x: (x - cam.x) * cam.z + S.W / 2, y: (y - cam.y) * cam.z + S.H / 2 });
function draw(dt, t) {
  const V = room.online && !room.isHost ? view : G;
  ctx.fillStyle = '#05010f'; ctx.fillRect(0, 0, S.W, S.H);
  if (!V || !MAZE) return;
  const topPad = 46, z = Math.min(S.W / (MW + 40), (S.H - topPad) / (MH + 40)); cam.z = z; cam.x = MW / 2; cam.y = MH / 2 - topPad / 2 / z;
  shake *= Math.exp(-9 * dt);
  ctx.save(); ctx.translate(S.W / 2 + rnd(-shake, shake), S.H / 2 + rnd(-shake, shake)); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  ctx.fillStyle = '#0b0424'; ctx.fillRect(0, 0, MW, MH);
  ctx.strokeStyle = '#1a0a3e'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 0; x <= MW; x += CELL / 2) { ctx.moveTo(x, 0); ctx.lineTo(x, MH); } for (let y = 0; y <= MH; y += CELL / 2) { ctx.moveTo(0, y); ctx.lineTo(MW, y); } ctx.stroke();
  ctx.fillStyle = '#0e2a3a'; for (const w of WALLS) ctx.fillRect(w[0], w[1], w[2], w[3]);
  neon(ctx, '#00f0ff', 2.5, () => { for (const w of WALLS) ctx.rect(w[0], w[1], w[2], w[3]); }, 0.8);
  for (const p of V.p) { const P = PICK[p.k], s = 1 + Math.sin(t * 5 + p.x) * 0.15; glowDot(ctx, p.x, p.y, 40, P.col, 0.6); neon(ctx, P.col, 3, () => ctx.rect(p.x - 14 * s, p.y - 14 * s, 28 * s, 28 * s)); ctx.fillStyle = '#fff'; ctx.font = '900 18px Orbitron'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(P.ic, p.x, p.y + 1); }
  // guía láser del jugador
  const me = V.tanks.find(t => t.id === myId);
  if (me && me.alive && me.pw === 'guia') { const pts = traceShot(me.x + Math.cos(me.ta) * 26, me.y + Math.sin(me.ta) * 26, me.ta, 900, 12); ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#00f0ff'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(me.x, me.y); for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); ctx.restore(); }
  for (const b of V.b) { if (V !== G) { b.x += b.vx * dt; b.y += b.vy * dt; } glowDot(ctx, b.x, b.y, 16, b.c, 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, 7); ctx.fill(); }
  for (const k of V.tanks) { if (V !== G) { k.x = lerp(k.x, k.tx, 1 - Math.exp(-18 * dt)); k.y = lerp(k.y, k.ty, 1 - Math.exp(-18 * dt)); } if (k.alive) drawTank(k, t, k.id === myId); }
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
  // marcador
  ctx.font = '900 14px Orbitron'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  const sc = V.tanks.map(k => ({ k, txt: `${k.name} ${G && G.mode === 'mission' ? '' : k.pts}` }));
  let total = sc.reduce((s, o) => s + ctx.measureText(o.txt).width + 26, 0), x = S.W / 2 - total / 2 + 30;
  for (const o of sc) { const w = ctx.measureText(o.txt).width + 26; ctx.globalAlpha = o.k.alive ? 1 : 0.35; ctx.fillStyle = o.k.color; ctx.fillText(o.txt, x + w / 2 - 13, 14); x += w; }
  ctx.globalAlpha = 1;
  if (G && G.mode === 'mission') { ctx.fillStyle = '#b9a8e8'; ctx.font = '700 11px Orbitron'; ctx.fillText('MISIÓN ' + G.lvl + ' / 20', S.W / 2, 34); }
}
function drawTank(k, t, isMe) {
  ctx.save(); ctx.translate(k.x, k.y);
  glowDot(ctx, 0, 0, 46, k.color, 0.35);
  if (k.shield > 0) neon(ctx, '#39ff88', 2, () => ctx.arc(0, 0, 27 + Math.sin(t * 8) * 2, 0, 7));
  ctx.rotate(k.a);
  ctx.fillStyle = '#05010f'; ctx.fillRect(-17, -14, 34, 28);
  neon(ctx, k.color, 2.5, () => { ctx.rect(-17, -14, 34, 28); ctx.moveTo(-19, -16); ctx.lineTo(19, -16); ctx.moveTo(-19, 16); ctx.lineTo(19, 16); });
  ctx.rotate(k.ta - k.a);
  neon(ctx, '#ffffff', 3, () => { ctx.moveTo(0, 0); ctx.lineTo(26, 0); }, 0.6);
  ctx.fillStyle = k.color; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
  ctx.restore();
  if (isMe) { ctx.fillStyle = '#fff'; ctx.font = '700 11px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('TÚ', k.x, k.y - 34); }
}

// ================== FLUJO ==================
function show(id) { for (const s of ['menu', 'lobbyBox', 'over', 'pause']) $(s).classList.toggle('hidden', s !== id); screen = id || 'play'; $('hud').classList.add('hidden'); touch.show(screen === 'play'); }
let last = null;
function soloStart(mode) {
  sfx.ensure(); myId = 'me'; const me = { id: 'me', name: store.get('name', '') || 'TÚ', color: '#00f0ff' };
  if (mode === 'battle') { startPlay('battle', [me, ...[0, 1, 2].map(i => ({ id: 'b' + i, name: BOTN[i], bot: true, color: COLORS[i + 1] }))]); }
  else {
    const L = prog().lvl, n = Math.min(4, 1 + Math.floor((L - 1) / 4)), sk = clamp(0.2 + L * 0.04, 0.2, 0.98);
    startPlay('mission', [me, ...Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: BOTN[i], bot: true, skill: sk, color: ['#ff2a4d', '#ff8a1a', '#9d4dff', '#ffd200'][i] }))], L);
  }
}
function startPlay(mode, players, lvl) {
  last = { mode, players, lvl }; view = null; lastSeed = -1;
  if (!room.online || room.isHost) newMatch(mode, players, lvl); else { G = null; }
  if (room.online) myId = room.myId;
  paused = false; show(null); goFull(); sfx.music(SONGS.drive);
}
function showEnd(res) {
  show('over'); sfx.music(null); const p = prog();
  if (res.mode === 'mission') {
    $('oTitle').textContent = res.win ? '¡MISIÓN ' + res.lvl + ' SUPERADA!' : 'MISIÓN FALLIDA';
    $('oSub').textContent = res.win ? (res.lvl >= 20 ? '¡HAS COMPLETADO TODAS LAS MISIONES!' : 'Siguiente: misión ' + (res.lvl + 1)) : 'Inténtalo otra vez';
    if (res.win) { p.lvl = Math.min(20, Math.max(p.lvl, res.lvl + 1)); sfx.play('win'); } else sfx.play('lose');
    $('oTbl').innerHTML = ''; $('oAgain').textContent = res.win ? 'SIGUIENTE' : 'REINTENTAR';
  } else {
    const won = res.win === myId; $('oTitle').textContent = won ? '¡HAS GANADO!' : 'GANA ' + res.winName; $('oSub').textContent = 'PRIMERO A 5 RONDAS';
    if (won) { p.wins++; sfx.play('win'); } else sfx.play('lose');
    $('oTbl').innerHTML = res.rows.map((r, i) => `<tr class="${r[3] === myId ? 'me' : ''}"><td>${i + 1}</td><td style="color:${r[1]}">${r[0]}</td><td>${r[2]} RONDAS</td></tr>`).join('');
    $('oAgain').textContent = 'OTRA';
  }
  store.set('tanques.prog', p); showBest();
  $('oAgain').classList.toggle('hidden', room.online && !room.isHost);
}
function toMenu() { G = null; view = null; if (room.online) room.leave(); show('menu'); sfx.music(null); }
$('mFFA').onclick = () => soloStart('battle');
$('mWaves').onclick = () => soloStart('mission');
$('mOnline').onclick = () => { sfx.ensure(); show('lobbyBox'); renderLobby(); };
let onBots = 0;
const renderLobby = () => lobby($('lobbyBox'), room, {
  onBack: () => { room.leave(); show('menu'); },
  extra: () => `<div class="opt">TANQUES BOT<div class="seg" id="lbBots"><button data-v="0">0</button><button data-v="1">1</button><button data-v="2">2</button></div></div>`,
  bindExtra: el => seg(el.querySelector('#lbBots'), onBots, v => onBots = v),
  onGo: () => { const ps = room.players.map(p => ({ id: p.id, name: p.name, color: p.color })); for (let i = 0; i < onBots; i++) ps.push({ id: 'b' + i, name: BOTN[i], bot: true }); room.start({ mode: 'battle', players: ps }); },
});
$('oMenu').onclick = toMenu;
$('oAgain').onclick = () => { if (room.online) { if (room.isHost) room.start({ mode: last.mode, players: last.players }); } else soloStart(last.mode); };
$('pRes').onclick = () => { paused = false; show(null); };
$('pMenu').onclick = toMenu;

loop((dt, t) => {
  if (screen === 'play') {
    if (hit('KeyP', 'Escape') && !room.online) { paused = true; show('pause'); }
    if (hit('KeyM')) toast(sfx.toggleMute() ? '🔇 Sonido apagado' : '🔊 Sonido encendido', 1200);
    if (!paused) {
      if (!room.online || room.isHost) { step(dt); if (room.isHost) { sendT -= dt; if (sendT <= 0) { sendT = 1 / 20; room.broadcast(snap()); } } }
      else { sendT -= dt; const i = readInput(view && view.tanks.find(t => t.id === myId)); if (sendT <= 0 || i.fire) { sendT = 1 / 30; room.send({ t: 'in', i }); } }
    }
  }
  draw(dt, t);
});
show('menu');
if (location.hash === '#dbg') window.dbg = { get G() { return G; }, botMe() { const m = G.tanks.find(t => t.id === 'me'); m.bot = { skill: 0.8, t: 0, aimT: 0, dodge: 0 }; } };
