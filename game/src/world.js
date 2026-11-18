// The rules of the watch: the Wick, the lantern, sparks, ink, embers and flares, and how they all
// collide. step() advances everything by one fixed step and returns a bitmask of what happened, so
// the sound and the screens can answer without the rules knowing they exist.
import { COMBO, EMBER, FLARE, LANTERN, MAX_ENEMIES, NIGHTS, PLAYER, SPARK, VIEW } from './config.js';
import { BRUTE, ENEMY_KINDS, GLOAM, SHADE, makeEnemy, updateEnemy } from './enemies.js';
import { planNight } from './waves.js';
import { baseMods, drawBoons, takeBoon } from './boons.js';
import { createEffects } from './particles.js';

export const EV_SHOOT = 1;
export const EV_HIT = 2;
export const EV_KILL = 4;
export const EV_EMBER = 8;
export const EV_LANTERN_HURT = 16;
export const EV_PLAYER_HURT = 32;
export const EV_DASH = 64;
export const EV_FLARE = 128;
export const EV_NIGHT_CLEAR = 256;
export const EV_OVER = 512;
export const EV_BOSS = 1024;
export const EV_GLOB = 2048;
export const EV_DAWN = 4096;
export const EV_BOSS_DOWN = 8192;

/** How a watch can end. */
export const END_LANTERN = 'lantern';
export const END_WICK = 'wick';
export const END_DAWN = 'dawn';

/** The score multiplier a combo of `combo` kills is worth. */
export function comboMultiplier(combo) {
  return 1 + Math.min(COMBO.max - 1, Math.floor(combo / COMBO.per) * COMBO.step);
}

/** The radius the lantern's glow reaches with its current light. */
export function glowRadius(lantern) {
  const share = Math.max(0, Math.min(1, lantern.light / LANTERN.maxLight));
  return LANTERN.glowMin + (LANTERN.glowMax - LANTERN.glowMin) * share;
}

function freshState() {
  return {
    night: 0,
    phase: 'fight',
    time: 0,
    nightTime: 0,
    over: null,
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    kills: 0,
    embersTaken: 0,
    flare: 0,
    shake: 0,
    flash: 0,
    nextId: 1,
    queue: [],
    nightTotal: 0,
    nightBanished: 0,
    banner: null,
    offer: [],
    boons: [],
    mods: baseMods(),
    player: {
      x: LANTERN.x,
      y: LANTERN.y + 90,
      vx: 0,
      vy: 0,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      invulnerable: 0,
      dashTime: 0,
      dashCooldown: 0,
      dashX: 0,
      dashY: 0,
      dashId: 0,
      fireCooldown: 0,
      aim: -Math.PI / 2,
      hurt: 0,
    },
    lantern: { x: LANTERN.x, y: LANTERN.y, light: LANTERN.maxLight, maxLight: LANTERN.maxLight, hurt: 0, beaconCooldown: 1 },
    enemies: [],
    sparks: [],
    globs: [],
    embers: [],
    rings: [],
    orbitAngle: 0,
    boss: null,
  };
}

