// Neon Arcade — librería común: utilidades, lienzo, bucle, controles (teclado, mando, táctil),
// sonido sintetizado, partículas, dibujo neón, salas multijugador (PeerJS) y pantalla de sala.
export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const irnd = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const isTouch = matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover:none)').matches);
export const COLORS = ['#00f0ff', '#ff2bd6', '#39ff88', '#ffd200', '#ff8a1a', '#9d4dff', '#ff2a4d', '#ffffff'];

// ---------- guardado ----------
export const store = {
  get(k, d) { try { const v = localStorage.getItem('arcade.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('arcade.' + k, JSON.stringify(v)); } catch (e) {} },
};
export const myName = () => store.get('name', '') || 'PILOTO' + irnd(10, 99);

// ---------- avisos ----------
let toastT = 0;
export function toast(html, ms = 2600) {
  let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.innerHTML = html; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
let bigT = 0;
export function big(txt, color = '#00f0ff', ms = 1200) {
  let b = $('big'); if (!b) { b = document.createElement('div'); b.id = 'big'; b.className = 'big'; document.body.appendChild(b); }
  b.textContent = txt; b.style.setProperty('--acc', color); b.classList.add('on'); clearTimeout(bigT); bigT = setTimeout(() => b.classList.remove('on'), ms);
}

// ---------- lienzo y bucle ----------
export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const S = { ctx, W: 0, H: 0, dpr: 1 };
  const resize = () => {
    S.dpr = Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2);
    S.W = innerWidth; S.H = innerHeight;
    canvas.width = Math.round(S.W * S.dpr); canvas.height = Math.round(S.H * S.dpr);
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    S.onResize && S.onResize();
  };
  addEventListener('resize', resize); resize();
  return S;
}
export function loop(fn) {
  let last = performance.now();
  const f = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; fn(dt, now / 1000); requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

// ---------- teclado ----------
export const keys = new Set();
const hits = new Set();
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (!keys.has(e.code)) hits.add(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
export const down = (...c) => c.some(k => keys.has(k));
export const hit = (...c) => { let r = false; for (const k of c) if (hits.has(k)) { hits.delete(k); r = true; } return r; };
export const clearHits = () => hits.clear();

// ---------- mando ----------
export function pad() {
  const ps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of ps) {
    if (!g) continue;
    const dz = v => Math.abs(v) > 0.15 ? v : 0, b = i => !!(g.buttons[i] && g.buttons[i].pressed);
    return { lx: dz(g.axes[0]), ly: dz(g.axes[1]), rx: dz(g.axes[2] || 0), ry: dz(g.axes[3] || 0), a: b(0), b: b(1), x: b(2), y: b(3), lb: b(4), rb: b(5), lt: g.buttons[6]?.value || 0, rt: g.buttons[7]?.value || 0, start: b(9), up: b(12), down: b(13), left: b(14), right: b(15) };
  }
  return null;
}

// ---------- táctil ----------
// opts: { left: 'stick' | 'buttons', right: 'stick' | null, buttons: [{id,label,color,right,bottom,size}] }
export function touchControls(opts = {}) {
  const root = document.createElement('div'); root.className = 'touch hidden'; document.body.appendChild(root);
  const st = { lx: 0, ly: 0, la: false, rx: 0, ry: 0, ra: false, btn: {}, tap: {} };
  const mk = (side) => {
    const zone = document.createElement('div'); zone.className = 'tzone';
    zone.style[side === 'l' ? 'left' : 'right'] = 0; zone.style.width = (opts.right || side === 'l' && !opts.buttons ? 50 : side === 'l' ? 55 : 45) + '%';
    if (side === 'r' && opts.buttons && opts.right) zone.style.width = '50%';
    const s = document.createElement('div'); s.className = 'stick' + (side === 'r' ? ' r' : ''); s.innerHTML = '<i></i>';
    root.appendChild(zone); root.appendChild(s);
    let id = null, x0 = 0, y0 = 0; const R = 52, knob = s.firstChild;
    const set = (x, y) => { let dx = x - x0, dy = y - y0; const m = Math.hypot(dx, dy); if (m > R) { dx *= R / m; dy *= R / m; } knob.style.transform = `translate(${dx}px,${dy}px)`; st[side + 'x'] = dx / R; st[side + 'y'] = dy / R; };
    zone.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; if (id !== null) return; id = t.identifier; x0 = t.clientX; y0 = t.clientY; s.style.left = x0 + 'px'; s.style.top = y0 + 'px'; s.style.display = 'block'; st[side + 'a'] = true; set(x0, y0); }, { passive: false });
    zone.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) set(t.clientX, t.clientY); }, { passive: false });
    const end = e => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; s.style.display = 'none'; st[side + 'a'] = false; st[side + 'x'] = st[side + 'y'] = 0; knob.style.transform = ''; } };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  };
  if (opts.left !== 'none') mk('l');
  if (opts.right === 'stick') mk('r');
  for (const b of opts.buttons || []) {
    const el = document.createElement('button'); el.className = 'tbtn'; el.textContent = b.label;
    if (b.color) el.style.setProperty('--c', b.color);
    const sz = b.size || 74; el.style.width = el.style.height = sz + 'px';
    el.style.right = (b.right ?? 20) + 'px'; el.style.bottom = (b.bottom ?? 30) + 'px'; if (b.left != null) { el.style.left = b.left + 'px'; el.style.right = 'auto'; }
    if (b.top != null) { el.style.top = b.top + 'px'; el.style.bottom = 'auto'; }
    el.addEventListener('touchstart', e => { e.preventDefault(); st.btn[b.id] = true; st.tap[b.id] = true; el.classList.add('on'); }, { passive: false });
    const off = e => { e.preventDefault(); st.btn[b.id] = false; el.classList.remove('on'); };
    el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
    root.appendChild(el);
  }
  st.show = on => root.classList.toggle('hidden', !(on && (isTouch || touchSeen)));
  st.tapped = id => { const r = !!st.tap[id]; st.tap[id] = false; return r; };
  return st;
}
let touchSeen = false;
addEventListener('touchstart', () => { touchSeen = true; }, { passive: true, once: true });
export const usingTouch = () => isTouch || touchSeen;

