// Carrera: parrilla, semáforo, IA, vueltas, posiciones, rebufo, fantasma de contrarreloj y premios
import { THREE, scene, V3, G, clamp, lerp, wrapAngle, showMsg, popup, fmtTime, labelTex, emit, burst, isTouch } from './core.js';
import { track } from './tracks.js';
import { CARS, carById, makeCarMesh, newCar, stepCar, poseCar, carCollide, respawn, PAINTS, chargeLevel } from './cars.js';
import { sfx } from './audio.js';

export const DIFFS = {
  facil: { name: 'FÁCIL', latA: 19, maxK: 0.86, rubber: 0.12, drift: false, prize: 0.6 },
  normal: { name: 'NORMAL', latA: 25, maxK: 0.95, rubber: 0.08, drift: false, prize: 1 },
  locura: { name: 'LOCURA', latA: 31, maxK: 1.0, rubber: 0.05, drift: true, prize: 1.8 },
};
const NAMES = ['VÍBORA', 'KAITO', 'LA REINA', 'TURBO', 'FANTASMA', 'NOVA', 'ÓXIDO', 'RAYITO', 'MAMBA', 'ZAFIRO', 'KOI', 'BLITZ'];

export const race = { on: false, cars: [], player: null, ghost: null, remotes: [] };

const tagFor = (name, hex) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(name, hex), depthWrite: false, depthTest: false, transparent: true })); s.scale.set(5, 0.95, 1); s.renderOrder = 5; return s; };

export function clearRace() {
  for (const c of race.cars) { scene.remove(c.mesh); if (c.tag) scene.remove(c.tag); }
  if (race.ghost) scene.remove(race.ghost.mesh);
  race.cars = []; race.ghost = null; race.on = false; race.player = null;
}

// opts: { mode: 'race'|'trial'|'online', laps, diff, car, paint, rivals, seed, name }
export function setupRace(opts) {
  clearRace();
  const n = track.n, D = DIFFS[opts.diff || 'normal'];
  race.goAt = 0; race.startJudged = false; race.early = false;
  Object.assign(race, { on: true, mode: opts.mode, laps: opts.laps || 3, diff: D, diffId: opts.diff || 'normal', t: 0, count: 4.6, go: false, goT: 0, lightsOn: 0, lapTimes: [], lapStart: 0, best: Infinity, finished: [], doneT: 0, maxLap: 0, results: null, falseStart: false, rec: [], recT: 0, opts });
  const slots = [];
  const total = opts.mode === 'race' ? 1 + (opts.rivals ?? 7) : 1;
  if (opts.goDelay !== undefined) race.goDelay = opts.goDelay; else race.goDelay = null;
  for (let k = 0; k < Math.max(total, opts.gridSlots || 0); k++) { const row = Math.floor(k / 2), side = k % 2 ? 1 : -1; slots.push([(n - 5 - row * 5) % n, side * (track.hw * 0.42)]); }
  // jugador: en la parrilla según opción (en carrera sale el último o en mitad)
  const spec = carById(opts.car);
  const pm = makeCarMesh(spec, opts.paint, { neon: 0x00f0ff }); scene.add(pm);
  const P = newCar(spec, pm); P.isPlayer = true; P.name = opts.name || 'TÚ';
  race.player = P; race.cars.push(P);
  const pSlot = opts.mode === 'race' ? Math.min(slots.length - 1, opts.gridPos ?? Math.floor(total / 2)) : (opts.gridPos ?? 0);
  place(P, slots[pSlot]);
  if (opts.mode === 'race' || opts.aiList) {
    let k = 0;
    const pool = CARS.filter(c => c.id !== 'fantasma' || opts.diff === 'locura');
    const list = opts.aiList || [];
    const names = [...NAMES].sort(() => Math.random() - 0.5);
    if (!opts.aiList) for (let s = 0; s < total; s++) {
      if (s === pSlot) continue;
      const sp = pool[Math.min(pool.length - 1, Math.floor(Math.random() * (opts.diff === 'facil' ? 3 : opts.diff === 'locura' ? pool.length : 5)))];
      list.push({ car: sp.id, paint: PAINTS[(k * 3 + 1) % PAINTS.length], name: names[k % names.length], slot: s }); k++;
    }
    list.forEach((a, k) => {
      const sp = carById(a.car), hex = a.paint;
      const m = makeCarMesh(sp, hex, { neon: [0xff2bd6, 0xffd200, 0x39ff88, 0xff7a1a][k % 4] }); scene.add(m);
      const c = newCar(sp, m); c.ai = { bias: (Math.random() - 0.5) * 3, skill: 0.92 + Math.random() * 0.1 - (a.slot < pSlot ? 0 : 0.03), react: 0.08 + Math.random() * 0.35, nitroT: 0 };
      c.name = a.name; c.netId = a.id; c.tag = tagFor(c.name, hex); scene.add(c.tag);
      place(c, slots[a.slot]); race.cars.push(c);
    });
  }
  // fantasma (contrarreloj)
  if (opts.mode === 'trial') {
    const g = loadGhost(track.def.id);
    if (g) {
      const gm = makeCarMesh(carById(g.car), 0x9fe8ff);
      gm.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.32; o.material.depthWrite = false; } });
      scene.add(gm); race.ghost = { mesh: gm, data: g.f, time: g.t };
    }
  }
  for (const l of track.lights) l.material.color.set(0x220000);
  race.slots = slots;
  return P;
}
function place(c, [i, lat]) {
  const p = track.P[i], R = track.R[i], T = track.T[i];
  c.pos.set(p.x + R.x * lat, p.y, p.z + R.z * lat); c.h = Math.atan2(T.x, T.z); c.ti = i; c.lap = 0; c.vel.set(0, 0, 0); c.vf = c.vr = 0;
  c.prevGround = p.y; poseCar(c, 0.016, false);
}

