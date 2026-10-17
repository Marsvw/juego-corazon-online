// Small seeded RNG (mulberry32). The seed lives in match state so a match
// replays the same way given the same inputs.
export function nextRandom(state) {
  let a = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function makeRng(seed) {
  const s = { rngState: seed | 0 };
  return () => nextRandom(s);
}
