// Omens: from the second night on, every ordinary night comes with a twist foretold at the dawn-break
// before it, a risk paid back in points, embers or light, so no two watches play quite alike.
import { BOSS_NIGHTS } from './config.js';

/**
 * Every omen. Its knobs default to no change: `count` scales how many shades rise, `speed` how fast
 * they swim, `score` what they are worth, `regen` how fast the lantern mends, `glow` how far its light
 * reaches, `embers` what each ember gives, `drain` light lost a second, `feed` light gained a banishing,
 * `frail` makes moths a hit weaker, `spitters` draws more Inkwisps and `globScore` pays for popped ink.
 */
export const OMENS = [
  { id: 'calm', name: 'Calm Water', text: 'Fewer shades rise, and the lantern mends three times as fast.', reward: 'a gentle night to recover', risk: 0, hue: 190, count: 0.8, regen: 3 },
  { id: 'swarm', name: 'Swarm Tide', text: 'Half again as many shades, but every Murkmoth is frailer.', reward: 'dawn bonus ×1.5', risk: 2, dawn: 1.5, hue: 280, count: 1.5, frail: true },
  { id: 'fast', name: 'Fast Water', text: 'Shades swim a quarter faster and are worth half again as much.', reward: 'shades worth ×1.5', risk: 2, hue: 45, speed: 1.25, score: 1.5 },
  { id: 'fog', name: 'Fogbank', text: 'The lantern\'s glow reaches a quarter less. Embers count double.', reward: 'embers ×2', risk: 1, hue: 210, glow: 0.75, embers: 2 },
  { id: 'ink', name: 'Ink Rain', text: 'Inkwisps gather in numbers. Every glob you pop scores 15.', reward: '+15 a popped glob', risk: 1, hue: 150, spitters: 2.5, globScore: 15 },
  { id: 'hunger', name: 'Hungry Dark', text: 'The lantern dims all night; each banished shade feeds it 1.', reward: 'dawn bonus ×2', risk: 3, dawn: 2, hue: 10, drain: 0.7, feed: 1 },
];

const NEUTRAL = { id: 'none', name: '', text: '', reward: '', risk: 0, dawn: 1, hue: 40, count: 1, speed: 1, score: 1, regen: 1, glow: 1, embers: 1, drain: 0, feed: 0, frail: false, spitters: 1, globScore: 0 };

/** The omen as the rules read it: every knob filled in (none at all is the neutral omen). */
export function omenEffects(omen) {
  return { ...NEUTRAL, ...(omen ?? {}) };
}

/** The omen foretold for `night`: none on the first night or on a Gloam's night. */
export function drawOmen(night, random) {
  if (night <= 1 || BOSS_NIGHTS.includes(night)) return null;
  return OMENS[random.int(OMENS.length)];
}

/** The two tides offered for `night`, the player's to choose between (none before a Gloam's night). */
export function drawOmenChoices(night, random) {
  if (night <= 1 || BOSS_NIGHTS.includes(night)) return [];
  const first = random.int(OMENS.length);
  const second = (first + 1 + random.int(OMENS.length - 1)) % OMENS.length;
  return [OMENS[first], OMENS[second]];
}
