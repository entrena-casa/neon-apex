// Neon Apex: menús, controles (teclado, mando, táctil), cámara, HUD y bucle principal
import { THREE, $, G, V3, clamp, lerp, wrapAngle, isTouch, scene, camera, composer, followShadow, updateParticles, clearParticles, updateRain, updateMsg, showMsg, toast, popup, fmtTime, emit, burst, QUALITY, setQuality, hexCss, sunDir } from './core.js';
import { TRACKS, track, buildTrack, updateTrack, skyFollow, sky, sampleAt } from './tracks.js';
import { CARS, carById, makeCarMesh, setPaint, PAINTS, statOf, respawn, chargeLevel } from './cars.js';
import { race, setupRace, updateRace, clearRace, DIFFS, loadGhost, aiControl } from './race.js';
import { net, hostLobby, joinLobby, leave, updateMe, hostStart, spawnRemotes, placeRemote, updateNet, sendChat } from './net.js';
import { sfx } from './audio.js';

// ================== PARTIDA GUARDADA ==================
const SKEY = 'apex.save.v1';
const save = { credits: 6000, owned: ['zeta', 'pulga'], car: 'zeta', paint: {}, rec: {}, medals: {}, name: '', diff: 'normal', laps: 3, rivals: 7, track: 'distrito', cam: 0, races: 0, wins: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
if (!save.name) save.name = 'PILOTO' + Math.floor(100 + Math.random() * 900);
const persist = () => { try { localStorage.setItem(SKEY, JSON.stringify(save)); } catch (e) {} };
const paintOf = id => save.paint[id] ?? carById(id).look.color;
const meInfo = () => ({ name: save.name, car: save.car, paint: paintOf(save.car) });
net.me = meInfo();

// ================== PANTALLAS ==================
const SCREENS = ['menu', 'select', 'garage', 'results', 'pause', 'settings', 'lobby'];
let screen = 'menu', prevScreen = 'menu', selMode = 'race';
function show(id) {
  if (id !== screen) prevScreen = screen;
  screen = id;
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  const racing = id === null || id === 'pause';
  $('hud').classList.toggle('hidden', !race.on || !racing && id !== 'pause');
  $('touch').classList.toggle('hidden', !(isTouch && race.on && id === null));
  G.music = true;
  renderCredits();
}
const renderCredits = () => { const t = `CRÉDITOS ${save.credits.toLocaleString('es-ES')} ◆`; $('credits').textContent = t; $('gCredits').textContent = t; };

// ================== CIRCUITO DE FONDO Y COCHE DE EXPOSICIÓN ==================
let shownTrack = null, preview = null;
function ensureTrack(id) {
  if (shownTrack === id) return;
  const def = TRACKS.find(t => t.id === id) || TRACKS[0];
  clearRace(); clearParticles();
  buildTrack(def); shownTrack = def.id;
  placePreview();
}
function placePreview() {
  if (preview) scene.remove(preview);
  preview = makeCarMesh(carById(save.car), paintOf(save.car), { neon: 0x00f0ff });
  const i = Math.floor(track.n * 0.015), p = track.P[i], T = track.T[i];
  preview.position.copy(p); preview.rotation.y = Math.atan2(T.x, T.z) + 0.6; scene.add(preview);
  preview.visible = !race.on;
}

// ================== MENÚ ==================
$('bRace').onclick = () => openSelect('race');
$('bTrial').onclick = () => openSelect('trial');
$('bOnline').onclick = () => { sfx.ensure(); openLobby(); };
$('bGarage').onclick = () => openGarage('menu');
$('bSettings').onclick = () => openSettings('menu');
document.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { sfx.ensure(); sfx.click(); } }, true);

