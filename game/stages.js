// Stage layouts and gimmicks. Coordinates are world pixels with y pointing
// down; a platform's y is its top surface. Solid platforms block from the
// sides and below, soft ones can be jumped through and dropped through.
//
// A stage can define update(state), which runs before fighters move each
// frame (moving platforms, timers), and affect(state, fighter, moved), which
// runs after a fighter moves (water currents, bouncy floors, vines).
import { nextRandom } from './rng.js';

const PEEL_HAZARD = { kind: 'peel', w: 34, h: 14, gravity: 0.5, life: 900, onGround: 'stay', hit: { damage: 4, angle: 85, base: 5, growth: 0.02, stun: 45 } };

export const STAGES = {
  sahur: {
    id: 'sahur',
    name: 'Sahur Village',
    blurb: 'Rooftops at night. TUNG TUNG TUNG! The drum platforms bounce you up.',
    blast: { left: -300, right: 1580, top: -260, bottom: 980 },
    platforms: [
      { id: 'main', x: 300, y: 500, w: 680, h: 70, solid: true },
      { id: 'left', x: 380, y: 370, w: 160, h: 14, drum: true },
      { id: 'right', x: 740, y: 370, w: 160, h: 14, drum: true },
      { id: 'top', x: 560, y: 250, w: 160, h: 14, drum: true },
    ],
    spawns: [
      { x: 420, y: 500 },
      { x: 860, y: 500 },
      { x: 560, y: 500 },
      { x: 720, y: 500 },
    ],
    respawn: { x: 640, y: 170 },
    update(state) {
      // Three drum beats every four seconds.
      const t = state.frame % 240;
      const beat = t === 0 || t === 16 || t === 32;
      for (const p of state.platforms) {
        if (!p.drum) continue;
        const since = [0, 16, 32].map((b) => t - b).filter((d) => d >= 0 && d < 12)[0];
        p.y = p.baseY + (since === undefined ? 0 : Math.sin((since / 12) * Math.PI) * 8);
      }
      if (beat && state.frame > state.startTimer) {
        state.events.push({ type: 'drum' });
        for (const f of state.fighters) {
          const p = f.grounded && state.platforms.find((q) => q.id === f.platformId);
          if (p && p.drum && (f.state === 'idle' || f.state === 'run' || f.state === 'landing')) {
            f.grounded = false;
            f.platformId = null;
            f.vy = -11;
            f.state = 'air';
            f.stateFrame = 0;
          }
        }
      }
    },
  },

  beach: {
    id: 'beach',
    name: 'Tralalero Beach',
    blurb: 'Sunny sand, but watch the tide. It floods in and pushes everyone sideways.',
    blast: { left: -320, right: 1600, top: -260, bottom: 1000 },
    platforms: [
      { id: 'main', x: 220, y: 520, w: 840, h: 70, solid: true },
      { id: 'tower', x: 300, y: 380, w: 130, h: 14 },
      { id: 'umbrella', x: 850, y: 390, w: 130, h: 14 },
    ],
    spawns: [
      { x: 360, y: 520 },
      { x: 920, y: 520 },
      { x: 520, y: 520 },
      { x: 760, y: 520 },
    ],
    respawn: { x: 640, y: 190 },
    update(state) {
      // Tide cycle: calm, rising, high, falling. The current flips each cycle.
      const t = state.frame % 1500;
      const low = 600;
      const high = 488;
      let level = low;
      if (t >= 1100 && t < 1200) level = low + ((high - low) * (t - 1100)) / 100;
      else if (t >= 1200 && t < 1400) level = high;
      else if (t >= 1400) level = high + ((low - high) * (t - 1400)) / 100;
      state.water = { level, current: Math.floor(state.frame / 1500) % 2 ? -1 : 1 };
      if (t === 1100) state.events.push({ type: 'tide' });
    },
    affect(state, f) {
      const w = state.water;
      if (!w || f.y <= w.level || f.state === 'respawn') return;
      f.x += w.current * 0.9;
      if (!f.inWater) state.events.push({ type: 'splash', x: f.x, y: w.level });
      f.inWater = true;
    },
  },

  skies: {
    id: 'skies',
    name: 'Bombardiro Skies',
    blurb: 'Fight on top of a giant bomber while little planes loop around it.',
    blast: { left: -320, right: 1600, top: -300, bottom: 1000 },
    platforms: [
      { id: 'main', x: 370, y: 500, w: 540, h: 46, solid: true, bob: 10 },
      { id: 'left', x: 150, y: 370, w: 140, h: 14, swing: { dx: 90, speed: 0.012 } },
      { id: 'right', x: 990, y: 370, w: 140, h: 14, swing: { dx: -90, speed: 0.012 } },
      { id: 'top', x: 570, y: 250, w: 140, h: 14, swing: { dx: 170, speed: 0.018 } },
    ],
    spawns: [
      { x: 450, y: 500 },
      { x: 830, y: 500 },
      { x: 560, y: 500 },
      { x: 720, y: 500 },
    ],
    respawn: { x: 640, y: 150 },
    update(state) {
      for (const p of state.platforms) {
        if (p.bob) p.y = p.baseY + Math.sin(state.frame * 0.02) * p.bob;
        if (p.swing) {
          p.x = p.baseX + Math.sin(state.frame * p.swing.speed) * p.swing.dx;
          p.y = p.baseY + Math.cos(state.frame * p.swing.speed * 2) * 12;
        }
      }
    },
  },

  cafe: {
    id: 'cafe',
    name: 'Cappuccino Café',
    blurb: 'A giant saucer. Land on the milk foam and it bounces you sky-high.',
    blast: { left: -300, right: 1580, top: -280, bottom: 980 },
    platforms: [
      { id: 'main', x: 290, y: 510, w: 700, h: 60, solid: true },
      { id: 'foam', x: 540, y: 390, w: 200, h: 14, bouncy: true },
      { id: 'sugarL', x: 330, y: 320, w: 110, h: 14 },
      { id: 'sugarR', x: 840, y: 320, w: 110, h: 14 },
    ],
    spawns: [
      { x: 400, y: 510 },
      { x: 880, y: 510 },
      { x: 540, y: 510 },
      { x: 740, y: 510 },
    ],
    respawn: { x: 640, y: 170 },
    update(state) {
      for (const p of state.platforms) {
        if (p.bouncy) p.y = p.baseY + Math.sin(state.frame * 0.05) * 6;
      }
    },
    affect(state, f, moved) {
      if (!moved.landed) return;
      const p = state.platforms.find((q) => q.id === f.platformId);
      if (!p || !p.bouncy || f.state === 'hitstun') return;
      f.grounded = false;
      f.platformId = null;
      f.vy = -Math.max(13, moved.landSpeed * 1.1);
      f.move = null;
      f.state = 'air';
      f.stateFrame = 0;
      state.events.push({ type: 'boing', x: f.x, y: p.y });
    },
  },

  jungle: {
    id: 'jungle',
    name: 'Banana Jungle',
    blurb: 'Grab a vine off the edge to get your jump back. Mind the falling banana peels.',
    blast: { left: -300, right: 1580, top: -260, bottom: 980 },
    platforms: [
      { id: 'main', x: 320, y: 510, w: 640, h: 70, solid: true },
      { id: 'branchL', x: 350, y: 370, w: 150, h: 14 },
      { id: 'branchR', x: 780, y: 370, w: 150, h: 14 },
    ],
    vines: [
      { x: 250, top: 250, bottom: 600 },
      { x: 1030, top: 250, bottom: 600 },
    ],
    spawns: [
      { x: 400, y: 510 },
      { x: 880, y: 510 },
      { x: 550, y: 510 },
      { x: 730, y: 510 },
    ],
    respawn: { x: 640, y: 170 },
    update(state) {
      if (state.frame <= state.startTimer || state.frame % 60) return;
      const peels = state.projectiles.filter((p) => p.owner === -1).length;
      if (peels < 2 && nextRandom(state) < 0.1) {
        const main = mainPlatform(state);
        spawnHazard(state, { ...PEEL_HAZARD, x: main.x + 40 + nextRandom(state) * (main.w - 80), y: -150 });
      }
    },
    affect(state, f) {
      if (f.grounded || f.state === 'hitstun' || f.state === 'respawn') return;
      for (const [i, v] of state.stage.vines.entries()) {
        if (Math.abs(f.x - v.x) > 26 || f.y < v.top || f.y - f.stats.height > v.bottom) continue;
        const key = `vine${i}`;
        if (state.frame - (f.cooldowns[key] || -999) < 90) continue;
        f.cooldowns[key] = state.frame;
        f.jumpsLeft = Math.max(f.jumpsLeft, 1);
        f.airSpecials = {};
        if (f.state === 'helpless') f.state = 'air';
        f.vy = Math.min(f.vy, 0);
        state.events.push({ type: 'vine', x: v.x, y: f.y - 40, slot: f.slot });
      }
    },
  },
};

