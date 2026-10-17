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
