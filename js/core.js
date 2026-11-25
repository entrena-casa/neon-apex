// Núcleo: render, escena, calidad gráfica, utilidades, texturas, partículas y lluvia
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
export { THREE };

export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const wrapAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const V3 = THREE.Vector3;
export const isTouch = matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover:none)').matches);
export const fmtTime = t => { if (!isFinite(t) || t <= 0) return '--:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(3).padStart(6, '0')}`; };
export const G = { t: 0, shake: 0 };

// ================== CALIDAD ==================
export const QUALITY = (() => { try { return localStorage.getItem('apex.q'); } catch (e) { return null; } })() || (isTouch ? 'baja' : 'alta');
export const Q = {
  ultra: { pr: 2, shadow: 4096, refl: 0.6, samples: 4, env: 256, dense: 1 },
  alta: { pr: 1.75, shadow: 2048, refl: 0.5, samples: 4, env: 256, dense: 1 },
  media: { pr: 1.25, shadow: 1024, refl: 0.33, samples: 2, env: 128, dense: 0.7 },
  baja: { pr: 1, shadow: 0, refl: 0.25, samples: 0, env: 64, dense: 0.45 },
}[QUALITY] || { pr: 1, shadow: 0, refl: 0.25, samples: 0, env: 64, dense: 0.45 };
export function setQuality(q) { try { localStorage.setItem('apex.q', q); } catch (e) {} location.reload(); }

// ================== RENDER ==================
export const canvas = $('game');
let _r;
try { _r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { throw new Error('tu navegador no deja usar gráficos 3D (WebGL). Activa la aceleración por hardware o prueba con Chrome/Safari actualizados.'); }
export const renderer = _r;
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
if (Q.shadow) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x16062e, 0.002);
export const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 5000);

const pr = renderer.getPixelRatio();
export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: Q.samples }));
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.5, 0.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ================== LUCES ==================
export const hemi = new THREE.HemisphereLight(0x6a48ff, 0x12002a, 0.7); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(sun, sun.target);
if (Q.shadow) {
  sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.near = 1; sc.far = 800;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
}
export const sunDir = new V3(0.4, 0.7, 0.3).normalize();
const _sp = new V3();
// la sombra sigue al coche (con ajuste a texel para que no tiemble)
export function followShadow(p) {
  const tx = 140 / (Q.shadow || 1024);
  _sp.set(Math.round(p.x / tx) * tx, Math.round(p.y / tx) * tx, Math.round(p.z / tx) * tx);
  sun.target.position.copy(_sp); sun.position.copy(_sp).addScaledVector(sunDir, 400);
}

