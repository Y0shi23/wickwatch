// The Murk: every kind of shade that crawls out of the night sea, and how each one moves and attacks.
// Shades are plain objects; updateEnemy() moves one a step and asks the world (through `act`) for the
// globs and broods it makes, so the world keeps every collision rule in one place.
import { LANTERN } from './config.js';

export const SHADE = 'shade';
export const DARTER = 'darter';
export const BRUTE = 'brute';
export const SPITTER = 'spitter';
export const GLOAM = 'gloam';

/** What each kind is: its name on screen, toughness, speed, size and what it is worth. */
export const ENEMY_KINDS = {
  [SHADE]: { name: 'Murkmoth', hp: 2, speed: 58, radius: 13, score: 10, lantern: 8, embers: 1, hue: 275 },
  [DARTER]: { name: 'Needlefin', hp: 1, speed: 158, radius: 9, score: 15, lantern: 5, embers: 1, hue: 190 },
  [BRUTE]: { name: 'Tarbulk', hp: 10, speed: 30, radius: 24, score: 45, lantern: 20, embers: 4, hue: 320 },
  [SPITTER]: { name: 'Inkwisp', hp: 3, speed: 66, radius: 12, score: 25, lantern: 6, embers: 2, hue: 150 },
  [GLOAM]: { name: 'The Gloam', hp: 120, speed: 70, radius: 46, score: 600, lantern: 18, embers: 24, hue: 255 },
};

/** How much tougher every shade is on a given night. */
export function toughness(night) {
  return 1 + (night - 1) * 0.09;
}

/** A new shade of `kind` at (x, y) for `night`; the final Gloam is bigger and angrier. */
export function makeEnemy(kind, x, y, night, random) {
  const spec = ENEMY_KINDS[kind];
  let hp = Math.round(spec.hp * toughness(night));
  if (kind === GLOAM) hp = night >= 10 ? 330 : 150;
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    radius: spec.radius,
    speed: spec.speed * (1 + (night - 1) * 0.025),
    age: 0,
    wobble: random.range(0, Math.PI * 2),
    cooldown: random.range(1.2, 2.6),
    hurt: 0,
    attack: 0,
    alive: true,
    final: kind === GLOAM && night >= 10,
  };
}

function steer(enemy, tx, ty, speed, turn, dt) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const want = Math.min(1, turn * dt);
  enemy.vx += ((dx / length) * speed - enemy.vx) * want;
  enemy.vy += ((dy / length) * speed - enemy.vy) * want;
}

/** The Gloam circles the lantern, fans ink at it, calls broods of moths and lunges once it is hurt. */
function updateGloam(enemy, state, dt, act) {
  const angle = Math.atan2(enemy.y - LANTERN.y, enemy.x - LANTERN.x) + dt * (enemy.final ? 0.34 : 0.26);
  const lunging = enemy.attack > 0;
  const orbit = lunging ? 70 : 300;
  const tx = LANTERN.x + Math.cos(angle) * orbit;
  const ty = LANTERN.y + Math.sin(angle) * orbit * 0.62;
  steer(enemy, tx, ty, lunging ? enemy.speed * 3.2 : enemy.speed, lunging ? 3 : 1.6, dt);
  enemy.attack = Math.max(0, enemy.attack - dt);
  enemy.cooldown -= dt;
  if (enemy.cooldown > 0) return;
  const hurt = enemy.hp < enemy.maxHp * 0.5;
  const move = Math.floor(enemy.age * 7) % (hurt ? 3 : 2);
  if (move === 0) {
    const shots = enemy.final ? 9 : 7;
    const aim = Math.atan2(LANTERN.y - enemy.y, LANTERN.x - enemy.x);
    for (let index = 0; index < shots; index += 1) {
      const turn = aim + (index - (shots - 1) / 2) * 0.17;
      act.glob(enemy.x, enemy.y, Math.cos(turn), Math.sin(turn), 150);
    }
  } else if (move === 1) {
    const brood = enemy.final ? 4 : 3;
    for (let index = 0; index < brood; index += 1) act.brood(enemy.x, enemy.y, index);
  } else {
    enemy.attack = 1.3;
  }
  enemy.cooldown = (enemy.final ? 2.5 : 3.1) * (hurt ? 0.8 : 1);
  void state;
}

/**
 * Move one shade a step of `dt` seconds. `act.glob(x, y, dx, dy, speed)` throws an ink glob and
 * `act.brood(x, y, index)` hatches a moth beside it.
 */
export function updateEnemy(enemy, state, dt, act) {
  enemy.age += dt;
  enemy.hurt = Math.max(0, enemy.hurt - dt);
  const player = state.player;
  if (enemy.kind === SHADE) {
    const sway = Math.sin(enemy.age * 3 + enemy.wobble) * 0.9;
    const dx = LANTERN.x - enemy.x;
    const dy = LANTERN.y - enemy.y;
    steer(enemy, LANTERN.x - dy * sway * 0.25, LANTERN.y + dx * sway * 0.25, enemy.speed, 2.2, dt);
  } else if (enemy.kind === DARTER) {
    const near = Math.hypot(player.x - enemy.x, player.y - enemy.y) < 380 && player.hp > 0;
    const tx = near ? player.x : LANTERN.x;
    const ty = near ? player.y : LANTERN.y;
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    const zig = Math.sin(enemy.age * 7 + enemy.wobble) * 120;
    steer(enemy, tx - (dy / length) * zig, ty + (dx / length) * zig, enemy.speed, 4, dt);
  } else if (enemy.kind === BRUTE) {
    steer(enemy, LANTERN.x, LANTERN.y, enemy.speed * (1 + 0.25 * Math.sin(enemy.age * 1.6)), 1.2, dt);
  } else if (enemy.kind === SPITTER) {
    const distance = Math.hypot(enemy.x - LANTERN.x, enemy.y - LANTERN.y);
    const angle = Math.atan2(enemy.y - LANTERN.y, enemy.x - LANTERN.x) + (enemy.wobble > Math.PI ? 0.5 : -0.5);
    const ring = 255;
    const reach = distance > ring + 40 ? ring : ring + 20;
    steer(enemy, LANTERN.x + Math.cos(angle) * reach, LANTERN.y + Math.sin(angle) * reach * 0.7, enemy.speed, 1.8, dt);
    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0 && distance < ring + 120) {
      const dx = LANTERN.x - enemy.x;
      const dy = LANTERN.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      act.glob(enemy.x, enemy.y, dx / length, dy / length, 175);
      enemy.cooldown = 2.9;
      enemy.attack = 0.35;
    }
    enemy.attack = Math.max(0, enemy.attack - dt);
  } else if (enemy.kind === GLOAM) {
    updateGloam(enemy, state, dt, act);
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}
