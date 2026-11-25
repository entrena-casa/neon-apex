// ECO — plataformas entre dos épocas. 2077 (presente, en ruinas) y 2045 (pasado, la ciudad viva).
import { $, clamp, lerp, rnd, store, toast, setupCanvas, loop, down, hit, pad, touchControls, usingTouch, goFull, sfx, SONGS, Particles, glowDot, backButton } from '../../comun/lib.js';
import { dialog, chapter, talking } from '../../comun/story.js';
import { LEVELS } from './levels.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(700);
backButton();
const touch = touchControls({ left: 'none', buttons: [
  { id: 'l', label: '◀', left: 16, bottom: 26, size: 78 }, { id: 'r', label: '▶', left: 104, bottom: 26, size: 78 },
  { id: 'j', label: 'SALTO', color: '#39ff88', right: 18, bottom: 26, size: 86 }, { id: 'e', label: '⧗', color: '#ff2bd6', right: 116, bottom: 60, size: 70 }] });
const T = 32;
const C = { past: { a: '#39ff88', b: '#00f0ff', sky: ['#04201e', '#0a4a4a', '#1a8a6a'], name: '2045 · PASADO' }, now: { a: '#ff2bd6', b: '#ff2a4d', sky: ['#14010e', '#3a0626', '#7a1040'], name: '2077 · PRESENTE' } };
const save = Object.assign({ lvl: 0, done: [], k: [], deaths: 0 }, store.get('eco.save', {}));
const persist = () => store.set('eco.save', save);
const prog = () => { $('prog').innerHTML = save.done.length ? `Niveles: <b style="color:var(--green)">${save.done.length}/${LEVELS.length}</b> · Recuerdos: <b style="color:var(--gold)">${save.k.length}/${LEVELS.length}</b>` : ''; $('bPlay').textContent = save.done.length ? 'CONTINUAR' : 'JUGAR'; };
prog();

