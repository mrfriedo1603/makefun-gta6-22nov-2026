// Solmar Bay — synthesized WebAudio sounds. No audio files: every sound
// is built from oscillators and filtered noise at run time.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.suspend();
    if (!m && this.ctx) this.ctx.resume();
  }

  // Short blip: a sine that slides from f0 to f1.
  blip(f0, f1, dur, vol, type) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Noise burst through a low-pass filter (gunshot, punch, crash).
  noise(dur, vol, cutoff) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  shoot() { this.noise(0.14, 0.5, 2600); this.blip(900, 180, 0.1, 0.22, 'square'); }
  punch() { this.noise(0.09, 0.4, 700); }
  pickup() { this.blip(520, 880, 0.12, 0.25); }
  cash() { this.blip(660, 660, 0.08, 0.22); setTimeout(() => this.blip(880, 880, 0.1, 0.22), 90); }
  missionDone() {
    this.blip(523, 523, 0.14, 0.25);
    setTimeout(() => this.blip(659, 659, 0.14, 0.25), 130);
    setTimeout(() => this.blip(784, 784, 0.2, 0.28), 260);
  }
  busted() { this.blip(320, 140, 0.5, 0.3, 'sawtooth'); }
  click() { this.blip(800, 700, 0.05, 0.15, 'square'); }

  // Engine hum follows the car's speed.
  engine(speed, on) {
    if (this.muted || !on) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      return;
    }
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(ctx.destination);
      this.engineOsc.start();
    }
    const t = ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.45, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05, t, 0.1);
  }

  // Two-tone police siren while any patrol car is close.
  siren(on) {
    if (this.muted || !on) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.sirenOsc) {
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(ctx.destination);
      this.sirenOsc.start();
      this.sirenOsc.frequency.value = 700;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      lfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.2);
  }
}
