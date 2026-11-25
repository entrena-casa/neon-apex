// PULSO — esquiva al ritmo. Los peligros avisan y luego golpean siguiendo el compás de la canción.
import { $, clamp, lerp, rnd, store, toast, big, setupCanvas, loop, down, hit, pad, touchControls, goFull, sfx, Particles, glowDot, backButton } from '../../comun/lib.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(800);
backButton();
const touch = touchControls({ left: 'stick', buttons: [{ id: 'dash', label: 'IMPULSO', color: '#ff2bd6', right: 24, bottom: 34, size: 92 }] });
const LEVELS = [
  { name: 'LATIDO', song: { bpm: 100, root: 57, chords: [0, -4, -7, -2], minor: true }, beats: 96, dens: 0.6, types: ['laser', 'ring', 'bomb'], col: '#00f0ff' },
  { name: 'AUTOPISTA', song: { bpm: 116, root: 60, chords: [0, 7, 9, 5], minor: false }, beats: 120, dens: 0.72, types: ['laser', 'ring', 'wall', 'bomb'], col: '#39ff88' },
  { name: 'TORMENTA', song: { bpm: 126, root: 52, chords: [0, 0, -2, -4], minor: true }, beats: 136, dens: 0.82, types: ['laser', 'rain', 'wall', 'ring', 'bomb'], col: '#9d4dff' },
  { name: 'ESPIRAL', song: { bpm: 134, root: 62, chords: [0, 5, -2, 3], minor: true }, beats: 150, dens: 0.92, types: ['spiral', 'laser', 'wall', 'bomb', 'ring'], col: '#ffd200' },
  { name: 'SUPERNOVA', song: { bpm: 148, root: 55, chords: [0, 3, 5, -2], minor: true }, beats: 176, dens: 1.05, types: ['spiral', 'laser', 'rain', 'wall', 'bomb', 'ring', 'cross'], col: '#ff2a4d' },
];
const save = Object.assign({ unlocked: 1, best: {} }, store.get('pulso.save', {}));
const persist = () => store.set('pulso.save', save);
function renderMenu() {
  const el = $('lv'); el.innerHTML = '';
  LEVELS.forEach((L, i) => { const b = document.createElement('button'); b.disabled = i >= save.unlocked; const bs = save.best[i]; b.innerHTML = `<b style="color:${L.col}">${i + 1}. ${L.name}</b><span>${bs == null ? L.song.bpm + ' BPM' : bs >= 100 ? '★ ' + (save.hits && save.hits[i] === 0 ? 'PERFECTO' : 'SUPERADO') : bs + ' %'}</span>`; b.onclick = () => start(i); el.appendChild(b); });
}
renderMenu();
let G = null, screen = 'menu', shake = 0, flash = 0;
function seeded(n) { let s = n * 99991 + 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// genera la coreografía del nivel: lista de [pulso, tipo, parámetros]
function chart(i) {
  const L = LEVELS[i], R = seeded(i + 1), ev = [];
  for (let b = 8; b < L.beats - 4; b++) {
    const phase = (b % 32) / 32, intense = 0.6 + 0.4 * Math.sin((b / L.beats) * Math.PI);
    if (b % 2 && R() > 0.55) continue;
    if (R() > L.dens * intense * (b % 4 === 0 ? 1.4 : 0.8)) continue;
    const t = L.types[Math.floor(R() * L.types.length)];
    ev.push([b, t, R(), R(), R()]);
    if (b % 16 === 0 && i >= 1) ev.push([b, 'laser', R(), R() < 0.5 ? 0.1 : 0.9, 0]);
  }
  return ev;
}
function start(i) {
  sfx.ensure(); goFull(); show(null);
  const L = LEVELS[i];
  G = { i, L, ev: chart(i), k: 0, haz: [], P: { x: 0.5, y: 0.5, vx: 0, vy: 0, inv: 1, dash: 0, cd: 0, trail: [] }, hits: 0, t0: performance.now() / 1000 + 0.12, over: false, beat: -1, lastBeat: -1, paused: 0 };
  sfx.music(L.song); big(L.name, L.col, 1300);
}
const beatNow = () => G ? ((performance.now() / 1000 - G.t0 - G.paused) * G.L.song.bpm / 60) : 0;
// las posiciones van en coordenadas 0..1 del área de juego (cuadrada si se puede)
function spawn(e) {
  const [b, type, a, c, d] = e, spb = 60 / G.L.song.bpm;
  if (type === 'laser') G.haz.push({ type, vert: a < 0.5, pos: 0.08 + c * 0.84, warn: 2, live: 0.9, w: 0.06, t: 0 });
  if (type === 'cross') { G.haz.push({ type: 'laser', vert: true, pos: 0.15 + c * 0.7, warn: 2, live: 0.9, w: 0.05, t: 0 }); G.haz.push({ type: 'laser', vert: false, pos: 0.15 + d * 0.7, warn: 2, live: 0.9, w: 0.05, t: 0 }); }
  if (type === 'ring') { const x = 0.15 + a * 0.7, y = 0.15 + c * 0.7, n = 10 + Math.floor(d * 8); G.haz.push({ type: 'mark', x, y, warn: 1, t: 0, then: () => { for (let k = 0; k < n; k++) { const ang = (k / n) * Math.PI * 2 + d; G.haz.push({ type: 'bullet', x, y, vx: Math.cos(ang) * 0.32, vy: Math.sin(ang) * 0.32, r: 0.014, life: 4 }); } sfx.play('shoot'); } }); }
  if (type === 'bomb') G.haz.push({ type: 'bomb', x: 0.12 + a * 0.76, y: 0.12 + c * 0.76, r: 0.1 + d * 0.1, warn: 2, live: 0.5, t: 0 });
  if (type === 'wall') { const fromL = a < 0.5, gap = 0.15 + c * 0.7; G.haz.push({ type: 'wall', vert: d < 0.5, fromL, gap, gw: 0.24, p: fromL ? -0.05 : 1.05, v: (fromL ? 1 : -1) * 0.38, warn: 1, t: 0 }); }
  if (type === 'rain') for (let k = 0; k < 7; k++) G.haz.push({ type: 'bullet', x: (k + a) / 7, y: -0.05 - k * 0.04, vx: 0, vy: 0.45 + c * 0.2, r: 0.016, life: 4 });
  if (type === 'spiral') { const x = 0.5, y = 0.5; for (let k = 0; k < 14; k++) { const ang = k * 0.45 + a * 6; G.haz.push({ type: 'bullet', x, y, vx: Math.cos(ang) * 0.26, vy: Math.sin(ang) * 0.26, r: 0.013, life: 4, delay: k * spb / 4 }); } }
}
function step(dt) {
  if (!G || G.over) return;
  const P = G.P, b = beatNow();
  while (G.k < G.ev.length && G.ev[G.k][0] - 2 <= b) { spawn(G.ev[G.k]); G.k++; }
  if (Math.floor(b) !== G.lastBeat) { G.lastBeat = Math.floor(b); if (G.lastBeat % 4 === 0) flash = 0.12; }
  // jugador
  let mx = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0), my = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  let dash = hit('Space', 'ShiftLeft', 'ShiftRight') || touch.tapped('dash'); const g = pad(); if (g) { if (g.lx || g.ly) { mx = g.lx; my = g.ly; } if (g.a || g.rb) dash = dash || !step.padA; step.padA = g.a || g.rb; }
  if (touch.la) { mx = touch.lx; my = touch.ly; }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  P.cd -= dt; P.inv -= dt; P.dash -= dt;
  if (dash && P.cd <= 0 && m > 0.1) { P.dash = 0.18; P.cd = 0.55; P.inv = Math.max(P.inv, 0.25); sfx.play('dash'); fx.ring(...toPx(P.x, P.y), '#ff2bd6', 30); }
  const sp = P.dash > 0 ? 1.5 : 0.48;
  P.vx = lerp(P.vx, mx * sp, 1 - Math.exp(-16 * dt)); P.vy = lerp(P.vy, my * sp, 1 - Math.exp(-16 * dt));
  P.x = clamp(P.x + P.vx * dt, 0.02, 0.98); P.y = clamp(P.y + P.vy * dt, 0.02, 0.98);
  P.trail.unshift([P.x, P.y]); if (P.trail.length > 10) P.trail.pop();
  // peligros
  const R = 0.016;
  for (let i = G.haz.length - 1; i >= 0; i--) {
    const h = G.haz[i]; let hitMe = false, dead = false;
    if (h.type === 'laser') { h.t += dt * G.L.song.bpm / 60; if (h.t > h.warn) { if (!h.fired) { h.fired = 1; sfx.play('laser'); shake = 5; } hitMe = Math.abs((h.vert ? P.x : P.y) - h.pos) < h.w / 2 + R; } if (h.t > h.warn + h.live) dead = true; }
    else if (h.type === 'mark') { h.t += dt * G.L.song.bpm / 60; if (h.t > h.warn) { h.then(); dead = true; } }
    else if (h.type === 'bomb') { h.t += dt * G.L.song.bpm / 60; if (h.t > h.warn) { if (!h.fired) { h.fired = 1; sfx.play('boom'); shake = 9; const [px, py] = toPx(h.x, h.y); fx.emit(px, py, 40, '#ff2a4d', 400, 0.6, 4); } hitMe = Math.hypot(P.x - h.x, P.y - h.y) < h.r + R; } if (h.t > h.warn + h.live) dead = true; }
    else if (h.type === 'wall') { h.t += dt * G.L.song.bpm / 60; if (h.t > h.warn) { h.p += h.v * dt; const q = h.vert ? P.x : P.y, o = h.vert ? P.y : P.x; hitMe = Math.abs(q - h.p) < 0.025 + R && Math.abs(o - h.gap) > h.gw / 2; if (h.p < -0.1 || h.p > 1.1) dead = true; } }
    else if (h.type === 'bullet') { if (h.delay > 0) { h.delay -= dt; continue; } h.x += h.vx * dt; h.y += h.vy * dt; h.life -= dt; hitMe = Math.hypot(P.x - h.x, P.y - h.y) < h.r + R; if (h.life <= 0 || h.x < -0.1 || h.x > 1.1 || h.y < -0.2 || h.y > 1.1) dead = true; }
    if (hitMe && P.inv <= 0) { G.hits++; P.inv = 1.2; sfx.play('hurt'); shake = 12; flash = 0.4; const [px, py] = toPx(P.x, P.y); fx.emit(px, py, 30, '#ff2a4d', 300, 0.6, 4); if (G.hits >= 5) return fail(b); }
    if (dead) G.haz.splice(i, 1);
  }
  const prog = clamp(b / G.L.beats, 0, 1); $('prog').style.width = (prog * 100) + '%';
  if (b >= G.L.beats) finish();
}
function fail(b) {
  G.over = true; sfx.music(null); sfx.play('lose'); const pct = Math.floor(clamp(b / G.L.beats, 0, 1) * 100);
  save.best[G.i] = Math.max(save.best[G.i] || 0, pct); persist(); renderMenu();
  $('oTitle').textContent = 'SIN VIDAS'; $('oSub').textContent = `${G.L.name} · has llegado al ${pct} % · ¡casi!`; setTimeout(() => show('over'), 700);
}
function finish() {
  G.over = true; sfx.music(null); sfx.play('win');
  const i = G.i, pct = 100; save.best[i] = 100; save.hits = save.hits || {}; save.hits[i] = Math.min(save.hits[i] ?? 99, G.hits); save.unlocked = Math.max(save.unlocked, i + 2); persist(); renderMenu();
  $('oTitle').textContent = G.hits === 0 ? '¡PERFECTO!' : '¡SUPERADO!'; $('oSub').textContent = `${G.L.name} · ${G.hits} golpes${i + 1 < LEVELS.length ? ' · ¡Nuevo nivel desbloqueado!' : ' · ¡Has superado todos los niveles!'}`;
  setTimeout(() => show('over'), 600);
}
const area = () => { const s = Math.min(S.W, S.H) * 0.94, w = Math.min(S.W * 0.96, s * 1.5); return { x: (S.W - w) / 2, y: (S.H - s) / 2, w, h: s }; };
const toPx = (x, y) => { const A = area(); return [A.x + x * A.w, A.y + y * A.h]; };
function draw(dt, t) {
  ctx.fillStyle = '#05010f'; ctx.fillRect(0, 0, S.W, S.H);
  const col = G ? G.L.col : '#ff2bd6', A = area(), b = Math.max(0, G ? beatNow() : t * 2), pulse = 1 - (b % 1);
  shake *= Math.exp(-10 * dt); flash *= Math.exp(-6 * dt);
  ctx.save(); ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  // fondo que late
  ctx.strokeStyle = col + '22'; ctx.lineWidth = 1; for (let k = 0; k < 8; k++) { const r = ((k + b * 0.5) % 8) / 8 * Math.max(S.W, S.H) * 0.8; ctx.beginPath(); ctx.arc(S.W / 2, S.H / 2, r, 0, 7); ctx.stroke(); }
  ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + pulse * 0.4; ctx.lineWidth = 2 + pulse * 3; ctx.strokeRect(A.x, A.y, A.w, A.h); ctx.globalAlpha = 1;
  if (!G) { ctx.restore(); return; }
  for (const h of G.haz) {
    if (h.type === 'laser') { const warn = h.t <= h.warn, w = h.w * (h.vert ? A.w : A.h); ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const p = h.vert ? A.x + h.pos * A.w : A.y + h.pos * A.h;
      if (warn) { ctx.fillStyle = '#ff2bd6'; ctx.globalAlpha = 0.12 + (h.t / h.warn) * 0.2 + (Math.sin(t * 30) > 0 ? 0.05 : 0); if (h.vert) ctx.fillRect(p - w / 2, A.y, w, A.h); else ctx.fillRect(A.x, p - w / 2, A.w, w); }
      else { ctx.fillStyle = '#ff2bd6'; ctx.globalAlpha = 0.5; if (h.vert) ctx.fillRect(p - w, A.y, w * 2, A.h); else ctx.fillRect(A.x, p - w, A.w, w * 2); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; if (h.vert) ctx.fillRect(p - w / 3, A.y, w / 1.5, A.h); else ctx.fillRect(A.x, p - w / 3, A.w, w / 1.5); }
      ctx.restore(); }
    else if (h.type === 'mark') { const [x, y] = toPx(h.x, h.y); ctx.strokeStyle = '#ffd200'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 30 * (1 - h.t / h.warn) + 6, 0, 7); ctx.stroke(); }
    else if (h.type === 'bomb') { const [x, y] = toPx(h.x, h.y), r = h.r * A.h; if (h.t <= h.warn) { ctx.strokeStyle = '#ff2a4d'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ff2a4d33'; ctx.beginPath(); ctx.arc(x, y, r * (h.t / h.warn), 0, 7); ctx.fill(); } else { glowDot(ctx, x, y, r * 1.6, '#ff2a4d', 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, 7); ctx.fill(); } }
    else if (h.type === 'wall') { const live = h.t > h.warn; ctx.fillStyle = live ? '#00f0ff' : '#00f0ff33'; const th = 0.05, gapA = h.gap - h.gw / 2, gapB = h.gap + h.gw / 2;
      if (h.vert) { const x = A.x + h.p * A.w; ctx.fillRect(x - th * A.w / 2, A.y, th * A.w, gapA * A.h); ctx.fillRect(x - th * A.w / 2, A.y + gapB * A.h, th * A.w, (1 - gapB) * A.h); }
      else { const y = A.y + h.p * A.h; ctx.fillRect(A.x, y - th * A.h / 2, gapA * A.w, th * A.h); ctx.fillRect(A.x + gapB * A.w, y - th * A.h / 2, (1 - gapB) * A.w, th * A.h); } }
    else if (h.type === 'bullet' && !(h.delay > 0)) { const [x, y] = toPx(h.x, h.y), r = h.r * A.h; glowDot(ctx, x, y, r * 3, '#ff2bd6', 0.8); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  }
  // jugador
  const P = G.P;
  ctx.globalCompositeOperation = 'lighter'; P.trail.forEach(([x, y], k) => { const [px, py] = toPx(x, y); ctx.globalAlpha = (1 - k / 10) * 0.4; ctx.fillStyle = '#00f0ff'; ctx.beginPath(); ctx.arc(px, py, 10 - k * 0.7, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (!(P.inv > 0 && Math.floor(t * 20) % 2 && P.dash <= 0)) { const [px, py] = toPx(P.x, P.y), s = 11 + pulse * 3; glowDot(ctx, px, py, 40, '#00f0ff', 0.6); ctx.save(); ctx.translate(px, py); ctx.rotate(t * 3); ctx.fillStyle = P.dash > 0 ? '#ff2bd6' : '#fff'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
  if (flash > 0.01) { ctx.fillStyle = col; ctx.globalAlpha = flash * 0.3; ctx.fillRect(0, 0, S.W, S.H); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#fff'; ctx.font = '900 14px Orbitron'; ctx.textAlign = 'right'; ctx.fillStyle = '#ff2a4d'; ctx.fillText('♥'.repeat(Math.max(0, 5 - G.hits)) + '♡'.repeat(Math.min(5, G.hits)), S.W - 16, 26);
}
let pauseAt = 0;
function show(id) { for (const s of ['menu', 'over', 'pause']) $(s).classList.toggle('hidden', s !== id); screen = id || 'play'; touch.show(!id); $('prog').classList.toggle('hidden', !!id); }
$('oMenu').onclick = () => { G = null; show('menu'); };
$('oAgain').onclick = () => start(G ? G.i : 0);
$('pRes').onclick = () => { G.paused += performance.now() / 1000 - pauseAt; sfx.music(G.L.song); show(null); };
$('pMenu').onclick = () => { G = null; sfx.music(null); show('menu'); };
loop((dt, t) => { if (screen === 'play') { if (hit('KeyP', 'Escape') && G && !G.over) { pauseAt = performance.now() / 1000; sfx.music(null); show('pause'); } else step(dt); } draw(dt, t); });
show('menu');
if (location.hash === '#dbg') window.dbg = { get G() { return G; }, start };