// ================== HISTORIA ==================
const N = { who: 'NICO', col: '#00f0ff' }, LI = { who: 'LÍA', col: '#ffd200' }, K = { who: 'KAIROS', col: '#ff2bd6' };
const say = (w, txt, choices) => ({ ...w, txt, choices });
const STORY = {
  1: [say(K, 'Pulso detectado. Hola, Nico. Soy KAIROS, el reloj que te dejó tu hermana.'), say(N, '¿Lía? ¿Dónde está?'), say(K, 'Hace 32 años, en 2045, Lía encendió el Eco: una máquina para mirar el pasado. La máquina estalló y la ciudad quedó así.'), say(K, 'Ella no murió. Se quedó atrapada entre dos épocas. Y yo puedo llevarte a las dos.'), say(N, 'Pues vamos. Paso a paso.')],
  2: [say(K, 'Pulsa el botón de época. Lo que es pared en 2077 puede ser aire en 2045… y al revés.'), say(N, '¿Y si me equivoco de época?'), say(K, 'Entonces chocarás con la historia. Literalmente.')],
  3: [say(LI, '…Nico… ¿me oyes? Si encuentras mis cristales de memoria… sabré volver…', null), say(N, '¡LÍA! ¡Te oigo!'), say(K, 'Puedes cambiar de época en pleno salto. Los puentes de una época desaparecen en la otra.')],
  4: [say(K, 'Arriba. Lía guardaba aquí sus planos, en la torre de control.'), say(N, 'Escalones que existen y no existen a la vez. Esto es una locura.')],
  5: [say(LI, 'En 2045 los suelos tenían trampas para los ladrones. En 2077, las ruinas las han tapado… o no.'), say(K, 'Pinchos verdes: sólo en el pasado. Pinchos rosas: sólo en el presente.')],
  6: [say(K, 'La fábrica del Eco. Cuidado: los drones de seguridad del presente siguen activos.'), say(N, '¿Y esos fantasmas verdes?'), say(K, 'Ecos de los guardias de 2045. En el presente no pueden tocarte.')],
  7: [say(LI, 'Bajo la fábrica está el núcleo. Yo bajé por aquí… y ya no subí.'), say(N, 'Voy a bajar a buscarte.')],
  8: [say(K, 'Guardianes de las dos épocas. Tendrás que bailar entre años, Nico.'), say(LI, 'Nico, el Eco me está borrando. Date prisa.', null)],
  9: [say(K, 'Estamos dentro del Eco. Aquí las dos épocas se mezclan.'), say(N, 'Lía, aguanta. Ya casi estoy.')],
  10: [say(LI, 'Te veo. Estás justo… al otro lado.'), say(K, 'Último tramo. Lo que hagas arriba decidirá cómo termina esto.')],
};
async function ending() {
  const all = save.k.length >= LEVELS.length;
  await chapter('FINAL', 'LÍA', '', '#ffd200');
  await dialog([say(LI, 'Nico… has venido.'), say(N, 'Te dije que vendría. Siempre vengo.'), say(K, all ? 'Tengo todos sus recuerdos. Puedo devolverla a 2077… pero el Eco se cerrará para siempre.' : 'Me faltan recuerdos suyos. Si la saco ahora, puede que no recuerde quién es.')]);
  const c = await dialog([say(K, '¿Qué hacemos?', ['Traerla a casa', 'Quedarme con ella en el Eco'])]);
  if (c === 1) { await dialog([say(N, 'Si ella no puede salir, yo me quedo.'), say(LI, 'Tonto. Pero gracias.'), say(K, 'Desde fuera, la ciudad ve dos luces en la torre. Dicen que, si miras bien, saludan.')]); finish('FINAL: DOS LUCES', 'Os quedasteis juntos en el Eco. Hay finales que no son tristes del todo.'); }
  else if (all) { await dialog([say(K, 'Recuerdos cargados. Cerrando el Eco…'), say(LI, 'Huele a lluvia. Huele a casa.'), say(N, 'Bienvenida a 2077. Está hecho polvo, pero lo arreglaremos.')]); finish('FINAL VERDADERO: CASA', '¡Encontraste todos los recuerdos de Lía! El Eco se cerró y la ciudad empezó a sanar.'); }
  else { await dialog([say(LI, '¿Nico? Sé que te conozco… dame tiempo.'), say(K, 'Faltaban recuerdos. Vuelve a por ellos: quizá aún estén en los niveles.')]); finish('FINAL: CASI', `Lía volvió, pero sin todos sus recuerdos (${save.k.length}/${LEVELS.length}). Busca los cristales que faltan para el final verdadero.`); }
}
function finish(t, sub) { save.ended = true; persist(); $('oTitle').textContent = t; $('oSub').textContent = sub; show('over'); sfx.music(SONGS.calm); }

