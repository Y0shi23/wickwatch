// Boons: the gifts offered at each dawn-break between nights. Three are drawn, the player keeps one,
// and each changes the run's modifiers (the `mods` object the world reads) for the rest of the watch.

/** The modifiers a run starts with, before any boon. */
export function baseMods() {
  return {
    fireRate: 1,
    sparks: 1,
    pierce: 0,
    damage: 1,
    sparkSpeed: 1,
    moveSpeed: 1,
    dashCooldown: 1,
    magnet: 1,
    emberValue: 1,
    orbiters: 0,
    arc: 0,
    kindle: 0,
    beacon: 0,
    flareCost: 1,
    flareDamage: 1,
    phoenix: 0,
    choir: 0,
    mirror: 0,
    emberheart: 0,
  };
}

/** Every boon: its id, name, line of text, icon glyph, how many times it can be taken, and its effect. */
export const BOONS = [
  { id: 'quickwick', name: 'Quick Wick', text: 'Shoot sparks 25% faster.', icon: 'bolt', max: 3, apply: (m) => { m.fireRate *= 1.25; } },
  { id: 'twinflame', name: 'Twin Flame', text: 'One more spark in every volley.', icon: 'fork', max: 3, apply: (m) => { m.sparks += 1; } },
  { id: 'needlelight', name: 'Needlelight', text: 'Sparks pierce one more shade.', icon: 'needle', max: 3, apply: (m) => { m.pierce += 1; } },
  { id: 'hotcore', name: 'Hot Core', text: 'Sparks burn 40% harder and fly faster.', icon: 'core', max: 3, apply: (m) => { m.damage *= 1.4; m.sparkSpeed *= 1.12; } },
  { id: 'mothwings', name: 'Moth Wings', text: 'Dash 35% more often, move 10% faster.', icon: 'wing', max: 2, apply: (m) => { m.dashCooldown *= 0.65; m.moveSpeed *= 1.1; } },
  { id: 'hearthstone', name: 'Hearthstone', text: 'Lantern holds 25 more light and refills 40.', icon: 'hearth', max: 2, apply: (m, s) => { s.lantern.maxLight += 25; s.lantern.light = Math.min(s.lantern.maxLight, s.lantern.light + 40); } },
  { id: 'tallow', name: 'Tallow Heart', text: 'One more heart for the Wick, and all mended.', icon: 'heart', max: 2, apply: (m, s) => { s.player.maxHp += 1; s.player.hp = s.player.maxHp; } },
  { id: 'lodestar', name: 'Lodestar', text: 'Embers fly to you from far away and give 25% more.', icon: 'star', max: 2, apply: (m) => { m.magnet *= 2.4; m.emberValue *= 1.25; } },
  { id: 'cinder', name: 'Orbiting Cinder', text: 'A cinder circles the Wick and scorches shades.', icon: 'orbit', max: 3, apply: (m) => { m.orbiters += 1; } },
  { id: 'arclash', name: 'Arc Lash', text: 'Each banished shade lashes the nearest one.', icon: 'arc', max: 3, apply: (m) => { m.arc += 1; } },
  { id: 'kindling', name: 'Kindling', text: 'Every ember feeds the lantern 2 light.', icon: 'flame', max: 2, apply: (m) => { m.kindle += 2; } },
  { id: 'beacon', name: 'Beacon Eye', text: 'The lantern itself shoots at the nearest shade.', icon: 'eye', max: 3, apply: (m) => { m.beacon += 1; } },
  { id: 'flarecraft', name: 'Flarecraft', text: 'Flares charge 30% sooner and burn twice as hot.', icon: 'burst', max: 2, apply: (m) => { m.flareCost *= 0.7; m.flareDamage *= 2; } },
  { id: 'phoenix', name: 'Phoenix Wick', text: 'Once a night, a snuffed Wick rekindles with two hearts.', icon: 'phoenix', max: 1, rare: true, apply: (m) => { m.phoenix = 1; } },
  { id: 'choir', name: 'Lantern Choir', text: 'The lantern sings out a ring of light that burns nearby shades.', icon: 'choir', max: 2, rare: true, apply: (m) => { m.choir += 1; } },
  { id: 'mirror', name: 'Mirror Sparks', text: 'Sparks glance off the edge of the night and fly back in.', icon: 'mirror', max: 1, rare: true, apply: (m) => { m.mirror = 1; } },
  { id: 'emberheart', name: 'Emberheart', text: 'Every flare also feeds the lantern 20 light and mends a heart.', icon: 'emberheart', max: 1, rare: true, apply: (m) => { m.emberheart = 1; } },
];

/** How much likelier a common boon is to be drawn than a rare one. */
const RARE_WEIGHT = 0.4;

/** The boon with this id. */
export function boonById(id) {
  return BOONS.find((boon) => boon.id === id) ?? null;
}

/** Three different boons the run can still take (fewer only if fewer are left), drawn from `random`; rare ones come up less often. */
export function drawBoons(taken, random, count = 3) {
  const open = BOONS.filter((boon) => taken.filter((id) => id === boon.id).length < boon.max);
  const offer = [];
  while (offer.length < count && open.length > 0) {
    let total = 0;
    for (const boon of open) total += boon.rare ? RARE_WEIGHT : 1;
    let roll = random.next() * total;
    let index = open.length - 1;
    for (let at = 0; at < open.length; at += 1) {
      roll -= open[at].rare ? RARE_WEIGHT : 1;
      if (roll <= 0) {
        index = at;
        break;
      }
    }
    offer.push(open.splice(index, 1)[0]);
  }
  return offer;
}

/** Take boon `id` into the run held by `state`. */
export function takeBoon(state, id) {
  const boon = boonById(id);
  if (boon === null) return;
  boon.apply(state.mods, state);
  state.boons.push(id);
}
