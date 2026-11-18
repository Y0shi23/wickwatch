// The colours of each night: the sea changes with the tide, so every night of the watch looks its own,
// and the nights a Gloam rises are always under a blood moon.
import { BOSS_NIGHTS } from './config.js';

/** Each palette: the sea's gradient, its wave lines, the moon and its light, and the tint of the dark. */
export const PALETTES = [
  { name: 'Indigo Tide', top: '#07102a', mid: '#0c1d44', bottom: '#12295a', wave: '110, 160, 230', moon: '#e4ebff', halo: '190, 210, 255', dark: '4, 6, 22' },
  { name: 'Verdigris Deep', top: '#04171a', mid: '#073333', bottom: '#0b4742', wave: '90, 220, 185', moon: '#e2fff2', halo: '150, 255, 215', dark: '2, 14, 14' },
  { name: 'Violet Murk', top: '#130825', mid: '#25113f', bottom: '#341a58', wave: '185, 135, 245', moon: '#f3e6ff', halo: '215, 175, 255', dark: '10, 4, 22' },
  { name: 'Ember Shoals', top: '#1a0b07', mid: '#341a0e', bottom: '#4a2612', wave: '240, 160, 90', moon: '#fff0d8', halo: '255, 200, 150', dark: '18, 7, 4' },
];

/** The blood moon of a Gloam's night. */
export const BLOOD_MOON = { name: 'Blood Moon', top: '#19050c', mid: '#330c1a', bottom: '#481225', wave: '240, 100, 120', moon: '#ff9a8a', halo: '255, 120, 110', dark: '18, 3, 8' };

/** The palette of `night` (0, the title's calm, counts as the first). */
export function paletteFor(night) {
  if (BOSS_NIGHTS.includes(night)) return BLOOD_MOON;
  return PALETTES[(Math.max(1, night) - 1) % PALETTES.length];
}
