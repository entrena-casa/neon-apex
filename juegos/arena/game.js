// NEON ARENA — tiros cenital. El anfitrión (o tú en solitario) simula; los invitados mandan su mando y pintan lo que llega.
import { $, clamp, lerp, rnd, irnd, pick, dist, wrapA, COLORS, store, toast, big, setupCanvas, loop, down, hit, pad, touchControls, usingTouch, goFull, sfx, SONGS, Particles, neon, glowDot, grid, Room, lobby, backButton, seg } from '../../comun/lib.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(1200);
backButton();
const touch = touchControls({ left: 'stick', right: 'stick', buttons: [{ id: 'dash', label: 'ESQUIVA', color: '#ffd200', right: 18, bottom: 160, size: 64 }] });
const room = new Room('arena', 8);
let diff = store.get('arena.diff', 1);
seg($('sDiff'), diff, v => { diff = v; store.set('arena.diff', v); });
const best = () => { const b = store.get('arena.best', { wave: 0, wins: 0 }); $('best').innerHTML = `🏆 Victorias: <b style="color:var(--gold)">${b.wins}</b> · Mejor oleada: <b style="color:var(--cyan)">${b.wave}</b>`; };
best();

// ================== MAPA ==================
const MW = 2000, MH = 1300;
const WALLS = [
  [-40, -40, MW + 80, 40], [-40, MH, MW + 80, 40], [-40, 0, 40, MH], [MW, 0, 40, MH],
  [460, 260, 260, 34], [1280, 260, 260, 34], [460, 1006, 260, 34], [1280, 1006, 260, 34],
  [300, 560, 34, 180], [1666, 560, 34, 180], [880, 600, 240, 100], [960, 180, 80, 180], [960, 940, 80, 180],
  [640, 520, 40, 40], [1320, 520, 40, 40], [640, 740, 40, 40], [1320, 740, 40, 40],
];
const SPAWNS = [[150, 150], [1850, 1150], [1850, 150], [150, 1150], [1000, 90], [1000, 1210], [120, 650], [1880, 650]];
function circleWall(o, r) {
  for (const w of WALLS) {
    const cx = clamp(o.x, w[0], w[0] + w[2]), cy = clamp(o.y, w[1], w[1] + w[3]);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.0001) { o.y = w[1] - r; continue; }
      const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.y += dy * k;
      const nx = dx / d, ny = dy / d, vn = o.vx * nx + o.vy * ny; if (vn < 0) { o.vx -= vn * nx; o.vy -= vn * ny; }
    }
  }
}
const inWall = (x, y) => WALLS.some(w => x > w[0] && x < w[0] + w[2] && y > w[1] && y < w[1] + w[3]);
function los(ax, ay, bx, by) { const n = Math.ceil(dist(ax, ay, bx, by) / 24); for (let i = 1; i < n; i++) { const t = i / n; if (inWall(lerp(ax, bx, t), lerp(ay, by, t))) return false; } return true; }

// ================== ESTADO ==================
const KINDS = {
  hero: { r: 18, hp: 100, spd: 330, col: null },
  drone: { r: 14, hp: 30, spd: 260, col: '#ff8a1a', melee: 18, score: 10 },
  gunner: { r: 17, hp: 55, spd: 170, col: '#ff2a4d', gun: 1.2, score: 20 },
  tank: { r: 30, hp: 220, spd: 95, col: '#9d4dff', gun: 2.2, spread: 5, score: 50 },
  boss: { r: 60, hp: 1500, spd: 80, col: '#ffd200', gun: 0.5, spread: 9, score: 500 },
};
const WEPS = { basic: { cd: 0.16, n: 1, sp: 0.04, v: 900, dmg: 12, col: null }, triple: { cd: 0.22, n: 3, sp: 0.22, v: 850, dmg: 11 }, laser: { cd: 0.07, n: 1, sp: 0.02, v: 1400, dmg: 8 }, shotgun: { cd: 0.55, n: 7, sp: 0.5, v: 800, dmg: 9 } };
const PICK = { triple: { col: '#ffd200', ic: '⋔' }, laser: { col: '#00f0ff', ic: '≡' }, shotgun: { col: '#ff8a1a', ic: '✷' }, shield: { col: '#39ff88', ic: '◯' }, heal: { col: '#ff2bd6', ic: '+' } };
let G = null;           // partida (simulada aquí si soy anfitrión o estoy solo)
let view = null;        // lo que pinto (si soy invitado, viene del anfitrión)
let myId = 'me', screen = 'menu', paused = false;

