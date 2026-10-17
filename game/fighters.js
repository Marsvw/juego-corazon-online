// Fighter data: stats, colors and frame data for every move.
//
// Hitbox boxes are relative to the fighter's feet: x is the forward offset of
// the box centre (mirrored when facing left), y is the vertical offset of the
// centre (negative is up). Frames count from 1 when a move starts.
//
// A hit's launch strength is (base + targetDamage * growth) scaled by the
// target's weight. Angle 0 sends the target straight forward, 90 straight up,
// negative angles send them down.

const BASE_STATS = {
  walk: 5.2,
  groundAccel: 1.1,
  friction: 0.8,
  airSpeed: 4.4,
  airAccel: 0.45,
  airFriction: 0.08,
  jumpVel: 13,
  airJumpVel: 12,
  gravity: 0.62,
  fallSpeed: 11,
  fastFall: 16,
  weight: 100,
  jumps: 2,
  width: 52,
  height: 84,
};

// Shared normal attacks. Each fighter tunes them with reach (hitbox size and
// distance), power (damage and launch) and speed (startup and recovery).
function normals({ reach = 1, power = 1, speed = 1 } = {}) {
  const t = (n) => Math.max(1, Math.round(n / speed));
  const box = (x, y, w, h) => ({ x: x * reach, y, w: w * reach, h });
  const hit = (start, end, b, damage, angle, base, growth) => ({
    start: t(start),
    end: t(end),
    box: b,
    damage: Math.round(damage * power),
    angle,
    base,
    growth: growth * power,
  });
  return {
    jab: { total: t(18), hits: [hit(4, 7, box(34, -46, 44, 28), 3, 40, 3, 0.04)] },
    sideTilt: { total: t(30), hits: [hit(8, 12, box(50, -42, 60, 32), 9, 38, 6, 0.135)] },
    upTilt: { total: t(28), hits: [hit(6, 12, box(8, -92, 66, 44), 8, 86, 6, 0.14)] },
    downTilt: { total: t(22), hits: [hit(5, 8, box(42, -12, 64, 22), 6, 25, 4, 0.08)] },
    nair: { total: t(32), hits: [hit(4, 12, box(0, -42, 86, 74), 7, 48, 4, 0.08)], landingLag: 6, steer: 1 },
    fair: { total: t(32), hits: [hit(7, 11, box(44, -46, 56, 44), 10, 40, 6, 0.125)], landingLag: 9, steer: 1 },
    upAir: { total: t(28), hits: [hit(5, 10, box(0, -96, 74, 40), 8, 84, 5, 0.13)], landingLag: 7, steer: 1 },
    downAir: { total: t(38), hits: [hit(10, 14, box(0, 0, 48, 44), 11, -80, 5, 0.1)], landingLag: 12, steer: 1 },
  };
}

function fighter(def) {
  const stats = { ...BASE_STATS, ...def.stats };
  return { ...def, stats, moves: { ...normals(def.style), ...def.specials } };
}