// ================== TEXTURAS ==================
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
export const radialTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
export const dotTex = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
export const hexCss = hex => '#' + hex.toString(16).padStart(6, '0');
const signCache = {};
export function signTex(word, hex, frame = true) {
  const k = word + hex + frame; if (signCache[k]) return signCache[k];
  const col = hexCss(hex);
  return signCache[k] = canvasTex(512, 200, (g, w, h) => {
    let fs = 120; g.font = `900 ${fs}px Orbitron, Arial Black, sans-serif`;
    while (g.measureText(word).width > w - 70 && fs > 30) { fs -= 6; g.font = `900 ${fs}px Orbitron, Arial Black, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = 30; g.strokeStyle = col; g.lineWidth = 8;
    if (frame) g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) g.fillText(word, w / 2, h / 2 + 6);
  });
}
export function labelTex(text, hex) {
  const col = hexCss(hex);
  return canvasTex(512, 96, (g, w, h) => {
    g.font = '700 50px Orbitron, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = '#fff';
    g.fillText(text, w / 2, h / 2 + 3); g.fillText(text, w / 2, h / 2 + 3);
  });
}

// ================== PARTÍCULAS ==================
const MAXP = isTouch ? 1500 : 4000;
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
const pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP), pGrav = new Float32Array(MAXP), pBase = new Float32Array(MAXP * 3), pFloor = new Float32Array(MAXP);
let pIdx = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.55, map: dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
pts.frustumCulled = false; scene.add(pts);
// humo (normal, no aditivo)
const SMOKE = isTouch ? 250 : 700;
const sPos = new Float32Array(SMOKE * 3), sVel = new Float32Array(SMOKE * 3), sLife = new Float32Array(SMOKE), sMax = new Float32Array(SMOKE), sAlpha = new Float32Array(SMOKE), sSize = new Float32Array(SMOKE);
let sIdx = 0;
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1)); sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
export const smokeMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { map: { value: radialTex }, color: { value: new THREE.Color(0.75, 0.72, 0.8) }, scale: { value: innerHeight / 2 } },
  vertexShader: `attribute float alpha; attribute float size; varying float vA; uniform float scale;
    void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
    void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * vA); }`
});
const smoke = new THREE.Points(sGeo, smokeMat); smoke.frustumCulled = false; scene.add(smoke);
addEventListener('resize', () => smokeMat.uniforms.scale.value = innerHeight / 2);

export function emit(x, y, z, vx, vy, vz, r, g, b, life, grav = 18) {
  const i = pIdx; pIdx = (pIdx + 1) % MAXP;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
  pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pBase[i * 3] = r; pBase[i * 3 + 1] = g; pBase[i * 3 + 2] = b;
  pLife[i] = life; pMax[i] = life; pGrav[i] = grav; pFloor[i] = y - 1.2;
}
export function burst(p, n, r, g, b, speed, life, grav = 18, up = 6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    emit(p.x, p.y, p.z, Math.cos(a) * s, up * Math.random() + 2, Math.sin(a) * s, r, g, b, life * (0.5 + Math.random() * 0.5), grav);
  }
}
export function puff(x, y, z, vx, vy, vz, size, life, alpha = 0.5) {
  const i = sIdx; sIdx = (sIdx + 1) % SMOKE;
  sPos[i * 3] = x; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = z; sVel[i * 3] = vx; sVel[i * 3 + 1] = vy; sVel[i * 3 + 2] = vz;
  sLife[i] = life; sMax[i] = life; sSize[i] = size; sAlpha[i] = alpha;
}
export function clearParticles() { pLife.fill(0); sLife.fill(0); sAlpha.fill(0); }
export function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    const o = i * 3;
    if (pLife[i] <= 0) { pCol[o] = pCol[o + 1] = pCol[o + 2] = 0; continue; }
    pLife[i] -= dt; pVel[o + 1] -= pGrav[i] * dt;
    const drag = Math.exp(-1.8 * dt); pVel[o] *= drag; pVel[o + 2] *= drag;
    pPos[o] += pVel[o] * dt; pPos[o + 1] += pVel[o + 1] * dt; pPos[o + 2] += pVel[o + 2] * dt;
    if (pPos[o + 1] < pFloor[i]) { pPos[o + 1] = pFloor[i]; pVel[o + 1] *= -0.4; }
    const k = Math.max(0, pLife[i] / pMax[i]);
    pCol[o] = pBase[o] * k; pCol[o + 1] = pBase[o + 1] * k; pCol[o + 2] = pBase[o + 2] * k;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  for (let i = 0; i < SMOKE; i++) {
    if (sLife[i] <= 0) { sAlpha[i] = 0; continue; }
    const o = i * 3; sLife[i] -= dt;
    const d = Math.exp(-1.5 * dt); sVel[o] *= d; sVel[o + 1] = sVel[o + 1] * d + 0.8 * dt; sVel[o + 2] *= d;
    sPos[o] += sVel[o] * dt; sPos[o + 1] += sVel[o + 1] * dt; sPos[o + 2] += sVel[o + 2] * dt;
    const k = sLife[i] / sMax[i]; sSize[i] += dt * 6; sAlpha[i] = Math.max(0, k * k * 0.45);
  }
  sGeo.attributes.position.needsUpdate = true; sGeo.attributes.alpha.needsUpdate = true; sGeo.attributes.size.needsUpdate = true;
}

// ================== LLUVIA ==================
const RAIN = isTouch ? 1500 : 4500;
const rainPos = new Float32Array(RAIN * 6);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
export const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa8b4ff, transparent: true, opacity: 0.32, depthWrite: false }));
rain.frustumCulled = false; scene.add(rain); rain.visible = false;
for (let i = 0; i < RAIN; i++) { rainPos[i * 6] = (Math.random() - 0.5) * 120; rainPos[i * 6 + 1] = Math.random() * 50; rainPos[i * 6 + 2] = (Math.random() - 0.5) * 120; }
export function updateRain(dt, c, k, vx = 0, vz = 0) {
  rain.visible = k > 0; if (!k) return;
  const n = Math.floor(RAIN * k); rainGeo.setDrawRange(0, n * 2);
  for (let i = 0; i < n; i++) {
    const o = i * 6; let x = rainPos[o] - vx * dt * 0.3, y = rainPos[o + 1] - 75 * dt, z = rainPos[o + 2] - vz * dt * 0.3;
    if (y < c.y - 8 || Math.abs(x - c.x) > 60 || Math.abs(z - c.z) > 60) { y = c.y + 15 + Math.random() * 30; x = c.x + (Math.random() - 0.5) * 120; z = c.z + (Math.random() - 0.5) * 120; }
    rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + vx * 0.012; rainPos[o + 4] = y + 1.5; rainPos[o + 5] = z + vz * 0.012;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// ================== TEXTOS ==================
let msgTimer = 0;
export function showMsg(text, color = '#fff', dur = 1.6, big = false) {
  const m = $('msg'); m.textContent = text; m.style.color = color; m.style.textShadow = `0 0 10px ${color},0 0 30px ${color}`;
  m.classList.toggle('big', big); m.classList.toggle('show', !!text); msgTimer = dur;
}
export function updateMsg(dt) { if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('msg').classList.remove('show'); } }
let toastT = null;
export function toast(html, ms = 2600) {
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
export function popup(text, color = '#fff') {
  const d = document.createElement('div'); d.className = 'pop'; d.textContent = text;
  d.style.color = color; d.style.textShadow = `0 0 8px ${color},0 0 20px ${color}`;
  $('pops').appendChild(d); setTimeout(() => d.remove(), 1400);
}
