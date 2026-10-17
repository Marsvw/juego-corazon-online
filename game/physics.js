// Movement, gravity and platform collision for fighters.

// How fast launch speed bleeds off each frame once a fighter is flying faster
// than they could move on their own.
export const KB_DECAY = 0.3;
// How far past a platform edge a fighter's centre can go and still stand on it.
const FOOT_MARGIN = 4;
// Ledge assist: a recovering fighter this close to a stage corner gets pulled up.
const LEDGE_SNAP_X = 38;
const LEDGE_SNAP_Y = 60;

export function hurtbox(f) {
  const { width, height } = f.stats;
  return { x: f.x - width / 2, y: f.y - height, w: width, h: height };
}

export function speedMult(f) {
  return (f.status.slow > 0 ? 0.55 : 1) * (f.status.boost > 0 ? 1.45 : 1);
}

function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  if (value > target) return Math.max(target, value - step);
  return value;
}

export function groundControl(f, dir, mult = 1) {
  const s = f.stats;
  if (dir) {
    f.vx = approach(f.vx, dir * s.walk * mult, s.groundAccel * mult);
  } else {
    f.vx = approach(f.vx, 0, s.friction);
  }
}

export function groundFriction(f, amount = f.stats.friction) {
  f.vx = approach(f.vx, 0, amount);
}

export function airControl(f, dir, mult = 1) {
  const s = f.stats;
  const max = s.airSpeed * mult;
  if (Math.abs(f.vx) > max) {
    // Still flying from a hit or a dash: bleed speed off instead of steering.
    f.vx = approach(f.vx, Math.sign(f.vx) * max, KB_DECAY);
    if (dir && Math.sign(dir) !== Math.sign(f.vx)) f.vx += dir * s.airAccel * mult * 0.5;
    return;
  }
  if (dir) f.vx = approach(f.vx, dir * max, s.airAccel * mult);
  else f.vx = approach(f.vx, 0, s.airFriction);
}

export function applyGravity(f, mult = 1, capFall = true) {
  if (f.grounded) return;
  const s = f.stats;
  f.vy += s.gravity * mult;
  if (capFall) {
    const cap = f.fastFall ? s.fastFall : s.fallSpeed;
    if (f.vy > cap) f.vy = Math.max(cap, f.vy - s.gravity * 3);
  }
}

export function platformById(state, id) {
  return state.platforms.find((p) => p.id === id) || null;
}

// Moves a fighter by its velocity and resolves platform collisions.
// Returns what happened so the engine can change states.
export function integrate(state, f) {
  const s = f.stats;
  const halfW = s.width / 2;
  const result = { landed: false, landSpeed: 0, leftGround: false, bonked: false };

  if (f.grounded) {
    const p = platformById(state, f.platformId);
    if (p) {
      f.x += p.x - p.prevX;
      f.y = p.y;
    }
  }

  const prevX = f.x;
  const prevY = f.y;
  f.x += f.vx;
  f.y += f.grounded ? 0 : f.vy;

  if (f.grounded) {
    const p = platformById(state, f.platformId);
    if (!p || f.x < p.x - FOOT_MARGIN || f.x > p.x + p.w + FOOT_MARGIN) {
      f.grounded = false;
      f.platformId = null;
      result.leftGround = true;
    } else {
      f.y = p.y;
      f.vy = 0;
    }
  } else if (f.vy >= 0) {
    for (const p of state.platforms) {
      if (!p.solid && f.dropThrough > 0) continue;
      const wasAbove = prevY - p.prevY <= 1;
      const within = f.x >= p.x - FOOT_MARGIN && f.x <= p.x + p.w + FOOT_MARGIN;
      if (wasAbove && within && f.y >= p.y) {
        result.landed = true;
        result.landSpeed = f.vy;
        f.y = p.y;
        f.vy = 0;
        f.grounded = true;
        f.platformId = p.id;
        break;
      }
    }
  }

  // Solid platforms block from the sides and from below.
  for (const p of state.platforms) {
    if (!p.solid) continue;
    const top = f.y - s.height;
    const overlapsX = f.x + halfW > p.x && f.x - halfW < p.x + p.w;
    const overlapsY = f.y > p.y + 1 && top < p.y + p.h;
    if (!overlapsX || !overlapsY) continue;
    const prevTop = prevY - s.height;
    if (prevTop >= p.y + p.h - 1 && f.vy < 0) {
      f.y = p.y + p.h + s.height;
      f.vy = f.state === 'hitstun' ? -f.vy * 0.5 : 0;
    } else {
      f.x = prevX <= p.x + p.w / 2 ? p.x - halfW : p.x + p.w + halfW;
      f.vx = f.state === 'hitstun' ? -f.vx * 0.5 : 0;
      result.bonked = true;
    }
  }

  return result;
}

// Returns the stage corner a recovering fighter should be pulled onto, if any.
export function ledgeToGrab(state, f, input) {
  if (f.grounded || f.vy < -6) return null;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  for (const p of state.platforms) {
    if (!p.solid) continue;
    const below = f.y - p.y;
    if (below <= 0 || below > LEDGE_SNAP_Y) continue;
    const leftGap = p.x - f.x;
    if (leftGap > 0 && leftGap <= LEDGE_SNAP_X && (f.facing === 1 || dir === 1 || f.vx > 0)) {
      return { platform: p, x: p.x + 10 };
    }
    const rightGap = f.x - (p.x + p.w);
    if (rightGap > 0 && rightGap <= LEDGE_SNAP_X && (f.facing === -1 || dir === -1 || f.vx < 0)) {
      return { platform: p, x: p.x + p.w - 10 };
    }
  }
  return null;
}

export function outsideBlastZone(state, f) {
  const b = state.stage.blast;
  return f.x < b.left || f.x > b.right || f.y > b.bottom || f.y - f.stats.height < b.top;
}
