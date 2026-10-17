// Draws a match: stage background, platforms, fighters, projectiles, hit
// effects, camera and HUD. Effects live here, not in match state, so the
// engine stays deterministic.
import { drawCharacter } from './art.js';
import { hitboxWorld } from './combat.js';
import { hurtbox } from './physics.js';
import { mainPlatform } from './stages.js';
import { drawBackground, drawPlatform } from './scenery.js';

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];
const VIEW_H = 720;
const TAU = Math.PI * 2;

// Moves where the whole fighter spins: 'twirl' turns on the spot, 'flip'
// does a somersault.
const SPINS = {
  tralalero: { upSpecial: 'twirl' },
  ballerina: { neutralSpecial: 'twirl', upSpecial: 'twirl' },
  chimpanzini: { upSpecial: 'flip', sideSpecial: 'flip' },
  assassino: { upSpecial: 'flip' },
};

export function damageColor(d) {
  const stops = [
    [0, [255, 255, 255]],
    [50, [255, 236, 140]],
    [100, [255, 160, 60]],
    [150, [240, 60, 50]],
    [220, [150, 20, 30]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (d <= stops[i][0]) {
      const [d0, c0] = stops[i - 1];
      const [d1, c1] = stops[i];
      const t = (d - d0) / (d1 - d0);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * t));
      return `rgb(${c.join(',')})`;
    }
  }
  return 'rgb(150,20,30)';
}

