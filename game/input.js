// Keyboard and gamepad input. Player 1 and player 2 each have a keyboard
// layout, and gamepad 1 / gamepad 2 feed the same players.

export const KEY_LAYOUTS = [
  {
    label: 'Player 1',
    keys: {
      left: ['KeyA'],
      right: ['KeyD'],
      up: ['KeyW'],
      down: ['KeyS'],
      jump: ['Space'],
      attack: ['KeyF'],
      special: ['KeyG'],
      shield: ['KeyH'],
    },
  },
  {
    label: 'Player 2',
    keys: {
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      jump: ['Numpad0'],
      attack: ['KeyK', 'Numpad1'],
      special: ['KeyL', 'Numpad2'],
      shield: ['Semicolon', 'Numpad3'],
    },
  },
];

// Human-readable key names for the controls screen.
export const KEY_NAMES = {
  KeyA: 'A', KeyD: 'D', KeyW: 'W', KeyS: 'S', Space: 'Space', KeyF: 'F', KeyG: 'G', KeyH: 'H',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Numpad0: 'Num 0',
  KeyK: 'K', KeyL: 'L', Semicolon: ';', Numpad1: 'Num 1', Numpad2: 'Num 2', Numpad3: 'Num 3',
};

const GAME_KEYS = new Set(KEY_LAYOUTS.flatMap((l) => Object.values(l.keys).flat()));
const DEADZONE = 0.45;
const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'shield'];

export function createInput(target = window) {
  const down = new Set();
  // Keys pressed since the last game frame, so a tap shorter than one frame
  // still registers.
  const tapped = new Set();
  const onDown = (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    down.add(e.code);
    if (!e.repeat) tapped.add(e.code);
  };
  const onUp = (e) => down.delete(e.code);
  const onBlur = () => {
    down.clear();
    tapped.clear();
  };
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  function keyboard(layoutIndex) {
    const layout = KEY_LAYOUTS[layoutIndex];
    const out = {};
    if (!layout) return out;
    for (const [action, codes] of Object.entries(layout.keys)) out[action] = codes.some((c) => down.has(c) || tapped.has(c));
    return out;
  }

  function gamepad(index) {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].filter(Boolean)[index];
    if (!pad) return null;
    const b = (i) => !!pad.buttons[i] && pad.buttons[i].pressed;
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    return {
      left: ax < -DEADZONE || b(14),
      right: ax > DEADZONE || b(15),
      up: ay < -DEADZONE || b(12),
      down: ay > DEADZONE || b(13),
      jump: b(0) || b(3),
      attack: b(2),
      special: b(1),
      shield: b(4) || b(5) || b(6) || b(7),
    };
  }

  // Input for human player number n: their keyboard layout (players 1 and 2
  // only) combined with the matching gamepad.
  function player(n) {
    const k = keyboard(n);
    const g = gamepad(n) || {};
    const out = {};
    for (const key of ACTIONS) out[key] = !!(k[key] || g[key]);
    return out;
  }

  // Call after each game frame has read its input.
  function endFrame() {
    tapped.clear();
  }

  function dispose() {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
  }

  return { player, endFrame, dispose };
}
