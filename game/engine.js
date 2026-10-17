// Match simulation. createMatch builds the state and step advances it by one
// 60 fps frame. Nothing here touches the DOM, so matches run headless in tests.
import { FIGHTERS } from './fighters.js';
import { STAGES, buildPlatforms, mainPlatform, stageAffect, updateStage } from './stages.js';
import { ITEM_THROW, hitOrbs, updateItems } from './items.js';
import {
  airControl,
  applyGravity,
  groundControl,
  groundFriction,
  integrate,
  ledgeToGrab,
  outsideBlastZone,
  platformById,
  speedMult,
} from './physics.js';
import { SHIELD_MAX, applyHit, canBeHit, hitboxWorld, launch, overlap } from './combat.js';
import { hurtbox } from './physics.js';

export const EMPTY_INPUT = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  attack: false,
  special: false,
  shield: false,
});

const BUFFER_FRAMES = 6;
const RESPAWN_DELAY = 70;
const RESPAWN_WAIT = 180;
const RESPAWN_INVULN = 100;
const KO_CREDIT_FRAMES = 600;
const END_DELAY = 90;

export function createMatch({ stageId = 'sahur', stocks = 3, players, seed = 1, countdown = 0, items = false, bigHead = false, lowGravity = false }) {
  const stage = STAGES[stageId];
  const state = {
    frame: 0,
    stage,
    platforms: buildPlatforms(stage),
    fighters: [],
    projectiles: [],
    items: [],
    itemsOn: items,
    // Party rules. Big heads is only drawn differently; low gravity changes physics.
    bigHead,
    lowGravity,
    itemTimer: 300,
    water: null,
    events: [],
    rngState: seed | 0,
    nextId: 1,
    stocks,
    // Fighters ignore input until the 3-2-1-GO countdown finishes.
    startTimer: countdown,
    endTimer: 0,
    over: false,
    winner: null,
    eliminated: [],
  };
  players.forEach((p, i) => state.fighters.push(createFighter(state, p, i)));
  return state;
}

function createFighter(state, player, slot) {
  const char = FIGHTERS[player.charId];
  const spawn = state.stage.spawns[slot % state.stage.spawns.length];
  const under = state.platforms.find((p) => spawn.x >= p.x && spawn.x <= p.x + p.w && Math.abs(p.y - spawn.y) < 1);
  const stats = state.lowGravity
    ? { ...char.stats, gravity: char.stats.gravity * 0.55, fallSpeed: char.stats.fallSpeed * 0.7, fastFall: char.stats.fastFall * 0.75 }
    : char.stats;
  return {
    slot,
    // Which player colour this fighter wears (their seat on the select screen).
    port: player.port ?? slot,
    charId: char.id,
    char,
    stats,
    name: player.name || `P${slot + 1}`,
    type: player.type || 'human',
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: spawn.x < 640 ? 1 : -1,
    grounded: !!under,
    platformId: under ? under.id : null,
    jumpsLeft: stats.jumps,
    jumpHeld: false,
    fastFall: false,
    dropThrough: 0,
    airDodgeUsed: false,
    airSpecials: {},
    damage: 0,
    stocks: state.stocks,
    state: 'idle',
    stateFrame: 0,
    timer: 0,
    move: null,
    hitstun: 0,
    hitlag: 0,
    invuln: 0,
    shieldHP: SHIELD_MAX,
    shieldStun: 0,
    grabbedBy: null,
    grabTimer: 0,
    grabThrow: null,
    status: { slow: 0, frozen: 0, boost: 0 },
    held: null,
    finalReady: false,
    cooldowns: {},
    inWater: false,
    prevInput: EMPTY_INPUT,
    buffer: { attack: -99, special: -99, jump: -99, shield: -99 },
    lastHitBy: null,
    lastHitFrame: -9999,
    respawnTimer: 0,
    score: { kos: 0, falls: 0, damageDealt: 0, damageTaken: 0 },
  };
}

export function step(state, inputs = []) {
  state.frame++;
  state.events = [];
  if (state.over) return state;

  const live = state.frame > state.startTimer;
  updateStage(state);
  for (const f of state.fighters) updateFighter(state, f, (live && inputs[f.slot]) || EMPTY_INPUT);
  updateProjectiles(state);
  updateItems(state);
  resolveMoveHits(state);
  for (const f of state.fighters) checkKO(state, f);
  checkMatchEnd(state);
  return state;
}

// ---------------------------------------------------------------------------
// Fighters

