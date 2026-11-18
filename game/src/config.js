// Wickwatch tuning: every number the rules lean on, kept in one place so balance changes stay small.

/** The logical playfield; the canvas is scaled to fit the window and keeps this 16:9 shape. */
export const VIEW = { width: 1280, height: 720 };

/** The world advances in fixed steps of this many seconds, whatever the frame rate. */
export const STEP = 1 / 60;

/** Nights to survive; dawn after the last one is the win. */
export const NIGHTS = 10;

/** The nights a Gloam (the boss) rises on. */
export const BOSS_NIGHTS = [5, 10];

/** The last lantern, on its rock in the middle of the sea. Its light is its health. */
export const LANTERN = {
  x: 640,
  y: 384,
  radius: 24,
  maxLight: 100,
  /** How far its glow reaches at no light and at full light, in pixels. */
  glowMin: 110,
  glowMax: 340,
  /** Light it regains each second while no shade is near. */
  regen: 0.6,
};

/** The Wick: the little flame the player steers. */
export const PLAYER = {
  radius: 11,
  speed: 285,
  maxHp: 4,
  /** Seconds of safety after a hit. */
  invulnerable: 1.1,
  dashSpeed: 820,
  dashTime: 0.15,
  dashCooldown: 1.5,
  fireInterval: 0.17,
  /** The Wick may roam this far from the lantern before the dark slows it. */
  tether: 470,
};

/** The sparks the Wick shoots. */
export const SPARK = { speed: 660, damage: 1, life: 0.85, radius: 4, spread: 0.16 };

/** Embers fall from banished shades: points, flare charge and (with Kindling) lantern light. */
export const EMBER = { life: 8, magnet: 95, pull: 520, score: 5, charge: 7 };

/** The flare: a ring of light that sweeps the dark around the Wick. */
export const FLARE = { cost: 100, radius: 320, damage: 7, speed: 900 };

/** Kills within this many seconds of each other build the combo; every 5 adds half a multiplier. */
export const COMBO = { window: 2.4, per: 5, step: 0.5, max: 4 };

/** The most shades a night can hold at once, so a late night stays readable. */
export const MAX_ENEMIES = 70;

/**
 * The three watches the title offers: how hard the lantern is hit, how tough and quick the shades
 * are, and what the score is multiplied by.
 */
export const DIFFICULTIES = [
  { id: 'gentle', name: 'Gentle', text: 'the lantern takes 30% less', lanternDamage: 0.7, hp: 0.85, speed: 0.92, score: 0.8 },
  { id: 'keeper', name: 'Keeper', text: 'the watch as it was meant', lanternDamage: 1, hp: 1, speed: 1, score: 1 },
  { id: 'embermad', name: 'Ember-Mad', text: 'tougher, faster shades · score ×1.5', lanternDamage: 1.15, hp: 1.3, speed: 1.12, score: 1.5 },
];

/** The storage key of the best score. */
export const BEST_KEY = 'wickwatch.best.v1';
