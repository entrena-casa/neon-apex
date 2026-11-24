// Circuitos: definición, construcción (carretera, curvas, muros, terreno, agua con reflejos, decorado) y consultas
import { THREE, scene, renderer, camera, Q, V3, clamp, lerp, smooth, mulberry32, canvasTex, radialTex, signTex, hemi, sun, sunDir, bloom, isTouch } from './core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

// ================== CIRCUITOS ==================
// pts: [x, y, z]  (circuito cerrado, sentido de la marcha)
export const TRACKS = [
  {
    id: 'distrito', name: 'DISTRITO NEÓN', kind: 'CALLEJERO', mood: 'NOCHE · LLUVIA', theme: 'city', width: 15,
    desc: 'Calles mojadas, curvas de 90° y una chicane traicionera. Los reflejos te engañan.',
    medals: [62, 68, 76], laps: 3,
    pts: [[0, 0, 0], [220, 0, 0], [262, 0, 32], [262, 0, 118], [232, 0, 150], [152, 0, 152], [122, 0, 184], [122, 0, 280], [86, 0, 312], [-58, 0, 312], [-90, 0, 282], [-90, 0, 202], [-60, 0, 172], [-20, 0, 152], [-12, 0, 112], [-42, 0, 82], [-120, 0, 72], [-152, 0, 42], [-140, 0, 6], [-100, 0, -6]],
    boosts: [[0.04, 0], [0.33, 0.3], [0.58, -0.3]],
    env: { sky: [0x05010f, 0x1a0636, 0x6a0a48], fog: [0x1a0830, 0.0042], sunCol: 0x8899ff, sunI: 0.5, sunDir: [-0.3, 0.8, 0.4], hemi: [0x6a48ff, 0x14002a, 0.75], rain: 0.85, wet: 1, stars: true, bloom: 0.95, exposure: 1.05, neon: [0x00f0ff, 0xff2bd6, 0x9d4dff] },
  },
  {
    id: 'bahia', name: 'BAHÍA DORADA', kind: 'COSTERO', mood: 'ATARDECER', theme: 'bay', width: 16,
    desc: 'Rectas sobre el mar y un puente gigante. Rebufo, nitro y frenadas a 300 por hora.',
    medals: [74, 81, 90], laps: 3,
    pts: [[0, 0, 0], [300, 0, 0], [410, 3, 50], [462, 7, 170], [432, 11, 290], [322, 15, 352], [182, 9, 380], [60, 3, 418], [-80, 1, 400], [-180, 2, 330], [-202, 3, 222], [-150, 2, 140], [-70, 1, 100], [-92, 0, 40], [-56, 0, 2]],
    boosts: [[0.02, 0], [0.37, 0], [0.7, -0.4]],
    env: { sky: [0x2a1a5a, 0xff6a4a, 0xffc27a], fog: [0xd88a7a, 0.0016], sunCol: 0xffb070, sunI: 2.4, sunDir: [-0.85, 0.18, -0.5], hemi: [0xffb59a, 0x3a2050, 1.0], rain: 0, wet: 0.15, stars: false, bloom: 0.45, exposure: 0.95, sunDisc: true, neon: [0xff7a3d, 0xffd200, 0xff2bd6], water: -4 },
  },
  {
    id: 'canon', name: 'CAÑÓN ROJO', kind: 'RALLY', mood: 'DÍA · CALOR', theme: 'canyon', width: 15,
    desc: 'Cambios de rasante, saltos y polvo. Si aterrizas torcido, se acabó.',
    medals: [71, 78, 87], laps: 3,
    pts: [[0, 0, 0], [100, 0, 0], [150, 8, 0], [176, 9, 0], [202, 1, 0], [282, -3, 12], [342, 0, 62], [362, 6, 142], [332, 12, 222], [262, 16, 262], [172, 14, 252], [122, 20, 202], [62, 27, 192], [10, 28, 214], [-40, 22, 238], [-82, 25, 250], [-162, 14, 222], [-202, 8, 152], [-192, 4, 72], [-142, 2, 22], [-72, 0, 0]],
    boosts: [[0.05, 0], [0.45, 0], [0.8, 0.3]],
    env: { sky: [0x2a6ad8, 0x8ab8f0, 0xf0d8b0], fog: [0xe8c8a0, 0.0014], sunCol: 0xfff0d8, sunI: 3.0, sunDir: [0.5, 0.75, 0.3], hemi: [0xbcd8ff, 0x8a5030, 1.1], rain: 0, wet: 0, stars: false, bloom: 0.3, exposure: 0.85, sunDisc: true, neon: [0xff7a1a, 0xffd200, 0x00f0ff] },
  },
  {
    id: 'autopista', name: 'AUTOPISTA 8', kind: 'ALTA VELOCIDAD', mood: 'NOCHE · NIEBLA', theme: 'highway', width: 18,
    desc: 'Un ocho elevado sobre la ciudad con túnel de neón. Pasas por encima de ti mismo.',
    medals: [70, 77, 86], laps: 3,
    pts: [[-200, 12, -120], [-100, 12, -60], [0, 12, 0], [100, 14, 60], [200, 18, 118], [300, 22, 118], [362, 24, 40], [342, 26, -62], [262, 27, -120], [162, 27, -100], [62, 27, -42], [0, 27, 0], [-62, 25, 42], [-162, 20, 100], [-262, 16, 120], [-342, 14, 60], [-342, 12, -40], [-290, 12, -110]],
    boosts: [[0.08, 0], [0.5, 0], [0.62, 0.3]], tunnel: [0.22, 0.36],
    env: { sky: [0x02010a, 0x0a0626, 0x2a0a4a], fog: [0x120a2a, 0.0028], sunCol: 0x9aa0ff, sunI: 0.55, sunDir: [0.3, 0.8, -0.4], hemi: [0x5a48ff, 0x100020, 0.7], rain: 0, wet: 0.5, stars: true, bloom: 1.0, exposure: 1.05, neon: [0xff2bd6, 0x00f0ff, 0x39ff88] },
  },
  {
    id: 'montana', name: 'PUERTO HELADO', kind: 'MONTAÑA', mood: 'AMANECER · NIEBLA', theme: 'mountain', width: 13,
    desc: 'Estrecho, con horquillas y un lago. Aquí gana el que sabe derrapar.',
    medals: [80, 88, 98], laps: 3,
    pts: [[0, 0, 0], [150, 6, 0], [185, 8, 8], [196, 10, 30], [182, 11, 50], [140, 13, 58], [40, 18, 60], [10, 19, 70], [0, 20, 90], [12, 21, 110], [50, 23, 118], [160, 30, 120], [190, 31, 130], [198, 32, 150], [185, 33, 170], [150, 35, 180], [60, 40, 182], [-30, 38, 192], [-110, 28, 162], [-152, 16, 102], [-142, 6, 40], [-82, 0, 0]],
    boosts: [[0.03, 0], [0.62, 0], [0.86, 0]],
    env: { sky: [0x3a4a8a, 0xd89ab8, 0xffd8b0], fog: [0xc8b8d0, 0.0035], sunCol: 0xffc8a0, sunI: 1.8, sunDir: [0.7, 0.25, -0.6], hemi: [0xd8d0ff, 0x304050, 1.0], rain: 0, wet: 0.3, stars: false, bloom: 0.45, exposure: 0.9, sunDisc: true, neon: [0x00f0ff, 0x9d4dff, 0xffffff], water: -2 },
  },
];

