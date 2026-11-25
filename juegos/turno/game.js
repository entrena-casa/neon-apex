// ÚLTIMO TURNO — sigilo cenital con historia. Recoge los paquetes sin que te vean y llega a la salida.
import { $, clamp, lerp, rnd, dist, wrapA, store, toast, big, setupCanvas, loop, down, hit, pad, touchControls, goFull, sfx, SONGS, Particles, neon, glowDot, backButton } from '../../comun/lib.js';
import { dialog, chapter, talking } from '../../comun/story.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(700);
backButton();
const touch = touchControls({ left: 'stick', buttons: [{ id: 'emp', label: 'PULSO', color: '#00f0ff', right: 20, bottom: 30, size: 88 }, { id: 'run', label: 'CORRER', color: '#ff8a1a', right: 122, bottom: 40, size: 66 }] });
const T = 40;
// # muro · . suelo · h sombra · S inicio · p paquete · X salida · r robot (patrulla horizontal) · v robot (vertical) · c cámara · B centinela · Y pilón
const MISSIONS = [
  { name: 'PRIMER REPARTO', map: [
    '################################',
    '#S....#.................#......#',
    '#.....#.................#..p...#',
    '#.....#.....r...........#......#',
    '#.....#.................####.###',
    '#..........hhh.................#',
    '#..........hhh.........v.......#',
    '#####...####...................#',
    '#.......#......########........#',
    '#.......#......#......#........#',
    '#..p....#......#..X...#...r....#',
    '#.......#......#......#........#',
    '#..............#......#........#',
    '#.....................h........#',
    '#hhh..................h........#',
    '################################'] },
  { name: 'BARRIO VIGILADO', map: [
    '####################################',
    '#S.....#..........c.......#....p...#',
    '#......#..................#........#',
    '#......#....hhh...........#..v.....#',
    '#......######hh....r......#........#',
    '#.............................######',
    '#hhh...............................#',
    '#hhh....######......######.........#',
    '#.......#....#......#....#...r.....#',
    '#...p...#....#..c...#.X..#.........#',
    '#.......#....#......#....#.........#',
    '#.......##.###......###.##....hhh..#',
    '#..............r...............hhh.#',
    '#..........................p.......#',
    '####################################'] },
  { name: 'EL MERCADO', map: [
    '########################################',
    '#S..#.....hh.......#.........hh......p.#',
    '#...#.....hh...r...#....v....hh........#',
    '#...#..............#...................#',
    '#...####..####.....###.###...######.####',
    '#..........................c...........#',
    '#..hh...r..........hh..............r...#',
    '#..hh..............hh..................#',
    '#######.#####..#########..######.#######',
    '#.....#.....#..#.......#..#............#',
    '#..p..#..v..#..#...X...#..#....c....p..#',
    '#.....#.....#..#.......#..#............#',
    '#..........hh..####.####.......hh......#',
    '#....r.....hh..................hh..r...#',
    '#hh...................p................#',
    '########################################'] },
  { name: 'LA FÁBRICA', map: [
    '##########################################',
    '#S......#....c.....#.........#.....p.....#',
    '#.......#..........#....r....#...........#',
    '#..hh...#...####...#.........#...v.......#',
    '#..hh.......#..#.......hhh...............#',
    '#######.....#p.#.......hhh....#####..#####',
    '#.......r...#..#..c...........#..........#',
    '#...........####..............#....r.....#',
    '#....v.................r......#..........#',
    '#.............#####.####......####.#######',
    '####.####.....#.........#................#',
    '#.......#..c..#....X....#......hhh...c...#',
    '#...p...#.....#.........#......hhh.......#',
    '#.......#.....####.######..........r.....#',
    '#hh.........r..............v.......p...hh#',
    '##########################################'] },
  { name: 'EL CENTINELA', boss: true, map: [
    '##################################',
    '#S...............................#',
    '#..Y.......hh..........hh.....Y..#',
    '#..........hh..........hh........#',
    '#.....####............####.......#',
    '#.....#..................#.......#',
    '#................B...............#',
    '#.....#..................#.......#',
    '#.....####............####.......#',
    '#..........hh..........hh........#',
    '#..Y.......hh..........hh.....Y..#',
    '#................X...............#',
    '##################################'] },
];
const M = { who: 'MARA', col: '#ff8a1a' }, TO = { who: 'TOMÁS', col: '#39ff88' }, RA = { who: 'RADIO', col: '#00f0ff' }, OR = { who: 'ORDEN', col: '#ff2a4d' };
const say = (w, txt, choices) => ({ ...w, txt, choices });
const INTRO = [
  [say(RA, 'Aquí Radio Esperanza. Si alguien me escucha: los robots de ORDEN controlan la ciudad. Quedamos pocos.'), say(M, 'Y yo soy la única que sigue repartiendo. Medicinas, cartas, pilas. Lo que haga falta.'), say(TO, 'Mara, tengo dos paquetes en el barrio viejo. Los robots patrullan. Que no te vean.'), say(TO, 'Sus luces rojas son lo que miran. Las zonas oscuras te esconden. Y si te pillan… usa el pulso.')],
  [say(TO, 'Han puesto cámaras. Giran despacio, pero si te ven, avisan a todos.'), say(M, 'Las cámaras también se pueden apagar un ratito con el pulso, ¿no?'), say(TO, 'Exacto. Pero el pulso tarda en recargarse. Elige bien.')],
  [say(RA, 'Mucha gente se esconde en el mercado. Necesitan comida y noticias.'), say(M, 'Tres paquetes. Mercado lleno de robots. Martes normal.')],
  [say(TO, 'Mara… la fábrica de ORDEN. Dentro está el chip que controla a los robots del barrio.'), say(M, 'Si lo saco, ¿se apagan?'), say(TO, 'Se vuelven locos un rato. Suficiente para que la gente salga a la calle.')],
  [say(OR, 'REPARTIDORA DETECTADA. ACTIVANDO CENTINELA.'), say(M, 'Vaya. Me han pillado.'), say(TO, '¡Los pilones de energía! Si lo atraes junto a un pilón y lanzas el pulso ahí, lo sobrecargas.'), say(M, 'Tres pilones, tres golpes. Vamos.')],
];
const OUTRO = [
  [say(TO, 'Bien hecho. Esta noche hay medicinas en el barrio viejo.')],
  [say(RA, 'Ha llegado el mensaje. La gente empieza a moverse.')],
  [say(TO, 'El mercado está contento. Pero ORDEN ya sabe tu nombre.'), say(M, 'Que lo apunten bien: M-A-R-A.')],
  [say(TO, '¡El chip! Los robots se están volviendo locos. Ahora viene lo difícil.')],
];

