// Keyboard and mouse: held keys become movement, the held left button fires, and one-shot presses
// (dash, flare, confirm, pause, mute, restart, a boon's number, a click) queue up as actions.

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

const ACTION_KEYS = {
  Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyE: 'flare', KeyQ: 'flare',
  Enter: 'confirm', NumpadEnter: 'confirm',
  KeyP: 'pause', Escape: 'back',
  KeyM: 'mute', KeyR: 'restart',
  Digit1: 'choose1', Digit2: 'choose2', Digit3: 'choose3',
  Numpad1: 'choose1', Numpad2: 'choose2', Numpad3: 'choose3',
};

/** Input for `canvas`; `toWorld(clientX, clientY)` maps the mouse onto the playfield. */
export function createInput(canvas, toWorld) {
  const held = new Set();
  const queue = [];
  const mouse = { x: 640, y: 300, down: false, seen: false };

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || ACTION_KEYS[event.code]) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    queue.push({ action: ACTION_KEYS[event.code] ?? 'key', code: event.code });
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
    queue.push({ action: 'blur' });
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('mousemove', (event) => {
    Object.assign(mouse, toWorld(event.clientX, event.clientY));
    mouse.seen = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    Object.assign(mouse, toWorld(event.clientX, event.clientY));
    mouse.seen = true;
    if (event.button === 0) {
      mouse.down = true;
      queue.push({ action: 'click', x: mouse.x, y: mouse.y });
    } else if (event.button === 2) {
      queue.push({ action: 'flare' });
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });

  /** The held controls this frame, plus whether a dash or flare was pressed since the last call. */
  function controls(actions) {
    let moveX = 0;
    let moveY = 0;
    for (const code of held) {
      const move = MOVE_KEYS[code];
      if (move) {
        moveX += move[0];
        moveY += move[1];
      }
    }
    return {
      moveX: Math.sign(moveX),
      moveY: Math.sign(moveY),
      aimX: mouse.x,
      aimY: mouse.y,
      fire: mouse.down || held.has('KeyJ'),
      dash: actions.some((entry) => entry.action === 'dash'),
      flare: actions.some((entry) => entry.action === 'flare'),
    };
  }

  /** Every one-shot action since the last call, oldest first. */
  function take() {
    return queue.splice(0, queue.length);
  }

  return { mouse, controls, take };
}
