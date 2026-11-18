// How a finished watch is judged: a grade from S to D, and the feats it earned. Read by the results
// screen; the rules never consult it.
import { NIGHTS } from './config.js';
import { boonById } from './boons.js';
import { END_DAWN } from './world.js';

/** The tides that count as braving the dark. */
const RISKY_TIDES = ['swarm', 'fast', 'hunger'];

/** The watch's grade: S for a bright dawn, A for any dawn, then B, C and D by how many nights were kept. */
export function watchGrade(state) {
  const kept = state.log.filter((entry) => entry.kept);
  if (state.over === END_DAWN) {
    const glow = kept.reduce((sum, entry) => sum + entry.light, 0) / Math.max(1, kept.length);
    return glow >= 0.8 && state.difficulty.id !== 'gentle' ? 'S' : 'A';
  }
  if (kept.length >= 7) return 'B';
  if (kept.length >= 4) return 'C';
  return 'D';
}

/** Every feat, with whether this watch earned it. */
export function watchFeats(state) {
  return [
    { name: `Kept the lantern lit all ${NIGHTS} nights`, done: state.over === END_DAWN },
    { name: 'Banished a Gloam', done: state.gloamsBanished >= 1 },
    { name: 'Banished both Gloams', done: state.gloamsBanished >= 2 },
    { name: 'A combo of 30 or more', done: state.bestCombo >= 30 },
    { name: 'Took a rare boon', done: state.boons.some((id) => boonById(id)?.rare) },
    { name: 'Kept a night of a risky tide', done: state.log.some((entry) => entry.kept && RISKY_TIDES.includes(entry.omen)) },
  ];
}