// ================== NIVEL ==================
let L = null, P = null, era = 'now', screen = 'menu', paused = false, deathsHere = 0, mobs = [], glitch = 0, camX = 0, camY = 0, shake = 0, won = false;
const tileAt = (cx, cy) => { if (!L || cy < 0 || cx < 0 || cx >= L.w) return '.'; if (cy >= L.h) return '.'; return L.g[cy][cx]; };
const solidIn = (ch, e) => ch === '#' || (ch === 'P' && e === 'past') || (ch === 'R' && e === 'now');
const spikeIn = (ch, e) => ch === '^' || (ch === 'a' && e === 'past') || (ch === 'b' && e === 'now');
function loadLevel(i) {
  const D = LEVELS[i]; const h = D.rows.length, w = Math.max(...D.rows.map(r => r.length));
  L = { i, name: D.name, w, h, g: D.rows.map(r => r.padEnd(w, '.').split('')), k: null, exit: null, start: null };
  mobs = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = L.g[y][x];
    if (ch === 'S') { L.start = [x, y]; L.g[y][x] = '.'; }
    if (ch === 'E') { L.exit = [x, y]; L.g[y][x] = '.'; }
    if (ch === 'K') { L.k = { x: x * T + T / 2, y: y * T + T / 2, got: save.k.includes(i) }; L.g[y][x] = '.'; }
    if (ch === 'D' || ch === 'G') { mobs.push({ kind: ch, era: ch === 'D' ? 'now' : 'past', x: x * T + 4, y: y * T + 8, w: 24, h: 24, vx: ch === 'D' ? 70 : -55 }); L.g[y][x] = '.'; }
  }
  era = D.era; won = false;
  P = { x: L.start[0] * T + 5, y: L.start[1] * T + 2, w: 22, h: 30, vx: 0, vy: 0, ground: false, coyote: 0, buf: 0, face: 1, dead: 0, scarf: [] };
  camX = P.x; camY = P.y; deathsHere = 0; $('pSkip').classList.add('hidden');
  updateEraHud();
}
function rectSolid(x, y, w, h, e) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (solidIn(tileAt(cx, cy), e) || cx < 0 || cx >= L.w) return true;
  return false;
}
function rectSpike(x, y, w, h, e) {
  const x0 = Math.floor((x + 3) / T), x1 = Math.floor((x + w - 3) / T), y0 = Math.floor((y + 6) / T), y1 = Math.floor((y + h - 1) / T);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (spikeIn(tileAt(cx, cy), e)) return true;
  return false;
}
function switchEra() {
  const other = era === 'now' ? 'past' : 'now';
  if (rectSolid(P.x, P.y, P.w, P.h, other)) { sfx.play('hurt'); shake = 4; fx.emit(P.x + P.w / 2, P.y + P.h / 2, 12, '#ff2a4d', 140, 0.3, 3); toast('⛔ Ahí hay algo sólido en la otra época', 1200); return; }
  era = other; glitch = 1; sfx.play('dash'); fx.ring(P.x + P.w / 2, P.y + P.h / 2, C[era].a, 90); fx.emit(P.x + P.w / 2, P.y + P.h / 2, 24, C[era].a, 260, 0.5, 3);
  updateEraHud();
}
function updateEraHud() { const e = $('era'); e.textContent = C[era].name; e.style.color = C[era].a; e.style.textShadow = `0 0 12px ${C[era].a}`; $('hudL').innerHTML = `NIVEL ${L.i + 1} · ${L.name}<br><span style="color:var(--gold)">${L.k && L.k.got ? '◆ RECUERDO' : '◇ recuerdo'}</span>`; }
function die() {
  if (P.dead) return; P.dead = 0.9; save.deaths++; deathsHere++; persist();
  fx.emit(P.x + P.w / 2, P.y + P.h / 2, 50, C[era].a, 380, 0.9, 4); fx.emit(P.x + P.w / 2, P.y + P.h / 2, 20, '#fff', 260, 0.5, 3); sfx.play('boom'); shake = 10;
  if (deathsHere >= 6) $('pSkip').classList.remove('hidden');
  if (deathsHere === 6) toast('Si te atascas, en PAUSA puedes SALTAR NIVEL', 3000);
}
function respawn() { const e = LEVELS[L.i].era; era = e; P.x = L.start[0] * T + 5; P.y = L.start[1] * T + 2; P.vx = P.vy = 0; P.dead = 0; P.scarf = []; updateEraHud(); glitch = 0.6; }

