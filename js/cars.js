// Coches: catálogo, modelos 3D (carrocería extruida, pintura con reflejos) y física arcade con derrape y miniturbo
import { THREE, V3, clamp, lerp, radialTex, emit, puff, G } from './core.js';
import { track, locate } from './tracks.js';

// max m/s · accel · turn · grip · drift (agarre en derrape) · charge (carga de miniturbo) · mass
export const CARS = [
  { id: 'zeta', name: 'ZETA GT', price: 0, desc: 'Equilibrado. Perfecto para aprender a trazar.', s: { max: 78, accel: 30, turn: 2.35, grip: 9, drift: 2.2, charge: 1, mass: 1 },
    look: { L: 4.5, W: 2.0, belt: 0.95, tail: 1.0, nose: 0.78, roof: 1.38, cab: [-0.95, -0.35, 0.55, 1.2], wing: 'lip', color: 0x1e6bff } },
  { id: 'pulga', name: 'PULGA R', price: 0, desc: 'Ligero y nervioso. Gira como nadie, corre menos.', s: { max: 72, accel: 33, turn: 2.75, grip: 10.5, drift: 2.4, charge: 1.1, mass: 0.8 },
    look: { L: 3.9, W: 1.85, belt: 0.98, tail: 1.05, nose: 0.82, roof: 1.48, cab: [-1.2, -0.7, 0.35, 0.95], wing: 'roof', color: 0xffc400 } },
  { id: 'toro', name: 'TORO V8', price: 8000, desc: 'Muscle car. Bestia en recta, un camión en curva.', s: { max: 86, accel: 33, turn: 2.05, grip: 8.2, drift: 2.0, charge: 0.9, mass: 1.5 },
    look: { L: 4.9, W: 2.15, belt: 0.95, tail: 1.02, nose: 0.92, roof: 1.32, cab: [-0.9, -0.3, 0.35, 0.95], wing: 'duck', scoop: true, color: 0xd0102a } },
  { id: 'kitsune', name: 'KITSUNE', price: 12000, desc: 'Nacido para derrapar. Carga el miniturbo el doble de rápido.', s: { max: 80, accel: 31, turn: 2.6, grip: 9, drift: 1.6, charge: 1.9, mass: 0.95 },
    look: { L: 4.4, W: 1.95, belt: 0.9, tail: 0.95, nose: 0.72, roof: 1.3, cab: [-0.9, -0.3, 0.5, 1.1], wing: 'gt', color: 0xf0f0f8 } },
  { id: 'rayo', name: 'RAYO X', price: 25000, desc: 'Hiperdeportivo. Brutal, pero castiga cada error.', s: { max: 94, accel: 40, turn: 2.45, grip: 9.4, drift: 2.1, charge: 1.1, mass: 1.05 },
    look: { L: 4.7, W: 2.1, belt: 0.78, tail: 0.88, nose: 0.6, roof: 1.12, cab: [-0.7, -0.1, 0.55, 1.35], wing: 'gt', fins: true, color: 0x39ff88 } },
  { id: 'fantasma', name: 'FANTASMA', price: 50000, desc: 'Prototipo de Le Mans. Lo mejor en todo. Para leyendas.', s: { max: 100, accel: 42, turn: 2.6, grip: 10.5, drift: 2.0, charge: 1.4, mass: 1 },
    look: { L: 5.0, W: 2.1, belt: 0.72, tail: 0.95, nose: 0.5, roof: 1.08, cab: [-0.4, 0.1, 0.65, 1.5], wing: 'proto', fins: true, color: 0x9d4dff } },
];
export const carById = id => CARS.find(c => c.id === id) || CARS[0];
export const PAINTS = [0x1e6bff, 0xd0102a, 0xffc400, 0x39ff88, 0xf0f0f8, 0x101014, 0x9d4dff, 0xff2bd6, 0x00e0ff, 0xff7a1a];
const statOf = s => ({ vel: (s.max - 68) / 34, acc: (s.accel - 26) / 18, man: (s.turn * s.grip - 16) / 14, der: (s.charge - 0.7) / 1.4 });
export { statOf };

