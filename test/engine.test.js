import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step, EMPTY_INPUT } from '../game/engine.js';
import { applyHit, canBeHit, knockback } from '../game/combat.js';

const input = (o = {}) => ({ ...EMPTY_INPUT, ...o });
const strongHit = { damage: 10, angle: 40, base: 7, growth: 0.15 };

function match(a = 'tralalero', b = 'tungtung') {
  return createMatch({ players: [{ charId: a }, { charId: b }], seed: 7 });
}

function run(state, frames, inputs = []) {
  for (let i = 0; i < frames; i++) step(state, typeof inputs === 'function' ? inputs(i) : inputs);
}

test('fighters start on the stage and stay put without input', () => {
  const s = match();
  run(s, 120);
  for (const f of s.fighters) {
    assert.equal(f.grounded, true);
    assert.equal(f.y, 500);
    assert.equal(f.state, 'idle');
  }
});

test('knockback grows with damage', () => {
  const s = match();
  const t = s.fighters[1];
  t.damage = 0;
  const low = knockback(t, strongHit);
  t.damage = 120;
  const high = knockback(t, strongHit);
  assert.ok(high > low * 2, `expected ${high} to be much bigger than ${low}`);
});

test('heavier fighters fly less far from the same hit', () => {
  const s = match('tralalero', 'tungtung');
  const [light, heavy] = s.fighters;
  assert.ok(heavy.stats.weight > light.stats.weight);
  light.damage = heavy.damage = 80;
  assert.ok(knockback(heavy, strongHit) < knockback(light, strongHit));
});

test('a hit adds damage and launches the target', () => {
  const s = match();
  const [a, t] = s.fighters;
  t.damage = 50;
  const result = applyHit(s, strongHit, t, { attacker: a, dir: 1 });
  assert.equal(result, 'hit');
  assert.equal(t.damage, 60);
  assert.equal(t.state, 'hitstun');
  assert.ok(t.vx > 0 && t.vy < 0);
  assert.equal(t.lastHitBy, a.slot);
});

test('shield blocks damage', () => {
  const s = match();
  const [a, t] = s.fighters;
  run(s, 2, [EMPTY_INPUT, input({ shield: true })]);
  assert.equal(t.state, 'shield');
  const result = applyHit(s, strongHit, t, { attacker: a, dir: 1 });
  assert.equal(result, 'blocked');
  assert.equal(t.damage, 0);
  assert.ok(t.shieldHP < 100);
});

test('a side tilt in range connects', () => {
  const s = match();
  const [a, t] = s.fighters;
  a.x = 600;
  t.x = 660;
  run(s, 30, (i) => [input({ right: i === 0, attack: i === 0 })]);
  assert.ok(t.damage > 0, 'target should have taken damage');
  assert.equal(a.score.damageDealt, t.damage);
});

test('crossing a blast zone loses a stock and credits the last hitter', () => {
  const s = match();
  const [a, t] = s.fighters;
  applyHit(s, strongHit, t, { attacker: a, dir: 1 });
  t.x = s.stage.blast.right + 50;
  run(s, 1);
  assert.equal(t.stocks, 2);
  assert.equal(t.state, 'dead');
  assert.equal(a.score.kos, 1);
  assert.equal(t.score.falls, 1);
});

test('respawning fighters are invincible for a while', () => {
  const s = match();
  const t = s.fighters[1];
  t.x = s.stage.blast.left - 50;
  run(s, 1);
  assert.equal(t.state, 'dead');
  run(s, 80);
  assert.equal(t.state, 'respawn');
  assert.equal(t.damage, 0);
  assert.equal(canBeHit(t), false);
  // Leaving the respawn platform keeps invincibility for a bit longer.
  run(s, 25, [EMPTY_INPUT, input({ down: true })]);
  assert.equal(t.state, 'air');
  assert.equal(canBeHit(t), false);
  run(s, 120);
  assert.equal(canBeHit(t), true);
});