// ================== RUIDO ==================
function hash2(x, y) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

// ================== ESTADO DEL CIRCUITO ACTUAL ==================
export const track = { def: null, n: 0, P: [], T: [], R: [], d: [], curv: [], len: 0, hw: 7, wall: 9, group: null, boosts: [], lights: [], waters: [], update: null };
const STEP = 2;
const _a = new V3(), _b = new V3();

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { for (const k in m) if (m[k] && m[k].isTexture && !m[k].userData.keep) m[k].dispose(); m.dispose(); });
    if (o.isReflector && o.getRenderTarget) o.getRenderTarget().dispose();
  });
}

// ---- búsqueda espacial de muestras ----
let hash = new Map(); const HC = 24;
const hkey = (x, z) => (Math.floor(x / HC) + 1000) * 4096 + Math.floor(z / HC) + 1000;
function buildHash() {
  hash = new Map();
  for (let i = 0; i < track.n; i++) { const p = track.P[i], k = hkey(p.x, p.z); let l = hash.get(k); if (!l) hash.set(k, l = []); l.push(i); }
}
// distancia horizontal al eje más cercano (para terreno y decorado)
export function nearestSample(x, z, R = 60) {
  let best = -1, bd = Infinity; const r = Math.ceil(R / HC);
  const cx = Math.floor(x / HC), cz = Math.floor(z / HC);
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
    const l = hash.get((cx + i + 1000) * 4096 + cz + j + 1000); if (!l) continue;
    for (const s of l) { const p = track.P[s], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
  }
  return [best, Math.sqrt(bd)];
}
// localiza un coche en el circuito a partir de su índice anterior (soporta cruces a distinto nivel)
export function locate(pos, hint, range = 26) {
  const n = track.n, P = track.P;
  let best = hint, bd = Infinity;
  for (let k = -range; k <= range; k++) {
    const i = ((hint + k) % n + n) % n, p = P[i];
    const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2 + ((p.y - pos.y) * 2) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  const i = best, j = (i + 1) % n, p = P[i], q = P[j];
  const sx = q.x - p.x, sz = q.z - p.z, sl = sx * sx + sz * sz;
  let t = sl > 0 ? ((pos.x - p.x) * sx + (pos.z - p.z) * sz) / sl : 0;
  let ii = i;
  if (t < 0) { const h = (i - 1 + n) % n; const a = P[h]; const ax = p.x - a.x, az = p.z - a.z, al = ax * ax + az * az; t = al > 0 ? ((pos.x - a.x) * ax + (pos.z - a.z) * az) / al : 0; ii = h; }
  t = clamp(t, 0, 1);
  const a = P[ii], b = P[(ii + 1) % n];
  const y = a.y + (b.y - a.y) * t;
  const R = track.R[ii];
  const lat = (pos.x - (a.x + (b.x - a.x) * t)) * R.x + (pos.z - (a.z + (b.z - a.z) * t)) * R.z;
  return { i: ii, t, y, lat, R, T: track.T[ii], f: ii + t };
}
export const sampleAt = f => { const n = track.n, i = Math.floor(((f % n) + n) % n), j = (i + 1) % n, t = f - Math.floor(f); return _a.copy(track.P[i]).lerp(track.P[j], t); };

// ================== TEXTURAS ==================
function asphaltTex(theme, wet) {
  const rng = mulberry32(7);
  const t = canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = theme === 'canyon' ? '#3a2e2a' : '#1c1a22'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = rng(); g.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${0.03 + rng() * 0.05})`; g.fillRect(rng() * w, rng() * h, 2, 2); }
    // manchas de goma en la trazada
    for (let i = 0; i < 18; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(w * (0.3 + rng() * 0.4), rng() * h); g.scale(1, 3); g.fillStyle = gr; g.fillRect(-60, -60, 120, 120); g.restore(); }
    // líneas
    g.fillStyle = 'rgba(240,240,255,.85)'; g.fillRect(14, 0, 9, h); g.fillRect(w - 23, 0, 9, h);
    g.fillStyle = 'rgba(255,220,90,.7)'; for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 4, y, 8, 64);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // rugosidad: charcos cuando está mojado
  const r = canvasTex(256, 512, (g, w, h) => {
    const base = wet > 0.5 ? 80 : 210; g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, w, h);
    if (wet > 0) for (let i = 0; i < 40; i++) {
      const x = rng() * w, y = rng() * h, rr = 10 + rng() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(10,10,10,.95)'); gr.addColorStop(1, 'rgba(10,10,10,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * 1.8, 0, 0, 7); g.fill();
    }
  }, false);
  r.wrapS = r.wrapT = THREE.RepeatWrapping;
  return [t, r];
}
const curbTex = (c1) => { const t = canvasTex(64, 128, (g, w, h) => { g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f0ff'; g.fillRect(0, 0, w, h / 2); }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const chevronTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = 18; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 16;
  for (let y = 30; y < h; y += 80) { g.beginPath(); g.moveTo(16, y + 50); g.lineTo(64, y); g.lineTo(112, y + 50); g.stroke(); }
});
chevronTex.wrapT = THREE.RepeatWrapping; chevronTex.userData.keep = true;
const winTexCache = {};
function windowTex(seed, dense = 0.42) {
  if (winTexCache[seed]) return winTexCache[seed];
  const rng = mulberry32(seed);
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rng() < dense) { g.fillStyle = `rgba(255,255,255,${0.3 + rng() * 0.7})`; g.fillRect(x * 16 + 3, y * 16 + 4, 10, 8); }
    for (let y = 0; y < 256; y += 64) if (rng() < 0.5) { g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(0, y + 1, 256, 2); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.keep = true;
  return winTexCache[seed] = t;
}

// ================== CIELO ==================
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunD: { value: new V3() }, sunC: { value: new THREE.Color() }, disc: { value: 0 }, flash: { value: 0 } },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform vec3 top, mid, hor, sunC, sunD; uniform float disc, flash; varying vec3 vP;
    void main(){ float h = vP.y;
      vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
      float s = max(dot(normalize(vP), normalize(sunD)), 0.0);
      c += sunC * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) ;
      c += sunC * smoothstep(0.9993, 0.9997, s) * 6.0 * disc;
      c = mix(c, hor * 0.6, smoothstep(0.0, -0.25, h));
      gl_FragColor = vec4(c + flash, 1.0); }`
});
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), skyMat); skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; scene.add(skyMesh);
const starGeo = new THREE.BufferGeometry(); {
  const n = 1600, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.3 + 0.12; p[i * 3] = Math.cos(th) * Math.cos(ph) * 2200; p[i * 3 + 1] = Math.sin(ph) * 2200; p[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 2200; }
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xd8ccff, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
stars.frustumCulled = false; scene.add(stars);
export function skyFollow(p) { skyMesh.position.copy(p); stars.position.copy(p); }
export const sky = { flash: v => skyMat.uniforms.flash.value = v };

// ================== AGUA CON REFLEJOS ==================
const waterShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 }, deep: { value: new THREE.Color(0x02101a) }, sunC: { value: new THREE.Color() }, sunD: { value: new V3() }, fogC: { value: new THREE.Color() }, fogD: { value: 0.002 }, mask: { value: 0 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix * vec4(position,1.0); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 color, deep, sunC, sunD, fogC; uniform sampler2D tDiffuse; uniform float time, fogD, mask; varying vec4 vUv; varying vec3 vW;
    void main(){
      vec2 p = vW.xz; float t = time; vec2 g = vec2(0.0);
      g += vec2(cos(p.x*0.045+t*0.7), sin(p.y*0.038+t*0.55))*0.5;
      g += vec2(sin(p.x*0.13-p.y*0.09+t*1.6), cos(p.y*0.11+p.x*0.07-t*1.3))*0.3;
      g += vec2(sin(p.x*0.47+p.y*0.31+t*2.9), cos(p.y*0.39-p.x*0.27+t*2.4))*0.14;
      g += vec2(sin(p.x*1.3+p.y*0.9+t*4.1), cos(p.y*1.1-p.x*0.8+t*3.7))*0.06;
      vec3 n = normalize(vec3(g.x*0.14, 1.0, g.y*0.14));
      vec3 V = normalize(cameraPosition - vW);
      float fr = 0.04 + 0.96*pow(1.0 - max(dot(n, V), 0.0), 5.0);
      vec4 uv = vUv; uv.xy += n.xz * 2.2;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      vec3 c = mix(deep, refl, clamp(fr * 1.3 + 0.32, 0.0, 1.0));
      vec3 H = normalize(normalize(sunD) + V); c += sunC * pow(max(dot(n, H), 0.0), 400.0) * 3.0;
      float d = length(cameraPosition - vW); c = mix(c, fogC, 1.0 - exp(-fogD*fogD*d*d));
      gl_FragColor = vec4(c, 1.0);
    }`
};
// reflejo del asfalto mojado (aditivo, con charcos)
const puddleShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 }, amt: { value: 0.5 }, fogC: { value: new THREE.Color() }, fogD: { value: 0.002 } },
  vertexShader: waterShader.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, amt, fogD; uniform vec3 fogC; varying vec4 vUv; varying vec3 vW;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
    void main(){
      vec2 p = vW.xz;
      float pud = smoothstep(0.42, 0.62, n(p*0.07) * 0.65 + n(p*0.21) * 0.35);
      float rip = sin(length(fract(p*0.5)-0.5)*40.0 - time*9.0) * 0.5 + 0.5;
      vec4 uv = vUv; uv.xy += vec2(n(p*0.8+time), n(p*0.8-time)) * 0.6 + rip * 0.25;
      vec3 r = texture2DProj(tDiffuse, uv).rgb;
      float d = length(cameraPosition - vW); float f = exp(-fogD*fogD*d*d);
      gl_FragColor = vec4(r * amt * (0.25 + 0.75 * pud) * f, 1.0);
    }`
};