export function createRenderer(canvas, { portraits } = {}) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 640, y: 380, zoom: 1, ready: false };
  const fx = { particles: [], rings: [], beams: [], texts: [], shake: 0, flash: 0, hudPop: [0, 0, 0, 0] };
  let W = 1;
  let H = 1;
  let debug = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    W = w;
    H = h;
  }

  function updateCamera(state) {
    const main = mainPlatform(state);
    const b = state.stage.blast;
    let minX = main.x - 60;
    let maxX = main.x + main.w + 60;
    // Extra room at the bottom keeps the stage floor above the HUD.
    let minY = main.y - 300;
    let maxY = main.y + 170;
    for (const f of state.fighters) {
      if (f.state === 'dead' || f.state === 'out') continue;
      minX = Math.min(minX, f.x - 140);
      maxX = Math.max(maxX, f.x + 140);
      minY = Math.min(minY, f.y - f.stats.height - 130);
      maxY = Math.max(maxY, f.y + 150);
    }
    minX = Math.max(minX, b.left);
    maxX = Math.min(maxX, b.right);
    minY = Math.max(minY, b.top);
    maxY = Math.min(maxY, b.bottom);
    const aspect = W / H;
    const zoom = Math.max(0.5, Math.min(1.25, Math.min((VIEW_H * aspect) / (maxX - minX), VIEW_H / (maxY - minY))));
    const tx = (minX + maxX) / 2;
    const ty = (minY + maxY) / 2;
    if (!cam.ready) {
      Object.assign(cam, { x: tx, y: ty, zoom, ready: true });
      return;
    }
    cam.x += (tx - cam.x) * 0.08;
    cam.y += (ty - cam.y) * 0.08;
    cam.zoom += (zoom - cam.zoom) * 0.06;
  }

  // -------------------------------------------------------------------------
  // Effects

  function burst(x, y, color, count, speed, size, kind = 'spark', life = 22) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const v = speed * (0.4 + Math.random() * 0.8);
      fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * (0.6 + Math.random() * 0.6), kind });
    }
  }

  function text(t, color, size = 90, life = 60) {
    fx.texts.push({ t, color, size, life, max: life });
  }

  function handleEvents(state, events) {
    for (const e of events) {
      const pc = e.slot != null ? PLAYER_COLORS[state.fighters[e.slot].port] : '#fff';
      switch (e.type) {
        case 'hit': {
          const strength = Math.min(1, e.kb / 28);
          burst(e.x, e.y, '#fff7c2', 6 + Math.round(strength * 10), 6 + strength * 10, 4 + strength * 4, 'line', 14);
          fx.rings.push({ x: e.x, y: e.y, r: 8, grow: 3 + strength * 6, life: 14, max: 14, color: strength > 0.6 ? '#ffb020' : '#ffffff' });
          if (e.kb > 14) fx.shake = Math.max(fx.shake, e.kb * 0.45);
          if (e.kb > 24) fx.flash = Math.max(fx.flash, 0.35);
          fx.hudPop[e.slot] = 10;
          break;
        }
        case 'block':
          fx.rings.push({ x: e.x, y: e.y, r: 10, grow: 3, life: 12, max: 12, color: '#93c5fd' });
          break;
        case 'shieldBreak':
          burst(e.x, e.y, '#bfdbfe', 30, 12, 6);
          fx.shake = Math.max(fx.shake, 12);
          text('SHIELD BREAK!', '#93c5fd', 64, 70);
          break;
        case 'counter':
          burst(e.x, e.y, '#f0abfc', 16, 9, 5);
          text('COUNTER!', '#f0abfc', 64, 50);
          break;
        case 'ko': {
          const main = mainPlatform(state);
          const cx = main.x + main.w / 2;
          fx.beams.push({ x: e.x, y: e.y, angle: Math.atan2(main.y - 150 - e.y, cx - e.x), life: 50, max: 50, color: pc });
          burst(e.x, e.y, pc, 40, 18, 8, 'spark', 40);
          fx.shake = Math.max(fx.shake, 22);
          fx.flash = Math.max(fx.flash, 0.5);
          break;
        }
        case 'boom':
          burst(e.x, e.y, '#fb923c', 22, 10, 7, 'spark', 26);
          fx.shake = Math.max(fx.shake, 10);
          break;
        case 'jump':
          if (e.air) fx.rings.push({ x: e.x, y: e.y, r: 6, grow: 2.5, life: 12, max: 12, color: 'rgba(255,255,255,0.8)', flat: true });
          else dust(e.x, e.y, 4);
          break;
        case 'land':
          dust(e.x, e.y, e.heavy ? 12 : 3);
          if (e.heavy) fx.shake = Math.max(fx.shake, 6);
          break;
        case 'ledge':
          burst(e.x, e.y - 20, '#fef08a', 8, 4, 3, 'spark', 16);
          break;
        case 'teleport':
          burst(e.x, e.y - 40, '#1f2937', 14, 6, 6, 'dust', 20);
          break;
        case 'game':
          text('GAME!', '#fff', 150, 140);
          fx.flash = 0.6;
          break;
      }
    }
  }

  function dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      fx.particles.push({ x, y: y - 4, vx: side * (1 + Math.random() * 3), vy: -Math.random() * 1.5, life: 22, max: 22, color: 'rgba(230,220,200,0.9)', size: 6 + Math.random() * 6, kind: 'dust' });
    }
  }

  function updateEffects() {
    for (const p of fx.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 + (p.kind === 'dust' ? -0.05 : 0.15);
      p.life--;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const r of fx.rings) {
      r.r += r.grow;
      r.life--;
    }
    fx.rings = fx.rings.filter((r) => r.life > 0);
    for (const b of fx.beams) b.life--;
    fx.beams = fx.beams.filter((b) => b.life > 0);
    for (const t of fx.texts) t.life--;
    fx.texts = fx.texts.filter((t) => t.life > 0);
    fx.shake *= 0.85;
    if (fx.shake < 0.3) fx.shake = 0;
    fx.flash *= 0.88;
    fx.hudPop = fx.hudPop.map((v) => Math.max(0, v - 1));
  }

  // -------------------------------------------------------------------------
  // World drawing

  function drawProjectile(p, frame) {
    const color = '#fff';
    ctx.save();
    ctx.translate(p.x, p.y);
    switch (p.kind) {
      case 'splash': {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
        for (let i = 0; i < 4; i++) {
          const a = frame * 0.3 + i * 1.6;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 8, Math.sin(a * 1.3) * 6 - 4, 9, 12, 0, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(-3, -10, 3, 5, 0.3, 0, TAU);
        ctx.fill();
        break;
      }
      case 'shockwave': {
        const dir = Math.sign(p.vx) || 1;
        ctx.scale(dir, 1);
        const g = ctx.createLinearGradient(-p.w / 2, 0, p.w / 2, 0);
        g.addColorStop(0, 'rgba(251, 191, 36, 0)');
        g.addColorStop(1, 'rgba(251, 146, 60, 0.95)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, p.h / 2);
        ctx.quadraticCurveTo(p.w / 2, p.h / 2, p.w / 2, -p.h / 2 - 6);
        ctx.quadraticCurveTo(p.w / 4, p.h / 2 - 4, -p.w / 2, p.h / 2);
        ctx.fill();
        ctx.fillStyle = '#fff7c2';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.scale(dir, 1);
        ctx.fillText('TUNG', -16 * dir, -p.h / 2 - 6);
        break;
      }
      case 'explosion': {
        const t = p.age / (p.age + p.life);
        const r = (p.w / 2) * (0.6 + t * 0.6);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(255, 250, 200, ${1 - t})`);
        g.addColorStop(0.5, `rgba(251, 146, 60, ${0.9 - t * 0.8})`);
        g.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        break;
      }
      case 'bomb': {
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(-3, -p.w / 2 - 5, 6, 5);
        ctx.fillStyle = frame % 6 < 3 ? '#fde047' : '#f97316';
        ctx.beginPath();
        ctx.arc(2, -p.w / 2 - 8, 3.5, 0, TAU);
        ctx.fill();
        break;
      }
      case 'coffee': {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#7c4a2a';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2, p.h / 3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#c08552';
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(-i * 9, Math.sin(frame * 0.5 + i) * 4, 5 - i, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(4, -3, 5, 2, 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'banana': {
        ctx.rotate(p.age * 0.35 * (Math.sign(p.vx) || 1));
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -8, 14, 0.3, Math.PI - 0.3);
        ctx.arc(0, -14, 12, Math.PI - 0.5, 0.5, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'peel': {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1.5;
        for (const a of [-2.4, -1.57, -0.7]) {
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 9, 4 + Math.sin(a) * 3, 11, 4, a + Math.PI / 2, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(-2, -2, 4, 5);
        break;
      }
      case 'spike': {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#4d7c0f';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-10, -4);
        ctx.lineTo(-10, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f7fee7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        break;
      }
      case 'star': {
        ctx.rotate(p.age * 0.6);
        ctx.fillStyle = '#d1d5db';
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const r = i % 2 ? 3.5 : 10;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      default: {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSwoosh(f, frame) {
    const m = f.move;
    const accent = f.char.colors.accent;
    for (const h of m.def.hits || []) {
      if (m.frame < h.start || m.frame > h.end) continue;
      const b = hitboxWorld(f, h.box);
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const t = (m.frame - h.start + 1) / (h.end - h.start + 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = 0.75 * (1 - t * 0.6);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(b.w, b.h) / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.45, accent);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, TAU);
      ctx.fill();
      // Arc streak across the hitbox, sweeping in the swing direction.
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const r = Math.min(b.w, b.h) / 2.2;
      const start = f.facing > 0 ? -2.2 : Math.PI + 2.2;
      ctx.arc(0, 0, r, start, start + f.facing * (0.8 + t * 2.4), f.facing < 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFighter(f, state) {
    if (f.state === 'dead' || f.state === 'out') return;
    const s = f.stats;
    const frame = state.frame;
    const pc = PLAYER_COLORS[f.port];
    const pose = {
      t: frame + f.slot * 37,
      moveId: f.move ? f.move.id : null,
      progress: f.move ? Math.min(1, f.move.frame / f.move.def.total) : 0,
      running: f.state === 'run',
      air: !f.grounded,
      hurt: f.state === 'hitstun' || f.state === 'stun' || f.state === 'grabbed',
    };

    if (f.state === 'respawn') {
      ctx.save();
      ctx.translate(f.x, f.y);
      const g = ctx.createLinearGradient(-50, 0, 50, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, pc);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-55, 0, 110, 8);
      ctx.restore();
    }

    ctx.save();
    let ox = 0;
    if (f.hitlag > 0 && f.state === 'hitstun') ox = (Math.random() - 0.5) * 8;
    ctx.translate(f.x + ox, f.y);
    if (f.invuln > 0 && Math.floor(frame / 3) % 2) ctx.globalAlpha = 0.5;
    if (f.state === 'roll' || f.state === 'airdodge') ctx.globalAlpha = 0.6;

    const speed = Math.hypot(f.vx, f.vy);
    if (f.state === 'hitstun' && !f.grounded && speed > 9) {
      ctx.translate(0, -s.height / 2);
      ctx.rotate(-f.facing * f.stateFrame * 0.32);
      ctx.translate(0, s.height / 2);
    } else if (f.state === 'landing') {
      ctx.scale(1.08, 0.92);
    } else if (!f.grounded && f.vy < -6 && f.state === 'air') {
      ctx.scale(0.94, 1.06);
    }
    const spin = f.move && SPINS[f.charId] && SPINS[f.charId][f.move.id];
    if (spin === 'twirl') {
      ctx.scale(Math.cos(f.move.frame * 0.7) || 0.01, 1);
    } else if (spin === 'flip') {
      ctx.translate(0, -s.height / 2);
      ctx.rotate(-Math.min(1, f.move.frame / 18) * TAU);
      ctx.translate(0, s.height / 2);
    }
    if (f.state === 'roll') {
      ctx.translate(0, -s.height / 2);
      ctx.rotate(f.timer * f.stateFrame * 0.3);
      ctx.translate(0, s.height / 2);
    }
    ctx.scale(f.facing, 1);
    drawCharacter(ctx, f.charId, pose, f.char.colors);
    ctx.restore();

    if (f.status.frozen > 0) {
      const hb = hurtbox(f);
      ctx.fillStyle = 'rgba(165, 243, 252, 0.45)';
      ctx.strokeStyle = 'rgba(207, 250, 254, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(hb.x - 6, hb.y - 6, hb.w + 12, hb.h + 12, 8);
      ctx.fill();
      ctx.stroke();
    }

    if (f.state === 'shield') {
      const r = 22 + (f.shieldHP / 100) * 32;
      ctx.fillStyle = pc + '55';
      ctx.strokeStyle = pc;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y - s.height / 2, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    if (f.state === 'stun') {
      for (let i = 0; i < 3; i++) {
        const a = frame * 0.12 + (i * TAU) / 3;
        star(f.x + Math.cos(a) * 26, f.y - s.height - 10 + Math.sin(a) * 6, 6, '#fde047');
      }
    }

    if (f.move) drawSwoosh(f, frame);

    // Player tag
    const ty = f.y - s.height - 22;
    ctx.fillStyle = pc;
    ctx.beginPath();
    ctx.moveTo(f.x - 7, ty);
    ctx.lineTo(f.x + 7, ty);
    ctx.lineTo(f.x, ty + 9);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    const label = f.name;
    ctx.strokeText(label, f.x, ty - 4);
    ctx.fillText(label, f.x, ty - 4);
    ctx.textAlign = 'left';
  }

  function star(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawEffects() {
    for (const b of fx.beams) {
      const t = b.life / b.max;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      const g = ctx.createLinearGradient(0, 0, 900, 0);
      g.addColorStop(0, b.color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = t;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(900, -60 * t - 20);
      ctx.lineTo(900, 60 * t + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(700, -12 * t);
      ctx.lineTo(700, 12 * t);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    for (const r of fx.rings) {
      ctx.globalAlpha = r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (r.flat) ctx.ellipse(r.x, r.y, r.r * 1.6, r.r * 0.4, 0, 0, TAU);
      else ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    for (const p of fx.particles) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      if (p.kind === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'dust' ? 1.6 - t * 0.6 : t), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDebug(state) {
    ctx.lineWidth = 1.5;
    for (const f of state.fighters) {
      if (f.state === 'dead' || f.state === 'out') continue;
      const hb = hurtbox(f);
      ctx.strokeStyle = 'rgba(250,204,21,0.9)';
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
      if (f.move) {
        for (const h of f.move.def.hits || []) {
          if (f.move.frame < h.start || f.move.frame > h.end) continue;
          const b = hitboxWorld(f, h.box);
          ctx.fillStyle = 'rgba(239,68,68,0.45)';
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
      }
    }
    for (const p of state.projectiles) {
      ctx.strokeStyle = 'rgba(239,68,68,0.9)';
      ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    }
  }

  // -------------------------------------------------------------------------
  // Screen-space overlays

  function drawHUD(state) {
    const hs = H / VIEW_H;
    const n = state.fighters.length;
    const cardW = Math.min(250, (W / hs - 40) / n - 12);
    const cardH = 82;
    const total = n * cardW + (n - 1) * 14;
    let x = (W / hs - total) / 2;
    const y = VIEW_H - cardH - 14;
    ctx.save();
    ctx.scale(hs, hs);
    for (const f of state.fighters) {
      const pc = PLAYER_COLORS[f.port];
      ctx.globalAlpha = f.state === 'out' ? 0.45 : 1;
      ctx.fillStyle = 'rgba(15, 12, 30, 0.72)';
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 14);
      ctx.fill();
      ctx.fillStyle = pc;
      ctx.beginPath();
      ctx.roundRect(x, y, 10, cardH, [14, 0, 0, 14]);
      ctx.fill();

      // Portrait
      const portrait = portraits && portraits[f.charId];
      if (portrait) ctx.drawImage(portrait, x + 14, y + 6, 70, 70);

      // Damage percent
      const pop = fx.hudPop[f.slot];
      const dmg = Math.floor(f.damage);
      ctx.save();
      ctx.translate(x + cardW - 14, y + 52);
      if (pop) ctx.translate((Math.random() - 0.5) * pop, (Math.random() - 0.5) * pop);
      const sc = 1 + pop * 0.03;
      ctx.scale(sc, sc);
      ctx.textAlign = 'right';
      ctx.font = '900 40px "Arial Black", system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const label = f.state === 'out' ? 'OUT' : `${dmg}%`;
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = f.state === 'out' ? '#9ca3af' : damageColor(dmg);
      ctx.fillText(label, 0, 0);
      ctx.restore();

      // Name and stocks
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      const name = f.char.name.length > 18 ? f.char.name.slice(0, 17) + '…' : f.char.name;
      ctx.fillText(name, x + 88, y + 20);
      for (let i = 0; i < f.stocks; i++) {
        ctx.fillStyle = f.char.colors.main;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + 96 + i * 16, y + 70, 6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      x += cardW + 14;
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawOffscreen(state, toScreen) {
    const hs = H / VIEW_H;
    for (const f of state.fighters) {
      if (f.state === 'dead' || f.state === 'out') continue;
      const [sx, sy] = toScreen(f.x, f.y - f.stats.height / 2);
      const m = 40 * hs;
      if (sx > m && sx < W - m && sy > m && sy < H - m) continue;
      const cx = Math.max(m, Math.min(W - m, sx));
      const cy = Math.max(m, Math.min(H - m - 90 * hs, sy));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = PLAYER_COLORS[f.port];
      ctx.beginPath();
      ctx.arc(0, 0, 26 * hs, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(15,12,30,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 22 * hs, 0, TAU);
      ctx.fill();
      const portrait = portraits && portraits[f.charId];
      if (portrait) ctx.drawImage(portrait, -20 * hs, -20 * hs, 40 * hs, 40 * hs);
      ctx.restore();
    }
  }

  function drawTexts(state) {
    const hs = H / VIEW_H;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const countdown = state.startTimer - state.frame;
    if (countdown > -40) {
      const n = Math.ceil(countdown / 50);
      const label = countdown > 0 ? String(n) : 'GO!';
      const local = countdown > 0 ? (countdown % 50) / 50 : 1 + countdown / 40;
      ctx.globalAlpha = Math.min(1, local * 2);
      ctx.font = `900 ${Math.round((130 + (1 - local) * 30) * hs)}px "Arial Black", system-ui, sans-serif`;
      ctx.lineWidth = 12 * hs;
      ctx.strokeStyle = 'rgba(20,10,40,0.85)';
      ctx.strokeText(label, W / 2, H * 0.4);
      ctx.fillStyle = countdown > 0 ? '#fde047' : '#4ade80';
      ctx.fillText(label, W / 2, H * 0.4);
      ctx.globalAlpha = 1;
    }
    for (const t of fx.texts) {
      const a = t.life / t.max;
      const grow = 1 + (1 - a) * 0.15;
      ctx.globalAlpha = Math.min(1, a * 3);
      ctx.font = `900 ${Math.round(t.size * grow * hs)}px "Arial Black", system-ui, sans-serif`;
      ctx.lineWidth = 10 * hs;
      ctx.strokeStyle = 'rgba(20,10,40,0.85)';
      ctx.strokeText(t.t, W / 2, H * 0.38);
      ctx.fillStyle = t.color;
      ctx.fillText(t.t, W / 2, H * 0.38);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------

  function render(state, events = []) {
    resize();
    handleEvents(state, events);
    updateCamera(state);

    const base = H / VIEW_H;
    const s = base * cam.zoom;
    const shx = (Math.random() - 0.5) * fx.shake * base;
    const shy = (Math.random() - 0.5) * fx.shake * base;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(ctx, state, { W, H, base, cam });

    const ox = W / 2 - cam.x * s + shx;
    const oy = H / 2 - cam.y * s + shy;
    ctx.setTransform(s, 0, 0, s, ox, oy);
    for (const p of state.platforms) drawPlatform(ctx, state, p);
    for (const p of state.projectiles) drawProjectile(p, state.frame);
    for (const f of state.fighters) drawFighter(f, state);
    drawEffects();
    if (debug) drawDebug(state);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawOffscreen(state, (x, y) => [x * s + ox, y * s + oy]);
    drawHUD(state);
    drawTexts(state);
    if (fx.flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${fx.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    updateEffects();
  }

  return {
    render,
    toggleDebug: () => (debug = !debug),
  };
}