// ================== FÍSICA ==================
const RUN = 250, ACC = 2400, AIR = 1600, GRAV = 2000, JUMP = 650, MAXF = 900;
let jumpHeld = false;
function input() {
  const g = pad();
  const l = down('ArrowLeft', 'KeyA') || touch.btn.l || (g && (g.lx < -0.3 || g.left)), r = down('ArrowRight', 'KeyD') || touch.btn.r || (g && (g.lx > 0.3 || g.right));
  const jp = hit('Space', 'ArrowUp', 'KeyW') || touch.tapped('j') || (g && g.a && !jumpHeld);
  const jh = down('Space', 'ArrowUp', 'KeyW') || touch.btn.j || (g && g.a);
  const sw = hit('ShiftLeft', 'ShiftRight', 'KeyK', 'KeyQ', 'KeyX') || touch.tapped('e') || (g && (g.x || g.b || g.rb) && !input.swHeld);
  input.swHeld = g && (g.x || g.b || g.rb);
  return { dir: (r ? 1 : 0) - (l ? 1 : 0), jp, jh, sw };
}
function step(dt) {
  if (!L || won) return;
  if (P.dead) { P.dead -= dt; if (P.dead <= 0) respawn(); return; }
  const I = input(); jumpHeld = I.jh;
  if (I.sw) switchEra();
  if (hit('KeyR')) { die(); return; }
  // horizontal
  const target = I.dir * RUN, a = P.ground ? ACC : AIR;
  if (I.dir) P.face = I.dir;
  P.vx = P.vx < target ? Math.min(target, P.vx + a * dt) : Math.max(target, P.vx - a * dt);
  // salto con tiempo de coyote y búfer
  P.coyote = P.ground ? 0.1 : P.coyote - dt; P.buf = I.jp ? 0.12 : P.buf - dt;
  if (P.buf > 0 && P.coyote > 0) { P.vy = -JUMP; P.buf = 0; P.coyote = 0; sfx.play('jump'); fx.emit(P.x + P.w / 2, P.y + P.h, 8, '#fff', 120, 0.3, 2, 1.2, -Math.PI / 2); }
  if (!I.jh && P.vy < -260) P.vy = -260; // salto variable
  P.vy = Math.min(MAXF, P.vy + GRAV * dt);
  // mover y chocar (por ejes)
  let nx = P.x + P.vx * dt;
  if (rectSolid(nx, P.y, P.w, P.h, era)) { nx = P.vx > 0 ? Math.floor((nx + P.w) / T) * T - P.w - 0.01 : Math.floor(nx / T + 1) * T + 0.01; P.vx = 0; }
  P.x = nx;
  let ny = P.y + P.vy * dt; const wasGround = P.ground; P.ground = false;
  if (rectSolid(P.x, ny, P.w, P.h, era)) {
    if (P.vy > 0) { ny = Math.floor((ny + P.h) / T) * T - P.h - 0.01; P.ground = true; if (!wasGround && P.vy > 400) { sfx.play('step'); fx.emit(P.x + P.w / 2, ny + P.h, 6, '#ffffff88', 90, 0.25, 2, 1, -Math.PI / 2); } }
    else ny = Math.floor(ny / T + 1) * T + 0.01;
    P.vy = 0;
  }
  P.y = ny;
  if (P.y > L.h * T + 80 || rectSpike(P.x, P.y, P.w, P.h, era)) return die();
  // enemigos de cada época
  for (const m of mobs) {
    const nxm = m.x + m.vx * dt, ahead = m.vx > 0 ? nxm + m.w : nxm, footY = m.y + m.h + 2;
    const blocked = rectSolid(nxm, m.y, m.w, m.h, m.era) || !solidIn(tileAt(Math.floor(ahead / T), Math.floor(footY / T)), m.era);
    if (blocked) m.vx = -m.vx; else m.x = nxm;
    if (m.era === era && P.x < m.x + m.w - 3 && P.x + P.w > m.x + 3 && P.y < m.y + m.h - 3 && P.y + P.h > m.y + 4) return die();
  }
  // recuerdo y salida
  if (L.k && !L.k.got && Math.abs(P.x + P.w / 2 - L.k.x) < 24 && Math.abs(P.y + P.h / 2 - L.k.y) < 28) { L.k.got = true; if (!save.k.includes(L.i)) save.k.push(L.i); persist(); sfx.play('coin'); fx.ring(L.k.x, L.k.y, '#ffd200', 70); fx.emit(L.k.x, L.k.y, 30, '#ffd200', 260, 0.7, 3); toast('◆ Has encontrado un recuerdo de Lía', 1800); updateEraHud(); }
  const ex = L.exit[0] * T + T / 2, ey = L.exit[1] * T + T / 2;
  if (Math.abs(P.x + P.w / 2 - ex) < 20 && Math.abs(P.y + P.h / 2 - ey) < 30) levelDone();
  // bufanda
  P.scarf.unshift([P.x + P.w / 2 - P.face * 6, P.y + 9]); if (P.scarf.length > 9) P.scarf.pop();
}
async function levelDone() {
  won = true; sfx.play('win'); fx.ring(P.x + P.w / 2, P.y + P.h / 2, '#ffd200', 140);
  if (!save.done.includes(L.i)) save.done.push(L.i);
  save.lvl = Math.max(save.lvl, L.i + 1); persist(); prog();
  await new Promise(r => setTimeout(r, 900));
  if (L.i + 1 >= LEVELS.length) { touch.show(false); return ending(); }
  startLevel(L.i + 1);
}
async function startLevel(i) {
  screen = 'story'; show(null, true); touch.show(false);
  loadLevel(i);
  const ch = i === 0 ? ['CAPÍTULO 1', 'LA CIUDAD ROTA'] : i === 3 ? ['CAPÍTULO 2', 'LA TORRE'] : i === 6 ? ['CAPÍTULO 3', 'EL NÚCLEO'] : null;
  if (ch) await chapter(ch[0], ch[1], '', C[era].a);
  if (STORY[i + 1]) await dialog(STORY[i + 1]);
  screen = 'play'; touch.show(true); $('era').classList.remove('hidden'); $('hudL').classList.remove('hidden');
}

