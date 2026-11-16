// Keyboard and mouse input. The ship answers the mouse (it eases toward the
// pointer) and the arrow keys or WASD; Space or a click confirms, P pauses,
// M mutes. Every action is edge-triggered once per press.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

export function createInput(canvas) {
  let actions = 0;
  let keys = new Set();
  let mouse = { x: null, y: null, inside: false };

  function confirm() {
    actions |= ACTION_CONFIRM;
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'enter') confirm();
    else if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    else if (key === 'm') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      inside: true,
    };
  }

  function onPointerDown(event) {
    onPointerMove(event);
    confirm();
  }

  function onPointerLeave() {
    mouse.inside = false;
  }

  function onBlur() {
    keys = new Set();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('blur', onBlur);

  return {
    /** The actions pressed since the last call, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The keyboard direction as {x, y}, each -1, 0 or 1. */
    direction() {
      const x = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      const y = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
      return { x, y };
    },
    /** The mouse position in canvas pixels, or null when it never entered. */
    mouse() {
      return mouse.inside ? mouse : null;
    },
  };
}