// ================== CONSTRUCCIÓN ==================
let envRT = null;
export function buildTrack(def) {
  if (track.group) { scene.remove(track.group); disposeGroup(track.group); }
  const E = def.env, rng = mulberry32(def.id.length * 977 + def.pts.length);
  const group = new THREE.Group(); scene.add(group);
  Object.assign(track, { def, group, boosts: [], lights: [], waters: [], hw: def.width / 2, wall: def.width / 2 + 2.2 });
  // ---------- muestreo ----------
  const curve = new THREE.CatmullRomCurve3(def.pts.map(p => new V3(p[0], p[1], p[2])), true, 'centripetal');
  const len = curve.getLength(), n = Math.floor(len / STEP);
  track.len = len; track.n = n;
  const P = track.P = curve.getSpacedPoints(n).slice(0, n);
  const up = new V3(0, 1, 0);
  track.T = P.map((p, i) => new V3().subVectors(P[(i + 1) % n], P[(i - 1 + n) % n]).normalize());
  track.R = track.T.map(t => new V3().crossVectors(t, up).normalize());
  track.curv = P.map((p, i) => { const a = track.T[(i - 3 + n) % n], b = track.T[(i + 3) % n]; const c = a.x * b.z - a.z * b.x; return Math.asin(clamp(c, -1, 1)) / (6 * STEP); });
  // suavizado de la curvatura
  for (let k = 0; k < 3; k++) track.curv = track.curv.map((c, i) => (track.curv[(i - 1 + n) % n] + c * 2 + track.curv[(i + 1) % n]) / 4);
  buildHash();
  const hw = track.hw, W = track.wall;
  // ---------- ambiente ----------
  skyMat.uniforms.top.value.set(E.sky[0]); skyMat.uniforms.mid.value.set(E.sky[1]); skyMat.uniforms.hor.value.set(E.sky[2]);
  sunDir.set(...E.sunDir).normalize();
  skyMat.uniforms.sunD.value.copy(sunDir); skyMat.uniforms.sunC.value.set(E.sunCol); skyMat.uniforms.disc.value = E.sunDisc ? 1 : 0;
  stars.visible = !!E.stars;
  scene.fog.color.set(E.fog[0]); scene.fog.density = E.fog[1];
  scene.background = new THREE.Color(E.fog[0]);
  sun.color.set(E.sunCol); sun.intensity = E.sunI;
  hemi.color.set(E.hemi[0]); hemi.groundColor.set(E.hemi[1]); hemi.intensity = E.hemi[2];
  bloom.strength = E.bloom; renderer.toneMappingExposure = E.exposure;
  track.rain = isTouch ? E.rain * 0.6 : E.rain; track.wet = E.wet;
  const neon = E.neon.map(c => new THREE.Color(c));
  // ---------- terreno ----------
  const box = new THREE.Box3(); P.forEach(p => box.expandByPoint(p));
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) + 900;
  track.center = new V3(cx, 0, cz); track.size = size;
  const theme = def.theme;
  const baseH = (x, z) => {
    if (theme === 'city' || theme === 'highway') return -0.05;
    if (theme === 'bay') { const isl = fbm(x * 0.004 + 3, z * 0.004 - 7); return -14 + Math.max(0, isl - 0.55) * 120; }
    if (theme === 'canyon') { const r = fbm(x * 0.0035, z * 0.0035, 6); const ridge = 1 - Math.abs(fbm(x * 0.006 + 9, z * 0.006, 4) * 2 - 1); return -6 + r * 70 + Math.pow(ridge, 3) * 60; }
    if (theme === 'mountain') { const r = fbm(x * 0.003 + 1, z * 0.003 + 2, 6); return -14 + r * 110 + fbm(x * 0.02, z * 0.02, 3) * 6; }
    return 0;
  };
  const blendTerrain = theme === 'canyon' || theme === 'mountain' || theme === 'bay';
  const terrainH = (x, z) => {
    let h = baseH(x, z);
    if (!blendTerrain) return h;
    const [s, d] = nearestSample(x, z, 90);
    if (s < 0) return h;
    const ty = P[s].y - 0.7;
    if (theme === 'bay' && ty > 3) return Math.min(h, ty - 6); // puentes: el terreno no sube
    const k = smooth(hw + 6, hw + 70, d);
    const near = theme === 'bay' ? ty : ty;
    return lerp(near, theme === 'bay' ? Math.min(h, near - 1) * 0.3 + h * 0.7 : h, k);
  };
  track.terrainH = terrainH;
  {
    const res = Math.round((isTouch ? 110 : 190) * (Q.dense > 0.6 ? 1 : 0.75));
    const tg = new THREE.PlaneGeometry(size, size, res, res); tg.rotateX(-Math.PI / 2); tg.translate(cx, 0, cz);
    const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = terrainH(x, z); pos.setY(i, y);
      if (theme === 'canyon') c.setHSL(0.04 + fbm(x * 0.01, y * 0.08, 2) * 0.04, 0.55, 0.28 + clamp(y / 140, 0, 0.3) + fbm(x * 0.05, z * 0.05, 2) * 0.08);
      else if (theme === 'mountain') { const snow = smooth(38, 60, y); c.setHSL(0.33 - snow * 0.1, 0.35 * (1 - snow), 0.12 + snow * 0.7 + fbm(x * 0.04, z * 0.04, 2) * 0.06); }
      else if (theme === 'bay') { const sand = smooth(-6, 0, y); c.setRGB(0.18 + sand * 0.5, 0.16 + sand * 0.38, 0.14 + sand * 0.22); }
      else c.setRGB(0.04, 0.035, 0.06);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tg.computeVertexNormals();
    const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: theme === 'city' || theme === 'highway' ? 0.35 : 0.95, metalness: theme === 'city' || theme === 'highway' ? 0.5 : 0 }));
    tm.receiveShadow = true; group.add(tm);
  }
  // ---------- carretera ----------
  const [aTex, rTex] = asphaltTex(theme, E.wet);
  const roadMat = new THREE.MeshStandardMaterial({ map: aTex, roughnessMap: rTex, roughness: 1, metalness: E.wet > 0.5 ? 0.25 : 0.05, envMapIntensity: 0.4 + E.wet * 1.2 });
  const sideMat = new THREE.MeshStandardMaterial({ color: theme === 'canyon' ? 0x6a5a50 : 0x2a2834, roughness: 0.8, metalness: 0.2 });
  {
    const top = [], uv = [], idx = [], side = [], sIdx = [];
    let v = 0;
    for (let i = 0; i <= n; i++) {
      const k = i % n, p = P[k], R = track.R[k];
      const lx = p.x - R.x * (hw + 0.1), lz = p.z - R.z * (hw + 0.1), rx = p.x + R.x * (hw + 0.1), rz = p.z + R.z * (hw + 0.1);
      top.push(lx, p.y, lz, rx, p.y, rz); uv.push(0, v, 1, v); v += STEP / (hw * 2);
      const th = 1.4, W2 = W + 0.6;
      side.push(p.x - R.x * W2, p.y - 0.05, p.z - R.z * W2, p.x + R.x * W2, p.y - 0.05, p.z + R.z * W2, p.x - R.x * W2, p.y - th, p.z - R.z * W2, p.x + R.x * W2, p.y - th, p.z + R.z * W2);
      if (i < n) {
        const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        const b = i * 4, c = b + 4;
        sIdx.push(b + 2, b + 3, c + 2, b + 3, c + 3, c + 2); // panza
        sIdx.push(b, b + 2, c, b + 2, c + 2, c); // lado izq
        sIdx.push(b + 1, c + 1, b + 3, b + 3, c + 1, c + 3); // lado der
        sIdx.push(b, c, b + 1, b + 1, c, c + 1); // tablero (debajo del asfalto)
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const road = new THREE.Mesh(g, roadMat); road.receiveShadow = true; group.add(road);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(side, 3)); sg.setIndex(sIdx); sg.computeVertexNormals();
    const sm = new THREE.Mesh(sg, sideMat); sm.receiveShadow = sm.castShadow = true; group.add(sm);
  }
  // ---------- pianos (curbs) en las curvas ----------
  {
    const cm = new THREE.MeshStandardMaterial({ map: curbTex(theme === 'city' || theme === 'highway' ? '#ff2bd6' : '#e8203a'), roughness: 0.5 });
    const pos = [], uv = [], idx = []; let vi = 0;
    for (const sd of [-1, 1]) {
      let run = false, v = 0;
      for (let i = 0; i <= n; i++) {
        const k = i % n, c = track.curv[k], on = Math.abs(c) > 0.012 && Math.sign(c) === sd || Math.abs(c) > 0.022;
        const p = P[k], R = track.R[k];
        if (on) {
          const a = hw - 0.2, b = hw + 1.5;
          pos.push(p.x + R.x * sd * a, p.y + 0.05, p.z + R.z * sd * a, p.x + R.x * sd * b, p.y + 0.12, p.z + R.z * sd * b);
          uv.push(0, v, 1, v); v += STEP / 2.2;
          if (run) { const q = vi - 2; idx.push(q, vi, q + 1, q + 1, vi, vi + 1); }
          vi += 2; run = true;
        } else run = false;
      }
    }
    if (idx.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, cm); m.receiveShadow = true; group.add(m); }
  }
  // ---------- muros con neón ----------
  {
    const wallMat = new THREE.MeshStandardMaterial({ color: theme === 'canyon' ? 0x8a7a70 : theme === 'mountain' ? 0x9aa0b0 : 0x18161f, roughness: 0.6, metalness: theme === 'city' || theme === 'highway' ? 0.6 : 0.2 });
    const pos = [], idx = [], npos = [], ncol = [], nidx = [];
    const H = theme === 'mountain' || theme === 'canyon' ? 0.9 : 1.15;
    for (const sd of [-1, 1]) {
      const base = pos.length / 3, nb = npos.length / 3;
      for (let i = 0; i <= n; i++) {
        const k = i % n, p = P[k], R = track.R[k];
        const x0 = p.x + R.x * sd * W, z0 = p.z + R.z * sd * W, x1 = p.x + R.x * sd * (W + 0.5), z1 = p.z + R.z * sd * (W + 0.5);
        pos.push(x0, p.y - 0.1, z0, x0, p.y + H, z0, x1, p.y + H, z1, x1, p.y - 0.1, z1);
        const c = neon[(Math.floor(i / 40) + (sd > 0 ? 1 : 0)) % neon.length], kk = 2.4;
        npos.push(x0 - R.x * sd * 0.02, p.y + H - 0.02, z0 - R.z * sd * 0.02, x0 - R.x * sd * 0.02, p.y + H - 0.2, z0 - R.z * sd * 0.02);
        ncol.push(c.r * kk, c.g * kk, c.b * kk, c.r * kk, c.g * kk, c.b * kk);
        if (i < n) {
          const a = base + i * 4, b = a + 4;
          if (sd > 0) idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
          else idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2, a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);
          const q = nb + i * 2; nidx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, wallMat); m.castShadow = m.receiveShadow = true; group.add(m);
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3)); ng.setAttribute('color', new THREE.Float32BufferAttribute(ncol, 3)); ng.setIndex(nidx);
    group.add(new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  // ---------- pilares bajo los tramos elevados ----------
  {
    const geos = [];
    for (let i = 0; i < n; i += 12) {
      const p = P[i], g = terrainH(p.x, p.z);
      if (p.y - g < 3) continue;
      const h = p.y - 1.3 - g + 2;
      const pg = new THREE.CylinderGeometry(theme === 'highway' ? 1.8 : 1.2, theme === 'highway' ? 2.2 : 1.6, h, 10); pg.translate(p.x, g - 2 + h / 2, p.z); geos.push(pg);
      if (theme === 'highway') { const cap = new THREE.BoxGeometry(W * 2 + 1, 1.2, 3); cap.rotateY(Math.atan2(track.T[i].x, track.T[i].z)); cap.translate(p.x, p.y - 1.9, p.z); geos.push(cap); }
    }
    if (geos.length) { const m = new THREE.Mesh(mergeGeometries(geos), sideMat); m.castShadow = m.receiveShadow = true; group.add(m); }
  }
  // ---------- salida: línea, pórtico y semáforo ----------
  {
    const p = P[0], T = track.T[0], R = track.R[0], hd = Math.atan2(T.x, T.z);
    const ck = canvasTex(256, 32, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4ff'; g.fillRect(x * 16, y * 16, 16, 16); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 2.2), new THREE.MeshStandardMaterial({ map: ck, roughness: 0.6 }));
    line.rotation.set(-Math.PI / 2, 0, hd); line.position.set(p.x, p.y + 0.03, p.z); line.receiveShadow = true; group.add(line);
    const gan = new THREE.Group(); gan.position.copy(p); gan.rotation.y = hd; group.add(gan);
    const gm = new THREE.MeshStandardMaterial({ color: 0x1a1824, metalness: 0.8, roughness: 0.3 });
    for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), gm); c.position.set(sd * (W + 0.8), 4.5, 0); c.castShadow = true; gan.add(c); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 2.4, 1.6, 1), gm); beam.position.y = 8.6; beam.castShadow = true; gan.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.2), new THREE.MeshBasicMaterial({ map: signTex('NEON APEX', neon[0].getHex(), false), transparent: true, depthWrite: false, color: new THREE.Color(2, 2, 2) }));
    sign.position.set(0, 10.6, 0); sign.rotation.y = Math.PI; gan.add(sign);
    for (let k = 0; k < 5; k++) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x220000 }));
      l.position.set((k - 2) * 1.3, 8.6, -0.52); l.rotation.y = Math.PI; gan.add(l); track.lights.push(l);
    }
  }
  // ---------- placas de turbo ----------
  {
    const bm = new THREE.MeshBasicMaterial({ map: chevronTex, color: new THREE.Color(0.3, 2.4, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const [f, off] of def.boosts) {
      const i = Math.floor(f * n), p = P[i], T = track.T[i], R = track.R[i];
      const lat = off * (hw - 3);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 9), bm);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(T.x, T.z) + Math.PI); m.position.set(p.x + R.x * lat, p.y + 0.06, p.z + R.z * lat); group.add(m);
      track.boosts.push({ i, lat, f: i });
    }
    track.boostMat = bm;
  }
  // ---------- túnel de neón ----------
  if (def.tunnel) {
    const geo = new THREE.TorusGeometry(W + 1.5, 0.35, 6, 40, Math.PI), list = [];
    for (let i = Math.floor(def.tunnel[0] * n); i < def.tunnel[1] * n; i += 6) list.push(i);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    list.forEach((i, k) => { const p = P[i], T = track.T[i]; e.set(0, Math.atan2(T.x, T.z) + Math.PI / 2, 0); q.setFromEuler(e); m4.compose(p, q, new V3(1, 1, 1)); im.setMatrixAt(k, m4); im.setColorAt(k, c.copy(neon[k % neon.length]).multiplyScalar(3)); });
    group.add(im); track.tunnel = im;
  }
  // ---------- decorado según el tema ----------
  const clearOf = (x, z, r) => nearestSample(x, z, r + W + 10)[1] > r + W + 3;
  if (theme === 'city' || theme === 'highway') buildCity(group, def, neon, rng, clearOf, theme === 'highway');
  if (theme === 'bay') buildBay(group, def, neon, rng, clearOf, terrainH);
  if (theme === 'canyon' || theme === 'mountain') buildNature(group, def, rng, clearOf, terrainH, theme);
  buildLamps(group, def, neon, theme);
  // carteles de curva (flechas) antes de las curvas cerradas
  {
    const arrows = [];
    for (let i = 0; i < n; i += 4) {
      const c = track.curv[(i + 20) % n];
      if (Math.abs(c) < 0.03 || arrows.some(a => Math.abs(a - i) < 40)) continue;
      arrows.push(i);
      const sd = c > 0 ? -1 : 1, p = P[i], R = track.R[i], T = track.T[i];
      const tex = signTex(c > 0 ? '▶▶▶' : '◀◀◀', 0xffd200, true);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
      const o = W + 1.2; s.position.set(p.x + R.x * sd * o, p.y + 2.2, p.z + R.z * sd * o); s.rotation.y = Math.atan2(T.x, T.z) + Math.PI; group.add(s);
    }
  }
  // ---------- agua ----------
  if (E.water !== undefined) {
    const wg = new THREE.PlaneGeometry(size * 1.6, size * 1.6);
    const sh = { ...waterShader, uniforms: THREE.UniformsUtils.clone(waterShader.uniforms) };
    const res = Math.max(256, Math.round(Math.min(innerWidth, 1920) * Q.refl));
    const w = new Reflector(wg, { textureWidth: res, textureHeight: Math.round(res * innerHeight / innerWidth), clipBias: 0.003, shader: sh });
    w.rotation.x = -Math.PI / 2; w.position.set(cx, E.water, cz);
    const u = w.material.uniforms; u.sunC.value.set(E.sunCol).multiplyScalar(E.sunI * 0.8); u.sunD.value.copy(sunDir); u.fogC.value.copy(scene.fog.color); u.fogD.value = scene.fog.density;
    u.deep.value.set(theme === 'bay' ? 0x06202a : 0x0a1a24);
    group.add(w); track.waters.push(w);
  }
  if (E.wet > 0.5 && theme === 'city' && Q.refl > 0.3) {
    const pg = new THREE.PlaneGeometry(size, size);
    const sh = { ...puddleShader, uniforms: THREE.UniformsUtils.clone(puddleShader.uniforms) };
    const res = Math.round(Math.min(innerWidth, 1920) * Q.refl * 0.8);
    const w = new Reflector(pg, { textureWidth: res, textureHeight: Math.round(res * innerHeight / innerWidth), clipBias: 0.003, shader: sh });
    w.material.transparent = true; w.material.blending = THREE.AdditiveBlending; w.material.depthWrite = false;
    w.rotation.x = -Math.PI / 2; w.position.set(cx, 0.035, cz); w.renderOrder = 1;
    w.material.uniforms.amt.value = 0.55; w.material.uniforms.fogC.value.copy(scene.fog.color); w.material.uniforms.fogD.value = scene.fog.density;
    group.add(w); track.waters.push(w);
  }
  // ---------- mapa de entorno (reflejos en coches y asfalto) ----------
  {
    const cubeRT = new THREE.WebGLCubeRenderTarget(Q.env, { type: THREE.HalfFloatType });
    const cc = new THREE.CubeCamera(1, 3000, cubeRT);
    const p0 = P[Math.floor(n / 3)]; cc.position.set(p0.x, p0.y + 6, p0.z);
    track.waters.forEach(w => w.visible = false);
    skyFollow(cc.position); cc.update(renderer, scene);
    track.waters.forEach(w => w.visible = true);
    const pm = new THREE.PMREMGenerator(renderer);
    if (envRT) envRT.dispose();
    envRT = pm.fromCubemap(cubeRT.texture); pm.dispose(); cubeRT.dispose();
    scene.environment = envRT.texture;
  }
  // minimapa: puntos 2D normalizados
  {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of P) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    track.mm = { x0, z0, s: 1 / Math.max(x1 - x0, z1 - z0), w: (x1 - x0), h: (z1 - z0) };
  }
  return track;
}

