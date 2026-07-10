/** Keyboard + mouse input */

const keys = new Set();
const pressed = new Set();
const released = new Set();

let mouse = { x: 0, y: 0, down: false, clicked: false };
let wheelDelta = 0;
let canvas = null;

const KEYMAP = {
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
  up: ["ArrowUp", "w", "W"],
  down: ["ArrowDown", "s", "S"],
  jump: [" ", "Space", "ArrowUp", "w", "W"],
  // J / Z / click = forward fire
  fire: ["j", "J", "z", "Z"],
  // E = diagonal up · X = diagonal down
  fireUp: ["e", "E"],
  fireDown: ["x", "X"],
  // special moved off X
  special: ["c", "C"],
  pause: ["p", "P", "Escape"],
  nextWeapon: ["k", "K", "]"],
  prevWeapon: ["q", "Q", "["],
};

export function initInput(canvasEl) {
  canvas = canvasEl;

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
    if (!keys.has(e.key)) pressed.add(e.key);
    keys.add(e.key);
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key);
    released.add(e.key);
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * sx;
    mouse.y = (e.clientY - rect.top) * sy;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouse.down = false;
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      wheelDelta += e.deltaY;
    },
    { passive: false }
  );

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function endFrameInput() {
  pressed.clear();
  released.clear();
  mouse.clicked = false;
  wheelDelta = 0;
}

export function consumeWheel() {
  const w = wheelDelta;
  wheelDelta = 0;
  return w;
}

export function isDown(action) {
  const list = KEYMAP[action] || [action];
  return list.some((k) => keys.has(k));
}

export function justPressed(action) {
  const list = KEYMAP[action] || [action];
  return list.some((k) => pressed.has(k));
}

export function justPressedKey(key) {
  return pressed.has(key);
}

export function anyKeyPressed() {
  return pressed.size > 0 || mouse.clicked;
}

export function getMouse() {
  return mouse;
}

export function isFiring() {
  return isDown("fire") || mouse.down;
}

/** Any fire input including diagonal E / X */
export function isAnyFire() {
  return isFiring() || isDown("fireUp") || isDown("fireDown");
}

/**
 * Aim mode for shots:
 *   "up" | "down" | "forward"
 * E / fireUp wins over X when both held; E/X win over plain J.
 */
export function getFireAim() {
  if (isDown("fireUp")) return "up";
  if (isDown("fireDown")) return "down";
  return "forward";
}