function newFighter(id, name, color, kind = 'hero', team = id) {
  const K = KINDS[kind];
  return { id, name, color: color || K.col, kind, team, x: 0, y: 0, vx: 0, vy: 0, a: 0, r: K.r, hp: K.hp, max: K.hp, alive: true, resp: 0, score: 0, kills: 0, deaths: 0, wep: 'basic', wepT: 0, shield: 0, dash: 0, dashCd: 0, fireCd: rnd(0.5), inv: 1.2, inp: { mx: 0, my: 0, ax: 1, ay: 0, fire: false, dash: false }, bot: null };
}
function spawnAt(f) {
  let best = null, bd = -1;
  for (const s of SPAWNS) { let d = 1e9; for (const o of G.f) if (o !== f && o.alive && o.team !== f.team) d = Math.min(d, dist(s[0], s[1], o.x, o.y)); d += rnd(200); if (d > bd) { bd = d; best = s; } }
  f.x = best[0] + rnd(-30, 30); f.y = best[1] + rnd(-30, 30); f.vx = f.vy = 0; f.hp = f.max; f.alive = true; f.inv = 1.5; f.wep = 'basic'; f.wepT = 0;
  fx.ring(f.x, f.y, f.color, 70);
}
function newGame(mode, players) {
  G = { mode, lives: 3 + (players.length - 1), t: 0, f: [], b: [], p: [], feed: [], over: false, wave: 0, waveT: 2.5, pickT: 4, goal: 15, time: mode === 'ffa' ? 240 : 0, ev: [] };
  players.forEach((p, i) => { const f = newFighter(p.id, p.name, p.color || COLORS[i % COLORS.length], 'hero', mode === 'waves' ? 'H' : p.id); f.bot = p.bot || (p.id === 'me' && location.hash === '#dbg') ? { t: 0, tx: 0, ty: 0, skill: [0.45, 0.7, 0.95][diff] } : null; G.f.push(f); spawnAt(f); });
}
const BOTNAMES = ['VOLT', 'KIRA', 'NOVA', 'ZERO', 'RAYO', 'LUNA', 'TITO', 'ECHO'];