// ---------- ciudad (edificios, letreros, ciudad de fondo) ----------
function buildCity(group, def, neon, rng, clearOf, highway) {
  const buckets = new Map(), ePos = [], eCol = [];
  const words = ['NEON', 'APEX', 'TURBO', 'HOTEL', 'CLUB', 'RAMEN', '24H', 'ARCADE', 'GARAJE', 'MOTEL', 'KARAOKE', 'BAR', 'DISCO'];
  const signs = [];
  const add = (x, z, w, d, h, ci, y0 = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
    const ox = Math.floor(rng() * 16) / 16, oy = Math.floor(rng() * 16) / 16;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; if (f === 2 || f === 3) { uv.setXY(i, 0.004, 0.004); continue; } const span = f < 2 ? d : w; uv.setXY(i, uv.getX(i) * span / 32 + ox, uv.getY(i) * h / 32 + oy); }
    geo.translate(x, y0 + h / 2, z);
    if (!buckets.has(ci)) buckets.set(ci, []); buckets.get(ci).push(geo);
    const eg = new THREE.EdgesGeometry(geo), p = eg.attributes.position.array, c = neon[ci % neon.length];
    for (let i = 0; i < p.length; i += 3) { ePos.push(p[i], p[i + 1], p[i + 2]); eCol.push(c.r * 1.6, c.g * 1.6, c.b * 1.6); }
    eg.dispose();
    if (rng() < 0.25) signs.push({ word: words[Math.floor(rng() * words.length)], hex: neon[Math.floor(rng() * neon.length)].getHex(), x, z, y: y0 + h + 0.4 + Math.min(w, d) * 0.22, s: Math.min(w, d), r: Math.floor(rng() * 4) * Math.PI / 2 });
  };
  const n = track.n, P = track.P, W = track.wall, dense = Q.dense;
  // fila de edificios a los lados del circuito
  for (let i = 0; i < n; i += Math.round(7 / dense)) {
    const p = P[i], R = track.R[i];
    for (const sd of [-1, 1]) {
      const off = W + (highway ? 18 : 7) + rng() * 16, w = 10 + rng() * 14, d = 10 + rng() * 14;
      const x = p.x + R.x * sd * (off + w / 2), z = p.z + R.z * sd * (off + d / 2);
      if (!clearOf(x, z, Math.max(w, d) * 0.75)) continue;
      const h = highway ? 6 + rng() * 40 + (rng() < 0.15 ? 50 : 0) : 14 + rng() * 45 + (rng() < 0.18 ? 45 : 0);
      add(x, z, w, d, h, Math.floor(rng() * 3));
    }
  }
  // relleno: bloques en una cuadrícula alrededor
  const c = track.center, S = track.size * 0.5;
  for (let x = c.x - S; x < c.x + S; x += 34 / Math.sqrt(dense)) for (let z = c.z - S; z < c.z + S; z += 34 / Math.sqrt(dense)) {
    if (rng() < 0.25) continue;
    const w = 12 + rng() * 14, d = 12 + rng() * 14;
    if (!clearOf(x, z, Math.max(w, d) * 0.8)) continue;
    const far = Math.hypot(x - c.x, z - c.z) / S;
    add(x, z, w, d, 8 + rng() * (highway ? 30 : 55) * (1.1 - far * 0.5) + (rng() < 0.08 ? 60 : 0), Math.floor(rng() * 3));
  }
  // horizonte lejano
  for (let k = 0; k < 90; k++) {
    const a = rng() * Math.PI * 2, r = S + 150 + rng() * 500;
    add(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 30 + rng() * 40, 30 + rng() * 40, 40 + rng() * 160, Math.floor(rng() * 3));
  }
  const mats = [0, 1, 2].map(i => new THREE.MeshStandardMaterial({ color: 0x0a0912, roughness: 0.35, metalness: 0.7, emissive: neon[i % neon.length], emissiveMap: windowTex(11 + i), emissiveIntensity: 1.3, envMapIntensity: 0.6 }));
  for (const [ci, geos] of buckets) { const m = new THREE.Mesh(mergeGeometries(geos), mats[ci]); m.castShadow = m.receiveShadow = true; group.add(m); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3)); eg.setAttribute('color', new THREE.Float32BufferAttribute(eCol, 3));
  group.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ vertexColors: true })));
  for (const s of signs.slice(0, 120)) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.s * 0.9, s.s * 0.35), new THREE.MeshBasicMaterial({ map: signTex(s.word, s.hex), transparent: true, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(2, 2, 2) }));
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.r; group.add(m);
  }
  // vallas publicitarias junto a la pista
  for (let i = 0; i < n; i += 90) {
    const p = P[i], R = track.R[i], T = track.T[i], sd = i % 180 ? 1 : -1, o = W + 4;
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.5), new THREE.MeshBasicMaterial({ map: signTex(words[i % words.length], neon[i % neon.length].getHex()), transparent: true, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(2.2, 2.2, 2.2) }));
    bb.position.set(p.x + R.x * sd * o, p.y + 6, p.z + R.z * sd * o); bb.rotation.y = Math.atan2(T.x, T.z) + Math.PI / 2 * sd + Math.PI / 2 * sd; group.add(bb);
  }
}