// ---------- pantalla completa (móvil) ----------
export function goFull() {
  if (!usingTouch() || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
}

// ---------- sonido ----------
export const sfx = (() => {
  let ctx = null, master, musG, fxG, muted = store.get('muted', false), musicOn = false, step = 0, nextT = 0, timer = 0, song = null, noiseBuf;
  const ensure = () => {
    if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    fxG = ctx.createGain(); fxG.connect(master); musG = ctx.createGain(); musG.gain.value = 0.22; musG.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  addEventListener('pointerdown', ensure); addEventListener('keydown', ensure);
  const tone = (type, f0, f1, dur, vol, dest, t = ctx.currentTime, attack = 0.005) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || fxG); o.start(t); o.stop(t + dur + 0.05);
  };
  const noise = (dur, vol, freq = 1200, t = ctx.currentTime, type = 'lowpass') => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(fxG); s.start(t); s.stop(t + dur + 0.05);
  };
  const LIB = {
    shoot: () => { tone('square', 880, 220, 0.09, 0.12); },
    laser: () => { tone('sawtooth', 1400, 300, 0.12, 0.1); },
    hit: () => { tone('square', 200, 80, 0.12, 0.2); noise(0.08, 0.15, 2000); },
    boom: () => { noise(0.6, 0.5, 600); tone('sine', 120, 30, 0.5, 0.4); },
    pick: () => { tone('triangle', 660, 1320, 0.12, 0.2); },
    coin: () => { const t = ctx.currentTime; tone('square', 988, 0, 0.08, 0.12, null, t); tone('square', 1319, 0, 0.18, 0.12, null, t + 0.07); },
    jump: () => { tone('square', 300, 700, 0.14, 0.13); },
    bounce: () => { tone('sine', 500, 250, 0.08, 0.15); },
    click: () => { tone('triangle', 1200, 0, 0.04, 0.1); },
    step: () => { noise(0.04, 0.06, 900); },
    hurt: () => { tone('sawtooth', 300, 90, 0.25, 0.2); },
    win: () => { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone('square', f, 0, 0.25, 0.12, null, t + i * 0.12)); },
    lose: () => { const t = ctx.currentTime; [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, 0, 0.3, 0.16, null, t + i * 0.16)); },
    go: () => { tone('square', 1047, 0, 0.35, 0.16); },
    beep: () => { tone('square', 523, 0, 0.15, 0.13); },
    power: () => { const t = ctx.currentTime; [440, 554, 659, 880, 1108].forEach((f, i) => tone('triangle', f, 0, 0.12, 0.12, null, t + i * 0.05)); },
    goal: () => { const t = ctx.currentTime; noise(1.2, 0.25, 3000, t, 'bandpass'); [523, 659, 784, 1047, 1319].forEach((f, i) => tone('sawtooth', f, 0, 0.3, 0.09, null, t + i * 0.09)); },
    dash: () => { noise(0.18, 0.2, 2500, ctx.currentTime, 'bandpass'); tone('sine', 400, 1200, 0.15, 0.1); },
    text: () => { tone('square', 700 + Math.random() * 300, 0, 0.03, 0.04); },
  };
  // música: secuenciador synthwave (bajo + arpegio + caja), cada juego pasa su canción
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const schedule = () => {
    if (!ctx || !musicOn || !song) return;
    const spb = 60 / song.bpm / 4;
    while (nextT < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % song.chords.length, s = step % 16, root = song.root + song.chords[bar];
      if (s % 2 === 0) tone('sawtooth', N(root - 24 + (s % 8 === 6 ? 12 : 0)), 0, spb * 1.8, 0.5, musG, nextT);
      const arp = [0, 7, 12, song.minor ? 15 : 16, 19, 12, 7, song.minor ? 3 : 4];
      if (song.arp !== false) tone('square', N(root + 12 + arp[s % 8]), 0, spb * 0.9, 0.16, musG, nextT);
      if (s % 8 === 4) { const g = ctx.createGain(); g.gain.value = 1; const sb = ctx.createBufferSource(); sb.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; const gg = ctx.createGain(); gg.gain.setValueAtTime(0.25, nextT); gg.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.15); sb.connect(f); f.connect(gg); gg.connect(musG); sb.start(nextT); sb.stop(nextT + 0.2); }
      if (s % 4 === 0) tone('sine', 150, 40, 0.18, 0.7, musG, nextT);
      nextT += spb; step++;
    }
  };
  return {
    ensure,
    play(n) { if (!ctx || muted) return; try { LIB[n] && LIB[n](); } catch (e) {} },
    music(s) { ensure(); song = s; musicOn = !!s; if (ctx && s) { nextT = ctx.currentTime + 0.1; step = 0; } if (!timer) timer = setInterval(schedule, 40); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; store.set('muted', muted); if (master) master.gain.value = muted ? 0 : 0.7; return muted; },
  };
})();
export const SONGS = {
  drive: { bpm: 118, root: 57, chords: [0, -4, -7, -2], minor: true },
  hero: { bpm: 126, root: 60, chords: [0, 7, 9, 5], minor: false },
  dark: { bpm: 96, root: 52, chords: [0, 0, -2, -4], minor: true },
  space: { bpm: 104, root: 62, chords: [0, 5, -2, 3], minor: true },
  hype: { bpm: 140, root: 55, chords: [0, 3, 5, -2], minor: true },
  calm: { bpm: 84, root: 64, chords: [0, -3, 5, 0], minor: false, arp: true },
};