/** A world for one watch: `random` drives the rules, `fxRandom` only the effects. */
export function createWorld(random, fxRandom) {
  const fx = createEffects(fxRandom);
  let state = freshState();
  let events = 0;
  const hatch = [];

  function spawn(kind, x, y) {
    const enemy = makeEnemy(kind, x, y, state.night, random);
    enemy.id = state.nextId++;
    state.enemies.push(enemy);
    if (kind === GLOAM) {
      state.boss = enemy;
      events |= EV_BOSS;
      state.banner = { text: enemy.final ? 'THE GLOAM, UNBOUND' : 'THE GLOAM RISES', sub: 'It feeds on the lantern. Drive it back.', time: 3 };
    }
    return enemy;
  }

  function startNight(night) {
    state.night = night;
    state.phase = 'fight';
    state.nightTime = 0;
    const plan = planNight(night, random);
    state.queue = plan.queue;
    state.nightTotal = plan.total;
    state.nightBanished = 0;
    state.offer = [];
    state.banner = { text: `NIGHT ${night}`, sub: night === NIGHTS ? 'The last night. Hold until dawn.' : 'The Murk rises from the sea.', time: 2.6 };
  }

  function reset() {
    state = freshState();
    fx.clear();
    startNight(1);
  }

  function hurtLantern(amount) {
    const lantern = state.lantern;
    lantern.light = Math.max(0, lantern.light - amount);
    lantern.hurt = 0.35;
    state.flash = Math.max(state.flash, 0.25);
    state.shake = Math.max(state.shake, 6);
    events |= EV_LANTERN_HURT;
    fx.burst(lantern.x, lantern.y - 10, 35, 10, 160, 3);
  }

  function hurtPlayer(amount) {
    const player = state.player;
    if (player.invulnerable > 0 || player.hp <= 0) return;
    player.hp = Math.max(0, player.hp - amount);
    player.invulnerable = PLAYER.invulnerable;
    player.hurt = 0.4;
    state.shake = Math.max(state.shake, 9);
    state.combo = 0;
    events |= EV_PLAYER_HURT;
    fx.burst(player.x, player.y, 10, 16, 220, 3);
  }

  function dropEmbers(x, y, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = random.range(0, Math.PI * 2);
      const pace = random.range(40, 140);
      state.embers.push({ x, y, vx: Math.cos(angle) * pace, vy: Math.sin(angle) * pace, life: EMBER.life, spin: random.range(0, 6) });
    }
  }

  function nearestEnemy(x, y, reach, except = null) {
    let best = null;
    let bestDistance = reach;
    for (const enemy of state.enemies) {
      if (!enemy.alive || enemy === except) continue;
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = enemy;
      }
    }
    return best;
  }

  function damageEnemy(enemy, amount, depth = 0) {
    if (!enemy.alive) return;
    enemy.hp -= amount;
    enemy.hurt = 0.12;
    events |= EV_HIT;
    if (enemy.hp <= 0) banish(enemy, depth);
  }

  function banish(enemy, depth) {
    const spec = ENEMY_KINDS[enemy.kind];
    enemy.alive = false;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const points = Math.round(spec.score * comboMultiplier(state.combo));
    state.score += points;
    state.kills += 1;
    state.nightBanished += 1;
    events |= EV_KILL;
    fx.burst(enemy.x, enemy.y, spec.hue, enemy.kind === GLOAM ? 120 : 14 + enemy.radius, enemy.kind === GLOAM ? 420 : 200, enemy.kind === GLOAM ? 5 : 3);
    fx.float(enemy.x, enemy.y - enemy.radius, `+${points}`, 45);
    dropEmbers(enemy.x, enemy.y, spec.embers);
    if (enemy.kind === BRUTE) {
      for (let index = 0; index < 2; index += 1) {
        hatch.push({ kind: SHADE, x: enemy.x + (index ? 18 : -18), y: enemy.y });
      }
    }
    if (enemy.kind === GLOAM) {
      state.boss = null;
      state.shake = 18;
      state.flash = 0.6;
      events |= EV_BOSS_DOWN;
      for (const other of state.enemies) if (other.alive && other !== enemy) damageEnemy(other, 99, 9);
    }
    if (state.mods.arc > 0 && depth < 3) {
      const next = nearestEnemy(enemy.x, enemy.y, 250, enemy);
      if (next !== null) {
        fx.bolt(enemy.x, enemy.y, next.x, next.y);
        damageEnemy(next, 1.6 * state.mods.arc * state.mods.damage, depth + 1);
      }
    }
  }

  function shoot(x, y, angle, damage, pierce, beacon = false) {
    const speed = SPARK.speed * state.mods.sparkSpeed;
    state.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: SPARK.life, damage, pierce, hits: [], beacon });
  }

  function updatePlayer(dt, controls) {
    const player = state.player;
    const mods = state.mods;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.hurt = Math.max(0, player.hurt - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.aim = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);
    let mx = controls.moveX;
    let my = controls.moveY;
    const length = Math.hypot(mx, my);
    if (length > 1) {
      mx /= length;
      my /= length;
    }
    if (controls.dash && player.dashCooldown <= 0) {
      const dx = length > 0.1 ? mx : Math.cos(player.aim);
      const dy = length > 0.1 ? my : Math.sin(player.aim);
      const size = Math.hypot(dx, dy) || 1;
      player.dashX = dx / size;
      player.dashY = dy / size;
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown * mods.dashCooldown;
      player.dashId += 1;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.08);
      events |= EV_DASH;
      fx.burst(player.x, player.y, 45, 10, 140, 2.5, 0.4);
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
      fx.trail(player.x, player.y, 40, 3);
    } else {
      const speed = PLAYER.speed * mods.moveSpeed;
      player.vx += (mx * speed - player.vx) * Math.min(1, 14 * dt);
      player.vy += (my * speed - player.vy) * Math.min(1, 14 * dt);
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const fromX = player.x - LANTERN.x;
    const fromY = player.y - LANTERN.y;
    const distance = Math.hypot(fromX, fromY);
    if (distance > PLAYER.tether) {
      player.x = LANTERN.x + (fromX / distance) * PLAYER.tether;
      player.y = LANTERN.y + (fromY / distance) * PLAYER.tether;
    }
    if (distance < LANTERN.radius + PLAYER.radius + 4) {
      const push = (LANTERN.radius + PLAYER.radius + 4) / (distance || 1);
      player.x = LANTERN.x + fromX * push;
      player.y = LANTERN.y + fromY * push;
    }
    player.x = Math.max(PLAYER.radius, Math.min(VIEW.width - PLAYER.radius, player.x));
    player.y = Math.max(PLAYER.radius + 40, Math.min(VIEW.height - PLAYER.radius, player.y));
    if (controls.fire && player.fireCooldown <= 0) {
      const count = mods.sparks;
      for (let index = 0; index < count; index += 1) {
        const angle = player.aim + (index - (count - 1) / 2) * SPARK.spread;
        shoot(player.x + Math.cos(player.aim) * 12, player.y + Math.sin(player.aim) * 12, angle, SPARK.damage * mods.damage, mods.pierce);
      }
      player.fireCooldown = PLAYER.fireInterval / mods.fireRate;
      events |= EV_SHOOT;
    }
    if (controls.flare && state.flare >= FLARE.cost * mods.flareCost) {
      state.flare = 0;
      state.rings.push({ x: player.x, y: player.y, radius: 0, hits: [] });
      state.shake = Math.max(state.shake, 12);
      state.flash = Math.max(state.flash, 0.35);
      events |= EV_FLARE;
      fx.burst(player.x, player.y, 45, 40, 380, 3.5, 0.8);
    }
  }

  function updateHelpers(dt) {
    const mods = state.mods;
    const lantern = state.lantern;
    if (mods.beacon > 0) {
      lantern.beaconCooldown -= dt;
      if (lantern.beaconCooldown <= 0) {
        const target = nearestEnemy(lantern.x, lantern.y, 430);
        if (target !== null) {
          shoot(lantern.x, lantern.y - 18, Math.atan2(target.y - lantern.y + 18, target.x - lantern.x), SPARK.damage * mods.damage, 0, true);
          lantern.beaconCooldown = 1.5 / mods.beacon;
        } else {
          lantern.beaconCooldown = 0.2;
        }
      }
    }
    state.orbitAngle += dt * 3.4;
    for (let index = 0; index < mods.orbiters; index += 1) {
      const angle = state.orbitAngle + (index / mods.orbiters) * Math.PI * 2;
      const x = state.player.x + Math.cos(angle) * 48;
      const y = state.player.y + Math.sin(angle) * 48;
      for (const enemy of state.enemies) {
        if (!enemy.alive || (enemy.scorch ?? 0) > state.time) continue;
        if (Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + 9) {
          enemy.scorch = state.time + 0.3;
          damageEnemy(enemy, 1.2 * mods.damage);
          fx.burst(x, y, 30, 4, 90, 2, 0.3);
        }
      }
    }
  }

  function updateSparks(dt) {
    for (let index = state.sparks.length - 1; index >= 0; index -= 1) {
      const spark = state.sparks[index];
      spark.life -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      let spent = spark.life <= 0 || spark.x < -20 || spark.x > VIEW.width + 20 || spark.y < -20 || spark.y > VIEW.height + 20;
      for (let g = state.globs.length - 1; g >= 0 && !spent; g -= 1) {
        const glob = state.globs[g];
        if (Math.hypot(glob.x - spark.x, glob.y - spark.y) < 9 + SPARK.radius) {
          state.globs.splice(g, 1);
          fx.burst(glob.x, glob.y, 150, 6, 120, 2, 0.4);
          spent = spark.pierce <= 0;
          spark.pierce -= 1;
        }
      }
      for (const enemy of state.enemies) {
        if (spent) break;
        if (!enemy.alive || spark.hits.includes(enemy.id)) continue;
        if (Math.hypot(enemy.x - spark.x, enemy.y - spark.y) < enemy.radius + SPARK.radius) {
          spark.hits.push(enemy.id);
          if (enemy.kind !== GLOAM) {
            enemy.x += spark.vx * 0.012;
            enemy.y += spark.vy * 0.012;
          }
          fx.burst(spark.x, spark.y, 40, 3, 110, 2, 0.25);
          damageEnemy(enemy, spark.damage);
          if (spark.pierce <= 0) spent = true;
          spark.pierce -= 1;
        }
      }
      if (spent) state.sparks.splice(index, 1);
    }
  }

  function updateGlobs(dt) {
    const player = state.player;
    const lantern = state.lantern;
    for (let index = state.globs.length - 1; index >= 0; index -= 1) {
      const glob = state.globs[index];
      glob.life -= dt;
      glob.x += glob.vx * dt;
      glob.y += glob.vy * dt;
      let gone = glob.life <= 0 || glob.x < -60 || glob.x > VIEW.width + 60 || glob.y < -60 || glob.y > VIEW.height + 60;
      if (!gone && Math.hypot(glob.x - player.x, glob.y - player.y) < PLAYER.radius + 7 && player.invulnerable <= 0) {
        hurtPlayer(1);
        gone = true;
      }
      if (!gone && Math.hypot(glob.x - lantern.x, glob.y - lantern.y) < LANTERN.radius + 7) {
        hurtLantern(5);
        gone = true;
      }
      if (gone) state.globs.splice(index, 1);
    }
  }

  function updateContacts() {
    const player = state.player;
    const lantern = state.lantern;
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const spec = ENEMY_KINDS[enemy.kind];
      const toLantern = Math.hypot(enemy.x - lantern.x, enemy.y - lantern.y);
      if (toLantern < LANTERN.radius + enemy.radius) {
        hurtLantern(spec.lantern);
        if (enemy.kind === GLOAM) {
          const away = Math.atan2(enemy.y - lantern.y, enemy.x - lantern.x);
          enemy.x = lantern.x + Math.cos(away) * 150;
          enemy.y = lantern.y + Math.sin(away) * 150;
          enemy.attack = 0;
        } else {
          enemy.alive = false;
          fx.burst(enemy.x, enemy.y, 260, 16, 150, 3);
        }
        continue;
      }
      const toPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (toPlayer < PLAYER.radius + enemy.radius && player.hp > 0) {
        if (player.dashTime > 0) {
          if (enemy.dashHit !== player.dashId) {
            enemy.dashHit = player.dashId;
            damageEnemy(enemy, 3 * state.mods.damage);
            fx.burst(enemy.x, enemy.y, 45, 8, 180, 2.5, 0.4);
          }
        } else if (player.invulnerable <= 0) {
          hurtPlayer(1);
          if (enemy.kind !== GLOAM) damageEnemy(enemy, 2);
          const away = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          player.vx += Math.cos(away) * 420;
          player.vy += Math.sin(away) * 420;
        }
      }
    }
  }

  function updateEmbers(dt) {
    const player = state.player;
    const mods = state.mods;
    for (let index = state.embers.length - 1; index >= 0; index -= 1) {
      const ember = state.embers[index];
      ember.life -= dt;
      const dx = player.x - ember.x;
      const dy = player.y - ember.y;
      const distance = Math.hypot(dx, dy) || 1;
      const pulled = distance < EMBER.magnet * mods.magnet || state.phase !== 'fight';
      if (pulled) {
        ember.vx += (dx / distance) * EMBER.pull * dt * 3;
        ember.vy += (dy / distance) * EMBER.pull * dt * 3;
      }
      ember.vx *= 1 - 3 * dt;
      ember.vy *= 1 - 3 * dt;
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      if (distance < PLAYER.radius + 10) {
        state.embers.splice(index, 1);
        state.embersTaken += 1;
        state.score += EMBER.score;
        state.flare = Math.min(FLARE.cost * mods.flareCost, state.flare + EMBER.charge * mods.emberValue);
        if (mods.kindle > 0) state.lantern.light = Math.min(state.lantern.maxLight, state.lantern.light + mods.kindle);
        events |= EV_EMBER;
        continue;
      }
      if (ember.life <= 0) state.embers.splice(index, 1);
    }
  }

  function updateRings(dt) {
    for (let index = state.rings.length - 1; index >= 0; index -= 1) {
      const ring = state.rings[index];
      ring.radius += FLARE.speed * dt;
      for (const enemy of state.enemies) {
        if (!enemy.alive || ring.hits.includes(enemy.id)) continue;
        if (Math.hypot(enemy.x - ring.x, enemy.y - ring.y) < ring.radius + enemy.radius) {
          ring.hits.push(enemy.id);
          damageEnemy(enemy, FLARE.damage * state.mods.flareDamage);
        }
      }
      for (let g = state.globs.length - 1; g >= 0; g -= 1) {
        if (Math.hypot(state.globs[g].x - ring.x, state.globs[g].y - ring.y) < ring.radius) state.globs.splice(g, 1);
      }
      if (ring.radius >= FLARE.radius) state.rings.splice(index, 1);
    }
  }

  function endNight() {
    state.phase = 'clear';
    const bonus = 100 * state.night + Math.round(state.lantern.light);
    state.score += bonus;
    state.globs.length = 0;
    state.sparks.length = 0;
    if (state.night >= NIGHTS) {
      state.over = END_DAWN;
      events |= EV_DAWN | EV_OVER;
      fx.texts.length = 0;
    } else {
      state.offer = drawBoons(state.boons, random);
      events |= EV_NIGHT_CLEAR;
    }
    state.clearBonus = bonus;
  }

  /** Advance the watch by `dt` seconds under `controls`; returns the EV_* bits of what happened. */
  function step(dt, controls) {
    events = 0;
    fx.update(dt);
    state.shake = Math.max(0, state.shake - 40 * dt);
    state.flash = Math.max(0, state.flash - dt);
    state.lantern.hurt = Math.max(0, state.lantern.hurt - dt);
    if (state.banner !== null) {
      state.banner.time -= dt;
      if (state.banner.time <= 0) state.banner = null;
    }
    if (state.over !== null) return events;
    state.time += dt;
    if (state.phase !== 'fight') {
      updateEmbers(dt);
      return events;
    }
    state.nightTime += dt;
    while (state.queue.length > 0 && state.queue[0].at <= state.nightTime && state.enemies.length < MAX_ENEMIES) {
      const next = state.queue.shift();
      spawn(next.kind, next.x, next.y);
    }
    updatePlayer(dt, controls);
    updateHelpers(dt);
    const act = {
      glob: (x, y, dx, dy, speed) => {
        state.globs.push({ x, y, vx: dx * speed, vy: dy * speed, life: 7 });
        events |= EV_GLOB;
      },
      brood: (x, y, index) => hatch.push({ kind: SHADE, x: x + Math.cos(index * 2.1) * 50, y: y + Math.sin(index * 2.1) * 50 }),
    };
    for (const enemy of state.enemies) if (enemy.alive) updateEnemy(enemy, state, dt, act);
    updateSparks(dt);
    updateGlobs(dt);
    updateContacts();
    updateRings(dt);
    updateEmbers(dt);
    while (hatch.length > 0) {
      const egg = hatch.shift();
      spawn(egg.kind, egg.x, egg.y);
      state.nightTotal += 1;
    }
    state.enemies = state.enemies.filter((enemy) => enemy.alive);
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
    const lantern = state.lantern;
    const near = nearestEnemy(lantern.x, lantern.y, 190);
    if (near === null) lantern.light = Math.min(lantern.maxLight, lantern.light + LANTERN.regen * dt);
    if (lantern.light <= 0) {
      state.over = END_LANTERN;
      events |= EV_OVER;
      fx.texts.length = 0;
    } else if (state.player.hp <= 0) {
      state.over = END_WICK;
      events |= EV_OVER;
      fx.texts.length = 0;
    } else if (state.queue.length === 0 && state.enemies.length === 0) {
      endNight();
    }
    return events;
  }

  /** Keep boon `id` from the offer and begin the next night. */
  function chooseBoon(id) {
    if (state.phase !== 'clear' || state.over !== null) return;
    takeBoon(state, id);
    fx.float(state.player.x, state.player.y - 30, state.offer.find((boon) => boon.id === id)?.name ?? '', 50);
    startNight(state.night + 1);
  }

  return {
    get state() {
      return state;
    },
    fx,
    reset,
    step,
    chooseBoon,
  };
}