// ================== MODELO 3D ==================
const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 24); tireGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.36, 20); rimGeo.rotateZ(Math.PI / 2);
const spokeGeo = new THREE.BoxGeometry(0.37, 0.5, 0.07);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, metalness: 1, roughness: 0.22 });
const carbon = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, metalness: 0.5, roughness: 0.35 });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x05060a, metalness: 0.9, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 });
const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5.5) });
const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.15, 0.25) });
const brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.2, 0.4) });

function extrude(points, width, bevel = 0.1) {
  const sh = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 6 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

export function makeCarMesh(spec, paintHex, opt = {}) {
  const L = spec.look, g = new THREE.Group(); g.rotation.order = 'YXZ';
  const body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: paintHex ?? L.color, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
  const hl = L.L / 2, b = L.belt, cab = L.cab;
  // carrocería: perfil lateral (x = largo, y = alto)
  const prof = [[-hl, 0.34], [-hl, L.tail], [-hl + 0.3, L.tail + 0.05], [cab[0] - 0.15, b + 0.02], [cab[3] + 0.1, b], [hl - 0.55, L.nose], [hl - 0.08, L.nose - 0.14], [hl, 0.5], [hl - 0.05, 0.3], [-hl + 0.1, 0.28]];
  const bm = new THREE.Mesh(extrude(prof, L.W, 0.16), paint); bm.castShadow = true; bm.receiveShadow = true; body.add(bm);
  // cabina de cristal
  const gp = [[cab[0], b - 0.04], [cab[1], L.roof], [cab[2], L.roof], [cab[3], b - 0.04]];
  const gl = new THREE.Mesh(extrude(gp, L.W * 0.8, 0.12), glassMat); gl.castShadow = true; body.add(gl);
  // techo pintado
  const rf = new THREE.Mesh(extrude([[cab[1] + 0.05, L.roof - 0.05], [cab[1] + 0.12, L.roof + 0.04], [cab[2] - 0.12, L.roof + 0.04], [cab[2] - 0.05, L.roof - 0.05]], L.W * 0.72, 0.06), paint); body.add(rf);
  // faldón y difusor de carbono
  const sk = new THREE.Mesh(new THREE.BoxGeometry(L.W + 0.04, 0.12, L.L * 0.8), carbon); sk.position.y = 0.3; body.add(sk);
  const df = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.8, 0.2, 0.3), carbon); df.position.set(0, 0.38, -hl + 0.05); body.add(df);
  // luces
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.26, 0.1, 0.12), headMat); h.position.set(s * L.W * 0.3, L.nose - 0.2, hl - 0.25); h.rotation.x = -0.3; body.add(h);
  }
  const tl = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.86, 0.08, 0.06), tailMat); tl.position.set(0, L.tail - 0.16, -hl - 0.02); body.add(tl);
  const brake = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.86, 0.09, 0.07), brakeMat); brake.position.copy(tl.position); brake.position.z -= 0.01; brake.visible = false; body.add(brake);
  // neón lateral
  const neonCol = new THREE.Color(opt.neon ?? 0x00f0ff);
  const neon = new THREE.MeshBasicMaterial({ color: neonCol.clone().multiplyScalar(3) });
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, L.L * 0.7), neon); st.position.set(s * (L.W / 2 + 0.02), 0.42, 0); body.add(st); }
  // alerones y extras
  if (L.wing === 'gt' || L.wing === 'proto') {
    const y = L.tail + (L.wing === 'proto' ? 0.55 : 0.42);
    const w = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.96, 0.06, 0.45), carbon); w.position.set(0, y, -hl + 0.35); w.rotation.x = 0.12; body.add(w);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.96, 0.03, 0.04), neon); wl.position.set(0, y + 0.03, -hl + 0.13); body.add(wl);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, y - L.tail + 0.05, 0.3), carbon); p.position.set(s * L.W * 0.3, (y + L.tail) / 2, -hl + 0.4); body.add(p); }
  } else if (L.wing === 'duck') { const w = new THREE.Mesh(extrude([[-hl + 0.02, L.tail], [-hl + 0.02, L.tail + 0.16], [-hl + 0.4, L.tail + 0.03]], L.W * 0.95, 0.03), paint); body.add(w); }
  else if (L.wing === 'roof') { const w = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.7, 0.05, 0.3), carbon); w.position.set(0, L.roof + 0.02, cab[0] - 0.05); body.add(w); }
  else { const w = new THREE.Mesh(new THREE.BoxGeometry(L.W * 0.9, 0.04, 0.16), carbon); w.position.set(0, L.tail + 0.07, -hl + 0.18); body.add(w); }
  if (L.fins) for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 1.1), paint); f.position.set(s * 0.45, L.tail + 0.15, -hl + 0.8); body.add(f); }
  if (L.scoop) { const sc = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.9), carbon); sc.position.set(0, L.nose + 0.05, hl - 1.25); body.add(sc); }
  // escapes con llama
  const flames = [];
  for (const s of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10), rimMat); ex.rotation.x = Math.PI / 2; ex.position.set(s * 0.4, 0.4, -hl - 0.02); body.add(ex);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.9, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(s * 0.4, 0.4, -hl - 0.55); fl.visible = false; body.add(fl); flames.push(fl);
  }
  // ruedas
  const wheels = [], front = [];
  const wz = hl - 0.85, wx = L.W / 2 - 0.12;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz + 0.05], [wx, -wz + 0.05]]) {
    const piv = new THREE.Group(); piv.position.set(x, 0.42, z); g.add(piv);
    const w = new THREE.Group(); piv.add(w);
    const t = new THREE.Mesh(tireGeo, tireMat); t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(rimGeo, rimMat); w.add(r);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(spokeGeo, rimMat); sp.rotation.x = k * Math.PI * 2 / 5; sp.position.x = x > 0 ? 0.03 : -0.03; w.add(sp); }
    wheels.push(w); if (z > 0) front.push(piv);
  }
  // brillo bajo el coche
  const under = new THREE.Mesh(new THREE.PlaneGeometry(L.W + 1.6, L.L + 1.6), new THREE.MeshBasicMaterial({ map: radialTex, color: neonCol.clone().multiplyScalar(0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  under.rotation.x = -Math.PI / 2; under.position.y = 0.05; g.add(under);
  g.userData = { body, wheels, front, brake, flames, under, paint, neon, len: L.L, wid: L.W };
  return g;
}
export function setPaint(mesh, hex) { mesh.userData.paint.color.set(hex); }

// ================== FÍSICA ==================
export function newCar(spec, mesh) {
  return {
    spec, mesh, pos: mesh.position, h: 0, vel: new V3(), vy: 0, vf: 0, vr: 0, air: 0, airT: 0, ti: 0, lap: 0, prog: 0, lat: 0,
    drifting: 0, driftDir: 0, charge: 0, boostT: 0, nitro: 40, slip: 0, slipK: 0, steerVis: 0, pitch: 0, roll: 0, wallT: 0, finished: false,
    radius: Math.max(2.0, spec.look.L * 0.45), mass: spec.s.mass, onBoost: 0, perfect: 0, isNitro: false,
  };
}
export const chargeLevel = c => c.charge >= 2.7 ? 3 : c.charge >= 1.7 ? 2 : c.charge >= 0.8 ? 1 : 0;
const CHG_COL = [null, [0.4, 1.4, 4], [4, 1.6, 0.3], [3, 0.4, 4]];
const _f = new V3();

// ctl: { throttle -1..1, steer -1..1, drift bool, nitro bool }; ev: callbacks de efectos (solo jugador)
export function stepCar(c, ctl, dt, ev = null, assist = 1) {
  const S = c.spec.s, fx = Math.sin(c.h), fz = Math.cos(c.h), sx = fz, sz = -fx;
  let vf = c.vel.x * fx + c.vel.z * fz, vr = c.vel.x * sx + c.vel.z * sz;
  const onGround = c.air <= 0;
  const wet = track.wet || 0;
  // turbo
  const nitroOn = ctl.nitro && c.nitro > 0 && onGround;
  if (nitroOn) c.nitro = Math.max(0, c.nitro - 32 * dt);
  c.isNitro = nitroOn;
  if (c.boostT > 0) c.boostT -= dt;
  const boosting = nitroOn || c.boostT > 0;
  const slipB = c.slipK > 0.6 ? 1.06 : 1;
  const maxV = S.max * (boosting ? 1.22 : 1) * slipB * (c.maxK || 1);
  if (onGround) {
    let thr = ctl.throttle;
    if (boosting) thr = 1;
    if (thr > 0) {
      const pw = S.accel * (boosting ? 1.9 : 1) * (1 - Math.pow(clamp(vf / maxV, 0, 1), 2.2) * 0.85);
      vf += pw * thr * dt * (vf < 0 ? 2.5 : 1);
    } else if (thr < 0) { if (vf > 0.5) vf -= 58 * dt * -thr; else vf -= S.accel * 0.5 * dt; }
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (4 + Math.abs(vf) * 0.04) * dt);
    if (vf > maxV) vf = Math.max(maxV, vf - 30 * dt);
    if (vf < -16) vf = -16;
    // pendiente
    const loc = c.loc; if (loc) { const dir = loc.T.x * fx + loc.T.z * fz; vf -= 24 * loc.T.y * dir * dt; }
    // derrape
    const sp = Math.abs(vf);
    if (ctl.drift && !c.drifting && Math.abs(ctl.steer) > 0.25 && sp > 16) { c.drifting = 1; c.driftDir = Math.sign(ctl.steer); c.charge = 0; ev && ev.driftStart && ev.driftStart(); }
    if (c.drifting && (!ctl.drift || sp < 10)) {
      const lv = chargeLevel(c);
      if (lv && sp >= 10) { c.boostT = Math.max(c.boostT, [0, 0.7, 1.25, 1.9][lv]); c.nitro = Math.min(100, c.nitro + lv * 6); ev && ev.miniTurbo && ev.miniTurbo(lv); }
      c.drifting = 0; c.charge = 0;
    }
    let turn = S.turn * Math.min(1, sp / 10) * (1 - 0.35 * Math.min(1, sp / 95));
    let steer = ctl.steer;
    let grip = S.grip * (1 - wet * 0.18);
    if (c.drifting) {
      // en derrape el giro va hacia el lado del derrape; contravolantear abre la curva
      steer = c.driftDir * (0.62 + 0.45 * ctl.steer * c.driftDir);
      turn *= 1.25; grip = S.drift * (1 - wet * 0.1);
      const ang = Math.abs(vr) / Math.max(8, sp);
      c.charge += dt * S.charge * (0.55 + 0.6 * Math.max(0, ctl.steer * c.driftDir)) * (sp > 22 ? 1 : 0.35) * (ang > 0.08 ? 1 : 0.4);
      vf -= sp * 0.06 * dt; // el derrape frena un pelín
    }
    vr *= Math.exp(-grip * dt);
    // empuje lateral del derrape (el culo sale hacia fuera)
    if (c.drifting) vr += c.driftDir * sp * 0.9 * dt * (0.6 + 0.4 * Math.abs(ctl.steer));
    c.h -= steer * turn * dt * (vf < -0.5 ? -1 : 1) * assist;
    c.steerVis = lerp(c.steerVis, ctl.steer, Math.min(1, 10 * dt));
  } else {
    c.h -= ctl.steer * 0.5 * dt; // poco control en el aire
    c.steerVis = lerp(c.steerVis, ctl.steer, Math.min(1, 5 * dt));
  }
  const nfx = Math.sin(c.h), nfz = Math.cos(c.h), nsx = nfz, nsz = -nfx;
  c.vel.set(nfx * vf + nsx * vr, 0, nfz * vf + nsz * vr);
  c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt;
  c.vf = vf; c.vr = vr;
  // ---- circuito: altura, muros, vueltas ----
  const loc = locate(c.pos, c.ti); c.loc = loc;
  const prevI = c.ti; c.ti = loc.i; c.lat = loc.lat;
  const n = track.n;
  if (prevI > n * 0.85 && loc.i < n * 0.15) c.lap++;
  else if (prevI < n * 0.15 && loc.i > n * 0.85) c.lap--;
  c.prog = c.lap * n + loc.f;
  // vertical
  const ground = loc.y;
  c.vy -= 32 * dt; c.pos.y += c.vy * dt;
  if (c.pos.y <= ground) {
    if (c.air > 0.35 && ev && ev.land) ev.land(c.air, -c.vy);
    const slopeV = c.prevGround !== undefined ? (ground - c.prevGround) / dt : 0;
    c.pos.y = ground; c.vy = slopeV; c.air = 0;
  } else if (c.pos.y > ground + 0.15) c.air += dt;
  c.prevGround = ground;
  // muros
  const lim = track.wall - c.spec.look.W * 0.5 - 0.15;
  if (Math.abs(loc.lat) > lim) {
    const sd = Math.sign(loc.lat), pen = Math.abs(loc.lat) - lim, R = loc.R;
    c.pos.x -= R.x * sd * pen; c.pos.z -= R.z * sd * pen;
    const vout = (c.vel.x * R.x + c.vel.z * R.z) * sd;
    if (vout > 0) {
      c.vel.x -= R.x * sd * vout * 1.25; c.vel.z -= R.z * sd * vout * 1.25;
      const impact = vout;
      const k = clamp(impact / 30, 0.02, 0.5);
      c.vel.multiplyScalar(1 - k * 0.6);
      const nf = Math.sin(c.h), nz = Math.cos(c.h);
      c.vf = c.vel.x * nf + c.vel.z * nz; c.vr = c.vel.x * nz - c.vel.z * nf;
      if (c.drifting) { c.drifting = 0; c.charge = 0; }
      // el coche se endereza un poco contra el muro
      const th = Math.atan2(loc.T.x, loc.T.z), dh = ((th - c.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      c.h += dh * Math.min(1, impact / 40) * 0.5;
      if (ev && ev.wall) ev.wall(impact, c.pos.x + R.x * sd * c.spec.look.W * 0.5, c.pos.y + 0.5, c.pos.z + R.z * sd * c.spec.look.W * 0.5);
    }
    c.wallT = 0.15;
  } else c.wallT = Math.max(0, c.wallT - dt);
  // placas de turbo
  if (onGround) for (const b of track.boosts) {
    const di = Math.abs(loc.i - b.i); if ((di < 3 || di > n - 3) && Math.abs(loc.lat - b.lat) < 2.6) { if (c.boostT < 0.9 && ev && ev.pad) ev.pad(); c.boostT = Math.max(c.boostT, 1.1); }
  }
  // caída fuera (seguridad)
  if (c.pos.y < ground - 6 || Math.abs(loc.lat) > track.wall + 6) respawn(c);
}
export function respawn(c) {
  const p = track.P[c.ti], T = track.T[c.ti];
  c.pos.copy(p); c.h = Math.atan2(T.x, T.z); c.vel.set(0, 0, 0); c.vf = c.vr = 0; c.vy = 0; c.air = 0; c.drifting = 0; c.charge = 0;
}

// pose visual: inclinación, cabeceo, ruedas, luces, llamas, chispas
export function poseCar(c, dt, fx = true) {
  const u = c.mesh.userData;
  c.mesh.rotation.y = c.h;
  const loc = c.loc;
  // inclinación según la pendiente
  let slope = 0; if (loc) { const dir = loc.T.x * Math.sin(c.h) + loc.T.z * Math.cos(c.h); slope = -Math.asin(clamp(loc.T.y, -1, 1)) * dir; }
  const airPitch = c.air > 0 ? clamp(-c.vy * 0.012, -0.35, 0.35) : 0;
  const accelPitch = clamp(-(c.vf - (c.lastVf ?? c.vf)) / Math.max(dt, 1e-3) * 0.0016, -0.05, 0.05);
  c.lastVf = c.vf;
  c.pitch = lerp(c.pitch, slope + airPitch, Math.min(1, 8 * dt));
  c.mesh.rotation.x = c.pitch;
  c.roll = lerp(c.roll, clamp(c.vr * 0.01 + c.steerVis * Math.abs(c.vf) * 0.0012, -0.1, 0.1), Math.min(1, 6 * dt));
  u.body.rotation.z = c.roll; u.body.rotation.x = lerp(u.body.rotation.x, accelPitch, Math.min(1, 6 * dt));
  for (const f of u.front) f.rotation.y = -c.steerVis * 0.42;
  for (const w of u.wheels) w.rotation.x += c.vf * dt / 0.42;
  u.brake.visible = c.braking;
  const boosting = c.isNitro || c.boostT > 0;
  for (const f of u.flames) { f.visible = boosting; if (boosting) f.scale.set(1, 0.7 + Math.random() * 0.8, 1); }
  if (!fx) return;
  const sp = Math.abs(c.vf), hl = u.len / 2, s = Math.sin(c.h), co = Math.cos(c.h);
  // humo y chispas del derrape
  if (c.drifting && c.air <= 0) {
    const lv = chargeLevel(c), col = CHG_COL[lv];
    for (const sd of [-1, 1]) {
      const x = c.pos.x - s * (hl - 0.8) + co * sd * (u.wid / 2 - 0.1), z = c.pos.z - co * (hl - 0.8) - s * sd * (u.wid / 2 - 0.1);
      if (Math.random() < 0.6) puff(x, c.pos.y + 0.3, z, (Math.random() - 0.5) * 2 - s * 3, 0.6, (Math.random() - 0.5) * 2 - co * 3, 1.6, 1.2, 0.5);
      if (col) for (let k = 0; k < 2; k++) emit(x, c.pos.y + 0.25, z, (Math.random() - 0.5) * 6 - s * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6 - co * 6, col[0], col[1], col[2], 0.35, 14);
    }
  } else if (Math.abs(c.vr) > 6 && c.air <= 0 && Math.random() < 0.4) {
    puff(c.pos.x - s * hl, c.pos.y + 0.3, c.pos.z - co * hl, 0, 0.5, 0, 1.2, 0.9, 0.3);
  }
  // agua en mojado
  if ((track.wet || 0) > 0.5 && sp > 15 && c.air <= 0 && Math.random() < 0.8) {
    for (const sd of [-1, 1]) emit(c.pos.x - s * (hl - 0.7) + co * sd * 0.8, c.pos.y + 0.2, c.pos.z - co * (hl - 0.7) - s * sd * 0.8, -s * sp * 0.15 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, -co * sp * 0.15 + (Math.random() - 0.5) * 2, 0.35, 0.4, 0.55, 0.45, 16);
  }
  if (boosting && Math.random() < 0.7) for (const sd of [-1, 1]) emit(c.pos.x - s * (hl + 0.5) + co * sd * 0.4, c.pos.y + 0.4, c.pos.z - co * (hl + 0.5) - s * sd * 0.4, -s * 10 + c.vel.x * 0.6, Math.random(), -co * 10 + c.vel.z * 0.6, 0.6, 2, 5, 0.25, 0);
}

// choque entre dos coches
export function carCollide(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y;
  if (Math.abs(dy) > 3) return 0;
  const R = (a.radius + b.radius) * 0.52, d2 = dx * dx + dz * dz;
  if (d2 > R * R || d2 < 1e-6) return 0;
  const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = R - d;
  const ma = a.mass || 1, mb = b.mass || 1, ka = mb / (ma + mb), kb = ma / (ma + mb);
  a.pos.x -= nx * pen * ka; a.pos.z -= nz * pen * ka; b.pos.x += nx * pen * kb; b.pos.z += nz * pen * kb;
  const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
  if (rel < 0) { const j = -1.3 * rel; a.vel.x -= j * ka * nx; a.vel.z -= j * ka * nz; b.vel.x += j * kb * nx; b.vel.z += j * kb * nz; }
  for (const c of [a, b]) { const f = Math.sin(c.h), z = Math.cos(c.h); c.vf = c.vel.x * f + c.vel.z * z; c.vr = c.vel.x * z - c.vel.z * f; }
  return -rel;
}