test('losing the last stock ends the match with a winner', () => {
  const s = createMatch({ players: [{ charId: 'tralalero' }, { charId: 'tungtung' }], stocks: 1 });
  const t = s.fighters[1];
  t.grounded = false;
  t.platformId = null;
  t.y = s.stage.blast.bottom + 10;
  run(s, 1);
  assert.equal(s.fighters[1].state, 'out');
  run(s, 100);
  assert.equal(s.over, true);
  assert.equal(s.winner, 0);
});

test('jumping, double jumping and landing work', () => {
  const s = match();
  const f = s.fighters[0];
  run(s, 1, [input({ jump: true })]);
  assert.equal(f.grounded, false);
  run(s, 10, [input({ jump: true })]);
  const jumpsBefore = f.jumpsLeft;
  run(s, 1, [input({ jump: false })]);
  run(s, 1, [input({ jump: true })]);
  assert.equal(f.jumpsLeft, jumpsBefore - 1);
  run(s, 120);
  assert.equal(f.grounded, true);
  assert.equal(f.jumpsLeft, f.stats.jumps);
});

test('up special recovers a fighter who fell off the side', () => {
  const s = match();
  const f = s.fighters[0];
  const main = s.platforms.find((p) => p.solid);
  f.x = main.x - 90;
  f.y = main.y + 80;
  f.grounded = false;
  f.platformId = null;
  f.state = 'air';
  f.jumpsLeft = 1;
  // Double jump, then up special toward the stage.
  run(s, 1, [input({ right: true, jump: true })]);
  run(s, 14, [input({ right: true })]);
  run(s, 1, [input({ right: true, up: true, special: true })]);
  run(s, 50, [input({ right: true })]);
  run(s, 30);
  assert.equal(f.stocks, 3);
  assert.equal(f.grounded, true);
  assert.ok(f.y <= main.y, 'should be standing on or above the stage');
});

test('every fighter has the full move set', async () => {
  const { FIGHTER_LIST } = await import('../game/fighters.js');
  const required = ['jab', 'sideTilt', 'upTilt', 'downTilt', 'nair', 'fair', 'upAir', 'downAir', 'neutralSpecial', 'sideSpecial', 'upSpecial', 'downSpecial'];
  assert.equal(FIGHTER_LIST.length, 8);
  for (const f of FIGHTER_LIST) {
    for (const id of required) assert.ok(f.moves[id], `${f.id} is missing ${id}`);
    assert.ok(f.moves.upSpecial.helpless, `${f.id} up special should leave them helpless`);
  }
});

test('a seeded CPU-vs-CPU match ends with a winner', async () => {
  const { createAI } = await import('../game/ai.js');
  const s = createMatch({ players: [{ charId: 'tralalero', type: 'cpu' }, { charId: 'tungtung', type: 'cpu' }], stocks: 2, seed: 3 });
  const ais = [createAI(3, 11), createAI(3, 29)];
  let frames = 0;
  while (!s.over && frames < 60 * 60 * 5) {
    step(s, s.fighters.map((_, i) => ais[i].think(s, i)));
    frames++;
  }
  assert.equal(s.over, true, 'match should finish within five minutes');
  assert.ok(s.winner === 0 || s.winner === 1);
  const loser = s.fighters[1 - s.winner];
  assert.equal(loser.stocks, 0);
});

test('four-fighter free-for-all runs and ends', async () => {
  const { createAI } = await import('../game/ai.js');
  const ids = ['bombardiro', 'ballerina', 'patapim', 'chimpanzini'];
  const s = createMatch({ players: ids.map((charId) => ({ charId, type: 'cpu' })), stocks: 1, seed: 5 });
  const ais = ids.map((_, i) => createAI(3, 100 + i));
  let frames = 0;
  while (!s.over && frames < 60 * 60 * 5) {
    step(s, s.fighters.map((_, i) => ais[i].think(s, i)));
    frames++;
  }
  assert.equal(s.over, true);
  assert.equal(s.eliminated.length, 3);
});

test('grabs hold the target, then throw them', () => {
  const s = match('patapim', 'tralalero');
  const [a, t] = s.fighters;
  a.x = 600;
  t.x = 650;
  a.facing = 1;
  run(s, 1, [input({ special: true })]);
  run(s, 16);
  assert.equal(t.state, 'grabbed');
  run(s, 40);
  assert.notEqual(t.state, 'grabbed');
  assert.ok(t.damage >= 13, `expected grab + throw damage, got ${t.damage}`);
});

