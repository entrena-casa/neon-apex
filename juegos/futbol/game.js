// FÚTBOL COCHES — fútbol con coches neón vistos desde arriba. Equipo CIAN contra equipo NARANJA.
import { $, clamp, lerp, rnd, irnd, pick, dist, wrapA, COLORS, store, toast, big, setupCanvas, loop, down, hit, pad, touchControls, usingTouch, goFull, sfx, SONGS, Particles, neon, glowDot, Room, lobby, backButton, seg } from '../../comun/lib.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(1000);
backButton();
const touch = touchControls({ left: 'stick', buttons: [{ id: 'boost', label: 'TURBO', color: '#ff8a1a', right: 22, bottom: 30, size: 88 }, { id: 'dash', label: 'IMPULSO', color: '#00f0ff', right: 124, bottom: 30, size: 70 }] });
const room = new Room('futbol', 6);
let diff = store.get('futbol.diff', 1);
seg($('sDiff'), diff, v => { diff = v; store.set('futbol.diff', v); });
const lg = () => store.get('futbol.liga', { round: 0, pts: 0, wins: 0, cups: 0 });
const TEAMS = ['LOS RAYOS', 'NEÓN FC', 'TURBO CITY', 'DEPORTIVO VOLTIO', 'ATLÉTICO PÍXEL', 'REAL CROMO', 'INTER GALAXIA', 'DINAMO SYNTH'];
const showBest = () => { const l = lg(); $('best').innerHTML = `🏆 Ligas ganadas: <b style="color:var(--gold)">${l.cups}</b> · Liga actual: jornada <b style="color:var(--cyan)">${l.round + 1}/8</b> (${l.pts} pts)`; };
showBest();

// ================== CAMPO ==================
const FW = 1500, FH = 860, GOALW = 240, CORNER = 120, BR = 24, CR = 25;
const TCOL = ['#00f0ff', '#ff8a1a'];
let G = null, view = null, myId = 'me', screen = 'menu', paused = false;
function newCar(p, i, team) { return { id: p.id, name: p.name, team, bot: p.bot ? { skill: p.skill ?? [0.45, 0.7, 0.95][diff], role: 0 } : null, x: 0, y: 0, a: 0, vx: 0, vy: 0, boost: 60, dashCd: 0, goals: 0, inp: { th: 0, st: 0, dir: null, boost: false, dash: false } }; }
function kickoff() {
  const ball = G.ball; ball.x = FW / 2; ball.y = FH / 2; ball.vx = ball.vy = 0; ball.z = 0; ball.vz = 0;
  const per = [[], []]; for (const c of G.cars) per[c.team].push(c);
  for (const t of [0, 1]) per[t].forEach((c, i) => { const n = per[t].length, side = t === 0 ? -1 : 1; c.x = FW / 2 + side * (i === 0 ? 320 : 560); c.y = FH / 2 + (n === 1 ? 0 : i === 0 ? 0 : (i % 2 ? -1 : 1) * 220); c.a = t === 0 ? 0 : Math.PI; c.vx = c.vy = 0; c.boost = Math.max(c.boost, 40); });
  G.count = 3.2; G.ev.push(['k', 0, 0, '', 0]);
}
function newGame(mode, players, opp) {
  G = { mode, opp: opp || null, t: 0, time: 180, score: [0, 0], ball: { x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0 }, cars: [], ev: [], over: false, count: 0, golden: false, pads: [], celebrate: 0, lastTouch: [null, null] };
  players.forEach((p, i) => G.cars.push(newCar(p, i, p.team ?? (i % 2))));
  // plataformas de turbo
  for (const [x, y, big] of [[FW / 2, 80, 1], [FW / 2, FH - 80, 1], [240, 200, 0], [240, FH - 200, 0], [FW - 240, 200, 0], [FW - 240, FH - 200, 0], [FW / 2 - 250, FH / 2, 0], [FW / 2 + 250, FH / 2, 0]]) G.pads.push({ x, y, big, t: 0 });
  kickoff();
}
function ev(type, x, y, c, ex) { G.ev.push([type, Math.round(x), Math.round(y), c, ex || 0]); playEv([type, x, y, c, ex]); }

