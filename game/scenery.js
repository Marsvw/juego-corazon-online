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
// Tralalero Beach

function clouds(ctx, frame, seed, count, y0, y1, color) {
  const rand = makeRng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const w = 80 + rand() * 120;
    const x = ((rand() * 3200 + frame * (0.2 + rand() * 0.3)) % 3200) - 1000;
    const y = y0 + rand() * (y1 - y0);
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(x + j * w * 0.25, y - Math.sin(j * 1.3) * 12, w * 0.3, w * 0.18, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function drawBeachBackground(ctx, state, v) {
  const { W, H } = v;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#38bdf8');
  sky.addColorStop(0.6, '#bae6fd');
  sky.addColorStop(1, '#fef3c7');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun
  const sx = W * 0.18;
  const sy = H * 0.2;
  ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
  ctx.beginPath();
  ctx.arc(sx, sy, 90 * v.base, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(sx, sy, 50 * v.base, 0, TAU);
  ctx.fill();

  layer(ctx, v, 0.1, () => clouds(ctx, state.frame, 21, 10, 0, 220, 'rgba(255,255,255,0.85)'));
  layer(ctx, v, 0.25, () => {
    // Sea with a distant island
    const sea = ctx.createLinearGradient(0, 470, 0, 900);
    sea.addColorStop(0, '#0ea5e9');
    sea.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = sea;
    ctx.fillRect(-1500, 470, 4200, 900);
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.ellipse(1150, 472, 160, 30, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(1150, 450);
    ctx.quadraticCurveTo(1165, 400, 1150, 360);
    ctx.stroke();
    ctx.fillStyle = '#16a34a';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(1150 + Math.cos(i * 1.25) * 30, 360 + Math.sin(i * 1.25) * 8, 36, 9, i * 1.25, 0, TAU);
      ctx.fill();
    }
    // Glints on the waves
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
      const x = -900 + i * 120 + Math.sin(state.frame * 0.02 + i) * 20;
      const y = 500 + (i % 5) * 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30, y);
      ctx.stroke();
    }
  });
}

function drawBeachPlatform(ctx, state, p) {
  if (p.solid) {
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 10);
    ctx.lineTo(p.x + p.w, p.y + 10);
    ctx.lineTo(p.x + p.w - 60, p.y + p.h + 40);
    ctx.lineTo(p.x + 60, p.y + p.h + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, 30, [14, 14, 6, 6]);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(p.x + 10, p.y, p.w - 20, 6);
    // Shells and a starfish
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(p.x + 160, p.y + 16, 5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    const sx = p.x + p.w - 180;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 ? 3 : 8;
      ctx.lineTo(sx + Math.cos(a) * r, p.y + 16 + Math.sin(a) * r);
    }
    ctx.fill();
    return;
  }
  if (p.id === 'tower') {
    // Lifeguard tower
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x + 20, p.y + 10);
    ctx.lineTo(p.x + 6, p.y + 140);
    ctx.moveTo(p.x + p.w - 20, p.y + 10);
    ctx.lineTo(p.x + p.w - 6, p.y + 140);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(p.x, p.y, p.w, 14);
    ctx.fillStyle = '#fff';
    for (let x = p.x; x < p.x + p.w; x += 26) ctx.fillRect(x, p.y, 13, 14);
    return;
  }
  // Beach umbrella: the canopy is the platform.
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.x + p.w / 2, p.y);
  ctx.lineTo(p.x + p.w / 2 + 10, p.y + 130);
  ctx.stroke();
  const stripes = ['#f43f5e', '#fff', '#f43f5e', '#fff', '#f43f5e'];
  stripes.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(p.x + (p.w * i) / 5, p.y + 14);
    ctx.quadraticCurveTo(p.x + (p.w * (i + 0.5)) / 5, p.y - 14, p.x + (p.w * (i + 1)) / 5, p.y + 14);
    ctx.lineTo(p.x + (p.w * (i + 1)) / 5, p.y);
    ctx.lineTo(p.x + (p.w * i) / 5, p.y);
    ctx.fill();
  });
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(p.x, p.y, p.w, 5);
}