// ================== SIMULACIÓN ==================
function feed(txt, col) { G.feed.unshift({ txt, col, t: 4 }); if (G.feed.length > 5) G.feed.pop(); }
function ev(type, x, y, c, extra) { G.ev.push([type, Math.round(x), Math.round(y), c, extra || 0]); playEv([type, x, y, c, extra]); }
function damage(f, dmg, by) {
  if (!f.alive || f.inv > 0) return;
  if (f.shield > 0) { dmg *= 0.35; }
  f.hp -= dmg; ev('h', f.x, f.y, f.color);
  if (f.hp <= 0) {
    f.alive = false; f.deaths++; f.resp = 2.5;
    if (G.mode === 'waves' && f.kind === 'hero') { if (G.lives > 0) { G.lives--; f.resp = 3; feed(`${f.name} cae · quedan ${G.lives} ❤`, '#ff2a4d'); } else f.resp = 1e9; }
    ev('x', f.x, f.y, f.color, f.r);
    const k = G.f.find(o => o.id === by);
    if (k && k !== f) { k.kills++; k.score += f.kind === 'hero' ? 1 : KINDS[f.kind].score; if (f.kind === 'hero' || k.kind === 'hero') feed(`${k.name} ⟶ ${f.kind === 'hero' ? f.name : f.kind.toUpperCase()}`, k.color); }
    if (f.kind !== 'hero') { if (Math.random() < (f.kind === 'boss' ? 1 : f.kind === 'tank' ? 0.6 : 0.12)) dropPick(f.x, f.y); G.f.splice(G.f.indexOf(f), 1); }
  }
}
function dropPick(x, y, k) { G.p.push({ x, y, k: k || pick(Object.keys(PICK)), t: 14 }); }
function fire(f) {
  const W = WEPS[f.kind === 'hero' ? f.wep : 'basic'], K = KINDS[f.kind];
  const n = K.spread || W.n, sp = K.spread ? 0.9 : W.sp, v = f.kind === 'hero' ? W.v : 460, dmg = f.kind === 'hero' ? W.dmg : f.kind === 'boss' ? 12 : 10;
  for (let i = 0; i < n; i++) {
    const a = f.a + (n > 1 ? (i / (n - 1) - 0.5) * sp : 0) + rnd(-0.03, 0.03);
    G.b.push({ x: f.x + Math.cos(f.a) * (f.r + 4), y: f.y + Math.sin(f.a) * (f.r + 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v, o: f.id, team: f.team, c: f.color, dmg, life: 1.4, laser: f.wep === 'laser' && f.kind === 'hero' });
  }
  f.vx -= Math.cos(f.a) * 25; f.vy -= Math.sin(f.a) * 25;
  ev('s', f.x, f.y, f.color, f.kind === 'hero' ? (f.wep === 'laser' ? 1 : 0) : 2);
}
function botThink(f, dt) {
  const B = f.bot; B.t -= dt;
  let tgt = null, td = 1e9;
  for (const o of G.f) if (o.alive && o.team !== f.team) { const d = dist(f.x, f.y, o.x, o.y); if (d < td) { td = d; tgt = o; } }
  const inp = f.inp; inp.fire = false; inp.dash = false;
  if (!tgt) { inp.mx = inp.my = 0; return; }
  const see = los(f.x, f.y, tgt.x, tgt.y);
  // apuntar con adelanto y error
  const tt = td / 900, px = tgt.x + tgt.vx * tt * B.skill, py = tgt.y + tgt.vy * tt * B.skill;
  const err = (1 - B.skill) * 0.35;
  const want = Math.atan2(py - f.y, px - f.x) + Math.sin(G.t * 3 + f.x) * err;
  inp.ax = Math.cos(want); inp.ay = Math.sin(want);
  if (see && td < 900) inp.fire = true;
  if (B.t <= 0) {
    B.t = rnd(0.4, 1.1);
    let near = null; for (const p of G.p) if (dist(f.x, f.y, p.x, p.y) < 380) near = p;
    if (near && Math.random() < 0.7) { B.tx = near.x; B.ty = near.y; }
    else if (!see || td > 600) { B.tx = tgt.x + rnd(-120, 120); B.ty = tgt.y + rnd(-120, 120); }
    else { const side = Math.random() < 0.5 ? 1 : -1, a = Math.atan2(tgt.y - f.y, tgt.x - f.x) + side * Math.PI / 2 + (td < 260 ? side * 0.6 : 0); B.tx = f.x + Math.cos(a) * 220; B.ty = f.y + Math.sin(a) * 220; }
  }
  const dx = B.tx - f.x, dy = B.ty - f.y, d = Math.hypot(dx, dy);
  inp.mx = d > 20 ? dx / d : 0; inp.my = d > 20 ? dy / d : 0;
  if (Math.hypot(f.vx, f.vy) < 40 && d > 40) { B.tx = f.x + rnd(-300, 300); B.ty = f.y + rnd(-300, 300); }
  // esquivar balas cercanas
  if (f.dashCd <= 0 && B.skill > 0.6) for (const b of G.b) if (b.team !== f.team && dist(b.x, b.y, f.x, f.y) < 90) { inp.dash = Math.random() < B.skill * 0.08; break; }
}
function enemyThink(f, dt) {
  const K = KINDS[f.kind]; let tgt = null, td = 1e9;
  for (const o of G.f) if (o.alive && o.team === 'H') { const d = dist(f.x, f.y, o.x, o.y); if (d < td) { td = d; tgt = o; } }
  const inp = f.inp; inp.fire = false;
  if (!tgt) { inp.mx = inp.my = 0; return; }
  const a = Math.atan2(tgt.y - f.y, tgt.x - f.x); inp.ax = Math.cos(a); inp.ay = Math.sin(a);
  const keep = f.kind === 'drone' ? 0 : f.kind === 'gunner' ? 330 : 200;
  const s = td > keep ? 1 : -0.4, side = Math.sin(G.t * 0.9 + f.x * 0.01) * (f.kind === 'gunner' ? 0.8 : 0.3);
  inp.mx = Math.cos(a) * s - Math.sin(a) * side; inp.my = Math.sin(a) * s + Math.cos(a) * side;
  if (K.gun && td < 800 && los(f.x, f.y, tgt.x, tgt.y)) inp.fire = true;
  f.meleeCd = (f.meleeCd || 0) - dt;
  if (K.melee && f.meleeCd <= 0 && td < f.r + tgt.r + 6) { damage(tgt, K.melee * [0.5, 0.75, 1][diff], f.id); tgt.inv = Math.max(tgt.inv, 0.3); f.meleeCd = 1.1; f.vx = -Math.cos(a) * 520; f.vy = -Math.sin(a) * 520; tgt.vx += Math.cos(a) * 300; tgt.vy += Math.sin(a) * 300; }
}
function spawnWave() {
  G.wave++; const w = G.wave, n = G.f.filter(f => f.kind === 'hero').length;
  const list = [];
  if (w % 5 === 0) list.push('boss');
  const m = 1 + (n - 1) * 0.6;
  for (let i = 0; i < Math.round((3 + w * 1.6) * m); i++) list.push(w > 2 && Math.random() < 0.35 ? 'gunner' : w > 4 && Math.random() < 0.15 ? 'tank' : 'drone');
  list.forEach((k, i) => {
    const e = newFighter('e' + G.t.toFixed(2) + i, k, null, k, 'E');
    const hm = 1 + w * 0.06; e.hp = e.max = Math.round(KINDS[k].hp * hm * (k === 'boss' ? m : 1));
    const s = pick(SPAWNS); e.x = s[0] + rnd(-60, 60); e.y = s[1] + rnd(-60, 60); e.inv = 0.6; G.f.push(e);
  });
  big(w % 5 === 0 ? '¡JEFE!' : 'OLEADA ' + w, w % 5 === 0 ? '#ffd200' : '#00f0ff', 1500); sfx.play(w % 5 === 0 ? 'power' : 'beep');
  G.ev.push(['v', 0, 0, '', w]);
}
function step(dt) {
  if (!G || G.over) return;
  G.t += dt; G.ev.length = 0;
  for (const f of G.feed) f.t -= dt; G.feed = G.feed.filter(f => f.t > 0);
  // botones del jugador local
  const me = G.f.find(f => f.id === myId); if (me && !me.bot) Object.assign(me.inp, readInput(me));
  for (const f of [...G.f]) {
    if (!f.alive) { if (f.kind === 'hero') { f.resp -= dt; if (f.resp <= 0 && !(G.mode === 'waves' && G.waveT > 0 && false)) spawnAt(f); } continue; }
    if (f.bot) botThink(f, dt); else if (f.kind !== 'hero') enemyThink(f, dt);
    const K = KINDS[f.kind], inp = f.inp;
    f.inv -= dt; f.shield -= dt; f.dashCd -= dt; f.fireCd -= dt; f.wepT -= dt; if (f.wepT <= 0) f.wep = 'basic';
    let mx = inp.mx, my = inp.my; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    const acc = 9;
    f.vx = lerp(f.vx, mx * K.spd, 1 - Math.exp(-acc * dt)); f.vy = lerp(f.vy, my * K.spd, 1 - Math.exp(-acc * dt));
    if (inp.dash && f.dashCd <= 0 && f.kind === 'hero') { const dm = Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : f.a; f.vx = Math.cos(dm) * 1100; f.vy = Math.sin(dm) * 1100; f.dashCd = 1.1; f.inv = Math.max(f.inv, 0.22); ev('d', f.x, f.y, f.color); }
    f.x += f.vx * dt; f.y += f.vy * dt; circleWall(f, f.r);
    if (Math.hypot(inp.ax, inp.ay) > 0.2) { const ta = Math.atan2(inp.ay, inp.ax); f.a += wrapA(ta - f.a) * Math.min(1, dt * (f.kind === 'hero' ? 30 : 4)); }
    const cd = f.kind === 'hero' ? WEPS[f.wep].cd : K.gun * [1.4, 1, 0.75][diff];
    if (inp.fire && f.fireCd <= 0) { fire(f); f.fireCd = cd; }
    if (f.kind === 'hero') for (let i = G.p.length - 1; i >= 0; i--) { const p = G.p[i]; if (dist(f.x, f.y, p.x, p.y) < f.r + 18) { G.p.splice(i, 1); if (p.k === 'heal') f.hp = Math.min(f.max, f.hp + 45); else if (p.k === 'shield') f.shield = 8; else { f.wep = p.k; f.wepT = 12; } ev('p', p.x, p.y, PICK[p.k].col, p.k); } }
  }
  // separación entre luchadores
  for (let i = 0; i < G.f.length; i++) for (let j = i + 1; j < G.f.length; j++) { const a = G.f[i], b = G.f[j]; if (!a.alive || !b.alive) continue; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), r = a.r + b.r; if (d < r && d > 0.01) { const k = (r - d) / d * 0.5; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; } }
  // balas
  for (let i = G.b.length - 1; i >= 0; i--) {
    const b = G.b[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && inWall(b.x, b.y)) { dead = true; ev('w', b.x, b.y, b.c); }
    if (!dead) for (const f of G.f) { if (!f.alive || f.team === b.team) continue; if (dist(b.x, b.y, f.x, f.y) < f.r + 4) { damage(f, b.dmg, b.o); f.vx += b.vx * 0.06; f.vy += b.vy * 0.06; dead = true; break; } }
    if (dead) G.b.splice(i, 1);
  }
  for (const p of G.p) p.t -= dt; G.p = G.p.filter(p => p.t > 0);
  if (G.mode === 'ffa') {
    G.pickT -= dt; if (G.pickT <= 0 && G.p.length < 6) { G.pickT = rnd(4, 7); let x, y; do { x = rnd(100, MW - 100); y = rnd(100, MH - 100); } while (inWall(x, y)); dropPick(x, y); }
    G.time -= dt;
    const top = [...G.f].sort((a, b) => b.kills - a.kills)[0];
    if (top.kills >= G.goal || G.time <= 0) endGame(top);
  } else {
    const enemies = G.f.filter(f => f.team === 'E').length;
    if (enemies === 0) { G.waveT -= dt; if (G.waveT <= 0) { G.waveT = 4; for (const f of G.f) if (f.kind === 'hero') { if (!f.alive) spawnAt(f); else f.hp = Math.min(f.max, f.hp + 30); } spawnWave(); if (G.wave > 1) dropPick(MW / 2 + rnd(-200, 200), MH / 2 - 200); } }
    if (G.f.filter(f => f.kind === 'hero').every(f => !f.alive && f.resp > 1e8)) endGame(null);
  }
}
function endGame(winner) {
  G.over = true;
  const heroes = G.f.filter(f => f.kind === 'hero').sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const res = { mode: G.mode, wave: G.wave, win: winner ? winner.id : null, winName: winner ? winner.name : '', rows: heroes.map(f => [f.name, f.color, f.kills, f.deaths, f.score, f.id]) };
  if (room.isHost) room.broadcast({ t: 'end', res });
  showEnd(res);
}

