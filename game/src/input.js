// Keyboard and pointer input for the whole game. Held keys are exposed as a
// movement vector; one-shot presses (interact, pause, mute, confirm) are queued
// as bit flags and taken once by the loop so a press between frames is never
// lost or counted twice. The mouse position is tracked in screen space and the
// main loop converts it to world space for aiming.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_MUTE = 8;
export const ACTION_RELOAD = 16;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'fire',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false, fire: false };
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = true;
    if (event.code === 'KeyE' && !event.repeat) actions |= ACTION_INTERACT;
    else if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) actions |= ACTION_PAUSE;
    else if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyM' && !event.repeat) actions |= ACTION_MUTE;
    else if (event.code === 'KeyR' && !event.repeat) actions |= ACTION_RELOAD;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) { mouse.down = true; actions |= ACTION_CONFIRM; }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.down = false;
  });

  return {
    held,
    mouse,
    /** Horizontal/vertical intent, each -1, 0 or 1. */
    axisX() { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    axisY() { return (held.down ? 1 : 0) - (held.up ? 1 : 0); },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    clearActions() { actions = 0; },
  };
}
