// ÓRBITA ROTA — misiones espaciales con historia: chatarra, asteroides, drones y una nave nodriza.
import { $, clamp, lerp, rnd, irnd, pick, dist, wrapA, store, toast, big, setupCanvas, loop, down, hit, pad, touchControls, usingTouch, goFull, sfx, SONGS, Particles, neon, glowDot, backButton } from '../../comun/lib.js';
import { dialog, chapter, talking } from '../../comun/story.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(1200);
backButton();
const touch = touchControls({ left: 'stick', buttons: [{ id: 'fire', label: 'FUEGO', color: '#ff2bd6', right: 20, bottom: 30, size: 90 }, { id: 'boost', label: 'TURBO', color: '#00f0ff', right: 126, bottom: 40, size: 66 }] });
const WR = 2600; // radio del sector
const C = { who: 'CAPITANA IRIS', col: '#9d4dff' }, B = { who: 'BRIZNA', col: '#00f0ff' }, H = { who: 'HALCÓN', col: '#ff2a4d' };
const say = (w, txt, ch) => ({ ...w, txt, choices: ch });
const MISSIONS = [
  { name: 'DESPERTAR EN ÓRBITA', goal: 'scrap', n: 6, rocks: 16, drones: 0, intro: [say(B, 'Capitana, despierte. Sistema de soporte vital: 12 %. Motor: dañado. Humor: excelente.'), say(C, 'Brizna… ¿qué ha pasado con la Aurora?'), say(B, 'Una tormenta de asteroides nos partió en dos. Estamos en órbita de Neptuno. Muy lejos de casa.'), say(C, 'Entonces toca recoger piezas. Vamos.')] },
  { name: 'DRONES PIRATAS', goal: 'kill', n: 8, rocks: 12, drones: 8, intro: [say(B, 'Detecto naves pequeñas. Llevan el emblema de HALCÓN, un chatarrero pirata.'), say(H, 'Esa chatarra es mía, capitana. Lárguese o la convierto en polvo de estrellas.'), say(C, 'Brizna, ¿cuántos disparos nos quedan?'), say(B, 'Infinitos. Es lo bueno de los láseres.')] },
  { name: 'EL CAMPO DE HIELO', goal: 'beacon', n: 1, rocks: 34, drones: 2, intro: [say(B, 'Hay una baliza de rescate al otro lado de un campo de hielo. Si la activamos, la Tierra sabrá que seguimos vivas.'), say(C, 'Pues a esquivar cubitos.')] },
  { name: 'COMBUSTIBLE', goal: 'fuel', n: 5, rocks: 20, drones: 6, intro: [say(B, 'Sin combustible no volvemos. Hay cápsulas flotando por el sector.'), say(H, 'Bonitas cápsulas. Sería una pena que alguien… las vigilara.'), say(C, 'Qué pesado es este hombre.')] },
  { name: 'LA TORMENTA', goal: 'survive', n: 60, rocks: 10, drones: 4, storm: true, intro: [say(B, 'Viene otra tormenta de asteroides. Aguante 60 segundos y el motor estará reparado.'), say(C, '¿Y si no aguantamos?'), say(B, 'Entonces lo ponemos en el informe como «intento valiente».')] },
  { name: 'HALCÓN', goal: 'boss', n: 1, rocks: 8, drones: 4, intro: [say(H, 'Se acabó, capitana. Mi nodriza contra su cascarón.'), say(B, 'Sus escudos caen cuando abre los hangares para soltar drones. Ese es el momento.'), say(C, 'Brizna, rumbo a casa en cuanto acabemos con esto.'), say(B, 'Rumbo grabado. Le dejo los fuegos artificiales a usted.')] },
];
const UPG = [
  { id: 'gun', name: 'CAÑÓN', desc: 'Más disparos por segundo y doble disparo', max: 4, cost: [8, 14, 22, 32] },
  { id: 'hull', name: 'CASCO', desc: 'Más vida', max: 4, cost: [6, 12, 18, 26] },
  { id: 'eng', name: 'MOTOR', desc: 'Más velocidad y turbo', max: 3, cost: [8, 16, 26] },
  { id: 'mag', name: 'IMÁN', desc: 'Atrae la chatarra desde lejos', max: 3, cost: [5, 10, 18] },
];
const save = Object.assign({ unlocked: 1, scrap: 0, up: { gun: 0, hull: 0, eng: 0, mag: 0 }, stars: {} }, store.get('orbita.save', {}));
const persist = () => store.set('orbita.save', save);
let G = null, screen = 'menu', paused = false, cam = { x: 0, y: 0, z: 1 }, shake = 0;
function renderMissions() {
  const el = $('msList'); el.innerHTML = '';
  MISSIONS.forEach((m, i) => { const b = document.createElement('button'); b.disabled = i >= save.unlocked; const s = save.stars[i] || 0; b.innerHTML = `${i + 1}. ${m.name}<span>${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`; b.onclick = () => startMission(i); el.appendChild(b); });
  $('bPlay').textContent = save.unlocked > 1 ? 'CONTINUAR' : 'JUGAR';
}
renderMissions();
function renderShop() {
  $('shopMoney').innerHTML = `CHATARRA: <b style="color:var(--gold)">${save.scrap} ⚙</b>`;
  const el = $('shopList'); el.innerHTML = '';
  for (const u of UPG) { const lv = save.up[u.id], c = u.cost[lv]; const b = document.createElement('button'); b.disabled = lv >= u.max || save.scrap < c; b.innerHTML = `<div>${u.name} ${'▮'.repeat(lv)}${'▯'.repeat(u.max - lv)}<br><small style="font-weight:500;color:var(--dim);letter-spacing:1px;font-size:10px">${u.desc}</small></div><span>${lv >= u.max ? 'MÁX' : c + ' ⚙'}</span>`; b.onclick = () => { save.scrap -= c; save.up[u.id]++; persist(); sfx.play('power'); renderShop(); }; el.appendChild(b); }
}
$('bShop').onclick = () => { renderShop(); show('shop'); };
$('shopBack').onclick = () => show('menu');