// ================== IA ==================
export function aiControl(c, dt) {
  const D = race.diff, n = track.n, P = track.P, sp = Math.max(Math.abs(c.vf), 6);
  const look = Math.floor(clamp(sp * 0.5, 7, 34) / 2);
  const ti = (c.ti + look) % n;
  const cu = track.curv[(c.ti + look + 8) % n];
  const off = clamp(cu * 160, -1, 1) * (track.hw - 2.4) + c.ai.bias;
  const R = track.R[ti], tx = P[ti].x + R.x * off, tz = P[ti].z + R.z * off;
  const diff = wrapAngle(Math.atan2(tx - c.pos.x, tz - c.pos.z) - c.h);
  const ctl = { throttle: 1, steer: clamp(-diff * 2.6, -1, 1), drift: false, nitro: false };
  // velocidad segura según la curvatura que viene
  let maxC = 0.0005; const ahead = Math.ceil(clamp(sp * sp / 60, 20, 160) / 2);
  for (let k = 2; k < ahead; k += 2) maxC = Math.max(maxC, Math.abs(track.curv[(c.ti + k) % n]) * (1 - k / ahead * 0.35));
  const grip = c.spec.s.grip / 9.5;
  let vT = Math.sqrt(D.latA * grip * c.ai.skill / maxC);
  // goma elástica suave
  const pl = race.player, gap = pl ? (pl.prog - c.prog) * 2 : 0;
  c.maxK = D.maxK * clamp(1 + gap / 400 * D.rubber * 10, 0.9, 1.08) * c.ai.skill;
  if (c.vf > vT + 3) ctl.throttle = -clamp((c.vf - vT) / 12, 0.3, 1);
  else if (c.vf > vT) ctl.throttle = 0;
  if (D.drift && maxC > 0.028 && sp > 28 && Math.abs(track.curv[(c.ti + 6) % n]) > 0.022) { ctl.drift = true; }
  if (c.drifting && Math.abs(track.curv[(c.ti + 4) % n]) < 0.012) ctl.drift = false;
  c.ai.nitroT -= dt;
  if (maxC < 0.006 && c.nitro > 35 && c.ai.nitroT <= 0 && Math.random() < 0.02) c.ai.nitroT = 2.2;
  ctl.nitro = c.ai.nitroT > 0;
  // atascado: marcha atrás
  if (Math.abs(c.vf) < 2 && race.go && race.t > 3) { c.ai.stuck = (c.ai.stuck || 0) + dt; if (c.ai.stuck > 2.5) { respawn(c); c.ai.stuck = 0; } } else c.ai.stuck = 0;
  return ctl;
}