test('time freeze stops the target in place', () => {
  const s = match('lirili', 'tralalero');
  const [a, t] = s.fighters;
  a.x = 600;
  t.x = 660;
  a.facing = 1;
  run(s, 1, [input({ down: true, special: true })]);
  run(s, 18, [input({ down: true })]);
  assert.ok(t.status.frozen > 0, 'target should be frozen');
  const x = t.x;
  run(s, 10, [EMPTY_INPUT, input({ left: true })]);
  assert.equal(t.x, x);
});

test('counter stance hits back', () => {
  const s = match('tralalero', 'assassino');
  const [a, t] = s.fighters;
  a.x = 600;
  t.x = 660;
  t.facing = -1;
  run(s, 1, [EMPTY_INPUT, input({ down: true, special: true })]);
  run(s, 6, [EMPTY_INPUT, input({ down: true })]);
  run(s, 1, [input({ right: true, attack: true })]);
  run(s, 20);
  assert.equal(t.damage, 0, 'counter user should take no damage');
  assert.ok(a.damage > 0, 'attacker should take the counter hit');
});

test('every stage loads and its gimmicks run without crashing', async () => {
  const { STAGE_LIST } = await import('../game/stages.js');
  const { createAI } = await import('../game/ai.js');
  assert.equal(STAGE_LIST.length, 5);
  for (const stage of STAGE_LIST) {
    const s = createMatch({ stageId: stage.id, players: [{ charId: 'chimpanzini' }, { charId: 'bombardiro' }], stocks: 2, seed: 9, items: true });
    const ais = [createAI(3, 1), createAI(3, 2)];
    let frames = 0;
    while (!s.over && frames < 60 * 60 * 5) {
      step(s, s.fighters.map((_, i) => ais[i].think(s, i)));
      frames++;
    }
    assert.equal(s.over, true, `${stage.id} match should finish`);
  }
});

test('pizza heals and espresso speeds you up', async () => {
  const { spawnItem } = await import('../game/items.js');
  const s = match();
  const f = s.fighters[0];
  f.damage = 60;
  for (const kind of ['pizza', 'espresso']) {
    const it = spawnItem(s, kind);
    it.x = f.x;
    it.y = f.y - 20;
    it.vy = 0;
  }
  run(s, 2);
  assert.equal(f.damage, 35);
  assert.ok(f.status.boost > 0);
  assert.equal(s.items.length, 0);
});

test('breaking the Skibidi Orb unlocks a Final that hits hard', async () => {
  const { spawnItem } = await import('../game/items.js');
  const s = match('tralalero', 'tungtung');
  const [a, t] = s.fighters;
  const orb = spawnItem(s, 'orb');
  // Hit the orb three times by parking it on the attacker's jab.
  for (let i = 0; i < 3; i++) {
    orb.baseX = a.x + 34 * a.facing;
    orb.baseY = a.y - 46;
    orb.age = 0;
    run(s, 1, [input({ attack: true })]);
    run(s, 20);
  }
  assert.equal(a.finalReady, true);
  t.damage = 50;
  run(s, 1, [input({ special: true })]);
  assert.equal(a.move.id, 'final');
  run(s, 160);
  assert.ok(t.damage >= 70 || t.stocks < 3, `Final should hurt: damage ${t.damage}, stocks ${t.stocks}`);
});

test('a held banana peel gets thrown with attack', async () => {
  const { spawnItem } = await import('../game/items.js');
  const s = match();
  const f = s.fighters[0];
  const it = spawnItem(s, 'peel');
  it.x = f.x;
  it.y = f.y - 20;
  run(s, 2);
  assert.equal(f.held, 'peel');
  run(s, 1, [input({ attack: true })]);
  run(s, 10);
  assert.equal(f.held, null);
  assert.ok(s.projectiles.some((p) => p.kind === 'peel' && p.owner === f.slot));
});
