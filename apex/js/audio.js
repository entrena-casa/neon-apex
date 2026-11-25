// Sonido: motor con marchas, derrape, turbo, efectos y música synthwave generada
import { G } from './core.js';

export const sfx = (() => {
  let ctx = null, master, sfxG, musG, e1, e2, eF, eG, skid, skidG, skidF, wind, windG, noise, muted = false, musOn = true, step = 0, nextT = 0;
  let gear = 1, rpm = 0.2, shiftT = 0;
  try { muted = localStorage.getItem('apex.mute') === '1'; musOn = localStorage.getItem('apex.music') !== '0'; } catch (e) {}
  const ensure = () => {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination); master.connect(comp);
    sfxG = ctx.createGain(); sfxG.connect(master); musG = ctx.createGain(); musG.gain.value = musOn ? 0.26 : 0; musG.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    e1 = ctx.createOscillator(); e1.type = 'sawtooth'; e2 = ctx.createOscillator(); e2.type = 'square';
    eF = ctx.createBiquadFilter(); eF.type = 'lowpass'; eF.frequency.value = 600; eF.Q.value = 4; eG = ctx.createGain(); eG.gain.value = 0;
    e1.connect(eF); e2.connect(eF); eF.connect(eG); eG.connect(sfxG); e1.start(); e2.start();
    skid = ctx.createBufferSource(); skid.buffer = noise; skid.loop = true; skidF = ctx.createBiquadFilter(); skidF.type = 'bandpass'; skidF.frequency.value = 1400; skidF.Q.value = 6;
    skidG = ctx.createGain(); skidG.gain.value = 0; skid.connect(skidF); skidF.connect(skidG); skidG.connect(sfxG); skid.start();
    wind = ctx.createBufferSource(); wind.buffer = noise; wind.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 700;
    windG = ctx.createGain(); windG.gain.value = 0; wind.connect(wf); wf.connect(windG); windG.connect(sfxG); wind.start();
    nextT = ctx.currentTime + 0.1; setInterval(schedule, 25);
  };
  const tone = (type, f0, f1, t, dur, vol, dest = sfxG) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  };
  const noiseHit = (t, dur, vol, freq, type = 'lowpass', dest = sfxG) => {
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  };
  // música: synthwave a 124 bpm, más intensa en la última vuelta
  const roots = [55, 43.65, 65.41, 49], chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
  function schedule() {
    if (!ctx) return;
    if (muted || !musOn || !G.music) { nextT = ctx.currentTime + 0.05; return; }
    const hot = G.musicHot ? 1 : 0, sixteenth = 60 / (hot ? 132 : 124) / 4;
    while (nextT < ctx.currentTime + 0.12) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, t = nextT;
      if (s % 4 === 0) tone('sine', 150, 42, t, 0.28, 0.9, musG);
      if (s === 4 || s === 12) noiseHit(t, 0.18, 0.45, 1800, 'bandpass', musG);
      if (s % 2 === 1 || hot) noiseHit(t, 0.04, s % 4 === 2 ? 0.18 : 0.08, 8000, 'highpass', musG);
      if (s % 2 === 0) {
        const r = roots[bar] * (s % 4 === 2 ? 2 : 1), o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = r; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.2);
        g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(f); f.connect(g); g.connect(musG); o.start(t); o.stop(t + 0.25);
      }
      const c = chords[bar]; if (hot || bar % 2 === 1 || s % 4 === 0) tone('square', c[s % 3] * (s % 6 < 3 ? 1 : 2), 0, t, 0.12, 0.045, musG);
      if (s === 0) tone('sawtooth', c[0] * 2, 0, t, 1.6, 0.03, musG);
      nextT += sixteenth; step++;
    }
  }
  const T = () => ctx.currentTime;
  return {
    ensure,
    get muted() { return muted; }, get music() { return musOn; },
    toggleMute() { muted = !muted; try { localStorage.setItem('apex.mute', muted ? '1' : '0'); } catch (e) {} if (master) master.gain.value = muted ? 0 : 0.8; return muted; },
    toggleMusic() { musOn = !musOn; try { localStorage.setItem('apex.music', musOn ? '1' : '0'); } catch (e) {} if (musG) musG.gain.value = musOn ? 0.26 : 0; return musOn; },
    // motor con caja de cambios automática
    engine(speed, maxV, throttle, active, boost, dt) {
      if (!ctx) return;
      const r = Math.abs(speed) / maxV, gears = [0, 0.16, 0.32, 0.5, 0.68, 0.85, 1.2];
      if (r > gears[gear] && gear < 6) { gear++; shiftT = 0.12; } else if (gear > 1 && r < gears[gear - 1] * 0.88) gear--;
      const lo = gears[gear - 1], hi = gears[gear];
      let target = 0.25 + 0.75 * clamp01((r - lo) / (hi - lo));
      if (shiftT > 0) { shiftT -= dt; target *= 0.7; }
      if (throttle <= 0) target *= 0.85;
      rpm += (target - rpm) * Math.min(1, dt * 12);
      const f = 48 + rpm * 150 + (boost ? 18 : 0), t = T();
      e1.frequency.setTargetAtTime(f, t, 0.03); e2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
      eF.frequency.setTargetAtTime(500 + rpm * 2200 * (throttle > 0 ? 1 : 0.5), t, 0.05);
      eG.gain.setTargetAtTime(active ? 0.06 + (throttle > 0 ? 0.08 : 0.02) * (0.5 + rpm) : 0, t, 0.08);
      windG.gain.setTargetAtTime(active ? Math.min(0.12, r * r * 0.14) : 0, t, 0.1);
    },
    skid(k) { if (ctx) skidG.gain.setTargetAtTime(k * 0.11, T(), 0.05); },
    beep(go) { if (!ctx) return; tone('square', go ? 1320 : 660, 0, T(), go ? 0.5 : 0.22, 0.13); },
    boost() { if (!ctx) return; noiseHit(T(), 0.5, 0.35, 900, 'bandpass'); tone('sawtooth', 220, 880, T(), 0.35, 0.07); },
    turbo(lv) { if (!ctx) return; const t = T(); tone('sawtooth', 300 + lv * 120, 1200 + lv * 300, t, 0.3, 0.07); noiseHit(t, 0.4, 0.3, 2400, 'highpass'); },
    pad() { if (!ctx) return; tone('sine', 500, 1600, T(), 0.25, 0.12); },
    wall(k) { if (!ctx) return; noiseHit(T(), 0.25 + k * 0.3, 0.2 + k * 0.6, 500, 'lowpass'); tone('square', 90, 40, T(), 0.2, 0.08 * k); },
    land(k) { if (!ctx) return; noiseHit(T(), 0.3, 0.25 + k * 0.4, 260, 'lowpass'); },
    lap() { if (!ctx) return; const t = T(); [660, 880, 1100].forEach((f, i) => tone('triangle', f, 0, t + i * 0.08, 0.25, 0.11)); },
    finish(win) { if (!ctx) return; const t = T(); (win ? [523, 659, 784, 1046, 1318] : [440, 392, 349]).forEach((f, i) => tone('triangle', f, 0, t + i * 0.12, 0.5, 0.14)); },
    deny() { if (!ctx) return; tone('square', 200, 120, T(), 0.25, 0.1); },
    click() { if (!ctx) return; tone('triangle', 900, 1200, T(), 0.06, 0.06); },
    charge(lv) { if (!ctx) return; tone('triangle', [0, 700, 900, 1200][lv], 0, T(), 0.12, 0.07); },
  };
})();
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