// ---------- partículas ----------
export class Particles {
  constructor(max = 900) { this.p = []; this.max = isTouch ? max / 2 : max; }
  emit(x, y, n, color, speed = 200, life = 0.6, size = 3, spread = Math.PI * 2, dir = 0, drag = 2.5) {
    for (let i = 0; i < n && this.p.length < this.max; i++) {
      const a = dir + (Math.random() - 0.5) * spread, v = speed * (0.3 + Math.random() * 0.7);
      this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5), max: life, color, size: size * (0.6 + Math.random() * 0.6), drag });
    }
  }
  ring(x, y, color, r = 40) { this.p.push({ ring: true, x, y, r: 4, R: r, life: 0.35, max: 0.35, color }); }
  update(dt) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i]; q.life -= dt; if (q.life <= 0) { p[i] = p[p.length - 1]; p.pop(); continue; }
      if (q.ring) { q.r = lerp(q.R, 4, q.life / q.max); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k;
    }
  }
  draw(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of this.p) {
      const a = q.life / q.max; ctx.globalAlpha = a;
      if (q.ring) { ctx.strokeStyle = q.color; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.stroke(); continue; }
      ctx.fillStyle = q.color; const s = q.size * (0.4 + a * 0.6); ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
    ctx.restore();
  }
}

