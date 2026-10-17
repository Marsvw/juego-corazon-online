// Items that drop onto the stage: pizza heals, espresso speeds you up, a
// banana peel can be thrown, and breaking the Skibidi Orb unlocks your Final.
import { nextRandom } from './rng.js';
import { mainPlatform } from './stages.js';
import { overlap } from './combat.js';
import { hurtbox } from './physics.js';

export const ITEM_TYPES = {
  pizza: { w: 36, h: 28, chance: 3 },
  espresso: { w: 26, h: 30, chance: 3 },
  peel: { w: 32, h: 16, chance: 2 },
  orb: { w: 46, h: 46, chance: 1.5 },
};

const ITEM_LIFE = 900;
const ORB_HP = 3;
const HEAL = 25;
const BOOST_FRAMES = 480;

// The move used to throw a held banana peel.
export const ITEM_THROW = {
  total: 18,
  spawn: [{ frame: 5, kind: 'peel', x: 26, y: -40, vx: 9, vy: -5, gravity: 0.5, w: 34, h: 14, life: 900, onGround: 'stay', max: 2, hit: { damage: 6, angle: 85, base: 5, growth: 0.03, stun: 45 } }],
};

function canHaveOrb(state) {
  if (state.items.some((it) => it.kind === 'orb')) return false;
  return !state.fighters.some((f) => f.finalReady || (f.move && f.move.id === 'final'));
}

export function spawnItem(state, kind) {
  if (!kind) {
    const options = Object.entries(ITEM_TYPES).filter(([k]) => k !== 'orb' || canHaveOrb(state));
    const total = options.reduce((n, [, t]) => n + t.chance, 0);
    let r = nextRandom(state) * total;
    kind = options[options.length - 1][0];
    for (const [k, t] of options) {
      if ((r -= t.chance) < 0) {
        kind = k;
        break;
      }
    }
  }
  const main = mainPlatform(state);
  const type = ITEM_TYPES[kind];
  const x = main.x + 60 + nextRandom(state) * (main.w - 120);
  const item = {
    id: state.nextId++,
    kind,
    x,
    y: kind === 'orb' ? main.y - 220 : main.y - 520,
    baseX: main.x + main.w / 2,
    baseY: main.y - 220,
    vy: 0,
    w: type.w,
    h: type.h,
    age: 0,
    life: kind === 'orb' ? ITEM_LIFE * 1.5 : ITEM_LIFE,
    platformId: null,
    hp: ORB_HP,
    hitCooldown: 0,
  };
  state.items.push(item);
  state.events.push({ type: 'itemSpawn', x: item.x, y: item.y, kind });
  return item;
}

export function updateItems(state) {
  if (state.itemsOn && state.frame > state.startTimer && --state.itemTimer <= 0) {
    spawnItem(state);
    state.itemTimer = 480 + Math.floor(nextRandom(state) * 360);
  }

  for (const it of state.items) {
    it.age++;
    it.life--;
    if (it.hitCooldown > 0) it.hitCooldown--;
    if (it.kind === 'orb') {
      // Drifts around above the stage.
      it.x = it.baseX + Math.sin(it.age * 0.011) * 260;
      it.y = it.baseY + Math.sin(it.age * 0.027) * 70;
      continue;
    }
    if (it.platformId) {
      const p = state.platforms.find((q) => q.id === it.platformId);
      if (p) {
        it.x += p.x - p.prevX;
        it.y = p.y - it.h / 2;
        continue;
      }
      it.platformId = null;
    }
    const prevBottom = it.y + it.h / 2;
    it.vy = Math.min(it.vy + 0.45, 10);
    it.y += it.vy;
    const bottom = it.y + it.h / 2;
    for (const p of state.platforms) {
      if (it.x < p.x || it.x > p.x + p.w) continue;
      if (prevBottom <= p.prevY + 1 && bottom >= p.y) {
        it.y = p.y - it.h / 2;
        it.vy = 0;
        it.platformId = p.id;
        break;
      }
    }
    if (it.y > state.stage.blast.bottom) it.life = 0;
  }

  for (const f of state.fighters) {
    if (f.state === 'dead' || f.state === 'out' || f.state === 'respawn' || f.state === 'grabbed') continue;
    const hb = hurtbox(f);
    for (const it of state.items) {
      if (it.life <= 0 || it.kind === 'orb') continue;
      if (!overlap(hb, itemBox(it))) continue;
      if (it.kind === 'pizza') {
        f.damage = Math.max(0, f.damage - HEAL);
        state.events.push({ type: 'heal', x: f.x, y: f.y - f.stats.height, slot: f.slot });
      } else if (it.kind === 'espresso') {
        f.status.boost = BOOST_FRAMES;
        state.events.push({ type: 'boost', x: f.x, y: f.y - f.stats.height, slot: f.slot });
      } else if (it.kind === 'peel') {
        if (f.held) continue;
        f.held = 'peel';
        state.events.push({ type: 'pickup', x: f.x, y: f.y - f.stats.height, slot: f.slot });
      }
      it.life = 0;
    }
  }
  state.items = state.items.filter((it) => it.life > 0);
}

export function itemBox(it) {
  return { x: it.x - it.w / 2, y: it.y - it.h / 2, w: it.w, h: it.h };
}

// Called when an attack or projectile box is active. Returns true if it hit an orb.
export function hitOrbs(state, box, attacker) {
  if (!attacker) return false;
  let hit = false;
  for (const it of state.items) {
    if (it.kind !== 'orb' || it.life <= 0 || it.hitCooldown > 0) continue;
    if (!overlap(box, itemBox(it))) continue;
    hit = true;
    it.hp--;
    it.hitCooldown = 12;
    state.events.push({ type: 'orbHit', x: it.x, y: it.y, slot: attacker.slot });
    if (it.hp <= 0) {
      it.life = 0;
      attacker.finalReady = true;
      state.events.push({ type: 'orbBreak', x: it.x, y: it.y, slot: attacker.slot });
    }
  }
  if (hit) state.items = state.items.filter((it) => it.life > 0);
  return hit;
}