export const FIGHTERS = {
  tralalero: fighter({
    id: 'tralalero',
    name: 'Tralalero Tralala',
    tagline: 'A shark in sneakers. Fast, light, never stops running.',
    colors: { main: '#3b82f6', dark: '#1d4ed8', light: '#e0f2fe', accent: '#38bdf8' },
    style: { reach: 1, power: 0.95, speed: 1.15 },
    stats: { walk: 6.2, airSpeed: 4.8, weight: 88, jumpVel: 13.5 },
    specials: {
      // Chomp straight ahead. Slow to start, launches hard.
      neutralSpecial: {
        total: 40,
        hits: [{ start: 14, end: 18, box: { x: 46, y: -48, w: 54, h: 48 }, damage: 12, angle: 40, base: 7, growth: 0.15 }],
      },
      // Sneaker dash along the ground (or air) that bowls over anyone in the way.
      sideSpecial: {
        total: 36,
        airOnce: true,
        gravity: 0.3,
        motion: [{ from: 6, to: 20, vx: 13 }, { from: 21, to: 36, vx: 4 }],
        hits: [{ start: 6, end: 20, box: { x: 26, y: -40, w: 58, h: 60 }, damage: 9, angle: 45, base: 6, growth: 0.1 }],
      },
      // Spinning fin that carries him upward.
      upSpecial: {
        total: 34,
        helpless: true,
        steer: 0.6,
        landingLag: 10,
        motion: [{ from: 4, to: 4, vy: -16, vx: 2 }],
        hits: [{ start: 4, end: 16, box: { x: 0, y: -48, w: 72, h: 84 }, damage: 3, angle: 85, base: 5, growth: 0.03, rehit: 4 }],
      },
      // Belly flop. Plunges in the air and splashes on landing.
      downSpecial: {
        total: 44,
        endOnLand: true,
        motion: [{ from: 6, to: 6, vx: 0, vy: -6 }, { from: 14, to: 44, vy: 17 }],
        hits: [{ start: 14, end: 44, box: { x: 0, y: -10, w: 56, h: 40 }, damage: 8, angle: -70, base: 5, growth: 0.08 }],
        onLand: {
          landingLag: 14,
          spawn: [
            { kind: 'splash', x: 30, y: -16, vx: 7, w: 44, h: 32, life: 22, onGround: 'slide', pierce: true, hit: { damage: 7, angle: 60, base: 6, growth: 0.1 } },
            { kind: 'splash', x: -30, y: -16, vx: -7, w: 44, h: 32, life: 22, onGround: 'slide', pierce: true, hit: { damage: 7, angle: 60, base: 6, growth: 0.1 } },
          ],
        },
      },
    },
  }),

  tungtung: fighter({
    id: 'tungtung',
    name: 'Tung Tung Tung Sahur',
    tagline: 'A wooden log with a bat. Slow, heavy, hits like a truck.',
    colors: { main: '#b07a45', dark: '#7a4f27', light: '#f1d3a8', accent: '#f59e0b' },
    style: { reach: 1.15, power: 1.25, speed: 0.85 },
    stats: { walk: 4.4, airSpeed: 3.8, weight: 124, jumpVel: 12.4, airJumpVel: 11.5, gravity: 0.68, fallSpeed: 12, width: 50, height: 96 },
    specials: {
      // The big bat swing. Long wind-up, huge launch.
      neutralSpecial: {
        total: 52,
        hits: [{ start: 22, end: 26, box: { x: 58, y: -50, w: 70, h: 64 }, damage: 19, angle: 38, base: 9, growth: 0.17 }],
      },
      // Lunging bonk.
      sideSpecial: {
        total: 40,
        airOnce: true,
        motion: [{ from: 8, to: 16, vx: 8 }],
        hits: [{ start: 12, end: 16, box: { x: 50, y: -56, w: 56, h: 50 }, damage: 13, angle: 50, base: 7, growth: 0.12 }],
      },
      // Bat-first rocket upward.
      upSpecial: {
        total: 36,
        helpless: true,
        steer: 0.5,
        landingLag: 12,
        motion: [{ from: 5, to: 5, vy: -16.5, vx: 1.5 }],
        hits: [{ start: 5, end: 12, box: { x: 10, y: -100, w: 56, h: 60 }, damage: 10, angle: 80, base: 7, growth: 0.1 }],
      },
      // TUNG! A stomp that sends shockwaves both ways along the floor.
      downSpecial: {
        total: 46,
        spawn: [
          { frame: 18, kind: 'shockwave', x: 30, y: -14, vx: 8, w: 40, h: 28, life: 36, onGround: 'slide', pierce: true, hit: { damage: 8, angle: 72, base: 6, growth: 0.09 } },
          { frame: 18, kind: 'shockwave', x: -30, y: -14, vx: -8, w: 40, h: 28, life: 36, onGround: 'slide', pierce: true, hit: { damage: 8, angle: 72, base: 6, growth: 0.09 } },
        ],
        hits: [{ start: 17, end: 19, box: { x: 0, y: -20, w: 90, h: 40 }, damage: 6, angle: 80, base: 6, growth: 0.06 }],
      },
    },
  }),
};

export const FIGHTER_LIST = Object.values(FIGHTERS);
