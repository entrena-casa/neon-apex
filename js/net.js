// Multijugador P2P (PeerJS): el anfitrión crea una sala con código, elige circuito y da la salida
import { THREE, scene, V3, G, lerp, wrapAngle, labelTex, toast } from './core.js';
import { carById, makeCarMesh, newCar, poseCar, PAINTS } from './cars.js';
export const isHost = () => net.role === 'host';
import { track, locate } from './tracks.js';
import { race } from './race.js';

const PREFIX = 'neonapex-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const net = { role: null, code: '', peer: null, conns: new Map(), host: null, myId: '', status: '', roster: [], me: null, onChange: null, onStart: null, chat: [] };

function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar PeerJS')); document.head.appendChild(s);
  });
}
const changed = () => net.onChange && net.onChange();
const setStatus = s => { net.status = s; changed(); };
const clean = s => String(s || '').slice(0, 14);

export async function hostLobby() {
  try { await loadPeer(); } catch (e) { setStatus('Sin conexión al servidor de salas.'); return; }
  leave(true);
  net.code = Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  setStatus('Creando sala…');
  const peer = new window.Peer(PREFIX + net.code); net.peer = peer; net.role = 'host';
  peer.on('open', id => { net.myId = id; net.roster = [{ id, ...net.me, ready: true }]; setStatus('Sala abierta. Pasa el código.'); });
  peer.on('connection', conn => {
    conn.on('open', () => net.conns.set(conn.peer, conn));
    conn.on('data', d => onHostData(conn, d));
    conn.on('close', () => drop(conn.peer)); conn.on('error', () => drop(conn.peer));
  });
  peer.on('error', e => { if (e.type === 'unavailable-id') return hostLobby(); setStatus('Error: ' + (e.type || e.message)); });
}
export async function joinLobby(code) {
  code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { setStatus('El código tiene 5 letras.'); return; }
  try { await loadPeer(); } catch (e) { setStatus('Sin conexión al servidor de salas.'); return; }
  leave(true); setStatus('Conectando a ' + code + '…');
  const peer = new window.Peer(); net.peer = peer; net.role = 'client'; net.code = code;
  peer.on('open', id => {
    net.myId = id;
    const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }); net.host = conn;
    const to = setTimeout(() => { if (!conn.open) setStatus('No encuentro esa sala.'); }, 9000);
    conn.on('open', () => { clearTimeout(to); conn.send({ t: 'hello', ...net.me }); setStatus('Dentro de la sala ' + code + '. Espera a que el anfitrión dé la salida.'); });
    conn.on('data', onClientData);
    conn.on('close', () => { setStatus('El anfitrión ha cerrado la sala.'); net.role = null; net.roster = []; clearRemotes(); changed(); });
  });
  peer.on('error', e => setStatus(e.type === 'peer-unavailable' ? 'No existe la sala ' + code : 'Error: ' + (e.type || e.message)));
}
export function leave(silent) {
  try { net.peer && net.peer.destroy(); } catch (e) {}
  net.peer = null; net.role = null; net.host = null; net.conns.clear(); net.roster = []; clearRemotes();
  if (!silent) setStatus('');
}
export function updateMe(me) {
  net.me = me;
  if (net.role === 'client' && net.host?.open) net.host.send({ t: 'hello', ...me });
  if (net.role === 'host') { const r = net.roster.find(p => p.id === net.myId); if (r) Object.assign(r, me); broadcast({ t: 'roster', list: net.roster }); changed(); }
}
function drop(id) {
  net.conns.delete(id);
  const p = net.roster.find(r => r.id === id); if (p) toast(`👋 ${p.name} se ha ido`);
  net.roster = net.roster.filter(r => r.id !== id); removeRemote(id);
  broadcast({ t: 'roster', list: net.roster }); changed();
}
function broadcast(m, except) { for (const [id, c] of net.conns) if (c.open && id !== except) c.send(m); }
export function sendChat(text) {
  text = String(text || '').trim().slice(0, 100); if (!text || !net.role) return;
  const m = { from: net.me.name, m: text };
  if (net.role === 'host') { pushChat(m); broadcast({ t: 'chat', ...m }); } else net.host?.open && net.host.send({ t: 'chat', m: text });
}
function pushChat(m) { net.chat.push(m); if (net.chat.length > 5) net.chat.shift(); changed(); }