// ================== MUNDO ==================
function rock(x, y, r, vx, vy) { const n = irnd(9, 13), pts = []; for (let i = 0; i < n; i++) pts.push(r * rnd(0.72, 1.1)); return { x, y, r, vx: vx ?? rnd(-40, 40), vy: vy ?? rnd(-40, 40), a: rnd(6), va: rnd(-0.8, 0.8), pts, hp: Math.ceil(r / 14), ice: false }; }
function build(i) {
  const M = MISSIONS[i], up = save.up;
  const g = { i, M, t: 0, rocks: [], drones: [], shots: [], eshots: [], items: [], over: false, got: 0, kills: 0, dmgTaken: 0, boss: null, beacon: null, stormT: 0,
    P: { x: 0, y: 0, vx: 0, vy: 0, a: -Math.PI / 2, hp: 100 + up.hull * 40, max: 100 + up.hull * 40, cd: 0, inv: 1.5, boost: 100 } };
  for (let k = 0; k < M.rocks; k++) { let x, y; do { const a = rnd(6.28), r = rnd(300, WR - 100); x = Math.cos(a) * r; y = Math.sin(a) * r; } while (Math.hypot(x, y) < 350); const r = rnd(26, 70); const R = rock(x, y, r); R.ice = i === 2; g.rocks.push(R); }
  if (M.goal === 'scrap') for (let k = 0; k < M.n; k++) { const a = rnd(6.28), r = rnd(500, WR - 200); g.items.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, k: 'part', vx: 0, vy: 0 }); }
  if (M.goal === 'fuel') for (let k = 0; k < M.n; k++) { const a = rnd(6.28), r = rnd(600, WR - 200); g.items.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, k: 'fuel', vx: 0, vy: 0 }); }
  if (M.goal === 'beacon') { const a = rnd(6.28); g.beacon = { x: Math.cos(a) * (WR - 250), y: Math.sin(a) * (WR - 250), on: 0 }; for (let k = 0; k < 18; k++) { const t2 = rnd(0.25, 0.85); const R = rock(g.beacon.x * t2 + rnd(-200, 200), g.beacon.y * t2 + rnd(-200, 200), rnd(30, 60), rnd(-20, 20), rnd(-20, 20)); R.ice = true; g.rocks.push(R); } }
  for (let k = 0; k < M.drones; k++) spawnDrone(g);
  if (M.goal === 'boss') g.boss = { x: 0, y: -900, vx: 0, vy: 0, a: Math.PI / 2, hp: 60, max: 60, open: 0, cd: 2, hangar: 6 };
  return g;
}
function spawnDrone(g, near) { const a = rnd(6.28), r = near ? rnd(700, 1000) : rnd(800, WR - 200); const bx = near ? g.P.x : 0, by = near ? g.P.y : 0; g.drones.push({ x: bx + Math.cos(a) * r, y: by + Math.sin(a) * r, vx: 0, vy: 0, a: 0, hp: 3, cd: rnd(1, 2.5), orbit: rnd() < 0.5 ? 1 : -1 }); }
function ev(type, x, y, c, n = 1) {
  if (type === 'boom') { fx.emit(x, y, 30 * n, c, 320 * Math.sqrt(n), 0.9, 4); fx.emit(x, y, 12 * n, '#fff', 220, 0.5, 3); fx.ring(x, y, c, 40 * n); sfx.play('boom'); shake = Math.min(16, shake + 4 * n); }
  else if (type === 'hit') { fx.emit(x, y, 6, c, 180, 0.3, 3); sfx.play('hit'); }
}
function hurtP(d) { const P = G.P; if (P.inv > 0 || G.over) return; P.hp -= d; G.dmgTaken += d; P.inv = 0.5; shake = 8; sfx.play('hurt'); fx.emit(P.x, P.y, 14, '#ff2a4d', 220, 0.4, 3); if (P.hp <= 0) { ev('boom', P.x, P.y, '#9d4dff', 3); G.over = true; setTimeout(() => endMission(false), 1400); } }
function splitRock(R, idx) {
  G.rocks.splice(idx, 1); ev('boom', R.x, R.y, R.ice ? '#9ad8ff' : '#ff8a1a', R.r / 40);
  if (R.r > 34) for (let k = 0; k < 2; k++) { const n = rock(R.x, R.y, R.r * 0.58, R.vx + rnd(-90, 90), R.vy + rnd(-90, 90)); n.ice = R.ice; G.rocks.push(n); }
  if (Math.random() < 0.45) G.items.push({ x: R.x, y: R.y, k: 'scrap', vx: rnd(-60, 60), vy: rnd(-60, 60) });
}