// paredes del campo (rectángulo con esquinas recortadas y porterías)
function wallCollide(o, r, bounce) {
  let hitW = false;
  const inGoalY = o.y > FH / 2 - GOALW / 2 + r * 0.3 && o.y < FH / 2 + GOALW / 2 - r * 0.3;
  if (o.x < r && !inGoalY) { o.x = r; if (o.vx < 0) { o.vx = -o.vx * bounce; hitW = true; } }
  if (o.x > FW - r && !inGoalY) { o.x = FW - r; if (o.vx > 0) { o.vx = -o.vx * bounce; hitW = true; } }
  if (inGoalY) { if (o.x < -90 + r) { o.x = -90 + r; o.vx = Math.abs(o.vx) * bounce; } if (o.x > FW + 90 - r) { o.x = FW + 90 - r; o.vx = -Math.abs(o.vx) * bounce; } if (o.x < 0 || o.x > FW) { const gy0 = FH / 2 - GOALW / 2 + r, gy1 = FH / 2 + GOALW / 2 - r; if (o.y < gy0) { o.y = gy0; o.vy = Math.abs(o.vy) * bounce; } if (o.y > gy1) { o.y = gy1; o.vy = -Math.abs(o.vy) * bounce; } } }
  if (o.y < r) { o.y = r; if (o.vy < 0) { o.vy = -o.vy * bounce; hitW = true; } }
  if (o.y > FH - r) { o.y = FH - r; if (o.vy > 0) { o.vy = -o.vy * bounce; hitW = true; } }
  // esquinas a 45°
  for (const [cx, cy, nx, ny] of [[0, 0, 1, 1], [FW, 0, -1, 1], [0, FH, 1, -1], [FW, FH, -1, -1]]) {
    const n = Math.SQRT1_2, d = ((o.x - cx) * nx + (o.y - cy) * ny) * n - CORNER * n;
    if (d < r) { const k = r - d; o.x += nx * n * k; o.y += ny * n * k; const vn = (o.vx * nx + o.vy * ny) * n; if (vn < 0) { o.vx -= (1 + bounce) * vn * nx * n; o.vy -= (1 + bounce) * vn * ny * n; hitW = true; } }
  }
  return hitW;
}
function botThink(c, dt) {
  const B = c.bot, b = G.ball, inp = c.inp; inp.dir = null;
  const enemyGoalX = c.team === 0 ? FW + 40 : -40, ownGoalX = c.team === 0 ? -20 : FW + 20;
  const mates = G.cars.filter(o => o.team === c.team);
  // el más cercano al balón ataca, el resto cubre
  const myD = dist(c.x, c.y, b.x, b.y), closest = mates.every(o => o === c || dist(o.x, o.y, b.x, b.y) >= myD - 30);
  let tx, ty;
  const lead = 0.25 + B.skill * 0.25, bx = b.x + b.vx * lead, by = b.y + b.vy * lead;
  if (closest || mates.length === 1) {
    // ponerse detrás del balón mirando a la portería rival
    const ga = Math.atan2(FH / 2 - by, enemyGoalX - bx), behind = 70 + (1 - B.skill) * 40;
    const px = bx - Math.cos(ga) * behind, py = by - Math.sin(ga) * behind;
    const aligned = Math.abs(wrapA(Math.atan2(by - c.y, bx - c.x) - ga)) < 0.6;
    if (aligned || dist(c.x, c.y, px, py) < 50) { tx = bx; ty = by; } else { tx = px; ty = py; }
    inp.boost = aligned && c.boost > 10 && myD > 140 && B.skill > 0.5;
    inp.dash = aligned && myD < 90 && Math.random() < B.skill * 0.15;
  } else {
    // defensa: entre el balón y mi portería
    tx = lerp(ownGoalX, b.x, 0.38); ty = lerp(FH / 2, b.y, 0.5); inp.boost = false; inp.dash = false;
    const threat = (c.team === 0 ? b.x < FW * 0.4 : b.x > FW * 0.6); if (threat) { tx = lerp(ownGoalX, b.x, 0.6); ty = b.y; inp.boost = c.boost > 20; }
  }
  // ir hacia el punto
  const want = Math.atan2(ty - c.y, tx - c.x), d = wrapA(want - c.a);
  inp.st = clamp(d * 2.2, -1, 1); inp.th = Math.abs(d) > 2.2 ? -0.6 : 1; if (Math.abs(d) > 2.2) inp.st = -inp.st;
  if (dist(c.x, c.y, tx, ty) < 40 && !(closest)) inp.th = 0.2;
}
function step(dt) {
  if (!G || G.over) return;
  G.ev.length = 0;
  const me = G.cars.find(c => c.id === myId); if (me && !me.bot) Object.assign(me.inp, readInput(me));
  if (G.count > 0) { const before = Math.ceil(G.count); G.count -= dt; if (Math.ceil(G.count) !== before && G.count > 0) ev('c', 0, 0, '', Math.ceil(G.count)); if (G.count <= 0) ev('go', 0, 0, '', 0); }
  if (G.celebrate > 0) { G.celebrate -= dt; if (G.celebrate <= 0) { if (G.golden && G.score[0] !== G.score[1]) return endGame(); kickoff(); } }
  const frozen = G.count > 0;
  if (!frozen && G.celebrate <= 0) { G.t += dt; if (!G.golden) G.time -= dt; if (G.time <= 0 && !G.golden) { if (G.score[0] !== G.score[1]) return endGame(); G.golden = true; G.time = 0; big('¡GOL DE ORO!', '#ffd200', 1600); G.ev.push(['gg', 0, 0, '', 0]); } }
  for (const c of G.cars) {
    if (c.bot) botThink(c, dt);
    const inp = c.inp; c.dashCd -= dt;
    let th = inp.th, st = inp.st;
    if (inp.dir != null) { const d = wrapA(inp.dir.a - c.a); st = clamp(d * 2.5, -1, 1); th = inp.dir.m * (Math.abs(d) > 2.4 ? -0.5 : 1); if (Math.abs(d) > 2.4) st = -st; }
    if (frozen) { th = 0; }
    const fwd = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a), lat = -c.vx * Math.sin(c.a) + c.vy * Math.cos(c.a);
    const turn = st * clamp(Math.abs(fwd) / 140, 0, 1) * 3.6 * Math.sign(fwd || 1); c.a += turn * dt;
    let acc = th * (th > 0 ? 900 : 1100); if (th < 0 && fwd < 0) acc = th * 500;
    const boosting = inp.boost && c.boost > 0 && !frozen; if (boosting) { acc = 1500; c.boost -= dt * 33; if (Math.random() < 0.8) fx.emit(c.x - Math.cos(c.a) * 26, c.y - Math.sin(c.a) * 26, 2, TCOL[c.team], 120, 0.35, 5, 0.6, c.a + Math.PI); }
    const maxF = boosting ? 760 : 520;
    let nf = fwd + acc * dt; nf = clamp(nf, -300, maxF); nf *= Math.exp(-0.6 * dt); if (th === 0) nf *= Math.exp(-1.2 * dt);
    const nl = lat * Math.exp(-(inp.drift ? 2 : 9) * dt);
    c.vx = Math.cos(c.a) * nf - Math.sin(c.a) * nl; c.vy = Math.sin(c.a) * nf + Math.cos(c.a) * nl;
    if (inp.dash && c.dashCd <= 0 && !frozen) { c.vx += Math.cos(c.a) * 520; c.vy += Math.sin(c.a) * 520; c.dashCd = 1.2; ev('d', c.x, c.y, TCOL[c.team]); }
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (wallCollide(c, CR, 0.3)) { }
    for (const p of G.pads) if (p.t <= 0 && dist(c.x, c.y, p.x, p.y) < (p.big ? 40 : 28) && c.boost < 100) { c.boost = Math.min(100, c.boost + (p.big ? 100 : 25)); p.t = p.big ? 8 : 4; if (c.id === myId) sfx.play('power'); }
  }
  for (const p of G.pads) p.t -= dt;
  // coche contra coche
  for (let i = 0; i < G.cars.length; i++) for (let j = i + 1; j < G.cars.length; j++) { const a = G.cars[i], b = G.cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < CR * 2 && d > 0.01) { const nx = dx / d, ny = dy / d, k = (CR * 2 - d) / 2; a.x -= nx * k; a.y -= ny * k; b.x += nx * k; b.y += ny * k; const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { a.vx += rv * nx * 0.9; a.vy += rv * ny * 0.9; b.vx -= rv * nx * 0.9; b.vy -= rv * ny * 0.9; if (Math.abs(rv) > 300) ev('bump', (a.x + b.x) / 2, (a.y + b.y) / 2, '#fff'); } } }
  // balón
  const b = G.ball;
  if (!frozen) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.exp(-0.45 * dt); b.vy *= Math.exp(-0.45 * dt);
    b.vz -= 1400 * dt; b.z += b.vz * dt; if (b.z < 0) { b.z = 0; b.vz = Math.abs(b.vz) > 120 ? -b.vz * 0.5 : 0; }
    if (wallCollide(b, BR, 0.85)) ev('wb', b.x, b.y, '#fff');
    const order = [...G.cars].sort(() => Math.random() - 0.5);
    for (const c of order) {
      // el coche es una caja: punto más cercano de la caja al balón
      const ca = Math.cos(c.a), sa = Math.sin(c.a), rx = b.x - c.x, ry = b.y - c.y;
      const lx = clamp(rx * ca + ry * sa, -30, 30), ly = clamp(-rx * sa + ry * ca, -16, 16);
      const px = c.x + lx * ca - ly * sa, py = c.y + lx * sa + ly * ca, dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
      if (d < BR && b.z < 40) {
        const nx = d > 0.01 ? dx / d : ca, ny = d > 0.01 ? dy / d : sa;
        b.x = px + nx * BR; b.y = py + ny * BR;
        const rv = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
        if (rv < 0) {
          const imp = -rv * 1.55 + 60; b.vx += nx * imp; b.vy += ny * imp; c.vx -= nx * imp * 0.12; c.vy -= ny * imp * 0.12;
          const front = lx > 22; if (front && Math.abs(c.vx * ca + c.vy * sa) > 380) b.vz = Math.min(500, imp * 0.6);
          G.lastTouch[c.team] = c.id; G.lastToucher = c.id;
          if (imp > 250) ev('kick', b.x, b.y, TCOL[c.team], Math.min(1, imp / 900));
        }
      }
    }
    const sp = Math.hypot(b.vx, b.vy); if (sp > 1500) { b.vx *= 1500 / sp; b.vy *= 1500 / sp; }
    // gol
    if (G.celebrate <= 0 && (b.x < -BR || b.x > FW + BR)) {
      const team = b.x < 0 ? 1 : 0; G.score[team]++; G.celebrate = 2.6;
      const sc = G.cars.find(c => c.id === G.lastToucher); if (sc && sc.team === team) sc.goals++;
      ev('goal', b.x, b.y, TCOL[team], team); G.ev.push(['gn', 0, 0, TCOL[team], sc && sc.team === team ? sc.name : 'GOL']);
      if (!room.online || room.isHost) goalFx(TCOL[team], sc && sc.team === team ? sc.name : '');
    }
  }
}
function endGame() {
  G.over = true;
  const res = { mode: G.mode, score: G.score, opp: G.opp, rows: G.cars.map(c => [c.name, c.team, c.goals, c.id]) };
  if (room.isHost) room.broadcast({ t: 'end', res }); showEnd(res);
}