// ---------- selección de circuito ----------
function trackPreview(cv, def, sel) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const pts = new THREE.CatmullRomCurve3(def.pts.map(p => new V3(p[0], p[1], p[2])), true, 'centripetal').getSpacedPoints(240);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const s = Math.min((W - 30) / (x1 - x0), (H - 30) / (z1 - z0)), ox = (W - (x1 - x0) * s) / 2, oz = (H - (z1 - z0) * s) / 2;
  const E = def.env, grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, hexCss(E.sky[0])); grd.addColorStop(1, hexCss(E.sky[2]));
  g.fillStyle = grd; g.globalAlpha = 0.35; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  const col = hexCss(E.neon[0]);
  g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#0008'; g.beginPath(); pts.forEach((p, i) => { const x = ox + (p.x - x0) * s, y = oz + (p.z - z0) * s; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], k = y1 > y0 ? (a.y - y0) / (y1 - y0) : 0;
    g.strokeStyle = `hsl(${190 + k * 130},100%,${55 + k * 15}%)`; g.lineWidth = 4; g.shadowColor = col; g.shadowBlur = sel ? 12 : 6;
    g.beginPath(); g.moveTo(ox + (a.x - x0) * s, oz + (a.z - z0) * s); g.lineTo(ox + (b.x - x0) * s, oz + (b.z - z0) * s); g.stroke();
  }
  g.shadowBlur = 0; const p0 = pts[0]; g.fillStyle = '#fff'; g.fillRect(ox + (p0.x - x0) * s - 4, oz + (p0.z - z0) * s - 4, 8, 8);
}
const medalOf = (def, t) => !isFinite(t) || !t ? 0 : t <= def.medals[0] ? 3 : t <= def.medals[1] ? 2 : t <= def.medals[2] ? 1 : 0;
const MEDAL = ['', '🥉', '🥈', '🥇'];
function openSelect(m) {
  selMode = m; sfx.ensure();
  $('selTitle').textContent = m === 'trial' ? 'CONTRARRELOJ' : 'CARRERA';
  $('oDiff').classList.toggle('hidden', m === 'trial'); $('oRivals').classList.toggle('hidden', m === 'trial'); $('oLaps').classList.toggle('hidden', m === 'trial');
  renderTracks(); show('select');
}
function renderTracks() {
  const L = $('trackList'); L.innerHTML = '';
  for (const def of TRACKS) {
    const r = save.rec[def.id] || {}, md = save.medals[def.id] || 0;
    const d = document.createElement('div'); d.className = 'tcard' + (save.track === def.id ? ' sel' : '');
    d.innerHTML = `<canvas width="320" height="200"></canvas><div class="k">${def.kind} · ${def.mood}</div><h3>${def.name} ${MEDAL[md]}</h3><div class="d">${def.desc}</div>
      <div class="rec">VUELTA RÉCORD ${fmtTime(r.lap)}${selMode === 'trial' ? `<br>🥇 ${fmtTime(def.medals[0])} · 🥈 ${fmtTime(def.medals[1])} · 🥉 ${fmtTime(def.medals[2])}` : ''}</div>`;
    d.onclick = () => { save.track = def.id; persist(); renderTracks(); ensureTrack(def.id); };
    L.appendChild(d); trackPreview(d.querySelector('canvas'), def, save.track === def.id);
  }
  document.querySelectorAll('#raceOpts .seg').forEach(sg => sg.querySelectorAll('button').forEach(b => { b.classList.toggle('on', String(save[sg.dataset.k]) === b.dataset.v); b.onclick = () => { save[sg.dataset.k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; persist(); renderTracks(); }; }));
}
$('selBack').onclick = () => show('menu');
$('selCar').onclick = () => openGarage('select');
$('selGo').onclick = () => startRace();

function startRace() {
  ensureTrack(save.track);
  if (preview) preview.visible = false;
  const opts = selMode === 'trial'
    ? { mode: 'trial', laps: 99, car: save.car, paint: paintOf(save.car), name: save.name }
    : { mode: 'race', laps: save.laps, diff: save.diff, rivals: save.rivals, car: save.car, paint: paintOf(save.car), name: save.name, gridPos: save.rivals };
  setupRace(opts);
  lastOpts = opts;
  afterSetup();
}
let lastOpts = null;
function afterSetup() {
  camInit = true; G.paused = false; wrongT = 0;
  show(null);
  showMsg(track.def.name, '#fff', 2.2);
  if (race.mode === 'trial') toast(`⏱ <b>CONTRARRELOJ</b> · vueltas infinitas<br>Tu mejor vuelta queda grabada como <b style="color:#9fe8ff">fantasma</b>.${loadGhost(track.def.id) ? '' : '<br>Aún no hay fantasma: ¡haz la primera!'}`, 5000);
}

// ---------- resultados ----------
G.onResults = res => {
  const def = track.def; let reward = 0, medalTxt = '';
  const rec = save.rec[def.id] || (save.rec[def.id] = {});
  if (isFinite(res.best) && (!rec.lap || res.best < rec.lap)) { rec.lap = res.best; popup('¡VUELTA RÉCORD!', '#ffd200'); }
  if (race.mode === 'race' || race.mode === 'online') {
    const base = [3000, 1800, 1100, 700, 450, 300, 200, 120][res.place - 1] || 100;
    reward = Math.round(base * (race.mode === 'online' ? 1.2 : race.diff.prize) * (race.laps / 3) / 10) * 10;
    save.races++; if (res.place === 1) save.wins++;
    if (res.place === 1 && race.mode === 'race' && save.diff === 'locura') medalTxt = '🔥 VICTORIA EN LOCURA';
  }
  const md = medalOf(def, rec.lap), old = save.medals[def.id] || 0;
  if (md > old) { reward += [0, 1000, 2500, 5000][md] - [0, 1000, 2500, 5000][old]; save.medals[def.id] = md; medalTxt = `${MEDAL[md]} ¡MEDALLA ${['', 'DE BRONCE', 'DE PLATA', 'DE ORO'][md]}!`; }
  save.credits += reward; persist();
  $('rTitle').textContent = race.mode === 'trial' ? 'CONTRARRELOJ' : res.place === 1 ? '¡VICTORIA!' : `${res.place}º PUESTO`;
  $('rMedal').textContent = medalTxt;
  $('rTable').innerHTML = res.rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}º</td><td>${esc(r.name)}</td><td>${r.car}</td><td>${r.time ? fmtTime(r.time) : 'NO TERMINA'}</td></tr>`).join('') +
    `<tr><td colspan="4" style="color:var(--gold)">MEJOR VUELTA ${fmtTime(res.best)} · RÉCORD ${fmtTime(rec.lap)}</td></tr>`;
  $('rReward').textContent = reward ? `+${reward.toLocaleString('es-ES')} CRÉDITOS` : '';
  $('rNext').classList.toggle('hidden', race.mode === 'online');
  $('rAgain').textContent = race.mode === 'online' ? 'VOLVER A LA SALA' : 'REPETIR';
  setTimeout(() => show('results'), 400);
};
function finishTrialToResults() { // en contrarreloj, salir guarda el récord
  if (race.mode !== 'trial' || !race.on) return;
  G.onResults({ rows: [{ name: save.name, me: true, time: race.best, car: race.player.spec.name }], best: race.best, laps: race.lapTimes, place: 1 });
}
$('rMenu').onclick = () => toMenu();
$('rAgain').onclick = () => { if (race.mode === 'online' || lastOpts?.mode === 'online') { clearRace(); openLobby(); } else { setupRace(lastOpts); afterSetup(); } };
$('rNext').onclick = () => { const i = TRACKS.findIndex(t => t.id === save.track); save.track = TRACKS[(i + 1) % TRACKS.length].id; persist(); startRace(); };
function toMenu() { clearRace(); G.paused = false; placePreview(); show('menu'); }

// ---------- pausa ----------
function togglePause() {
  if (!race.on) return;
  if (screen === 'pause') { G.paused = false; show(null); }
  else if (screen === null) { G.paused = race.mode !== 'online'; show('pause'); }
}
$('pResume').onclick = togglePause;
$('pRestart').onclick = () => { if (lastOpts && lastOpts.mode !== 'online') { setupRace(lastOpts); afterSetup(); } };
$('pMenu').onclick = () => { if (race.mode === 'trial' && isFinite(race.best)) finishTrialToResults(); else toMenu(); };
$('pSettings').onclick = () => openSettings('pause');
$('tPause').addEventListener('touchstart', e => { e.preventDefault(); togglePause(); }, { passive: false });

// ---------- ajustes ----------
let settingsFrom = 'menu';
function openSettings(from) {
  settingsFrom = from;
  $('sQ').querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === QUALITY); b.onclick = () => { if (b.dataset.v !== QUALITY) setQuality(b.dataset.v); }; });
  $('sCam').querySelectorAll('button').forEach(b => { b.classList.toggle('on', +b.dataset.v === save.cam); b.onclick = () => { save.cam = +b.dataset.v; persist(); openSettings(from); }; });
  $('sSound').textContent = sfx.muted ? 'SONIDO: NO' : 'SONIDO: SÍ'; $('sMusic').textContent = sfx.music ? 'MÚSICA: SÍ' : 'MÚSICA: NO';
  show('settings');
}
$('sSound').onclick = () => { sfx.toggleMute(); openSettings(settingsFrom); };
$('sMusic').onclick = () => { sfx.toggleMusic(); openSettings(settingsFrom); };
$('sBack').onclick = () => show(settingsFrom);

// ---------- garaje ----------
let gFrom = 'menu', gIdx = 0;
function openGarage(from) {
  gFrom = from; sfx.ensure();
  gIdx = Math.max(0, CARS.findIndex(c => c.id === save.car));
  if (!shownTrack) ensureTrack(save.track);
  renderGarage(); show('garage');
}
function renderGarage() {
  const c = CARS[gIdx], own = save.owned.includes(c.id), st = statOf(c.s);
  if (own) save.car = c.id;
  $('cName').textContent = c.name; $('cDesc').textContent = c.desc;
  $('cIdx').textContent = `${gIdx + 1} / ${CARS.length}`;
  const bar = (l, v) => `<div class="stat"><span>${l}</span><i style="width:${Math.round(clamp(v, 0.06, 1) * 100)}%"></i></div>`;
  $('cStats').innerHTML = bar('VELOCIDAD', st.vel) + bar('ACELERACIÓN', st.acc) + bar('MANEJO', st.man) + bar('MINITURBO', st.der);
  const cur = paintOf(c.id);
  $('cPaints').innerHTML = PAINTS.map(p => `<span data-p="${p}" class="${p === cur ? 'on' : ''}" style="background:${hexCss(p)}"></span>`).join('');
  $('cPaints').querySelectorAll('span').forEach(s => s.onclick = () => { save.paint[c.id] = +s.dataset.p; persist(); renderGarage(); });
  const b = $('cBuy');
  if (own) { b.textContent = save.car === c.id ? '✔ ELEGIDO' : 'ELEGIR'; b.disabled = false; b.onclick = () => { save.car = c.id; persist(); renderGarage(); }; }
  else { b.textContent = `COMPRAR ${c.price.toLocaleString('es-ES')} ◆`; b.disabled = save.credits < c.price; b.onclick = () => { if (save.credits < c.price) return; save.credits -= c.price; save.owned.push(c.id); save.car = c.id; persist(); toast(`🔑 ¡${c.name} es tuyo!`); renderGarage(); renderCredits(); }; }
  persist();
  // coche de exposición
  if (preview) scene.remove(preview);
  preview = makeCarMesh(c, cur, { neon: 0x00f0ff });
  const i = Math.floor(track.n * 0.015), p = track.P[i], T = track.T[i];
  preview.position.copy(p); preview.rotation.y = Math.atan2(T.x, T.z) + 0.6; scene.add(preview);
  net.me = meInfo(); if (net.role) updateMe(net.me);
}
$('cPrev').onclick = () => { gIdx = (gIdx - 1 + CARS.length) % CARS.length; renderGarage(); };
$('cNext').onclick = () => { gIdx = (gIdx + 1) % CARS.length; renderGarage(); };
$('cBack').onclick = () => { if (!save.owned.includes(CARS[gIdx].id)) { gIdx = CARS.findIndex(c => c.id === save.car); } placePreview(); show(gFrom); if (gFrom === 'lobby') renderLobby(); };

// ---------- multijugador ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let hCfg = { track: 0, laps: 3, ai: 2 };
function openLobby() {
  $('nameIn').value = save.name;
  $('hTrack').innerHTML = TRACKS.map((t, i) => `<option value="${i}">${t.name} · ${t.kind}</option>`).join('');
  $('hTrack').value = hCfg.track;
  renderLobby(); show('lobby');
}
function renderLobby() {
  $('lStart').classList.toggle('hidden', !!net.role);
  $('codeShow').textContent = net.role ? net.code : '';
  $('netStatus').textContent = net.status;
  $('plist').innerHTML = net.roster.length ? net.roster.map((p, i) => `<div>${i === 0 ? '👑' : '🏎'} <b style="color:${hexCss(p.paint ?? 0xffffff)}">${esc(p.name)}</b> · ${carById(p.car).name}${p.id === net.myId ? ' (tú)' : ''}</div>`).join('') : '<div style="opacity:.6">Crea una sala o únete con un código de 5 letras.</div>';
  $('hostCfg').classList.toggle('hidden', net.role !== 'host');
  $('leaveBtn').classList.toggle('hidden', !net.role);
  $('hLaps').querySelectorAll('button').forEach(b => { b.classList.toggle('on', +b.dataset.v === hCfg.laps); b.onclick = () => { hCfg.laps = +b.dataset.v; renderLobby(); }; });
  $('hAI').querySelectorAll('button').forEach(b => { b.classList.toggle('on', +b.dataset.v === hCfg.ai); b.onclick = () => { hCfg.ai = +b.dataset.v; renderLobby(); }; });
}
net.onChange = () => { if (screen === 'lobby') renderLobby(); renderChat(); };
$('nameIn').onchange = () => { save.name = ($('nameIn').value || save.name).toUpperCase().slice(0, 14); persist(); net.me = meInfo(); if (net.role) updateMe(net.me); };
$('hostBtn').onclick = () => { $('nameIn').onchange(); hostLobby(); };
$('joinBtn').onclick = () => { $('nameIn').onchange(); joinLobby($('codeIn').value); };
$('leaveBtn').onclick = () => { leave(); renderLobby(); };
$('lBack').onclick = () => show('menu');
$('lCar').onclick = () => openGarage('lobby');
$('hTrack').onchange = () => { hCfg.track = +$('hTrack').value; };
$('hGo').onclick = () => { if (net.roster.length < 1) return; hostStart({ track: hCfg.track, laps: hCfg.laps, ai: hCfg.ai, diff: 'normal' }); };
net.onStart = m => {
  const def = TRACKS[m.track] || TRACKS[0];
  save.track = def.id; ensureTrack(def.id); if (preview) preview.visible = false;
  const host = net.role === 'host';
  const opts = { mode: 'online', laps: m.laps, diff: 'normal', car: save.car, paint: paintOf(save.car), name: save.name, gridPos: m.grid[net.myId], gridSlots: m.slots, goDelay: m.goDelay, aiList: host && m.aiList.length ? m.aiList : null };
  setupRace(opts); lastOpts = opts;
  spawnRemotes(m, host ? null : m.aiList);
  for (const p of m.roster) if (p.id !== net.myId) placeRemote(p.id, m.grid[p.id]);
  if (!host) for (const a of m.aiList) placeRemote(a.id, a.slot);
  afterSetup();
};
function renderChat() { $('chatBox').innerHTML = net.role ? net.chat.map(m => `<div><b>${esc(m.from)}:</b> ${esc(m.m)}</div>`).join('') : ''; }

// ================== CONTROLES ==================
const keys = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { if (e.code === 'Enter' && e.target.id === 'chatIn') { sendChat(e.target.value); e.target.value = ''; } return; }
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyC' && race.on) { save.cam = (save.cam + 1) % 3; persist(); }
  if (e.code === 'KeyM') { const m = sfx.toggleMute(); toast(m ? '🔇 Sonido apagado' : '🔊 Sonido encendido', 1200); }
  if (e.code === 'KeyR' && race.on && race.go && !race.player.finished && screen === null) { respawn(race.player); popup('DE VUELTA A LA PISTA', '#9fe8ff'); }
  if (e.code === 'Enter' && screen === 'menu') openSelect('race');
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (race.on && screen === null && race.mode !== 'online') togglePause(); });
const down = (...k) => k.some(x => keys[x]);
// táctil: volante deslizando el dedo + botones
const touch = { steer: 0, drift: false, nitro: false, brake: false, id: null, x0: 0 };
if (isTouch) {
  const z = $('steerZone'), knob = $('steerKnob'), base = $('steerBase');
  z.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; touch.id = t.identifier; touch.x0 = t.clientX; knob.style.display = base.style.display = 'block'; base.style.left = knob.style.left = t.clientX + 'px'; base.style.top = knob.style.top = (t.clientY - z.getBoundingClientRect().top) + 'px'; }, { passive: false });
  z.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.steer = clamp((t.clientX - touch.x0) / 80, -1, 1); knob.style.left = (touch.x0 + touch.steer * 80) + 'px'; } }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.id = null; touch.steer = 0; knob.style.display = base.style.display = 'none'; } };
  z.addEventListener('touchend', end); z.addEventListener('touchcancel', end);
  for (const [id, k] of [['tDrift', 'drift'], ['tNitro', 'nitro'], ['tBrake', 'brake']]) {
    const b = $(id);
    b.addEventListener('touchstart', e => { e.preventDefault(); touch[k] = true; b.classList.add('on'); }, { passive: false });
    const off = e => { e.preventDefault(); touch[k] = false; b.classList.remove('on'); };
    b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
  }
  $('keysHint').textContent = 'MÓVIL: desliza el dedo a la izquierda de la pantalla para girar · acelera solo · mantén DERRAPE en las curvas y suéltalo para el miniturbo';
}
let kSteer = 0;
function readInput(dt) {
  const ctl = { throttle: 0, steer: 0, drift: false, nitro: false };
  // teclado (dirección progresiva: más precisa)
  const ks = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  if (ks) kSteer = clamp(kSteer + ks * dt * (Math.sign(ks) !== Math.sign(kSteer) ? 9 : 4.5), -1, 1); else kSteer -= Math.sign(kSteer) * Math.min(Math.abs(kSteer), dt * 8);
  ctl.steer = kSteer;
  ctl.throttle = (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0);
  ctl.drift = down('Space'); ctl.nitro = down('ShiftLeft', 'ShiftRight');
  // mando
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    const ax = Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0;
    if (ax) ctl.steer = Math.sign(ax) * Math.pow(Math.abs(ax), 1.4);
    const rt = gp.buttons[7]?.value || 0, lt = gp.buttons[6]?.value || 0;
    if (rt > 0.05 || lt > 0.05) ctl.throttle = rt - lt;
    if (gp.buttons[0]?.pressed || gp.buttons[5]?.pressed) ctl.drift = true;
    if (gp.buttons[2]?.pressed || gp.buttons[1]?.pressed || gp.buttons[4]?.pressed) ctl.nitro = true;
    if (gp.buttons[9]?.pressed && !gp._p) { togglePause(); } gp._p = gp.buttons[9]?.pressed;
  }
  if (isTouch && race.on) {
    if (touch.id !== null) ctl.steer = Math.sign(touch.steer) * Math.pow(Math.abs(touch.steer), 1.3);
    ctl.throttle = touch.brake ? -1 : 1;
    if (!race.go) ctl.throttle = touch.brake ? 0 : 0;
    ctl.drift = ctl.drift || touch.drift; ctl.nitro = ctl.nitro || touch.nitro;
    if (race.go && !race.startJudged && race.t - race.goT < 0.1) ctl.throttle = 1;
  }
  return ctl;
}

// ================== EFECTOS DEL JUGADOR ==================
const ev = {
  wall(imp, x, y, z) {
    const k = clamp(imp / 30, 0, 1);
    G.shake = Math.max(G.shake, k * 0.8);
    for (let i = 0; i < 10 + k * 30; i++) emit(x, y, z, (Math.random() - 0.5) * 16, Math.random() * 7, (Math.random() - 0.5) * 16, 4, 2.6, 1, 0.5, 20);
    if (imp > 4) sfx.wall(k);
  },
  bump(imp, x, y, z) { G.shake = Math.max(G.shake, Math.min(0.6, imp / 40)); sfx.wall(Math.min(1, imp / 30)); for (let i = 0; i < 16; i++) emit(x, y, z, (Math.random() - 0.5) * 12, Math.random() * 5, (Math.random() - 0.5) * 12, 4, 3, 1.4, 0.4); },
  land(air, vy) {
    G.shake = Math.max(G.shake, Math.min(0.7, vy / 30)); sfx.land(Math.min(1, vy / 25));
    if (air > 0.6) { const n = Math.round(air * 10) / 10; popup(`¡SALTO ${n.toFixed(1)} s!`, '#ffd200'); race.player.nitro = Math.min(100, race.player.nitro + air * 10); }
  },
  driftStart() { },
  miniTurbo(lv) { sfx.turbo(lv); popup(['', 'MINITURBO', 'SUPERTURBO', '¡ULTRATURBO!'][lv], ['', '#59b4ff', '#ff9a2a', '#d05aff'][lv]); },
  pad() { sfx.pad(); },
};

// ================== CÁMARA ==================
const camPos = new V3(), camLook = new V3(); let camH = 0, camInit = true, flyF = 0;
function updateCamera(dt) {
  if (!race.on || !race.player) {
    // menú: vuelo sobre el circuito / vista del coche en el garaje
    if (screen === 'garage' && preview) {
      const a = G.t * 0.35, p = preview.position;
      camera.position.set(p.x + Math.sin(a) * 8, p.y + 2.6, p.z + Math.cos(a) * 8); camera.lookAt(p.x, p.y - 1.4, p.z);
      camera.fov = 50; camera.updateProjectionMatrix(); return;
    }
    flyF += dt * 9;
    const a = sampleAt(flyF).clone(), b = sampleAt(flyF + 26).clone();
    const T = track.T[Math.floor(flyF) % track.n], R = track.R[Math.floor(flyF) % track.n];
    camera.position.set(a.x + R.x * 10 * Math.sin(G.t * 0.2), a.y + 9 + Math.sin(G.t * 0.3) * 3, a.z + R.z * 10 * Math.sin(G.t * 0.2));
    camera.lookAt(b.x, b.y + 2, b.z); camera.fov = 62; camera.updateProjectionMatrix();
    void T; return;
  }
  const P = race.player, sp = P.vel.length();
  const vh = sp > 6 ? Math.atan2(P.vel.x, P.vel.z) : P.h;
  const target = P.h + wrapAngle(vh - P.h) * 0.45;
  if (camInit) { camH = target; camInit = false; camPos.copy(P.pos); }
  camH += wrapAngle(target - camH) * (1 - Math.exp(-7 * dt));
  const mode = save.cam;
  const boost = P.isNitro || P.boostT > 0;
  if (mode === 2) {
    const fx = Math.sin(P.h), fz = Math.cos(P.h);
    camera.position.set(P.pos.x + fx * 0.6, P.pos.y + 1.25, P.pos.z + fz * 0.6);
    camLook.set(P.pos.x + fx * 30, P.pos.y + 1.0, P.pos.z + fz * 30);
  } else {
    const dist = (mode ? 9.5 : 6.2) + sp * 0.018, h = (mode ? 3.6 : 2.25) + sp * 0.006;
    const x = P.pos.x - Math.sin(camH) * dist, z = P.pos.z - Math.cos(camH) * dist;
    camPos.x = x; camPos.z = z; camPos.y = lerp(camPos.y, P.pos.y + h, 1 - Math.exp(-6 * dt));
    if (track.terrainH) camPos.y = Math.max(camPos.y, track.terrainH(camPos.x, camPos.z) + 1.2);
    camera.position.copy(camPos);
    camLook.set(P.pos.x + Math.sin(camH) * 6, P.pos.y + 1.1, P.pos.z + Math.cos(camH) * 6);
  }
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.6; camera.position.y += (Math.random() - 0.5) * G.shake * 0.6; G.shake = Math.max(0, G.shake - dt * 2.5); }
  if (boost) { camera.position.x += (Math.random() - 0.5) * 0.05; camera.position.y += (Math.random() - 0.5) * 0.05; }
  camera.lookAt(camLook); G.camPos = camera.position;
  const fov = 66 + sp * 0.17 + (boost ? 11 : 0);
  camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix();
}

// ================== HUD ==================
const mini = $('mini'), mg = mini.getContext('2d');
let hudT = 0, wrongT = 0;
function drawMini() {
  const W = mini.width, mm = track.mm, pad = 16, s = (W - pad * 2) * mm.s, ox = pad + ((W - pad * 2) - mm.w * s) / 2, oz = pad + ((W - pad * 2) - mm.h * s) / 2;
  const X = x => ox + (x - mm.x0) * s, Z = z => oz + (z - mm.z0) * s;
  mg.clearRect(0, 0, W, W);
  if (!track.miniPath || track.miniPath.def !== track.def) { const p = new Path2D(); for (let i = 0; i < track.n; i += 3) { const q = track.P[i]; i ? p.lineTo(X(q.x), Z(q.z)) : p.moveTo(X(q.x), Z(q.z)); } p.closePath(); track.miniPath = { p, def: track.def }; }
  mg.lineJoin = 'round'; mg.strokeStyle = '#ffffff30'; mg.lineWidth = 7; mg.stroke(track.miniPath.p);
  mg.strokeStyle = '#00f0ffaa'; mg.lineWidth = 2.5; mg.shadowColor = '#00f0ff'; mg.shadowBlur = 6; mg.stroke(track.miniPath.p); mg.shadowBlur = 0;
  const dot = (c, col, r) => { mg.fillStyle = col; mg.beginPath(); mg.arc(X(c.pos.x), Z(c.pos.z), r, 0, 7); mg.fill(); };
  for (const c of race.remotes) dot(c, '#ff2bd6', 4.5);
  for (const c of race.cars) if (!c.isPlayer) dot(c, '#ffd200', 3.5);
  if (race.ghost && race.ghost.mesh.visible) { mg.fillStyle = '#9fe8ff88'; mg.beginPath(); mg.arc(X(race.ghost.mesh.position.x), Z(race.ghost.mesh.position.z), 4, 0, 7); mg.fill(); }
  const P = race.player; mg.save(); mg.translate(X(P.pos.x), Z(P.pos.z)); mg.rotate(-P.h + Math.PI);
  mg.fillStyle = '#fff'; mg.shadowColor = '#00f0ff'; mg.shadowBlur = 10; mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(5, 6); mg.lineTo(-5, 6); mg.closePath(); mg.fill(); mg.restore();
}
function updateHUD(dt) {
  const P = race.player; if (!P) return;
  // carga del miniturbo
  const lv = chargeLevel(P), ch = $('charge');
  if (P.drifting) { ch.classList.add('show'); const cols = ['#ffffff88', '#59b4ff', '#ff9a2a', '#d05aff']; ch.style.color = cols[lv]; ch.style.textShadow = `0 0 12px ${cols[lv]}`; ch.textContent = 'DERRAPE ' + '●'.repeat(lv) + '○'.repeat(3 - lv); if (lv !== P._lv) { if (lv) sfx.charge(lv); P._lv = lv; } }
  else { ch.classList.remove('show'); P._lv = 0; }
  $('slip').classList.toggle('show', P.slipK > 0.6);
  // sentido contrario
  if (race.go && !P.finished && P.loc) { const d = P.vel.x * P.loc.T.x + P.vel.z * P.loc.T.z; wrongT = d < -4 ? wrongT + dt : 0; }
  $('wrong').classList.toggle('hidden', wrongT < 1);
  $('speedfx').style.opacity = clamp((P.vel.length() - 50) / 40, 0, 1) * 0.8 + (P.isNitro || P.boostT > 0 ? 0.4 : 0);
  hudT -= dt; if (hudT > 0) return; hudT = 0.05;
  $('kmh').textContent = Math.round(Math.abs(P.vf) * 3.6);
  $('nitro').style.width = P.nitro + '%'; $('nitroBar').classList.toggle('on', !!P.isNitro);
  const total = race.cars.length + race.remotes.length;
  $('pos').classList.toggle('hidden', race.mode === 'trial');
  $('posN').textContent = P.place || 1; $('posT').textContent = '/' + total;
  const lapN = clamp(P.lap, 1, race.laps);
  $('lap').textContent = race.mode === 'trial' ? `VUELTA ${Math.max(1, P.lap)}` : (P.finished ? 'META' : `VUELTA ${lapN}/${race.laps}`);
  const cur = race.go && P.lap >= 1 && !P.finished ? race.t - race.lapStart : 0;
  $('tCur').textContent = fmtTime(cur || 0.0001).replace('--:--.---', '0:00.000');
  $('tBest').textContent = 'MEJOR ' + fmtTime(race.best);
  // tabla
  if (race.order && race.mode !== 'trial') {
    const lead = race.order[0];
    $('board').innerHTML = race.order.slice(0, 8).map((c, i) => `<div class="${c.isPlayer ? 'me' : ''}"><i>${i + 1}</i>${esc(c.isPlayer ? save.name : c.name)}${i && !c.finished ? ` <span style="opacity:.6">+${Math.max(0, (lead.prog - c.prog) * 2 / Math.max(20, Math.abs(c.vf || 30))).toFixed(1)}</span>` : ''}</div>`).join('');
  } else $('board').innerHTML = '';
  G.musicHot = race.mode !== 'trial' && P.lap === race.laps;
  drawMini();
}

// ================== BUCLE ==================
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  G.t += dt;
  if (!G.paused) {
    if (race.on) {
      const ctl = screen === null ? readInput(dt) : { throttle: 0, steer: 0, drift: false, nitro: false };
      updateRace(dt, ctl, ev);
      updateNet(dt);
      const P = race.player;
      sfx.engine(P.vf, P.spec.s.max * 1.1, race.go ? ctl.throttle : ctl.throttle * 0.5 + 0.1, true, P.isNitro || P.boostT > 0, dt);
      sfx.skid(P.drifting ? 1 : clamp((Math.abs(P.vr) - 5) / 10, 0, 0.6) * (P.air > 0 ? 0 : 1));
      updateHUD(dt);
    } else { sfx.engine(0, 1, 0, false, false, dt); sfx.skid(0); }
    updateParticles(dt);
  }
  updateCamera(dt);
  const focus = race.on && race.player ? race.player.pos : camera.position;
  followShadow(focus);
  skyFollow(camera.position);
  if (track.rain) updateRain(dt, camera.position, track.rain, race.player?.vel.x || 0, race.player?.vel.z || 0); else updateRain(dt, camera.position, 0);
  updateTrack(dt, G.t);
  // relámpagos en la lluvia
  if (track.rain > 0.5) { if (Math.random() < dt * 0.06) { G.flash = 1; } if (G.flash > 0) { G.flash -= dt * 3; sky.flash(Math.max(0, G.flash) * 0.6 * (Math.random() < 0.7 ? 1 : 0.3)); } else sky.flash(0); }
  updateMsg(dt);
  composer.render();
}

// ================== ARRANQUE ==================
ensureTrack(save.track);
show('menu');
frame();
if (location.hash === '#dbg') window.dbg = {
  // simula sin dibujar; auto = el jugador conduce con la IA
  sim(sec, auto = true) { const P = race.player; if (auto) P.ai = P.ai || { bias: 0, skill: 1, react: 0, nitroT: 0 }; const n = Math.round(sec * 60); for (let i = 0; i < n && race.on; i++) { const ctl = auto ? (race.go ? aiControl(P, 1 / 60) : { throttle: 0, steer: 0 }) : { throttle: 1, steer: 0 }; updateRace(1 / 60, ctl, ev); } return { t: race.t, lap: P.lap, best: race.best, laps: race.lapTimes, place: P.place, fin: P.finished, order: race.order && race.order.map(c => c.name + ':' + c.lap + (c.finished ? '*' + c.finishT.toFixed(1) : '')) }; }, race, track, save, G, camera, startRace, openSelect, ensureTrack, net, TRACKS, show };