// ================== PASO ==================
let mouse = { x: 0, y: 0, down: false, moved: false };
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; });
cv.addEventListener('mousedown', () => mouse.down = true); addEventListener('mouseup', () => mouse.down = false);
function step(dt) {
  if (!G || G.over) return;
  const P = G.P, up = save.up, M = G.M; G.t += dt;
  // controles
  let rot = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0), thrust = down('KeyW', 'ArrowUp') ? 1 : 0, rev = down('KeyS', 'ArrowDown');
  let fire = down('Space') || mouse.down || touch.btn.fire, boost = down('ShiftLeft', 'ShiftRight') || touch.btn.boost;
  let want = null;
  if (mouse.moved && !usingTouch() && !rot) { const s = { x: (P.x - cam.x) * cam.z + S.W / 2, y: (P.y - cam.y) * cam.z + S.H / 2 }; want = Math.atan2(mouse.y - s.y, mouse.x - s.x); }
  const g = pad(); if (g) { if (Math.hypot(g.lx, g.ly) > 0.3) { want = Math.atan2(g.ly, g.lx); thrust = Math.min(1, Math.hypot(g.lx, g.ly)); } if (g.a || g.rt > 0.3) fire = true; if (g.b || g.lt > 0.3) boost = true; }
  if (touch.la && Math.hypot(touch.lx, touch.ly) > 0.2) { want = Math.atan2(touch.ly, touch.lx); thrust = Math.min(1, Math.hypot(touch.lx, touch.ly) * 1.2); }
  if (want != null) P.a += clamp(wrapA(want - P.a), -dt * 7, dt * 7); else P.a += rot * dt * 4.2;
  const acc = 520 + up.eng * 110, maxV = 430 + up.eng * 70;
  boost = boost && P.boost > 0 && thrust > 0;
  if (thrust) { const k = boost ? 1.9 : 1; P.vx += Math.cos(P.a) * acc * thrust * k * dt; P.vy += Math.sin(P.a) * acc * thrust * k * dt; if (Math.random() < 0.9) fx.emit(P.x - Math.cos(P.a) * 18, P.y - Math.sin(P.a) * 18, boost ? 3 : 1, boost ? '#00f0ff' : '#ff2bd6', 160, 0.35, 4, 0.5, P.a + Math.PI); }
  if (rev) { P.vx *= Math.exp(-2.5 * dt); P.vy *= Math.exp(-2.5 * dt); }
  P.boost = clamp(P.boost + (boost ? -40 : 18) * dt, 0, 100);
  const sp = Math.hypot(P.vx, P.vy), lim = boost ? maxV * 1.6 : maxV; if (sp > lim) { P.vx *= lim / sp; P.vy *= lim / sp; }
  P.vx *= Math.exp(-0.35 * dt); P.vy *= Math.exp(-0.35 * dt);
  P.x += P.vx * dt; P.y += P.vy * dt; P.inv -= dt; P.cd -= dt;
  if (Math.hypot(P.x, P.y) > WR) { const a = Math.atan2(P.y, P.x); P.vx -= Math.cos(a) * 600 * dt; P.vy -= Math.sin(a) * 600 * dt; }
  if (fire && P.cd <= 0) { P.cd = 0.2 - up.gun * 0.03; const guns = up.gun >= 2 ? [-7, 7] : [0]; for (const o of guns) { const ox = Math.cos(P.a + Math.PI / 2) * o, oy = Math.sin(P.a + Math.PI / 2) * o; G.shots.push({ x: P.x + Math.cos(P.a) * 20 + ox, y: P.y + Math.sin(P.a) * 20 + oy, vx: P.vx + Math.cos(P.a) * 900, vy: P.vy + Math.sin(P.a) * 900, life: 0.9 }); } sfx.play('laser'); }
  // rocas
  for (const R of G.rocks) { R.x += R.vx * dt; R.y += R.vy * dt; R.a += R.va * dt; if (Math.hypot(R.x, R.y) > WR + 200) { R.vx *= -1; R.vy *= -1; } if (dist(R.x, R.y, P.x, P.y) < R.r + 14) { const a = Math.atan2(P.y - R.y, P.x - R.x); P.vx += Math.cos(a) * 260; P.vy += Math.sin(a) * 260; hurtP(8 + R.r * 0.2); } }
  if (M.storm) { G.stormT -= dt; if (G.stormT <= 0) { G.stormT = Math.max(0.35, 1.2 - G.t * 0.012); const a = rnd(6.28); const R = rock(P.x + Math.cos(a) * 1100, P.y + Math.sin(a) * 1100, rnd(24, 55)); const to = Math.atan2(P.y - R.y, P.x - R.x) + rnd(-0.4, 0.4), v = rnd(160, 300); R.vx = Math.cos(to) * v; R.vy = Math.sin(to) * v; G.rocks.push(R); } G.rocks = G.rocks.filter(R => dist(R.x, R.y, P.x, P.y) < 2400); }
  // drones
  for (const D of G.drones) {
    const d = dist(D.x, D.y, P.x, P.y), a = Math.atan2(P.y - D.y, P.x - D.x); D.a = a;
    const tgtR = 300, ra = a + Math.PI + D.orbit * 0.9; const tx = P.x + Math.cos(ra) * tgtR, ty = P.y + Math.sin(ra) * tgtR;
    D.vx = lerp(D.vx, (tx - D.x) * 1.2, dt * 2); D.vy = lerp(D.vy, (ty - D.y) * 1.2, dt * 2); const s2 = Math.hypot(D.vx, D.vy); if (s2 > 330) { D.vx *= 330 / s2; D.vy *= 330 / s2; }
    D.x += D.vx * dt; D.y += D.vy * dt; D.cd -= dt;
    if (D.cd <= 0 && d < 750) { D.cd = rnd(1.4, 2.4); const la = a + rnd(-0.12, 0.12); G.eshots.push({ x: D.x, y: D.y, vx: Math.cos(la) * 420, vy: Math.sin(la) * 420, life: 2.2 }); sfx.play('shoot'); }
  }
  // jefe
  const Bs = G.boss; if (Bs) {
    const d = dist(Bs.x, Bs.y, P.x, P.y), a = Math.atan2(P.y - Bs.y, P.x - Bs.x); Bs.a += wrapA(a - Bs.a) * dt * 0.8;
    if (d > 450) { Bs.vx = lerp(Bs.vx, Math.cos(a) * 90, dt); Bs.vy = lerp(Bs.vy, Math.sin(a) * 90, dt); } else { Bs.vx *= Math.exp(-dt); Bs.vy *= Math.exp(-dt); }
    Bs.x += Bs.vx * dt; Bs.y += Bs.vy * dt; Bs.cd -= dt; Bs.hangar -= dt; Bs.open -= dt;
    if (Bs.hangar <= 0) { Bs.hangar = 8; Bs.open = 3.5; for (let k = 0; k < 3; k++) { G.drones.push({ x: Bs.x + rnd(-60, 60), y: Bs.y + rnd(-60, 60), vx: 0, vy: 0, a: 0, hp: 3, cd: 2, orbit: k % 2 ? 1 : -1 }); } big('¡HANGARES ABIERTOS!', '#ffd200', 1100); }
    if (Bs.cd <= 0 && d < 1000) { Bs.cd = Bs.hp < 30 ? 1.1 : 1.7; for (let k = -3; k <= 3; k++) { const la = Bs.a + k * 0.16; G.eshots.push({ x: Bs.x + Math.cos(Bs.a) * 70, y: Bs.y + Math.sin(Bs.a) * 70, vx: Math.cos(la) * 330, vy: Math.sin(la) * 330, life: 3 }); } sfx.play('laser'); }
    if (d < 90) hurtP(20);
  }
  // disparos
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; let dead = s.life <= 0;
    for (let k = G.rocks.length - 1; k >= 0 && !dead; k--) { const R = G.rocks[k]; if (dist(s.x, s.y, R.x, R.y) < R.r) { dead = true; R.hp--; ev('hit', s.x, s.y, '#ff8a1a'); R.vx += s.vx * 0.01; R.vy += s.vy * 0.01; if (R.hp <= 0) splitRock(R, k); } }
    for (let k = G.drones.length - 1; k >= 0 && !dead; k--) { const D = G.drones[k]; if (dist(s.x, s.y, D.x, D.y) < 20) { dead = true; D.hp--; ev('hit', s.x, s.y, '#ff2a4d'); if (D.hp <= 0) { G.drones.splice(k, 1); G.kills++; ev('boom', D.x, D.y, '#ff2a4d', 1.2); G.items.push({ x: D.x, y: D.y, k: 'scrap', vx: 0, vy: 0 }); if (M.goal === 'kill' && G.drones.length < 3 && G.kills + G.drones.length < M.n) spawnDrone(G, true); } } }
    if (Bs && !dead && dist(s.x, s.y, Bs.x, Bs.y) < 80) { dead = true; if (Bs.open > 0) { Bs.hp--; ev('hit', s.x, s.y, '#ffd200'); if (Bs.hp <= 0) { ev('boom', Bs.x, Bs.y, '#ffd200', 6); G.boss = null; G.got = 1; } } else { fx.emit(s.x, s.y, 3, '#00f0ff', 120, 0.2, 2); sfx.play('bounce'); } }
    if (dead) G.shots.splice(i, 1);
  }
  for (let i = G.eshots.length - 1; i >= 0; i--) { const s = G.eshots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (s.life <= 0) { G.eshots.splice(i, 1); continue; } if (dist(s.x, s.y, P.x, P.y) < 16) { G.eshots.splice(i, 1); hurtP(10); } }
  // objetos
  const magR = 60 + up.mag * 90;
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i]; it.x += it.vx * dt; it.y += it.vy * dt; it.vx *= Math.exp(-dt); it.vy *= Math.exp(-dt);
    const d = dist(it.x, it.y, P.x, P.y);
    if (d < magR && it.k === 'scrap') { const a = Math.atan2(P.y - it.y, P.x - it.x); it.x += Math.cos(a) * 420 * dt; it.y += Math.sin(a) * 420 * dt; }
    if (d < 30) { G.items.splice(i, 1); if (it.k === 'scrap') { save.scrap++; sfx.play('coin'); } else { G.got++; sfx.play('power'); fx.ring(it.x, it.y, '#ffd200', 60); toast(it.k === 'part' ? `🔩 Pieza ${G.got}/${M.n}` : `⛽ Combustible ${G.got}/${M.n}`, 1200); if (it.k === 'part') P.hp = Math.min(P.max, P.hp + 10); } }
  }
  if (G.beacon && dist(P.x, P.y, G.beacon.x, G.beacon.y) < 120) { G.beacon.on += dt; if (G.beacon.on >= 3) G.got = 1; }
  // objetivo
  const done = M.goal === 'kill' ? G.kills >= M.n : M.goal === 'survive' ? G.t >= M.n : G.got >= M.n;
  if (done) { G.over = true; sfx.play('win'); setTimeout(() => endMission(true), 1200); }
  hud();
}
function hud() {
  const M = G.M, P = G.P;
  const obj = M.goal === 'scrap' ? `🔩 PIEZAS ${G.got}/${M.n}` : M.goal === 'kill' ? `💥 DRONES ${G.kills}/${M.n}` : M.goal === 'beacon' ? (G.beacon.on > 0 ? `📡 ACTIVANDO… ${Math.min(100, Math.round(G.beacon.on / 3 * 100))} %` : '📡 LLEGA A LA BALIZA') : M.goal === 'fuel' ? `⛽ COMBUSTIBLE ${G.got}/${M.n}` : M.goal === 'survive' ? `⏱ AGUANTA ${Math.max(0, Math.ceil(M.n - G.t))} s` : G.boss ? `HALCÓN ${'█'.repeat(Math.ceil(G.boss.hp / 6))}` : '';
  $('hudT').innerHTML = `${G.i + 1}. ${M.name}<small>${obj}</small>`;
  $('hudB').innerHTML = `<span style="color:var(--red)">CASCO ${Math.max(0, Math.round(P.hp))}/${P.max}</span> &nbsp; <span style="color:var(--cyan)">TURBO ${Math.round(P.boost)}%</span> &nbsp; <span style="color:var(--gold)">⚙ ${save.scrap}</span>`;
}
async function endMission(ok) {
  $('hudT').classList.add('hidden'); $('hudB').classList.add('hidden'); touch.show(false); sfx.music(null);
  if (!ok) { $('oTitle').textContent = 'NAVE DESTRUIDA'; $('oSub').textContent = 'Brizna ha guardado una copia. Mejora la nave en el TALLER y vuelve a intentarlo.'; $('oNext').textContent = 'REINTENTAR'; $('oNext').onclick = () => startMission(G.i, true); persist(); return show('over'); }
  const stars = 1 + (G.dmgTaken < G.P.max * 0.3 ? 1 : 0) + (G.dmgTaken === 0 || G.t < 60 ? 1 : 0);
  save.stars[G.i] = Math.max(save.stars[G.i] || 0, stars); save.unlocked = Math.max(save.unlocked, G.i + 2); save.scrap += 5 + G.i * 2; persist(); renderMissions();
  if (G.i === MISSIONS.length - 1) return finale();
  $('oTitle').textContent = 'MISIÓN CUMPLIDA'; $('oSub').textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · +${5 + G.i * 2} ⚙ de recompensa · Tienes ${save.scrap} ⚙ para el TALLER`;
  $('oNext').textContent = 'SIGUIENTE MISIÓN'; $('oNext').onclick = () => startMission(G.i + 1); show('over');
}
async function finale() {
  await chapter('EPÍLOGO', 'RUMBO A CASA', '', '#9d4dff');
  const c = await dialog([say(H, '(por radio, entre chispas) Vale, vale… tú ganas, capitana. ¿Me rescatas o me dejas flotando?'), say(C, 'Brizna, ¿qué opinas?'), say(B, 'Opino que la decisión es suya. Pero tiene una bodega enorme.', ['Rescatarlo (y que trabaje en la nave)', 'Dejarle una baliza y marcharnos'])]);
  if (c === 0) await dialog([say(H, '¿Fregar la cubierta? ¿Yo? …Está bien. Gracias, capitana.'), say(B, 'Tripulación: 3. Humor: mejorable. Rumbo: la Tierra.')]);
  else await dialog([say(C, 'Que te rescate tu propia chatarra, Halcón.'), say(B, 'Baliza lanzada. Rumbo: la Tierra. Tiempo estimado: 4 meses y 3 cafés.')]);
  $('oTitle').textContent = 'FIN'; $('oSub').textContent = `La Aurora vuelve a casa. Estrellas: ${Object.values(save.stars).reduce((a, b) => a + b, 0)}/18. Puedes repetir misiones para mejorar la nave al máximo.`; $('oNext').textContent = 'MISIONES'; $('oNext').onclick = () => show('menu'); show('over');
}

// ================== DIBUJO ==================
const starsBg = Array.from({ length: 260 }, () => ({ x: rnd(-3000, 3000), y: rnd(-3000, 3000), z: rnd(0.1, 0.6), c: pick(['#ffffff', '#9ad8ff', '#ffd8f0']) }));
function draw(dt, t) {
  ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, S.W, S.H);
  const P = G ? G.P : { x: Math.sin(t * 0.1) * 400, y: Math.cos(t * 0.1) * 400, vx: 0, vy: 0 };
  cam.z = clamp(Math.min(S.W, S.H) / 760, 0.55, 1.3);
  cam.x = lerp(cam.x, P.x + P.vx * 0.35, 1 - Math.exp(-5 * dt)); cam.y = lerp(cam.y, P.y + P.vy * 0.35, 1 - Math.exp(-5 * dt));
  for (const s of starsBg) { const x = ((s.x - cam.x * s.z) % S.W + S.W) % S.W, y = ((s.y - cam.y * s.z) % S.H + S.H) % S.H; ctx.fillStyle = s.c; ctx.globalAlpha = s.z * 1.5; ctx.fillRect(x, y, s.z * 3, s.z * 3); }
  ctx.globalAlpha = 1;
  // planeta de fondo
  const px = S.W * 0.78 - cam.x * 0.03, py = S.H * 0.25 - cam.y * 0.03; glowDot(ctx, px, py, 260, '#3a5aff', 0.35); const pg = ctx.createRadialGradient(px - 40, py - 40, 10, px, py, 130); pg.addColorStop(0, '#5a8aff'); pg.addColorStop(1, '#0a1240'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 130, 0, 7); ctx.fill(); ctx.strokeStyle = '#9ad8ff55'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, py, 220, 40, -0.3, 0, 7); ctx.stroke();
  if (!G) return;
  shake *= Math.exp(-8 * dt);
  ctx.save(); ctx.translate(S.W / 2 + rnd(-shake, shake), S.H / 2 + rnd(-shake, shake)); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  ctx.strokeStyle = '#ff2a4d44'; ctx.setLineDash([20, 20]); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, WR, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  if (G.beacon) { const b = G.beacon; glowDot(ctx, b.x, b.y, 140, '#39ff88', 0.4 + Math.sin(t * 4) * 0.2); neon(ctx, '#39ff88', 3, () => { ctx.arc(b.x, b.y, 22, 0, 7); ctx.moveTo(b.x, b.y - 22); ctx.lineTo(b.x, b.y - 60); }); if (b.on > 0) { ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, 120, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, b.on / 3)); ctx.stroke(); } }
  for (const R of G.rocks) { ctx.save(); ctx.translate(R.x, R.y); ctx.rotate(R.a); ctx.fillStyle = R.ice ? '#0a1a2a' : '#140c0a'; ctx.beginPath(); R.pts.forEach((r, i) => { const a = i / R.pts.length * Math.PI * 2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }); ctx.closePath(); ctx.fill(); neon(ctx, R.ice ? '#9ad8ff' : '#ff8a1a', 2, () => { R.pts.forEach((r, i) => { const a = i / R.pts.length * Math.PI * 2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }); ctx.closePath(); }, 0.6); ctx.restore(); }
  for (const it of G.items) { const c = it.k === 'scrap' ? '#ffd200' : it.k === 'part' ? '#00f0ff' : '#39ff88', s = it.k === 'scrap' ? 6 : 13; glowDot(ctx, it.x, it.y, s * 4, c, 0.6); ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(t * 2); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.strokeRect(-s, -s, s * 2, s * 2); ctx.restore(); }
  for (const D of G.drones) { ctx.save(); ctx.translate(D.x, D.y); ctx.rotate(D.a); glowDot(ctx, 0, 0, 40, '#ff2a4d', 0.4); neon(ctx, '#ff2a4d', 2.5, () => { ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); }); ctx.restore(); }
  if (G.boss) { const Bs = G.boss; ctx.save(); ctx.translate(Bs.x, Bs.y); ctx.rotate(Bs.a); glowDot(ctx, 0, 0, 200, Bs.open > 0 ? '#ffd200' : '#ff2a4d', 0.4); ctx.fillStyle = '#12040a'; ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(-60, -70); ctx.lineTo(-90, 0); ctx.lineTo(-60, 70); ctx.closePath(); ctx.fill(); neon(ctx, '#ff2a4d', 5, () => { ctx.moveTo(100, 0); ctx.lineTo(-60, -70); ctx.lineTo(-90, 0); ctx.lineTo(-60, 70); ctx.closePath(); }); if (Bs.open > 0) { ctx.fillStyle = '#ffd200'; ctx.fillRect(-50, -40, 30, 80); } else neon(ctx, '#00f0ff', 2, () => ctx.arc(0, 0, 105, 0, 7), 0.5); ctx.restore(); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const s of G.shots) { ctx.strokeStyle = '#ff2bd6'; ctx.lineWidth = 6; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke(); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  for (const s of G.eshots) { glowDot(ctx, s.x, s.y, 14, '#ff2a4d', 1); }
  ctx.restore();
  const P2 = G.P; if (!(G.over && P2.hp <= 0) && !(P2.inv > 0 && Math.floor(t * 20) % 2)) { ctx.save(); ctx.translate(P2.x, P2.y); ctx.rotate(P2.a); glowDot(ctx, 0, 0, 50, '#9d4dff', 0.45); ctx.fillStyle = '#0a0418'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-14, -14); ctx.lineTo(-8, 0); ctx.lineTo(-14, 14); ctx.closePath(); ctx.fill(); neon(ctx, '#00f0ff', 2.5, () => { ctx.moveTo(22, 0); ctx.lineTo(-14, -14); ctx.lineTo(-8, 0); ctx.lineTo(-14, 14); ctx.closePath(); }); ctx.fillStyle = '#ff2bd6'; ctx.fillRect(2, -3, 8, 6); ctx.restore(); }
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
  // flecha al objetivo
  const tgts = G.beacon ? [G.beacon] : G.boss ? [G.boss] : G.items.filter(i => i.k !== 'scrap');
  let best = null, bd = 1e9; for (const o of tgts) { const d = dist(o.x, o.y, P2.x, P2.y); if (d < bd) { bd = d; best = o; } }
  if (best && bd > 300) { const a = Math.atan2(best.y - P2.y, best.x - P2.x), r = Math.min(S.W, S.H) * 0.36; ctx.save(); ctx.translate(S.W / 2 + Math.cos(a) * r, S.H / 2 + Math.sin(a) * r); ctx.rotate(a); ctx.fillStyle = '#ffd200'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.fill(); ctx.restore(); ctx.fillStyle = '#ffd200'; ctx.font = '700 11px Orbitron'; ctx.textAlign = 'center'; ctx.fillText(Math.round(bd / 10) + ' m', S.W / 2 + Math.cos(a) * (r - 24), S.H / 2 + Math.sin(a) * (r - 24)); }
}
function show(id) { for (const s of ['menu', 'pause', 'over', 'shop']) $(s).classList.toggle('hidden', s !== id); if (id) { screen = id; $('hudT').classList.add('hidden'); $('hudB').classList.add('hidden'); touch.show(false); } }
async function startMission(i, retry) {
  sfx.ensure(); goFull(); show(null); screen = 'story'; G = build(i); cam.x = 0; cam.y = 0;
  if (!retry) { await chapter('MISIÓN ' + (i + 1), MISSIONS[i].name, '', '#9d4dff'); await dialog(MISSIONS[i].intro); }
  sfx.music(i === 5 ? SONGS.hype : SONGS.space);
  screen = 'play'; $('hudT').classList.remove('hidden'); $('hudB').classList.remove('hidden'); touch.show(true);
}
$('bPlay').onclick = () => startMission(Math.min(save.unlocked, MISSIONS.length) - 1);
$('pRes').onclick = () => { paused = false; show(null); screen = 'play'; $('hudT').classList.remove('hidden'); $('hudB').classList.remove('hidden'); touch.show(true); };
$('pRestart').onclick = () => startMission(G.i, true);
$('pMenu').onclick = () => { G = null; show('menu'); sfx.music(null); };
$('oMenu').onclick = () => { G = null; show('menu'); sfx.music(null); };
loop((dt, t) => { if (screen === 'play' && !talking()) { if (hit('KeyP', 'Escape')) { paused = true; show('pause'); } else step(dt); } draw(dt, t); });
show('menu');
if (location.hash === '#dbg') window.dbg = { get G() { return G; }, startMission, save };