// ================== BUCLE DE CARRERA ==================
export function updateRace(dt, playerCtl, ev) {
  if (!race.on) return;
  const P = race.player;
  race.t += dt;
  // semáforo: 5 luces rojas, se apagan todas = ¡YA!
  if (!race.go) {
    race.count -= dt;
    const lit = clamp(Math.floor((4.6 - race.count) / 0.75), 0, 5);
    if (lit !== race.lightsOn && race.count > 0.1) { race.lightsOn = lit; for (let k = 0; k < 5; k++) track.lights[k].material.color.set(k < lit ? new THREE.Color(6, 0.1, 0.1) : 0x220000); if (lit) sfx.beep(false); }
    if (race.lightsOn === 5 && !race.goAt) race.goAt = race.t + (race.goDelay ?? (0.3 + Math.random() * 0.9));
    if (playerCtl.throttle > 0.5 && race.lightsOn === 5) race.early = true;
    if (playerCtl.throttle <= 0.1) race.early = false;
    if (race.goAt && race.t >= race.goAt) {
      race.go = true; race.goT = race.t; race.lapStart = race.t;
      for (const l of track.lights) l.material.color.set(new THREE.Color(0.1, 4, 0.6));
      setTimeout(() => track.lights.forEach(l => l.material.color.set(0x220000)), 1500);
      sfx.beep(true); showMsg('¡YA!', '#39ff88', 0.9, true);
      if (race.early) { P.maxK = 0.25; P.spinT = 1.0; showMsg('¡PATINAS! TE HAS ADELANTADO', '#ff2a4d', 1.4); sfx.deny(); }
      for (const c of race.cars) if (c.ai) c.ai.startAt = race.t + c.ai.react;
    }
    for (const c of race.cars) { poseCar(c, dt, false); if (c.tag) c.tag.position.set(c.pos.x, c.pos.y + 3, c.pos.z); }
    return;
  }
  // salida perfecta: pisar justo al apagarse
  if (!race.startJudged) {
    if (playerCtl.throttle > 0.5) {
      race.startJudged = true; const r = race.t - race.goT;
      if (!race.early && r < 0.2) { P.boostT = 1.3; P.nitro = Math.min(100, P.nitro + 15); popup('¡SALIDA PERFECTA!', '#39ff88'); sfx.boost(); }
      else if (!race.early && r < 0.45) popup('BUENA SALIDA', '#9fe8ff');
    } else if (race.t - race.goT > 1) race.startJudged = true;
  }
  if (P.spinT > 0) { P.spinT -= dt; if (P.spinT <= 0) P.maxK = 1; }
  // coches
  for (const c of race.cars) {
    if (c.isPlayer) {
      if (c.finished) { stepCar(c, { throttle: 0.2, steer: autoSteer(c), drift: false, nitro: false }, dt); }
      else stepCar(c, playerCtl, dt, ev, 1);
      c.braking = playerCtl.throttle < 0;
    } else if (c.ai) {
      const ctl = race.t < c.ai.startAt ? { throttle: 0, steer: 0 } : aiControl(c, dt);
      if (c.finished) { ctl.throttle = 0.3; ctl.nitro = false; ctl.drift = false; }
      stepCar(c, ctl, dt); c.braking = ctl.throttle < 0;
    }
    poseCar(c, dt, !isTouch || c.isPlayer || c.pos.distanceToSquared(P.pos) < 2500);
    if (c.tag) { c.tag.position.set(c.pos.x, c.pos.y + 2.6, c.pos.z); const d = c.tag.position.distanceTo(G.camPos || c.pos); c.tag.material.opacity = Math.min(1, Math.max(0, (d - 9) / 10)); }
  }
  // choques
  const all = race.cars.concat(race.remotes);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j]; if (a.remote && b.remote) continue;
    const imp = carCollide(a, b);
    if (imp > 4 && (a.isPlayer || b.isPlayer)) { ev.bump && ev.bump(imp, (a.pos.x + b.pos.x) / 2, (a.pos.y + b.pos.y) / 2 + 0.6, (a.pos.z + b.pos.z) / 2); }
  }
  // rebufo
  for (const c of race.cars) {
    let s = false; const fx = Math.sin(c.h), fz = Math.cos(c.h);
    if (Math.abs(c.vf) > 30) for (const o of all) {
      if (o === c) continue;
      const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along > 3 && along < 28 && side < 2.6 && Math.abs(o.pos.y - c.pos.y) < 2) { s = true; break; }
    }
    c.slipK = s ? Math.min(1.5, c.slipK + dt) : Math.max(0, c.slipK - dt * 2);
    if (c.slipK > 0.6) c.nitro = Math.min(100, c.nitro + 7 * dt);
  }
  // vueltas del jugador
  if (!P.finished && P.lap > race.maxLap) {
    race.maxLap = P.lap;
    if (P.lap >= 2) {
      const lt = race.t - race.lapStart; race.lapStart = race.t; race.lapTimes.push(lt);
      const prevBest = race.best; race.best = Math.min(race.best, lt);
      const delta = isFinite(prevBest) ? lt - prevBest : null;
      if (race.mode === 'trial') saveGhostIfBest(lt);
      race.rec = []; race.recT = 0;
      if (P.lap > race.laps) finishPlayer();
      else {
        const last = P.lap === race.laps;
        showMsg(last ? 'ÚLTIMA VUELTA' : `VUELTA ${P.lap}/${race.laps}`, last ? '#ffd200' : '#fff', 1.6, true);
        popup(fmtTime(lt) + (delta !== null ? ` (${delta < 0 ? '' : '+'}${delta.toFixed(3)})` : ''), delta !== null && delta < 0 ? '#39ff88' : '#ffffff');
        sfx.lap();
      }
    } else { race.lapStart = race.t; race.rec = []; race.recT = 0; }
  }
  // grabar fantasma
  if (race.mode === 'trial' && P.lap >= 1 && !P.finished) {
    race.recT += dt;
    while (race.rec.length < race.recT / 0.05) race.rec.push([+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2), +P.h.toFixed(3)]);
  }
  if (race.ghost) {
    const lapT = race.t - race.lapStart, g = race.ghost, f = lapT / 0.05, i = Math.floor(f), a = g.data[i], b = g.data[i + 1];
    g.mesh.visible = !!(a && b) && P.lap >= 1;
    if (a && b) { const k = f - i; g.mesh.position.set(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)); g.mesh.rotation.y = a[3] + wrapAngle(b[3] - a[3]) * k; }
  }
  // IA que termina
  for (const c of race.cars) if (c.ai && !c.finished && c.lap > race.laps) { c.finished = true; c.finishT = race.t - race.goT; race.finished.push(c); }
  // posiciones
  const order = [...race.cars, ...race.remotes].sort((a, b) => (a.finished && b.finished) ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog);
  order.forEach((c, i) => c.place = i + 1);
  race.order = order;
  if (P.finished && !race.results) { race.doneT += dt; const allDone = race.cars.every(c => c.finished) && race.remotes.every(r => r.finished); if (race.doneT > 6 || allDone && race.doneT > 2.5) makeResults(); }
}
function autoSteer(c) { const n = track.n, i = (c.ti + 8) % n, p = track.P[i]; return clamp(-wrapAngle(Math.atan2(p.x - c.pos.x, p.z - c.pos.z) - c.h) * 2, -1, 1); }

