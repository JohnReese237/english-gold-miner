let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicPlaying = false;
let musicTimer: ReturnType<typeof setTimeout> | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.45;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function out(): GainNode {
  ctx();
  return masterGain!;
}

function note(
  frequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "triangle",
  volume = 0.25,
  detune = 0,
) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.setValueAtTime(volume, startTime + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(gain);
  gain.connect(out());
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

// ── Sound Effects ──

export function playLaunch() {
  const c = ctx();
  const t = c.currentTime;
  // Whoosh — filtered noise sweep
  const bufferSize = c.sampleRate * 0.35;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.linearRampToValueAtTime(1800, t + 0.15);
  filter.frequency.linearRampToValueAtTime(400, t + 0.3);
  filter.Q.value = 1.5;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.2, t + 0.04);
  gain.gain.linearRampToValueAtTime(0, t + 0.35);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(out());
  noise.start(t);
  noise.stop(t + 0.35);
}

export function playHit() {
  const c = ctx();
  const t = c.currentTime;
  // Thump + sparkle
  note(90, t, 0.28, "sine", 0.45);
  note(135, t + 0.02, 0.22, "sine", 0.3);
  note(180, t + 0.01, 0.18, "triangle", 0.2);
  // High sparkle
  note(1400, t + 0.03, 0.14, "sine", 0.12);
  note(2100, t + 0.05, 0.1, "sine", 0.08);
}

export function playCollect(value: number) {
  const c = ctx();
  const t = c.currentTime;
  // Coin chime — ascending notes
  const isBig = value >= 200;
  const baseFreq = isBig ? 520 : 660;
  const steps = isBig ? 5 : 3;
  for (let i = 0; i < steps; i++) {
    const freq = baseFreq * Math.pow(2, (i * 2) / 12);
    note(freq, t + i * 0.07, 0.2, "triangle", 0.2);
    note(freq * 1.5, t + i * 0.07 + 0.01, 0.16, "sine", 0.1);
  }
  // Final chime for valuable items
  if (isBig) {
    note(baseFreq * 2, t + steps * 0.07, 0.35, "triangle", 0.22);
    note(baseFreq * 3, t + steps * 0.07 + 0.02, 0.3, "sine", 0.12);
  }
}

export function playExplosion() {
  const c = ctx();
  const t = c.currentTime;
  // Noise burst
  const bufferSize = c.sampleRate * 0.7;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const envelope = Math.exp(-i / (c.sampleRate * 0.18));
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + 0.65);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(out());
  noise.start(t);
  noise.stop(t + 0.7);
  // Low rumble
  note(40, t, 0.55, "sine", 0.5);
  note(55, t + 0.05, 0.45, "sine", 0.35);
}

export function playLevelComplete() {
  const c = ctx();
  const t = c.currentTime;
  // Victory jingle — C E G C E G C
  const melody = [523, 659, 784, 1047, 1319, 1568, 2093];
  melody.forEach((freq, i) => {
    note(freq, t + i * 0.1, 0.25, "triangle", 0.2);
    if (i % 2 === 0) note(freq / 2, t + i * 0.1, 0.25, "sine", 0.12);
  });
}

export function playFail() {
  const c = ctx();
  const t = c.currentTime;
  // Descending sad notes
  [440, 370, 330, 262].forEach((freq, i) => {
    note(freq, t + i * 0.2, 0.3, "triangle", 0.18);
  });
}

export function playClick() {
  const c = ctx();
  const t = c.currentTime;
  note(800, t, 0.06, "sine", 0.1);
  note(1200, t + 0.01, 0.05, "sine", 0.08);
}

export function playShopBuy() {
  const c = ctx();
  const t = c.currentTime;
  // Cash register cha-ching
  note(880, t, 0.08, "square", 0.1);
  note(1100, t + 0.06, 0.08, "square", 0.1);
  note(1320, t + 0.12, 0.12, "triangle", 0.15);
  note(1760, t + 0.16, 0.15, "triangle", 0.12);
}