function setState(f, s) {
  if (f.state !== s) {
    f.state = s;
    f.stateFrame = 0;
  }
}

function horizontal(input) {
  return (input.right ? 1 : 0) - (input.left ? 1 : 0);
}

function buffered(state, f, key) {
  if (state.frame - f.buffer[key] <= BUFFER_FRAMES) {
    f.buffer[key] = -99;
    return true;
  }
  return false;
}

function updateFighter(state, f, input) {
  const prev = f.prevInput;
  f.prevInput = input;
  if (f.state === 'out') return;

  // Remember presses for a few frames so inputs during hitlag or recovery
  // frames still come out.
  if (input.attack && !prev.attack) f.buffer.attack = state.frame;
  if (input.special && !prev.special) f.buffer.special = state.frame;
  if ((input.jump && !prev.jump) || (input.up && !prev.up)) f.buffer.jump = state.frame;
  if (input.shield && !prev.shield) f.buffer.shield = state.frame;
  const pressedDown = input.down && !prev.down;
  const pressedSide = (input.left && !prev.left) || (input.right && !prev.right);

  if (f.state === 'dead') {
    if (--f.respawnTimer <= 0) respawn(state, f);
    return;
  }
  if (f.hitlag > 0) {
    f.hitlag--;
    return;
  }
  if (f.status.frozen > 0) {
    f.status.frozen--;
    return;
  }

  f.stateFrame++;
  if (f.invuln > 0) f.invuln--;
  if (f.dropThrough > 0) f.dropThrough--;
  if (f.status.slow > 0) f.status.slow--;
  if (f.status.boost > 0) f.status.boost--;
  if (f.state !== 'shield') f.shieldHP = Math.min(SHIELD_MAX, f.shieldHP + 0.15);

  const mult = speedMult(f);
  const dir = horizontal(input);
  let gravity = 1;
  let capFall = true;

  switch (f.state) {
    case 'respawn': {
      const anyInput = dir || input.down || input.jump || input.attack || input.special;
      if ((f.stateFrame > 20 && anyInput) || f.stateFrame > RESPAWN_WAIT) {
        setState(f, 'air');
        f.invuln = RESPAWN_INVULN;
      }
      return;
    }

    case 'grabbed': {
      const holder = state.fighters[f.grabbedBy];
      if (!holder || holder.state === 'hitstun' || holder.state === 'dead' || holder.state === 'out') {
        f.grabbedBy = null;
        setState(f, 'air');
        f.vy = -6;
        break;
      }
      f.x = holder.x + holder.facing * (holder.stats.width / 2 + f.stats.width / 2 - 8);
      f.y = holder.y - 12;
      f.grounded = false;
      f.platformId = null;
      if (--f.grabTimer <= 0) {
        f.grabbedBy = null;
        const t = f.grabThrow;
        f.damage = Math.min(999, f.damage + t.damage);
        holder.score.damageDealt += t.damage;
        f.lastHitBy = holder.slot;
        f.lastHitFrame = state.frame;
        launch(f, t, holder.facing);
        state.events.push({ type: 'hit', x: f.x, y: f.y - 40, kb: 10, damage: t.damage, slot: f.slot, by: holder.slot });
      }
      return;
    }

    case 'hitstun':
      if (--f.hitstun <= 0) setState(f, f.grounded ? 'idle' : 'air');
      if (f.grounded) groundFriction(f, 0.5);
      else airControl(f, 0);
      capFall = false;
      break;

    case 'stun':
      if (f.grounded) groundFriction(f);
      if (f.stateFrame > 120) setState(f, f.grounded ? 'idle' : 'air');
      break;

    case 'landing':
      groundFriction(f);
      if (--f.timer <= 0) setState(f, 'idle');
      break;

    case 'shield':
      groundFriction(f, 0.6);
      if (f.shieldStun > 0) {
        f.shieldStun--;
        break;
      }
      f.shieldHP -= 0.25;
      if (buffered(state, f, 'jump')) {
        jump(state, f, input);
      } else if (pressedSide && dir) {
        setState(f, 'roll');
        f.timer = dir;
      } else if (!input.shield) {
        setState(f, 'idle');
      } else if (f.shieldHP <= 0) {
        f.shieldHP = 40;
        setState(f, 'stun');
      }
      break;

    case 'roll':
      if (f.stateFrame >= 4 && f.stateFrame <= 18) f.vx = f.timer * 7;
      else groundFriction(f);
      if (f.stateFrame >= 26) setState(f, 'idle');
      break;

    case 'airdodge':
      gravity = 0.4;
      f.vx *= 0.92;
      if (f.stateFrame >= 30) setState(f, 'air');
      break;

    case 'helpless':
      airControl(f, dir, mult * 0.6);
      break;

    case 'move':
      updateMove(state, f, input, dir, mult, pressedDown);
      if (f.state === 'move') {
        gravity = f.move.def.gravity ?? 1;
        capFall = !f.move.overrideVy;
      }
      break;

    default:
      updateNeutral(state, f, input, dir, mult, pressedDown);
  }

  // Let go of jump early for a short hop.
  if (f.jumpHeld && !input.jump && !input.up) {
    if (f.vy < -4) f.vy *= 0.55;
    f.jumpHeld = false;
  }

  applyGravity(f, gravity, capFall);
  const res = integrate(state, f);

  if (res.leftGround) {
    f.jumpsLeft = Math.min(f.jumpsLeft, f.stats.jumps - 1);
    if (f.state === 'idle' || f.state === 'run' || f.state === 'landing' || f.state === 'shield' || f.state === 'roll') {
      setState(f, 'air');
    }
  }
  if (res.landed) onLand(state, f, res.landSpeed);

  if (!f.grounded && f.state !== 'hitstun' && f.state !== 'stun') {
    const ledge = ledgeToGrab(state, f, input);
    if (ledge) {
      f.x = ledge.x;
      f.y = ledge.platform.y;
      f.vx = 0;
      f.vy = 0;
      f.grounded = true;
      f.platformId = ledge.platform.id;
      f.move = null;
      resetAirOptions(f);
      f.invuln = Math.max(f.invuln, 12);
      setState(f, 'landing');
      f.timer = 10;
      state.events.push({ type: 'ledge', x: f.x, y: f.y, slot: f.slot });
    }
  }

  stageAffect(state, f, res);
}

