// CPU opponents. Each CPU reads the match state and returns the same kind of
// input object a human produces, so the engine treats them identically.
import { EMPTY_INPUT } from './engine.js';
import { makeRng } from './rng.js';
import { mainPlatform } from './stages.js';

const LEVELS = {
  1: { reaction: 26, attack: 0.07, shield: 0.015, recover: 0.75, aerial: 0.03, special: 0.2, idle: 0.35 },
  2: { reaction: 13, attack: 0.18, shield: 0.06, recover: 0.95, aerial: 0.08, special: 0.3, idle: 0.12 },
  3: { reaction: 5, attack: 0.4, shield: 0.16, recover: 1, aerial: 0.18, special: 0.3, idle: 0 },
};

const PROJECTILE_SPECIALS = new Set(['bombardiro', 'chimpanzini', 'lirili', 'assassino', 'ballerina']);

export function createAI(level = 2, seed = 1) {
  const cfg = LEVELS[level] || LEVELS[2];
  const rand = makeRng(seed);
  const mem = { cooldown: 0, jumpHold: 0, shieldHold: 0, idle: 0, prev: EMPTY_INPUT, wander: 0 };

  // Buttons only count when newly pressed, so never hold one two frames running.
  function tap(out, key) {
    if (!mem.prev[key]) out[key] = true;
  }

  function think(state, slot) {
    const me = state.fighters[slot];
    const out = { ...EMPTY_INPUT };
    const finish = () => {
      mem.prev = out;
      return out;
    };
    if (me.state === 'dead' || me.state === 'out' || state.frame <= state.startTimer) return finish();

    if (me.state === 'respawn') {
      if (me.stateFrame > 30 + rand() * 40) out.down = true;
      return finish();
    }

    const main = mainPlatform(state);
    const left = main.x;
    const right = main.x + main.w;
    const center = (left + right) / 2;
    const toCenter = Math.sign(center - me.x) || 1;

    if (mem.jumpHold > 0) {
      mem.jumpHold--;
      out.jump = true;
    }

    // Off the stage: get back.
    const offstage = !me.grounded && (me.x < left - 4 || me.x > right + 4 || me.y > main.y + 4);
    if (offstage) {
      recover(state, me, main, toCenter, out);
      return finish();
    }

    if (['hitstun', 'stun', 'grabbed', 'landing', 'roll', 'airdodge'].includes(me.state)) {
      if (!me.grounded) out[toCenter > 0 ? 'right' : 'left'] = true;
      return finish();
    }
    if (me.state === 'helpless') {
      out[toCenter > 0 ? 'right' : 'left'] = true;
      return finish();
    }

    const target = pickTarget(state, me);
    if (!target) return finish();

    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const adx = Math.abs(dx);
    const toward = Math.sign(dx) || me.facing;
    const reach = 40 + me.stats.width / 2 + target.stats.width / 2;

    // Block attacks that are about to land.
    if (mem.shieldHold > 0) {
      mem.shieldHold--;
      if (me.grounded) {
        out.shield = true;
        return finish();
      }
    }
    if (me.grounded && threatened(state, me) && rand() < cfg.shield) {
      mem.shieldHold = 8 + Math.floor(rand() * 14);
      out.shield = true;
      return finish();
    }

    if (mem.cooldown > 0) mem.cooldown--;
    if (mem.idle > 0) {
      mem.idle--;
      return finish();
    }
    if (rand() < cfg.idle * 0.02) mem.idle = 10 + Math.floor(rand() * 30);

    const targetOffstage = target.x < left - 10 || target.x > right + 10 || target.y > main.y + 20;
    const nearEdge = me.x < left + 40 || me.x > right - 40;

    if (me.state === 'move') return finish();

    // In range: attack.
    if (mem.cooldown === 0 && adx < reach + 10 && Math.abs(dy) < 70 && rand() < cfg.attack) {
      attack(me, target, dx, dy, toward, out, nearEdge, center, main);
      mem.cooldown = cfg.reaction + Math.floor(rand() * cfg.reaction);
      return finish();
    }

    // Air: swing at a nearby target.
    if (!me.grounded && mem.cooldown === 0 && adx < reach + 30 && Math.abs(dy + 30) < 90 && rand() < cfg.aerial * 3) {
      if (dy < -40) out.up = true;
      else if (dy > 40) out.down = true;
      else out[toward > 0 ? 'right' : 'left'] = true;
      tap(out, 'attack');
      mem.cooldown = cfg.reaction;
      return finish();
    }

    // Zone with projectiles from far away.
    if (me.grounded && mem.cooldown === 0 && adx > 260 && PROJECTILE_SPECIALS.has(me.charId) && rand() < cfg.special * 0.08) {
      if (me.facing !== toward) out[toward > 0 ? 'right' : 'left'] = true;
      else if (me.charId === 'ballerina') out[toward > 0 ? 'right' : 'left'] = true;
      tap(out, 'special');
      mem.cooldown = cfg.reaction * 2;
      return finish();
    }

    // Move toward the target, but don't chase them off the stage.
    const stopAtEdge = targetOffstage && nearEdge && Math.sign(dx) === Math.sign(me.x - center);
    if (adx > reach - 10 && !stopAtEdge) out[toward > 0 ? 'right' : 'left'] = true;

    // Follow them up onto platforms, or drop down to them.
    if (me.grounded && dy < -70 && adx < 220 && target.grounded && !mem.jumpHold && rand() < 0.08) {
      tap(out, 'jump');
      mem.jumpHold = 10;
    } else if (me.grounded && dy > 60 && me.platformId !== main.id && rand() < 0.05 && !mem.prev.down) {
      out.down = true;
    } else if (me.grounded && rand() < cfg.aerial * 0.15 && !targetOffstage) {
      tap(out, 'jump');
      mem.jumpHold = 6;
    }
    return finish();
  }

  function pickTarget(state, me) {
    let best = null;
    let bestD = Infinity;
    for (const f of state.fighters) {
      if (f === me || f.state === 'dead' || f.state === 'out') continue;
      const d = Math.hypot(f.x - me.x, (f.y - me.y) * 1.5) + (f.state === 'respawn' ? 400 : 0);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  function threatened(state, me) {
    for (const f of state.fighters) {
      if (f === me || f.state !== 'move' || !f.move.def.hits) continue;
      const near = Math.abs(f.x - me.x) < 120 && Math.abs(f.y - me.y) < 90;
      const facing = Math.sign(me.x - f.x) === f.facing;
      if (near && facing && f.move.frame < (f.move.def.hits[0]?.start ?? 0)) return true;
    }
    for (const p of state.projectiles) {
      if (p.owner === me.slot) continue;
      const coming = Math.sign(me.x - p.x) === Math.sign(p.vx) || p.vx === 0;
      if (coming && Math.abs(p.x - me.x) < 110 && Math.abs(p.y - (me.y - 40)) < 80) return true;
    }
    return false;
  }

  function attack(me, target, dx, dy, toward, out, nearEdge, center, main) {
    const dirKey = toward > 0 ? 'right' : 'left';
    const strongTime = target.damage > 80 && rand() < 0.5;
    if (me.grounded) {
      if (dy < -50) {
        out.up = true;
        tap(out, rand() < cfg.special * 0.3 ? 'special' : 'attack');
        return;
      }
      if (strongTime || rand() < cfg.special) {
        const r = rand();
        const safeDown = Math.abs(me.x - center) < main.w / 2 - 120;
        if (r < 0.45) {
          if (me.facing !== toward) out[dirKey] = true;
        } else if (r < 0.8 || !safeDown) {
          out[dirKey] = true;
        } else {
          out.down = true;
        }
        tap(out, 'special');
        return;
      }
      const r = rand();
      if (r < 0.3 && me.facing === toward) tap(out, 'attack');
      else if (r < 0.8) {
        out[dirKey] = true;
        tap(out, 'attack');
      } else {
        out.down = true;
        tap(out, 'attack');
      }
      return;
    }
    if (dy < -40) out.up = true;
    else if (dy > 40) out.down = true;
    else out[dirKey] = true;
    tap(out, 'attack');
  }

  function recover(state, me, main, toCenter, out) {
    out[toCenter > 0 ? 'right' : 'left'] = true;
    if (me.state === 'helpless' || me.state === 'move' || me.state === 'hitstun' || me.state === 'stun') return;
    if (rand() > cfg.recover) return;

    const below = me.y - main.y;
    const edgeX = toCenter > 0 ? main.x : main.x + main.w;
    const horiz = Math.abs(me.x - edgeX);

    // Side special covers distance for fighters with a dash.
    const dash = ['tralalero', 'bombardiro', 'chimpanzini', 'assassino'].includes(me.charId);
    if (dash && horiz > 170 && below > -120 && below < 80 && !me.airSpecials.sideSpecial && me.jumpsLeft === 0) {
      tap(out, 'special');
      return;
    }
    if (me.vy > -1 && me.jumpsLeft > 0 && below > -60) {
      tap(out, 'jump');
      return;
    }
    if (me.vy > -1 && me.jumpsLeft === 0 && below > -30) {
      out.up = true;
      tap(out, 'special');
    }
  }

  return { think };
}