function finishPlayer() {
  const P = race.player; P.finished = true; P.finishT = race.t - race.goT; race.finished.push(P);
  const place = 1 + race.cars.filter(c => c !== P && c.finished).length + race.remotes.filter(r => r.finished && r.finishT < P.finishT).length;
  race.place = place;
  showMsg(race.mode === 'trial' ? '¡META!' : place === 1 ? '¡VICTORIA!' : `${place}º PUESTO`, place === 1 ? '#ffd200' : '#ff2bd6', 3, true);
  sfx.finish(place === 1);
  for (let k = 0; k < 6; k++) setTimeout(() => { const p = P.pos; burst(new V3(p.x + (Math.random() - 0.5) * 30, p.y + 14 + Math.random() * 8, p.z + (Math.random() - 0.5) * 30), 120, ...[[4, 1, 3], [0.5, 3, 4], [4, 3.4, 0.4]][k % 3], 22, 1.6, 6, 4); }, k * 260);
}
function makeResults() {
  const P = race.player;
  const rows = race.order.map(c => ({ name: c.isPlayer ? (c.name || 'TÚ') : c.name, me: !!c.isPlayer, time: c.finished ? c.finishT : null, car: c.spec.name }));
  race.results = { rows, best: race.best, laps: race.lapTimes, place: race.place, total: P.finishT };
  G.onResults && G.onResults(race.results);
}

// ================== FANTASMA ==================
const GK = id => 'apex.ghost.' + id;
export function loadGhost(id) { try { return JSON.parse(localStorage.getItem(GK(id)) || 'null'); } catch (e) { return null; } }
function saveGhostIfBest(lt) {
  const old = loadGhost(track.def.id);
  if (old && old.t <= lt) return;
  try { localStorage.setItem(GK(track.def.id), JSON.stringify({ t: lt, car: race.player.spec.id, f: race.rec })); } catch (e) {}
  if (race.ghost) { race.ghost.data = race.rec.slice(); race.ghost.time = lt; }
  popup('¡NUEVO FANTASMA!', '#9fe8ff');
}
