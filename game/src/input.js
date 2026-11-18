// input.js — keyboard + mouse. WASD/arrows move & drive, Shift run, E enter/exit car,
// F punch, mouse aim + click shoot, M mission, P/Esc pause, Enter confirm, H horn, N mute.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MISSION = 4;
export const ACTION_ENTER = 8;
export const ACTION_PUNCH = 16;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MISSION = new Set(['KeyM']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false, mouseClicked = false;
  let horn = false, mutePressed = false;

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (MISSION.has(event.code)) { if (!event.repeat) actions |= ACTION_MISSION; }
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (PUNCH.has(event.code)) { if (!event.repeat) actions |= ACTION_PUNCH; }
    else if (event.code === 'KeyH') horn = true;
    else if (event.code === 'KeyN') { if (!event.repeat) mutePressed = true; }
    keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (event.code === 'KeyH') horn = false;
  });
  window.addEventListener('blur', () => { keys.clear(); horn = false; });
  canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouseClicked = true; mouseX = e.clientX; mouseY = e.clientY; });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function axis(neg, pos) { return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0); }
  return {
    // On-foot movement vector (-1..1 each axis)
    moveX() { return axis('ArrowLeft', 'ArrowRight') || axis('KeyA', 'KeyD'); },
    moveY() { return axis('ArrowUp', 'ArrowDown') || axis('KeyW', 'KeyS'); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    // Driving: throttle -1..1, steer -1..1
    throttle() { return axis('ArrowDown', 'ArrowUp') || axis('KeyS', 'KeyW'); },
    steer() { return axis('ArrowLeft', 'ArrowRight') || axis('KeyA', 'KeyD'); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked }; },
    takeClick() { const c = mouseClicked; mouseClicked = false; return c; },
    takeMute() { const m = mutePressed; mutePressed = false; return m; },
    horn() { return horn; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
