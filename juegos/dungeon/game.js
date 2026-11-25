// DUNGEON NEÓN — mazmorras por turnos. Cada piso es aleatorio. Tú te mueves, ellos se mueven.
import { $, clamp, lerp, rnd, irnd, pick, store, toast, big, setupCanvas, loop, hit, pad, goFull, sfx, SONGS, Particles, glowDot, backButton } from '../../comun/lib.js';
import { dialog, chapter, talking } from '../../comun/story.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(600);
backButton();
const T = 34, W = 44, H = 30;
const A = { who: 'ARI', col: '#39ff88' }, VZ = { who: 'LA VOZ DEL POZO', col: '#9d4dff' }, MER = { who: 'MERCADER', col: '#ffd200' }, REY = { who: 'REY DE LAS SOMBRAS', col: '#ff2a4d' };
const say = (w, txt, ch) => ({ ...w, txt, choices: ch });
const STORY = {
  1: [say(VZ, 'Otra luz baja por el pozo. Hacía siglos que nadie se atrevía.'), say(A, 'Me llamo Ari. El Rey de las Sombras se ha llevado la luz de mi pueblo. Vengo a por ella.'), say(VZ, 'Diez pisos te separan de él. Cada uno, más oscuro. Tu farol es tu vida: no lo pierdas.')],
  3: [say(VZ, 'Los esqueletos fueron aventureros como tú. No dejes que te convenzan de quedarte.')],
  5: [say(VZ, 'Mitad del camino. ¿Notas el frío? Él ya sabe que vienes.'), say(A, 'Que lo sepa. Así se pone nervioso.')],
  7: [say(VZ, 'Los magos de abajo disparan desde lejos. Acércate rápido o escóndete tras las esquinas.')],
  9: [say(VZ, 'Último piso antes del trono. Si necesitas algo… es ahora.')],
  10: [say(REY, '¿Una lucecita? ¿Vienes a por la luz de tu pueblo? Está aquí, en mi corona.'), say(A, 'Pues dámela por las buenas.'), say(REY, 'Nada se da por las buenas aquí abajo.')],
};
const MON = {
  rata: { ic: 'r', name: 'RATA', hp: 4, atk: 2, col: '#b9a8e8', xp: 2 },
  murcielago: { ic: 'm', name: 'MURCIÉLAGO', hp: 5, atk: 2, col: '#9d4dff', xp: 3, erratic: true },
  slime: { ic: 's', name: 'BABOSA', hp: 9, atk: 3, col: '#39ff88', xp: 4, split: true },
  esqueleto: { ic: 'e', name: 'ESQUELETO', hp: 12, atk: 4, col: '#f4efff', xp: 6 },
  mago: { ic: 'g', name: 'MAGO OSCURO', hp: 9, atk: 4, col: '#ff2bd6', xp: 8, ranged: true },
  golem: { ic: 'G', name: 'GÓLEM', hp: 26, atk: 6, col: '#ff8a1a', xp: 14, slow: true },
  rey: { ic: 'R', name: 'REY DE LAS SOMBRAS', hp: 90, atk: 8, col: '#ff2a4d', xp: 0, boss: true, ranged: true },
};
const pool = f => f <= 2 ? ['rata', 'rata', 'murcielago', 'slime'] : f <= 4 ? ['rata', 'murcielago', 'slime', 'esqueleto'] : f <= 6 ? ['murcielago', 'slime', 'esqueleto', 'esqueleto', 'mago'] : ['esqueleto', 'mago', 'golem', 'slime', 'murcielago'];
const WEAP = [['PALO', 0], ['DAGA', 2], ['ESPADA', 4], ['HACHA NEÓN', 6], ['ESPADA DE LUZ', 9]];
const ARM = [['ROPA', 0], ['CUERO', 1], ['MALLA', 2], ['PLACAS', 4]];
let R = null, screen = 'menu', shake = 0, cam = { x: 0, y: 0 }, logL = [], pops = [], busy = false, auto = null;
const best = () => { const b = store.get('dungeon.best', { floor: 0, wins: 0 }); $('best').innerHTML = b.floor ? `🏆 Mejor piso: <b style="color:var(--green)">${b.floor}</b> · Victorias: <b style="color:var(--gold)">${b.wins}</b>` : ''; };
best();
function log(t, c = '#e8dcff') { logL.unshift({ t, c }); if (logL.length > 4) logL.pop(); $('log').innerHTML = logL.map(l => `<div style="color:${l.c}">${l.t}</div>`).join(''); }
function pop(x, y, t, c) { pops.push({ x: x * T + T / 2, y: y * T, t, c, life: 1 }); }