// ================== DIBUJO ==================
function skyline(off, col, h, seed, era2) {
  ctx.fillStyle = col; let x = -((off % 120) + 120);
  for (let i = 0; x < S.W + 120; i++) {
    const k = Math.floor((off + x) / 120 + 1000) + seed, bh = h * (0.4 + ((k * 9301 + 49297) % 233280) / 233280 * 0.8);
    if (era2 === 'now' && (k % 3 === 0)) { ctx.beginPath(); ctx.moveTo(x, S.H); ctx.lineTo(x, S.H - bh); ctx.lineTo(x + 50, S.H - bh * 0.7); ctx.lineTo(x + 90, S.H - bh * 0.85); ctx.lineTo(x + 110, S.H); ctx.fill(); }
    else ctx.fillRect(x, S.H - bh, 100, bh);
    x += 120;
  }
}
function draw(dt, t) {
  const E = C[era];
  const g = ctx.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, E.sky[0]); g.addColorStop(0.6, E.sky[1]); g.addColorStop(1, E.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);
  if (!L) return;
  const z = clamp(S.H / (Math.max(L.h, 9) * T + 40), 0.55, 1.6);
  const tx = P.x + P.vx * 0.25, ty = P.y;
  camX = lerp(camX, tx, 1 - Math.exp(-6 * dt)); camY = lerp(camY, ty, 1 - Math.exp(-5 * dt));
  const vw = S.W / z, vh = S.H / z;
  let cx = clamp(camX - vw / 2, -40, Math.max(-40, L.w * T - vw + 40)), cy = L.h * T > vh ? clamp(camY - vh / 2, -40, L.h * T - vh + 40) : (L.h * T - vh) / 2;
  if (L.w * T < vw) cx = (L.w * T - vw) / 2;
  // fondo con paralaje
  ctx.globalAlpha = 0.5; skyline(cx * 0.2, era === 'past' ? '#0a3a34' : '#2a0418', S.H * 0.55, 3, era); ctx.globalAlpha = 0.8; skyline(cx * 0.45, era === 'past' ? '#062a26' : '#1a020e', S.H * 0.4, 7, era); ctx.globalAlpha = 1;
  if (era === 'now') { ctx.strokeStyle = '#ff2bd633'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 60; i++) { const x = (i * 97 + t * 400) % S.W, y = (i * 53 + t * 900) % S.H; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); } ctx.stroke(); }
  else { for (let i = 0; i < 30; i++) { ctx.fillStyle = '#39ff8866'; ctx.fillRect((i * 131 + Math.sin(t + i) * 20) % S.W, (i * 71 + t * 20) % S.H, 2, 2); } }
  shake *= Math.exp(-9 * dt);
  ctx.save(); ctx.translate(rnd(-shake, shake), rnd(-shake, shake)); ctx.scale(z, z); ctx.translate(-cx, -cy);
  const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(L.w - 1, Math.floor((cx + vw) / T)), y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(L.h - 1, Math.floor((cy + vh) / T));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = L.g[y][x], px = x * T, py = y * T;
    if (ch === '#') { ctx.fillStyle = era === 'past' ? '#0c2a2a' : '#2a0c22'; ctx.fillRect(px, py, T, T); const up = tileAt(x, y - 1); if (!solidIn(up, era) && up !== '^') { ctx.fillStyle = E.a; ctx.fillRect(px, py, T, 3); ctx.globalAlpha = 0.25; ctx.fillRect(px, py - 3, T, 3); ctx.globalAlpha = 1; } }
    else if (ch === 'P' || ch === 'R') {
      const mine = (ch === 'P') === (era === 'past'), col = ch === 'P' ? C.past.a : C.now.a;
      if (mine) { ctx.fillStyle = col + '33'; ctx.fillRect(px + 1, py + 1, T - 2, T - 2); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, T - 4, T - 4); ctx.fillStyle = col; ctx.fillRect(px + 2, py + 2, T - 4, 3); }
      else { ctx.strokeStyle = col + '55'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(px + 4, py + 4, T - 8, T - 8); ctx.setLineDash([]); }
    }
    else if (ch === '^' || ch === 'a' || ch === 'b') {
      const live = spikeIn(ch, era), col = ch === '^' ? '#ff2a4d' : ch === 'a' ? C.past.a : C.now.a;
      ctx.fillStyle = live ? col : col + '33'; ctx.beginPath(); for (let k = 0; k < 3; k++) { const sx = px + k * T / 3; ctx.moveTo(sx, py + T); ctx.lineTo(sx + T / 6, py + (live ? 8 : 20)); ctx.lineTo(sx + T / 3, py + T); } ctx.fill();
      if (live) glowDot(ctx, px + T / 2, py + T - 6, 22, col, 0.35);
    }
  }
  // salida
  const ex = L.exit[0] * T + T / 2, ey = L.exit[1] * T + T / 2;
  glowDot(ctx, ex, ey, 60, '#ffd200', 0.5 + Math.sin(t * 3) * 0.15); ctx.strokeStyle = '#ffd200'; ctx.lineWidth = 3; ctx.strokeRect(ex - 13, ey - 18, 26, 34); ctx.fillStyle = '#ffd20055'; ctx.fillRect(ex - 13, ey - 18, 26, 34);
  for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; ctx.fillStyle = '#fff'; ctx.fillRect(ex + Math.cos(a) * 20, ey + Math.sin(a) * 24, 2, 2); }
  // recuerdo
  if (L.k && !L.k.got) { const kx = L.k.x, ky = L.k.y + Math.sin(t * 3) * 4; glowDot(ctx, kx, ky, 40, '#ffd200', 0.7); ctx.save(); ctx.translate(kx, ky); ctx.rotate(t); ctx.fillStyle = '#ffd200'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0); ctx.fill(); ctx.restore(); }
  // enemigos
  for (const m of mobs) {
    const live = m.era === era, col = m.kind === 'D' ? C.now.b : C.past.a;
    ctx.globalAlpha = live ? 1 : 0.22;
    if (m.kind === 'D') { glowDot(ctx, m.x + 12, m.y + 12, 34, col, live ? 0.5 : 0.1); ctx.fillStyle = '#12020a'; ctx.fillRect(m.x, m.y + 4, m.w, m.h - 8); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(m.x, m.y + 4, m.w, m.h - 8); ctx.fillStyle = col; ctx.fillRect(m.x + (m.vx > 0 ? 14 : 4), m.y + 9, 6, 6); ctx.fillRect(m.x - 2, m.y + Math.sin(t * 30) * 2, 28, 2); }
    else { ctx.fillStyle = col + '88'; ctx.beginPath(); ctx.arc(m.x + 12, m.y + 10, 11, Math.PI, 0); ctx.lineTo(m.x + 23, m.y + 24); for (let k = 0; k < 4; k++) ctx.lineTo(m.x + 23 - k * 6 - 3, m.y + 20 + (k % 2) * 4 + Math.sin(t * 8 + k) * 2); ctx.lineTo(m.x + 1, m.y + 24); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(m.x + 7, m.y + 7, 3, 4); ctx.fillRect(m.x + 14, m.y + 7, 3, 4); }
    ctx.globalAlpha = 1;
  }
  // jugador
  if (!P.dead) {
    ctx.strokeStyle = E.a; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); P.scarf.forEach((p, i) => { const sx = p[0] - P.face * i * 2.2, sy = p[1] + i * 0.8 + Math.sin(t * 12 + i) * 1.5; i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke();
    glowDot(ctx, P.x + P.w / 2, P.y + P.h / 2, 40, E.b, 0.35);
    const run = Math.abs(P.vx) > 20 && P.ground ? Math.sin(t * 22) * 3 : 0;
    ctx.fillStyle = '#0a0418'; ctx.fillRect(P.x + 3, P.y + 10, P.w - 6, P.h - 16);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(P.x + 3, P.y + 10, P.w - 6, P.h - 16);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.x + P.w / 2, P.y + 6, 7, 0, 7); ctx.fill();
    ctx.fillStyle = E.a; ctx.fillRect(P.x + P.w / 2 + P.face * 2 - 2, P.y + 4, 5, 3);
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(P.x + 7, P.y + P.h - 6); ctx.lineTo(P.x + 7 + run, P.y + P.h); ctx.moveTo(P.x + P.w - 7, P.y + P.h - 6); ctx.lineTo(P.x + P.w - 7 - run, P.y + P.h); ctx.stroke();
    ctx.fillStyle = E.a; ctx.fillRect(P.x + (P.face > 0 ? P.w - 6 : 2), P.y + 15, 4, 4); // reloj
  }
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
  // efecto de cambio de época
  if (glitch > 0) { glitch -= dt * 2.5; ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { ctx.fillStyle = (i % 2 ? C.past.a : C.now.a) + '33'; ctx.fillRect(0, rnd(S.H), S.W, rnd(4, 18) * glitch); } ctx.globalAlpha = glitch * 0.25; ctx.fillStyle = E.a; ctx.fillRect(0, 0, S.W, S.H); ctx.restore(); }
}