// ================== ENTRADA LOCAL ==================
let mouse = { x: 0, y: 0, down: false, r: false };
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => { if (e.button === 2) mouse.r = true; else mouse.down = true; });
addEventListener('mouseup', e => { if (e.button === 2) mouse.r = false; else mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
let lastAim = { x: 1, y: 0 }, usePadAim = false;
function readInput(meF) {
  const o = { mx: 0, my: 0, ax: lastAim.x, ay: lastAim.y, fire: false, dash: false };
  o.mx = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  o.my = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  if (meF && !usingTouch()) { const s = toScreen(meF.x, meF.y); const dx = mouse.x - s.x, dy = mouse.y - s.y, m = Math.hypot(dx, dy) || 1; if (!usePadAim) { o.ax = dx / m; o.ay = dy / m; } }
  o.fire = mouse.down || down('KeyJ', 'Enter'); o.dash = mouse.r || down('ShiftLeft', 'ShiftRight', 'Space');
  const g = pad();
  if (g) {
    if (g.lx || g.ly) { o.mx = g.lx; o.my = g.ly; }
    if (Math.hypot(g.rx, g.ry) > 0.3) { o.ax = g.rx; o.ay = g.ry; o.fire = true; usePadAim = true; }
    if (g.rt > 0.3) o.fire = true; if (g.a || g.lb || g.lt > 0.3) o.dash = true;
  }
  if (touch.la) { o.mx = touch.lx; o.my = touch.ly; }
  if (touch.ra && Math.hypot(touch.rx, touch.ry) > 0.25) { o.ax = touch.rx; o.ay = touch.ry; o.fire = true; }
  if (touch.btn.dash) o.dash = true;
  const m = Math.hypot(o.ax, o.ay); if (m > 0.01) { lastAim = { x: o.ax / m, y: o.ay / m }; o.ax = lastAim.x; o.ay = lastAim.y; }
  return o;
}
addEventListener('mousemove', () => { usePadAim = false; });

// ================== RED ==================
let sendT = 0;
room.onMsg = (from, d) => {
  if (room.isHost) { if (d.t === 'in' && G) { const f = G.f.find(f => f.id === from); if (f) Object.assign(f.inp, d.i); } return; }
  if (d.t === 'snap') applySnap(d);
  else if (d.t === 'end') showEnd(d.res);
};
room.onStart = cfg => { startPlay(cfg.mode, cfg.players); };
room.onLeave = id => { if (id === 'host' && screen === 'play') { toast('El anfitrión se ha ido'); toMenu(); } else if (G) { const f = G.f.find(f => f.id === id); if (f) G.f.splice(G.f.indexOf(f), 1); } };
function snap() {
  const R = v => Math.round(v);
  return { t: 'snap', m: G.mode, tm: Math.ceil(G.time), w: G.wave, g: G.goal, lv: G.lives,
    f: G.f.map(f => [f.id, f.name, f.color, f.kind, R(f.x), R(f.y), +f.a.toFixed(2), Math.max(0, R(f.hp)), f.max, f.alive ? 1 : 0, f.kills, f.deaths, f.score, f.wep, f.shield > 0 ? 1 : 0, f.inv > 0 ? 1 : 0, f.r, R(f.vx), R(f.vy)]),
    b: G.b.slice(-160).map(b => [R(b.x), R(b.y), R(b.vx), R(b.vy), b.c, b.laser ? 1 : 0]),
    p: G.p.map(p => [R(p.x), R(p.y), p.k]), e: G.ev.slice(0, 40), fd: G.feed.map(f => [f.txt, f.col]) };
}
function applySnap(d) {
  const old = view ? new Map(view.f.map(f => [f.id, f])) : new Map();
  view = { mode: d.m, time: d.tm, wave: d.w, goal: d.g, lives: d.lv, b: d.b.map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], c: a[4], laser: a[5] })), p: d.p.map(a => ({ x: a[0], y: a[1], k: a[2] })), feed: d.fd.map(a => ({ txt: a[0], col: a[1] })),
    f: d.f.map(a => { const o = old.get(a[0]); return { id: a[0], name: a[1], color: a[2], kind: a[3], tx: a[4], ty: a[5], x: o ? o.x : a[4], y: o ? o.y : a[5], a: a[6], hp: a[7], max: a[8], alive: !!a[9], kills: a[10], deaths: a[11], score: a[12], wep: a[13], shield: a[14], inv: a[15], r: a[16], vx: a[17], vy: a[18] }; }) };
  for (const e of d.e) playEv(e);
}