function updateNeutral(state, f, input, dir, mult, pressedDown) {
  if (f.held && buffered(state, f, 'attack')) {
    if (dir) f.facing = dir;
    f.held = null;
    startMove(f, 'itemThrow', ITEM_THROW);
    return;
  }
  if (buffered(state, f, 'attack')) {
    startMove(f, chooseNormal(f, input, dir));
    return;
  }
  if (f.finalReady && f.char.final && buffered(state, f, 'special')) {
    if (dir) f.facing = dir;
    f.finalReady = false;
    startMove(f, 'final', f.char.final);
    state.events.push({ type: 'final', slot: f.slot, name: f.char.final.name, x: f.x, y: f.y - f.stats.height / 2 });
    return;
  }
  if (state.frame - f.buffer.special <= BUFFER_FRAMES) {
    const id = chooseSpecial(f, input, dir);
    if (canStartSpecial(f, id)) {
      f.buffer.special = -99;
      if (dir) f.facing = dir;
      startMove(f, id);
      return;
    }
  }

  if (f.grounded) {
    if (input.shield) {
      setState(f, 'shield');
      return;
    }
    if (buffered(state, f, 'jump')) {
      jump(state, f, input);
      return;
    }
    const p = platformById(state, f.platformId);
    if (pressedDown && p && !p.solid) {
      f.dropThrough = 14;
      f.grounded = false;
      f.platformId = null;
      f.vy = 1;
      setState(f, 'air');
      return;
    }
    groundControl(f, dir, mult);
    if (dir) f.facing = dir;
    setState(f, dir ? 'run' : 'idle');
    return;
  }

  if (state.frame - f.buffer.shield <= BUFFER_FRAMES && !f.airDodgeUsed) {
    f.buffer.shield = -99;
    f.airDodgeUsed = true;
    f.vx *= 0.5;
    f.vy *= 0.3;
    f.fastFall = false;
    setState(f, 'airdodge');
    return;
  }
  if (f.jumpsLeft > 0 && buffered(state, f, 'jump')) {
    f.jumpsLeft--;
    f.vy = -f.stats.airJumpVel;
    f.fastFall = false;
    if (dir) f.vx = dir * f.stats.airSpeed * mult;
    state.events.push({ type: 'jump', x: f.x, y: f.y, slot: f.slot, air: true });
  }
  if (pressedDown && f.vy > -3) f.fastFall = true;
  setState(f, 'air');
  airControl(f, dir, mult);
}