// ================== ENTRADA ==================
function readInput(me) {
  const o = { th: 0, st: 0, dir: null, boost: false, dash: false, drift: false };
  o.th = (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0); o.st = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  o.boost = down('ShiftLeft', 'ShiftRight', 'KeyK'); o.dash = down('Space', 'KeyJ'); o.drift = down('KeyL');
  const g = pad(); if (g) { if (Math.hypot(g.lx, g.ly) > 0.3) o.dir = { a: Math.atan2(g.ly, g.lx), m: Math.min(1, Math.hypot(g.lx, g.ly)) }; if (g.rt > 0.2) o.th = g.rt; if (g.lt > 0.2) o.th = -g.lt; if (g.b || g.rb) o.boost = true; if (g.a) o.dash = true; if (g.x) o.drift = true; }
  if (touch.la && Math.hypot(touch.lx, touch.ly) > 0.2) o.dir = { a: Math.atan2(touch.ly, touch.lx), m: Math.min(1, Math.hypot(touch.lx, touch.ly) * 1.3) };
  if (touch.btn.boost) o.boost = true; if (touch.btn.dash) o.dash = true;
  return o;
}

// ================== RED ==================
let sendT = 0;
room.onMsg = (from, d) => {
  if (room.isHost) { if (d.t === 'in' && G) { const c = G.cars.find(c => c.id === from); if (c) Object.assign(c.inp, d.i); } return; }
  if (d.t === 'snap') applySnap(d); else if (d.t === 'end') showEnd(d.res);
};
room.onStart = cfg => startPlay(cfg.mode, cfg.players);
room.onLeave = id => { if (id === 'host' && screen === 'play') { toast('El anfitrión se ha ido'); toMenu(); } else if (G) { const c = G.cars.find(c => c.id === id); if (c) c.bot = { skill: 0.7, role: 0 }; } };
function snap() { const r = v => Math.round(v); return { t: 'snap', s: G.score, tm: Math.ceil(G.time), gd: G.golden ? 1 : 0, cn: G.count > 0 ? Math.ceil(G.count) : 0, b: [r(G.ball.x), r(G.ball.y), r(G.ball.z), r(G.ball.vx), r(G.ball.vy)], c: G.cars.map(c => [c.id, c.name, c.team, r(c.x), r(c.y), +c.a.toFixed(2), r(c.boost), r(c.vx), r(c.vy), c.inp.boost && c.boost > 0 ? 1 : 0]), p: G.pads.map(p => p.t > 0 ? 0 : 1), e: G.ev.slice(0, 20) }; }
function applySnap(d) {
  const old = view ? new Map(view.cars.map(c => [c.id, c])) : new Map();
  view = { score: d.s, time: d.tm, golden: d.gd, count: d.cn, ball: view ? Object.assign(view.ball, { tx: d.b[0], ty: d.b[1], z: d.b[2], vx: d.b[3], vy: d.b[4] }) : { x: d.b[0], y: d.b[1], tx: d.b[0], ty: d.b[1], z: d.b[2], vx: d.b[3], vy: d.b[4] },
    cars: d.c.map(a => { const o = old.get(a[0]); return { id: a[0], name: a[1], team: a[2], tx: a[3], ty: a[4], x: o ? o.x : a[3], y: o ? o.y : a[4], a: a[5], boost: a[6], vx: a[7], vy: a[8], boosting: a[9] }; }),
    pads: G0pads.map((p, i) => ({ ...p, t: d.p[i] ? 0 : 1 })) };
  for (const e of d.e) playEv(e);
}
const G0pads = [[FW / 2, 80, 1], [FW / 2, FH - 80, 1], [240, 200, 0], [240, FH - 200, 0], [FW - 240, 200, 0], [FW - 240, FH - 200, 0], [FW / 2 - 250, FH / 2, 0], [FW / 2 + 250, FH / 2, 0]].map(([x, y, big]) => ({ x, y, big }));
let shake = 0, flash = 0, flashCol = '#fff';
function goalFx(col, name) { big(name ? '¡GOL DE ' + name + '!' : '¡GOOOL!', col, 2200); sfx.play('goal'); shake = 22; flash = 1; flashCol = col; }
function playEv(e) {
  const [ty, x, y, c, ex] = e;
  if (ty === 'kick') { fx.emit(x, y, 10 + ex * 20, c, 300 + ex * 300, 0.4, 4); fx.ring(x, y, c, 40 + ex * 40); sfx.play(ex > 0.6 ? 'hit' : 'bounce'); shake = Math.max(shake, ex * 6); }
  else if (ty === 'wb') { fx.emit(x, y, 6, '#fff', 160, 0.25, 3); sfx.play('bounce'); }
  else if (ty === 'bump') { fx.emit(x, y, 10, c, 220, 0.3, 3); sfx.play('hit'); }
  else if (ty === 'd') { fx.emit(x, y, 14, c, 200, 0.35, 4); sfx.play('dash'); }
  else if (ty === 'goal') { fx.emit(x, y, 140, c, 700, 1.4, 6); fx.emit(x, y, 60, '#fff', 500, 1, 4); fx.ring(x, y, c, 260); }
  else if (ty === 'gn') { if (room.online && !room.isHost) goalFx(c, ex === 'GOL' ? '' : ex); }
  else if (ty === 'k') { }
  else if (ty === 'c') { big(String(ex), '#fff', 700); sfx.play('beep'); }
  else if (ty === 'go') { big('¡YA!', '#39ff88', 700); sfx.play('go'); }
  else if (ty === 'gg') { if (room.online && !room.isHost) big('¡GOL DE ORO!', '#ffd200', 1600); }
}