// ================== EFECTOS ==================
let shake = 0;
function playEv(e) {
  const [ty, x, y, c, ex] = e;
  if (ty === 's') { fx.emit(x, y, 3, c, 120, 0.15, 3); if (onScreen(x, y)) sfx.play(ex === 1 ? 'laser' : 'shoot'); }
  else if (ty === 'h') { fx.emit(x, y, 8, c, 260, 0.35, 4); if (onScreen(x, y)) sfx.play('hit'); }
  else if (ty === 'x') { fx.emit(x, y, 40 + ex, c, 420, 0.9, 5); fx.emit(x, y, 20, '#ffffff', 300, 0.5, 3); fx.ring(x, y, c, ex * 4); if (onScreen(x, y)) { sfx.play('boom'); shake = Math.min(14, shake + ex * 0.3); } }
  else if (ty === 'w') fx.emit(x, y, 4, c, 160, 0.2, 2);
  else if (ty === 'd') { fx.emit(x, y, 18, c, 200, 0.4, 4); if (onScreen(x, y)) sfx.play('dash'); }
  else if (ty === 'p') { fx.ring(x, y, c, 50); sfx.play('pick'); }
  else if (ty === 'v') { big(ex % 5 === 0 ? '¡JEFE!' : 'OLEADA ' + ex, ex % 5 === 0 ? '#ffd200' : '#00f0ff', 1500); sfx.play(ex % 5 === 0 ? 'power' : 'beep'); }
}
function onScreen(x, y) { const s = toScreen(x, y); return s.x > -50 && s.y > -50 && s.x < S.W + 50 && s.y < S.H + 50; }