function jump(state, f, input) {
  f.vy = -f.stats.jumpVel;
  f.grounded = false;
  f.platformId = null;
  f.jumpsLeft = f.stats.jumps - 1;
  f.jumpHeld = !!(input.jump || input.up);
  f.fastFall = false;
  setState(f, 'air');
  state.events.push({ type: 'jump', x: f.x, y: f.y, slot: f.slot, air: false });
}

function chooseNormal(f, input, dir) {
  if (f.grounded) {
    if (input.up) return 'upTilt';
    if (input.down) return 'downTilt';
    if (dir) {
      f.facing = dir;
      return 'sideTilt';
    }
    return 'jab';
  }
  if (input.up) return 'upAir';
  if (input.down) return 'downAir';
  if (dir) {
    f.facing = dir;
    return 'fair';
  }
  return 'nair';
}

function chooseSpecial(f, input, dir) {
  let id = input.up ? 'upSpecial' : input.down ? 'downSpecial' : dir ? 'sideSpecial' : 'neutralSpecial';
  if (!f.grounded && f.char.moves[id + 'Air']) id += 'Air';
  return id;
}

function canStartSpecial(f, id) {
  const def = f.char.moves[id];
  if (!def) return false;
  return f.grounded || !def.airOnce || !f.airSpecials[id];
}

function startMove(f, id, def = f.char.moves[id]) {
  if (!def) return;
  if (def.airOnce && !f.grounded) f.airSpecials[id] = true;
  f.move = { id, def, frame: 0, hitIds: {}, airborne: !f.grounded, overrideVy: false };
  f.state = 'move';
  f.stateFrame = 0;
}

function updateMove(state, f, input, dir, mult, pressedDown) {
  const m = f.move;
  const def = m.def;
  m.frame++;
  m.overrideVy = false;

  let overrideVx = false;
  for (const mo of def.motion || []) {
    if (m.frame < mo.from || m.frame > mo.to) continue;
    if (mo.vx !== undefined) {
      f.vx = mo.vx * f.facing * mult;
      overrideVx = true;
    }
    if (mo.vy !== undefined) {
      f.vy = mo.vy;
      m.overrideVy = true;
      if (mo.vy < 0 && f.grounded) {
        f.grounded = false;
        f.platformId = null;
      }
    }
  }

  if (def.teleport && def.teleport.frame === m.frame) {
    f.x += def.teleport.dx * f.facing;
    if (f.grounded) {
      const p = platformById(state, f.platformId);
      if (p) f.x = Math.max(p.x + 6, Math.min(p.x + p.w - 6, f.x));
    }
    state.events.push({ type: 'teleport', x: f.x, y: f.y, slot: f.slot });
  }

  for (const sp of def.spawn || []) {
    if (sp.frame === m.frame) spawnProjectile(state, f, sp);
  }

  if (!overrideVx) {
    if (f.grounded) groundFriction(f);
    else airControl(f, dir, mult * (def.steer ?? 0.5));
  }
  if (!f.grounded) {
    m.airborne = true;
    if (pressedDown && f.vy > -3 && def.steer === 1) f.fastFall = true;
  }

  if (m.frame >= def.total) endMove(f);
}

function endMove(f) {
  const def = f.move.def;
  f.move = null;
  if (f.grounded) setState(f, 'idle');
  else setState(f, def.helpless ? 'helpless' : 'air');
}

function resetAirOptions(f) {
  f.jumpsLeft = f.stats.jumps;
  f.airSpecials = {};
  f.airDodgeUsed = false;
  f.fastFall = false;
  f.jumpHeld = false;
}

function onLand(state, f, landSpeed) {
  resetAirOptions(f);
  switch (f.state) {
    case 'hitstun':
      if (landSpeed > 9 && f.hitstun > 0) {
        // Bounce off the floor after a hard spike.
        f.vy = -landSpeed * 0.5;
        f.grounded = false;
        f.platformId = null;
        return;
      }
      setState(f, 'landing');
      f.timer = 8;
      break;
    case 'move': {
      const def = f.move.def;
      if (!f.move.airborne) return;
      if (def.onLand) {
        for (const sp of def.onLand.spawn || []) spawnProjectile(state, f, sp);
        state.events.push({ type: 'land', x: f.x, y: f.y, slot: f.slot, heavy: true });
        f.move = null;
        setState(f, 'landing');
        f.timer = def.onLand.landingLag ?? 10;
        return;
      }
      f.move = null;
      setState(f, 'landing');
      f.timer = def.landingLag ?? 4;
      break;
    }
    case 'helpless':
      setState(f, 'landing');
      f.timer = 10;
      break;
    case 'airdodge':
      setState(f, 'landing');
      f.timer = 6;
      break;
    case 'stun':
      break;
    default:
      setState(f, 'landing');
      f.timer = 2;
  }
  state.events.push({ type: 'land', x: f.x, y: f.y, slot: f.slot });
}

