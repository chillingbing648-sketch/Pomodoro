/* =============================================================================
   BackgroundEngine.jsx
   Independent full-screen background renderer.

   <BackgroundEngine />                       follows the saved selection
   <BackgroundEngine backgroundId="nebula" /> or is fully controlled

   • Canvas + requestAnimationFrame, dt-based motion, frame-capped per scene
   • Pauses when the tab is hidden; resumes without a time jump
   • Debounced resize, devicePixelRatio aware (capped), full cleanup
   • prefers-reduced-motion → one static, beautifully composed frame
   • pointer-events: none — can never intercept the foreground UI
   • Scenes are parameterised by backgrounds.js; typed arrays / sprites keep
     the per-frame path allocation-free
============================================================================= */

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  getBackground,
  loadBackgroundId,
  subscribeBackground,
} from "../data/backgrounds";

/* =============================================================================
   Math + colour utilities
============================================================================= */

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const between = (rand, a, b) => a + (b - a) * rand();

function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHex(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---- value-noise fBm (build-time only) ------------------------------------ */

function hash2(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, octaves) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * f, y * f, s + i);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/* =============================================================================
   Canvas building blocks (all build-time; nothing here runs per frame)
============================================================================= */

function makeLayer(w, h, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx, w, h };
}

function makeSprite(size, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  paint(canvas.getContext("2d"), size);
  return canvas;
}

function glowSprite(hex, size = 48) {
  return makeSprite(size, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, rgba(hex, 1));
    grad.addColorStop(0.22, rgba(hex, 0.32));
    grad.addColorStop(0.6, rgba(hex, 0.06));
    grad.addColorStop(1, rgba(hex, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
}

function roundRectPath(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

function verticalGradient(g, y0, y1, stops) {
  const grad = g.createLinearGradient(0, y0, 0, y1);
  for (let i = 0; i < stops.length; i++) grad.addColorStop(stops[i][0], stops[i][1]);
  return grad;
}

/**
 * Soft, wispy cloud texture. Computed on a tiny canvas (fBm + domain warp)
 * then smooth-upscaled — reads as atmosphere, never as blobs.
 */
function buildCloudLayer(w, h, def, seed, scale) {
  const tw = clamp(Math.round(w / 7), 80, 210);
  const th = Math.max(10, Math.round((tw * h) / w));
  const tiny = document.createElement("canvas");
  tiny.width = tw;
  tiny.height = th;
  const tctx = tiny.getContext("2d");
  const img = tctx.createImageData(tw, th);
  const d = img.data;
  const [ar, ag, ab] = parseHex(def.a);
  const [br, bg, bb] = parseHex(def.b);
  const aspect = tw / th;
  const stretch = def.stretch || 1;
  const calm = def.calm || 0;
  const band = def.band || null;
  const bsin = band ? Math.sin(band.angle) : 0;
  const bcos = band ? Math.cos(band.angle) : 1;

  for (let y = 0; y < th; y++) {
    const v = y / th;
    for (let x = 0; x < tw; x++) {
      const u = x / tw;
      const nx = (u * aspect * def.scale) / stretch;
      const ny = v * def.scale;
      const q1 = fbm(nx + 3.1, ny + 1.7, seed, 4);
      const q2 = fbm(nx + 8.3, ny + 2.8, seed + 7, 4);
      const n = fbm(nx + 1.7 * q1, ny + 1.7 * q2, seed + 13, 5);

      let a = smooth(def.threshold - 0.1, def.threshold + 0.26, n);
      a = Math.pow(a, 1.35);
      if (calm) {
        const dx = (u - 0.5) * 1.1;
        const dy = v - 0.5;
        a *= 1 - calm * (1 - smooth(0.1, 0.62, Math.sqrt(dx * dx + dy * dy)));
      }
      if (def.vfade) a *= Math.pow(Math.sin(Math.PI * v), 0.9);
      if (band) {
        const perp = -bsin * (u - 0.5) * aspect + bcos * (v - 0.5);
        const k = perp / band.width;
        a *= Math.exp(-k * k);
      }
      const c = smooth(0.3, 0.85, n);
      const i = (y * tw + x) * 4;
      d[i] = lerp(ar, br, c);
      d[i + 1] = lerp(ag, bg, c);
      d[i + 2] = lerp(ab, bb, c);
      d[i + 3] = a * def.alpha * 255;
    }
  }
  tctx.putImageData(img, 0, 0);
  const layer = makeLayer(w, h, scale);
  layer.ctx.imageSmoothingEnabled = true;
  layer.ctx.drawImage(tiny, 0, 0, w, h);
  return layer;
}

/**
 * Procedural skyline painted into a layer context.
 * Returns beacon + flicker-window positions (local coords) for dynamic pass.
 */
function paintSkyline(g, w, baseY, o, rand, out) {
  let x = -20;
  const winCount = o.win ? o.win.length : 0;
  let signs = o.signs || 0;
  while (x < w + 20) {
    const bw = between(rand, o.w[0], o.w[1]);
    const bh = o.hMin + (o.hMax - o.hMin) * Math.pow(rand(), 1.5);
    const top = baseY - bh;

    g.fillStyle = verticalGradient(g, top, baseY, [
      [0, o.fill[0]],
      [1, o.fill[1]],
    ]);
    g.fillRect(x, top, bw + 1, bh + 4);

    // Optional set-back tier
    let roof = top;
    if (rand() < 0.4) {
      const tw = bw * between(rand, 0.4, 0.7);
      const th = bh * between(rand, 0.08, 0.2);
      g.fillStyle = o.fill[0];
      g.fillRect(x + (bw - tw) / 2, top - th, tw, th + 1);
      g.fillStyle = rgba(o.edge, o.edgeAlpha);
      g.fillRect(x + (bw - tw) / 2, top - th, tw, 1);
      roof = top - th;
    }
    // Rim light on the roof edge
    g.fillStyle = rgba(o.edge, o.edgeAlpha);
    g.fillRect(x, top, bw, 1);

    // Antenna (+ beacon)
    if (o.antenna && rand() < o.antenna) {
      const ax = x + bw * between(rand, 0.3, 0.7);
      const ah = between(rand, 8, 28);
      g.fillStyle = o.fill[0];
      g.fillRect(ax, roof - ah, 1.2, ah);
      if (o.beacons && out) out.beacons.push(ax + 0.6, roof - ah);
    }

    // Windows
    if (winCount) {
      const cols = Math.floor((bw - o.wx * 2) / o.gx);
      const rows = Math.floor((bh - 10) / o.gy);
      const chance = o.winChance * between(rand, 0.35, 1.5);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rand() > chance) continue;
          const wx = x + o.wx + c * o.gx;
          const wy = top + 7 + r * o.gy;
          if (out && out.flicker && rand() < 0.012 && out.flicker.length < 90) {
            out.flicker.push(wx, wy, o.ww, o.wh);
            continue;
          }
          g.globalAlpha = between(rand, 0.3, 1) * o.winAlpha;
          g.fillStyle = o.win[(rand() * winCount) | 0];
          g.fillRect(wx, wy, o.ww, o.wh);
        }
      }
      g.globalAlpha = 1;
    }

    // Neon signage (glow baked once)
    if (signs > 0 && o.neon && bh > 60 && rand() < 0.35) {
      signs--;
      const col = o.neon[(rand() * o.neon.length) | 0];
      const sh = bh * between(rand, 0.22, 0.42);
      const sx = rand() < 0.5 ? x - 1 : x + bw - 2;
      const sy = top + bh * between(rand, 0.1, 0.35);
      g.save();
      g.shadowColor = col;
      g.shadowBlur = 14;
      g.globalAlpha = 0.72;
      g.fillStyle = col;
      g.fillRect(sx, sy, 3, sh);
      g.globalAlpha = 0.5;
      g.fillRect(x + bw * 0.25, sy - 6, bw * 0.3, 3);
      g.restore();
    }
    x += bw + between(rand, -2, o.gap);
  }
}

