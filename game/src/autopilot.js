// A simple watch-keeper that plays by the same controls a player has: it guards the side of the
// lantern the nearest shade comes from, leads its shots, sidesteps ink, dashes out of trouble and
// flares into crowds. The screenshot scenes use it to play real nights forward from a seed.
import { FLARE, LANTERN, SPARK } from './config.js';

/** Controls for this step. `skill` (0 to 1) is how well it dodges and how far ahead it aims. */
export function autopilot(state, skill = 1) {
  const player = state.player;
  let target = null;
  let targetScore = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.x < -10 || enemy.x > 1290 || enemy.y < 30 || enemy.y > 730) continue;
    const toLantern = Math.hypot(enemy.x - LANTERN.x, enemy.y - LANTERN.y);
    const toPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const score = toLantern * 0.8 + toPlayer * 0.4 - (enemy.kind === 'gloam' ? 120 : 0);
    if (score < targetScore) {
      targetScore = score;
      target = enemy;
    }
  }
  let aimX = player.x + Math.cos(player.aim) * 100;
  let aimY = player.y + Math.sin(player.aim) * 100;
  let guardX = LANTERN.x;
  let guardY = LANTERN.y + 100;
  if (target !== null) {
    const distance = Math.hypot(target.x - player.x, target.y - player.y);
    const lead = (distance / SPARK.speed) * skill;
    aimX = target.x + target.vx * lead;
    aimY = target.y + target.vy * lead;
    const angle = Math.atan2(target.y - LANTERN.y, target.x - LANTERN.x);
    guardX = LANTERN.x + Math.cos(angle) * 105;
    guardY = LANTERN.y + Math.sin(angle) * 105;
  }
  let moveX = (guardX - player.x) / 60;
  let moveY = (guardY - player.y) / 60;
  let ember = null;
  for (const candidate of state.embers) {
    if (Math.hypot(candidate.x - player.x, candidate.y - player.y) < 170) ember = candidate;
  }
  if (ember !== null) {
    moveX += (ember.x - player.x) / 90;
    moveY += (ember.y - player.y) / 90;
  }
  let danger = 0;
  const dodge = 70 + 60 * skill;
  for (const enemy of state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < dodge + enemy.radius) {
      const push = ((dodge + enemy.radius - distance) / dodge) * 2.4 * skill;
      moveX += (dx / distance) * push;
      moveY += (dy / distance) * push;
      if (distance < enemy.radius + 34) danger += 1;
    }
  }
  for (const glob of state.globs) {
    const dx = player.x - glob.x;
    const dy = player.y - glob.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 80 * skill) {
      moveX += (-glob.vy / 150) * Math.sign(dx * -glob.vy + dy * glob.vx || 1) * 1.5;
      moveY += (glob.vx / 150) * Math.sign(dx * -glob.vy + dy * glob.vx || 1) * 1.5;
    }
  }
  let crowd = 0;
  for (const enemy of state.enemies) if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < FLARE.radius * 0.8) crowd += enemy.kind === 'gloam' ? 4 : 1;
  return {
    moveX: Math.max(-1, Math.min(1, moveX)),
    moveY: Math.max(-1, Math.min(1, moveY)),
    aimX,
    aimY,
    fire: target !== null,
    dash: danger > 0 && skill > 0.5,
    flare: crowd >= 6,
  };
}