// ================== FLUJO ==================
function show(id, keepHud) { for (const s of ['menu', 'levels', 'pause', 'over']) $(s).classList.toggle('hidden', s !== id); if (id) { screen = id; $('era').classList.add('hidden'); $('hudL').classList.add('hidden'); touch.show(false); } }
$('bPlay').onclick = async () => { sfx.ensure(); goFull(); sfx.music(SONGS.calm); const i = Math.min(save.lvl, LEVELS.length - 1); if (save.lvl >= LEVELS.length) return openLevels(); startLevel(i); };
function openLevels() {
  show('levels'); const el = $('lvList'); el.innerHTML = '';
  LEVELS.forEach((l, i) => { const b = document.createElement('button'); b.innerHTML = `${i + 1}${save.k.includes(i) ? '<small>◆</small>' : ''}`; b.className = save.done.includes(i) ? 'done' : ''; b.disabled = i > save.lvl; b.title = l.name; b.onclick = () => { sfx.music(SONGS.calm); goFull(); startLevel(i); }; el.appendChild(b); });
}
$('bLevels').onclick = openLevels;
$('lvBack').onclick = () => show('menu');
$('pRes').onclick = () => { paused = false; show(null); screen = 'play'; $('era').classList.remove('hidden'); $('hudL').classList.remove('hidden'); touch.show(true); };
$('pRestart').onclick = () => { $('pRes').onclick(); respawn(); };
$('pSkip').onclick = () => { $('pRes').onclick(); levelDone(); };
$('pMenu').onclick = () => { paused = false; L = null; show('menu'); prog(); sfx.music(null); };
$('oMenu').onclick = () => { L = null; show('menu'); prog(); };

loop((dt, t) => {
  if (screen === 'play' && !talking()) {
    if (hit('KeyP', 'Escape')) { paused = true; show('pause'); }
    else step(dt);
  }
  draw(dt, t);
});
show('menu');
if (location.hash === '#dbg') window.dbg = { get P() { return P; }, get L() { return L; }, get era() { return era; }, startLevel, switchEra, die, save };
