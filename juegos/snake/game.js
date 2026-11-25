// SNAKE ROYALE — serpientes neón: come luz, crece, y si tu cabeza toca otro cuerpo, explotas en luz.
import { $, clamp, lerp, rnd, irnd, pick, dist, wrapA, COLORS, store, toast, big, setupCanvas, loop, down, hit, pad, touchControls, usingTouch, goFull, sfx, SONGS, Particles, glowDot, Room, lobby, backButton, seg } from '../../comun/lib.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(900);
backButton();
const touch = touchControls({ left: 'stick', buttons: [{ id: 'boost', label: 'TURBO', color: '#39ff88', right: 26, bottom: 40, size: 86 }] });
const room = new Room('snake', 8);
let diff = store.get('snake.diff', 1);
seg($('sDiff'), diff, v => { diff = v; store.set('snake.diff', v); });
const showBest = () => { const b = store.get('snake.best', { len: 0, wins: 0 }); $('best').innerHTML = `📏 Récord de largo: <b style="color:var(--green)">${b.len}</b> · 👑 Royales ganados: <b style="color:var(--gold)">${b.wins}</b>`; };
showBest();

const R = 1700;                       // radio del mundo
const ORBC = ['#39ff88', '#00f0ff', '#ff2bd6', '#ffd200', '#ff8a1a', '#9d4dff'];
const NAMES = ['VÍBORA', 'NEÓN', 'KOBRA', 'PITÓN', 'MAMBA', 'BOA', 'ANACONDA', 'SERPI', 'ZIGZAG', 'RAYITA', 'ÑAM', 'GLOTONA', 'FLASH', 'TURBO', 'LAZO'];
const SPACING = 7;
let G = null, view = null, myId = 'me', screen = 'menu', paused = false;