function drawBeachForeground(ctx, state) {
  const w = state.water;
  if (!w) return;
  const g = ctx.createLinearGradient(0, w.level, 0, w.level + 500);
  g.addColorStop(0, 'rgba(14, 165, 233, 0.55)');
  g.addColorStop(1, 'rgba(12, 74, 110, 0.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-800, w.level + 900);
  for (let x = -800; x <= 2100; x += 40) {
    ctx.lineTo(x, w.level + Math.sin(x * 0.02 + state.frame * 0.08 * w.current) * 6);
  }
  ctx.lineTo(2100, w.level + 900);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = -800; x <= 2100; x += 40) {
    ctx.lineTo(x, w.level + Math.sin(x * 0.02 + state.frame * 0.08 * w.current) * 6);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Bombardiro Skies

function drawSkiesBackground(ctx, state, v) {
  const { W, H } = v;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#60a5fa');
  sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  layer(ctx, v, 0.1, () => {
    // Far-off squadron
    ctx.fillStyle = 'rgba(71, 85, 105, 0.35)';
    for (let i = 0; i < 4; i++) {
      const x = ((state.frame * 0.6 + i * 90) % 2600) - 700;
      const y = 120 + i * 18;
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(x - 4, y - 12, 6, 24);
    }
  });
  layer(ctx, v, 0.2, () => clouds(ctx, state.frame * 3, 31, 14, 100, 700, 'rgba(255,255,255,0.75)'));
  layer(ctx, v, 0.5, () => clouds(ctx, state.frame * 6, 41, 8, 500, 1000, 'rgba(255,255,255,0.9)'));
}

function drawSkiesPlatform(ctx, state, p) {
  if (p.solid) {
    // The giant bomber. Its back is the floor.
    const cx = p.x + p.w / 2;
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.moveTo(cx - 140, p.y + 20);
    ctx.lineTo(cx - 520, p.y + 60);
    ctx.lineTo(cx - 500, p.y + 80);
    ctx.lineTo(cx - 120, p.y + 50);
    ctx.moveTo(cx + 140, p.y + 20);
    ctx.lineTo(cx + 520, p.y + 60);
    ctx.lineTo(cx + 500, p.y + 80);
    ctx.lineTo(cx + 120, p.y + 50);
    ctx.fill();
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + 26, p.w / 2 + 30, 36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(p.x, p.y, p.w, 12);
    // Rivets and windows
    ctx.fillStyle = '#374151';
    for (let x = p.x + 20; x < p.x + p.w; x += 40) {
      ctx.beginPath();
      ctx.arc(x, p.y + 6, 2, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#bae6fd';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(cx - 150 + i * 60, p.y + 34, 8, 0, TAU);
      ctx.fill();
    }
    // Croc nose and propellers
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w + 34, p.y + 26, 46, 22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(p.x + p.w + 30 + i * 8, p.y + 32);
      ctx.lineTo(p.x + p.w + 34 + i * 8, p.y + 38);
      ctx.lineTo(p.x + p.w + 38 + i * 8, p.y + 32);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(p.x + p.w + 30, p.y + 14, 4, 0, TAU);
    ctx.fill();
    for (const px of [cx - 330, cx + 330]) {
      ctx.fillStyle = 'rgba(229,231,235,0.6)';
      ctx.beginPath();
      ctx.ellipse(px, p.y + 70, 4, 24 * Math.abs(Math.sin(state.frame * 0.8)) + 6, 0, 0, TAU);
      ctx.fill();
    }
    return;
  }
  // Little red planes: the top of the wing is the platform.
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + 22, p.w * 0.42, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, 9, 4);
  ctx.fill();
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.moveTo(p.x + 12, p.y + 20);
  ctx.lineTo(p.x - 6, p.y + 4);
  ctx.lineTo(p.x + 4, p.y + 22);
  ctx.fill();
  ctx.fillStyle = 'rgba(229,231,235,0.6)';
  ctx.beginPath();
  ctx.ellipse(p.x + p.w - 2, p.y + 22, 3, 14 * Math.abs(Math.sin(state.frame * 0.9)) + 4, 0, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Cappuccino Café

function drawCafeBackground(ctx, state, v) {
  const { W, H } = v;
  ctx.fillStyle = '#5b3424';
  ctx.fillRect(0, 0, W, H);
  layer(ctx, v, 0.3, () => {
    // Striped wallpaper
    for (let x = -1200; x < 2600; x += 60) {
      ctx.fillStyle = (x / 60) % 2 ? '#6b3f2a' : '#7a4a32';
      ctx.fillRect(x, -800, 60, 2000);
    }
    // Window with a night city
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(420, 40, 440, 260);
    const rand = makeRng(5);
    for (let i = 0; i < 14; i++) {
      const bw = 20 + rand() * 30;
      const bh = 60 + rand() * 140;
      const bx = 430 + i * 31;
      ctx.fillStyle = '#312e81';
      ctx.fillRect(bx, 300 - bh, bw, bh);
      ctx.fillStyle = '#fcd34d';
      for (let j = 0; j < 4; j++) if (rand() < 0.5) ctx.fillRect(bx + 4, 300 - bh + 10 + j * 22, 5, 7);
    }
    ctx.strokeStyle = '#d6a77a';
    ctx.lineWidth = 12;
    ctx.strokeRect(420, 40, 440, 260);
    ctx.beginPath();
    ctx.moveTo(640, 40);
    ctx.lineTo(640, 300);
    ctx.stroke();
    // Shelves with cups
    for (const sx of [-200, 1080]) {
      for (let row = 0; row < 3; row++) {
        const sy = 120 + row * 130;
        ctx.fillStyle = '#3f2418';
        ctx.fillRect(sx, sy, 320, 12);
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = ['#fef3c7', '#fca5a5', '#bae6fd', '#fff'][(i + row) % 4];
          ctx.fillRect(sx + 20 + i * 60, sy - 34, 34, 34);
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(sx + 58 + i * 60, sy - 17, 8, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
        }
      }
    }
  });
  layer(ctx, v, 0.6, () => {
    // Hanging lamps
    for (const lx of [200, 640, 1080]) {
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, -400);
      ctx.lineTo(lx, 80);
      ctx.stroke();
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(lx - 40, 110);
      ctx.lineTo(lx + 40, 110);
      ctx.lineTo(lx + 16, 78);
      ctx.lineTo(lx - 16, 78);
      ctx.fill();
      const glow = ctx.createRadialGradient(lx, 116, 4, lx, 116, 160);
      glow.addColorStop(0, 'rgba(253, 230, 138, 0.55)');
      glow.addColorStop(1, 'rgba(253, 230, 138, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, 116, 160, 0, TAU);
      ctx.fill();
    }
  });
}

function drawCafePlatform(ctx, state, p) {
  if (p.solid) {
    // Giant saucer
    const cx = p.x + p.w / 2;
    ctx.fillStyle = '#d6d3d1';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + 18, p.w / 2 + 40, 50, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fafaf9';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + 8, p.w / 2 + 40, 26, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e7e5e4';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + 8, p.w / 2 - 60, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, p.y + 8, p.w / 2 + 28, 20, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
    return;
  }
  if (p.bouncy) {
    // Milk foam cloud
    ctx.fillStyle = '#f5e6d3';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(p.x + 18 + i * ((p.w - 36) / 5), p.y + 8 + Math.sin(state.frame * 0.1 + i) * 2, 26, 14, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#c08552';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + 6, 40, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f5e6d3';
    ctx.beginPath();
    ctx.moveTo(p.x + p.w / 2, p.y + 10);
    ctx.bezierCurveTo(p.x + p.w / 2 - 16, p.y + 2, p.x + p.w / 2 - 6, p.y - 4, p.x + p.w / 2, p.y + 2);
    ctx.bezierCurveTo(p.x + p.w / 2 + 6, p.y - 4, p.x + p.w / 2 + 16, p.y + 2, p.x + p.w / 2, p.y + 10);
    ctx.fill();
    return;
  }
  // Sugar cubes
  for (let x = p.x; x < p.x + p.w - 10; x += 37) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, p.y, 34, 30);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(x, p.y + 22, 34, 8);
    ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
    ctx.fillRect(x + 6, p.y + 6, 3, 3);
    ctx.fillRect(x + 20, p.y + 12, 3, 3);
  }
}

// ---------------------------------------------------------------------------
// Banana Jungle

function drawJungleBackground(ctx, state, v) {
  const { W, H } = v;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#14532d');
  sky.addColorStop(0.5, '#166534');
  sky.addColorStop(1, '#365314');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Sun beams
  ctx.fillStyle = 'rgba(254, 249, 195, 0.08)';
  for (let i = 0; i < 4; i++) {
    const x = W * (0.15 + i * 0.25);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 80 * v.base, 0);
    ctx.lineTo(x + 300 * v.base, H);
    ctx.lineTo(x + 160 * v.base, H);
    ctx.fill();
  }
  const foliage = (seed, color, y, size) => {
    const rand = makeRng(seed);
    ctx.fillStyle = color;
    for (let x = -1000; x < 2400; x += size * 0.9) {
      const r = size * (0.6 + rand() * 0.5);
      ctx.beginPath();
      ctx.arc(x, y + rand() * 60, r, 0, TAU);
      ctx.fill();
    }
    ctx.fillRect(-1000, y + 20, 3400, 1200);
  };
  layer(ctx, v, 0.2, () => foliage(51, '#15803d', 380, 120));
  layer(ctx, v, 0.4, () => {
    // Tree trunks
    for (const x of [-300, 120, 980, 1420]) {
      ctx.fillStyle = '#3f2a14';
      ctx.fillRect(x, -600, 60, 1600);
    }
    foliage(52, '#166534', 560, 100);
  });
  layer(ctx, v, 0.7, () => {
    // Hanging leaves at the top
    ctx.fillStyle = '#22c55e';
    for (let i = 0; i < 18; i++) {
      const x = -700 + i * 160;
      const sway = Math.sin(state.frame * 0.03 + i) * 6;
      ctx.beginPath();
      ctx.ellipse(x + sway, -40, 26, 60, 0.3, 0, TAU);
      ctx.fill();
    }
  });
}

function drawJunglePlatform(ctx, state, p) {
  if (p.solid) {
    ctx.fillStyle = '#4a2e14';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.w, p.y);
    ctx.lineTo(p.x + p.w - 40, p.y + p.h + 30);
    ctx.lineTo(p.x + 40, p.y + p.h + 30);
    ctx.closePath();
    ctx.fill();
    // Roots
    ctx.strokeStyle = '#3f2a14';
    ctx.lineWidth = 5;
    for (const rx of [p.x + 90, p.x + 260, p.x + 430, p.x + p.w - 90]) {
      ctx.beginPath();
      ctx.moveTo(rx, p.y + p.h);
      ctx.quadraticCurveTo(rx + 12, p.y + p.h + 60, rx - 8, p.y + p.h + 110);
      ctx.stroke();
    }
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.roundRect(p.x - 6, p.y - 4, p.w + 12, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    for (let x = p.x; x < p.x + p.w; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, p.y + 12);
      ctx.lineTo(x + 6, p.y - 10);
      ctx.lineTo(x + 12, p.y + 12);
      ctx.fill();
    }
    return;
  }
  // Tree branch
  ctx.fillStyle = '#6b4423';
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#16a34a';
  for (const lx of [p.x + 10, p.x + p.w - 20]) {
    ctx.beginPath();
    ctx.ellipse(lx, p.y - 2, 18, 8, -0.4, 0, TAU);
    ctx.fill();
  }
}

function drawJungleVines(ctx, state) {
  for (const [i, v] of (state.stage.vines || []).entries()) {
    const sway = Math.sin(state.frame * 0.03 + i) * 8;
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(v.x, v.top - 600);
    ctx.quadraticCurveTo(v.x + sway, (v.top + v.bottom) / 2, v.x + sway * 1.5, v.bottom);
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    for (let y = v.top; y < v.bottom; y += 40) {
      const t = (y - v.top) / (v.bottom - v.top);
      ctx.beginPath();
      ctx.ellipse(v.x + sway * t * 1.5 + (y % 80 ? 8 : -8), y, 9, 4, y % 80 ? 0.5 : -0.5, 0, TAU);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------

const BACKGROUNDS = { sahur: drawSahurBackground, beach: drawBeachBackground, skies: drawSkiesBackground, cafe: drawCafeBackground, jungle: drawJungleBackground };
const PLATFORMS = { sahur: drawSahurPlatform, beach: drawBeachPlatform, skies: drawSkiesPlatform, cafe: drawCafePlatform, jungle: drawJunglePlatform };
const BEHIND = { jungle: drawJungleVines };
const FOREGROUND = { beach: drawBeachForeground };

export function drawBackground(ctx, state, v) {
  (BACKGROUNDS[state.stage.id] || drawSahurBackground)(ctx, state, v);
}

// World-space layers drawn behind the platforms (vines).
export function drawStageBehind(ctx, state) {
  if (BEHIND[state.stage.id]) BEHIND[state.stage.id](ctx, state);
}

export function drawPlatform(ctx, state, p) {
  (PLATFORMS[state.stage.id] || drawSahurPlatform)(ctx, state, p);
}

// World-space layers drawn in front of the fighters (water).
export function drawForeground(ctx, state) {
  if (FOREGROUND[state.stage.id]) FOREGROUND[state.stage.id](ctx, state);
}

// Small still picture of a stage for the stage select screen.
export function drawStagePreview(canvas, stage) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const state = { stage, frame: 0, platforms: buildPlatforms(stage), water: stage.id === 'beach' ? { level: 600, current: 1 } : null };
  const base = H / 720;
  const cam = { x: 640, y: 400, zoom: 0.9 };
  drawBackground(ctx, state, { W, H, base, cam });
  const s = base * cam.zoom;
  ctx.setTransform(s, 0, 0, s, W / 2 - cam.x * s, H / 2 - cam.y * s);
  drawStageBehind(ctx, state);
  for (const p of state.platforms) drawPlatform(ctx, state, p);
  drawForeground(ctx, state);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