// ================== GENERAR PISO ==================
function genFloor(f) {
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const rooms = [];
  for (let k = 0; k < 60 && rooms.length < 10; k++) {
    const w = irnd(5, 10), h = irnd(4, 7), x = irnd(1, W - w - 2), y = irnd(1, H - h - 2);
    if (rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy][xx] = '.';
  }
  rooms.sort((a, b) => a.cx - b.cx);
  const dig = (x0, y0, x1, y1) => { let x = x0, y = y0; while (x !== x1) { g[y][x] = '.'; x += Math.sign(x1 - x); } while (y !== y1) { g[y][x] = '.'; y += Math.sign(y1 - y); } g[y][x] = '.'; };
  for (let i = 1; i < rooms.length; i++) { const a = rooms[i - 1], b = rooms[i]; if (Math.random() < 0.5) dig(a.cx, a.cy, b.cx, b.cy); else { dig(a.cx, a.cy, a.cx, b.cy); dig(a.cx, b.cy, b.cx, b.cy); } }
  for (let k = 0; k < 2; k++) { const a = pick(rooms), b = pick(rooms); dig(a.cx, a.cy, b.cx, b.cy); }
  const first = rooms[0], last = rooms[rooms.length - 1];
  const fl = { f, g, rooms, seen: Array.from({ length: H }, () => Array(W).fill(0)), mons: [], items: [], stairs: null, shop: null };
  if (f < 10) { fl.stairs = [last.cx, last.cy]; }
  const free = (r) => { for (let k = 0; k < 30; k++) { const x = irnd(r.x, r.x + r.w - 1), y = irnd(r.y, r.y + r.h - 1); if (g[y][x] === '.' && !fl.mons.some(m => m.x === x && m.y === y) && !fl.items.some(i => i.x === x && i.y === y) && !(fl.stairs && fl.stairs[0] === x && fl.stairs[1] === y) && !(x === first.cx && y === first.cy)) return [x, y]; } return null; };
  if (f === 10) { const [x, y] = [last.cx, last.cy]; fl.mons.push(mon('rey', x, y, f)); }
  const nm = 4 + f + (f > 6 ? 2 : 0);
  for (let k = 0; k < nm; k++) { const r = rooms[irnd(1, rooms.length - 1)], p = free(r); if (p) fl.mons.push(mon(pick(pool(f)), p[0], p[1], f)); }
  const ni = 4 + Math.floor(f / 2);
  for (let k = 0; k < ni; k++) { const r = pick(rooms), p = free(r); if (!p) continue; const roll = Math.random(); fl.items.push({ x: p[0], y: p[1], k: roll < 0.35 ? 'oro' : roll < 0.62 ? 'pocion' : roll < 0.78 ? 'pergamino' : roll < 0.9 ? 'arma' : 'armadura' }); }
  if (f % 3 === 0 && f < 10) { const r = rooms[Math.min(2, rooms.length - 2)], p = free(r); if (p) fl.shop = { x: p[0], y: p[1] }; }
  return { fl, start: [first.cx, first.cy] };
}
function mon(k, x, y, f) { const M = MON[k], s = 1 + (f - 1) * 0.1; return { k, x, y, rx: x, ry: y, hp: Math.round(M.hp * (M.boss ? 1 : s)), max: Math.round(M.hp * (M.boss ? 1 : s)), atk: Math.round(M.atk * (M.boss ? 1 : s)), awake: false, flash: 0, cd: 0 }; }