// ================== MUNDO ==================
let orbId = 1;
function addOrb(x, y, v = 1, c) { if (Math.hypot(x, y) > R - 20) return; const o = { id: orbId++, x, y, v, c: c || pick(ORBC) }; G.orbs.set(o.id, o); G.added.push(o); return o; }
function randOrb() { const a = rnd(Math.PI * 2), r = Math.sqrt(Math.random()) * (R - 40); addOrb(Math.cos(a) * r, Math.sin(a) * r, Math.random() < 0.08 ? 3 : 1); }
function newSnake(p, i) {
  const s = { id: p.id, name: p.name, color: p.color || COLORS[i % COLORS.length], bot: p.bot ? { t: 0, want: 0, skill: rnd(0.4, 0.7) + diff * 0.15 } : null, x: 0, y: 0, a: 0, want: 0, len: 30, pts: [], alive: true, boost: false, resp: 0, best: 0, kills: 0, inp: { dir: 0, has: false, turn: 0, boost: false } };
  spawn(s); return s;
}
function spawn(s) {
  let x, y, ok = false;
  for (let k = 0; k < 30 && !ok; k++) { const a = rnd(Math.PI * 2), r = rnd(0, R * 0.8); x = Math.cos(a) * r; y = Math.sin(a) * r; ok = !G || G.snakes.every(o => !o.alive || o === s || dist(x, y, o.x, o.y) > 400); }
  s.x = x; s.y = y; s.a = s.want = rnd(Math.PI * 2); s.len = 30; s.pts = []; s.alive = true; s.boost = false; s.inv = 2;
  for (let i = 0; i < s.len; i++) s.pts.push(x - Math.cos(s.a) * i * SPACING, y - Math.sin(s.a) * i * SPACING);
}
const width = s => 9 + Math.min(16, Math.sqrt(s.len) * 0.9);
function newGame(mode, players) {
  G = { mode, t: 0, time: mode === 'royale' ? 180 : 0, snakes: [], orbs: new Map(), added: [], removed: [], ev: [], over: false, sync: 0 };
  players.forEach((p, i) => G.snakes.push(newSnake(p, i)));
  for (let i = 0; i < 700; i++) randOrb();
}
function ev(type, x, y, c, ex) { G.ev.push([type, Math.round(x), Math.round(y), c, ex || 0]); playEv([type, x, y, c, ex]); }
function die(s, by) {
  if (!s.alive) return; s.alive = false; s.resp = 3;
  for (let i = 0; i < s.pts.length; i += 6) addOrb(s.pts[i] + rnd(-8, 8), s.pts[i + 1] + rnd(-8, 8), 2 + Math.floor(s.len / 120), s.color);
  ev('x', s.x, s.y, s.color, Math.min(60, s.len / 5));
  if (by) { by.kills++; G.feed = `${by.name} ha cortado a ${s.name}`; }
  if (G.mode === 'life' && s.id === myId) endGame();
}
// rejilla de cuerpos para choques rápidos
const CELLG = 60; let bodyGrid = new Map();
function buildGrid() {
  bodyGrid = new Map();
  for (const s of G.snakes) { if (!s.alive) continue; for (let i = 12; i < s.pts.length; i += 4) { const k = ((s.pts[i] / CELLG) | 0) * 10007 + ((s.pts[i + 1] / CELLG) | 0); let b = bodyGrid.get(k); if (!b) bodyGrid.set(k, b = []); b.push(s, s.pts[i], s.pts[i + 1]); } }
}
function bodyNear(x, y, r, self) {
  const cx = (x / CELLG) | 0, cy = (y / CELLG) | 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = bodyGrid.get((cx + i) * 10007 + cy + j); if (!b) continue; for (let k = 0; k < b.length; k += 3) { const o = b[k]; if (o === self) continue; const w = width(o) + r; const dx = b[k + 1] - x, dy = b[k + 2] - y; if (dx * dx + dy * dy < w * w) return o; } }
  return null;
}
function botThink(s, dt) {
  const B = s.bot; B.t -= dt;
  // antenas para no chocar
  const look = 70 + width(s) * 3, dirs = [0, -0.5, 0.5, -1, 1, -1.6, 1.6];
  const danger = a => { for (const d of [look * 0.5, look]) { const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d; if (Math.hypot(x, y) > R - 30) return true; if (bodyNear(x, y, 4, s)) return true; } return false; };
  if (B.t <= 0) {
    B.t = rnd(0.15, 0.4);
    // busca el mejor grupo de luz cercano
    let best = null, bv = 0;
    for (const o of G.orbs.values()) { const d = Math.abs(o.x - s.x) + Math.abs(o.y - s.y); if (d > 600) continue; const v = o.v / (d + 50); if (v > bv) { bv = v; best = o; } }
    B.want = best ? Math.atan2(best.y - s.y, best.x - s.x) : s.a + rnd(-0.5, 0.5);
    // a veces, cortar el paso a alguien cercano
    for (const o of G.snakes) if (o !== s && o.alive && o.len < s.len * 1.5 && dist(s.x, s.y, o.x, o.y) < 260 && Math.random() < B.skill * 0.25) { B.want = Math.atan2(o.y + Math.sin(o.a) * 160 - s.y, o.x + Math.cos(o.a) * 160 - s.x); B.cut = 0.6; }
    if (Math.hypot(s.x, s.y) > R - 250) B.want = Math.atan2(-s.y, -s.x);
  }
  let want = B.want;
  if (Math.random() < B.skill + 0.25 && danger(s.a + clamp(wrapA(want - s.a), -0.5, 0.5))) { for (const d of dirs) { if (!danger(s.a + d)) { want = s.a + d; break; } } }
  s.inp.has = true; s.inp.dir = want; s.inp.boost = (B.cut -= dt) > 0 && s.len > 50;
}
function step(dt) {
  if (!G || G.over) return;
  G.t += dt; G.ev.length = 0;
  const me = G.snakes.find(s => s.id === myId); if (me && !me.bot) Object.assign(me.inp, readInput(me));
  buildGrid();
  for (const s of G.snakes) {
    if (!s.alive) { if (G.mode !== 'life' || s.id !== myId) { s.resp -= dt; if (s.resp <= 0) spawn(s); } continue; }
    if (s.bot) botThink(s, dt);
    s.inv -= dt;
    const inp = s.inp; if (inp.has) s.want = inp.dir; s.want += (inp.turn || 0) * dt * 4;
    const tr = 4.2 - Math.min(1.6, s.len / 400);
    s.a += clamp(wrapA(s.want - s.a), -tr * dt, tr * dt);
    s.boost = inp.boost && s.len > 22;
    const sp = s.boost ? 330 : 175;
    if (s.boost) { s.len -= dt * 9; if (Math.random() < dt * 9) addOrb(s.pts[s.pts.length - 2], s.pts[s.pts.length - 1], 1, s.color); }
    s.x += Math.cos(s.a) * sp * dt; s.y += Math.sin(s.a) * sp * dt;
    // cuerpo: puntos espaciados
    const hx = s.pts[0], hy = s.pts[1];
    if (Math.hypot(s.x - hx, s.y - hy) >= SPACING) s.pts.unshift(s.x, s.y); else { s.pts[0] = s.x; s.pts[1] = s.y; }
    const n = Math.max(10, Math.round(s.len)) * 2; if (s.pts.length > n) s.pts.length = n;
    // comer
    const w = width(s), reach = w + 14;
    for (const o of G.orbs.values()) { if (Math.abs(o.x - s.x) > reach + 30 || Math.abs(o.y - s.y) > reach + 30) continue; const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < reach) { s.len += o.v * 1.2; G.orbs.delete(o.id); G.removed.push(o.id); if (s.id === myId) sfx.play('pick'); } else if (d < reach + 30) { o.x += (s.x - o.x) * dt * 6; o.y += (s.y - o.y) * dt * 6; } }
    s.best = Math.max(s.best, Math.round(s.len));
    // choques
    if (Math.hypot(s.x, s.y) > R) die(s, null);
    else if (s.inv <= 0) { const o = bodyNear(s.x, s.y, w * 0.6, s); if (o) die(s, o); }
  }
  // cabeza contra cabeza: muere la más corta
  for (let i = 0; i < G.snakes.length; i++) for (let j = i + 1; j < G.snakes.length; j++) { const a = G.snakes[i], b = G.snakes[j]; if (a.alive && b.alive && a.inv <= 0 && b.inv <= 0 && dist(a.x, a.y, b.x, b.y) < width(a) + width(b)) { if (a.len < b.len) die(a, b); else die(b, a); } }
  while (G.orbs.size < 650) randOrb();
  if (G.mode === 'royale') { G.time -= dt; if (G.time <= 0) endGame(); }
}
function endGame() {
  G.over = true;
  const rows = [...G.snakes].sort((a, b) => (b.alive ? b.len : 0) - (a.alive ? a.len : 0) || b.best - a.best).map(s => [s.name, s.color, Math.round(s.alive ? s.len : 0), s.best, s.kills, s.id]);
  const res = { mode: G.mode, rows };
  if (room.isHost) room.broadcast({ t: 'end', res }); showEnd(res);
}

