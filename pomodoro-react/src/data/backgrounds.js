/* =============================================================================
   backgrounds.js
   Central configuration for the background system.

   • BackgroundEngine  reads a config from here and renders it.
   • BackgroundGallery reads the list from here and lets the user pick one.
   • Selection persistence (localStorage) lives here so both stay in sync.

   ADD A NEW BACKGROUND
   Append an entry to BACKGROUNDS. Re-use an existing `renderer`
   ("nebula" | "rain" | "sakura" | "city" | "space" | "lofi") and change the
   palette / params — no engine changes required.
============================================================================= */

export const STORAGE_KEY = "pomodoro:background";
export const DEFAULT_BACKGROUND_ID = "nebula";
export const BACKGROUND_STORAGE_KEY = STORAGE_KEY;
export const DEFAULT_BACKGROUND = DEFAULT_BACKGROUND_ID;

/*
  Shared fields
  id, name, tagline   identity + gallery copy
  renderer            which scene the engine draws
  seed                deterministic layout (same scene every load)
  base                CSS colour shown before the first frame
  accent              gallery highlight colour
  preview             CSS background for the gallery thumbnail
  fps                 frame cap (slow scenes run at 30 to save battery)
  maxDpr              device-pixel-ratio cap
  parallax            mouse-depth multiplier (0 disables)
  scrim               edge vignette strength 0–1 (keeps UI readable)
  grain               film-grain opacity (kills gradient banding)
  staticTime          time used for the reduced-motion still frame
*/
export const BACKGROUNDS = Object.freeze([
  /* ------------------------------------------------------------------ 1 */
  {
    id: "nebula",
    name: "Nebula",
    tagline: "Slow interstellar clouds",
    renderer: "nebula",
    seed: 11,
    base: "#05040d",
    accent: "#9b87f5",
    preview:
      "radial-gradient(60% 55% at 22% 30%, rgba(124,92,214,.75), transparent 70%)," +
      "radial-gradient(55% 50% at 80% 70%, rgba(42,155,196,.55), transparent 70%)," +
      "radial-gradient(45% 40% at 70% 20%, rgba(199,106,155,.4), transparent 70%)," +
      "#06050f",
    fps: 30,
    maxDpr: 1.5,
    parallax: 1,
    scrim: 0.55,
    grain: 0.05,
    staticTime: 9,
    palette: {
      sky: [
        [0, "#04030b"],
        [0.55, "#080718"],
        [1, "#0d0a22"],
      ],
      stars: ["#ffffff", "#c9d6ff", "#ffe3cf"],
      clouds: [
        { a: "#241a5c", b: "#7c5cd6", alpha: 0.7, scale: 2.1, threshold: 0.47, calm: 0.75, depth: 0.35, speed: 0.045, drift: 26 },
        { a: "#0d3557", b: "#2a9bc4", alpha: 0.55, scale: 1.5, threshold: 0.5, calm: 0.7, depth: 0.6, speed: 0.06, drift: 34 },
        { a: "#4a1a45", b: "#c76a9b", alpha: 0.42, scale: 2.7, threshold: 0.54, calm: 0.75, depth: 0.9, speed: 0.05, drift: 20 },
      ],
    },
    params: { starDensity: 12, twinkle: 0.35, shooting: [18, 36] },
  },

  /* ------------------------------------------------------------------ 2 */
  {
    id: "midnight-rain",
    name: "Midnight Rain",
    tagline: "Quiet storm over a sleeping city",
    renderer: "rain",
    seed: 23,
    base: "#070b14",
    accent: "#7ba4d8",
    preview:
      "linear-gradient(180deg, rgba(7,11,20,0) 55%, rgba(120,150,190,.18) 100%)," +
      "repeating-linear-gradient(104deg, transparent 0 9px, rgba(159,183,214,.13) 9px 10px)," +
      "linear-gradient(180deg, #070b14, #182638)",
    fps: 60,
    maxDpr: 1.5,
    parallax: 1,
    scrim: 0.5,
    grain: 0.05,
    staticTime: 6,
    palette: {
      sky: [
        [0, "#060a12"],
        [0.5, "#0c1420"],
        [0.82, "#152233"],
        [1, "#1a2a3e"],
      ],
      skyline: { fill: ["#0d1522", "#09101a"], edge: "#6f93c0", edgeAlpha: 0.1, win: ["#f2c98a", "#ffe3b3"], winChance: 0.05, winAlpha: 0.55 },
      ground: ["#0a111b", "#04070c"],
      bokeh: ["#f2c98a", "#8fb6ff", "#ffd7a0"],
      fog: [
        { a: "#16233a", b: "#3d5878", alpha: 0.32, scale: 1.3, stretch: 3.4, threshold: 0.38, vfade: true, y: 0.5, h: 0.42, depth: 0.5, speed: 0.035, drift: 46 },
        { a: "#101b2e", b: "#2f465f", alpha: 0.24, scale: 1.8, stretch: 3.8, threshold: 0.42, vfade: true, y: 0.3, h: 0.4, depth: 0.25, speed: 0.028, drift: 60 },
      ],
      rain: [
        { density: 24, len: [8, 15], speed: [520, 700], alpha: 0.16, width: 0.8, color: "#9fb7d6" },
        { density: 13, len: [14, 26], speed: [800, 1000], alpha: 0.26, width: 1.05, color: "#b4c8e2" },
        { density: 4.5, len: [26, 44], speed: [1200, 1500], alpha: 0.34, width: 1.5, color: "#cfdcf0" },
      ],
      ripple: "#a9c2e4",
    },
    params: { wind: 0.1, rippleRate: 5, groundY: 0.83 },
  },

  /* ------------------------------------------------------------------ 3 */
  {
    id: "sakura-night",
    name: "Sakura Night",
    tagline: "Petals drifting under moonlight",
    renderer: "sakura",
    seed: 37,
    base: "#0a0716",
    accent: "#f0a3c0",
    preview:
      "radial-gradient(14% 18% at 20% 24%, rgba(255,240,246,.95), rgba(255,240,246,0) 70%)," +
      "radial-gradient(28% 22% at 84% 12%, rgba(240,163,192,.5), transparent 70%)," +
      "linear-gradient(180deg, #0a0716, #2a1636 70%, #3d1f45)",
    fps: 60,
    maxDpr: 1.5,
    parallax: 1,
    scrim: 0.5,
    grain: 0.05,
    staticTime: 5,
    palette: {
      sky: [
        [0, "#080613"],
        [0.5, "#150c26"],
        [0.85, "#2a1636"],
        [1, "#3d1f45"],
      ],
      moon: { light: "#fff6f2", dark: "#efd6e4", halo: "#f4d3e6" },
      ridges: ["#150b22", "#0c0616"],
      branch: "#1a0f27",
      blossom: ["#f7c4d6", "#ffe6ee", "#ec9dbb"],
      blossomCore: "#ffd9a0",
      petals: [
        ["#f0a3c0", "#ffe9f0"],
        ["#ec8fb1", "#ffdbe7"],
        ["#f7bdd1", "#fff2f6"],
      ],
    },
    params: { petalDensity: 4, wind: 16 },
  },

  /* ------------------------------------------------------------------ 4 */
  {
    id: "cyber-city",
    name: "Cyber City",
    tagline: "Dusk skyline, restrained neon",
    renderer: "city",
    seed: 41,
    base: "#05060f",
    accent: "#4fd8cf",
    preview:
      "linear-gradient(180deg, transparent 58%, rgba(255,111,168,.28) 100%)," +
      "linear-gradient(0deg, #04050b 0 18%, transparent 18%)," +
      "linear-gradient(180deg, #05060f, #1a1233 62%, #3a1d4a)",
    fps: 60,
    maxDpr: 1.5,
    parallax: 1.1,
    scrim: 0.5,
    grain: 0.05,
    staticTime: 7,
    palette: {
      sky: [
        [0, "#04050f"],
        [0.45, "#0a0c22"],
        [0.8, "#1a1233"],
        [1, "#3a1d4a"],
      ],
      glow: { color: "#ff6fa8", alpha: 0.11 },
      fog: "#2a1a44",
      neon: ["#31e0d0", "#ff4fa3", "#a78bfa"],
      flicker: "#ffd28a",
      traffic: ["#ffcf8a", "#9fe8ff"],
      layers: [
        // far
        { h: [0.12, 0.4], w: [34, 78], gap: 4, fill: ["#1a1d40", "#0f1229"], edge: "#8fa2ff", edgeAlpha: 0.16, win: ["#7fd6ff", "#b9a2ff", "#ffd28a"], winChance: 0.16, winAlpha: 0.32, gx: 6, gy: 8, ww: 2, wh: 3, wx: 4, antenna: 0.22, beacons: false, signs: 0, depth: 0.25, haze: 0.32 },
        // mid
        { h: [0.1, 0.34], w: [46, 104], gap: 6, fill: ["#0e1128", "#080a1a"], edge: "#8fa2ff", edgeAlpha: 0.14, win: ["#7fd6ff", "#b9a2ff", "#ffd28a"], winChance: 0.2, winAlpha: 0.5, gx: 7, gy: 9, ww: 2.4, wh: 3.4, wx: 5, antenna: 0.28, beacons: true, signs: 5, depth: 0.55, haze: 0.18 },
        // near
        { h: [0.05, 0.19], w: [70, 160], gap: 10, fill: ["#070813", "#04050b"], edge: "#8fa2ff", edgeAlpha: 0.1, win: ["#ffd28a", "#7fd6ff"], winChance: 0.1, winAlpha: 0.42, gx: 9, gy: 12, ww: 3, wh: 4.2, wx: 7, antenna: 0.18, beacons: true, signs: 0, depth: 1, haze: 0 },
      ],
      rain: [
        { density: 7, len: [10, 18], speed: [700, 900], alpha: 0.1, width: 0.8, color: "#8fb6ff" },
        { density: 3, len: [22, 38], speed: [1100, 1400], alpha: 0.16, width: 1.1, color: "#b5d0ff" },
      ],
    },
    params: { wind: 0.16, laneY: 0.72, cars: 12 },
  },

  /* ------------------------------------------------------------------ 5 */
  {
    id: "deep-space",
    name: "Deep Space",
    tagline: "A distant world and a thousand suns",
    renderer: "space",
    seed: 53,
    base: "#010207",
    accent: "#7aa2ff",
    preview:
      "radial-gradient(circle at 78% 74%, #4a5f8f 0 7%, #0b1224 8% 12%, transparent 13%)," +
      "radial-gradient(1px 1px at 20% 30%, #fff, transparent)," +
      "radial-gradient(1px 1px at 60% 20%, #cfe0ff, transparent)," +
      "radial-gradient(1px 1px at 35% 70%, #fff, transparent)," +
      "linear-gradient(160deg, #010207, #060a17)",
    fps: 30,
    maxDpr: 1.5,
    parallax: 1.2,
    scrim: 0.45,
    grain: 0.045,
    staticTime: 14,
    palette: {
      sky: [
        [0, "#010104"],
        [0.6, "#03050c"],
        [1, "#060916"],
      ],
      stars: ["#ffffff", "#bcd0ff", "#ffe9d6"],
      band: { a: "#12203f", b: "#6f8fc9", alpha: 0.4, scale: 2.4, threshold: 0.42, angle: -0.42, width: 0.2, depth: 0.3, speed: 0.03, drift: 14 },
      planet: { x: 0.83, y: 0.79, r: 0.1, lit: "#8aa4dc", mid: "#243158", dark: "#04060d", rim: "#8fb0ff" },
    },
    params: { starDensity: 20, twinkle: 0.3, drift: [3.2, 0.7], shooting: [22, 46] },
  },

  /* ------------------------------------------------------------------ 6 */
  {
    id: "lofi-window",
    name: "Lofi Window",
    tagline: "Rainy dusk from a warm room",
    renderer: "lofi",
    seed: 67,
    base: "#0a0710",
    accent: "#ffb26b",
    preview:
      "radial-gradient(60% 50% at 6% 100%, rgba(255,178,102,.5), transparent 70%)," +
      "linear-gradient(180deg, transparent 84%, #1a1017 84%)," +
      "linear-gradient(180deg, #0a0f24, #2b2350 60%, #5a3a5e)",
    fps: 30,
    maxDpr: 1.5,
    parallax: 1,
    scrim: 0.5,
    grain: 0.05,
    staticTime: 8,
    palette: {
      sky: [
        [0, "#0a0f24"],
        [0.5, "#161b40"],
        [0.85, "#2f2452"],
        [1, "#5a3a5e"],
      ],
      moon: "#f4e9ff",
      far: { fill: ["#1e1f47", "#14153a"], edge: "#a9a6ff", edgeAlpha: 0.14, win: ["#ffcf8a", "#ffe3b3"], winChance: 0.14, winAlpha: 0.5, gx: 6, gy: 8, ww: 2, wh: 3, wx: 4 },
      near: { fill: ["#100f2a", "#0a0a1d"], edge: "#a9a6ff", edgeAlpha: 0.1, win: ["#ffcf8a", "#ffb26b"], winChance: 0.1, winAlpha: 0.55, gx: 8, gy: 10, ww: 2.6, wh: 3.6, wx: 6 },
      wall: ["#130d19", "#0a0710"],
      frame: "#1a1119",
      wood: ["#2a1a24", "#110a12"],
      lamp: "#ffae66",
      leaf: ["#245650", "#0f2b2b"],
      mug: "#c7b299",
      rain: [
        { density: 12, len: [8, 14], speed: [500, 660], alpha: 0.1, width: 0.8, color: "#a9b8ff" },
        { density: 5, len: [14, 24], speed: [760, 940], alpha: 0.16, width: 1.1, color: "#c4ceff" },
      ],
    },
    params: { wind: 0.08 },
  },
]);