export function playItemUse() {
  const c = ctx();
  const t = c.currentTime;
  // Power-up sound — rising sweep
  note(300, t, 0.1, "triangle", 0.15);
  note(450, t + 0.06, 0.1, "triangle", 0.15);
  note(600, t + 0.12, 0.1, "triangle", 0.15);
  note(900, t + 0.18, 0.15, "triangle", 0.18);
  note(1200, t + 0.22, 0.2, "triangle", 0.15);
}

// ── Background Music ──

const BPM = 108;
const BEAT = 60 / BPM; // seconds per beat
const STEP = BEAT / 2; // eighth note

// Pentatonic melody in C major
const melodyNotes = [
  // 2-bar pattern, 16 eighth notes
  { f: 523, d: 1 }, // C5  -
  { f: 0, d: 0.5 }, //
  { f: 659, d: 0.5 }, // E5
  { f: 784, d: 1 }, // G5  -
  { f: 659, d: 0.5 }, //
  { f: 0, d: 0.5 }, //
  { f: 880, d: 0.5 }, // A5
  { f: 784, d: 0.5 }, // G5
  { f: 659, d: 1 }, // E5  -
  { f: 523, d: 0.5 }, //
  { f: 0, d: 0.5 }, //
  { f: 587, d: 0.5 }, // D5
  { f: 659, d: 0.5 }, // E5
  { f: 784, d: 1 }, // G5  -
  { f: 880, d: 0.5 }, //
  { f: 0, d: 0.5 }, //
  { f: 1047, d: 0.5 }, // C6
  { f: 880, d: 0.5 }, // A5
  { f: 784, d: 0.5 }, // G5
  { f: 659, d: 1.5 }, // E5  --
];

const bassNotes = [
  { f: 131, d: 2 }, // C3
  { f: 196, d: 2 }, // G3
  { f: 131, d: 2 }, // C3
  { f: 196, d: 2 }, // G3
  { f: 147, d: 2 }, // D3
  { f: 220, d: 2 }, // A3
  { f: 147, d: 2 }, // D3
  { f: 220, d: 2 }, // A3
];

function playMusicLoop() {
  if (!musicPlaying) return;
  const c = ctx();
  const now = c.currentTime;

  // Schedule one full loop (8 bars = 16 beats = 32 steps)
  const loopDuration = 16 * BEAT;
  let t = now;

  // Bass line
  let bassTime = t;
  for (const note of bassNotes) {
    playMusicNote(note.f, bassTime, note.d * BEAT, "triangle", 0.12);
    bassTime += note.d * BEAT;
  }

  // Melody
  let melTime = t;
  for (const note of melodyNotes) {
    playMusicNote(note.f, melTime, note.d * STEP, "sine", 0.14);
    melTime += note.d * STEP;
  }

  // Harmony pad
  const padOsc = c.createOscillator();
  const padGain = c.createGain();
  padOsc.type = "sine";
  padOsc.frequency.value = 262; // C4
  padGain.gain.setValueAtTime(0, t);
  padGain.gain.linearRampToValueAtTime(0.04, t + 0.5);
  padGain.gain.setValueAtTime(0.04, t + loopDuration - 0.5);
  padGain.gain.linearRampToValueAtTime(0, t + loopDuration);
  padOsc.connect(padGain);
  padGain.connect(out());
  padOsc.start(t);
  padOsc.stop(t + loopDuration + 0.05);

  musicTimer = setTimeout(playMusicLoop, loopDuration * 1000 - 50);
}

function playMusicNote(
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  if (freq <= 0 || duration <= 0) return;
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const attack = Math.min(0.03, duration * 0.1);
  const release = Math.min(0.08, duration * 0.3);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.setValueAtTime(volume, startTime + duration - release);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(gain);
  gain.connect(out());
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export function startMusic() {
  if (musicPlaying) return;
  musicPlaying = true;
  playMusicLoop();
}

export function stopMusic() {
  musicPlaying = false;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

export function setMasterVolume(vol: number) {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, vol));
  }
}

export function initAudioOnInteraction() {
  ctx();
}
