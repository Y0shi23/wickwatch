// A small seeded random source (mulberry32), so a seed always replays the same night.

/** A random source: next() in [0, 1), range(a, b), int(n) in [0, n), pick(list), sign(). */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (low, high) => low + (high - low) * next(),
    int: (count) => Math.floor(next() * count),
    pick: (list) => list[Math.floor(next() * list.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    /** The seed this source started from, for staging a copy of it. */
    seed: seed >>> 0,
  };
}