function respawn(state, f) {
  const r = state.stage.respawn;
  f.x = r.x + (f.slot - (state.fighters.length - 1) / 2) * 60;
  f.y = r.y;
  f.vx = 0;
  f.vy = 0;
  f.damage = 0;
  f.grounded = false;
  f.platformId = null;
  f.move = null;
  f.status = { slow: 0, frozen: 0, boost: 0 };
  f.shieldHP = SHIELD_MAX;
  f.lastHitBy = null;
  resetAirOptions(f);
  setState(f, 'respawn');
}

function checkKO(state, f) {
  if (f.state === 'dead' || f.state === 'out' || f.state === 'respawn') return;
  if (!outsideBlastZone(state, f)) return;

  const b = state.stage.blast;
  state.events.push({
    type: 'ko',
    x: Math.max(b.left, Math.min(b.right, f.x)),
    y: Math.max(b.top, Math.min(b.bottom, f.y)),
    slot: f.slot,
  });
  f.stocks--;
  f.score.falls++;
  const killer = state.fighters[f.lastHitBy];
  if (killer && killer !== f && state.frame - f.lastHitFrame <= KO_CREDIT_FRAMES) killer.score.kos++;

  // Anyone this fighter was holding gets dropped.
  for (const o of state.fighters) {
    if (o.state === 'grabbed' && o.grabbedBy === f.slot) {
      o.grabbedBy = null;
      setState(o, 'air');
    }
  }

  f.move = null;
  f.vx = f.vy = 0;
  f.hitlag = 0;
  f.held = null;
  f.finalReady = false;
  if (f.stocks > 0) {
    setState(f, 'dead');
    f.respawnTimer = RESPAWN_DELAY;
  } else {
    setState(f, 'out');
    state.eliminated.push(f.slot);
  }
}

function checkMatchEnd(state) {
  if (state.fighters.length < 2) return;
  if (state.endTimer > 0) {
    if (--state.endTimer === 0) state.over = true;
    return;
  }
  const alive = state.fighters.filter((f) => f.state !== 'out');
  if (alive.length <= 1) {
    state.winner = alive.length ? alive[0].slot : null;
    state.endTimer = END_DELAY;
    state.events.push({ type: 'game', winner: state.winner });
  }
}

// Final standings, winner first.
export function placements(state) {
  const order = [...state.eliminated].reverse();
  const alive = state.fighters.filter((f) => f.state !== 'out').map((f) => f.slot);
  return [...alive, ...order];
}

// ---------------------------------------------------------------------------
// Attacks and projectiles

function resolveMoveHits(state) {
  for (const a of state.fighters) {
    if (a.state !== 'move' || a.hitlag > 0) continue;
    const m = a.move;
    const hits = m.def.hits || [];
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (m.frame < h.start || m.frame > h.end) continue;
      const box = hitboxWorld(a, h.box);
      if (state.items.length) hitOrbs(state, box, a);
      for (const t of state.fighters) {
        if (t === a || !canBeHit(t) || t.state === 'grabbed') continue;
        const key = `${h.group ?? i}:${t.slot}`;
        const last = m.hitIds[key];
        if (last !== undefined && (!h.rehit || m.frame - last < h.rehit)) continue;
        if (!overlap(box, hurtbox(t))) continue;
        m.hitIds[key] = m.frame;
        const dir = h.angleMode === 'away' ? Math.sign(t.x - a.x) || a.facing : a.facing;
        applyHit(state, h, t, { attacker: a, dir, x: box.x + box.w / 2, y: box.y + box.h / 2 });
        if (a.state !== 'move') break;
      }
      if (a.state !== 'move') break;
    }
  }
}