export const STAGE_LIST = Object.values(STAGES);

// Copies a stage's platforms into match state so stage gimmicks can move them.
export function buildPlatforms(stage) {
  return stage.platforms.map((p) => ({ ...p, solid: !!p.solid, baseX: p.x, baseY: p.y, prevX: p.x, prevY: p.y }));
}

// Runs once per frame before fighters move.
export function updateStage(state) {
  for (const p of state.platforms) {
    p.prevX = p.x;
    p.prevY = p.y;
  }
  if (state.stage.update) state.stage.update(state);
}

// Runs after a fighter has moved and collided this frame.
export function stageAffect(state, f, moved) {
  if (state.stage.affect) state.stage.affect(state, f, moved);
  if (!state.water || f.y <= state.water.level) f.inWater = false;
}

export function mainPlatform(state) {
  return state.platforms.find((p) => p.solid) || state.platforms[0];
}

function spawnHazard(state, spec) {
  state.projectiles.push({
    id: state.nextId++,
    owner: -1,
    kind: spec.kind,
    x: spec.x,
    y: spec.y,
    vx: 0,
    vy: 0,
    gravity: spec.gravity,
    life: spec.life,
    age: 0,
    w: spec.w,
    h: spec.h,
    hit: spec.hit,
    pierce: false,
    onGround: spec.onGround,
    explode: null,
    facing: 1,
    platformId: null,
    hitIds: {},
  });
}
