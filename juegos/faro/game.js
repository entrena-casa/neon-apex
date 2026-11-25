// FARO 13 — aventura de misterio (señalar y tocar). Lienzo virtual de 960×540.
import { $, clamp, lerp, rnd, store, toast, setupCanvas, loop, sfx, SONGS, Particles, glowDot, backButton, usingTouch } from '../../comun/lib.js';
import { dialog, chapter, talking } from '../../comun/story.js';

const cv = $('c'), S = setupCanvas(cv), ctx = S.ctx, fx = new Particles(400);
backButton();
const VW = 960, VH = 540;
const V = { who: 'VERA', col: '#00f0ff' }, E = { who: 'ELÍAS', col: '#ffd200' }, NAR = { who: '', col: '#b9a8e8' };
const say = (w, txt, choices) => ({ ...w, txt, choices });
const ITEMS = { llave: { ic: '🗝', name: 'LLAVE' }, fusible: { ic: '🔌', name: 'FUSIBLE' }, palanca: { ic: '🔧', name: 'PALANCA' }, linterna: { ic: '🔦', name: 'LINTERNA' } };
const PLACES = { muelle: 'EL MUELLE', entrada: 'LA PUERTA DEL FARO', sala: 'SALA DE MÁQUINAS', biblio: 'EL ESTUDIO DE ELÍAS', escalera: 'LA ESCALERA', linterna: 'LA LINTERNA', sotano: 'EL SÓTANO' };
const blank = () => ({ at: 'muelle', inv: [], f: {}, pages: [], lens: [2, 0, 3, 1] });
let st = Object.assign(blank(), store.get('faro.save', {}));
const persist = () => store.set('faro.save', st);
let sel = null, screen = 'menu', hover = null, busy = false, fade = 0;
if (store.get('faro.save', null)) { $('bPlay').textContent = 'CONTINUAR'; $('bNew').classList.remove('hidden'); }

// ================== HISTORIA ==================
const PAGE_TXT = [
  'Página 1 — «Vera: si lees esto, has venido. Sabía que vendrías. El faro guarda la respuesta. Empieza por la luz.»',
  'Página 2 — «Trece años apagado. Me obligaron a apagarlo. Pero un faro apagado también es un mensaje.»',
  'Página 3 — «Los contrabandistas usaban la Roca 13 para esconderse. Si la luz la alumbra, se acabó su escondite.»',
  'Página 4 — «Mi orden de colores: el del mar, el del atardecer, el del sol y el de la isla.»',
  'Página 5 — «Si todo sale mal, estaré en la vieja barca, junto a la Roca 13. Haz la señal: un destello, una pausa, tres destellos.»',
];
async function gotPage(n) { if (st.pages.includes(n)) return; st.pages.push(n); persist(); sfx.play('coin'); updateHud(); await dialog([say(NAR, 'Has encontrado una página del diario de Elías.'), say(E, PAGE_TXT[n])]); }
function give(id) { if (!st.inv.includes(id)) { st.inv.push(id); persist(); sfx.play('pick'); updateHud(); toast(`${ITEMS[id].ic} Tienes: <b>${ITEMS[id].name}</b>`, 1600); } }
function take(id) { st.inv = st.inv.filter(i => i !== id); if (sel === id) sel = null; persist(); updateHud(); }
async function go(place) { if (busy) return; fade = 1; sfx.play('step'); setTimeout(() => { st.at = place; persist(); updateHud(); }, 180); }
const using = id => sel === id;
async function wrongItem() { await dialog([say(V, 'Eso no sirve aquí.')]); sel = null; updateHud(); }

