// Neon Arcade — diálogos y escenas para los juegos con historia.
// dialog([{ who, col, txt, choices }]) → Promise con la opción elegida (o undefined)
import { sfx, hit, clearHits } from './lib.js';

const css = `
#dlg{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(760px,94vw);z-index:35;background:#0b0322f2;border:2px solid var(--dc,#00f0ff);border-radius:16px;box-shadow:0 0 24px color-mix(in srgb,var(--dc,#00f0ff) 50%,transparent);padding:14px 18px 16px;font-family:system-ui,sans-serif;color:#f4efff;cursor:pointer;user-select:none}
#dlg.hidden{display:none}
#dlg .who{font-family:Orbitron,sans-serif;font-weight:900;letter-spacing:3px;font-size:13px;color:var(--dc,#00f0ff);text-shadow:0 0 8px var(--dc,#00f0ff);margin-bottom:6px}
#dlg .txt{font-size:clamp(15px,2.2vw,18px);line-height:1.5;min-height:3em}
#dlg .nx{position:absolute;right:14px;bottom:10px;font-size:12px;color:var(--dc,#00f0ff);animation:nxb 1s infinite}
@keyframes nxb{50%{opacity:.2}}
#dlg .ch{display:flex;flex-direction:column;gap:8px;margin-top:10px}
#dlg .ch button{font-family:Orbitron,sans-serif;font-size:13px;letter-spacing:1px;text-align:left;padding:10px 14px;border-radius:10px;border:1.5px solid #ffffff44;background:#ffffff10;color:#fff}
#dlg .ch button:hover,#dlg .ch button:focus{border-color:var(--dc,#00f0ff);background:#ffffff22;outline:none}
#card{position:fixed;inset:0;z-index:36;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#05010f;opacity:0;pointer-events:none;transition:opacity .6s;padding:20px}
#card.on{opacity:1;pointer-events:auto}
#card small{font-family:Orbitron;letter-spacing:6px;color:#b9a8e8;font-size:12px}
#card h2{font-family:Monoton,Orbitron;font-weight:400;font-size:clamp(34px,8vw,84px);color:#fff;text-shadow:0 0 10px var(--cc,#ff2bd6),0 0 40px var(--cc,#ff2bd6);margin:12px 0}
#card p{font-family:system-ui;color:#d8c8ff;max-width:560px;line-height:1.6;font-size:15px}
`;
let built = false, box, whoEl, txtEl, nxEl, chEl, card;
function build() {
  if (built) return; built = true;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  box = document.createElement('div'); box.id = 'dlg'; box.className = 'hidden';
  box.innerHTML = '<div class="who"></div><div class="txt"></div><div class="ch"></div><div class="nx">▶</div>';
  document.body.appendChild(box); whoEl = box.children[0]; txtEl = box.children[1]; chEl = box.children[2]; nxEl = box.children[3];
  card = document.createElement('div'); card.id = 'card'; document.body.appendChild(card);
}
export const talking = () => built && !box.classList.contains('hidden');
export function dialog(lines) {
  build();
  return new Promise(res => {
    let i = 0, shown = 0, full = '', tick = 0, choice;
    const L = () => typeof lines[i] === 'string' ? { txt: lines[i] } : lines[i];
    const start = () => {
      const l = L(); full = l.txt; shown = 0; box.style.setProperty('--dc', l.col || '#00f0ff');
      whoEl.textContent = l.who || ''; whoEl.style.display = l.who ? '' : 'none'; txtEl.textContent = ''; chEl.innerHTML = ''; nxEl.style.display = 'none';
    };
    const finishLine = () => {
      shown = full.length; txtEl.textContent = full; const l = L();
      if (l.choices) {
        chEl.innerHTML = ''; l.choices.forEach((c, k) => { const b = document.createElement('button'); b.textContent = (k + 1) + '. ' + c; b.onclick = e => { e.stopPropagation(); choice = k; sfx.play('click'); next(true); }; chEl.appendChild(b); });
        setTimeout(() => chEl.firstChild && chEl.firstChild.focus(), 50);
      } else nxEl.style.display = '';
    };
    const next = (fromChoice) => {
      if (shown < full.length) return finishLine();
      if (L().choices && !fromChoice) return;
      i++; if (i >= lines.length) { box.classList.add('hidden'); cancelAnimationFrame(raf); removeEventListener('keydown', key, true); clearHits(); return res(choice); }
      start();
    };
    const key = e => {
      if (['Space', 'Enter', 'KeyE', 'KeyZ'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); next(); return; }
      const l = L(), n = parseInt(e.key); if (l && l.choices && n >= 1 && n <= l.choices.length && shown >= full.length) { e.stopPropagation(); choice = n - 1; next(true); }
    };
    box.onclick = () => next();
    addEventListener('keydown', key, true);
    let raf, last = performance.now();
    const loop = now => {
      const dt = (now - last) / 1000; last = now;
      if (shown < full.length) { tick += dt * 55; const n = Math.min(full.length, Math.floor(tick)); if (n > shown) { shown = n; txtEl.textContent = full.slice(0, shown); if (shown % 3 === 0) sfx.play('text'); } if (shown >= full.length) finishLine(); } else tick = shown;
      raf = requestAnimationFrame(loop);
    };
    box.classList.remove('hidden'); start(); raf = requestAnimationFrame(loop);
  });
}
// cartel de capítulo a pantalla completa
export function chapter(small, title, text = '', color = '#ff2bd6', ms = 2600) {
  build();
  return new Promise(res => {
    card.style.setProperty('--cc', color);
    card.innerHTML = `<small>${small}</small><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}`;
    card.classList.add('on'); sfx.play('power');
    let done = false; const end = () => { if (done) return; done = true; card.classList.remove('on'); card.onclick = null; setTimeout(res, 500); };
    card.onclick = end; setTimeout(end, ms);
  });
}
