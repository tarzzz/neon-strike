/**
 * Level definitions for NEON STRIKE
 * Difficulty ramps 1 → 5. No flying enemies.
 * Platforms stay wide; "stairs" use gentle steps (easy single jumps).
 *
 * Platforms: {x,y,w,h, oneWay?, hazard?, style?}
 */

function solid(x, y, w, h, style = "metal") {
  return { x, y, w, h, style, oneWay: false, hazard: false };
}
function platform(x, y, w, style = "neon") {
  return { x, y, w, h: 16, style, oneWay: true, hazard: false };
}
function lava(x, y, w, h = 40) {
  return { x, y, w, h, style: "lava", oneWay: false, hazard: true };
}
function spikes(x, y, w) {
  return { x, y, w, h: 18, style: "spikes", oneWay: false, hazard: true };
}

/** Wide, gentle stair — each step is an easy single jump. */
function easyStairs(startX, baseY, steps, stepW = 150, rise = 55, gap = 30, style = "neon") {
  const out = [];
  for (let i = 0; i < steps; i++) {
    out.push(platform(startX + i * (stepW + gap), baseY - i * rise, stepW, style));
  }
  return out;
}

const CITY_BG = {
  skyTop: "#7eb6e8",
  skyBot: "#d6ebfa",
  accent: "#e8a020",
  secondary: "#4aa8d8",
  buildings: true,
  stars: false,
  daytime: true,
  clouds: true,
};

const REACTOR_BG = {
  skyTop: "#8ec9b8",
  skyBot: "#d8efe6",
  accent: "#2a9a6a",
  secondary: "#4aa8d8",
  buildings: false,
  stars: false,
  pipes: true,
  daytime: true,
  clouds: true,
};

const DOCK_BG = {
  skyTop: "#6eb4d6",
  skyBot: "#c5e4f2",
  accent: "#e8a020",
  secondary: "#3d9ec9",
  buildings: true,
  stars: false,
  daytime: true,
  clouds: true,
};