// ---------- bahía: grúas, contenedores, faro, barcos, ciudad lejana ----------
function buildBay(group, def, neon, rng, clearOf, terrainH) {
  const n = track.n, P = track.P, W = track.wall, c = track.center, S = track.size * 0.5;
  const cont = [], crane = [], boats = [];
  const cols = [0xd04030, 0x2a6ad0, 0xe0a020, 0x30a060, 0xa040c0].map(h => new THREE.Color(h));
  const contGeo = new THREE.BoxGeometry(6, 2.6, 2.4);
  const cm = new THREE.InstancedMesh(contGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }), 400);
  let ci = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n && ci < 380; i += 14) {
    const p = P[i]; if (p.y > 3) continue;
    const R = track.R[i];
    for (const sd of [-1, 1]) {
      if (rng() < 0.5) continue;
      const off = W + 8 + rng() * 25, x = p.x + R.x * sd * off, z = p.z + R.z * sd * off, g = terrainH(x, z);
      if (g < -1 || !clearOf(x, z, 8)) continue;
      const h = Math.atan2(track.T[i].x, track.T[i].z) + (rng() < 0.3 ? Math.PI / 2 : 0), st = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < st && ci < 380; k++) { e.set(0, h, 0); q.setFromEuler(e); m4.compose(new V3(x, g + 1.3 + k * 2.6, z), q, new V3(1, 1, 1)); cm.setMatrixAt(ci, m4); cm.setColorAt(ci, cols[Math.floor(rng() * cols.length)]); ci++; }
      if (rng() < 0.12) crane.push([x + R.x * sd * 10, g, z + R.z * sd * 10, h]);
    }
  }
  cm.count = ci; cm.castShadow = cm.receiveShadow = true; group.add(cm);
  const steel = new THREE.MeshStandardMaterial({ color: 0xd88a20, roughness: 0.5, metalness: 0.6 });
  for (const [x, g, z, h] of crane.slice(0, 8)) {
    const cr = new THREE.Group(); cr.position.set(x, g, z); cr.rotation.y = h;
    for (const sx of [-3, 3]) for (const sz of [-3, 3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 26, 0.7), steel); l.position.set(sx, 13, sz); l.castShadow = true; cr.add(l); }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 46), steel); arm.position.set(0, 27, 8); arm.castShadow = true; cr.add(arm);
    const lt = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2) })); lt.position.set(0, 28.2, 31); cr.add(lt);
    group.add(cr);
  }
  // faro
  {
    let best = null; for (let k = 0; k < 400; k++) { const x = c.x + (rng() - 0.5) * S * 1.4, z = c.z + (rng() - 0.5) * S * 1.4, g = terrainH(x, z); if (g > 2 && clearOf(x, z, 20)) { best = [x, g, z]; break; } }
    if (best) {
      const f = new THREE.Group(); f.position.set(...best);
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 26, 16), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 })); tw.position.y = 13; tw.castShadow = true; f.add(tw);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(2.25 - k * 0.22, 2.4 - k * 0.22, 2.6, 16), new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.5 })); b.position.y = 5 + k * 7; f.add(b); }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5, 3) })); lamp.position.y = 27.5; f.add(lamp);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(8, 120, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.45, 0.3), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.geometry.translate(0, -60, 0); beam.rotation.z = Math.PI / 2; const piv = new THREE.Group(); piv.position.y = 27.5; piv.add(beam); f.add(piv);
      group.add(f); track.lighthouse = piv;
    }
  }
  // barcos
  const hull = new THREE.MeshStandardMaterial({ color: 0xf2f2f8, roughness: 0.4, metalness: 0.2 });
  for (let k = 0; k < 14; k++) {
    const x = c.x + (rng() - 0.5) * S * 2, z = c.z + (rng() - 0.5) * S * 2;
    if (terrainH(x, z) > -6 || !clearOf(x, z, 20)) continue;
    const b = new THREE.Group(); b.position.set(x, -4, z); b.rotation.y = rng() * 7;
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12), hull); h1.position.y = 0.5; b.add(h1);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 4), hull); cab.position.set(0, 2.1, -1); b.add(cab);
    const lt = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.3, 4.05), new THREE.MeshBasicMaterial({ color: neon[k % 3].clone().multiplyScalar(2.5) })); lt.position.set(0, 2.6, -1); b.add(lt);
    b.traverse(o => o.castShadow = true); group.add(b); boats.push(b);
  }
  track.boats = boats;
  // ciudad lejana al otro lado de la bahía
  const sk = [];
  for (let k = 0; k < 140; k++) {
    const a = -0.6 + rng() * 1.6, r = S + 350 + rng() * 300, w = 20 + rng() * 40, h = 30 + rng() * 170;
    const g = new THREE.BoxGeometry(w, h, w); g.translate(c.x + Math.cos(a + Math.PI) * r, h / 2 - 4, c.z + Math.sin(a + Math.PI) * r); sk.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(sk), new THREE.MeshStandardMaterial({ color: 0x2a2040, emissive: 0xffb070, emissiveMap: windowTex(21, 0.3), emissiveIntensity: 0.6, roughness: 0.6 })));
}