// ================== ESCENAS ==================
// cada zona: [x, y, w, h, etiqueta, acción, visible?]
const SCENES = {
  muelle: {
    draw(t) { sea(t, 330); moon(780, 90); lighthouse(560, 330, 0.9, t); dock(); boat(200, 360, t); buoy(820, 380, t); },
    spots: [
      [130, 320, 170, 90, 'BARCA', async () => { if (!st.f.boat) { st.f.boat = 1; await dialog([say(V, 'La barca de mi abuelo. Está medio hundida…'), say(V, 'Hay algo brillando bajo el asiento.')]); give('llave'); } else await dialog([say(V, 'La vieja barca. Elías la llamaba «Esperanza».')]); }],
      [790, 340, 70, 90, 'BOYA', async () => { await dialog([say(V, 'Una boya con un número pintado: 13. Como el faro. Como la roca que se ve a lo lejos.')]); }],
      [470, 140, 180, 200, 'EL FARO', async () => { await dialog([say(V, 'Faro 13. Lleva trece años apagado. Mi abuelo desapareció la noche que se apagó.')]); }],
      [600, 400, 200, 80, 'CAMINO AL FARO ▶', () => go('entrada')],
    ] },
  entrada: {
    draw(t) { nightSky(t); lighthouse(480, 520, 2.1, t, true); stone(); mailbox(180, 380); if (!st.f.door) chain(480, 400); },
    spots: [
      [420, 290, 120, 190, 'PUERTA', async () => { if (st.f.door) return go('sala'); if (using('llave')) { st.f.door = 1; take('llave'); sfx.play('click'); await dialog([say(V, 'La llave gira con un crujido. ¡Abierta!')]); } else if (sel) wrongItem(); else await dialog([say(V, 'Cerrada con un candado oxidado.')]); }],
      [150, 330, 70, 90, 'BUZÓN', async () => { if (!st.f.mail) { st.f.mail = 1; await dialog([say(V, 'Dentro hay una hoja doblada con mi nombre.')]); await gotPage(0); } else await dialog([say(V, 'Vacío.')]); }],
      [610, 250, 120, 70, 'PLACA', async () => { await dialog([say(V, 'Una placa grabada: «LA LUZ CUENTA LO QUE EL MAR CALLA».')]); }],
      [20, 440, 180, 80, '◀ VOLVER AL MUELLE', () => go('muelle')],
    ] },
  sala: {
    draw(t) { room('#0c1424', t); generator(250, 300, t); trapdoor(600, 440); stairsDoor(820, 200); door(80, 200, '#ffd200'); },
    spots: [
      [180, 230, 160, 160, 'GENERADOR', async () => { if (st.f.power) return dialog([say(V, 'Zumba suavemente. Hay luz en todo el faro.')]); if (using('fusible')) { st.f.power = 1; take('fusible'); sfx.play('power'); await dialog([say(V, 'El fusible encaja… ¡CLAC! Las luces se encienden una a una.')]); } else if (sel) wrongItem(); else await dialog([say(V, 'Un generador viejo. Le falta un fusible.')]); }],
      [540, 410, 130, 70, 'TRAMPILLA', async () => { if (st.f.trap) return go('sotano'); if (using('palanca')) { st.f.trap = 1; take('palanca'); sfx.play('hit'); await dialog([say(V, 'Hago palanca… ¡y la trampilla se abre! Hay una escalera hacia abajo.')]); } else if (sel) wrongItem(); else await dialog([say(V, 'Una trampilla atascada. Necesito algo para hacer palanca.')]); }],
      [770, 160, 120, 230, 'ESCALERA ▲', async () => { if (!st.f.power) return dialog([say(V, 'Está todo oscuro ahí arriba. Sin luz no subo.')]); go('escalera'); }],
      [40, 170, 110, 220, '◀ ESTUDIO', () => go('biblio')],
      [380, 470, 200, 60, '▼ SALIR', () => go('entrada')],
    ] },
  biblio: {
    draw(t) { room('#140c20', t); shelf(90, 120); painting(420, 110, t); desk(620, 320); globe(860, 330, t); },
    spots: [
      [80, 110, 220, 300, 'ESTANTERÍA', async () => { if (!st.f.shelf) { st.f.shelf = 1; await dialog([say(V, 'Libros de navegación… y uno sin título. Entre sus páginas hay una suelta.')]); await gotPage(1); } else await dialog([say(V, 'Cartas náuticas, nudos marineros y novelas de piratas. Típico de él.')]); }],
      [400, 90, 260, 170, 'CUADRO', async () => { await dialog([say(V, 'Tres barcos en fila. El primero lleva 4 banderas, el segundo 1 y el tercero 7.'), say(V, 'Debajo pone: «En orden, como zarpan».')]); }],
      [600, 300, 220, 130, 'ESCRITORIO', async () => { if (st.f.drawer) return dialog([say(V, 'El cajón ya está abierto y vacío.')]); const ok = await codeLock(); if (ok) { st.f.drawer = 1; sfx.play('win'); await dialog([say(V, '¡4-1-7! El cajón se abre.')]); give('fusible'); await gotPage(2); } }],
      [830, 290, 80, 110, 'GLOBO', async () => { await dialog([say(V, 'Un globo terráqueo. Alguien ha dibujado una islita con un 13 en medio del mar.')]); }],
      [860, 440, 100, 90, 'SALA ▶', () => go('sala')],
    ] },
  escalera: {
    draw(t) { spiral(t); if (!st.f.bar) crowbar(300, 420); seaWindow(680, 150, t); },
    spots: [
      [260, 400, 120, 50, 'PALANCA', async () => { st.f.bar = 1; give('palanca'); await dialog([say(V, 'Una palanca de hierro olvidada en un escalón.')]); }, () => !st.f.bar],
      [640, 120, 160, 170, 'VENTANA', async () => { await dialog([say(V, 'A lo lejos se ve la Roca 13… y una lucecita que parpadea junto a ella. ¿Una barca?')]); }],
      [420, 40, 140, 120, 'SUBIR ▲', () => go('linterna')],
      [400, 460, 180, 70, '▼ BAJAR', () => go('sala')],
    ] },
  linterna: {
    draw(t) { lamp(t); if (!st.pages.includes(3)) paper(160, 440); },
    spots: [
      [130, 420, 90, 50, 'PAPEL', async () => { await gotPage(3); }, () => !st.pages.includes(3)],
      ...[0, 1, 2, 3].map(i => [330 + i * 80, 200, 70, 150, 'CRISTAL ' + (i + 1), async () => { if (st.f.lit) return; st.lens[i] = (st.lens[i] + 1) % 4; persist(); sfx.play('click'); checkLens(); }]),
      [400, 470, 180, 60, '▼ BAJAR', () => go('escalera')],
    ] },
  sotano: {
    draw(t) { room('#06100c', t); recorder(300, 330, t); seaMap(600, 110); radio(820, 360, t); },
    spots: [
      [230, 280, 160, 120, 'GRABADORA', async () => { await dialog([say(E, '(grabación) Si oyes esto, Vera, es que no he podido volver todavía.'), say(E, 'Los contrabandistas me vigilaban. Apagué el faro para que creyeran que me había rendido.'), say(E, 'Me escondí en la Roca 13 con la barca pequeña. Desde allí los vigilaba yo a ellos.')]); await gotPage(4); }],
      [560, 90, 300, 200, 'MAPA', async () => { await dialog([say(V, 'Un mapa con la Roca 13 marcada en rojo. Y una nota: «1 · 3».')]); }],
      [780, 320, 100, 100, 'RADIO', async () => { await dialog([say(V, 'Una radio antigua. Sólo se oye ruido… y, muy flojito, alguien tarareando la canción que me cantaba de pequeña.')]); }],
      [20, 60, 160, 120, '▲ SUBIR', () => go('sala')],
    ] },
};
const TARGET = [0, 1, 2, 3], LCOL = ['#00f0ff', '#ff2bd6', '#ffd200', '#39ff88'];
async function checkLens() {
  if (st.lens.every((c, i) => c === TARGET[i])) {
    if (!st.f.power) { await dialog([say(V, 'Los colores encajan… pero no hay corriente.')]); return; }
    st.f.lit = 1; persist(); sfx.play('goal'); fade = 0; await finale();
  }
}
async function finale() {
  busy = true; await new Promise(r => setTimeout(r, 1500));
  const all = st.pages.length >= 5;
  const opts = all ? ['Hacer la señal de Elías: un destello, pausa, tres destellos', 'Mandar un SOS', 'Apagar la luz'] : ['Mandar un SOS', 'Apagar la luz'];
  let c = await dialog([say(NAR, 'El faro se enciende por primera vez en trece años. El haz barre el mar y alumbra la Roca 13.'), say(V, '¿Qué señal hago?', opts)]);
  if (!all) c += 1;
  if (c === 0) { await dialog([say(NAR, 'Un destello. Pausa. Tres destellos.'), say(NAR, 'Junto a la roca, una linterna responde: un destello, pausa, tres destellos.'), say(E, '(por la radio) …¿Vera? ¿Eres tú, pequeña?'), say(V, '¡ABUELO! ¡Voy a por ti!')]); end('FINAL VERDADERO: LA SEÑAL', 'Reuniste las 5 páginas, entendiste el mensaje de Elías y lo trajiste a casa. El Faro 13 vuelve a brillar cada noche.'); }
  else if (c === 1) { await dialog([say(NAR, 'S-O-S. La guardia costera llega al amanecer y rodea la Roca 13.'), say(NAR, 'Encuentran a los contrabandistas… y a un anciano que sonríe al verte en el muelle.')]); end('FINAL: AMANECER', 'Elías está a salvo, aunque nunca sabrás todo lo que vivió esos trece años. (Hay un final con todas las páginas del diario…)'); }
  else { await dialog([say(NAR, 'Apagas la luz. El mar vuelve a quedarse a oscuras.'), say(V, 'Quizá algunos secretos deban seguir en el mar…'), say(NAR, 'Esa noche, en la radio del sótano, alguien sigue tarareando.')]); end('FINAL: EL SILENCIO', 'Dejaste el faro apagado. Hay otras formas de terminar esta historia.'); }
}
function end(t, s) { busy = false; st.ended = (st.ended || 0) + 1; persist(); $('oTitle').textContent = t; $('oSub').textContent = s; show('over'); sfx.music(SONGS.calm); }