/* =============================================================================
   Reusable dynamic systems
============================================================================= */

/** Twinkling parallax star field with optional drift. Typed arrays only. */
function createStarField(colors, rand) {
  const halos = colors.map((c) => glowSprite(c, 32));
  const k = colors.length;
  let n = 0, pad = 0, offs = null;
  let X, Y, Z, S, A, PH, SP;

  return {
    build(w, h, count, padding) {
      n = count;
      pad = padding;
      X = new Float32Array(n); Y = new Float32Array(n); Z = new Float32Array(n);
      S = new Float32Array(n); A = new Float32Array(n);
      PH = new Float32Array(n); SP = new Float32Array(n);
      offs = new Int32Array(k + 1);
      const per = Math.ceil(n / k);
      for (let c = 0; c <= k; c++) offs[c] = Math.min(n, c * per);
      for (let i = 0; i < n; i++) {
        const z = 0.2 + 0.8 * rand();
        Z[i] = z;
        X[i] = -pad + rand() * (w + pad * 2);
        Y[i] = -pad + rand() * (h + pad * 2);
        let s = 0.55 + z * z * 1.2 * (0.6 + 0.8 * rand());
        let a = 0.22 + 0.6 * z * (0.6 + 0.4 * rand());
        if (rand() < 0.05) { s += 0.9; a = 0.9; }
        S[i] = s; A[i] = a;
        PH[i] = rand() * TAU;
        SP[i] = 0.4 + rand() * 1.6;
      }
    },
    draw(ctx, w, h, t, dt, mx, my, amp, vx, vy, twinkle) {
      for (let c = 0; c < k; c++) {
        ctx.fillStyle = colors[c];
        const halo = halos[c];
        for (let i = offs[c]; i < offs[c + 1]; i++) {
          const z = Z[i];
          if (vx) {
            X[i] += vx * z * dt;
            if (X[i] > w + pad) X[i] -= w + pad * 2;
            else if (X[i] < -pad) X[i] += w + pad * 2;
          }
          if (vy) {
            Y[i] += vy * z * dt;
            if (Y[i] > h + pad) Y[i] -= h + pad * 2;
            else if (Y[i] < -pad) Y[i] += h + pad * 2;
          }
          const px = X[i] - mx * amp * z;
          const py = Y[i] - my * amp * z;
          if (px < -4 || px > w + 4 || py < -4 || py > h + 4) continue;
          const a = A[i] * (1 - twinkle + twinkle * (0.5 + 0.5 * Math.sin(t * SP[i] + PH[i])));
          const s = S[i];
          if (s > 1.7) {
            ctx.globalAlpha = a * 0.45;
            ctx.drawImage(halo, px - s * 4, py - s * 4, s * 8, s * 8);
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.arc(px, py, s * 0.5, 0, TAU);
            ctx.fill();
          } else {
            ctx.globalAlpha = a;
            ctx.fillRect(px - s * 0.5, py - s * 0.5, s, s);
          }
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

/** One rare, faint shooting star at a time. */
function createShootingStar(range, rand) {
  const LEN = 150;
  const sprite = makeSprite(LEN, (g, s) => {
    const grad = g.createLinearGradient(0, 0, s, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.85, "rgba(220,232,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = grad;
    g.fillRect(0, s / 2 - 1, s, 2);
  });
  let next = between(rand, range[0] * 0.4, range[1] * 0.6);
  let age = -1, life = 1, x = 0, y = 0, ca = 1, sa = 0, speed = 700;

  return {
    draw(ctx, env) {
      if (age < 0) {
        if (env.t < next) return;
        age = 0;
        life = between(rand, 0.7, 1.1);
        const ang = between(rand, 0.3, 0.55);
        const rtl = rand() < 0.5;
        ca = rtl ? -Math.cos(ang) : Math.cos(ang);
        sa = Math.sin(ang);
        speed = between(rand, 620, 860);
        x = env.w * (rtl ? between(rand, 0.55, 1) : between(rand, 0, 0.45));
        y = env.h * between(rand, 0.02, 0.35);
      }
      age += env.dt;
      const p = age / life;
      if (p >= 1) {
        age = -1;
        next = env.t + between(rand, range[0], range[1]);
        return;
      }
      x += ca * speed * env.dt;
      y += sa * speed * env.dt;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.8;
      const d = env.dpr;
      ctx.setTransform(d * ca, d * sa, -d * sa, d * ca, d * x, d * y);
      ctx.drawImage(sprite, -LEN, -LEN / 2, LEN, LEN);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.globalAlpha = 1;
    },
  };
}

/** Batched rain streaks — one stroke() per depth layer. */
function createRain(defs, rand) {
  let layers = [];
  return {
    build(w, h) {
      const area = (w * h) / 1e5;
      layers = defs.map((def) => {
        const count = clamp(Math.round(area * def.density), 6, 420);
        const L = {
          def, count,
          x: new Float32Array(count), y: new Float32Array(count),
          l: new Float32Array(count), s: new Float32Array(count),
        };
        for (let i = 0; i < count; i++) {
          L.x[i] = rand() * (w + h * 0.4) - h * 0.2;
          L.y[i] = rand() * (h + 60) - 30;
          L.l[i] = between(rand, def.len[0], def.len[1]);
          L.s[i] = between(rand, def.speed[0], def.speed[1]);
        }
        return L;
      });
    },
    draw(ctx, w, h, dt, wind) {
      const spanLo = Math.min(0, -wind * h) - 20;
      const spanHi = Math.max(w, w - wind * h) + 20;
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        ctx.globalAlpha = L.def.alpha;
        ctx.strokeStyle = L.def.color;
        ctx.lineWidth = L.def.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < L.count; i++) {
          const sp = L.s[i];
          const len = L.l[i];
          let y = (L.y[i] += sp * dt);
          let x = (L.x[i] += wind * sp * dt);
          if (y - len > h) {
            y = L.y[i] = -len - Math.random() * 40;
            x = L.x[i] = spanLo + Math.random() * (spanHi - spanLo);
          }
          ctx.moveTo(x, y);
          ctx.lineTo(x - wind * len, y - len);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  };
}

/* =============================================================================
   SCENES
   Contract:  factory(cfg) → { build(env), draw(env) }
   env = { ctx, w, h, dpr, t, dt, mx, my, par, reduced }   (mutated in place)
   Coordinates are CSS pixels; the engine applies the dpr transform.
============================================================================= */

/* ------------------------------------------------------------------ NEBULA */
function nebulaScene(cfg) {
  const P = cfg.palette;
  const p = cfg.params;
  const rand = createRng(cfg.seed);
  const stars = createStarField(P.stars, rand);
  const shoot = createShootingStar(p.shooting, rand);
  const PAD = 70;
  let sky = null;
  let clouds = [];

  return {
    build({ ctx, w, h, dpr }) {
      sky = verticalGradient(ctx, 0, h, P.sky);
      clouds = P.clouds.map((def, i) =>
        buildCloudLayer(w + PAD * 2, h + PAD * 2, def, cfg.seed * 31 + i * 7, Math.min(dpr, 1))
      );
      stars.build(w, h, clamp(Math.round(((w * h) / 1e5) * p.starDensity), 24, 200), 30);
    },
    draw(env) {
      const { ctx, w, h, t, dt, mx, my, par } = env;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < clouds.length; i++) {
        const def = P.clouds[i];
        const L = clouds[i];
        const ox = -mx * par * 24 * def.depth + Math.sin(t * def.speed + i * 2.1) * def.drift;
        const oy = -my * par * 16 * def.depth + Math.cos(t * def.speed * 0.8 + i * 1.3) * def.drift * 0.5;
        ctx.globalAlpha = 0.88 + 0.12 * Math.sin(t * 0.11 + i * 1.7);
        ctx.drawImage(L.canvas, -PAD + ox, -PAD + oy, L.w, L.h);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      stars.draw(ctx, w, h, t, dt, mx * par, my * par, 14, 0, 0, p.twinkle);
      if (!env.reduced) shoot.draw(ctx, env);
    },
  };
}

/* -------------------------------------------------------------- MIDNIGHT RAIN */
function rainScene(cfg) {
  const P = cfg.palette;
  const p = cfg.params;
  const rand = createRng(cfg.seed);
  const rain = createRain(P.rain, rand);
  const PAD = 40;
  const RIPPLES = 22;
  let sky = null, world = null, fog = [], groundY = 0;
  let RX, RY, RA, RM, RS;
  let spawnAcc = 0;

  return {
    build({ ctx, w, h, dpr }) {
      groundY = h * p.groundY;
      sky = verticalGradient(ctx, 0, groundY, P.sky);

      // ---- static world: far skyline, bokeh, wet ground -------------------
      world = makeLayer(w + PAD * 2, h + PAD, dpr);
      const g = world.ctx;
      const sk = P.skyline;
      paintSkyline(
        g, world.w, groundY + 2,
        { ...sk, w: [40, 110], hMin: h * 0.08, hMax: h * 0.3, gap: 6, gx: 7, gy: 10, ww: 2, wh: 3, wx: 5, antenna: 0.15 },
        rand, null
      );
      g.fillStyle = verticalGradient(g, groundY, h + PAD, [[0, P.ground[0]], [1, P.ground[1]]]);
      g.fillRect(0, groundY, world.w, h + PAD - groundY);

      // bokeh + faint vertical reflections on the wet ground
      const nB = clamp(Math.round(w / 90), 6, 18);
      for (let i = 0; i < nB; i++) {
        const col = P.bokeh[(rand() * P.bokeh.length) | 0];
        const bx = rand() * world.w;
        const by = between(rand, groundY - h * 0.2, groundY - 4);
        const r = between(rand, 5, 13);
        const gr = g.createRadialGradient(bx, by, 0, bx, by, r);
        gr.addColorStop(0, rgba(col, 0.16));
        gr.addColorStop(0.7, rgba(col, 0.06));
        gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr;
        g.fillRect(bx - r, by - r, r * 2, r * 2);
        const rg = g.createLinearGradient(0, groundY, 0, groundY + h * 0.14);
        rg.addColorStop(0, rgba(col, 0.07));
        rg.addColorStop(1, rgba(col, 0));
        g.fillStyle = rg;
        g.fillRect(bx - r * 0.5, groundY, r, h * 0.14);
      }
      // horizon edge
      g.fillStyle = "rgba(140,170,210,0.08)";
      g.fillRect(0, groundY, world.w, 1);

      // ---- fog bands --------------------------------------------------------
      fog = P.fog.map((def, i) =>
        buildCloudLayer(w + PAD * 2, Math.max(40, h * def.h), def, cfg.seed * 17 + i * 5, Math.min(dpr, 0.75))
      );

      rain.build(w, h);

      RX = new Float32Array(RIPPLES); RY = new Float32Array(RIPPLES);
      RA = new Float32Array(RIPPLES).fill(1); RM = new Float32Array(RIPPLES); RS = new Float32Array(RIPPLES);
    },
    draw(env) {
      const { ctx, w, h, t, dt, mx, my, par } = env;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#060a12";
      ctx.fillRect(0, groundY - 1, w, h - groundY + 1);

      const wox = -mx * par * 12;
      const woy = -my * par * 6;
      ctx.drawImage(world.canvas, -PAD + wox, woy, world.w, world.h);

      for (let i = 0; i < fog.length; i++) {
        const def = P.fog[i];
        const L = fog[i];
        const ox = -mx * par * 18 * def.depth + Math.sin(t * def.speed + i * 2) * def.drift;
        ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.09 + i);
        ctx.drawImage(L.canvas, -PAD + ox, h * def.y - L.h * 0.5 + woy, L.w, L.h);
      }
      ctx.globalAlpha = 1;

      const wind = p.wind + mx * par * 0.045 + Math.sin(t * 0.17) * 0.025 + Math.sin(t * 0.61) * 0.01;
      rain.draw(ctx, w, h, dt, wind);

      // ---- ripples on the wet ground -----------------------------------------
      if (!env.reduced) {
        spawnAcc += dt * p.rippleRate;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          for (let i = 0; i < RIPPLES; i++) {
            if (RA[i] >= 1) {
              RX[i] = Math.random() * w;
              RY[i] = groundY + (h - groundY) * (0.18 + Math.random() * 0.78);
              RA[i] = 0;
              RM[i] = 12 + Math.random() * 20;
              RS[i] = 1 / (0.9 + Math.random() * 0.8);
              break;
            }
          }
        }
      }
      ctx.strokeStyle = P.ripple;
      ctx.lineWidth = 1;
      for (let i = 0; i < RIPPLES; i++) {
        if (RA[i] >= 1) continue;
        RA[i] += RS[i] * dt;
        const a = 1 - RA[i];
        const r = 2 + RM[i] * (1 - a * a);
        ctx.globalAlpha = a * a * 0.55;
        ctx.beginPath();
        ctx.ellipse(RX[i] + wox, RY[i] + woy, r, r * 0.27, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  };
}

/* ------------------------------------------------------------- SAKURA NIGHT */
function sakuraScene(cfg) {
  const P = cfg.palette;
  const p = cfg.params;
  const rand = createRng(cfg.seed);
  const PAD = 30;
  const SPR = 64;

  // petal sprites (built once)
  const sprites = P.petals.map(([base, tip]) =>
    makeSprite(SPR, (g, s) => {
      const grad = g.createLinearGradient(0, s * 0.92, 0, s * 0.08);
      grad.addColorStop(0, base);
      grad.addColorStop(1, tip);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.92);
      g.bezierCurveTo(s * 0.08, s * 0.7, s * 0.05, s * 0.22, s * 0.38, s * 0.08);
      g.quadraticCurveTo(s * 0.5, s * 0.22, s * 0.62, s * 0.08);
      g.bezierCurveTo(s * 0.95, s * 0.22, s * 0.92, s * 0.7, s * 0.5, s * 0.92);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.85);
      g.lineTo(s * 0.5, s * 0.3);
      g.stroke();
    })
  );

  let skyLayer = null, branch = null, anchor = { x: 0, y: 0 };
  let n = 0;
  let X, Y, Z, R, VR, FP, FV, SW, SF, SPH, V, VAR, SZ;

  const respawn = (i, w, h, initial) => {
    X[i] = initial ? -w * 0.3 + Math.random() * w * 1.3 : -w * 0.35 + Math.random() * w * 1.35;
    Y[i] = initial ? Math.random() * h : -24 - Math.random() * 60;
  };

  function blossom(g, x, y, r, rot) {
    g.fillStyle = P.blossom[(rand() * P.blossom.length) | 0];
    g.globalAlpha = between(rand, 0.78, 0.96);
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * TAU) / 5;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.56, r * 0.4, a, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 0.9;
    g.fillStyle = P.blossomCore;
    g.beginPath();
    g.arc(x, y, r * 0.2, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }

  return {
    build({ w, h, dpr }) {
      const u = clamp(Math.min(w, h * 1.6) / 1200, 0.5, 1.25);

      // ---- sky: gradient, moon, stars, ridges (static, tiny parallax) -----
      skyLayer = makeLayer(w + PAD * 2, h + PAD * 2, Math.min(dpr, 1.25));
      let g = skyLayer.ctx;
      g.fillStyle = verticalGradient(g, 0, skyLayer.h, P.sky);
      g.fillRect(0, 0, skyLayer.w, skyLayer.h);

      g.fillStyle = "#ffffff";
      for (let i = 0; i < 46; i++) {
        g.globalAlpha = between(rand, 0.1, 0.5);
        const s = between(rand, 0.5, 1.2);
        g.fillRect(rand() * skyLayer.w, rand() * skyLayer.h * 0.55, s, s);
      }
      g.globalAlpha = 1;

      const mxp = PAD + w * 0.17;
      const myp = PAD + h * 0.2;
      const mr = clamp(Math.min(w, h) * 0.04, 15, 40);
      const halo = g.createRadialGradient(mxp, myp, mr * 0.6, mxp, myp, mr * 7);
      halo.addColorStop(0, rgba(P.moon.halo, 0.22));
      halo.addColorStop(0.35, rgba(P.moon.halo, 0.06));
      halo.addColorStop(1, rgba(P.moon.halo, 0));
      g.fillStyle = halo;
      g.fillRect(mxp - mr * 7, myp - mr * 7, mr * 14, mr * 14);
      const disc = g.createRadialGradient(mxp - mr * 0.3, myp - mr * 0.3, mr * 0.1, mxp, myp, mr);
      disc.addColorStop(0, P.moon.light);
      disc.addColorStop(1, P.moon.dark);
      g.fillStyle = disc;
      g.beginPath();
      g.arc(mxp, myp, mr, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(190,150,175,0.10)";
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(mxp + between(rand, -0.55, 0.55) * mr, myp + between(rand, -0.55, 0.55) * mr, between(rand, 0.12, 0.3) * mr, 0, TAU);
        g.fill();
      }

      // distant ridges
      for (let r = 0; r < 2; r++) {
        const base = skyLayer.h - PAD - h * (0.13 - r * 0.06);
        const a1 = h * (0.03 + r * 0.01), f1 = 0.004 + r * 0.003, ph = rand() * TAU;
        g.fillStyle = P.ridges[r];
        g.globalAlpha = r === 0 ? 0.85 : 1;
        g.beginPath();
        g.moveTo(0, skyLayer.h);
        for (let x = 0; x <= skyLayer.w; x += 8) {
          g.lineTo(x, base - a1 * (0.6 + 0.4 * Math.sin(x * f1 + ph)) - a1 * 0.5 * Math.sin(x * f1 * 2.7 + ph * 1.7));
        }
        g.lineTo(skyLayer.w, skyLayer.h);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
      const mist = verticalGradient(g, skyLayer.h * 0.7, skyLayer.h, [[0, "rgba(120,70,130,0)"], [1, "rgba(150,90,150,0.16)"]]);
      g.fillStyle = mist;
      g.fillRect(0, skyLayer.h * 0.7, skyLayer.w, skyLayer.h * 0.3);

      // ---- blossoming branch, top-right ----------------------------------
      const bw = Math.min(w * 0.78, 1000 * u) + PAD * 2;
      const bh = Math.min(h * 0.72, 680 * u) + PAD;
      branch = makeLayer(bw, bh, dpr);
      g = branch.ctx;
      g.lineCap = "round";
      g.strokeStyle = P.branch;
      anchor.x = bw - PAD + 6;
      anchor.y = PAD - 4;

      const grow = (x, y, ang, len, wd, depth) => {
        if (len < 7 * u || wd < 0.6) return;
        let a = ang;
        const segs = 2;
        let px = x, py = y;
        for (let s = 0; s < segs; s++) {
          a += (rand() - 0.5) * 0.5 + (Math.PI / 2 - a) * 0.05;
          a = clamp(a, 0.3, Math.PI + 0.7);
          const sl = len / segs;
          const nx = px + Math.cos(a) * sl;
          const ny = py + Math.sin(a) * sl;
          const cx = (px + nx) / 2 + (rand() - 0.5) * sl * 0.35;
          const cy = (py + ny) / 2 + (rand() - 0.5) * sl * 0.35;
          g.lineWidth = wd * (1 - (s / segs) * 0.28);
          g.beginPath();
          g.moveTo(px, py);
          g.quadraticCurveTo(cx, cy, nx, ny);
          g.stroke();
          if (depth >= 2 && rand() < 0.42) {
            blossom(g, nx + between(rand, -6, 6) * u, ny + between(rand, -2, 9) * u, between(rand, 4.2, 7.6) * u, rand() * TAU);
          }
          if (s === 0 && depth < 5 && rand() < 0.5) {
            grow(nx, ny, a + (rand() < 0.5 ? -1 : 1) * between(rand, 0.4, 0.9), len * 0.62, wd * 0.6, depth + 1);
          }
          px = nx; py = ny;
        }
        if (depth < 5) {
          grow(px, py, a + between(rand, 0.3, 0.75), len * 0.74, wd * 0.64, depth + 1);
          grow(px, py, a - between(rand, 0.3, 0.75), len * 0.68, wd * 0.58, depth + 1);
        } else {
          for (let k = 0; k < 2; k++) {
            blossom(g, px + between(rand, -9, 9) * u, py + between(rand, -4, 12) * u, between(rand, 4.5, 8) * u, rand() * TAU);
          }
        }
      };
      grow(anchor.x, anchor.y, Math.PI - 0.2, 200 * u, 10 * u, 0);

      // ---- petals ---------------------------------------------------------
      n = clamp(Math.round(((w * h) / 1e5) * p.petalDensity), 16, 60);
      X = new Float32Array(n); Y = new Float32Array(n); Z = new Float32Array(n);
      R = new Float32Array(n); VR = new Float32Array(n); FP = new Float32Array(n);
      FV = new Float32Array(n); SW = new Float32Array(n); SF = new Float32Array(n);
      SPH = new Float32Array(n); V = new Float32Array(n); SZ = new Float32Array(n);
      VAR = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const z = 0.35 + 0.65 * rand();
        Z[i] = z;
        SZ[i] = (7 + 9 * z) * (0.85 + 0.3 * rand()) * clamp(u * 1.1, 0.75, 1.15);
        R[i] = rand() * TAU;
        VR[i] = between(rand, -1.1, 1.1);
        FP[i] = rand() * TAU;
        FV[i] = between(rand, 0.8, 2.2);
        SW[i] = between(rand, 6, 22);
        SF[i] = between(rand, 0.4, 1.1);
        SPH[i] = rand() * TAU;
        V[i] = 16 + z * 26 + rand() * 8;
        VAR[i] = (rand() * sprites.length) | 0;
        respawn(i, w, h, true);
      }
    },
    draw(env) {
      const { ctx, w, h, dpr, t, dt, mx, my, par } = env;
      ctx.drawImage(skyLayer.canvas, -PAD - mx * par * 6, -PAD - my * par * 4, skyLayer.w, skyLayer.h);

      // branch — nearest depth, sways gently around its anchor
      const sway = Math.sin(t * 0.42) * 0.0045 + Math.sin(t * 0.17) * 0.003;
      const ca = Math.cos(sway), sa = Math.sin(sway);
      const ax = w + 6 - mx * par * 26;
      const ay = -4 - my * par * 14;
      ctx.setTransform(dpr * ca, dpr * sa, -dpr * sa, dpr * ca, dpr * ax, dpr * ay);
      ctx.drawImage(branch.canvas, -anchor.x, -anchor.y, branch.w, branch.h);

      // petals
      const wind = p.wind + mx * par * 16 + Math.sin(t * 0.14) * 9 + Math.sin(t * 0.53) * 4;
      for (let i = 0; i < n; i++) {
        const z = Z[i];
        Y[i] += V[i] * dt;
        X[i] += (wind * (0.5 + z * 0.6) + Math.sin(t * SF[i] + SPH[i]) * SW[i]) * dt;
        R[i] += VR[i] * dt;
        FP[i] += FV[i] * dt;
        if (Y[i] > h + 30 || X[i] > w + 60 || X[i] < -w * 0.45) respawn(i, w, h, false);

        const s = SZ[i];
        const flip = 0.2 + 0.8 * Math.abs(Math.cos(FP[i]));
        const c = Math.cos(R[i]), sn = Math.sin(R[i]);
        const sx = s * dpr;
        ctx.globalAlpha = 0.3 + 0.6 * z;
        ctx.setTransform(c * sx, sn * sx, -sn * sx * flip, c * sx * flip, dpr * (X[i] - mx * par * 10 * z), dpr * (Y[i] - my * par * 6 * z));
        ctx.drawImage(sprites[VAR[i]], -0.5, -0.5, 1, 1);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    },
  };
}

/* --------------------------------------------------------------- CYBER CITY */
function cityScene(cfg) {
  const P = cfg.palette;
  const p = cfg.params;
  const rand = createRng(cfg.seed);
  const rain = createRain(P.rain, rand);
  const PAD = 44;
  const PADY = 24;
  const beaconGlow = glowSprite("#ff5a6e", 24);
  const trailSprites = P.traffic.map((c) => [
    // [travelling right, travelling left]
    makeSprite(64, (g, s) => {
      const grad = g.createLinearGradient(0, 0, s, 0);
      grad.addColorStop(0, rgba(c, 0));
      grad.addColorStop(1, rgba(c, 0.95));
      g.fillStyle = grad;
      g.fillRect(0, s / 2 - 1, s, 2);
    }),
    makeSprite(64, (g, s) => {
      const grad = g.createLinearGradient(0, 0, s, 0);
      grad.addColorStop(0, rgba(c, 0.95));
      grad.addColorStop(1, rgba(c, 0));
      g.fillStyle = grad;
      g.fillRect(0, s / 2 - 1, s, 2);
    }),
  ]);

  let skyLayer = null, layers = [], haze = [], laneY = 0, trafficAfter = 0;
  let CX, CV, CT, CL;

  return {
    build({ ctx, w, h, dpr }) {
      // ---- sky ----------------------------------------------------------------
      skyLayer = makeLayer(w, h, Math.min(dpr, 1));
      let g = skyLayer.ctx;
      g.fillStyle = verticalGradient(g, 0, h, P.sky);
      g.fillRect(0, 0, w, h);
      const gl = g.createRadialGradient(w * 0.5, h * 0.9, 0, w * 0.5, h * 0.9, w * 0.55);
      gl.addColorStop(0, rgba(P.glow.color, P.glow.alpha * 1.6));
      gl.addColorStop(1, rgba(P.glow.color, 0));
      g.save();
      g.translate(w * 0.5, h * 0.9);
      g.scale(1, 0.42);
      g.translate(-w * 0.5, -h * 0.9);
      g.fillStyle = gl;
      g.fillRect(0, 0, w, h * 1.6);
      g.restore();
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 40; i++) {
        g.globalAlpha = between(rand, 0.08, 0.4);
        g.fillRect(rand() * w, rand() * h * 0.5, 1, 1);
      }
      g.globalAlpha = 1;

      // ---- skyline layers --------------------------------------------------------
      layers = P.layers.map((def) => {
        const hMin = h * def.h[0];
        const hMax = h * def.h[1];
        const lh = Math.ceil(hMax + 40) + PADY;
        const L = makeLayer(w + PAD * 2, lh, dpr);
        L.def = def;
        L.baseY = lh - PADY;
        L.top = h - L.baseY; // screen y of layer origin
        L.beacons = [];
        L.flicker = [];
        paintSkyline(
          L.ctx, L.w, L.baseY,
          { ...def, hMin, hMax, neon: P.neon },
          rand, L
        );
        return L;
      });
      haze = P.layers.map((def) => {
        if (!def.haze) return null;
        return verticalGradient(ctx, h * 0.3, h, [[0, rgba(P.fog, 0)], [1, rgba(P.fog, def.haze)]]);
      });

      laneY = h * p.laneY;
      const n = clamp(Math.round(w / 110), 6, p.cars);
      CX = new Float32Array(n); CV = new Float32Array(n);
      CT = new Uint8Array(n); CL = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        CX[i] = rand() * (w + PAD * 2) - PAD;
        const dir = rand() < 0.5 ? 1 : -1;
        CV[i] = dir * between(rand, 22, 58);
        CT[i] = dir > 0 ? 0 : 1;
        CL[i] = between(rand, 0.7, 1.2);
      }
    
      rain.build(w, h);
    },
    draw(env) {
      const { ctx, w, h, t, dt, mx, my, par } = env;
      ctx.drawImage(skyLayer.canvas, 0, 0, w, h);

      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        const d = L.def.depth;
        const ox = -mx * par * 22 * d - PAD;
        const oy = -my * par * 7 * d + L.top;
        ctx.drawImage(L.canvas, ox, oy, L.w, L.h);

        // flickering windows
        const fl = L.flicker;
        if (fl.length) {
          ctx.fillStyle = P.flicker;
          for (let i = 0; i < fl.length; i += 4) {
            const ph = i * 0.73;
            const on = Math.sin(t * (0.25 + (i % 7) * 0.05) + ph) + Math.sin(t * 0.11 + ph * 2);
            if (on < 0.6) continue;
            ctx.globalAlpha = clamp((on - 0.6) * 0.9, 0, 0.55);
            ctx.fillRect(ox + fl[i], oy + fl[i + 1], fl[i + 2], fl[i + 3]);
          }
          ctx.globalAlpha = 1;
        }
        // beacons
        const bc = L.beacons;
        for (let i = 0; i < bc.length; i += 2) {
          const a = 0.5 + 0.5 * Math.sin(t * 1.4 + i * 1.9);
          ctx.globalAlpha = a * a * 0.85;
          ctx.drawImage(beaconGlow, ox + bc[i] - 6, oy + bc[i + 1] - 6, 12, 12);
        }
        ctx.globalAlpha = 1;

        // distant elevated traffic: in front of the far skyline, behind the mid one
        if (li === trafficAfter) {
          for (let i = 0; i < CX.length; i++) {
            CX[i] += CV[i] * dt;
            if (CX[i] > w + PAD) CX[i] = -PAD;
            else if (CX[i] < -PAD) CX[i] = w + PAD;
            const spr = trailSprites[CT[i]][CV[i] > 0 ? 0 : 1];
            const len = 44 * CL[i];
            ctx.globalAlpha = 0.8;
            ctx.drawImage(spr, 0, 31, 64, 2, CV[i] > 0 ? CX[i] - len : CX[i], laneY - my * par * 7 * d + (i % 3) * 2.5, len, 2);
          }
          ctx.globalAlpha = 1;
        }

        if (haze[li]) {
          ctx.fillStyle = haze[li];
          ctx.fillRect(0, h * 0.3, w, h * 0.7);
        }
      }

      const wind = p.wind + mx * par * 0.05 + Math.sin(t * 0.2) * 0.02;
      rain.draw(ctx, w, h, dt, wind);
    },
  };
}

/* --------------------------------------------------------------- DEEP SPACE */
function spaceScene(cfg) {
  const P = cfg.palette;
  const p = cfg.params;
  const rand = createRng(cfg.seed);
  const stars = createStarField(P.stars, rand);
  const shoot = createShootingStar(p.shooting, rand);
  const PAD = 50;
  let sky = null, band = null, planet = null, pr = 0;

  return {
    build({ ctx, w, h, dpr }) {
      sky = verticalGradient(ctx, 0, h, P.sky);
      band = buildCloudLayer(w + PAD * 2, h + PAD * 2, { ...P.band, band: { angle: P.band.angle, width: P.band.width } }, cfg.seed * 13, Math.min(dpr, 1));
      stars.build(w, h, clamp(Math.round(((w * h) / 1e5) * p.starDensity), 60, 420), 30);

      // planet: lit limb, terminator, atmosphere rim
      const pl = P.planet;
      pr = Math.min(w, h) * pl.r;
      const size = Math.ceil(pr * 2 + 80);
      planet = makeLayer(size, size, dpr);
      const g = planet.ctx;
      const c = size / 2;
      const atm = g.createRadialGradient(c, c, pr * 0.96, c, c, pr * 1.28);
      atm.addColorStop(0, rgba(pl.rim, 0.22));
      atm.addColorStop(0.35, rgba(pl.rim, 0.06));
      atm.addColorStop(1, rgba(pl.rim, 0));
      g.fillStyle = atm;
      g.fillRect(0, 0, size, size);
      const body = g.createRadialGradient(c - pr * 0.45, c - pr * 0.4, pr * 0.05, c - pr * 0.15, c - pr * 0.1, pr * 1.25);
      body.addColorStop(0, pl.lit);
      body.addColorStop(0.45, pl.mid);
      body.addColorStop(1, pl.dark);
      g.save();
      g.beginPath();
      g.arc(c, c, pr, 0, TAU);
      g.clip();
      g.fillStyle = body;
      g.fillRect(0, 0, size, size);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = rgba(i % 2 ? "#9fb6e6" : "#0a1226", between(rand, 0.04, 0.09));
        g.fillRect(0, c - pr + rand() * pr * 2, size, between(rand, 2, pr * 0.14));
      }
      const term = g.createLinearGradient(c - pr, c - pr, c + pr, c + pr);
      term.addColorStop(0, "rgba(0,0,0,0)");
      term.addColorStop(0.55, "rgba(0,0,0,0.25)");
      term.addColorStop(1, "rgba(0,0,0,0.7)");
      g.fillStyle = term;
      g.fillRect(0, 0, size, size);
      g.restore();
      g.strokeStyle = rgba(pl.rim, 0.28);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(c, c, pr - 0.5, Math.PI * 0.92, Math.PI * 1.62);
      g.stroke();
    },
    draw(env) {
      const { ctx, w, h, t, dt, mx, my, par } = env;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const b = P.band;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 0.08);
      ctx.drawImage(
        band.canvas,
        -PAD - mx * par * 18 * b.depth + Math.sin(t * b.speed) * b.drift,
        -PAD - my * par * 10 * b.depth + Math.cos(t * b.speed * 0.8) * b.drift * 0.5,
        band.w, band.h
      );
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      stars.draw(ctx, w, h, t, dt, mx * par, my * par, 26, p.drift[0], p.drift[1], p.twinkle);

      const pl = P.planet;
      ctx.drawImage(
        planet.canvas,
        w * pl.x - planet.w / 2 - mx * par * 16,
        h * pl.y - planet.h / 2 - my * par * 10,
        planet.w, planet.h
      );
      if (!env.reduced) shoot.draw(ctx, env);
    },
  };
}

/* -------------------------------------------------------------- LOFI WINDOW */
function lofiScene(cfg) {
  const P = cfg.palette;
  const p = cfg.params;
  const rand = createRng(cfg.seed);
  const rain = createRain(P.rain, rand);
  const PAD = 38;
  const dropSprite = makeSprite(24, (g, s) => {
    const c = s / 2;
    const fill = g.createRadialGradient(c, c * 1.15, 0, c, c, c);
    fill.addColorStop(0, "rgba(190,205,255,0.10)");
    fill.addColorStop(0.8, "rgba(190,205,255,0.16)");
    fill.addColorStop(1, "rgba(220,230,255,0.4)");
    g.fillStyle = fill;
    g.beginPath();
    g.arc(c, c, c - 1, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.beginPath();
    g.arc(c * 0.72, c * 0.7, c * 0.2, 0, TAU);
    g.fill();
  });
  const steamSprite = glowSprite("#ffffff", 40);
  const NSLIDE = 9, NSTEAM = 8;

  let open = null;
  let outdoor = null, glass = null, room = null, lampGrad = null, mug = { x: 0, y: 0 };
  let SX, SY, SS, SV, SL, SR;   // sliding drops
  let TX, TA, TS, TP;           // steam

  const resetSlide = (i, first) => {
    SX[i] = open.x0 + 10 + Math.random() * (open.x1 - open.x0 - 20);
    SY[i] = open.y0 + (first ? Math.random() : 0.02 * Math.random()) * (open.y1 - open.y0) * 0.8;
    SS[i] = SY[i];
    SV[i] = 5 + Math.random() * 14;
    SR[i] = 2.2 + Math.random() * 1.8;
    SL[i] = Math.random() * 100;
  };

  return {
    build({ ctx, w, h, dpr }) {
      const u = clamp(Math.min(w, h * 1.5) / 1200, 0.55, 1.25);
      const mxw = Math.max(26, w * 0.055);
      open = { x0: mxw, x1: w - mxw, y0: Math.max(22, h * 0.065), y1: h * 0.86 };
      const ow = open.x1 - open.x0;
      const oh = open.y1 - open.y0;

      // ---- outdoors: dusk sky, moon, two skylines ----------------------------
      outdoor = makeLayer(w + PAD * 2, h + PAD * 2, Math.min(dpr, 1.25));
      let g = outdoor.ctx;
      g.fillStyle = verticalGradient(g, 0, outdoor.h, P.sky);
      g.fillRect(0, 0, outdoor.w, outdoor.h);
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 40; i++) {
        g.globalAlpha = between(rand, 0.08, 0.35);
        g.fillRect(rand() * outdoor.w, rand() * outdoor.h * 0.45, 1, 1);
      }
      g.globalAlpha = 1;
      const moonX = PAD + open.x0 + ow * 0.2;
      const moonY = PAD + open.y0 + oh * 0.36;
      const mr = clamp(Math.min(w, h) * 0.028, 10, 26);
      const halo = g.createRadialGradient(moonX, moonY, 0, moonX, moonY, mr * 8);
      halo.addColorStop(0, rgba(P.moon, 0.2));
      halo.addColorStop(1, rgba(P.moon, 0));
      g.fillStyle = halo;
      g.fillRect(moonX - mr * 8, moonY - mr * 8, mr * 16, mr * 16);
      g.fillStyle = rgba(P.moon, 0.9);
      g.beginPath();
      g.arc(moonX, moonY, mr, 0, TAU);
      g.fill();

      const baseY = PAD + open.y1 + 2;
      paintSkyline(g, outdoor.w, baseY, { ...P.far, w: [34, 80], hMin: oh * 0.1, hMax: oh * 0.42, gap: 4, antenna: 0.2 }, rand, null);
      g.fillStyle = verticalGradient(g, baseY - oh * 0.3, baseY, [[0, "rgba(120,80,140,0)"], [1, "rgba(140,90,150,0.2)"]]);
      g.fillRect(0, baseY - oh * 0.3, outdoor.w, oh * 0.3 + 4);
      paintSkyline(g, outdoor.w, baseY + 2, { ...P.near, w: [60, 140], hMin: oh * 0.05, hMax: oh * 0.22, gap: 8, antenna: 0.1 }, rand, null);

      // ---- glass: reflection + resting droplets --------------------------------
      glass = makeLayer(ow, oh, dpr);
      g = glass.ctx;
      const refl = g.createLinearGradient(0, 0, ow, oh);
      refl.addColorStop(0, "rgba(255,255,255,0)");
      refl.addColorStop(0.32, "rgba(255,255,255,0.035)");
      refl.addColorStop(0.42, "rgba(255,255,255,0)");
      refl.addColorStop(0.7, "rgba(255,255,255,0.022)");
      refl.addColorStop(0.78, "rgba(255,255,255,0)");
      g.fillStyle = refl;
      g.fillRect(0, 0, ow, oh);
      const nDrops = clamp(Math.round((ow * oh) / 9000), 24, 110);
      for (let i = 0; i < nDrops; i++) {
        const r = between(rand, 0.9, 3.3) * (0.7 + rand() * 0.6);
        g.globalAlpha = between(rand, 0.35, 0.9);
        g.drawImage(dropSprite, rand() * ow - r, rand() * oh - r, r * 2, r * 2.3);
      }
      g.globalAlpha = 1;

      // ---- room: wall, window frame, sill, plant, mug ---------------------------
      room = makeLayer(w + PAD * 2, h + PAD * 2, dpr);
      g = room.ctx;
      g.fillStyle = verticalGradient(g, 0, room.h, [[0, P.wall[0]], [1, P.wall[1]]]);
      g.fillRect(0, 0, room.w, room.h);
      const ox0 = PAD + open.x0, oy0 = PAD + open.y0, ox1 = PAD + open.x1, oy1 = PAD + open.y1;
      g.globalCompositeOperation = "destination-out";
      roundRectPath(g, ox0, oy0, ow, oh, 8);
      g.fillStyle = "#000";
      g.fill();
      g.globalCompositeOperation = "source-over";

      // frame + mullions
      const fw = Math.max(9, 14 * u);
      g.strokeStyle = P.frame;
      g.lineWidth = fw;
      roundRectPath(g, ox0 - fw / 2 + 1, oy0 - fw / 2 + 1, ow + fw - 2, oh + fw - 2, 10);
      g.stroke();
      g.fillStyle = P.frame;
      const vx = ox0 + ow * 0.72;
      const ty = oy0 + oh * 0.17;
      g.fillRect(vx - 4 * u, oy0, 8 * u, oh);
      g.fillRect(ox0, ty - 3.5 * u, ow, 7 * u);
      g.strokeStyle = "rgba(255,222,190,0.07)";
      g.lineWidth = 1;
      roundRectPath(g, ox0 + 0.5, oy0 + 0.5, ow - 1, oh - 1, 8);
      g.stroke();
      g.beginPath();
      g.moveTo(vx - 4 * u + 0.5, oy0); g.lineTo(vx - 4 * u + 0.5, oy1);
      g.moveTo(ox0, ty - 3.5 * u + 0.5); g.lineTo(ox1, ty - 3.5 * u + 0.5);
      g.stroke();

      // sill
      const sillTop = oy1 + 2;
      g.fillStyle = verticalGradient(g, sillTop, room.h, [[0, P.wood[0]], [1, P.wood[1]]]);
      g.fillRect(0, sillTop, room.w, room.h - sillTop);
      g.fillStyle = "rgba(255,206,160,0.14)";
      g.fillRect(0, sillTop, room.w, 1.5);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(0, sillTop - 5, room.w, 5);

      // plant (left)
      const px = ox0 + ow * 0.12;
      const pw = 36 * u, ph = 40 * u;
      const leafN = 9;
      for (let i = 0; i < leafN; i++) {
        const a = -Math.PI / 2 + (i / (leafN - 1) - 0.5) * 2.3 + between(rand, -0.1, 0.1);
        const len = between(rand, 60, 124) * u;
        const bx = px, by = sillTop - ph + 2;
        const tx = bx + Math.cos(a) * len, tyy = by + Math.sin(a) * len;
        const nx = -Math.sin(a), ny = Math.cos(a);
        const wd = len * 0.16;
        const lg = g.createLinearGradient(bx, by, tx, tyy);
        lg.addColorStop(0, P.leaf[1]);
        lg.addColorStop(1, P.leaf[0]);
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo((bx + tx) / 2 + nx * wd, (by + tyy) / 2 + ny * wd, tx, tyy);
        g.quadraticCurveTo((bx + tx) / 2 - nx * wd, (by + tyy) / 2 - ny * wd, bx, by);
        g.fill();
        g.strokeStyle = "rgba(160,230,210,0.10)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(tx, tyy);
        g.stroke();
      }
      g.fillStyle = "#2b1a1c";
      g.beginPath();
      g.moveTo(px - pw / 2, sillTop - ph);
      g.lineTo(px + pw / 2, sillTop - ph);
      g.lineTo(px + pw * 0.38, sillTop);
      g.lineTo(px - pw * 0.38, sillTop);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,190,140,0.10)";
      g.fillRect(px - pw / 2, sillTop - ph, pw * 0.3, ph);

      // mug (right)
      const mgx = ox0 + ow * 0.6;
      const mw = 42 * u, mh = 38 * u;
      g.fillStyle = P.mug;
      g.globalAlpha = 0.9;
      roundRectPath(g, mgx - mw / 2, sillTop - mh, mw, mh, 5 * u);
      g.fill();
      g.strokeStyle = P.mug;
      g.lineWidth = 4 * u;
      g.beginPath();
      g.arc(mgx + mw / 2, sillTop - mh * 0.52, mh * 0.27, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = "#24140f";
      g.beginPath();
      g.ellipse(mgx, sillTop - mh + 1, mw * 0.42, 3 * u, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(60,30,20,0.35)";
      g.fillRect(mgx + mw * 0.05, sillTop - mh, mw * 0.45, mh);
      mug = { x: mgx - PAD, y: sillTop - PAD - mh };

      // warm lamp light from the lower-left
      lampGrad = ctx.createRadialGradient(w * 0.04, h * 1.02, 0, w * 0.04, h * 1.02, Math.max(w, h) * 0.7);
      lampGrad.addColorStop(0, rgba(P.lamp, 0.42));
      lampGrad.addColorStop(0.4, rgba(P.lamp, 0.13));
      lampGrad.addColorStop(1, rgba(P.lamp, 0));

      // dynamic pools
      SX = new Float32Array(NSLIDE); SY = new Float32Array(NSLIDE); SS = new Float32Array(NSLIDE);
      SV = new Float32Array(NSLIDE); SL = new Float32Array(NSLIDE); SR = new Float32Array(NSLIDE);
      for (let i = 0; i < NSLIDE; i++) resetSlide(i, true);
      TX = new Float32Array(NSTEAM); TA = new Float32Array(NSTEAM);
      TS = new Float32Array(NSTEAM); TP = new Float32Array(NSTEAM);
      for (let i = 0; i < NSTEAM; i++) {
        TA[i] = i / NSTEAM;
        TS[i] = 1 / between(rand, 3.2, 4.6);
        TP[i] = rand() * TAU;
        TX[i] = between(rand, -3, 3);
      }
      rain.build(open.x1 - open.x0, oh);
    },
    draw(env) {
      const { ctx, w, h, dpr, t, dt, mx, my, par } = env;
      const ow = open.x1 - open.x0;
      const oh = open.y1 - open.y0;

      // parallax: room sits nearer than the outside world
      const rox = -mx * par * 14, roy = -my * par * 8;
      const oox = -mx * par * 5, ooy = -my * par * 3;

      ctx.drawImage(outdoor.canvas, -PAD + oox, -PAD + ooy, outdoor.w, outdoor.h);

      // rain outside — clipped to the glass
      ctx.save();
      ctx.beginPath();
      ctx.rect(open.x0 + rox, open.y0 + roy, ow, oh);
      ctx.clip();
      ctx.translate(open.x0 + rox, open.y0 + roy);
      rain.draw(ctx, ow, oh, dt, p.wind + Math.sin(t * 0.2) * 0.02);
      ctx.restore();

      // glass
      ctx.drawImage(glass.canvas, open.x0 + rox, open.y0 + roy, glass.w, glass.h);

      // sliding drops with faint trails
      ctx.lineCap = "round";
      for (let i = 0; i < NSLIDE; i++) {
        if (!env.reduced) {
          // stop-and-go motion, like real beads of water
          const k = 0.35 + 0.65 * Math.max(0, Math.sin(t * 0.9 + SL[i]));
          SY[i] += SV[i] * k * dt;
          SX[i] += Math.sin(t * 0.7 + SL[i] * 3) * 0.6 * dt;
          if (SY[i] > open.y1 + 12) resetSlide(i, false);
        }
        const x = SX[i] + rox, y = SY[i] + roy;
        const tail = Math.max(SS[i], SY[i] - 90) + roy;
        ctx.globalAlpha = 0.09;
        ctx.strokeStyle = "#c4d0ff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, tail);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        const r = SR[i];
        ctx.drawImage(dropSprite, x - r, y - r, r * 2, r * 2.4);
      }
      ctx.globalAlpha = 1;

      // room (wall, frame, sill, plant, mug)
      ctx.drawImage(room.canvas, -PAD + rox, -PAD + roy, room.w, room.h);

      // steam
      for (let i = 0; i < NSTEAM; i++) {
        if (!env.reduced) TA[i] = (TA[i] + TS[i] * dt) % 1;
        const a = TA[i];
        const s = 8 + a * 26;
        const x = mug.x + rox + TX[i] + Math.sin(a * 5 + TP[i] + t * 0.6) * (3 + a * 9);
        const y = mug.y + roy - a * 74;
        ctx.globalAlpha = Math.sin(a * Math.PI) * 0.2;
        ctx.drawImage(steamSprite, x - s, y - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;

      // lamp glow (breathing)
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.92 + 0.06 * Math.sin(t * 0.9) + 0.02 * Math.sin(t * 3.7);
      ctx.fillStyle = lampGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
  };
}

/* ---- unknown renderer: a calm gradient rather than a crash --------------- */
function fallbackScene(cfg) {
  let fill = cfg.base;
  return {
    build({ ctx, h }) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, cfg.base);
      g.addColorStop(1, "#111118");
      fill = g;
    },
    draw({ ctx, w, h }) {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

const SCENES = {
  nebula: nebulaScene,
  rain: rainScene,
  sakura: sakuraScene,
  city: cityScene,
  space: spaceScene,
  lofi: lofiScene,
};

/* =============================================================================
   React layer
============================================================================= */

let grainURL = null;
function getGrainURL() {
  if (grainURL || typeof document === "undefined") return grainURL;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const img = g.createImageData(128, 128);
  const rand = createRng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rand() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainURL = c.toDataURL("image/png");
  return grainURL;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReduced = () => window.matchMedia(REDUCED_QUERY).matches;

function SceneCanvas({ cfg, reduced, interactive }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const host = canvas.parentElement;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return undefined;

    const scene = (SCENES[cfg.renderer] || fallbackScene)(cfg);
    const env = {
      ctx, w: 0, h: 0, dpr: 1,
      t: cfg.staticTime ?? 10, dt: 0, mx: 0, my: 0,
      par: reduced ? 0 : cfg.parallax ?? 1,
      reduced,
    };
    const interval = 1000 / (cfg.fps || 60);
    let raf = 0, last = -1, tx = 0, ty = 0, resizeTimer = 0;
    let disposed = false, built = false;

    const measure = () => {
      const r = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      const dpr = clamp(window.devicePixelRatio || 1, 1, cfg.maxDpr || 1.5);
      if (built && w === env.w && h === env.h && dpr === env.dpr) return false;
      env.w = w; env.h = h; env.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.build(env);
      built = true;
      return true;
    };

    const paint = () => {
      ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      scene.draw(env);
    };

    const frame = (now) => {
      raf = 0;
      if (disposed || document.hidden) return;
      if (last < 0) last = now - interval;
      const elapsed = now - last;
      if (elapsed < interval - 1.5) {
        raf = requestAnimationFrame(frame);
        return;
      }
      last = now;
      const dt = Math.min(elapsed, 100) / 1000;
      env.dt = dt;
      env.t += dt;
      const k = 1 - Math.exp(-dt * 3.2);
      env.mx += (tx - env.mx) * k;
      env.my += (ty - env.my) * k;
      paint();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || disposed || reduced || document.hidden) return;
      last = -1; // no time jump after a pause
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (disposed) return;
        env.dt = 0;
        if (measure()) paint();
      }, 140);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onPointer = (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onPointerEnd = (e) => {
      if (e.pointerType === "touch") tx = ty = 0;
    };
    const onLeave = () => { tx = ty = 0; };

    // ---- go ---------------------------------------------------------------
    measure();
    paint();
    if (reduced) {
      canvas.style.transition = "none";
      canvas.style.opacity = "1";
    } else {
      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 900ms ease";
      requestAnimationFrame(() => { if (!disposed) canvas.style.opacity = "1"; });
    }
    start();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(host);
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    if (interactive && !reduced) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerup", onPointerEnd, { passive: true });
      document.documentElement.addEventListener("mouseleave", onLeave);
    }

    return () => {
      disposed = true;
      stop();
      clearTimeout(resizeTimer);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerup", onPointerEnd);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [cfg, reduced, interactive]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}

export default function BackgroundEngine({
  backgroundId,
  interactive = true,
  zIndex = 0,
  className,
  style,
}) {
  const stored = useSyncExternalStore(subscribeBackground, loadBackgroundId, loadBackgroundId);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const cfg = getBackground(backgroundId ?? stored);
  const grain = getGrainURL();

  return (
    <div
      aria-hidden="true"
      className={className}
      data-background={cfg.id}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        overflow: "hidden",
        pointerEvents: "none",
        background: cfg.base,
        contain: "strict",
        ...style,
      }}
    >
      <SceneCanvas key={cfg.id} cfg={cfg} reduced={reduced} interactive={interactive} />

      {/* Edge vignette keeps the timer and controls readable on every scene */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 75% 70% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,${cfg.scrim ?? 0.5}) 100%)`,
        }}
      />
      {/* Fine grain: dithers gradients (no banding) and adds a filmic finish */}
      {grain && cfg.grain > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: `url(${grain})`,
            backgroundSize: "128px 128px",
            opacity: cfg.grain,
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}