// ================== DIBUJO ==================
function draw(dt, t) {
  const V = room.online && !room.isHost ? view : G;
  ctx.fillStyle = '#05010f'; ctx.fillRect(0, 0, S.W, S.H);
  if (!V) return;
  const topPad = 44, z = Math.min(S.W / (FW + 240), (S.H - topPad) / (FH + 60));
  shake *= Math.exp(-8 * dt); flash *= Math.exp(-4 * dt);
  ctx.save(); ctx.translate(S.W / 2 + rnd(-shake, shake), S.H / 2 + topPad / 2 + rnd(-shake, shake)); ctx.scale(z, z); ctx.translate(-FW / 2, -FH / 2);
  // césped neón
  const field = () => { ctx.moveTo(CORNER, 0); ctx.lineTo(FW - CORNER, 0); ctx.lineTo(FW, CORNER); ctx.lineTo(FW, FH / 2 - GOALW / 2); ctx.lineTo(FW + 90, FH / 2 - GOALW / 2); ctx.lineTo(FW + 90, FH / 2 + GOALW / 2); ctx.lineTo(FW, FH / 2 + GOALW / 2); ctx.lineTo(FW, FH - CORNER); ctx.lineTo(FW - CORNER, FH); ctx.lineTo(CORNER, FH); ctx.lineTo(0, FH - CORNER); ctx.lineTo(0, FH / 2 + GOALW / 2); ctx.lineTo(-90, FH / 2 + GOALW / 2); ctx.lineTo(-90, FH / 2 - GOALW / 2); ctx.lineTo(0, FH / 2 - GOALW / 2); ctx.lineTo(0, CORNER); ctx.closePath(); };
  ctx.fillStyle = '#071a14'; ctx.beginPath(); field(); ctx.fill();
  ctx.save(); ctx.beginPath(); field(); ctx.clip(); for (let x = 0; x < FW; x += 100) { ctx.fillStyle = (x / 100) % 2 ? '#08201a' : '#061712'; ctx.fillRect(x, 0, 100, FH); }
  glowDot(ctx, 0, FH / 2, 380, TCOL[0], 0.18); glowDot(ctx, FW, FH / 2, 380, TCOL[1], 0.18); ctx.restore();
  neon(ctx, '#ffffffaa', 2, () => { ctx.moveTo(FW / 2, 0); ctx.lineTo(FW / 2, FH); ctx.moveTo(FW / 2 + 110, FH / 2); ctx.arc(FW / 2, FH / 2, 110, 0, 7); ctx.rect(0, FH / 2 - 190, 170, 380); ctx.rect(FW - 170, FH / 2 - 190, 170, 380); }, 0.4);
  neon(ctx, '#39ff88', 4, field);
  neon(ctx, TCOL[0], 6, () => { ctx.moveTo(-90, FH / 2 - GOALW / 2); ctx.lineTo(-90, FH / 2 + GOALW / 2); });
  neon(ctx, TCOL[1], 6, () => { ctx.moveTo(FW + 90, FH / 2 - GOALW / 2); ctx.lineTo(FW + 90, FH / 2 + GOALW / 2); });
  // turbo
  const pads = V === G ? G.pads : V.pads;
  for (const p of pads) { const on = p.t <= 0, r = p.big ? 30 : 18; ctx.globalAlpha = on ? 1 : 0.25; glowDot(ctx, p.x, p.y, r * 2.4, '#ff8a1a', on ? 0.5 + Math.sin(t * 6) * 0.2 : 0.1); neon(ctx, '#ffd200', 2, () => ctx.arc(p.x, p.y, r, 0, 7)); ctx.globalAlpha = 1; }
  // balón (sombra + altura)
  const b = V.ball;
  if (V !== G) { b.x = lerp(b.x, b.tx + b.vx * 0.03, 1 - Math.exp(-20 * dt)); b.y = lerp(b.y, b.ty + b.vy * 0.03, 1 - Math.exp(-20 * dt)); }
  ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(b.x + b.z * 0.2, b.y + b.z * 0.35, BR, BR * 0.8, 0, 0, 7); ctx.fill();
  const sc = 1 + b.z / 300; glowDot(ctx, b.x, b.y - b.z * 0.3, BR * 3 * sc, '#ffffff', 0.4);
  ctx.fillStyle = '#f4efff'; ctx.beginPath(); ctx.arc(b.x, b.y - b.z * 0.3, BR * sc, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ff2bd6'; ctx.lineWidth = 3; ctx.beginPath(); const spin = (b.x + b.y) * 0.03; for (let i = 0; i < 3; i++) { const a = spin + i * 2.09; ctx.moveTo(b.x + Math.cos(a) * BR * 0.5 * sc, b.y - b.z * 0.3 + Math.sin(a) * BR * 0.5 * sc); ctx.arc(b.x, b.y - b.z * 0.3, BR * 0.5 * sc, a, a + 1); } ctx.stroke();
  // coches
  for (const c of V.cars) { if (V !== G) { c.x = lerp(c.x, c.tx, 1 - Math.exp(-18 * dt)); c.y = lerp(c.y, c.ty, 1 - Math.exp(-18 * dt)); if (c.boosting && Math.random() < 0.7) fx.emit(c.x - Math.cos(c.a) * 26, c.y - Math.sin(c.a) * 26, 1, TCOL[c.team], 120, 0.35, 5, 0.6, c.a + Math.PI); } drawCar(c, c.id === myId); }
  fx.update(dt); fx.draw(ctx);
  ctx.restore();
  if (flash > 0.02) { ctx.globalAlpha = flash * 0.35; ctx.fillStyle = flashCol; ctx.fillRect(0, 0, S.W, S.H); ctx.globalAlpha = 1; }
  // marcador
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '900 26px Orbitron'; ctx.fillStyle = TCOL[0]; ctx.fillText(V.score[0], S.W / 2 - 70, 8); ctx.fillStyle = TCOL[1]; ctx.fillText(V.score[1], S.W / 2 + 70, 8);
  ctx.font = '900 16px Orbitron'; ctx.fillStyle = V.golden ? '#ffd200' : '#fff'; const tm = Math.max(0, V.time); ctx.fillText(V.golden ? 'GOL DE ORO' : `${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`, S.W / 2, 14);
  const me = V.cars.find(c => c.id === myId); if (me) $('hpI').style.width = clamp(me.boost, 0, 100) + '%';
  $('wep').textContent = 'TURBO';
}
function drawCar(c, isMe) {
  const col = TCOL[c.team];
  ctx.save(); ctx.translate(c.x, c.y);
  glowDot(ctx, 0, 0, 60, col, 0.3);
  ctx.rotate(c.a);
  ctx.fillStyle = '#000a'; ctx.fillRect(-28, -14, 60, 34);
  ctx.fillStyle = '#05010f'; ctx.fillRect(-30, -17, 60, 34);
  ctx.fillStyle = '#222'; for (const [x, y] of [[-18, -19], [14, -19], [-18, 15], [14, 15]]) ctx.fillRect(x, y, 12, 5);
  neon(ctx, col, 3, () => { ctx.moveTo(-30, -15); ctx.lineTo(22, -17); ctx.lineTo(32, -8); ctx.lineTo(32, 8); ctx.lineTo(22, 17); ctx.lineTo(-30, 15); ctx.closePath(); });
  ctx.fillStyle = col + '66'; ctx.fillRect(-6, -10, 18, 20);
  ctx.fillStyle = '#fff'; ctx.fillRect(28, -12, 4, 6); ctx.fillRect(28, 6, 4, 6);
  ctx.restore();
  ctx.fillStyle = isMe ? '#fff' : col; ctx.font = '700 13px Orbitron'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(isMe ? '▼ ' + c.name : c.name, c.x, c.y - 30);
}

// ================== FLUJO ==================
function show(id) { for (const s of ['menu', 'lobbyBox', 'over', 'pause']) $(s).classList.toggle('hidden', s !== id); screen = id || 'play'; $('hud').classList.toggle('hidden', screen !== 'play'); ['hudTop', 'board', 'feed'].forEach(i => $(i).classList.add('hidden')); touch.show(screen === 'play'); }
let last = null;
function soloStart(mode) {
  sfx.ensure(); myId = 'me'; const me = { id: 'me', name: store.get('name', '') || 'TÚ', team: 0 };
  let opp = null, sk = [0.45, 0.7, 0.95][diff], skO = sk;
  if (mode === 'liga') { const L = lg(); opp = { name: TEAMS[L.round], round: L.round }; skO = clamp(0.35 + L.round * 0.08 + diff * 0.08, 0.3, 1); }
  const ps = [me, { id: 'b1', name: 'COMPI', bot: true, team: 0, skill: sk }, { id: 'b2', name: opp ? opp.name.split(' ').pop().slice(0, 8) : 'NARANJA', bot: true, team: 1, skill: skO }, { id: 'b3', name: opp ? 'RIVAL' : 'ROJO', bot: true, team: 1, skill: skO }];
  startPlay(mode, ps, opp);
}
function startPlay(mode, players, opp) {
  last = { mode, players, opp }; view = null;
  if (!room.online || room.isHost) newGame(mode, players, opp); else G = null;
  if (room.online) myId = room.myId;
  paused = false; show(null); goFull(); sfx.music(SONGS.hero); if (opp) toast(`🏆 JORNADA ${opp.round + 1}/8 · contra <b>${opp.name}</b>`, 3000);
}
function showEnd(res) {
  show('over'); sfx.music(null);
  const me = res.rows.find(r => r[3] === myId), myTeam = me ? me[1] : 0, won = res.score[myTeam] > res.score[1 - myTeam];
  $('oTitle').textContent = won ? '¡VICTORIA!' : 'DERROTA'; $('oSub').textContent = `${res.score[0]} - ${res.score[1]}`;
  sfx.play(won ? 'win' : 'lose');
  if (res.mode === 'liga') {
    const L = lg(); L.pts += won ? 3 : 0; L.round++;
    if (L.round >= 8) { const champ = L.pts >= 18; $('oSub').textContent += champ ? ` · ¡CAMPEÓN DE LIGA CON ${L.pts} PUNTOS!` : ` · Liga terminada con ${L.pts} pts (hacen falta 18)`; if (champ) L.cups++; L.round = 0; L.pts = 0; }
    else $('oSub').textContent += ` · ${L.pts} puntos tras ${L.round} jornadas`;
    store.set('futbol.liga', L); showBest();
  }
  $('oTbl').innerHTML = res.rows.map(r => `<tr class="${r[3] === myId ? 'me' : ''}"><td style="color:${TCOL[r[1]]}">${r[0]}</td><td>${r[2]} ⚽</td></tr>`).join('');
  $('oAgain').textContent = res.mode === 'liga' ? 'SIGUIENTE PARTIDO' : 'OTRA';
  $('oAgain').classList.toggle('hidden', room.online && !room.isHost);
}
function toMenu() { G = null; view = null; if (room.online) room.leave(); show('menu'); sfx.music(null); }
$('mFFA').onclick = () => soloStart('quick');
$('mWaves').onclick = () => soloStart('liga');
$('mOnline').onclick = () => { sfx.ensure(); show('lobbyBox'); renderLobby(); };
let onBots = 1;
const renderLobby = () => lobby($('lobbyBox'), room, {
  onBack: () => { room.leave(); show('menu'); },
  extra: () => `<div class="opt">BOTS DE RELLENO<div class="seg" id="lbBots"><button data-v="0">0</button><button data-v="1">1</button><button data-v="2">2</button></div></div>`,
  bindExtra: el => seg(el.querySelector('#lbBots'), onBots, v => onBots = v),
  onGo: () => { const ps = room.players.map((p, i) => ({ id: p.id, name: p.name, team: i % 2 })); for (let i = 0; i < onBots; i++) { const n0 = ps.filter(p => p.team === 0).length, n1 = ps.length - n0; ps.push({ id: 'b' + i, name: 'BOT' + (i + 1), bot: true, team: n0 <= n1 ? 0 : 1 }); } room.start({ mode: 'quick', players: ps }); },
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
      if (!room.online || room.isHost) { step(dt); if (room.isHost && G) { sendT -= dt; if (sendT <= 0) { sendT = 1 / 25; room.broadcast(snap()); } } }
      else { sendT -= dt; if (sendT <= 0) { sendT = 1 / 30; room.send({ t: 'in', i: readInput() }); } }
    }
  }
  draw(dt, t);
});
show('menu');
if (location.hash === '#dbg') window.dbg = { get G() { return G; }, botMe() { const m = G.cars.find(c => c.id === 'me'); m.bot = { skill: 0.8, role: 0 }; } };