// ---------- dibujo neón ----------
// trazo con halo barato (sin shadowBlur, que va lento en móviles)
export function neon(ctx, color, width, draw, glow = 1) {
  ctx.save(); ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 * glow; ctx.lineWidth = width * 4; ctx.beginPath(); draw(); ctx.stroke(); ctx.globalAlpha = 0.35 * glow; ctx.lineWidth = width * 2; ctx.beginPath(); draw(); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.lineWidth = width; ctx.beginPath(); draw(); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = Math.max(1, width * 0.35); ctx.beginPath(); draw(); ctx.stroke();
  ctx.restore();
}
export function glowDot(ctx, x, y, r, color, a = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
// fondo de rejilla synthwave
export function grid(ctx, W, H, camX, camY, color = '#2a0f5a', step = 60) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
  const ox = -((camX % step) + step) % step, oy = -((camY % step) + step) % step;
  for (let x = ox; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke(); ctx.restore();
}

// ---------- multijugador (PeerJS, el anfitrión manda) ----------
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = res; s.onerror = () => rej(new Error('sin conexión')); document.head.appendChild(s); });
}
export class Room {
  constructor(game, max = 8) { this.prefix = 'neonarcade-' + game + '-'; this.max = max; this.role = null; this.code = ''; this.peer = null; this.conns = new Map(); this.hostConn = null; this.myId = ''; this.players = []; this.status = ''; this.onChange = null; this.onMsg = null; this.onStart = null; this.onLeave = null; }
  get isHost() { return this.role === 'host'; }
  get online() { return !!this.role; }
  _st(s) { this.status = s; this.onChange && this.onChange(); }
  _roster() { this.players.forEach((p, i) => p.color = COLORS[i % COLORS.length]); this.broadcast({ t: '_pl', list: this.players }); this.onChange && this.onChange(); }
  async host() {
    try { await loadPeer(); } catch (e) { this._st('No llego al servidor de salas. ¿Tienes internet?'); return; }
    this.leave(true);
    this.code = Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
    this._st('Creando sala…');
    const peer = new window.Peer(this.prefix + this.code); this.peer = peer; this.role = 'host';
    peer.on('open', id => { this.myId = id; this.players = [{ id, name: myName() }]; this._roster(); this._st('Sala abierta: pasa el código a tus amigos.'); });
    peer.on('connection', c => {
      c.on('open', () => { if (this.players.length >= this.max || this.playing) { c.send({ t: '_full' }); setTimeout(() => c.close(), 300); return; } this.conns.set(c.peer, c); });
      c.on('data', d => {
        if (d.t === '_hi') { let p = this.players.find(r => r.id === c.peer); if (!p) { p = { id: c.peer }; this.players.push(p); toast(`👋 ${String(d.name).slice(0, 14)} ha entrado`); sfx.play('pick'); } p.name = String(d.name || 'INVITADO').slice(0, 14); this._roster(); return; }
        this.onMsg && this.onMsg(c.peer, d);
      });
      const gone = () => { if (!this.conns.has(c.peer)) return; this.conns.delete(c.peer); const p = this.players.find(r => r.id === c.peer); if (p) toast(`👋 ${p.name} se ha ido`); this.players = this.players.filter(r => r.id !== c.peer); this._roster(); this.onLeave && this.onLeave(c.peer); };
      c.on('close', gone); c.on('error', gone);
    });
    peer.on('error', e => { if (e.type === 'unavailable-id') return this.host(); this._st('Error de conexión: ' + (e.type || e.message)); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }
  async join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { this._st('El código tiene 5 letras.'); return; }
    try { await loadPeer(); } catch (e) { this._st('No llego al servidor de salas. ¿Tienes internet?'); return; }
    this.leave(true); this._st('Buscando la sala ' + code + '…');
    const peer = new window.Peer(); this.peer = peer; this.role = 'client'; this.code = code;
    peer.on('open', id => {
      this.myId = id;
      const c = peer.connect(this.prefix + code, { reliable: true, serialization: 'json' }); this.hostConn = c;
      const to = setTimeout(() => { if (!c.open) this._st('No encuentro esa sala. Revisa el código.'); }, 10000);
      c.on('open', () => { clearTimeout(to); c.send({ t: '_hi', name: myName() }); this._st('Dentro. Espera a que el anfitrión empiece.'); sfx.play('pick'); });
      c.on('data', d => {
        if (d.t === '_pl') { this.players = d.list; this.onChange && this.onChange(); return; }
        if (d.t === '_full') { this._st('La sala está llena o ya han empezado.'); return; }
        if (d.t === '_start') { this.playing = true; this.onStart && this.onStart(d.cfg); return; }
        this.onMsg && this.onMsg('host', d);
      });
      c.on('close', () => { this._st('El anfitrión ha cerrado la sala.'); this.role = null; this.players = []; this.onChange && this.onChange(); this.onLeave && this.onLeave('host'); });
    });
    peer.on('error', e => this._st(e.type === 'peer-unavailable' ? 'No existe la sala ' + code + '.' : 'Error de conexión: ' + (e.type || e.message)));
  }
  start(cfg) { if (!this.isHost) return; this.playing = true; this.broadcast({ t: '_start', cfg }); this.onStart && this.onStart(cfg); }
  // los mensajes deben ser pequeños (< ~16 KB) o el canal se corta en algunos navegadores
  _tx(c, m) { if (!c || !c.open) return; try { const dc = c.dataChannel; if (dc && dc.bufferedAmount > 256000) return; c.send(m); } catch (e) {} }
  send(m) { this._tx(this.hostConn, m); }
  broadcast(m) { for (const c of this.conns.values()) this._tx(c, m); }
  sendTo(id, m) { this._tx(this.conns.get(id), m); }
  leave(silent) { try { this.peer && this.peer.destroy(); } catch (e) {} this.peer = null; this.role = null; this.hostConn = null; this.conns.clear(); this.players = []; this.playing = false; if (!silent) this._st(''); }
}

// ---------- pantalla de sala reutilizable ----------
// Pinta dentro de `el` el formulario de sala. opts: { color, extra(el) -> html de opciones del anfitrión, onBack, minPlayers }
export function lobby(el, room, opts = {}) {
  el.innerHTML = `
    <h2 class="h">MULTIJUGADOR</h2>
    <div class="col" style="width:min(460px,94vw)">
      <input class="field" id="lbName" maxlength="14" placeholder="TU NOMBRE" value="${myName()}">
      <div id="lbStart"><button class="btn pink" id="lbHost" style="width:100%">CREAR SALA</button>
        <div class="status">…o únete con el código de un amigo:</div>
        <div class="row" style="flex-wrap:nowrap"><input class="field" id="lbCode" maxlength="5" placeholder="CÓDIGO" style="border-color:var(--cyan)"><button class="btn" id="lbJoin">ENTRAR</button></div>
      </div>
      <div id="lbRoom" class="hidden panel">
        <div style="font-size:11px;letter-spacing:3px;color:var(--dim)">CÓDIGO DE LA SALA</div><div class="code" id="lbCodeShow"></div>
        <div class="plist" id="lbList"></div>
        <div id="lbOpts"></div>
        <button class="btn gold hidden" id="lbGo" style="width:100%;margin-top:8px">¡EMPEZAR!</button>
      </div>
      <div class="status" id="lbStatus"></div>
      <div class="row"><button class="btn small hidden" id="lbLeave">SALIR DE LA SALA</button><button class="btn small" id="lbBack">ATRÁS</button></div>
    </div>`;
  const q = id => el.querySelector('#' + id);
  q('lbName').onchange = q('lbName').oninput = e => store.set('name', e.target.value.toUpperCase().slice(0, 14));
  q('lbHost').onclick = () => room.host();
  q('lbJoin').onclick = () => room.join(q('lbCode').value);
  q('lbCode').onkeydown = e => { if (e.key === 'Enter') room.join(q('lbCode').value); };
  q('lbLeave').onclick = () => room.leave();
  q('lbBack').onclick = () => { opts.onBack && opts.onBack(); };
  q('lbGo').onclick = () => { if (room.players.length < (opts.minPlayers || 1)) { q('lbStatus').textContent = 'Hace falta al menos ' + opts.minPlayers + ' jugadores.'; return; } opts.onGo ? opts.onGo() : room.start({}); };
  const render = () => {
    const inRoom = room.online && room.code && (room.isHost ? !!room.myId : room.players.length > 0);
    q('lbStart').classList.toggle('hidden', !!room.online);
    q('lbRoom').classList.toggle('hidden', !inRoom);
    q('lbLeave').classList.toggle('hidden', !room.online);
    q('lbCodeShow').textContent = room.code;
    q('lbList').innerHTML = room.players.map((p, i) => `<div><i style="color:${p.color};background:${p.color}"></i>${p.name}${i === 0 ? ' 👑' : ''}${p.id === room.myId ? ' (tú)' : ''}</div>`).join('');
    q('lbGo').classList.toggle('hidden', !room.isHost);
    if (room.isHost && opts.extra && !q('lbOpts').dataset.done) { q('lbOpts').innerHTML = opts.extra(); q('lbOpts').dataset.done = 1; opts.bindExtra && opts.bindExtra(q('lbOpts')); }
    if (!room.isHost) { q('lbOpts').innerHTML = ''; delete q('lbOpts').dataset.done; }
    q('lbStatus').textContent = room.status;
  };
  room.onChange = render; render();
  return render;
}

// ---------- botón para volver al arcade ----------
export function backButton() {
  const a = document.createElement('a'); a.id = 'backArcade'; a.href = '../../'; a.textContent = '◀ ARCADE';
  document.body.appendChild(a); return a;
}
// botones segmentados (opciones)
export function seg(el, value, onPick) {
  el.querySelectorAll('button').forEach(b => { b.classList.toggle('on', String(b.dataset.v) === String(value)); b.onclick = () => { sfx.play('click'); onPick(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); seg(el, b.dataset.v, onPick); }; });
}