// ================== ENTRADA ==================
let mouse = { x: 0, y: 0, down: false, moved: false };
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; });
cv.addEventListener('mousedown', () => mouse.down = true); addEventListener('mouseup', () => mouse.down = false);
function readInput(me) {
  const o = { has: false, dir: 0, turn: 0, boost: false };
  if (mouse.moved && !usingTouch()) { o.has = true; o.dir = Math.atan2(mouse.y - S.H / 2, mouse.x - S.W / 2); }
  const t = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0); if (t) { o.has = false; o.turn = t; mouse.moved = false; }
  const g = pad(); if (g && Math.hypot(g.lx, g.ly) > 0.3) { o.has = true; o.dir = Math.atan2(g.ly, g.lx); } if (g && (g.a || g.rt > 0.3)) o.boost = true;
  if (touch.la && Math.hypot(touch.lx, touch.ly) > 0.2) { o.has = true; o.dir = Math.atan2(touch.ly, touch.lx); }
  if (!o.has && !o.turn && me) { o.has = true; o.dir = me.want ?? me.a; }
  o.boost = o.boost || mouse.down || down('Space', 'ShiftLeft', 'KeyW', 'ArrowUp') || !!touch.btn.boost;
  return o;
}

// ================== RED ==================
let sendT = 0;
room.onMsg = (from, d) => {
  if (room.isHost) { if (d.t === 'in' && G) { const s = G.snakes.find(s => s.id === from); if (s) Object.assign(s.inp, d.i); } return; }
  if (d.t === 'snap') applySnap(d); else if (d.t === 'orbs') applyOrbs(d); else if (d.t === 'end') showEnd(d.res);
};
room.onStart = cfg => startPlay(cfg.mode, cfg.players);
room.onLeave = id => { if (id === 'host' && screen === 'play') { toast('El anfitrión se ha ido'); toMenu(); } else if (G) { const s = G.snakes.find(s => s.id === id); if (s) { die(s); G.snakes.splice(G.snakes.indexOf(s), 1); } } };
function snap(full) {
  const r = v => Math.round(v);
  const m = { t: 'snap', tm: Math.ceil(G.time), md: G.mode, s: G.snakes.map(s => { const p = []; for (let i = 0; i < s.pts.length; i += 4) p.push(r(s.pts[i]), r(s.pts[i + 1])); return [s.id, s.name, s.color, s.alive ? 1 : 0, r(s.len), +s.a.toFixed(2), s.boost ? 1 : 0, p, s.best, s.kills]; }), e: G.ev.slice(0, 30) };
  m.oa = G.added.slice(0, 200).map(o => [o.id, r(o.x), r(o.y), o.v, o.c]); m.or = G.removed;
  G.added = []; G.removed = []; return m;
}
function sendOrbs() {
  const all = [...G.orbs.values()].map(o => [o.id, Math.round(o.x), Math.round(o.y), o.v, o.c]);
  for (let i = 0; i < all.length; i += 150) room.broadcast({ t: 'orbs', reset: i === 0, list: all.slice(i, i + 150) });
}
function applyOrbs(d) {
  if (!view) view = { orbs: new Map(), snakes: [] };
  if (d.reset) view.orbs = new Map();
  for (const a of d.list) view.orbs.set(a[0], { id: a[0], x: a[1], y: a[2], v: a[3], c: a[4] });
}
function applySnap(d) {
  if (!view) view = { orbs: new Map(), snakes: [] };
  for (const a of d.oa) view.orbs.set(a[0], { id: a[0], x: a[1], y: a[2], v: a[3], c: a[4] }); for (const id of d.or) view.orbs.delete(id);
  view.time = d.tm; view.mode = d.md;
  view.snakes = d.s.map(a => ({ id: a[0], name: a[1], color: a[2], alive: !!a[3], len: a[4], a: a[5], boost: a[6], pts: a[7], x: a[7][0], y: a[7][1], best: a[8], kills: a[9], step: 4 }));
  for (const e of d.e) playEv(e);
}
let shake = 0;
function playEv(e) { const [ty, x, y, c, ex] = e; if (ty === 'x') { fx.emit(x, y, 40 + ex, c, 380, 0.9, 5); fx.ring(x, y, c, 80); if (onScreen(x, y)) { sfx.play('boom'); shake = 8; } } }
const cam = { x: 0, y: 0, z: 1 };
const toScreen = (x, y) => ({ x: (x - cam.x) * cam.z + S.W / 2, y: (y - cam.y) * cam.z + S.H / 2 });
const onScreen = (x, y) => { const s = toScreen(x, y); return s.x > -60 && s.y > -60 && s.x < S.W + 60 && s.y < S.H + 60; };

