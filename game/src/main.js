// Wickwatch boots here: the one loop, the screens (title, play, boon choice, pause, results) and the
// wiring between input, the rules, the sound and the renderer. The world advances in fixed steps.
//
// ?seed=N fixes the nights. ?shot=title|play|boon|end (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, DIFFICULTIES, STEP } from './config.js';
import { createRandom } from './rng.js';
import {
  createWorld, EV_BOSS, EV_BOSS_DOWN, EV_DASH, EV_DAWN, EV_EMBER, EV_FLARE, EV_GLOB, EV_HIT, EV_KILL,
  EV_LANTERN_HURT, EV_NIGHT_CLEAR, EV_OVER, EV_PLAYER_HURT, EV_SHOOT,
} from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { autopilot } from './autopilot.js';
import { createRenderer, SCREEN_BOON, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { boonCardRects, difficultyChipRects, tideCardRects } from './hud.js';

/** The index of the rectangle under (x, y), or -1. */
function rectUnder(rects, x, y) {
  return rects.findIndex((rect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y - 8 && y <= rect.y + rect.height);
}
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const world = createWorld(createRandom(seed), createRandom(seed ^ 0x5bd1e995));
window.addEventListener('resize', () => renderer.resize());

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const ui = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** The sound each world event makes. */
const EVENT_SOUNDS = [
  [EV_SHOOT, 'shoot'], [EV_HIT, 'hit'], [EV_KILL, 'kill'], [EV_EMBER, 'ember'], [EV_LANTERN_HURT, 'lantern'],
  [EV_PLAYER_HURT, 'wick'], [EV_DASH, 'dash'], [EV_FLARE, 'flare'], [EV_GLOB, 'glob'], [EV_BOSS, 'boss'],
  [EV_BOSS_DOWN, 'bossDown'], [EV_NIGHT_CLEAR, 'clear'],
];

function runGame() {
  const input = createInput(canvas, renderer.toWorld);
  const audio = createAudio();
  const ui = { screen: SCREEN_TITLE, best: readBest(), newBest: false, hover: -1, mouse: input.mouse, clock: 0, muted: false, difficulty: 1 };
  let accumulator = 0;
  let last = performance.now();
  let night = 0;

  function announce(message) {
    status.textContent = message;
  }

  function begin() {
    world.reset(DIFFICULTIES[ui.difficulty].id);
    accumulator = 0;
    night = 1;
    ui.screen = SCREEN_PLAY;
    ui.newBest = false;
    audio.play('night');
    announce(`Night 1, ${DIFFICULTIES[ui.difficulty].name} watch. Keep the lantern lit.`);
  }

  function pickDifficulty(index) {
    ui.difficulty = Math.max(0, Math.min(DIFFICULTIES.length - 1, index));
    audio.play('click');
    announce(`${DIFFICULTIES[ui.difficulty].name} watch.`);
  }

  function pickTide(index) {
    const offer = world.state.omenOffer;
    if (index < 0 || index >= offer.length) return;
    world.chooseOmen(index);
    audio.play('click');
    announce(`Tomorrow's tide: ${offer[index].name}.`);
  }

  function finish() {
    const state = world.state;
    ui.screen = SCREEN_OVER;
    ui.newBest = state.score > ui.best;
    if (ui.newBest) {
      ui.best = state.score;
      saveBest(ui.best);
    }
    audio.play(state.over === 'dawn' ? 'dawn' : 'over');
    announce(`Watch over. Score ${state.score}.`);
  }

  function choose(index) {
    const offer = world.state.offer;
    if (index < 0 || index >= offer.length) return;
    world.chooseBoon(offer[index].id);
    audio.play('choose');
    ui.screen = SCREEN_PLAY;
  }

  function cardUnder(x, y) {
    const rects = boonCardRects(world.state.offer.length);
    return rects.findIndex((rect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y - 8 && y <= rect.y + rect.height);
  }

  function handle(actions) {
    for (const entry of actions) {
      if (entry.action !== 'blur') audio.wake();
      if (entry.action === 'mute') ui.muted = audio.toggle();
      if (ui.screen === SCREEN_TITLE) {
        const chip = entry.action === 'click' ? rectUnder(difficultyChipRects(), entry.x, entry.y) : -1;
        if (entry.action.startsWith('choose')) pickDifficulty(Number(entry.action.slice(6)) - 1);
        else if (entry.code === 'ArrowLeft' || entry.code === 'ArrowRight') pickDifficulty(ui.difficulty + (entry.code === 'ArrowLeft' ? -1 : 1));
        else if (chip >= 0) pickDifficulty(chip);
        else if (entry.action === 'confirm' || entry.action === 'click') {
          audio.startMusic();
          begin();
        }
      } else if (ui.screen === SCREEN_PLAY) {
        if (entry.action === 'pause' || entry.action === 'back' || entry.action === 'blur') ui.screen = SCREEN_PAUSED;
      } else if (ui.screen === SCREEN_PAUSED) {
        if (entry.action === 'pause' || entry.action === 'back' || entry.action === 'confirm') ui.screen = SCREEN_PLAY;
        else if (entry.action === 'restart') begin();
      } else if (ui.screen === SCREEN_BOON) {
        const tide = entry.action === 'click' ? rectUnder(tideCardRects(world.state.omenOffer.length), entry.x, entry.y) : -1;
        if (entry.code === 'KeyQ' || entry.code === 'KeyW') pickTide(entry.code === 'KeyQ' ? 0 : 1);
        else if (entry.action.startsWith('choose')) choose(Number(entry.action.slice(6)) - 1);
        else if (tide >= 0) pickTide(tide);
        else if (entry.action === 'click') choose(cardUnder(entry.x, entry.y));
      } else if (ui.screen === SCREEN_OVER) {
        if (entry.action === 'confirm' || entry.action === 'click' || entry.action === 'restart') begin();
        else if (entry.action === 'back') {
          world.reset();
          ui.screen = SCREEN_TITLE;
        }
      }
    }
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    ui.clock += elapsed;
    const actions = input.take();
    handle(actions);
    const playing = ui.screen === SCREEN_PLAY;
    const attract = ui.screen === SCREEN_TITLE;
    if (playing || attract || ui.screen === SCREEN_BOON) {
      accumulator += elapsed;
      let controls = playing ? input.controls(actions) : autopilot(world.state, 1);
      while (accumulator >= STEP) {
        const events = world.step(STEP, controls);
        controls = { ...controls, dash: false, flare: false };
        accumulator -= STEP;
        if (attract) {
          if (events & EV_NIGHT_CLEAR) world.chooseBoon(world.state.offer[0].id);
          if (events & EV_OVER) world.reset();
          continue;
        }
        for (const [bit, cue] of EVENT_SOUNDS) if (events & bit) audio.play(cue);
        if (events & EV_NIGHT_CLEAR) {
          ui.screen = SCREEN_BOON;
          announce(`Night ${world.state.night} survived. Choose a boon: 1, 2 or 3.`);
        }
        if (events & (EV_OVER | EV_DAWN)) {
          finish();
          break;
        }
      }
      if (playing && world.state.night !== night && ui.screen === SCREEN_PLAY) {
        night = world.state.night;
        audio.play('night');
      }
      audio.setMood(playing ? Math.min(1, world.state.enemies.length / 25) : 0);
    }
    if (ui.screen === SCREEN_BOON) ui.hover = cardUnder(input.mouse.x, input.mouse.y);
    canvas.style.cursor = ui.screen === SCREEN_PLAY ? 'none' : 'default';
    renderer.draw(world, ui);
    requestAnimationFrame(frame);
  }

  world.reset();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
