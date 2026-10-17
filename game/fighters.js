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
    // Final: a tsunami sweeps the whole stage from behind.
    final: {
      name: 'TSUNAMI!',
      total: 100,
      invuln: [1, 100],
      spawn: [{ frame: 18, anchor: 'stage', kind: 'wave', x: -700, y: -100, vx: 10, w: 180, h: 240, life: 150, pierce: true, hit: { damage: 28, angle: 40, base: 12, growth: 0.2 } }],
    },
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
    // Final: three giant stomps, each sending shockwaves across the stage.
    final: {
      name: 'TUNG TUNG TUNG!',
      total: 110,
      invuln: [1, 110],
      hits: [20, 50, 80].map((start, i) => ({ start, end: start + 3, group: i, box: { x: 0, y: -40, w: 300, h: 140 }, damage: 10, angle: 75, base: i === 2 ? 12 : 6, growth: i === 2 ? 0.2 : 0.05 })),
      spawn: [20, 50, 80].flatMap((frame) =>
        [1, -1].map((d) => ({ frame, kind: 'shockwave', x: 40 * d, y: -30, vx: 12 * d, w: 80, h: 60, life: 60, onGround: 'slide', pierce: true, hit: { damage: 10, angle: 72, base: 8, growth: 0.14 } })),
      ),
    },
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

  bombardiro: fighter({
    id: 'bombardiro',
    name: 'Bombardiro Crocodilo',
    tagline: 'A crocodile bomber plane. Heavy, but flies with three jumps.',
    colors: { main: '#65a30d', dark: '#3f6212', light: '#d9f99d', accent: '#f97316', plane: '#6b7280' },
    style: { reach: 1.1, power: 1.1, speed: 0.95 },
    stats: { walk: 4.6, airSpeed: 4.9, weight: 112, jumps: 3, jumpVel: 12, airJumpVel: 10.5, gravity: 0.55, fallSpeed: 9.5, width: 62, height: 74 },
    // Final: flies up and carpet-bombs the stage.
    final: {
      name: 'CARPET BOMBING!',
      total: 120,
      invuln: [1, 120],
      gravity: 0,
      motion: [{ from: 1, to: 30, vx: 0, vy: -6 }, { from: 31, to: 120, vx: 0, vy: 0 }],
      spawn: Array.from({ length: 11 }, (_, i) => ({
        ...bomb({ frame: 30 + i * 6, vx: 0, vy: 3 }),
        anchor: 'stage',
        x: -400 + i * 80,
        y: -520,
        max: 0,
        explode: { size: 150, life: 12, hit: { damage: 14, angle: 70, base: 9, growth: 0.15, angleMode: 'away' } },
      })),
    },
    specials: {
      // Drops a bomb that blows up when it lands or hits someone.
      neutralSpecial: {
        total: 34,
        spawn: [bomb({ frame: 12, vx: 3, vy: -5 })],
      },
      neutralSpecialAir: {
        total: 30,
        spawn: [bomb({ frame: 8, vx: 0, vy: 2, y: -6 })],
      },
      // Propeller rush forward, flying level.
      sideSpecial: {
        total: 42,
        airOnce: true,
        gravity: 0,
        motion: [{ from: 1, to: 7, vy: 0 }, { from: 8, to: 30, vx: 11, vy: 0 }],
        hits: [{ start: 8, end: 30, box: { x: 30, y: -38, w: 64, h: 48 }, damage: 10, angle: 40, base: 6, growth: 0.11 }],
      },
      // Afterburners: rockets up, scorching anyone underneath.
      upSpecial: {
        total: 38,
        helpless: true,
        steer: 0.7,
        landingLag: 12,
        motion: [{ from: 6, to: 6, vy: -17, vx: 3 }],
        hits: [{ start: 6, end: 14, box: { x: -10, y: 12, w: 54, h: 44 }, damage: 8, angle: 60, base: 6, growth: 0.07 }],
      },
      // Nose-dive that explodes on the ground. Careful near the edge.
      downSpecial: {
        total: 50,
        endOnLand: true,
        motion: [{ from: 4, to: 4, vy: -9 }, { from: 10, to: 50, vx: 7, vy: 12 }],
        hits: [{ start: 10, end: 50, box: { x: 20, y: -30, w: 60, h: 50 }, damage: 12, angle: -45, base: 6, growth: 0.1 }],
        onLand: {
          landingLag: 18,
          spawn: [{ kind: 'explosion', x: 20, y: -30, w: 130, h: 90, life: 10, pierce: true, hit: { damage: 10, angle: 65, base: 7, growth: 0.1, angleMode: 'away' } }],
        },
      },
    },
  }),

  ballerina: fighter({
    id: 'ballerina',
    name: 'Ballerina Cappuccina',
    tagline: 'A dancing cappuccino. Floaty, tricky, hard to pin down.',
    colors: { main: '#f9a8d4', dark: '#db2777', light: '#fdf2f8', accent: '#c08552' },
    style: { reach: 1.05, power: 0.95, speed: 1.2 },
    stats: { walk: 5.4, airSpeed: 5, airAccel: 0.55, weight: 88, gravity: 0.5, fallSpeed: 9, jumpVel: 13, airJumpVel: 12.5, width: 46, height: 92 },
    // Final: a spinning tornado that carries everyone up and flings them.
    final: {
      name: 'GRAND JETÉ TORNADO!',
      total: 120,
      invuln: [1, 120],
      gravity: 0,
      motion: [{ from: 1, to: 110, vx: 4, vy: 0 }],
      hits: [
        { start: 10, end: 108, box: { x: 0, y: -70, w: 150, h: 170 }, damage: 3, angle: 90, base: 4, growth: 0, rehit: 7, stun: 14 },
        { start: 110, end: 114, group: 'end', box: { x: 0, y: -70, w: 190, h: 200 }, damage: 12, angle: 55, base: 12, growth: 0.18, angleMode: 'away' },
      ],
    },
    specials: {
      // A spinning pirouette that hits many times, then flings.
      neutralSpecial: {
        total: 44,
        steer: 0.6,
        gravity: 0.5,
        hits: [
          { start: 6, end: 26, box: { x: 0, y: -48, w: 92, h: 72 }, damage: 2, angle: 90, base: 3, growth: 0, rehit: 5, stun: 12 },
          { start: 30, end: 33, box: { x: 0, y: -48, w: 104, h: 82 }, damage: 6, angle: 45, base: 7, growth: 0.12, angleMode: 'away' },
        ],
      },
      // Flicks a splash of hot coffee that slows whoever it hits.
      sideSpecial: {
        total: 36,
        spawn: [{ frame: 14, kind: 'coffee', x: 30, y: -50, vx: 9, vy: -2, gravity: 0.25, w: 30, h: 26, life: 50, onGround: 'remove', max: 2, hit: { damage: 6, angle: 40, base: 4, growth: 0.06, slow: 150 } }],
      },
      // Grand leap upward.
      upSpecial: {
        total: 36,
        helpless: true,
        steer: 0.7,
        landingLag: 10,
        motion: [{ from: 5, to: 5, vy: -16.5, vx: 2.5 }],
        hits: [{ start: 5, end: 15, box: { x: 0, y: -60, w: 70, h: 90 }, damage: 8, angle: 75, base: 6, growth: 0.08 }],
      },
      // Tiptoes out of the way, then kicks.
      downSpecial: {
        total: 34,
        invuln: [2, 14],
        motion: [{ from: 2, to: 10, vx: -7 }, { from: 14, to: 18, vx: 6 }],
        hits: [{ start: 16, end: 19, box: { x: 40, y: -40, w: 60, h: 40 }, damage: 9, angle: 40, base: 6, growth: 0.12 }],
      },
    },
  }),

  patapim: fighter({
    id: 'patapim',
    name: 'Brr Brr Patapim',
    tagline: 'A tree-monkey with giant feet. Grabs you and throws you away.',
    colors: { main: '#8b5e3c', dark: '#5b3a22', light: '#86efac', accent: '#67e8f9' },
    style: { reach: 1.1, power: 1.15, speed: 0.95 },
    stats: { walk: 4.8, airSpeed: 4.2, weight: 116, jumpVel: 12.6, width: 56, height: 90 },
    // Final: trees burst out of the ground across the stage.
    final: {
      name: 'FOREST STOMP!',
      total: 110,
      invuln: [1, 110],
      spawn: [-300, -150, 0, 150, 300].map((x, i) => ({ frame: 20 + i * 10, anchor: 'stage', kind: 'tree', x, y: -80, w: 80, h: 170, life: 40, pierce: true, hit: { damage: 16, angle: 85, base: 10, growth: 0.17 } })),
    },
    specials: {
      // Roots grab whoever is in front, then fling them.
      neutralSpecial: {
        total: 48,
        hits: [{ start: 10, end: 14, box: { x: 44, y: -44, w: 52, h: 64 }, damage: 3, angle: 0, base: 0, growth: 0, grab: { hold: 26, throw: { damage: 10, angle: 45, base: 8, growth: 0.14 } } }],
      },
      // Steps in with a giant foot.
      sideSpecial: {
        total: 40,
        airOnce: true,
        motion: [{ from: 6, to: 12, vx: 5 }],
        hits: [{ start: 14, end: 17, box: { x: 46, y: -14, w: 72, h: 36 }, damage: 13, angle: 80, base: 8, growth: 0.11 }],
      },
      // Swings up on a vine.
      upSpecial: {
        total: 38,
        helpless: true,
        steer: 0.6,
        landingLag: 12,
        motion: [{ from: 6, to: 6, vy: -15, vx: 6 }],
        hits: [{ start: 6, end: 18, box: { x: 20, y: -70, w: 60, h: 60 }, damage: 7, angle: 60, base: 6, growth: 0.08 }],
      },
      // "Brr brr": an icy breath all around that slows everyone nearby.
      downSpecial: {
        total: 40,
        hits: [{ start: 12, end: 18, box: { x: 0, y: -46, w: 150, h: 100 }, damage: 5, angle: 80, base: 4, growth: 0.03, slow: 180, angleMode: 'away' }],
      },
    },
  }),

  chimpanzini: fighter({
    id: 'chimpanzini',
    name: 'Chimpanzini Bananini',
    tagline: 'A chimp in a banana. Quick, bouncy, full of tricks.',
    colors: { main: '#facc15', dark: '#a16207', light: '#fef9c3', accent: '#fde047', fur: '#7c4a2a' },
    style: { reach: 0.95, power: 0.95, speed: 1.2 },
    stats: { walk: 6, airSpeed: 5, weight: 86, jumpVel: 14, airJumpVel: 12.5, width: 46, height: 78 },
    // Final: bananas rain down from the sky.
    final: {
      name: 'BANANA RAIN!',
      total: 100,
      invuln: [1, 100],
      spawn: Array.from({ length: 12 }, (_, i) => ({ frame: 15 + i * 5, anchor: 'stage', kind: 'banana', x: -330 + ((i * 7) % 12) * 60, y: -520, vx: 0, vy: 6, gravity: 0.3, w: 34, h: 24, life: 160, onGround: 'remove', pierce: true, hit: { damage: 10, angle: 70, base: 8, growth: 0.13 } })),
    },
    specials: {
      // Lobs a banana.
      neutralSpecial: {
        total: 30,
        spawn: [{ frame: 10, kind: 'banana', x: 26, y: -50, vx: 8, vy: -6, gravity: 0.4, w: 26, h: 18, life: 80, onGround: 'remove', max: 2, hit: { damage: 7, angle: 45, base: 5, growth: 0.08 } }],
      },
      // Rolls forward, untouchable at first, and pops out with a hit.
      sideSpecial: {
        total: 34,
        airOnce: true,
        gravity: 0.4,
        invuln: [3, 12],
        motion: [{ from: 3, to: 18, vx: 12 }],
        hits: [{ start: 18, end: 21, box: { x: 34, y: -36, w: 56, h: 46 }, damage: 9, angle: 35, base: 6, growth: 0.12 }],
      },
      // Flips high into the air.
      upSpecial: {
        total: 34,
        helpless: true,
        steer: 0.7,
        landingLag: 10,
        motion: [{ from: 4, to: 4, vy: -17, vx: 2 }],
        hits: [{ start: 4, end: 14, box: { x: 0, y: -50, w: 70, h: 80 }, damage: 7, angle: 80, base: 6, growth: 0.07 }],
      },
      // Drops a banana peel. Anyone else who steps on it slips.
      downSpecial: {
        total: 28,
        spawn: [{ frame: 10, kind: 'peel', x: 30, y: -6, vx: 0, vy: 0, gravity: 0.5, w: 34, h: 14, life: 900, onGround: 'stay', max: 1, hit: { damage: 4, angle: 85, base: 5, growth: 0.02, stun: 45 } }],
      },
    },
  }),

  lirili: fighter({
    id: 'lirili',
    name: 'Lirilì Larilà',
    tagline: 'A cactus elephant in sandals. Keeps you away with spikes.',
    colors: { main: '#9ca3af', dark: '#4b5563', light: '#e5e7eb', accent: '#a3e635', cactus: '#4d9a3a' },
    style: { reach: 1.25, power: 1.05, speed: 0.9 },
    stats: { walk: 4.6, airSpeed: 4.2, weight: 106, width: 58, height: 88 },
    // Final: freezes everyone, then drops a rain of spikes on them.
    final: {
      name: 'TIME STOP!',
      total: 100,
      invuln: [1, 100],
      noSwoosh: true,
      hits: [{ start: 15, end: 16, box: { x: 0, y: -200, w: 2400, h: 1400 }, damage: 6, angle: 0, base: 0, growth: 0, freeze: 150 }],
      spawn: Array.from({ length: 9 }, (_, i) => ({ frame: 30 + i * 6, anchor: 'stage', kind: 'spike', x: -320 + i * 80, y: -500, vx: 0, vy: 9, gravity: 0.25, w: 14, h: 26, life: 120, onGround: 'remove', pierce: true, hit: { damage: 9, angle: 60, base: 9, growth: 0.15 } })),
    },
    specials: {
      // Fires three cactus spikes in a spread.
      neutralSpecial: {
        total: 36,
        spawn: [-1.5, 0, 1.5].map((vy) => ({ frame: 12, kind: 'spike', x: 30, y: -50, vx: 10, vy, gravity: 0.05, w: 18, h: 10, life: 45, onGround: 'remove', max: 6, hit: { damage: 4, angle: 30, base: 4, growth: 0.05 } })),
      },
      // Long trunk sweep.
      sideSpecial: {
        total: 38,
        hits: [{ start: 12, end: 16, box: { x: 70, y: -40, w: 100, h: 32 }, damage: 11, angle: 30, base: 7, growth: 0.12 }],
      },
      // Hops up and rains spikes below.
      upSpecial: {
        total: 36,
        helpless: true,
        steer: 0.6,
        landingLag: 12,
        motion: [{ from: 6, to: 6, vy: -15.5, vx: 2 }],
        hits: [{ start: 6, end: 12, box: { x: 0, y: -10, w: 60, h: 40 }, damage: 6, angle: 70, base: 6, growth: 0.06 }],
        spawn: [-3, 3].map((vx) => ({ frame: 8, kind: 'spike', x: 0, y: 0, vx, vy: 8, gravity: 0.2, w: 10, h: 18, life: 40, onGround: 'remove', max: 6, hit: { damage: 4, angle: -60, base: 4, growth: 0.04 } })),
      },
      // Stops time for whoever is in front.
      downSpecial: {
        total: 46,
        hits: [{ start: 14, end: 18, box: { x: 50, y: -46, w: 90, h: 84 }, damage: 4, angle: 0, base: 0, growth: 0, freeze: 55 }],
      },
    },
  }),

  assassino: fighter({
    id: 'assassino',
    name: 'Cappuccino Assassino',
    tagline: 'A ninja coffee cup. Fast and deadly, but goes flying easily.',
    colors: { main: '#f5f5f4', dark: '#1c1917', light: '#d6a77a', accent: '#a78bfa' },
    style: { reach: 1.05, power: 1.15, speed: 1.25 },
    stats: { walk: 6.4, airSpeed: 5, weight: 80, jumpVel: 13.8, width: 44, height: 84 },
    // Final: slices across the whole screen five times, then a finishing cut.
    final: {
      name: 'ESPRESSO SLASH!',
      total: 100,
      invuln: [1, 100],
      noSwoosh: true,
      hits: [
        ...[20, 30, 40, 50, 60].map((start, i) => ({ start, end: start + 1, group: i, box: { x: 0, y: -150, w: 1500, h: 500 }, damage: 5, angle: 80, base: 3, growth: 0, stun: 20 })),
        { start: 75, end: 76, group: 'end', box: { x: 0, y: -150, w: 1500, h: 500 }, damage: 14, angle: 45, base: 12, growth: 0.18, angleMode: 'away' },
      ],
    },
    specials: {
      // Throwing stars.
      neutralSpecial: {
        total: 22,
        spawn: [{ frame: 7, kind: 'star', x: 24, y: -50, vx: 15, vy: 0, w: 18, h: 18, life: 40, onGround: 'remove', max: 3, hit: { damage: 3, angle: 30, base: 3, growth: 0.03 } }],
      },
      // Vanishes and reappears further ahead, slicing everything in between.
      sideSpecial: {
        total: 34,
        airOnce: true,
        gravity: 0.2,
        invuln: [6, 12],
        teleport: { frame: 10, dx: 150 },
        hits: [{ start: 10, end: 13, box: { x: -70, y: -44, w: 170, h: 50 }, damage: 11, angle: 40, base: 7, growth: 0.12 }],
      },
      // Puff of steam carries him upward.
      upSpecial: {
        total: 32,
        helpless: true,
        steer: 0.7,
        landingLag: 10,
        motion: [{ from: 4, to: 4, vy: -16.5, vx: 3 }],
        hits: [{ start: 4, end: 12, box: { x: 10, y: -60, w: 60, h: 70 }, damage: 7, angle: 80, base: 6, growth: 0.07 }],
      },
      // Counter stance: if hit, strikes back harder.
      downSpecial: {
        total: 40,
        counter: { from: 4, to: 24, hit: { damage: 10, angle: 38, base: 8, growth: 0.13 } },
      },
    },
  }),
};

function bomb({ frame, vx, vy, y = -24 }) {
  return {
    frame,
    kind: 'bomb',
    x: 10,
    y,
    vx,
    vy,
    gravity: 0.45,
    w: 22,
    h: 22,
    life: 120,
    onGround: 'explode',
    max: 2,
    hit: { damage: 4, angle: 70, base: 4, growth: 0.04 },
    explode: { size: 110, life: 10, hit: { damage: 12, angle: 70, base: 7, growth: 0.12, angleMode: 'away' } },
  };
}

export const FIGHTER_LIST = Object.values(FIGHTERS);