// ================== CÁMARA Y DIBUJO ==================
const cam = { x: MW / 2, y: MH / 2, z: 1 };
const toScreen = (x, y) => ({ x: (x - cam.x) * cam.z + S.W / 2, y: (y - cam.y) * cam.z + S.H / 2 });
function draw(dt, t) {
  const V = room.online && !room.isHost ? view : G;
  ctx.fillStyle = '#05010f'; ctx.fillRect(0, 0, S.W, S.H);
  if (!V) { cam.x += dt * 30; grid(ctx, S.W, S.H, cam.x, cam.y, '#1e0a44', 70); return; }
  const me = V.f.find(f => f.id === myId);
  if (me) { cam.x = lerp(cam.x, me.x + (me.vx || 0) * 0.15, 1 - Math.exp(-6 * dt)); cam.y = lerp(cam.y, me.y + (me.vy || 0) * 0.15, 1 - Math.exp(-6 * dt)); }
  cam.z = clamp(Math.min(S.W / 1150, S.H / 760), 0.42, 1.25);
  { const hw = S.W / 2 / cam.z, hh = S.H / 2 / cam.z; cam.x = hw * 2 > MW ? MW / 2 : clamp(cam.x, hw - 40, MW - hw + 40); cam.y = hh * 2 > MH ? MH / 2 : clamp(cam.y, hh - 40, MH - hh + 40); }
  shake *= Math.exp(-8 * dt);
  ctx.save();
  ctx.translate(S.W / 2 + rnd(-shake, shake), S.H / 2 + rnd(-shake, shake)); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  // suelo
  ctx.fillStyle = '#0a0320'; ctx.fillRect(0, 0, MW, MH);
  ctx.strokeStyle = '#1f0c48'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= MW; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, MH); } for (let y = 0; y <= MH; y += 100) { ctx.moveTo(0, y); ctx.lineTo(MW, y); } ctx.stroke();
  glowDot(ctx, MW / 2, MH / 2, 520, '#3a0d6a', 0.35);
  // muros
  for (const w of WALLS) { if (w[0] < 0 || w[1] < 0 || w[0] >= MW || w[1] >= MH) continue; ctx.fillStyle = '#12052e'; ctx.fillRect(w[0], w[1], w[2], w[3]); neon(ctx, '#ff2bd6', 3, () => ctx.rect(w[0], w[1], w[2], w[3])); }
  neon(ctx, '#00f0ff', 5, () => ctx.rect(0, 0, MW, MH));
  // objetos
  for (const p of V.p) { const P = PICK[p.k], s = 1 + Math.sin(t * 5 + p.x) * 0.12; glowDot(ctx, p.x, p.y, 40, P.col, 0.6); neon(ctx, P.col, 3, () => ctx.arc(p.x, p.y, 16 * s, 0, 7)); ctx.fillStyle = '#fff'; ctx.font = '900 18px Orbitron'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(P.ic, p.x, p.y + 1); }
  // balas
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const b of V.b) {
    if (V !== G) { b.x += b.vx * dt; b.y += b.vy * dt; }
    const len = b.laser ? 0.05 : 0.025; ctx.strokeStyle = b.c; ctx.globalAlpha = 0.4; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * len, b.y - b.vy * len); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
  // luchadores
  for (const f of V.f) {
    if (V !== G) { f.x = lerp(f.x, f.tx, 1 - Math.exp(-18 * dt)); f.y = lerp(f.y, f.ty, 1 - Math.exp(-18 * dt)); }
    if (!f.alive) continue;
    drawFighter(f, t, f.id === myId);
  }
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
  // flechas hacia enemigos fuera de pantalla
  if (me && me.alive) for (const f of V.f) {
    if (!f.alive || f === me || (V.mode === 'waves' && f.kind === 'hero')) continue;
    const s = toScreen(f.x, f.y); if (s.x > 0 && s.y > 0 && s.x < S.W && s.y < S.H) continue;
    const a = Math.atan2(s.y - S.H / 2, s.x - S.W / 2), k = Math.min((S.W / 2 - 24) / Math.abs(Math.cos(a) || 1e-6), (S.H / 2 - 24) / Math.abs(Math.sin(a) || 1e-6));
    const x = S.W / 2 + Math.cos(a) * k, y = S.H / 2 + Math.sin(a) * k;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = f.color; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore();
  }
  updateHud(V, me);
}
function drawFighter(f, t, isMe) {
  const blink = f.inv > 0 && Math.floor(t * 20) % 2 === 0; if (blink) return;
  ctx.save(); ctx.translate(f.x, f.y);
  glowDot(ctx, 0, 0, f.r * 2.6, f.color, 0.45);
  if (f.shield > 0) neon(ctx, '#39ff88', 2, () => ctx.arc(0, 0, f.r + 9 + Math.sin(t * 8) * 2, 0, 7));
  ctx.rotate(f.a);
  const r = f.r;
  if (f.kind === 'hero') {
    neon(ctx, f.color, 3, () => { ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r * 0.9, -r * 0.95); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.9, r * 0.95); ctx.closePath(); });
    ctx.fillStyle = f.color + '44'; ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r * 0.9, -r * 0.95); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.9, r * 0.95); ctx.fill();
  } else if (f.kind === 'drone') {
    ctx.rotate(t * 6); neon(ctx, f.color, 3, () => { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.moveTo(r * 0.5, 0); ctx.arc(0, 0, r * 0.5, 0, 7); });
  } else if (f.kind === 'gunner') {
    neon(ctx, f.color, 3, () => { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); } ctx.closePath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.4, 0); });
  } else {
    neon(ctx, f.color, f.kind === 'boss' ? 6 : 4, () => { ctx.rect(-r, -r, r * 2, r * 2); ctx.moveTo(0, 0); ctx.lineTo(r * 1.5, 0); if (f.kind === 'boss') { ctx.moveTo(r * 0.6, 0); ctx.arc(0, 0, r * 0.6, 0, 7); } });
    if (f.kind === 'boss') { ctx.rotate(-t * 2); neon(ctx, '#ff2bd6', 3, () => ctx.arc(0, 0, r * 1.25, 0, 4)); }
  }
  ctx.restore();
  // vida y nombre
  if (f.kind === 'hero' || f.hp < f.max) {
    const w = Math.max(36, f.r * 2.2); ctx.fillStyle = '#0009'; ctx.fillRect(f.x - w / 2, f.y - f.r - 16, w, 5);
    ctx.fillStyle = f.kind === 'hero' ? f.color : '#ff2a4d'; ctx.fillRect(f.x - w / 2, f.y - f.r - 16, w * clamp(f.hp / f.max, 0, 1), 5);
  }
  if (f.kind === 'hero') { ctx.fillStyle = isMe ? '#fff' : f.color; ctx.font = '700 12px Orbitron'; ctx.textAlign = 'center'; ctx.fillText(f.name, f.x, f.y - f.r - 22); }
}
function updateHud(V, me) {
  if (V.mode === 'ffa') { const m = Math.max(0, V.time), mm = Math.floor(m / 60), ss = String(Math.floor(m % 60)).padStart(2, '0'); $('hudTop').innerHTML = `${mm}:${ss}<small>PRIMERO A ${V.goal} BAJAS</small>`; }
  else { const n = V.f.filter(f => f.team === 'E' || (f.kind !== 'hero')).length; $('hudTop').innerHTML = `OLEADA ${V.wave} <span style="color:var(--red)">${'❤'.repeat(Math.max(0, V.lives))}</span><small>${n ? n + ' ENEMIGOS' : 'PREPÁRATE…'}</small>`; }
  const heroes = V.f.filter(f => f.kind === 'hero').sort((a, b) => b.kills - a.kills);
  $('board').innerHTML = heroes.map(f => `<div style="color:${f.color}">${f.name} <b>${V.mode === 'ffa' ? f.kills : f.score}</b></div>`).join('');
  $('feed').innerHTML = V.feed.map(f => `<div style="color:${f.col}">${f.txt}</div>`).join('');
  if (me) {
    $('hpI').style.width = (me.alive ? clamp(me.hp / me.max, 0, 1) * 100 : 0) + '%';
    $('wep').textContent = !me.alive ? 'REAPARECES EN UN MOMENTO…' : me.wep !== 'basic' ? { triple: 'TRIPLE', laser: 'LÁSER', shotgun: 'ESCOPETA' }[me.wep] + (me.shield > 0 ? ' · ESCUDO' : '') : me.shield > 0 ? 'ESCUDO' : '';
  }
}