// ================== DIBUJO ==================
function drawSnake(s, t, isMe) {
  const p = s.pts, w = width(s), st = s.step || 2;
  if (p.length < 4) return;
  ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); };
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = s.color; ctx.globalAlpha = s.boost ? 0.35 : 0.18; ctx.lineWidth = w * 2 + 16; path(); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.strokeStyle = '#05010f'; ctx.lineWidth = w * 2 + 2; path(); ctx.stroke();
  ctx.strokeStyle = s.color; ctx.lineWidth = w * 2 - 4; ctx.globalAlpha = 0.55; path(); ctx.stroke();
  // rayas que se mueven
  ctx.globalAlpha = 1; ctx.setLineDash([w * 0.9, w * 1.4]); ctx.lineDashOffset = -t * 60; ctx.strokeStyle = s.color; ctx.lineWidth = w * 1.1; path(); ctx.stroke(); ctx.setLineDash([]);
  // cabeza y ojos
  const a = s.a; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(p[0], p[1], w * 1.05, 0, 7); ctx.fill();
  for (const sd of [-1, 1]) { const ex = p[0] + Math.cos(a + sd * 0.6) * w * 0.55, ey = p[1] + Math.sin(a + sd * 0.6) * w * 0.55; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, w * 0.32, 0, 7); ctx.fill(); ctx.fillStyle = '#05010f'; ctx.beginPath(); ctx.arc(ex + Math.cos(a) * w * 0.12, ey + Math.sin(a) * w * 0.12, w * 0.16, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = isMe ? '#fff' : s.color; ctx.font = '700 12px Orbitron'; ctx.textAlign = 'center'; ctx.fillText(s.name, p[0], p[1] - w - 12);
}
function draw(dt, t) {
  const V = room.online && !room.isHost ? view : G;
  ctx.fillStyle = '#04010c'; ctx.fillRect(0, 0, S.W, S.H);
  if (!V) return;
  const me = V.snakes.find(s => s.id === myId);
  if (me && me.alive) { cam.x = lerp(cam.x, me.x, 1 - Math.exp(-10 * dt)); cam.y = lerp(cam.y, me.y, 1 - Math.exp(-10 * dt)); }
  const zt = clamp(1.05 - (me ? Math.sqrt(me.len) * 0.022 : 0), 0.5, 1) * clamp(Math.min(S.W, S.H) / 700, 0.6, 1.3);
  cam.z = lerp(cam.z, zt, 1 - Math.exp(-2 * dt)); shake *= Math.exp(-9 * dt);
  ctx.save(); ctx.translate(S.W / 2 + rnd(-shake, shake), S.H / 2 + rnd(-shake, shake)); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  // suelo hexagonal
  const vw = S.W / cam.z / 2 + 80, vh = S.H / cam.z / 2 + 80, hs = 46;
  ctx.strokeStyle = '#160a36'; ctx.lineWidth = 2; ctx.beginPath();
  for (let y = Math.floor((cam.y - vh) / (hs * 1.5)) * hs * 1.5; y < cam.y + vh; y += hs * 1.5) for (let x = Math.floor((cam.x - vw) / (hs * 1.732)) * hs * 1.732; x < cam.x + vw; x += hs * 1.732) { const ox = (Math.round(y / (hs * 1.5)) % 2) * hs * 0.866; ctx.moveTo(x + ox + hs * 0.866, y + hs * 0.5); ctx.lineTo(x + ox, y + hs); ctx.lineTo(x + ox - hs * 0.866, y + hs * 0.5); }
  ctx.stroke();
  // borde
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ff2a4d'; for (const [lw, al] of [[40, 0.12], [16, 0.3], [5, 1]]) { ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke(); } ctx.restore();
  // luz para comer
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const o of V.orbs.values()) { if (Math.abs(o.x - cam.x) > vw || Math.abs(o.y - cam.y) > vh) continue; const r = 3 + o.v * 1.6, pulse = 1 + Math.sin(t * 4 + o.id) * 0.25; ctx.globalAlpha = 0.25; ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, r * 2.6 * pulse, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, 7); ctx.fill(); }
  ctx.restore();
  const sorted = [...V.snakes].filter(s => s.alive).sort((a, b) => a.len - b.len);
  for (const s of sorted) drawSnake(s, t, s.id === myId);
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
  // ranking y minimapa
  const top = [...V.snakes].sort((a, b) => (b.alive ? b.len : 0) - (a.alive ? a.len : 0)).slice(0, 6);
  ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = '700 12px Orbitron';
  top.forEach((s, i) => { ctx.fillStyle = s.id === myId ? '#fff' : s.color; ctx.fillText(`${i + 1}. ${s.name}  ${s.alive ? Math.round(s.len) : '☠'}`, S.W - 14, 14 + i * 18); });
  const mr = 52, mx = S.W - mr - 14, my = S.H - mr - 14; ctx.fillStyle = '#05010fcc'; ctx.strokeStyle = '#ff2a4d88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill(); ctx.stroke();
  for (const s of V.snakes) if (s.alive) { ctx.fillStyle = s.color; ctx.globalAlpha = s.id === myId ? 1 : 0.7; const r = s.id === myId ? 4 : 2.5; ctx.beginPath(); ctx.arc(mx + s.x / R * mr, my + s.y / R * mr, r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.font = '900 18px Orbitron'; ctx.fillStyle = '#fff';
  const hud = (V.mode === 'royale' ? `${Math.floor(Math.max(0, V.time) / 60)}:${String(Math.floor(Math.max(0, V.time) % 60)).padStart(2, '0')}   ` : '') + (me ? `📏 ${Math.round(me.alive ? me.len : 0)}` : '');
  ctx.fillText(hud, S.W / 2, 14);
  if (me && !me.alive && V.mode === 'royale') { ctx.font = '700 14px Orbitron'; ctx.fillStyle = '#ff2a4d'; ctx.fillText('¡TE HAN CORTADO! REAPARECES…', S.W / 2, S.H / 2 - 40); }
}

// ================== FLUJO ==================
function show(id) { for (const s of ['menu', 'lobbyBox', 'over', 'pause']) $(s).classList.toggle('hidden', s !== id); screen = id || 'play'; $('hud').classList.add('hidden'); touch.show(screen === 'play'); }
let last = null;
function soloStart(mode) { sfx.ensure(); myId = 'me'; const ps = [{ id: 'me', name: store.get('name', '') || 'TÚ', color: '#39ff88' }]; for (let i = 0; i < 14; i++) ps.push({ id: 'b' + i, name: NAMES[i], bot: true, color: COLORS[(i + 1) % COLORS.length] }); startPlay(mode, ps); }
function startPlay(mode, players) {
  last = { mode, players }; view = null;
  if (!room.online || room.isHost) newGame(mode, players); else G = null;
  if (room.online) myId = room.myId;
  paused = false; show(null); goFull(); sfx.music(SONGS.space); big(mode === 'royale' ? '¡A COMER!' : 'UNA VIDA', '#39ff88', 1200); sfx.play('go');
  if (room.isHost) sendOrbs();
}
function showEnd(res) {
  show('over'); sfx.music(null); const b = store.get('snake.best', { len: 0, wins: 0 });
  const i = res.rows.findIndex(r => r[5] === myId), mine = res.rows[i];
  if (res.mode === 'royale') { $('oTitle').textContent = i === 0 ? '👑 ¡ERES LA REINA!' : 'PUESTO ' + (i + 1); if (i === 0) { b.wins++; sfx.play('win'); } else sfx.play('lose'); }
  else { $('oTitle').textContent = 'FIN · ' + (mine ? mine[3] : 0); sfx.play('lose'); }
  $('oSub').textContent = mine ? `MÁXIMO ${mine[3]} · ${mine[4]} CORTES` : '';
  if (mine) b.len = Math.max(b.len, mine[3]); store.set('snake.best', b); showBest();
  $('oTbl').innerHTML = res.rows.slice(0, 8).map((r, k) => `<tr class="${r[5] === myId ? 'me' : ''}"><td>${k + 1}</td><td style="color:${r[1]}">${r[0]}</td><td>${r[2]}</td><td>${r[4]} ✂</td></tr>`).join('');
  $('oAgain').classList.toggle('hidden', room.online && !room.isHost);
}
function toMenu() { G = null; view = null; if (room.online) room.leave(); show('menu'); sfx.music(null); }
$('mFFA').onclick = () => soloStart('royale');
$('mWaves').onclick = () => soloStart('life');
$('mOnline').onclick = () => { sfx.ensure(); show('lobbyBox'); renderLobby(); };
let onBots = 8;
const renderLobby = () => lobby($('lobbyBox'), room, {
  onBack: () => { room.leave(); show('menu'); },
  extra: () => `<div class="opt">BOTS DE RELLENO<div class="seg" id="lbBots"><button data-v="0">0</button><button data-v="4">4</button><button data-v="8">8</button><button data-v="12">12</button></div></div>`,
  bindExtra: el => seg(el.querySelector('#lbBots'), onBots, v => onBots = v),
  onGo: () => { const ps = room.players.map(p => ({ id: p.id, name: p.name, color: p.color })); for (let i = 0; i < onBots; i++) ps.push({ id: 'b' + i, name: NAMES[i], bot: true, color: COLORS[(i + 3) % COLORS.length] }); room.start({ mode: 'royale', players: ps }); },
});
$('oMenu').onclick = toMenu;
$('oAgain').onclick = () => { if (room.online) { if (room.isHost) room.start(last); } else soloStart(last.mode); };
$('pRes').onclick = () => { paused = false; show(null); };
$('pMenu').onclick = toMenu;

loop((dt, t) => {
  if (screen === 'play') {
    if (hit('KeyP', 'Escape') && !room.online) { paused = true; show('pause'); }
    if (hit('KeyM')) toast(sfx.toggleMute() ? '🔇 Sonido apagado' : '🔊 Sonido encendido', 1200);
    if (!paused) {
      if (!room.online || room.isHost) { step(dt); if (room.isHost && G) { sendT -= dt; G.sync -= dt; if (sendT <= 0) { sendT = 1 / 15; room.broadcast(snap()); } if (G.sync <= 0) { G.sync = 6; sendOrbs(); } } else if (G) { G.added = []; G.removed = []; } }
      else { sendT -= dt; if (sendT <= 0) { sendT = 1 / 30; room.send({ t: 'in', i: readInput(view && view.snakes.find(s => s.id === myId)) }); } }
    }
  }
  draw(dt, t);
});
show('menu');
if (location.hash === '#dbg') window.dbg = { get G() { return G; }, get view() { return view; }, room, get screen() { return screen; }, botMe() { const m = G.snakes.find(s => s.id === 'me'); m.bot = { t: 0, want: 0, skill: 0.8 }; } };
