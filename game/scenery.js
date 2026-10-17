// Stage backgrounds and platform art.
import { makeRng } from './rng.js';
import { buildPlatforms } from './stages.js';

const TAU = Math.PI * 2;
const cache = {};

// Runs draw() with a camera transform scaled by parallax factor k
// (0 = fixed to the screen, 1 = moves with the world).
function layer(ctx, v, k, draw) {
  const { W, H, base, cam } = v;
  const s = base * (1 + (cam.zoom - 1) * k);
  ctx.setTransform(s, 0, 0, s, W / 2 - (640 + (cam.x - 640) * k) * s, H / 2 - (380 + (cam.y - 380) * k) * s);
  draw();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function stars(ctx, v, seed, count, frame) {
  const rand = makeRng(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * v.W;
    const y = rand() * v.H * 0.6;
    const r = (0.6 + rand() * 1.4) * v.base;
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.05 + i);
    ctx.globalAlpha = 0.35 + tw * 0.65;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Sahur Village

function sahurHouses(seed, count, minH, maxH) {
  const rand = makeRng(seed);
  const out = [];
  let x = -900;
  while (out.length < count) {
    const w = 70 + rand() * 90;
    const h = minH + rand() * (maxH - minH);
    out.push({ x, w, h, roof: rand() < 0.5 ? 'dome' : 'peak', windows: Math.floor(1 + rand() * 3), lit: rand() });
    x += w + 6 + rand() * 30;
  }
  return out;
}

function drawSahurBackground(ctx, state, v) {
  const { W, H } = v;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0f2e');
  sky.addColorStop(0.5, '#33205a');
  sky.addColorStop(0.82, '#a3456c');
  sky.addColorStop(1, '#ff9b63');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, v, 11, 90, state.frame);

  // Crescent moon
  const mx = W * 0.8;
  const my = H * 0.18;
  const mr = 42 * v.base;
  ctx.fillStyle = '#fff6d5';
  ctx.shadowColor = 'rgba(255, 240, 200, 0.6)';
  ctx.shadowBlur = 40 * v.base;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a1540';
  ctx.beginPath();
  ctx.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.88, 0, TAU);
  ctx.fill();

  cache.sahurFar ||= sahurHouses(3, 40, 120, 260);
  cache.sahurNear ||= sahurHouses(9, 34, 80, 180);

  layer(ctx, v, 0.25, () => {
    ctx.fillStyle = '#24173f';
    for (const h of cache.sahurFar) house(ctx, h, 700, '#24173f', null, state.frame);
  });
  layer(ctx, v, 0.5, () => {
    for (const h of cache.sahurNear) house(ctx, h, 760, '#1a1030', '#ffc46b', state.frame);
    // Lantern strings
    for (let s = 0; s < 3; s++) {
      const x0 = -600 + s * 900;
      ctx.strokeStyle = 'rgba(40, 20, 50, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, 330);
      ctx.quadraticCurveTo(x0 + 400, 410, x0 + 800, 330);
      ctx.stroke();
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const lx = x0 + 800 * t;
        const ly = (1 - t) * (1 - t) * 330 + 2 * (1 - t) * t * 410 + t * t * 330;
        const sway = Math.sin(state.frame * 0.04 + i) * 2;
        ctx.fillStyle = ['#ef4444', '#f59e0b', '#22c55e', '#e879f9'][i % 4];
        ctx.beginPath();
        ctx.ellipse(lx + sway, ly + 12, 7, 10, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 230, 150, 0.35)';
        ctx.beginPath();
        ctx.arc(lx + sway, ly + 12, 16, 0, TAU);
        ctx.fill();
      }
    }
  });
}