// ---------- anfitrión ----------
function onHostData(conn, d) {
  if (d.t === 'hello') {
    let p = net.roster.find(r => r.id === conn.peer);
    if (!p) { if (net.roster.length >= 8) { conn.send({ t: 'full' }); return; } p = { id: conn.peer }; net.roster.push(p); toast(`🟢 ${clean(d.name)} ha entrado`); }
    Object.assign(p, { name: clean(d.name), car: carById(d.car).id, paint: d.paint });
    broadcast({ t: 'roster', list: net.roster }); changed();
  } else if (d.t === 's') { const r = remotes.get(conn.peer); if (r) applyState(r, d.s); }
  else if (d.t === 'chat') { const p = net.roster.find(r => r.id === conn.peer); const m = { from: p?.name || '?', m: String(d.m).slice(0, 100) }; pushChat(m); broadcast({ t: 'chat', ...m }); }
}
// el anfitrión da la salida: reparte la parrilla
export function hostStart(cfg) {
  if (net.role !== 'host') return;
  const order = net.roster.map(p => p.id).sort(() => Math.random() - 0.5);
  const grid = {}; order.forEach((id, i) => grid[id] = i + (cfg.ai ? Math.min(cfg.ai, 3) : 0));
  const names = ['VÍBORA', 'KAITO', 'LA REINA', 'TURBO', 'NOVA', 'MAMBA', 'ZAFIRO', 'BLITZ'], cars = ['zeta', 'pulga', 'toro', 'kitsune', 'rayo'];
  const aiList = []; let slot = 0;
  for (let k = 0; k < (cfg.ai || 0); k++) { while (Object.values(grid).includes(slot)) slot++; aiList.push({ id: 'ai' + k, car: cars[Math.floor(Math.random() * cars.length)], paint: PAINTS[(k * 3 + 2) % PAINTS.length], name: names[k % names.length], slot }); slot++; }
  const msg = { t: 'start', track: cfg.track, laps: cfg.laps, ai: cfg.ai, diff: cfg.diff, grid, aiList, slots: order.length + aiList.length, goDelay: 0.3 + Math.random() * 0.9, roster: net.roster };
  broadcast(msg); onStartMsg(msg);
}
function onStartMsg(m) { net.roster = m.roster; net.onStart && net.onStart(m); }

// ---------- cliente ----------
function onClientData(d) {
  if (d.t === 'roster') { net.roster = d.list; changed(); }
  else if (d.t === 'start') onStartMsg(d);
  else if (d.t === 'ss') { for (const id in d.s) if (id !== net.myId) { const r = remotes.get(id); if (r) applyState(r, d.s[id]); } }
  else if (d.t === 'chat') pushChat(d);
  else if (d.t === 'full') setStatus('La sala está llena (8).');
}

