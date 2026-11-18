// The nights: which shades rise on each one, from which shore and when. Each night is planned up
// front from the seed, in swells (a pack from one side, then a breath), so it can be replayed exactly.
import { BOSS_NIGHTS, VIEW } from './config.js';
import { BRUTE, DARTER, GLOAM, SHADE, SPITTER } from './enemies.js';

/** A point just outside the view, on a random edge (the long edges more often). */
export function shorePoint(random, side = random.int(4)) {
  const margin = 46;
  if (side === 0) return { x: random.range(0, VIEW.width), y: -margin, side };
  if (side === 1) return { x: VIEW.width + margin, y: random.range(0, VIEW.height), side };
  if (side === 2) return { x: random.range(0, VIEW.width), y: VIEW.height + margin, side };
  return { x: -margin, y: random.range(0, VIEW.height), side };
}

/** Which kinds may rise on `night`, with how often each is drawn. */
export function nightMix(night) {
  const mix = [{ kind: SHADE, weight: 1 }];
  if (night >= 2) mix.push({ kind: DARTER, weight: 0.32 + night * 0.03 });
  if (night >= 3) mix.push({ kind: SPITTER, weight: 0.22 + night * 0.01 });
  if (night >= 4) mix.push({ kind: BRUTE, weight: 0.1 + night * 0.012 });
  return mix;
}

function drawKind(mix, random) {
  let total = 0;
  for (const entry of mix) total += entry.weight;
  let roll = random.next() * total;
  for (const entry of mix) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return mix[0].kind;
}

/** The plan for `night`: a queue of { at, kind, x, y } sorted by time, its size and whether a Gloam rises. */
export function planNight(night, random) {
  const boss = BOSS_NIGHTS.includes(night);
  const count = Math.round((10 + night * 6) * (boss ? 0.65 : 1));
  const mix = nightMix(night);
  const queue = [];
  const length = 20 + night * 2.6;
  let at = 1.2;
  let left = count;
  while (left > 0) {
    const pack = Math.min(left, 2 + random.int(3 + Math.floor(night / 3)));
    const side = random.int(4);
    for (let index = 0; index < pack; index += 1) {
      const point = shorePoint(random, side);
      queue.push({ at: at + index * random.range(0.15, 0.45), kind: drawKind(mix, random), x: point.x, y: point.y });
    }
    left -= pack;
    at += (length / Math.max(1, count)) * pack * random.range(0.7, 1.3);
  }
  if (boss) queue.push({ at: 3.5, kind: GLOAM, x: VIEW.width / 2, y: -80 });
  queue.sort((a, b) => a.at - b.at);
  return { queue, total: queue.length, boss };
}