// ================== PARTIDA ==================
function newRun() {
  R = { floor: 0, hero: { x: 0, y: 0, rx: 0, ry: 0, hp: 36, max: 36, atk: 4, def: 0, lvl: 1, xp: 0, next: 8, gold: 0, pot: 3, scr: 1, w: 0, a: 0, flash: 0 }, fl: null, turns: 0, kills: 0 };
  logL = []; nextFloor();
}
async function nextFloor() {
  R.floor++; const { fl, start } = genFloor(R.floor); R.fl = fl; const h = R.hero; h.x = h.rx = start[0]; h.y = h.ry = start[1];
  cam.x = h.x * T; cam.y = h.y * T; fov(); auto = null;
  sfx.music(R.floor === 10 ? SONGS.hype : SONGS.dark);
  busy = true;
  await chapter('PISO ' + R.floor, R.floor === 10 ? 'EL TRONO' : ['LAS RAÍCES', 'LA CRIPTA', 'EL OSARIO', 'LOS ECOS', 'EL LAGO NEGRO', 'LA BIBLIOTECA', 'LAS FORJAS', 'EL ABISMO', 'LA ANTESALA'][R.floor - 1], '', '#39ff88', 1600);
  if (STORY[R.floor]) await dialog(STORY[R.floor]);
  busy = false; hud(); log(`Bajas al piso ${R.floor}.`, '#39ff88');
}
const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || R.fl.g[y][x] === '#';
const monAt = (x, y) => R.fl.mons.find(m => m.x === x && m.y === y);
function los(x0, y0, x1, y1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 1; i < n; i++) { const x = Math.round(lerp(x0, x1, i / n)), y = Math.round(lerp(y0, y1, i / n)); if (isWall(x, y)) return false; } return true; }
function fov() { const h = R.hero, r = 7; for (let y = h.y - r; y <= h.y + r; y++) for (let x = h.x - r; x <= h.x + r; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; if ((x - h.x) ** 2 + (y - h.y) ** 2 > r * r) continue; if (los(h.x, h.y, x, y)) R.fl.seen[y][x] = 2; } }
const visible = (x, y) => R.fl.seen[y] && R.fl.seen[y][x] === 2;
function hurtHero(d, src) {
  const h = R.hero; const dmg = Math.max(1, d - h.def + irnd(-1, 1)); h.hp -= dmg; h.flash = 0.3; shake = 6; sfx.play('hurt'); pop(h.x, h.y, '-' + dmg, '#ff2a4d'); fx.emit(h.x * T + T / 2, h.y * T + T / 2, 10, '#ff2a4d', 160, 0.4, 3);
  if (h.hp <= 0) { log(`${src} acaba contigo.`, '#ff2a4d'); die(); }
}
function attack(m) {
  const h = R.hero, M = MON[m.k], dmg = Math.max(1, h.atk + WEAP[h.w][1] + irnd(-1, 2)); const crit = Math.random() < 0.12, total = crit ? dmg * 2 : dmg;
  m.hp -= total; m.flash = 0.25; m.awake = true; sfx.play(crit ? 'boom' : 'hit'); pop(m.x, m.y, (crit ? '¡' : '') + total, crit ? '#ffd200' : '#fff'); fx.emit(m.x * T + T / 2, m.y * T + T / 2, crit ? 20 : 8, M.col, 200, 0.4, 3);
  if (m.hp <= 0) {
    R.fl.mons = R.fl.mons.filter(o => o !== m); R.kills++; log(`Derrotas ${M.name.toLowerCase()} (+${M.xp} XP).`, '#39ff88'); fx.ring(m.x * T + T / 2, m.y * T + T / 2, M.col, 40);
    if (M.split && m.max > 5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = m.x + dx, y = m.y + dy; if (!isWall(x, y) && !monAt(x, y) && !(x === h.x && y === h.y) && R.fl.mons.filter(o => o.k === 'slime').length < 14) { const s = mon('slime', x, y, R.floor); s.hp = s.max = Math.floor(m.max / 2); s.awake = true; R.fl.mons.push(s); if (Math.random() < 0.5) break; } }
    if (Math.random() < 0.3) R.fl.items.push({ x: m.x, y: m.y, k: 'oro' });
    if (M.boss) return victory();
    gainXp(M.xp);
  }
}
async function gainXp(n) {
  const h = R.hero; h.xp += n;
  while (h.xp >= h.next) {
    h.xp -= h.next; h.lvl++; h.next = Math.round(h.next * 1.45); sfx.play('power'); big('¡NIVEL ' + h.lvl + '!', '#39ff88', 1200);
    busy = true; const c = await dialog([say(A, `Nivel ${h.lvl}. Me siento más fuerte. ¿En qué lo noto?`, ['+8 VIDA MÁXIMA (y te curas)', '+2 ATAQUE', '+1 DEFENSA'])]); busy = false;
    if (c === 0) { h.max += 8; h.hp = h.max; } else if (c === 1) h.atk += 2; else h.def += 1;
    hud();
  }
}
async function pickup() {
  const h = R.hero, i = R.fl.items.findIndex(it => it.x === h.x && it.y === h.y); if (i < 0) return;
  const it = R.fl.items[i]; R.fl.items.splice(i, 1);
  if (it.k === 'oro') { const g = irnd(3, 8) + R.floor * 2; h.gold += g; sfx.play('coin'); log(`+${g} monedas.`, '#ffd200'); }
  if (it.k === 'pocion') { h.pot++; sfx.play('pick'); log('Coges una poción.', '#ff2bd6'); }
  if (it.k === 'pergamino') { h.scr++; sfx.play('pick'); log('Coges un pergamino de fuego.', '#ff8a1a'); }
  if (it.k === 'arma') { if (h.w < WEAP.length - 1 && Math.random() < 0.5 + R.floor * 0.06) { h.w++; log(`¡Encuentras ${WEAP[h.w][0]}! (+${WEAP[h.w][1]} ataque)`, '#00f0ff'); sfx.play('power'); } else { const g = 10 + R.floor * 3; h.gold += g; log(`Un arma oxidada. La vendes: +${g} monedas.`, '#ffd200'); sfx.play('coin'); } }
  if (it.k === 'armadura') { if (h.a < ARM.length - 1) { h.a++; h.def = Math.max(h.def, 0) + (ARM[h.a][1] - ARM[h.a - 1][1]); log(`¡Te pones ${ARM[h.a][0]}! (+defensa)`, '#00f0ff'); sfx.play('power'); } else { h.gold += 15; log('Armadura repetida: +15 monedas.', '#ffd200'); } }
  hud();
}
async function shop() {
  const h = R.hero; busy = true;
  const price = { p: 15 + R.floor * 2, s: 20 + R.floor * 2, m: 35 + R.floor * 4 };
  const c = await dialog([say(MER, `¡Una clienta! Tienes ${h.gold} monedas.`, [`Poción (${price.p})`, `Pergamino de fuego (${price.s})`, `Afilar arma +1 ataque (${price.m})`, 'Nada, gracias'])]);
  const cost = [price.p, price.s, price.m][c];
  if (c < 3) { if (h.gold >= cost) { h.gold -= cost; if (c === 0) h.pot++; if (c === 1) h.scr++; if (c === 2) h.atk++; sfx.play('coin'); log('Trato hecho.', '#ffd200'); } else { sfx.play('hurt'); await dialog([say(MER, 'Vuelve cuando tengas más brillo en los bolsillos.')]); } }
  busy = false; hud();
}
function usePotion() { const h = R.hero; if (!h.pot || h.hp >= h.max) return; h.pot--; const v = Math.round(h.max * 0.5); h.hp = Math.min(h.max, h.hp + v); sfx.play('power'); pop(h.x, h.y, '+' + v, '#39ff88'); fx.emit(h.x * T + T / 2, h.y * T + T / 2, 20, '#39ff88', 160, 0.6, 3); log('Bebes una poción.', '#ff2bd6'); endTurn(); }
function useScroll() {
  const h = R.hero; if (!h.scr) return; h.scr--; sfx.play('boom'); shake = 12; fx.ring(h.x * T + T / 2, h.y * T + T / 2, '#ff8a1a', T * 4);
  let n = 0; for (const m of [...R.fl.mons]) if (Math.hypot(m.x - h.x, m.y - h.y) <= 3.2 && visible(m.x, m.y)) { n++; const d = 8 + R.floor * 2; m.hp -= d; m.flash = 0.3; m.awake = true; pop(m.x, m.y, d, '#ff8a1a'); fx.emit(m.x * T + T / 2, m.y * T + T / 2, 20, '#ff8a1a', 240, 0.6, 4); if (m.hp <= 0) { m.hp = 1; attack(m); } }
  log(n ? `¡Llamarada! Alcanza a ${n}.` : 'La llamarada no alcanza a nadie.', '#ff8a1a'); endTurn();
}
async function tryMove(dx, dy) {
  if (busy || !R || R.dead) return; const h = R.hero, x = h.x + dx, y = h.y + dy;
  const m = monAt(x, y); if (m) { attack(m); return endTurn(); }
  if (isWall(x, y)) return;
  if (R.fl.shop && R.fl.shop.x === x && R.fl.shop.y === y) { await shop(); return; }
  h.x = x; h.y = y; sfx.play('step'); await pickup();
  if (R.fl.stairs && x === R.fl.stairs[0] && y === R.fl.stairs[1]) { sfx.play('go'); store.set('dungeon.best', { ...store.get('dungeon.best', { floor: 0, wins: 0 }), floor: Math.max(store.get('dungeon.best', { floor: 0 }).floor, R.floor + 1) }); return nextFloor(); }
  endTurn();
}
function endTurn() {
  R.turns++; fov(); const h = R.hero;
  for (const m of [...R.fl.mons]) {
    const M = MON[m.k]; if (!R.fl.mons.includes(m)) continue;
    const d = Math.abs(m.x - h.x) + Math.abs(m.y - h.y), see = d < 9 && los(m.x, m.y, h.x, h.y);
    if (see) m.awake = true; if (!m.awake) continue;
    if (M.slow && R.turns % 2) continue;
    if (M.ranged && see && d > 1 && d < 7) { m.cd--; if (m.cd <= 0) { m.cd = M.boss ? 2 : 3; fx.emit(m.x * T + T / 2, m.y * T + T / 2, 12, M.col, 220, 0.4, 3); sfx.play('laser'); hurtHero(Math.round(m.atk * 0.8), M.name); if (R.dead) return; if (M.boss && R.fl.mons.length < 6 && Math.random() < 0.3) { const sx = m.x + irnd(-2, 2), sy = m.y + irnd(-2, 2); if (!isWall(sx, sy) && !monAt(sx, sy)) { const e = mon('esqueleto', sx, sy, 8); e.awake = true; R.fl.mons.push(e); log('¡El Rey invoca un esqueleto!', '#ff2a4d'); } } continue; } }
    if (d === 1) { hurtHero(m.atk, M.name); if (R.dead) return; continue; }
    let dx = Math.sign(h.x - m.x), dy = Math.sign(h.y - m.y);
    if (M.erratic && Math.random() < 0.4) { dx = irnd(-1, 1); dy = 0; if (!dx) dy = irnd(-1, 1); }
    const opts = Math.abs(h.x - m.x) > Math.abs(h.y - m.y) ? [[dx, 0], [0, dy || pick([-1, 1])]] : [[0, dy], [dx || pick([-1, 1]), 0]];
    for (const [ox, oy] of opts) { const nx = m.x + ox, ny = m.y + oy; if ((ox || oy) && !isWall(nx, ny) && !monAt(nx, ny) && !(nx === h.x && ny === h.y)) { m.x = nx; m.y = ny; break; } }
  }
  hud();
}
function die() { R.dead = true; sfx.play('lose'); sfx.music(null); setTimeout(() => { $('oTitle').textContent = 'TU LUZ SE APAGA'; $('oSub').textContent = `Llegaste al piso ${R.floor}, nivel ${R.hero.lvl}, con ${R.kills} enemigos derrotados. La mazmorra cambia cada vez: inténtalo de nuevo.`; show('over'); }, 1100); }
async function victory() {
  busy = true; sfx.play('win'); big('¡VICTORIA!', '#ffd200', 1800); fx.emit(R.hero.x * T, R.hero.y * T, 120, '#ffd200', 500, 1.4, 5);
  const b = store.get('dungeon.best', { floor: 0, wins: 0 }); b.wins++; b.floor = 10; store.set('dungeon.best', b); best();
  await new Promise(r => setTimeout(r, 1500));
  const c = await dialog([say(REY, 'La corona… la luz… tómala. Pero sabes que si la sacas, aquí abajo todo volverá a la oscuridad.'), say(VZ, 'Ari, la elección es tuya.', ['Llevar la luz a mi pueblo', 'Dejar media luz aquí abajo, para los que quedan'])]);
  await dialog(c === 0 ? [say(A, 'Mi pueblo me espera. Lo siento, Rey.'), say(VZ, 'Y así, el pozo volvió a quedarse en silencio… hasta la próxima luz.')] : [say(A, 'Partiré la luz en dos. Nadie debería vivir siempre a oscuras.'), say(REY, '…Nadie había hecho eso nunca.'), say(VZ, 'Desde aquel día, en el fondo del pozo brilla una lucecita. Y el Rey ya no es de las sombras.')]);
  $('oTitle').textContent = c === 0 ? 'FINAL: EL REGRESO' : 'FINAL: MEDIA LUZ'; $('oSub').textContent = `¡Has vencido al Rey de las Sombras! Nivel ${R.hero.lvl}, ${R.kills} enemigos, ${R.turns} turnos.`; show('over'); busy = false;
}