function house(ctx, h, groundY, color, windowColor, frame) {
  const top = groundY - h.h;
  ctx.fillStyle = color;
  ctx.fillRect(h.x, top, h.w, h.h + 600);
  ctx.beginPath();
  if (h.roof === 'dome') {
    ctx.arc(h.x + h.w / 2, top, h.w * 0.35, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(h.x + h.w / 2 - 1.5, top - h.w * 0.35 - 14, 3, 14);
  } else {
    ctx.moveTo(h.x - 6, top);
    ctx.lineTo(h.x + h.w / 2, top - 34);
    ctx.lineTo(h.x + h.w + 6, top);
    ctx.fill();
  }
  if (!windowColor) return;
  for (let i = 0; i < h.windows; i++) {
    const wx = h.x + ((i + 1) * h.w) / (h.windows + 1) - 7;
    const flicker = h.lit > 0.3 ? 1 : 0.4 + 0.3 * Math.sin(frame * 0.03 + h.x);
    ctx.globalAlpha = flicker;
    ctx.fillStyle = windowColor;
    ctx.beginPath();
    ctx.roundRect(wx, top + 24, 14, 20, [7, 7, 0, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawSahurPlatform(ctx, state, p) {
  if (p.solid) {
    // Floating chunk of village square.
    ctx.fillStyle = '#4a2c1f';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.w, p.y);
    ctx.lineTo(p.x + p.w - 30, p.y + p.h);
    ctx.lineTo(p.x + p.w - 120, p.y + p.h + 60);
    ctx.lineTo(p.x + 120, p.y + p.h + 60);
    ctx.lineTo(p.x + 30, p.y + p.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6b4130';
    ctx.fillRect(p.x, p.y, p.w, 26);
    // Tiles
    ctx.fillStyle = '#d6a76a';
    ctx.fillRect(p.x, p.y, p.w, 10);
    ctx.strokeStyle = 'rgba(74, 44, 31, 0.6)';
    ctx.lineWidth = 2;
    for (let x = p.x + 34; x < p.x + p.w; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, p.y);
      ctx.lineTo(x, p.y + 10);
      ctx.stroke();
    }
    // Hanging lamps under the edge
    for (const lx of [p.x + 70, p.x + p.w - 70]) {
      ctx.strokeStyle = '#2b1a12';
      ctx.beginPath();
      ctx.moveTo(lx, p.y + 26);
      ctx.lineTo(lx, p.y + 44);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(lx, p.y + 52, 7, 9, 0, 0, TAU);
      ctx.fill();
    }
    return;
  }
  // Drum-top platforms
  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.roundRect(p.x + 8, p.y + 4, p.w - 16, 22, 6);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = p.x + 14; x < p.x + p.w - 14; x += 16) {
    ctx.moveTo(x, p.y + 6);
    ctx.lineTo(x + 8, p.y + 24);
    ctx.moveTo(x + 8, p.y + 24);
    ctx.lineTo(x + 16, p.y + 6);
  }
  ctx.stroke();
  ctx.fillStyle = '#f5e6c8';
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, 8, 4);
  ctx.fill();
}

// ---------------------------------------------------------------------------

const BACKGROUNDS = { sahur: drawSahurBackground };
const PLATFORMS = { sahur: drawSahurPlatform };

export function drawBackground(ctx, state, v) {
  (BACKGROUNDS[state.stage.id] || drawSahurBackground)(ctx, state, v);
}

export function drawPlatform(ctx, state, p) {
  (PLATFORMS[state.stage.id] || drawSahurPlatform)(ctx, state, p);
}

// Small still picture of a stage for the stage select screen.
export function drawStagePreview(canvas, stage) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const state = { stage, frame: 0, platforms: buildPlatforms(stage) };
  const base = H / 720;
  const cam = { x: 640, y: 400, zoom: 0.9 };
  drawBackground(ctx, state, { W, H, base, cam });
  const s = base * cam.zoom;
  ctx.setTransform(s, 0, 0, s, W / 2 - cam.x * s, H / 2 - cam.y * s);
  for (const p of state.platforms) drawPlatform(ctx, state, p);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