// ================== CANDADO DE NÚMEROS ==================
function codeLock() {
  return new Promise(res => {
    const el = $('code'), d = [0, 0, 0]; el.classList.remove('hidden');
    const render = () => { el.innerHTML = `<div class="panel"><div style="letter-spacing:3px">CANDADO DE 3 NÚMEROS</div><div class="digits">${d.map((v, i) => `<div class="d"><button data-u="${i}">▲</button><b>${v}</b><button data-d="${i}">▼</button></div>`).join('')}</div><div class="row"><button class="btn small" id="cX">CERRAR</button><button class="btn small gold" id="cOk">PROBAR</button></div></div>`;
      el.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { d[b.dataset.u] = (d[b.dataset.u] + 1) % 10; sfx.play('click'); render(); });
      el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { d[b.dataset.d] = (d[b.dataset.d] + 9) % 10; sfx.play('click'); render(); });
      el.querySelector('#cX').onclick = () => { el.classList.add('hidden'); res(false); };
      el.querySelector('#cOk').onclick = () => { if (d.join('') === '417') { el.classList.add('hidden'); res(true); } else { sfx.play('hurt'); el.querySelector('.panel').animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], 200); } };
    };
    render();
  });
}

// ================== DIBUJO DE ESCENAS ==================
const stroke = (c, w = 2, g = 12) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.shadowColor = c; ctx.shadowBlur = g; };
const noGlow = () => { ctx.shadowBlur = 0; };
function nightSky(t) { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#02020c'); g.addColorStop(1, '#101a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); for (let i = 0; i < 70; i++) { ctx.globalAlpha = 0.4 + Math.sin(t * 2 + i) * 0.3; ctx.fillStyle = '#fff'; ctx.fillRect((i * 137) % VW, (i * 71) % 260, 2, 2); } ctx.globalAlpha = 1; }
function sea(t, hz) { nightSky(t); const g = ctx.createLinearGradient(0, hz, 0, VH); g.addColorStop(0, '#04122a'); g.addColorStop(1, '#010510'); ctx.fillStyle = g; ctx.fillRect(0, hz, VW, VH - hz); stroke('#00f0ff55', 1.5, 6); for (let k = 0; k < 8; k++) { const y = hz + 10 + k * k * 4; ctx.beginPath(); for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + t * 1.5 + k) * (2 + k * 0.5)); ctx.stroke(); } noGlow(); }
function moon(x, y) { glowDot(ctx, x, y, 120, '#9ad8ff', 0.35); ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#c8d8f0'; ctx.beginPath(); ctx.arc(x - 8, y - 6, 6, 0, 7); ctx.arc(x + 10, y + 8, 4, 0, 7); ctx.fill(); }
function lighthouse(x, base, s, t, near) {
  const h = 220 * s, w0 = 34 * s, w1 = 22 * s; ctx.fillStyle = '#0a0a1a'; ctx.beginPath(); ctx.moveTo(x - w0, base); ctx.lineTo(x - w1, base - h); ctx.lineTo(x + w1, base - h); ctx.lineTo(x + w0, base); ctx.fill();
  stroke('#ff2bd6', 2 * Math.min(s, 1.4), 10); ctx.stroke(); for (let k = 1; k < 4; k++) { const y = base - h * k / 4, w = lerp(w0, w1, k / 4); ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.stroke(); }
  stroke('#00f0ff', 2, 10); ctx.strokeRect(x - w1 * 0.9, base - h - 30 * s, w1 * 1.8, 30 * s); ctx.beginPath(); ctx.moveTo(x - w1, base - h - 30 * s); ctx.lineTo(x, base - h - 48 * s); ctx.lineTo(x + w1, base - h - 30 * s); ctx.stroke(); noGlow();
  if (st.f.lit) { const a = t * 0.8; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x, 0, x + Math.cos(a) * 600, 0); g.addColorStop(0, '#fff7c0aa'); g.addColorStop(1, '#fff7c000'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, base - h - 15 * s); ctx.lineTo(x + Math.cos(a) * 700, base - h - 15 * s - 60); ctx.lineTo(x + Math.cos(a) * 700, base - h - 15 * s + 60); ctx.fill(); ctx.restore(); glowDot(ctx, x, base - h - 15 * s, 60, '#fff7c0', 0.9); }
  if (near) { ctx.fillStyle = '#05040c'; ctx.fillRect(x - 55, base - 230, 110, 190); stroke(st.f.door ? '#39ff88' : '#ffd200', 3, 12); ctx.strokeRect(x - 55, base - 230, 110, 190); noGlow(); if (st.f.door) { ctx.fillStyle = '#ffd20022'; ctx.fillRect(x - 52, base - 227, 104, 184); } }
}
function dock() { ctx.fillStyle = '#1a1208'; ctx.fillRect(0, 420, 560, 22); stroke('#ff8a1a', 2, 8); ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(560, 420); for (let x = 30; x < 560; x += 90) { ctx.moveTo(x, 442); ctx.lineTo(x, 520); } ctx.stroke(); noGlow(); }
function boat(x, y, t) { const b = Math.sin(t * 1.4) * 3; ctx.save(); ctx.translate(x, y + b); ctx.rotate(0.06); ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(80, 0); ctx.lineTo(55, 34); ctx.lineTo(-55, 34); ctx.fill(); stroke('#ffd200', 2.5, 12); ctx.stroke(); ctx.font = '700 11px Orbitron'; ctx.fillStyle = '#ffd200'; noGlow(); ctx.fillText('ESPERANZA', -34, 24); if (!st.f.boat) { glowDot(ctx, 10, 12, 18, '#ffd200', 0.6 + Math.sin(t * 6) * 0.3); } ctx.restore(); }
function buoy(x, y, t) { const b = Math.sin(t * 2) * 4; ctx.fillStyle = '#2a0a12'; ctx.beginPath(); ctx.moveTo(x - 18, y + 40 + b); ctx.lineTo(x - 10, y + b); ctx.lineTo(x + 10, y + b); ctx.lineTo(x + 18, y + 40 + b); ctx.fill(); stroke('#ff2a4d', 2, 10); ctx.stroke(); noGlow(); ctx.fillStyle = '#fff'; ctx.font = '900 14px Orbitron'; ctx.fillText('13', x - 9, y + 27 + b); if (Math.sin(t * 3) > 0.6) glowDot(ctx, x, y - 4 + b, 30, '#ff2a4d', 0.9); }
function stone() { ctx.fillStyle = '#0e0c18'; ctx.fillRect(0, 480, VW, 60); stroke('#7a3aff88', 1, 4); for (let x = 0; x < VW; x += 60) { ctx.strokeRect(x + ((x / 60) % 2) * 30, 480, 60, 30); ctx.strokeRect(x, 510, 60, 30); } noGlow(); ctx.fillStyle = '#ffd20022'; ctx.fillRect(610, 250, 120, 70); stroke('#ffd200', 1.5, 6); ctx.strokeRect(610, 250, 120, 70); noGlow(); ctx.fillStyle = '#ffd200'; ctx.font = '700 9px Orbitron'; ctx.fillText('LA LUZ CUENTA', 622, 280); ctx.fillText('LO QUE EL MAR', 622, 294); ctx.fillText('CALLA', 650, 308); }
function mailbox(x, y) { ctx.fillStyle = '#12082a'; ctx.fillRect(x - 30, y - 40, 60, 46); stroke('#00f0ff', 2, 8); ctx.strokeRect(x - 30, y - 40, 60, 46); ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 90); ctx.stroke(); noGlow(); if (!st.f.mail) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 16, y - 34, 32, 4); } }
function chain(x, y) { stroke('#ff8a1a', 3, 8); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x + i * 16, y + Math.abs(i) * 3, 9, 6, 0, 0, 7); ctx.stroke(); } noGlow(); ctx.fillStyle = '#ff8a1a'; ctx.fillRect(x - 12, y + 6, 24, 22); }
function room(bg, t) { ctx.fillStyle = st.f.power || st.at === 'sotano' ? bg : '#05040a'; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = '#0006'; ctx.fillRect(0, 440, VW, 100); stroke('#7a3aff66', 1, 0); for (let x = 0; x < VW; x += 80) { ctx.beginPath(); ctx.moveTo(x, 440); ctx.lineTo(x - 60, VH); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(0, 440); ctx.lineTo(VW, 440); ctx.stroke(); if (!st.f.power && st.at !== 'sotano') { ctx.fillStyle = '#ffd200'; ctx.globalAlpha = 0.08 + Math.sin(t * 7) * 0.03; ctx.beginPath(); ctx.arc(480, 280, 260, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
function generator(x, y, t) { ctx.fillStyle = '#101826'; ctx.fillRect(x - 70, y - 70, 140, 140); stroke(st.f.power ? '#39ff88' : '#ff2a4d', 3, 14); ctx.strokeRect(x - 70, y - 70, 140, 140); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 50, y - 40 + i * 22); ctx.lineTo(x + 20, y - 40 + i * 22); ctx.stroke(); } ctx.beginPath(); ctx.arc(x + 42, y - 30, 14, 0, 7); ctx.stroke(); noGlow(); if (st.f.power) glowDot(ctx, x + 42, y - 30, 30, '#39ff88', 0.6 + Math.sin(t * 8) * 0.2); else { ctx.fillStyle = '#ff2a4d'; ctx.font = '900 10px Orbitron'; ctx.fillText('SIN FUSIBLE', x - 40, y + 55); } }
function trapdoor(x, y) { ctx.fillStyle = st.f.trap ? '#000' : '#1a1208'; ctx.fillRect(x - 60, y - 20, 120, 40); stroke('#ff8a1a', 2, 8); ctx.strokeRect(x - 60, y - 20, 120, 40); noGlow(); }
function stairsDoor(x, y) { ctx.fillStyle = '#05040c'; ctx.fillRect(x - 50, y - 40, 100, 230); stroke(st.f.power ? '#00f0ff' : '#333', 2.5, 10); ctx.strokeRect(x - 50, y - 40, 100, 230); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - 40 + i * 6, y + 170 - i * 30); ctx.lineTo(x + 40 - i * 4, y + 170 - i * 30); ctx.stroke(); } noGlow(); }
function door(x, y, c) { ctx.fillStyle = '#05040c'; ctx.fillRect(x - 40, y - 30, 90, 220); stroke(c, 2.5, 10); ctx.strokeRect(x - 40, y - 30, 90, 220); noGlow(); }
function shelf(x, y) { ctx.fillStyle = '#120a1e'; ctx.fillRect(x, y, 220, 300); stroke('#9d4dff', 2, 8); ctx.strokeRect(x, y, 220, 300); for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(x, y + r * 75); ctx.lineTo(x + 220, y + r * 75); ctx.stroke(); } noGlow(); const C = ['#00f0ff', '#ff2bd6', '#ffd200', '#39ff88', '#ff8a1a']; for (let r = 0; r < 4; r++) for (let k = 0; k < 11; k++) { ctx.fillStyle = C[(r * 3 + k) % 5] + '99'; ctx.fillRect(x + 8 + k * 19, y + r * 75 + 18 + (k % 3) * 4, 14, 55 - (k % 3) * 4); } }
function painting(x, y, t) { ctx.fillStyle = '#0a1030'; ctx.fillRect(x, y, 240, 150); stroke('#ffd200', 3, 10); ctx.strokeRect(x, y, 240, 150); noGlow(); [4, 1, 7].forEach((n, i) => { const bx = x + 40 + i * 80, by = y + 105; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(bx - 25, by); ctx.lineTo(bx + 25, by); ctx.lineTo(bx + 15, by + 14); ctx.lineTo(bx - 15, by + 14); ctx.fill(); ctx.fillRect(bx - 1, by - 60, 2, 60); for (let f = 0; f < n; f++) { ctx.fillStyle = ['#ff2a4d', '#00f0ff', '#ffd200'][f % 3]; ctx.fillRect(bx + 2, by - 58 + f * 8, 12, 6); } }); stroke('#00f0ff66', 1, 0); ctx.beginPath(); for (let k = 0; k < 240; k += 10) ctx.lineTo(x + k, y + 128 + Math.sin(k * 0.1 + t) * 3); ctx.stroke(); }
function desk(x, y) { ctx.fillStyle = '#1a1006'; ctx.fillRect(x, y, 220, 30); ctx.fillRect(x + 10, y + 30, 20, 100); ctx.fillRect(x + 190, y + 30, 20, 100); ctx.fillRect(x + 60, y + 30, 100, 50); stroke('#ff8a1a', 2, 8); ctx.strokeRect(x, y, 220, 30); ctx.strokeRect(x + 60, y + 30, 100, 50); noGlow(); ctx.fillStyle = st.f.drawer ? '#39ff88' : '#ffd200'; ctx.fillRect(x + 100, y + 50, 20, 10); }
function globe(x, y, t) { stroke('#00f0ff', 2, 10); ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, 34 * Math.abs(Math.cos(t * 0.5)), 34, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y + 34); ctx.lineTo(x, y + 70); ctx.moveTo(x - 25, y + 70); ctx.lineTo(x + 25, y + 70); ctx.stroke(); noGlow(); }
function spiral(t) { ctx.fillStyle = '#080614'; ctx.fillRect(0, 0, VW, VH); stroke('#00f0ff', 2, 10); for (let i = 0; i < 14; i++) { const a = i * 0.7 + t * 0.05, y = 500 - i * 34, w = 200 + Math.cos(a) * 140; ctx.beginPath(); ctx.moveTo(480 - w / 2, y); ctx.lineTo(480 + w / 2, y); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(480, 520); ctx.lineTo(480, 30); ctx.stroke(); noGlow(); }
function crowbar(x, y) { stroke('#ff8a1a', 5, 12); ctx.beginPath(); ctx.moveTo(x - 50, y + 10); ctx.lineTo(x + 40, y - 6); ctx.quadraticCurveTo(x + 56, y - 10, x + 52, y + 8); ctx.stroke(); noGlow(); }
function seaWindow(x, y, t) { ctx.save(); ctx.beginPath(); ctx.arc(x + 40, y + 80, 80, 0, 7); ctx.clip(); ctx.translate(x - 440, y - 250); sea(t, 330); ctx.restore(); ctx.save(); ctx.translate(x + 40, y + 80); stroke('#ffd200', 4, 10); ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.moveTo(-80, 0); ctx.lineTo(80, 0); ctx.moveTo(0, -80); ctx.lineTo(0, 80); ctx.stroke(); noGlow(); if (Math.sin(t * 2.5) > 0.5) glowDot(ctx, 30, 20, 12, '#fff', 1); ctx.restore(); }
function lamp(t) { ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, VW, VH); stroke('#7a3aff', 2, 8); for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 120, 0); ctx.lineTo(480, 270); ctx.stroke(); } noGlow();
  for (let i = 0; i < 4; i++) { const x = 330 + i * 80, c = LCOL[st.lens[i]]; glowDot(ctx, x + 35, 275, 90, c, st.f.power ? 0.55 : 0.15); ctx.fillStyle = c + (st.f.power ? '55' : '22'); ctx.fillRect(x, 200, 70, 150); stroke(c, 3, 14); ctx.strokeRect(x, 200, 70, 150); noGlow(); ctx.fillStyle = '#fff'; ctx.font = '700 10px Orbitron'; ctx.fillText('TOCA', x + 17, 370); }
  if (st.f.lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff7c044'; ctx.fillRect(0, 0, VW, VH); ctx.restore(); } }
function paper(x, y) { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2); ctx.fillStyle = '#f4efff'; ctx.fillRect(-30, -18, 60, 36); ctx.fillStyle = '#5a4a8a'; for (let i = 0; i < 4; i++) ctx.fillRect(-24, -12 + i * 8, 48 - i * 6, 2); ctx.restore(); }
function recorder(x, y, t) { ctx.fillStyle = '#0a1410'; ctx.fillRect(x - 70, y - 40, 140, 90); stroke('#39ff88', 2.5, 10); ctx.strokeRect(x - 70, y - 40, 140, 90); for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 34, y, 22, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + s * 34, y); ctx.lineTo(x + s * 34 + Math.cos(t * 3) * 18, y + Math.sin(t * 3) * 18); ctx.stroke(); } noGlow(); }
function seaMap(x, y) { ctx.fillStyle = '#e8d8b0'; ctx.fillRect(x, y, 260, 170); ctx.strokeStyle = '#3a6aa0'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let k = 0; k < 260; k += 10) ctx.lineTo(x + k, y + 20 + i * 26 + Math.sin(k * 0.08 + i) * 4); ctx.stroke(); } ctx.fillStyle = '#ff2a4d'; ctx.beginPath(); ctx.arc(x + 190, y + 70, 9, 0, 7); ctx.fill(); ctx.font = '900 14px Orbitron'; ctx.fillText('13', x + 202, y + 66); ctx.strokeStyle = '#ff2a4d'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(x + 30, y + 150); ctx.quadraticCurveTo(x + 120, y + 40, x + 185, y + 70); ctx.stroke(); ctx.setLineDash([]); }
function radio(x, y, t) { ctx.fillStyle = '#1a0c06'; ctx.fillRect(x - 50, y - 40, 100, 80); stroke('#ff8a1a', 2, 8); ctx.strokeRect(x - 50, y - 40, 100, 80); ctx.beginPath(); ctx.arc(x - 18, y, 18, 0, 7); ctx.stroke(); noGlow(); ctx.fillStyle = '#ff8a1a'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 8, y - 20 + i * 9, 30 * (0.4 + Math.abs(Math.sin(t * 5 + i)) * 0.6), 4); }