// ---------- naturaleza: rocas, cactus, pinos ----------
function buildNature(group, def, rng, clearOf, terrainH, theme) {
  const c = track.center, S = track.size * 0.5, dense = Q.dense;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  if (theme === 'canyon') {
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x9a5030, roughness: 0.95, flatShading: true }), 700);
    const cact = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.6, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.8 }), 400);
    let r = 0, k = 0;
    for (let t = 0; t < 4000 && (r < 700 || k < 400); t++) {
      const x = c.x + (rng() - 0.5) * S * 2, z = c.z + (rng() - 0.5) * S * 2;
      if (!clearOf(x, z, 4)) continue;
      const y = terrainH(x, z);
      if (rng() < 0.6 * dense && r < 700) { const s = 1 + rng() * rng() * 9; e.set(rng() * 3, rng() * 3, rng() * 3); q.setFromEuler(e); m4.compose(new V3(x, y + s * 0.3, z), q, new V3(s, s * (0.6 + rng() * 0.6), s)); rocks.setMatrixAt(r++, m4); }
      else if (k < 400 && rng() < dense) { const h = 3 + rng() * 5; m4.compose(new V3(x, y + h / 2, z), q.identity(), new V3(1, h, 1)); cact.setMatrixAt(k++, m4); }
    }
    rocks.count = r; cact.count = k; rocks.castShadow = rocks.receiveShadow = cact.castShadow = true; group.add(rocks, cact);
    // mesetas lejanas
    const mes = [];
    for (let t = 0; t < 26; t++) { const a = rng() * 7, d = S * 0.7 + rng() * S, rr = 30 + rng() * 70, h = 60 + rng() * 90; const g = new THREE.CylinderGeometry(rr * 0.85, rr, h, 9); g.translate(c.x + Math.cos(a) * d, h / 2 - 5, c.z + Math.sin(a) * d); if (clearOf(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, rr + 10)) mes.push(g); }
    if (mes.length) { const m = new THREE.Mesh(mergeGeometries(mes), new THREE.MeshStandardMaterial({ color: 0xb05a30, roughness: 0.95, flatShading: true })); m.castShadow = m.receiveShadow = true; group.add(m); }
  } else {
    const N2 = Math.round(1800 * dense);
    const pine = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 8, 7), new THREE.MeshStandardMaterial({ color: 0x1e4a32, roughness: 0.9, flatShading: true }), N2);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 }), N2);
    let k = 0;
    for (let t = 0; t < N2 * 4 && k < N2; t++) {
      const x = c.x + (rng() - 0.5) * S * 2, z = c.z + (rng() - 0.5) * S * 2, y = terrainH(x, z);
      if (y < (def.env.water ?? -99) + 0.5 || y > 45 || !clearOf(x, z, 3)) continue;
      const s = 0.7 + rng() * 0.9; m4.compose(new V3(x, y + 1.2 * s + 4 * s, z), q.identity(), new V3(s, s, s)); pine.setMatrixAt(k, m4);
      m4.compose(new V3(x, y + 1.2 * s, z), q, new V3(s, s, s)); trunk.setMatrixAt(k, m4); k++;
    }
    pine.count = trunk.count = k; pine.castShadow = trunk.castShadow = true; pine.receiveShadow = true; group.add(pine, trunk);
  }
}