// ================== ENTRADA ==================
const KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
let padT = 0;
function input(dt) {
  if (busy || talking() || !R || R.dead) return;
  for (const k in KEYS) if (hit(k)) { auto = null; return tryMove(...KEYS[k]); }
  if (hit('KeyQ')) return usePotion(); if (hit('KeyE')) return useScroll(); if (hit('Space')) { log('Esperas un turno.'); return endTurn(); }
  const g = pad(); padT -= dt;
  if (g && padT <= 0) { const dx = g.lx > 0.5 || g.right ? 1 : g.lx < -0.5 || g.left ? -1 : 0, dy = g.ly > 0.5 || g.down ? 1 : g.ly < -0.5 || g.up ? -1 : 0; if (dx || dy) { padT = 0.16; return tryMove(dx, dy ? (dx ? 0 : dy) : 0); } if (g.x) { padT = 0.4; return usePotion(); } if (g.y) { padT = 0.4; return useScroll(); } }
  if (auto) { padT2 -= dt; if (padT2 <= 0) { padT2 = 0.09; const n = auto.shift(); if (!n || R.fl.mons.some(m => visible(m.x, m.y) && m.awake)) { auto = null; } if (n) tryMove(n[0] - R.hero.x, n[1] - R.hero.y); } }
}
let padT2 = 0;
cv.addEventListener('click', e => {
  if (busy || talking() || !R || R.dead || screen !== 'play') return;
  const x = Math.floor((e.clientX - S.W / 2) / zoom + cam.x + T / 2) , y = Math.floor((e.clientY - S.H / 2) / zoom + cam.y + T / 2);
  const tx = Math.floor(x / T), ty = Math.floor(y / T), h = R.hero;
  if (tx === h.x && ty === h.y) { log('Esperas un turno.'); return endTurn(); }
  if (Math.abs(tx - h.x) + Math.abs(ty - h.y) === 1) return tryMove(tx - h.x, ty - h.y);
  if (!R.fl.seen[ty] || !R.fl.seen[ty][tx] || isWall(tx, ty)) return;
  // camino BFS por lo ya visto
  const prev = new Map([[h.y * W + h.x, -1]]), q = [[h.x, h.y]];
  while (q.length) { const [x0, y0] = q.shift(); if (x0 === tx && y0 === ty) break; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x0 + dx, ny = y0 + dy, k = ny * W + nx; if (isWall(nx, ny) || !R.fl.seen[ny][nx] || prev.has(k)) continue; prev.set(k, y0 * W + x0); q.push([nx, ny]); } }
  let k = ty * W + tx; if (!prev.has(k)) return; const path = []; while (k !== h.y * W + h.x) { path.push([k % W, Math.floor(k / W)]); k = prev.get(k); }
  auto = path.reverse(); fx.ring(e.clientX, e.clientY, '#39ff88', 20);
});
$('aPot').onclick = () => { if (!busy && R && !R.dead) usePotion(); };
$('aScr').onclick = () => { if (!busy && R && !R.dead) useScroll(); };
$('aWait').onclick = () => { if (!busy && R && !R.dead) { log('Esperas un turno.'); endTurn(); } };
function hud() {
  const h = R.hero;
  $('bar').innerHTML = `<span style="color:var(--green)">PISO <b>${R.floor}</b>/10</span><span style="color:var(--red)">♥ <b>${Math.max(0, h.hp)}</b>/${h.max}</span><span>NV <b>${h.lvl}</b> <small style="color:var(--dim)">${h.xp}/${h.next}</small></span><span style="color:var(--cyan)">⚔ <b>${h.atk + WEAP[h.w][1]}</b> 🛡 <b>${h.def}</b></span><span style="color:var(--gold)">◉ <b>${h.gold}</b></span>`;
  $('nPot').textContent = h.pot; $('nScr').textContent = h.scr; $('aPot').disabled = !h.pot; $('aScr').disabled = !h.scr;
}