// ================== FLUJO ==================
function show(id) { for (const s of ['menu', 'lobbyBox', 'over', 'pause']) $(s).classList.toggle('hidden', s !== id); screen = id || 'play'; $('hud').classList.toggle('hidden', screen !== 'play' && screen !== 'pause'); touch.show(screen === 'play'); }
let lastMode = 'ffa', lastPlayers = null;
function soloStart(mode) {
  sfx.ensure(); myId = 'me';
  const ps = [{ id: 'me', name: store.get('name', '') || 'TÚ' }];
  if (mode === 'ffa') for (let i = 0; i < 5; i++) ps.push({ id: 'b' + i, name: BOTNAMES[i], bot: true });
  startPlay(mode, ps);
}
function startPlay(mode, players) {
  lastMode = mode; lastPlayers = players; view = null;
  if (!room.online || room.isHost) { newGame(mode, players); if (mode === 'waves') { G.waveT = 2; } }
  else { G = null; myId = room.myId; }
  if (room.isHost) myId = room.myId;
  paused = false; show(null); goFull(); sfx.music(mode === 'ffa' ? SONGS.hype : SONGS.dark);
  big(mode === 'ffa' ? '¡A POR ELLOS!' : 'AGUANTA', '#ff2bd6', 1300); sfx.play('go');
}
function showEnd(res) {
  show('over'); sfx.music(null);
  const mine = res.rows.find(r => r[5] === myId);
  const b = store.get('arena.best', { wave: 0, wins: 0 });
  if (res.mode === 'ffa') {
    const won = res.win === myId; $('oTitle').textContent = won ? '¡VICTORIA!' : 'GANA ' + res.winName; $('oSub').textContent = mine ? `${mine[2]} BAJAS · ${mine[3]} MUERTES` : '';
    if (won) { b.wins++; sfx.play('win'); } else sfx.play('lose');
    $('oTbl').innerHTML = res.rows.map((r, i) => `<tr class="${r[5] === myId ? 'me' : ''}"><td>${i + 1}</td><td style="color:${r[1]}">${r[0]}</td><td>${r[2]} ⚔</td><td>${r[3]} ☠</td></tr>`).join('');
  } else {
    $('oTitle').textContent = 'OLEADA ' + res.wave; $('oSub').textContent = res.wave > b.wave ? '¡NUEVO RÉCORD!' : 'Mejor: oleada ' + b.wave; b.wave = Math.max(b.wave, res.wave); sfx.play('lose');
    $('oTbl').innerHTML = res.rows.map((r, i) => `<tr class="${r[5] === myId ? 'me' : ''}"><td>${i + 1}</td><td style="color:${r[1]}">${r[0]}</td><td>${r[4]} PTS</td><td>${r[2]} ⚔</td></tr>`).join('');
  }
  store.set('arena.best', b); best();
  $('oAgain').classList.toggle('hidden', room.online && !room.isHost);
}
function toMenu() { G = null; view = null; if (room.online) room.leave(); show('menu'); sfx.music(null); }
$('mFFA').onclick = () => soloStart('ffa');
$('mWaves').onclick = () => soloStart('waves');
$('mOnline').onclick = () => { sfx.ensure(); show('lobbyBox'); renderLobby(); };
let onMode = 'ffa';
const renderLobby = () => lobby($('lobbyBox'), room, {
  onBack: () => { room.leave(); show('menu'); },
  extra: () => `<div class="opt">MODO<div class="seg" id="lbMode"><button data-v="ffa">TODOS CONTRA TODOS</button><button data-v="waves">OLEADAS EN EQUIPO</button></div></div><div class="opt" style="margin-top:8px">BOTS DE RELLENO<div class="seg" id="lbBots"><button data-v="0">0</button><button data-v="2">2</button><button data-v="4">4</button></div></div>`,
  bindExtra: el => { seg(el.querySelector('#lbMode'), onMode, v => onMode = v); seg(el.querySelector('#lbBots'), onBots, v => onBots = v); },
  onGo: () => { const ps = room.players.map(p => ({ id: p.id, name: p.name, color: p.color })); if (onMode === 'ffa') for (let i = 0; i < onBots; i++) ps.push({ id: 'b' + i, name: BOTNAMES[i], bot: true }); room.start({ mode: onMode, players: ps }); },
});
let onBots = 2;
$('oMenu').onclick = toMenu;
$('oAgain').onclick = () => { if (room.online) { if (room.isHost) room.start({ mode: lastMode, players: lastPlayers }); } else soloStart(lastMode); };
$('pRes').onclick = () => { paused = false; show(null); };
$('pMenu').onclick = toMenu;

loop((dt, t) => {
  if (screen === 'play') {
    if (hit('KeyP', 'Escape') && !room.online) { paused = true; show('pause'); }
    if (hit('KeyM')) toast(sfx.toggleMute() ? '🔇 Sonido apagado' : '🔊 Sonido encendido', 1200);
  }
  if (screen === 'play' && !paused) {
    if (!room.online || room.isHost) {
      step(dt);
      if (room.isHost) { sendT -= dt; if (sendT <= 0) { sendT = 1 / 20; room.broadcast(snap()); } }
    } else { sendT -= dt; if (sendT <= 0) { sendT = 1 / 30; const me = view && view.f.find(f => f.id === myId); room.send({ t: 'in', i: readInput(me) }); } }
  } else if (G && G.over) fx.update(0);
  draw(dt, t);
});
show('menu');

if (location.hash === '#dbg') window.dbg = { get G() { return G; } };