// ================== RATÓN / TOQUE ==================
let view = { s: 1, ox: 0, oy: 0 };
const toV = (x, y) => ({ x: (x - view.ox) / view.s, y: (y - view.oy) / view.s });
const spotsHere = () => SCENES[st.at].spots.filter(s => !s[6] || s[6]());
const spotAt = (x, y) => spotsHere().find(s => x >= s[0] && x <= s[0] + s[2] && y >= s[1] && y <= s[1] + s[3]);
cv.addEventListener('mousemove', e => { if (screen !== 'play') return; const p = toV(e.clientX, e.clientY); hover = spotAt(p.x, p.y) || null; cv.style.cursor = hover ? 'pointer' : 'default'; });
cv.addEventListener('click', async e => {
  if (screen !== 'play' || busy || talking()) return; const p = toV(e.clientX, e.clientY), s = spotAt(p.x, p.y);
  fx.ring(e.clientX, e.clientY, '#00f0ff', 24);
  if (!s) { if (sel) { sel = null; updateHud(); } return; }
  busy = true; try { await s[5](); } finally { busy = false; }
  if (sel && !st.inv.includes(sel)) sel = null; updateHud();
});
function updateHud() {
  $('place').textContent = PLACES[st.at]; $('pages').textContent = `📜 ${st.pages.length}/5`;
  const inv = $('inv'); inv.innerHTML = '<span class="lbl">MOCHILA</span>' + (st.inv.length ? '' : '<span class="lbl">vacía</span>');
  for (const id of st.inv) { const b = document.createElement('button'); b.className = sel === id ? 'on' : ''; b.innerHTML = `${ITEMS[id].ic}<small>${ITEMS[id].name}</small>`; b.onclick = () => { sel = sel === id ? null : id; sfx.play('click'); if (sel) toast(`Usar <b>${ITEMS[id].name}</b>… toca dónde`, 1400); updateHud(); }; inv.appendChild(b); }
}