/* =============================================================================
   Helpers + persistence
============================================================================= */

const BY_ID = new Map(BACKGROUNDS.map((b) => [b.id, b]));

/** Returns a valid id. Anything unknown / missing / malformed → default. */
export function resolveBackgroundId(id) {
  if (typeof id === "string" && BY_ID.has(id)) return id;
  return BY_ID.has(DEFAULT_BACKGROUND_ID) ? DEFAULT_BACKGROUND_ID : BACKGROUNDS[0].id;
}

/** Always returns a config object. */
export function getBackground(id) {
  return BY_ID.get(resolveBackgroundId(id));
}

const listeners = new Set();
let current = null; // cached selection (lazy)

function readStored() {
  try {
    return resolveBackgroundId(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return resolveBackgroundId(null); // storage blocked (private mode, etc.)
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

function onStorage(e) {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  const next = readStored();
  if (next !== current) {
    current = next;
    emit();
  }
}

/** Current selection (safe on every call; validated). */
export function loadBackgroundId() {
  if (current === null) current = readStored();
  return current;
}

/** Validate, persist, and notify every subscriber (engine + gallery). */
export function saveBackgroundId(id) {
  const next = resolveBackgroundId(id);
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* non-fatal: selection still works for this session */
  }
  emit();
  return next;
}

/** useSyncExternalStore-compatible. Also syncs across browser tabs. */
export function subscribeBackground(listener) {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/* =============================================================================
   Ambient Sound System
   • Web Audio API procedural synthesis (zero network latency, offline-ready).
   • Unique ambient sound profile per background.
   • ON/OFF toggle, volume control, smooth crossfades between backgrounds.
   • Autoplay-policy safe (audio context resumed on user interaction).
   • localStorage persistence.
============================================================================= */

export const AMBIENT_STORAGE_KEY = "pomodoro:ambient_sound";

export const AMBIENT_SOUND_PROFILES = Object.freeze({
  nebula: {
    name: "Cosmic Drone",
    tag: "Harmonic warm drone",
    type: "drone",
  },
  "midnight-rain": {
    name: "Rainfall",
    tag: "Gentle rain shower",
    type: "rain",
  },
  "sakura-night": {
    name: "Night Breeze",
    tag: "Soft whispering wind",
    type: "wind",
  },
  "cyber-city": {
    name: "Neon Hum",
    tag: "Low synth resonance",
    type: "cyber",
  },
  "deep-space": {
    name: "Deep Void",
    tag: "Sub-bass rumble & void",
    type: "space",
  },
  "lofi-window": {
    name: "Warm Interior",
    tag: "Room warmth & window rain",
    type: "lofi",
  },
});

export function getStoredAmbientSettings() {
  try {
    const raw = localStorage.getItem(AMBIENT_STORAGE_KEY);
    if (!raw) return { enabled: false, volume: 0.5 };
    const parsed = JSON.parse(raw);
    const enabled = Boolean(parsed.enabled);
    const volume = typeof parsed.volume === "number" && !isNaN(parsed.volume)
      ? Math.min(1, Math.max(0, parsed.volume))
      : 0.5;
    return { enabled, volume };
  } catch {
    return { enabled: false, volume: 0.5 };
  }
}

export function saveStoredAmbientSettings(settings) {
  try {
    localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* non-fatal */
  }
}

class AmbientEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.currentVoice = null;
    this.currentBackgroundId = null;
    this.enabled = false;
    this.volume = 0.5;
    this.noiseBuffers = {};
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  getNoiseBuffer(type = "pink") {
    if (this.noiseBuffers[type]) return this.noiseBuffers[type];
    if (!this.ctx) return null;

    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    } else if (type === "brown") {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 2.5;
      }
    }

    this.noiseBuffers[type] = buffer;
    return buffer;
  }

  createVoice(bgId) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const profile = AMBIENT_SOUND_PROFILES[bgId] || AMBIENT_SOUND_PROFILES.nebula;
    const now = ctx.currentTime;

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.connect(this.masterGain);

    const activeNodes = [];

    switch (profile.type) {
      case "rain": {
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = this.getNoiseBuffer("pink");
        noiseSource.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(1400, now);

        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.setValueAtTime(250, now);

        noiseSource.connect(lowpass);
        lowpass.connect(highpass);
        highpass.connect(voiceGain);

        noiseSource.start(now);
        activeNodes.push(noiseSource);
        break;
      }

      case "wind": {
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = this.getNoiseBuffer("pink");
        noiseSource.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(450, now);
        filter.Q.setValueAtTime(2.2, now);

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.12, now);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(180, now);

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noiseSource.connect(filter);
        filter.connect(voiceGain);

        noiseSource.start(now);
        lfo.start(now);
        activeNodes.push(noiseSource, lfo);
        break;
      }

      case "cyber": {
        const osc1 = ctx.createOscillator();
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(65.4, now);

        const osc2 = ctx.createOscillator();
        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(65.9, now);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.16, now);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(340, now);

        osc1.connect(oscGain);
        osc2.connect(oscGain);
        oscGain.connect(filter);
        filter.connect(voiceGain);

        osc1.start(now);
        osc2.start(now);
        activeNodes.push(osc1, osc2);
        break;
      }

      case "space": {
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(48, now);

        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(48.5, now);

        const noise = ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer("brown");
        noise.loop = true;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.setValueAtTime(180, now);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.32, now);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(voiceGain);

        osc1.connect(voiceGain);
        osc2.connect(voiceGain);

        osc1.start(now);
        osc2.start(now);
        noise.start(now);
        activeNodes.push(osc1, osc2, noise);
        break;
      }

      case "lofi": {
        const rainSource = ctx.createBufferSource();
        rainSource.buffer = this.getNoiseBuffer("pink");
        rainSource.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(950, now);

        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(82.4, now);
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.08, now);

        rainSource.connect(filter);
        filter.connect(voiceGain);
        osc.connect(oscGain);
        oscGain.connect(voiceGain);

        rainSource.start(now);
        osc.start(now);
        activeNodes.push(rainSource, osc);
        break;
      }

      case "drone":
      default: {
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(55, now);

        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(82.5, now);

        const osc3 = ctx.createOscillator();
        osc3.type = "sine";
        osc3.frequency.setValueAtTime(110.2, now);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.24, now);

        osc1.connect(oscGain);
        osc2.connect(oscGain);
        osc3.connect(oscGain);
        oscGain.connect(voiceGain);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        activeNodes.push(osc1, osc2, osc3);
        break;
      }
    }

    return {
      gainNode: voiceGain,
      nodes: activeNodes,
      stop: () => {
        activeNodes.forEach((node) => {
          try {
            node.stop();
            node.disconnect();
          } catch {
            /* ignore */
          }
        });
        try {
          voiceGain.disconnect();
        } catch {
          /* ignore */
        }
      },
    };
  }

  sync(bgId, enabled, volume) {
    this.enabled = Boolean(enabled);
    this.volume = Math.min(1, Math.max(0, Number(volume) || 0.5));

    if (!this.enabled) {
      if (this.masterGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      }
      return;
    }

    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 0.2);

    if (this.currentBackgroundId !== bgId || !this.currentVoice) {
      const oldVoice = this.currentVoice;
      if (oldVoice) {
        oldVoice.gainNode.gain.cancelScheduledValues(now);
        oldVoice.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.8);
        setTimeout(() => oldVoice.stop(), 900);
      }

      const newVoice = this.createVoice(bgId);
      if (newVoice) {
        newVoice.gainNode.gain.cancelScheduledValues(now);
        newVoice.gainNode.gain.linearRampToValueAtTime(0.8, now + 0.8);
      }
      this.currentVoice = newVoice;
      this.currentBackgroundId = bgId;
    }
  }

  setVolume(vol) {
    this.volume = Math.min(1, Math.max(0, Number(vol) || 0));
    if (this.masterGain && this.ctx && this.enabled) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 0.05);
    }
  }

  destroy() {
    if (this.currentVoice) {
      this.currentVoice.stop();
      this.currentVoice = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const ambientEngine = new AmbientEngine();