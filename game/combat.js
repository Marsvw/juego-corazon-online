// Hit detection and what happens when a hit lands: damage, launch, hitstun,
// shields, grabs, counters and status effects.
import { hurtbox } from './physics.js';

export const SHIELD_MAX = 100;

export function hitboxWorld(f, box) {
  return {
    x: f.x + f.facing * box.x - box.w / 2,
    y: f.y + box.y - box.h / 2,
    w: box.w,
    h: box.h,
  };
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function inWindow(frame, win) {
  return !!win && frame >= win[0] && frame <= win[1];
}

export function isIntangible(f) {
  if (f.invuln > 0) return true;
  if (f.state === 'roll') return f.stateFrame >= 4 && f.stateFrame <= 16;
  if (f.state === 'airdodge') return f.stateFrame >= 3 && f.stateFrame <= 20;
  if (f.state === 'move') return inWindow(f.move.frame, f.move.def.invuln);
  return false;
}

export function canBeHit(f) {
  return f.state !== 'dead' && f.state !== 'out' && f.state !== 'respawn' && !isIntangible(f);
}

export function knockback(target, hit) {
  return (hit.base + target.damage * hit.growth) * (100 / target.stats.weight);
}

// Sends the target flying. dir is +1 (right) or -1 (left).
export function launch(target, hit, dir) {
  let angle = hit.angle;
  let kb = knockback(target, hit);
  if (angle < 0 && target.grounded) {
    angle = -angle;
    kb *= 0.8;
  }
  const rad = (angle * Math.PI) / 180;
  target.move = null;
  target.fastFall = false;
  target.state = 'hitstun';
  target.stateFrame = 0;
  target.hitstun = hit.stun ?? Math.round(Math.max(8, Math.min(80, kb * 1.5)));

  if (target.grounded && kb < 6) {
    // Light hits make a grounded fighter flinch without lifting them.
    target.vx = Math.cos(rad) * kb * dir * 0.7;
    target.vy = 0;
    return kb;
  }
  target.vx = Math.cos(rad) * kb * dir;
  target.vy = -Math.sin(rad) * kb;
  if (target.grounded && target.vy < -0.5) {
    target.grounded = false;
    target.platformId = null;
  }
  return kb;
}

function hitlagFor(damage) {
  return Math.min(14, Math.floor(3 + damage * 0.4));
}

function counterWindow(f) {
  if (f.state !== 'move' || !f.move.def.counter) return null;
  const c = f.move.def.counter;
  return f.move.frame >= c.from && f.move.frame <= c.to ? c : null;
}

// Applies one hit to a target. source is { attacker, dir, x, y, projectile }.
// Returns 'hit', 'blocked' or 'countered'.
export function applyHit(state, hit, target, source) {
  const { attacker, dir } = source;

  const counter = counterWindow(target);
  if (counter) {
    if (attacker && !source.projectile && canBeHit(attacker)) {
      const back = { ...counter.hit, damage: Math.max(counter.hit.damage, Math.round(hit.damage * 1.3)) };
      const toward = Math.sign(attacker.x - target.x) || target.facing;
      target.facing = toward;
      dealDamage(state, back, attacker, target);
      launch(attacker, back, toward);
      attacker.hitlag = target.hitlag = hitlagFor(back.damage) + 4;
    }
    target.move.frame = Math.max(target.move.frame, counter.to);
    state.events.push({ type: 'counter', x: target.x, y: target.y - target.stats.height / 2, slot: target.slot });
    return 'countered';
  }

  if (target.state === 'shield') {
    target.shieldHP -= hit.damage * 1.2;
    target.shieldStun = Math.round(3 + hit.damage * 0.5);
    target.vx = dir * Math.min(7, 1.5 + hit.damage * 0.35);
    const lag = Math.max(2, hitlagFor(hit.damage) - 3);
    target.hitlag = lag;
    if (attacker && !source.projectile) attacker.hitlag = lag;
    state.events.push({ type: 'block', x: source.x ?? target.x, y: source.y ?? target.y - 40, slot: target.slot });
    if (target.shieldHP <= 0) breakShield(state, target);
    return 'blocked';
  }

  dealDamage(state, hit, target, attacker);
  const lag = hitlagFor(hit.damage);
  target.hitlag = lag;
  if (attacker && !source.projectile) attacker.hitlag = lag;

  if (hit.slow) target.status.slow = Math.max(target.status.slow, hit.slow);

  let kb = 0;
  if (hit.freeze) {
    target.status.frozen = hit.freeze;
    target.move = null;
    target.state = target.grounded ? 'idle' : 'air';
    target.vx = 0;
    target.vy = 0;
  } else if (hit.grab && attacker) {
    grab(target, attacker, hit.grab);
  } else if (target.state === 'move' && inWindow(target.move.frame, target.move.def.armor)) {
    // Super armour: takes the damage but keeps attacking.
  } else {
    kb = launch(target, hit, dir);
  }

  const hb = hurtbox(target);
  state.events.push({
    type: 'hit',
    x: source.x ?? target.x,
    y: source.y ?? hb.y + hb.h / 2,
    kb,
    damage: hit.damage,
    slot: target.slot,
    by: attacker ? attacker.slot : null,
  });
  return 'hit';
}

function dealDamage(state, hit, target, attacker) {
  target.damage = Math.min(999, target.damage + hit.damage);
  target.score.damageTaken += hit.damage;
  if (attacker && attacker !== target) {
    attacker.score.damageDealt += hit.damage;
    target.lastHitBy = attacker.slot;
    target.lastHitFrame = state.frame;
  }
  // Getting hit gives back your double jump and air specials.
  target.jumpsLeft = Math.max(target.jumpsLeft, target.stats.jumps - 1);
  target.airSpecials = {};
  target.airDodgeUsed = false;
}

function breakShield(state, f) {
  f.state = 'stun';
  f.stateFrame = 0;
  f.shieldHP = 40;
  f.vy = -9;
  f.grounded = false;
  f.platformId = null;
  state.events.push({ type: 'shieldBreak', x: f.x, y: f.y - f.stats.height, slot: f.slot });
}

function grab(target, attacker, spec) {
  target.move = null;
  target.state = 'grabbed';
  target.stateFrame = 0;
  target.grabbedBy = attacker.slot;
  target.grabTimer = spec.hold;
  target.grabThrow = spec.throw;
  target.vx = 0;
  target.vy = 0;
}