// ================== BUCLE ==================
function draw(dt, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S.W, S.H);
  const s = Math.min(S.W / VW, (S.H - (screen === 'play' ? 84 : 0)) / VH); view = { s, ox: (S.W - VW * s) / 2, oy: Math.max(0, (S.H - 84 - VH * s) / 2) };
  ctx.save(); ctx.translate(view.ox, view.oy); ctx.scale(s, s); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
  SCENES[st.at].draw(t);
  if (screen === 'play' && !talking()) {
    for (const sp of spotsHere()) {
      const on = hover === sp;
      if (on || usingTouch()) { ctx.strokeStyle = on ? '#ffd200' : '#ffffff22'; ctx.lineWidth = on ? 2 : 1; ctx.setLineDash(on ? [] : [4, 6]); ctx.strokeRect(sp[0], sp[1], sp[2], sp[3]); ctx.setLineDash([]); }
      if (on || (usingTouch() && Math.sin(t * 2 + sp[0]) > 0.6)) { ctx.font = '700 13px Orbitron'; const w = ctx.measureText(sp[4]).width + 16; ctx.fillStyle = '#05010fcc'; ctx.fillRect(sp[0] + sp[2] / 2 - w / 2, sp[1] - 26, w, 22); ctx.fillStyle = '#ffd200'; ctx.textAlign = 'center'; ctx.fillText(sp[4], sp[0] + sp[2] / 2, sp[1] - 10); ctx.textAlign = 'left'; }
    }
  }
  ctx.restore();
  if (fade > 0) { fade -= dt * 3; ctx.fillStyle = `rgba(0,0,0,${clamp(fade < 0.5 ? fade * 2 : (1 - fade) * 2, 0, 1)})`; ctx.fillRect(0, 0, S.W, S.H); }
  fx.update(dt); fx.draw(ctx);
}
function show(id) { for (const s of ['menu', 'over']) $(s).classList.toggle('hidden', s !== id); const play = !id; screen = id || 'play'; for (const h of ['place', 'pages', 'inv']) $(h).classList.toggle('hidden', !play); }
async function begin(fresh) {
  sfx.ensure(); if (fresh) { st = blank(); persist(); }
  show(null); screen = 'story'; for (const h of ['place', 'pages', 'inv']) $(h).classList.add('hidden');
  if (fresh || !store.get('faro.started', false)) { store.set('faro.started', true); await chapter('', 'FARO 13', 'Hace un mes recibí una carta sin remite. Sólo decía: «Ven al faro». La letra era la de mi abuelo Elías, desaparecido hace trece años.', '#00f0ff', 6000); await dialog([say(V, 'Ya estoy aquí, abuelo. En tu isla. Delante de tu faro apagado.'), say(V, 'Vamos a ver qué querías enseñarme.')]); }
  show(null); updateHud(); sfx.music(SONGS.calm);
}
$('bPlay').onclick = () => begin(!store.get('faro.save', null));
$('bNew').onclick = () => begin(true);
$('oMenu').onclick = () => { show('menu'); $('bPlay').textContent = 'CONTINUAR'; $('bNew').classList.remove('hidden'); };
loop((dt, t) => draw(dt, t));
show('menu');
if (location.hash === '#dbg') window.dbg = { get st() { return st; }, go, SCENES };
