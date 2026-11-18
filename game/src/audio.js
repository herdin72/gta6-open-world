// audio.js — synthesized WebAudio sound: no external files, no network.
// Engine hum, siren, gunshot, punch, pickup chime, mission jingle, crash thud.
export function createAudio() {
  let ctx = null, engineOsc = null, engineGain = null, muted = false;
  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(ctx.destination); engineOsc.start();
    } catch { ctx = null; }
    return ctx;
  }
  function blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol = 0.2, low = 400) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; return muted; },
    engine(speed, inCar) {
      if (!ensure() || muted) return;
      const target = inCar ? 0.03 + Math.abs(speed) / 560 * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) / 560 * 90, ctx.currentTime, 0.1);
    },
    sirenTick(on) { if (on) blip(880, 0.18, 'sine', 0.05, 220); },
    gunshot() { noise(0.12, 0.25, 3000); blip(160, 0.08, 'square', 0.15, -80); },
    punch() { noise(0.08, 0.18, 900); },
    pickup() { blip(660, 0.09, 'sine', 0.12); setTimeout(() => blip(990, 0.12, 'sine', 0.12), 90); },
    crash() { noise(0.25, 0.3, 500); blip(70, 0.2, 'sine', 0.2, -30); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.14), i * 110)); },
    fail() { [400, 300, 200].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sawtooth', 0.1), i * 130)); },
    busted() { blip(220, 0.5, 'sawtooth', 0.15, -100); },
  };
}