// ================== ESTADO ==================
const save = Object.assign({ unlocked: 1, stars: {} }, store.get('turno.save', {}));
const persist = () => store.set('turno.save', save);
let G = null, screen = 'menu', paused = false, cam = { x: 0, y: 0 }, shake = 0;
function renderMissions() {
  const el = $('msList'); el.innerHTML = '';
  MISSIONS.forEach((m, i) => { const b = document.createElement('button'); b.disabled = i >= save.unlocked; const s = save.stars[i] || 0; b.innerHTML = `${i + 1}. ${m.name}<span>${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`; b.onclick = () => startMission(i); el.appendChild(b); });
  $('bPlay').textContent = save.unlocked > 1 ? 'CONTINUAR' : 'JUGAR';
}
renderMissions();
function build(i) {
  const D = MISSIONS[i], h = D.map.length, w = Math.max(...D.map.map(r => r.length));
  const g = D.map.map(r => r.padEnd(w, '#').split(''));
  const st = { i, name: D.name, boss: !!D.boss, w, h, g, pk: [], bots: [], cams: [], pylons: [], bullets: [], exit: null, got: 0, hearts: 3, emp: 0, alarm: 0, alarms: 0, t: 0, meter: 0, over: false, P: null, B: null };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = g[y][x], cx = x * T + T / 2, cy = y * T + T / 2;
    if ('SpXrvcBY'.includes(ch)) g[y][x] = '.';
    if (ch === 'S') st.P = { x: cx, y: cy, vx: 0, vy: 0, r: 13, inv: 0, a: 0 };
    if (ch === 'p') st.pk.push({ x: cx, y: cy, got: false });
    if (ch === 'X') st.exit = { x: cx, y: cy };
    if (ch === 'r' || ch === 'v') st.bots.push({ x: cx, y: cy, a: ch === 'r' ? 0 : Math.PI / 2, dir: ch === 'r' ? [1, 0] : [0, 1], stun: 0, chase: false, path: [], pathT: 0, fire: rnd(1, 2), look: 0, home: [cx, cy] });
    if (ch === 'c') st.cams.push({ x: cx, y: cy, base: rnd(Math.PI * 2), a: 0, stun: 0 });
    if (ch === 'Y') st.pylons.push({ x: cx, y: cy, used: false });
    if (ch === 'B') st.B = { x: cx, y: cy, r: 34, hp: st.pylons.length ? 3 : 3, a: 0, fire: 2, stun: 0, path: [], pathT: 0, hurt: 0 };
  }
  if (st.boss) st.pk = [];
  return st;
}
const wall = (x, y) => { const cx = Math.floor(x / T), cy = Math.floor(y / T); return cx < 0 || cy < 0 || cx >= G.w || cy >= G.h || G.g[cy][cx] === '#'; };
const shade = (x, y) => { const cx = Math.floor(x / T), cy = Math.floor(y / T); return G.g[cy] && G.g[cy][cx] === 'h'; };
function los(ax, ay, bx, by) { const n = Math.ceil(dist(ax, ay, bx, by) / 10); for (let i = 1; i < n; i++) { const t = i / n; if (wall(lerp(ax, bx, t), lerp(ay, by, t))) return false; } return true; }
function moveCircle(o, r, dx, dy) {
  o.x += dx; for (const s of [-1, 1]) if (wall(o.x + s * r, o.y - r * 0.7) || wall(o.x + s * r, o.y + r * 0.7)) { o.x -= dx; break; }
  o.y += dy; for (const s of [-1, 1]) if (wall(o.x - r * 0.7, o.y + s * r) || wall(o.x + r * 0.7, o.y + s * r)) { o.y -= dy; break; }
}
function bfsNext(fx_, fy, tx, ty) {
  const sx = Math.floor(fx_ / T), sy = Math.floor(fy / T), gx = Math.floor(tx / T), gy = Math.floor(ty / T);
  const key = (x, y) => y * G.w + x, prev = new Map([[key(sx, sy), -1]]), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift(); if (x === gx && y === gy) break; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (nx < 0 || ny < 0 || nx >= G.w || ny >= G.h || G.g[ny][nx] === '#' || prev.has(k)) continue; prev.set(k, key(x, y)); q.push([nx, ny]); } }
  let k = key(gx, gy); if (!prev.has(k)) return null; const path = [];
  while (k !== key(sx, sy) && k !== -1) { path.push([(k % G.w) * T + T / 2, Math.floor(k / G.w) * T + T / 2]); k = prev.get(k); }
  return path.reverse();
}
const FOV = 0.55, RANGE = 230;
function sees(ox, oy, a, range, fov) {
  const P = G.P, d = dist(ox, oy, P.x, P.y), rr = range * (shade(P.x, P.y) ? 0.45 : 1) * (G.running ? 1.25 : 1);
  if (d > rr) return 0; if (Math.abs(wrapA(Math.atan2(P.y - oy, P.x - ox) - a)) > fov) { return d < 55 && G.running ? 0.6 : 0; }
  if (!los(ox, oy, P.x, P.y)) return 0; return 1.4 - d / rr;
}
function raiseAlarm() { if (G.alarm <= 0) { G.alarms++; sfx.play('hurt'); big('¡TE HAN VISTO!', '#ff2a4d', 1000); } G.alarm = 7; G.meter = 1; for (const b of G.bots) b.chase = true; }
function hurt() { if (G.P.inv > 0) return; G.hearts--; G.P.inv = 1.3; shake = 10; sfx.play('hurt'); fx.emit(G.P.x, G.P.y, 20, '#ff2a4d', 260, 0.5, 4); if (G.hearts <= 0) fail(); }
function fail() { G.over = true; sfx.play('lose'); setTimeout(() => { $('oTitle').textContent = 'MISIÓN FALLIDA'; $('oSub').textContent = 'ORDEN te ha atrapado. Prueba otra ruta: las sombras son tus amigas.'; $('oNext').textContent = 'REINTENTAR'; $('oNext').onclick = () => startMission(G.i, true); show('over'); }, 900); }
function emp() {
  if (G.emp > 0) return; G.emp = 7; const P = G.P; sfx.play('power'); fx.ring(P.x, P.y, '#00f0ff', 140); fx.emit(P.x, P.y, 40, '#00f0ff', 330, 0.6, 3); shake = 5;
  for (const b of G.bots) if (dist(b.x, b.y, P.x, P.y) < 140) { b.stun = 3.5; fx.emit(b.x, b.y, 14, '#00f0ff', 200, 0.5, 3); }
  for (const c of G.cams) if (dist(c.x, c.y, P.x, P.y) < 160) c.stun = 5;
  if (G.B) for (const y of G.pylons) if (!y.used && dist(P.x, P.y, y.x, y.y) < 110 && dist(G.B.x, G.B.y, y.x, y.y) < 190) { y.used = true; G.B.hp--; G.B.stun = 2.5; G.B.hurt = 1; shake = 22; sfx.play('boom'); fx.emit(y.x, y.y, 80, '#ffd200', 500, 1, 5); fx.ring(G.B.x, G.B.y, '#ffd200', 200); big(G.B.hp > 0 ? '¡SOBRECARGA!' : '¡CENTINELA CAÍDO!', '#ffd200', 1400); if (G.B.hp <= 0) win(); }
}
function win() {
  if (G.over) return; G.over = true; sfx.play('win');
  const stars = 1 + (G.alarms === 0 ? 1 : 0) + (G.hearts === 3 ? 1 : 0);
  save.stars[G.i] = Math.max(save.stars[G.i] || 0, stars); save.unlocked = Math.max(save.unlocked, G.i + 2); persist(); renderMissions();
  setTimeout(async () => {
    $('hudT').classList.add('hidden'); $('hudB').classList.add('hidden'); touch.show(false);
    if (G.i < OUTRO.length) await dialog(OUTRO[G.i]);
    if (G.i === MISSIONS.length - 1) return finale();
    $('oTitle').textContent = '¡ENTREGADO!'; $('oSub').textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${G.alarms ? G.alarms + ' alarmas' : 'sin que te vieran'} · ${G.hearts} ♥ · ${Math.round(G.t)} s`;
    $('oNext').textContent = 'SIGUIENTE MISIÓN'; $('oNext').onclick = () => startMission(G.i + 1); show('over');
  }, 1000);
}
async function finale() {
  await chapter('EPÍLOGO', 'AMANECER', '', '#ff8a1a');
  const c = await dialog([say(RA, 'El Centinela ha caído. Los robots se han parado. La gente sale a la calle.'), say(TO, 'Mara, la radio es tuya. Di algo.'), say(M, '…', ['«Seguid repartiendo. Las cosas buenas también se reparten.»', '«Ahora nos toca reconstruir. Juntos.»'])]);
  await dialog([say(M, c === 0 ? 'Seguid repartiendo. Las cosas buenas también se reparten.' : 'Ahora nos toca reconstruir. Juntos.'), say(RA, 'Aquí Radio Esperanza. Fin del último turno… y principio de todo lo demás.')]);
  $('oTitle').textContent = 'FIN'; $('oSub').textContent = `Has liberado la ciudad. Estrellas: ${Object.values(save.stars).reduce((a, b) => a + b, 0)}/15. ¿Puedes conseguirlas todas sin que te vean?`; $('oNext').textContent = 'MISIONES'; $('oNext').onclick = () => show('menu'); show('over');
}

// ================== BUCLE ==================
function step(dt) {
  if (!G || G.over) return;
  G.t += dt; const P = G.P;
  // entrada
  let mx = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0), my = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  let run = down('ShiftLeft', 'ShiftRight') || touch.btn.run; const g = pad();
  if (g) { if (g.lx || g.ly) { mx = g.lx; my = g.ly; } if (g.rt > 0.3 || g.rb) run = true; if (g.a || g.x) emp(); }
  if (touch.la) { mx = touch.lx; my = touch.ly; }
  if (hit('Space', 'KeyE') || touch.tapped('emp')) emp();
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  G.running = run && m > 0.2; const sp = G.running ? 280 : 180;
  P.vx = lerp(P.vx, mx * sp, 1 - Math.exp(-12 * dt)); P.vy = lerp(P.vy, my * sp, 1 - Math.exp(-12 * dt));
  moveCircle(P, P.r, P.vx * dt, P.vy * dt); if (m > 0.2) P.a = Math.atan2(my, mx);
  P.inv -= dt; G.emp = Math.max(0, G.emp - dt);
  if (G.running && Math.random() < dt * 8) fx.emit(P.x, P.y + 8, 1, '#ff8a1a', 40, 0.4, 3);
  // paquetes y salida
  for (const k of G.pk) if (!k.got && dist(P.x, P.y, k.x, k.y) < 26) { k.got = true; G.got++; sfx.play('coin'); fx.ring(k.x, k.y, '#ffd200', 50); toast(`📦 Paquete ${G.got}/${G.pk.length}`, 1200); }
  const ready = G.got >= G.pk.length && !G.boss;
  if (ready && G.exit && dist(P.x, P.y, G.exit.x, G.exit.y) < 28) return win();
  // vigilancia
  let seen = 0;
  for (const b of G.bots) {
    b.stun -= dt; if (b.stun > 0) continue;
    if (b.chase) {
      b.pathT -= dt; if (b.pathT <= 0) { b.pathT = 0.45; b.path = bfsNext(b.x, b.y, P.x, P.y) || []; }
      const n = b.path[0]; if (n) { const d = dist(b.x, b.y, n[0], n[1]); if (d < 8) b.path.shift(); else { const a = Math.atan2(n[1] - b.y, n[0] - b.x); b.a += wrapA(a - b.a) * Math.min(1, dt * 8); moveCircle(b, 14, Math.cos(a) * 120 * dt, Math.sin(a) * 120 * dt); } }
      const canSee = los(b.x, b.y, P.x, P.y) && dist(b.x, b.y, P.x, P.y) < 380;
      if (canSee) { b.a = Math.atan2(P.y - b.y, P.x - b.x); G.alarm = Math.max(G.alarm, 3); b.fire -= dt; if (b.fire <= 0) { b.fire = 1.3; const a = b.a + rnd(-0.08, 0.08); G.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, life: 2.5 }); sfx.play('laser'); } }
      if (G.alarm <= 0) { b.chase = false; b.path = []; }
    } else {
      const nx = b.x + b.dir[0] * 70 * dt, ny = b.y + b.dir[1] * 70 * dt;
      if (wall(nx + b.dir[0] * 16, ny + b.dir[1] * 16)) { b.dir = [-b.dir[0], -b.dir[1]]; b.look = 0.9; }
      if (b.look > 0) { b.look -= dt; b.a += dt * 3.4; } else { b.x = nx; b.y = ny; b.a += wrapA(Math.atan2(b.dir[1], b.dir[0]) - b.a) * Math.min(1, dt * 5); }
      seen = Math.max(seen, sees(b.x, b.y, b.a, RANGE, FOV));
    }
    if (dist(b.x, b.y, P.x, P.y) < 26) hurt();
  }
  for (const c of G.cams) { c.stun -= dt; c.a = c.base + Math.sin(G.t * 0.6 + c.base) * 1.1; if (c.stun <= 0) seen = Math.max(seen, sees(c.x, c.y, c.a, 270, 0.45)); }
  if (G.B) {
    const B = G.B; B.stun -= dt; B.hurt -= dt;
    if (B.stun <= 0) {
      B.pathT -= dt; if (B.pathT <= 0) { B.pathT = 0.5; B.path = bfsNext(B.x, B.y, P.x, P.y) || []; }
      const n = B.path[0]; if (n) { if (dist(B.x, B.y, n[0], n[1]) < 10) B.path.shift(); else { const a = Math.atan2(n[1] - B.y, n[0] - B.x); moveCircle(B, 16, Math.cos(a) * 92 * dt, Math.sin(a) * 92 * dt); } }
      B.a = Math.atan2(P.y - B.y, P.x - B.x); B.fire -= dt;
      if (B.fire <= 0 && los(B.x, B.y, P.x, P.y)) { B.fire = 2.2 - (3 - B.hp) * 0.4; for (let k = -2; k <= 2; k++) { const a = B.a + k * 0.22; G.bullets.push({ x: B.x, y: B.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, life: 3 }); } sfx.play('laser'); }
      if (dist(B.x, B.y, P.x, P.y) < B.r + P.r) hurt();
    }
  }
  if (!G.boss) { if (seen > 0) { G.meter = Math.min(1, G.meter + seen * dt * 1.3); if (G.meter >= 1) raiseAlarm(); } else G.meter = Math.max(0, G.meter - dt * 0.35); }
  if (G.alarm > 0) { const anySee = G.bots.some(b => b.chase && b.stun <= 0 && los(b.x, b.y, P.x, P.y) && dist(b.x, b.y, P.x, P.y) < 380); if (!anySee) G.alarm -= dt; if (G.alarm <= 0) { G.meter = 0.5; toast('Te han perdido de vista…', 1500); } }
  for (let i = G.bullets.length - 1; i >= 0; i--) { const b = G.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (wall(b.x, b.y) || b.life <= 0) { fx.emit(b.x, b.y, 4, '#ff2a4d', 100, 0.2, 2); G.bullets.splice(i, 1); continue; } if (dist(b.x, b.y, P.x, P.y) < P.r + 4) { G.bullets.splice(i, 1); hurt(); } }
  $('alarm').style.opacity = G.alarm > 0 ? 0.5 + Math.sin(G.t * 10) * 0.3 : G.meter * 0.4;
  hud();
}
function hud() {
  $('hudT').innerHTML = `${G.i + 1}. ${G.name}<small>${G.boss ? `CENTINELA ${'■'.repeat(Math.max(0, G.B.hp))}${'□'.repeat(3 - Math.max(0, G.B.hp))} · atráelo a un pilón y lanza el pulso` : G.got < G.pk.length ? `📦 ${G.got}/${G.pk.length} PAQUETES` : '¡VE A LA SALIDA!'}</small>`;
  $('hudB').innerHTML = `<span style="color:var(--red)">${'♥'.repeat(Math.max(0, G.hearts))}</span> &nbsp; <span style="color:${G.emp > 0 ? '#5a4a8a' : 'var(--cyan)'}">PULSO ${G.emp > 0 ? Math.ceil(G.emp) + 's' : 'LISTO'}</span>`;
}
function cone(x, y, a, range, fov, col, alpha) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y, 0, x, y, range); gr.addColorStop(0, col + Math.round(alpha * 255).toString(16).padStart(2, '0')); gr.addColorStop(1, col + '00'); ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(x, y); const N = 22;
  for (let i = 0; i <= N; i++) { const aa = a - fov + (2 * fov * i) / N; let d = 0; while (d < range && !wall(x + Math.cos(aa) * d, y + Math.sin(aa) * d)) d += 8; ctx.lineTo(x + Math.cos(aa) * d, y + Math.sin(aa) * d); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function draw(dt, t) {
  ctx.fillStyle = '#06020f'; ctx.fillRect(0, 0, S.W, S.H);
  if (!G) return;
  const P = G.P, z = clamp(Math.min(S.W / 900, S.H / 560), 0.5, 1.3);
  cam.x = lerp(cam.x, P.x, 1 - Math.exp(-6 * dt)); cam.y = lerp(cam.y, P.y, 1 - Math.exp(-6 * dt));
  const vw = S.W / z, vh = S.H / z, cx = G.w * T < vw ? G.w * T / 2 : clamp(cam.x, vw / 2, G.w * T - vw / 2), cy = G.h * T < vh ? G.h * T / 2 : clamp(cam.y, vh / 2, G.h * T - vh / 2);
  shake *= Math.exp(-9 * dt);
  ctx.save(); ctx.translate(S.W / 2 + rnd(-shake, shake), S.H / 2 + rnd(-shake, shake)); ctx.scale(z, z); ctx.translate(-cx, -cy);
  for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
    const ch = G.g[y][x], px = x * T, py = y * T;
    if (ch === '#') { ctx.fillStyle = '#140a2a'; ctx.fillRect(px, py, T, T); }
    else { ctx.fillStyle = ch === 'h' ? '#04020a' : ((x + y) % 2 ? '#0c0620' : '#0e0824'); ctx.fillRect(px, py, T, T); if (ch === 'h') { ctx.strokeStyle = '#1a1040'; ctx.beginPath(); ctx.moveTo(px, py + T); ctx.lineTo(px + T, py); ctx.stroke(); } }
  }
  neon(ctx, '#7a3aff', 2, () => { for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) { if (G.g[y][x] !== '#') continue; const px = x * T, py = y * T; const o = (cx2, cy2) => G.g[cy2] && G.g[cy2][cx2] && G.g[cy2][cx2] !== '#'; if (o(x, y - 1)) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); } if (o(x, y + 1)) { ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); } if (o(x - 1, y)) { ctx.moveTo(px, py); ctx.lineTo(px, py + T); } if (o(x + 1, y)) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); } } }, 0.7);
  // salida, pilones, paquetes
  if (G.exit && !G.boss) { const on = G.got >= G.pk.length; glowDot(ctx, G.exit.x, G.exit.y, 60, on ? '#39ff88' : '#555', on ? 0.6 + Math.sin(t * 4) * 0.2 : 0.2); neon(ctx, on ? '#39ff88' : '#555', 3, () => ctx.rect(G.exit.x - 16, G.exit.y - 16, 32, 32)); ctx.fillStyle = on ? '#39ff88' : '#777'; ctx.font = '900 12px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('SALIDA', G.exit.x, G.exit.y - 24); }
  for (const y of G.pylons) { glowDot(ctx, y.x, y.y, 70, y.used ? '#333' : '#ffd200', y.used ? 0.2 : 0.5 + Math.sin(t * 5) * 0.2); neon(ctx, y.used ? '#444' : '#ffd200', 3, () => { ctx.moveTo(y.x, y.y - 22); ctx.lineTo(y.x + 14, y.y + 14); ctx.lineTo(y.x - 14, y.y + 14); ctx.closePath(); }); }
  for (const k of G.pk) if (!k.got) { const b = Math.sin(t * 4 + k.x) * 3; glowDot(ctx, k.x, k.y, 40, '#ffd200', 0.6); ctx.fillStyle = '#ffd200'; ctx.fillRect(k.x - 10, k.y - 10 + b, 20, 20); ctx.fillStyle = '#7a4a00'; ctx.fillRect(k.x - 2, k.y - 10 + b, 4, 20); }
  // conos
  for (const b of G.bots) if (b.stun <= 0) cone(b.x, b.y, b.a, b.chase ? 380 : RANGE, b.chase ? 0.4 : FOV, b.chase ? '#ff2a4d' : '#ff6a2a', b.chase ? 0.3 : 0.22);
  for (const c of G.cams) if (c.stun <= 0) cone(c.x, c.y, c.a, 270, 0.45, '#ff2bd6', 0.2);
  // robots
  for (const b of G.bots) {
    ctx.save(); ctx.translate(b.x, b.y); const stun = b.stun > 0;
    glowDot(ctx, 0, 0, 40, stun ? '#00f0ff' : '#ff2a4d', 0.4);
    ctx.rotate(b.a); ctx.fillStyle = '#1a0a18'; ctx.fillRect(-14, -12, 28, 24); neon(ctx, stun ? '#00f0ff' : b.chase ? '#ff2a4d' : '#ff8a1a', 2.5, () => ctx.rect(-14, -12, 28, 24));
    ctx.fillStyle = stun ? '#00f0ff' : '#ff2a4d'; ctx.fillRect(8, -6, 6, 12); ctx.restore();
    if (stun) { ctx.fillStyle = '#00f0ff'; ctx.font = '700 12px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('⚡', b.x + Math.sin(t * 10) * 6, b.y - 22); }
    else if (b.chase) { ctx.fillStyle = '#ff2a4d'; ctx.font = '900 16px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('!', b.x, b.y - 20); }
  }
  for (const c of G.cams) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.fillStyle = '#2a0a2a'; ctx.fillRect(-8, -8, 22, 16); neon(ctx, c.stun > 0 ? '#00f0ff' : '#ff2bd6', 2, () => ctx.rect(-8, -8, 22, 16)); ctx.restore(); }
  if (G.B) { const B = G.B; ctx.save(); ctx.translate(B.x, B.y); glowDot(ctx, 0, 0, 110, B.hurt > 0 ? '#ffd200' : '#ff2a4d', 0.5); ctx.rotate(B.a); ctx.fillStyle = '#1a0510'; ctx.beginPath(); ctx.arc(0, 0, B.r, 0, 7); ctx.fill(); neon(ctx, B.stun > 0 ? '#00f0ff' : '#ff2a4d', 5, () => { ctx.arc(0, 0, B.r, 0, 7); ctx.moveTo(B.r * 0.5, 0); ctx.arc(0, 0, B.r * 0.5, 0, 7); }); ctx.fillStyle = '#ff2a4d'; ctx.fillRect(B.r * 0.4, -8, B.r * 0.7, 16); ctx.restore(); }
  // balas
  for (const b of G.bullets) { glowDot(ctx, b.x, b.y, 16, '#ff2a4d', 0.9); ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 2, b.y - 2, 4, 4); }
  // jugadora
  if (!(P.inv > 0 && Math.floor(t * 16) % 2)) {
    ctx.save(); ctx.translate(P.x, P.y); glowDot(ctx, 0, 0, 44, '#ff8a1a', shade(P.x, P.y) ? 0.15 : 0.45); ctx.rotate(P.a);
    ctx.fillStyle = '#0a0418'; ctx.beginPath(); ctx.arc(0, 0, P.r, 0, 7); ctx.fill(); neon(ctx, '#ff8a1a', 2.5, () => ctx.arc(0, 0, P.r, 0, 7));
    ctx.fillStyle = '#ffd200'; ctx.fillRect(-P.r - 2, -7, 9, 14); ctx.fillStyle = '#fff'; ctx.fillRect(5, -3, 6, 6); ctx.restore();
  }
  if (G.emp <= 0) { ctx.strokeStyle = '#00f0ff22'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(P.x, P.y, 140, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  // indicador de sospecha
  if (G.meter > 0.02 && G.alarm <= 0) { ctx.fillStyle = '#0008'; ctx.fillRect(P.x - 20, P.y - 30, 40, 6); ctx.fillStyle = G.meter > 0.7 ? '#ff2a4d' : '#ffd200'; ctx.fillRect(P.x - 20, P.y - 30, 40 * G.meter, 6); ctx.fillStyle = '#ffd200'; ctx.font = '900 14px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('?', P.x, P.y - 36); }
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
}
function show(id) { for (const s of ['menu', 'pause', 'over']) $(s).classList.toggle('hidden', s !== id); if (id) { screen = id; $('hudT').classList.add('hidden'); $('hudB').classList.add('hidden'); touch.show(false); $('alarm').style.opacity = 0; } }
async function startMission(i, retry) {
  sfx.ensure(); goFull(); show(null); screen = 'story'; G = build(i); cam.x = G.P.x; cam.y = G.P.y;
  if (!retry) { await chapter('MISIÓN ' + (i + 1), MISSIONS[i].name, '', '#ff8a1a'); await dialog(INTRO[i]); }
  sfx.music(MISSIONS[i].boss ? SONGS.hype : SONGS.dark);
  screen = 'play'; $('hudT').classList.remove('hidden'); $('hudB').classList.remove('hidden'); touch.show(true);
}
$('bPlay').onclick = () => startMission(Math.min(save.unlocked, MISSIONS.length) - 1);
$('pRes').onclick = () => { paused = false; show(null); screen = 'play'; $('hudT').classList.remove('hidden'); $('hudB').classList.remove('hidden'); touch.show(true); };
$('pRestart').onclick = () => startMission(G.i, true);
$('pMenu').onclick = () => { G = null; show('menu'); sfx.music(null); };
$('oMenu').onclick = () => { G = null; show('menu'); sfx.music(null); };
loop((dt, t) => { if (screen === 'play' && !talking()) { if (hit('KeyP', 'Escape')) { paused = true; show('pause'); } else step(dt); } draw(dt, t); });
show('menu');
if (location.hash === '#dbg') window.dbg = { get G() { return G; }, startMission };