// ================== DIBUJO ==================
let zoom = 1;
function draw(dt, t) {
  ctx.fillStyle = '#030108'; ctx.fillRect(0, 0, S.W, S.H);
  if (!R || !R.fl) return;
  const h = R.hero; zoom = clamp(Math.min(S.W, S.H) / (T * 13), 0.7, 1.6);
  h.rx = lerp(h.rx, h.x, 1 - Math.exp(-20 * dt)); h.ry = lerp(h.ry, h.y, 1 - Math.exp(-20 * dt));
  cam.x = lerp(cam.x, h.rx * T, 1 - Math.exp(-8 * dt)); cam.y = lerp(cam.y, h.ry * T, 1 - Math.exp(-8 * dt));
  shake *= Math.exp(-10 * dt);
  ctx.save(); ctx.translate(S.W / 2 + rnd(-shake, shake), S.H / 2 + rnd(-shake, shake)); ctx.scale(zoom, zoom); ctx.translate(-cam.x - T / 2, -cam.y - T / 2);
  const fl = R.fl, vx0 = Math.max(0, Math.floor((cam.x - S.W / 2 / zoom) / T) - 1), vx1 = Math.min(W - 1, Math.ceil((cam.x + S.W / 2 / zoom) / T) + 1), vy0 = Math.max(0, Math.floor((cam.y - S.H / 2 / zoom) / T) - 1), vy1 = Math.min(H - 1, Math.ceil((cam.y + S.H / 2 / zoom) / T) + 1);
  for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
    const s = fl.seen[y][x]; if (!s) continue; const px = x * T, py = y * T, vis = s === 2;
    if (fl.g[y][x] === '#') { const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fl.g[y + dy] && fl.g[y + dy][x + dx] === '.'); if (!near) continue; ctx.fillStyle = vis ? '#1a0c3a' : '#0c0620'; ctx.fillRect(px, py, T, T); ctx.strokeStyle = vis ? '#9d4dff' : '#3a2a6a'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 2, py + 2, T - 4, T - 4); }
    else { ctx.fillStyle = vis ? ((x + y) % 2 ? '#0e0a22' : '#100c26') : '#07051a'; ctx.fillRect(px, py, T, T); }
  }
  // luz del farol
  const lg = ctx.createRadialGradient(h.rx * T + T / 2, h.ry * T + T / 2, 10, h.rx * T + T / 2, h.ry * T + T / 2, T * 7); lg.addColorStop(0, '#ffd20022'); lg.addColorStop(1, '#ffd20000'); ctx.fillStyle = lg; ctx.fillRect(h.rx * T - T * 7, h.ry * T - T * 7, T * 15, T * 15);
  if (fl.stairs && fl.seen[fl.stairs[1]][fl.stairs[0]]) { const [x, y] = fl.stairs; glowDot(ctx, x * T + T / 2, y * T + T / 2, 50, '#39ff88', 0.5 + Math.sin(t * 3) * 0.2); ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) ctx.strokeRect(x * T + 4 + i * 3, y * T + 4 + i * 3, T - 8 - i * 6, T - 8 - i * 6); }
  if (fl.shop && fl.seen[fl.shop.y][fl.shop.x]) { const { x, y } = fl.shop; glowDot(ctx, x * T + T / 2, y * T + T / 2, 50, '#ffd200', 0.5); ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧙', x * T + T / 2, y * T + T / 2); }
  const IC = { oro: ['◉', '#ffd200'], pocion: ['🧪', '#ff2bd6'], pergamino: ['📜', '#ff8a1a'], arma: ['🗡', '#00f0ff'], armadura: ['🛡', '#00f0ff'] };
  for (const it of fl.items) { if (!visible(it.x, it.y)) continue; const [ic, c] = IC[it.k]; glowDot(ctx, it.x * T + T / 2, it.y * T + T / 2, 26, c, 0.5); ctx.font = (it.k === 'oro' ? '900 18px Orbitron' : '20px system-ui'); ctx.fillStyle = c; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ic, it.x * T + T / 2, it.y * T + T / 2 + Math.sin(t * 3 + it.x) * 2); }
  for (const m of fl.mons) {
    if (!visible(m.x, m.y)) continue; const M = MON[m.k]; m.rx = lerp(m.rx, m.x, 1 - Math.exp(-16 * dt)); m.ry = lerp(m.ry, m.y, 1 - Math.exp(-16 * dt)); m.flash -= dt;
    const cx = m.rx * T + T / 2, cy = m.ry * T + T / 2, sz = M.boss ? 1.6 : 1; glowDot(ctx, cx, cy, T * sz, M.col, 0.45);
    ctx.fillStyle = m.flash > 0 ? '#fff' : M.col; ctx.font = `900 ${Math.round(22 * sz)}px Orbitron`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(M.ic, cx, cy + Math.sin(t * 6 + m.x) * 1.5);
    if (m.hp < m.max) { ctx.fillStyle = '#0009'; ctx.fillRect(cx - 14 * sz, cy - T / 2 * sz - 4, 28 * sz, 4); ctx.fillStyle = '#ff2a4d'; ctx.fillRect(cx - 14 * sz, cy - T / 2 * sz - 4, 28 * sz * m.hp / m.max, 4); }
    if (!m.awake) { ctx.fillStyle = '#b9a8e8'; ctx.font = '700 10px Orbitron'; ctx.fillText('z', cx + 12, cy - 12 - Math.sin(t * 2) * 3); }
  }
  // heroína
  h.flash -= dt; const hx = h.rx * T + T / 2, hy = h.ry * T + T / 2; glowDot(ctx, hx, hy, 46, '#ffd200', 0.55);
  ctx.fillStyle = h.flash > 0 ? '#ff2a4d' : '#fff'; ctx.font = '900 24px Orbitron'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('@', hx, hy);
  if (auto && auto.length) { ctx.fillStyle = '#39ff8866'; for (const [x, y] of auto) ctx.fillRect(x * T + T / 2 - 3, y * T + T / 2 - 3, 6, 6); }
  for (const p of pops) { p.life -= dt; p.y -= dt * 30; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.font = '900 16px Orbitron'; ctx.fillText(p.t, p.x, p.y); } ctx.globalAlpha = 1; pops = pops.filter(p => p.life > 0);
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
}
function show(id) { for (const s of ['menu', 'over']) $(s).classList.toggle('hidden', s !== id); screen = id || 'play'; for (const h of ['bar', 'log', 'acts']) $(h).classList.toggle('hidden', !!id); }
async function start() { sfx.ensure(); goFull(); show(null); newRun(); hud(); }
$('bPlay').onclick = start; $('oAgain').onclick = start; $('oMenu').onclick = () => { R = null; show('menu'); best(); sfx.music(null); };
loop((dt, t) => { if (screen === 'play') input(dt); draw(dt, t); });
show('menu');
if (location.hash === '#dbg') window.dbg = { get R() { return R; }, tryMove, nextFloor };