export function spawnProjectile(state, f, sp) {
  if (sp.max) {
    const mine = state.projectiles.filter((p) => p.owner === f.slot && p.kind === sp.kind);
    while (mine.length >= sp.max) {
      const old = mine.shift();
      state.projectiles.splice(state.projectiles.indexOf(old), 1);
    }
  }
  // Projectiles anchored to the stage (used by Finals) are placed relative to
  // the middle of the main platform instead of the fighter.
  const main = sp.anchor === 'stage' ? mainPlatform(state) : null;
  const p = {
    id: state.nextId++,
    owner: f.slot,
    kind: sp.kind,
    x: main ? main.x + main.w / 2 + f.facing * (sp.x || 0) : f.x + f.facing * (sp.x || 0),
    y: main ? main.y + (sp.y || 0) : f.y + (sp.y || 0),
    vx: (sp.vx || 0) * f.facing,
    vy: sp.vy || 0,
    gravity: sp.gravity || 0,
    life: sp.life || 60,
    age: 0,
    w: sp.w || 24,
    h: sp.h || 24,
    hit: sp.hit,
    pierce: !!sp.pierce,
    onGround: sp.onGround || 'none',
    explode: sp.explode || null,
    facing: f.facing,
    platformId: null,
    hitIds: {},
  };
  if (p.onGround === 'slide' && f.grounded) p.platformId = f.platformId;
  state.projectiles.push(p);
  return p;
}

function explode(state, p) {
  if (!p.explode) return;
  const owner = state.fighters[p.owner];
  state.projectiles.push({
    ...p,
    id: state.nextId++,
    kind: p.explode.kind || 'explosion',
    vx: 0,
    vy: 0,
    gravity: 0,
    w: p.explode.size,
    h: p.explode.size,
    life: p.explode.life || 10,
    age: 0,
    hit: p.explode.hit,
    pierce: true,
    onGround: 'none',
    explode: null,
    hitIds: {},
  });
  state.events.push({ type: 'boom', x: p.x, y: p.y, slot: owner ? owner.slot : null, size: p.explode.size });
}

function updateProjectiles(state) {
  const b = state.stage.blast;
  for (const p of state.projectiles) {
    p.age++;
    p.life--;
    p.vy += p.gravity;
    const prevY = p.y;
    p.x += p.vx;
    p.y += p.vy;

    if (p.onGround === 'slide') {
      let plat = p.platformId ? platformById(state, p.platformId) : null;
      if (!plat) {
        p.vy += 0.8;
        plat = landingPlatform(state, p, prevY);
        if (plat) {
          p.platformId = plat.id;
          p.vy = 0;
        }
      }
      if (plat) {
        p.y = plat.y - p.h / 2;
        if (p.x < plat.x || p.x > plat.x + plat.w) p.life = 0;
      }
    } else if (p.onGround === 'explode' || p.onGround === 'remove' || p.onGround === 'stay') {
      const plat = landingPlatform(state, p, prevY);
      if (plat) {
        if (p.onGround === 'stay') {
          p.y = plat.y - p.h / 2;
          p.vx = 0;
          p.vy = 0;
          p.gravity = 0;
          p.platformId = plat.id;
        } else {
          if (p.onGround === 'explode') explode(state, p);
          p.life = 0;
        }
      }
    }
    if (p.onGround === 'stay' && p.platformId) {
      const plat = platformById(state, p.platformId);
      if (plat) {
        p.x += plat.x - plat.prevX;
        p.y = plat.y - p.h / 2;
      }
    }

    if (p.x < b.left || p.x > b.right || p.y > b.bottom || p.y < b.top) p.life = 0;
    if (p.life <= 0 || !p.hit) continue;

    const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
    const owner = state.fighters[p.owner];
    if (state.items.length && hitOrbs(state, box, owner) && !p.pierce) {
      explode(state, p);
      p.life = 0;
      continue;
    }
    for (const t of state.fighters) {
      if (t.slot === p.owner || !canBeHit(t) || t.state === 'grabbed') continue;
      const last = p.hitIds[t.slot];
      if (last !== undefined && (!p.hit.rehit || p.age - last < p.hit.rehit)) continue;
      if (!overlap(box, hurtbox(t))) continue;
      p.hitIds[t.slot] = p.age;
      const dir = p.hit.angleMode === 'away' ? Math.sign(t.x - p.x) || p.facing : Math.sign(p.vx) || p.facing;
      applyHit(state, p.hit, t, { attacker: owner, dir, x: p.x, y: p.y, projectile: true });
      if (!p.pierce) {
        explode(state, p);
        p.life = 0;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}

function landingPlatform(state, p, prevY) {
  if (p.vy < 0) return null;
  const bottom = p.y + p.h / 2;
  const prevBottom = prevY + p.h / 2;
  for (const plat of state.platforms) {
    if (p.x < plat.x || p.x > plat.x + plat.w) continue;
    if (prevBottom <= plat.prevY + 1 && bottom >= plat.y) return plat;
  }
  return null;
}
