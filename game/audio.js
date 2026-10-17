// Sound effects made on the fly with the Web Audio API, so there are no
// audio files to load. The announcer uses the browser's speech voices when
// they are available.

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;

try {
  muted = window.localStorage.getItem('brawl-muted') === '1';
} catch {
  // Storage can be blocked; sound just starts unmuted.
}

// Browsers only allow audio after a click or key press, so call this from one.
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
  try {
    window.localStorage.setItem('brawl-muted', muted ? '1' : '0');
  } catch {
    // Ignore: the setting just won't be remembered.
  }
  if (muted && window.speechSynthesis) window.speechSynthesis.cancel();
}

function tone({ type = 'sine', from, to = from, time = 0.15, volume = 0.3, delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + time);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + time);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + time + 0.02);
}

function noise({ time = 0.15, volume = 0.3, filter = 'lowpass', freq = 2000, to = freq, delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + time);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + time);
  src.connect(f).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + time + 0.02);
}

export const sfx = {
  click() {
    tone({ type: 'square', from: 660, to: 880, time: 0.05, volume: 0.08 });
  },
  hit(strength) {
    const s = Math.min(1, strength / 28);
    noise({ time: 0.06 + s * 0.12, volume: 0.25 + s * 0.25, freq: 3000 - s * 1800, to: 300 });
    tone({ type: 'triangle', from: 220 - s * 120, to: 50, time: 0.1 + s * 0.15, volume: 0.35 + s * 0.2 });
  },
  block() {
    tone({ type: 'triangle', from: 1400, to: 900, time: 0.08, volume: 0.15 });
  },
  jump(air) {
    tone({ type: 'sine', from: air ? 420 : 300, to: air ? 900 : 700, time: 0.12, volume: 0.12 });
  },
  land() {
    noise({ time: 0.05, volume: 0.08, freq: 600, to: 200 });
  },
  ko() {
    noise({ time: 0.8, volume: 0.45, freq: 1200, to: 80 });
    tone({ type: 'sawtooth', from: 120, to: 30, time: 0.7, volume: 0.35 });
    tone({ type: 'sine', from: 900, to: 200, time: 0.4, volume: 0.15 });
  },
  shieldBreak() {
    noise({ time: 0.5, volume: 0.35, filter: 'highpass', freq: 2500, to: 6000 });
    tone({ type: 'square', from: 800, to: 100, time: 0.5, volume: 0.15 });
  },
  drum() {
    tone({ type: 'sine', from: 140, to: 55, time: 0.25, volume: 0.45 });
    noise({ time: 0.04, volume: 0.2, freq: 1800, to: 400 });
  },
  splash() {
    noise({ time: 0.3, volume: 0.2, filter: 'bandpass', freq: 1500, to: 400 });
  },
  boing() {
    tone({ type: 'sine', from: 200, to: 700, time: 0.25, volume: 0.25 });
  },
  pickup() {
    [660, 880, 1320].forEach((f, i) => tone({ type: 'triangle', from: f, time: 0.08, volume: 0.12, delay: i * 0.05 }));
  },
  orbBreak() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, time: 0.4, volume: 0.15, delay: i * 0.06 }));
  },
  final() {
    noise({ time: 0.6, volume: 0.25, filter: 'bandpass', freq: 300, to: 3000 });
    [392, 523, 659].forEach((f) => tone({ type: 'sawtooth', from: f, time: 0.8, volume: 0.08, delay: 0.2 }));
  },
  boom() {
    noise({ time: 0.45, volume: 0.4, freq: 900, to: 60 });
    tone({ type: 'sine', from: 90, to: 30, time: 0.4, volume: 0.4 });
  },
  count(go) {
    tone({ type: 'square', from: go ? 880 : 440, time: go ? 0.35 : 0.15, volume: 0.12 });
  },
  game() {
    [784, 659, 523, 392].forEach((f, i) => tone({ type: 'triangle', from: f, time: 0.25, volume: 0.15, delay: i * 0.09 }));
  },
};

const EVENT_SOUNDS = {
  hit: (e) => sfx.hit(e.kb),
  block: () => sfx.block(),
  jump: (e) => sfx.jump(e.air),
  ko: () => sfx.ko(),
  shieldBreak: () => sfx.shieldBreak(),
  counter: () => sfx.block(),
  boom: () => sfx.boom(),
  drum: () => sfx.drum(),
  splash: () => sfx.splash(),
  boing: () => sfx.boing(),
  vine: () => sfx.jump(true),
  pickup: () => sfx.pickup(),
  heal: () => sfx.pickup(),
  boost: () => sfx.pickup(),
  orbHit: () => sfx.block(),
  orbBreak: () => sfx.orbBreak(),
  final: () => sfx.final(),
  game: () => sfx.game(),
};

// Plays sounds for a frame's engine events. Landings are frequent, so only
// heavy ones make noise.
export function playEvents(events) {
  if (!ctx || muted) return;
  let hits = 0;
  for (const e of events) {
    if (e.type === 'land') {
      if (e.heavy) sfx.land();
      continue;
    }
    if (e.type === 'hit' && ++hits > 2) continue;
    const play = EVENT_SOUNDS[e.type];
    if (play) play(e);
  }
}

// Shouts a fighter's name in an Italian voice, if the browser has one.
export function announce(text) {
  if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = synth.getVoices().find((v) => v.lang && v.lang.startsWith('it'));
  if (voice) u.voice = voice;
  u.lang = voice ? voice.lang : 'it-IT';
  u.rate = 1.05;
  u.pitch = 0.9;
  synth.speak(u);
}
