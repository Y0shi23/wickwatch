// The screenshot scenes behind ?shot=title|play|boon|end. Each one plays real nights forward from a
// fresh world with the autopilot at the controls, so the frame is what a watch really looks like,
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { autopilot } from './autopilot.js';
import { EV_NIGHT_CLEAR, EV_OVER } from './world.js';
import { SCREEN_BOON, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/**
 * Play until `stop(state, events)` says so or `seconds` pass, taking the first boon offered at each
 * dawn-break (a stop that fires on a dawn-break leaves its offer open for the boon scene).
 */
function playUntil(world, seconds, skill, stop) {
  let controls = null;
  for (let index = 0; index < seconds / STEP; index += 1) {
    controls = autopilot(world.state, skill);
    const events = world.step(STEP, controls);
    if (stop(world.state, events)) break;
    if (events & EV_NIGHT_CLEAR) world.chooseBoon(world.state.offer[0].id);
    if (events & EV_OVER) break;
  }
  return controls;
}

/** Stage scene `name` in `world`; returns the ui to draw it with. */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    const controls = playUntil(world, 900, 1, (state) => state.night === 10 && state.nightTime > 13 && state.enemies.length >= 14);
    return { screen: SCREEN_PLAY, best: 18250, newBest: false, hover: -1, mouse: { x: controls.aimX, y: controls.aimY }, clock: world.state.time };
  }
  if (name === 'boon') {
    playUntil(world, 900, 1, (state, events) => state.night === 3 && (events & EV_NIGHT_CLEAR) !== 0);
    return { screen: SCREEN_BOON, best: 18250, newBest: false, hover: 1, mouse: null, clock: 1.2 };
  }
  if (name === 'end') {
    playUntil(world, 1500, 0.55, () => false);
    const state = world.state;
    return { screen: SCREEN_OVER, best: Math.max(18250, state.score), newBest: state.score > 18250, hover: -1, mouse: null, clock: 0.9 };
  }
  playUntil(world, 15, 1, () => false);
  return { screen: SCREEN_TITLE, best: 18250, newBest: false, hover: -1, mouse: null, clock: 0.5 };
}