export const LEVELS = [
  // ─────────────────────────────────────────────────────
  // 1 — Tutorial-friendly: continuous ground, few grunts
  // ─────────────────────────────────────────────────────
  {
    id: 1,
    code: "01",
    name: "ROOKIE STRIP",
    desc: "Warm-up run. Clear the street patrol and smash the light APC.",
    width: 2800,
    height: 540,
    theme: "city",
    playerStart: { x: 80, y: 360 },
    gravity: 1800,
    bg: CITY_BG,
    platforms: [
      // Almost continuous ground — one easy gap
      solid(0, 480, 900, 80, "street"),
      solid(1000, 480, 1800, 80, "street"),
      lava(900, 520, 100, 40),

      // Optional low ledges (not required)
      platform(300, 400, 180),
      platform(700, 400, 160),
      // Gentle 2-step stair to a pickup ledge
      ...easyStairs(1400, 400, 2, 160, 50, 40),
      solid(1750, 300, 200, 18, "metal"),

      // Boss arena — open floor + one cover ledge
      platform(2300, 400, 200),
    ],
    enemies: [
      { type: "grunt", x: 450, y: 420 },
      { type: "grunt", x: 750, y: 420 },
      { type: "grunt", x: 1300, y: 420 },
      { type: "grunt", x: 1700, y: 420 },
      { type: "shooter", x: 1760, y: 250 },
    ],
    pickups: [
      { type: "health", x: 320, y: 360 },
      { type: "rapid", x: 1780, y: 260 },
      { type: "shotgun", x: 1900, y: 420 },
      { type: "bazooka", x: 2000, y: 420 },
      { type: "energy", x: 2100, y: 420 },
    ],
    boss: {
      type: "apc",
      x: 2550,
      y: 360,
      triggerX: 2150,
      name: "APC-01 'TRAINING HULK'",
      hp: 28,
      speed: 80,
    },
    checkpoints: [0, 1200],
  },

  // ─────────────────────────────────────────────────────
  // 2 — Shooters introduced, small gaps, simple stairs
  // ─────────────────────────────────────────────────────
  {
    id: 2,
    code: "02",
    name: "DOCKYARD",
    desc: "Pier guards with rifles. Mind the gaps — stairs are still friendly.",
    width: 3400,
    height: 540,
    theme: "city",
    playerStart: { x: 80, y: 360 },
    gravity: 1800,
    bg: DOCK_BG,
    platforms: [
      solid(0, 480, 600, 80, "street"),
      solid(720, 480, 500, 80, "street"),
      solid(1360, 480, 700, 80, "street"),
      solid(2200, 480, 1200, 80, "street"),

      lava(600, 520, 120, 40),
      lava(1220, 520, 140, 40),
      lava(2060, 520, 140, 40),

      // Wide low platforms
      platform(200, 400, 180),
      platform(900, 400, 200),
      // Gentle climb
      ...easyStairs(1500, 400, 3, 150, 50, 35),
      solid(2050, 250, 220, 18, "metal"),
      platform(2400, 400, 180),
      platform(2700, 380, 160),
    ],
    enemies: [
      { type: "grunt", x: 400, y: 420 },
      { type: "grunt", x: 850, y: 420 },
      { type: "shooter", x: 1000, y: 420 },
      { type: "grunt", x: 1500, y: 420 },
      { type: "shooter", x: 1680, y: 300 },
      { type: "grunt", x: 1900, y: 420 },
      { type: "shooter", x: 2100, y: 200 },
      { type: "grunt", x: 2500, y: 420 },
      { type: "shooter", x: 2800, y: 420 },
    ],
    pickups: [
      { type: "health", x: 220, y: 360 },
      { type: "rapid", x: 920, y: 360 },
      { type: "spread", x: 2080, y: 210 },
      { type: "laser", x: 2200, y: 420 },
      { type: "bazooka", x: 2300, y: 420 },
      { type: "rail", x: 2550, y: 420 },
      { type: "energy", x: 2420, y: 360 },
      { type: "health", x: 3000, y: 420 },
    ],
    boss: {
      type: "apc",
      x: 3100,
      y: 360,
      triggerX: 2700,
      name: "APC-04 'DOCK BREAKER'",
      hp: 40,
      speed: 95,
    },
    checkpoints: [0, 1400, 2400],
  },

  // ─────────────────────────────────────────────────────
  // 3 — Turrets + denser ground troops
  // ─────────────────────────────────────────────────────
  {
    id: 3,
    code: "03",
    name: "NEON SKYLINE",
    desc: "Rooftop patrols and fixed guns. Use the wide stairs for cover.",
    width: 3800,
    height: 540,
    theme: "city",
    playerStart: { x: 80, y: 360 },
    gravity: 1800,
    bg: CITY_BG,
    platforms: [
      solid(0, 480, 500, 80, "street"),
      solid(640, 480, 450, 80, "street"),
      solid(1220, 480, 550, 80, "street"),
      solid(1920, 480, 500, 80, "street"),
      solid(2560, 480, 1240, 80, "street"),

      lava(500, 520, 140, 40),
      lava(1090, 520, 130, 40),
      lava(1770, 520, 150, 40),
      lava(2420, 520, 140, 40),
      spikes(1450, 462, 70),

      platform(150, 400, 160),
      ...easyStairs(700, 400, 3, 155, 52, 30),
      solid(1250, 250, 180, 18, "metal"),
      platform(1550, 400, 180),
      ...easyStairs(2000, 400, 3, 150, 50, 30),
      solid(2520, 250, 200, 18, "metal"),
      platform(2900, 400, 180),
      platform(3200, 380, 160),
    ],
    enemies: [
      { type: "grunt", x: 350, y: 420 },
      { type: "shooter", x: 800, y: 420 },
      { type: "grunt", x: 950, y: 420 },
      { type: "turret", x: 1280, y: 218 },
      { type: "shooter", x: 1400, y: 420 },
      { type: "grunt", x: 1650, y: 420 },
      { type: "shooter", x: 2100, y: 300 },
      { type: "grunt", x: 2200, y: 420 },
      { type: "turret", x: 2550, y: 218 },
      { type: "shooter", x: 2750, y: 420 },
      { type: "grunt", x: 3000, y: 420 },
      { type: "shooter", x: 3300, y: 320 },
    ],
    pickups: [
      { type: "health", x: 160, y: 360 },
      { type: "rapid", x: 900, y: 300 },
      { type: "energy", x: 1270, y: 210 },
      { type: "spread", x: 2540, y: 210 },
      { type: "plasma", x: 2600, y: 420 },
      { type: "bazooka", x: 2700, y: 420 },
      { type: "rail", x: 2800, y: 420 },
      { type: "health", x: 2920, y: 360 },
      { type: "energy", x: 3400, y: 420 },
    ],
    boss: {
      type: "apc",
      x: 3550,
      y: 360,
      triggerX: 3100,
      name: "APC-09 'STREET REAPER'",
      hp: 52,
      speed: 110,
    },
    checkpoints: [0, 1300, 2500],
  },

  // ─────────────────────────────────────────────────────
  // 4 — Reactor approach: more hazards, mixed enemies
  // ─────────────────────────────────────────────────────
  {
    id: 4,
    code: "04",
    name: "REACTOR APPROACH",
    desc: "Hot floors and gun nests. Stairs stay wide — pressure does not.",
    width: 4000,
    height: 540,
    theme: "reactor",
    playerStart: { x: 80, y: 360 },
    gravity: 1820,
    bg: REACTOR_BG,
    platforms: [
      solid(0, 480, 450, 80, "metal"),
      solid(580, 480, 400, 80, "metal"),
      solid(1120, 480, 480, 80, "metal"),
      solid(1760, 480, 420, 80, "metal"),
      solid(2340, 480, 400, 80, "metal"),
      solid(2900, 480, 1100, 80, "metal"),

      lava(450, 520, 130, 40),
      lava(980, 520, 140, 40),
      lava(1600, 520, 160, 40),
      lava(2180, 520, 160, 40),
      lava(2740, 520, 160, 40),
      spikes(1300, 462, 80),
      spikes(2500, 462, 90),

      platform(120, 400, 160, "tech"),
      ...easyStairs(620, 400, 3, 150, 52, 28, "tech"),
      solid(1180, 250, 200, 18, "tech"),
      platform(1500, 400, 170, "tech"),
      ...easyStairs(1850, 400, 3, 150, 52, 28, "tech"),
      solid(2400, 250, 200, 18, "tech"),
      platform(2650, 400, 160, "tech"),
      platform(3100, 400, 180, "tech"),
      platform(3400, 360, 160, "tech"),
    ],
    enemies: [
      { type: "grunt", x: 300, y: 420 },
      { type: "shooter", x: 700, y: 420 },
      { type: "grunt", x: 850, y: 420 },
      { type: "turret", x: 1210, y: 218 },
      { type: "shooter", x: 1350, y: 420 },
      { type: "grunt", x: 1550, y: 420 },
      { type: "shooter", x: 1900, y: 300 },
      { type: "grunt", x: 2000, y: 420 },
      { type: "turret", x: 2430, y: 218 },
      { type: "shooter", x: 2550, y: 420 },
      { type: "grunt", x: 2750, y: 420 },
      { type: "shooter", x: 3000, y: 420 },
      { type: "turret", x: 3120, y: 368 },
      { type: "shooter", x: 3350, y: 420 },
      { type: "grunt", x: 3550, y: 420 },
    ],
    pickups: [
      { type: "rapid", x: 140, y: 360 },
      { type: "health", x: 800, y: 300 },
      { type: "spread", x: 1200, y: 210 },
      { type: "shotgun", x: 1400, y: 360 },
      { type: "energy", x: 1520, y: 360 },
      { type: "laser", x: 2000, y: 420 },
      { type: "health", x: 2420, y: 210 },
      { type: "plasma", x: 2550, y: 360 },
      { type: "bazooka", x: 2700, y: 360 },
      { type: "rail", x: 2900, y: 420 },
      { type: "tankbuster", x: 3050, y: 360 },
      { type: "rapid", x: 3120, y: 360 },
      { type: "energy", x: 3450, y: 320 },
    ],
    boss: {
      type: "apc",
      x: 3750,
      y: 360,
      triggerX: 3300,
      name: "APC-X 'MAGMA TREAD'",
      hp: 64,
      speed: 120,
    },
    checkpoints: [0, 1200, 2400, 3200],
  },

  // ─────────────────────────────────────────────────────
  // 5 — Final: densest combat + Sentinel boss
  // ─────────────────────────────────────────────────────
  {
    id: 5,
    code: "05",
    name: "SENTINEL CORE",
    desc: "End of the line. Overwhelm the defense grid, then the Core.",
    width: 4200,
    height: 540,
    theme: "reactor",
    playerStart: { x: 80, y: 360 },
    gravity: 1850,
    bg: REACTOR_BG,
    platforms: [
      solid(0, 480, 400, 80, "metal"),
      solid(540, 480, 380, 80, "metal"),
      solid(1060, 480, 420, 80, "metal"),
      solid(1640, 480, 400, 80, "metal"),
      solid(2200, 480, 380, 80, "metal"),
      solid(2740, 480, 1460, 80, "metal"),

      lava(400, 520, 140, 40),
      lava(920, 520, 140, 40),
      lava(1480, 520, 160, 40),
      lava(2040, 520, 160, 40),
      lava(2580, 520, 160, 40),
      spikes(1200, 462, 90),
      spikes(1900, 462, 80),
      spikes(2450, 462, 90),

      platform(100, 400, 150, "tech"),
      ...easyStairs(580, 400, 3, 148, 52, 26, "tech"),
      solid(1120, 250, 200, 18, "tech"),
      platform(1450, 400, 160, "tech"),
      ...easyStairs(1750, 400, 3, 148, 52, 26, "tech"),
      solid(2280, 250, 200, 18, "tech"),
      platform(2550, 400, 160, "tech"),

      // Boss arena — roomy cover ledges
      platform(3000, 400, 180, "tech"),
      platform(3300, 360, 180, "tech"),
      platform(3600, 400, 180, "tech"),
      solid(3150, 180, 36, 300, "tech"),
      solid(3550, 180, 36, 300, "tech"),
    ],
    enemies: [
      { type: "grunt", x: 280, y: 420 },
      { type: "shooter", x: 650, y: 420 },
      { type: "grunt", x: 800, y: 420 },
      { type: "turret", x: 1150, y: 218 },
      { type: "shooter", x: 1250, y: 420 },
      { type: "grunt", x: 1400, y: 420 },
      { type: "shooter", x: 1550, y: 420 },
      { type: "turret", x: 1800, y: 300 },
      { type: "grunt", x: 1950, y: 420 },
      { type: "shooter", x: 2100, y: 420 },
      { type: "turret", x: 2310, y: 218 },
      { type: "shooter", x: 2500, y: 420 },
      { type: "grunt", x: 2700, y: 420 },
      { type: "shooter", x: 2900, y: 420 },
      { type: "turret", x: 3330, y: 328 },
      { type: "shooter", x: 3450, y: 420 },
    ],
    pickups: [
      { type: "health", x: 120, y: 360 },
      { type: "rapid", x: 750, y: 300 },
      { type: "spread", x: 1140, y: 210 },
      { type: "shotgun", x: 1300, y: 420 },
      { type: "energy", x: 1470, y: 360 },
      { type: "laser", x: 1800, y: 300 },
      { type: "health", x: 2000, y: 300 },
      { type: "plasma", x: 2200, y: 420 },
      { type: "spread", x: 2300, y: 210 },
      { type: "bazooka", x: 2450, y: 420 },
      { type: "rapid", x: 2570, y: 360 },
      { type: "rail", x: 2800, y: 360 },
      { type: "energy", x: 3020, y: 360 },
      { type: "tankbuster", x: 3100, y: 360 },
      { type: "bazooka", x: 3200, y: 360 },
      { type: "health", x: 3620, y: 360 },
    ],
    boss: {
      type: "sentinel",
      x: 3900,
      y: 280,
      triggerX: 2950,
      name: "SENTINEL CORE Ω",
      hp: 70,
    },
    checkpoints: [0, 1100, 2200, 2900],
  },
];

export function getLevel(index) {
  return LEVELS[index] || null;
}