// ---------- coches remotos ----------
const remotes = new Map();
function clearRemotes() { for (const r of remotes.values()) { scene.remove(r.mesh); scene.remove(r.tag); } remotes.clear(); race.remotes.length = 0; }
function removeRemote(id) { const r = remotes.get(id); if (r) { scene.remove(r.mesh); scene.remove(r.tag); remotes.delete(id); const i = race.remotes.indexOf(r); if (i >= 0) race.remotes.splice(i, 1); } }
export function spawnRemotes(m, aiCars) {
  clearRemotes();
  for (const p of m.roster) {
    if (p.id === net.myId) continue;
    const spec = carById(p.car), mesh = makeCarMesh(spec, p.paint ?? PAINTS[0], { neon: 0xff2bd6 }); scene.add(mesh);
    const c = newCar(spec, mesh); c.remote = true; c.id = p.id; c.name = p.name; c.target = null; c.slot = m.grid[p.id];
    c.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(p.name, 0xff2bd6), depthWrite: false, depthTest: false, transparent: true })); c.tag.scale.set(7, 1.3, 1); c.tag.renderOrder = 5; scene.add(c.tag);
    remotes.set(p.id, c); race.remotes.push(c);
  }
  // en el cliente, la IA del anfitrión llega como remotos
  if (aiCars) for (const a of aiCars) {
    const spec = carById(a.car), mesh = makeCarMesh(spec, a.paint, { neon: 0xffd200 }); scene.add(mesh);
    const c = newCar(spec, mesh); c.remote = true; c.id = a.id; c.name = a.name;
    c.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(a.name, 0xffd200), depthWrite: false, depthTest: false, transparent: true })); c.tag.scale.set(7, 1.3, 1); c.tag.renderOrder = 5; scene.add(c.tag);
    remotes.set(a.id, c); race.remotes.push(c);
  }
}
export function placeRemote(id, slot) {
  const r = remotes.get(id); if (!r || !race.slots) return;
  const [i, lat] = race.slots[slot] || race.slots[0], p = track.P[i], R = track.R[i], T = track.T[i];
  r.pos.set(p.x + R.x * lat, p.y, p.z + R.z * lat); r.h = Math.atan2(T.x, T.z); r.ti = i; r.lap = 0; r.prog = i;
}
function applyState(r, s) {
  const [x, y, z, h, vf, lap, ti, fin, fT, b, dr] = s;
  if (!r.target) { r.pos.set(x, y, z); r.h = h; }
  r.target = { x, y, z, h, vf }; r.lap = lap; r.ti = ti; r.prog = lap * track.n + ti; r.isNitro = !!b; r.drifting = dr ? 1 : 0;
  if (fin && !r.finished) { r.finished = true; r.finishT = fT; }
}
let sendT = 0;
const pack = c => [+c.pos.x.toFixed(2), +c.pos.y.toFixed(2), +c.pos.z.toFixed(2), +c.h.toFixed(3), +c.vf.toFixed(1), c.lap, c.ti, c.finished ? 1 : 0, c.finishT ? +c.finishT.toFixed(3) : 0, (c.isNitro || c.boostT > 0) ? 1 : 0, c.drifting ? 1 : 0];
export function updateNet(dt) {
  if (!net.role || !race.on) return;
  const P = race.player;
  sendT += dt;
  if (sendT > 0.066) {
    sendT = 0;
    if (net.role === 'client' && net.host?.open) net.host.send({ t: 's', s: pack(P) });
    if (net.role === 'host') {
      const s = { [net.myId]: pack(P) };
      for (const [id, r] of remotes) if (r.target) s[id] = [r.target.x, r.target.y, r.target.z, r.target.h, r.target.vf, r.lap, r.ti, r.finished ? 1 : 0, r.finishT || 0, r.isNitro ? 1 : 0, r.drifting];
      for (const c of race.cars) if (c.ai) s[c.netId] = pack(c);
      broadcast({ t: 'ss', s });
    }
  }
  for (const r of remotes.values()) {
    const t = r.target; if (!t) { poseCar(r, dt, false); r.tag.position.set(r.pos.x, r.pos.y + 3, r.pos.z); continue; }
    t.x += Math.sin(t.h) * t.vf * dt; t.z += Math.cos(t.h) * t.vf * dt;
    const k = 1 - Math.exp(-12 * dt);
    r.pos.x = lerp(r.pos.x, t.x, k); r.pos.y = lerp(r.pos.y, t.y, k); r.pos.z = lerp(r.pos.z, t.z, k);
    r.h += wrapAngle(t.h - r.h) * k; r.vf = t.vf; r.vel.set(Math.sin(r.h) * r.vf, 0, Math.cos(r.h) * r.vf);
    r.loc = locate(r.pos, r.ti || 0);
    poseCar(r, dt, true);
    r.tag.position.set(r.pos.x, r.pos.y + 3, r.pos.z);
  }
}