// ---------- farolas ----------
function buildLamps(group, def, neon, theme) {
  const n = track.n, P = track.P, W = track.wall, list = [];
  const every = theme === 'canyon' ? 0 : theme === 'mountain' ? 34 : 18;
  if (!every) return;
  for (let i = 0; i < n; i += every) list.push([i, (i / every) % 2 ? 1 : -1]);
  const pole = new THREE.CylinderGeometry(0.12, 0.18, 8, 6); pole.translate(0, 4, 0);
  const head = new THREE.BoxGeometry(0.5, 0.2, 3); head.translate(0, 7.9, 1.4);
  const pm = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0x24222e, metalness: 0.8, roughness: 0.4 }), list.length);
  const hm = new THREE.InstancedMesh(head, new THREE.MeshBasicMaterial({ color: 0xffffff }), list.length);
  const pool = new THREE.PlaneGeometry(12, 12); pool.rotateX(-Math.PI / 2);
  const gm = new THREE.InstancedMesh(pool, new THREE.MeshBasicMaterial({ map: radialTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), one = new V3(1, 1, 1);
  const night = def.env.stars;
  list.forEach(([i, sd], k) => {
    const p = P[i], R = track.R[i], o = W + 1.2;
    const x = p.x + R.x * sd * o, z = p.z + R.z * sd * o;
    q.setFromAxisAngle(new V3(0, 1, 0), Math.atan2(-R.x * sd, -R.z * sd));
    m4.compose(new V3(x, p.y, z), q, one); pm.setMatrixAt(k, m4); hm.setMatrixAt(k, m4);
    const lc = neon[k % neon.length]; hm.setColorAt(k, c.copy(lc).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(night ? 3 : 1.2));
    m4.makeTranslation(p.x + R.x * sd * (o - 3.5), p.y + 0.07, p.z + R.z * sd * (o - 3.5)); gm.setMatrixAt(k, m4);
    gm.setColorAt(k, c.copy(lc).lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(night ? 0.35 : 0));
  });
  pm.castShadow = true; group.add(pm, hm); if (night) group.add(gm);
}

export function updateTrack(dt, t) {
  for (const w of track.waters) if (w.material.uniforms.time) w.material.uniforms.time.value = t;
  if (track.boostMat) track.boostMat.map.offset.y = -t * 1.6;
  if (track.lighthouse) track.lighthouse.rotation.y = t * 0.8;
  if (track.boats) track.boats.forEach((b, i) => { b.position.y = -4 + Math.sin(t * 1.3 + i) * 0.25; b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.04; });
}
