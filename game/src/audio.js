// audio.js — every sound in Solmar Bay is synthesized with WebAudio:
// engine hum, sirens, gunshots, punches, pickups and mission jingles.
// No audio files, no network. Safe to call before any user gesture; the
// context resumes on the first key press.

let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let rainSrc = null;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.4;
}

export function isMuted() { return muted; }

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + dur);
}

function noise(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

export function playPickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(990, 0.14, 'sine', 0.25), 70); }
export function playPunch() { noise(0.08, 0.4, 500); }
export function playGunshot() { noise(0.16, 0.5, 2400); tone(160, 0.1, 'square', 0.18, 60); }
export function playCrash() { noise(0.3, 0.5, 700); }
export function playSirenBlip() { tone(950, 0.18, 'square', 0.12, 700); }
export function playMission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 110)); }
export function playFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.22), i * 130)); }
export function playClick() { tone(880, 0.05, 'square', 0.12); }

// Engine hum follows the car's speed (0..1). Call every frame while driving.
export function setEngine(running, speed01) {
  if (!ctx || muted) { stopEngine(); return; }
  if (!running) { stopEngine(); return; }
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.05;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 700;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.value = 55 + speed01 * 130;
  engineGain.gain.value = 0.04 + speed01 * 0.06;
}

export function stopEngine() {
  if (engineOsc) { try { engineOsc.stop(); } catch (e) {} engineOsc = null; engineGain = null; }
}

export function setRain(on) {
  if (!ctx) return;
  if (on && !rainSrc) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    rainSrc = ctx.createBufferSource();
    rainSrc.buffer = buf; rainSrc.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = muted ? 0 : 0.05;
    rainSrc.connect(f); f.connect(g); g.connect(master);
    rainSrc.start();
  } else if (!on && rainSrc) {
    try { rainSrc.stop(); } catch (e) {}
    rainSrc = null;
  }
}
