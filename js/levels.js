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

/** Scenery themes: urban | tropical | snow | forest | underground */
const URBAN_BG = {
  scenery: "urban",
  skyTop: "#6aa8e0",
  skyBot: "#d4eaf8",
  horizon: "#b8d4e8",
  accent: "#f0a020",
  secondary: "#4aa8d8",
  sun: true,
  clouds: true,
  farColor: "#9bb4c8",
  midColor: "#7a96b0",
};

const TROPICAL_BG = {
  scenery: "tropical",
  skyTop: "#4ec4e8",
  skyBot: "#c8f0e8",
  horizon: "#7ed4c0",
  accent: "#ffcc33",
  secondary: "#2ecc71",
  sun: true,
  clouds: true,
  farColor: "#3a9a6a",
  midColor: "#2d7a52",
  water: true,
};

const SNOW_BG = {
  scenery: "snow",
  skyTop: "#c5d8ec",
  skyBot: "#eef4fa",
  horizon: "#dce6f0",
  accent: "#a0c4e8",
  secondary: "#ffffff",
  sun: true,
  clouds: true,
  farColor: "#b8c8d8",
  midColor: "#d0dce8",
  snow: true,
};

const FOREST_BG = {
  scenery: "forest",
  skyTop: "#6eb0d0",
  skyBot: "#c5e0c8",
  horizon: "#8fbc8f",
  accent: "#d4a017",
  secondary: "#3d8b5f",
  sun: true,
  clouds: true,
  farColor: "#3a6b4a",
  midColor: "#2d5538",
  mist: true,
};

const UNDERGROUND_BG = {
  scenery: "underground",
  skyTop: "#1a1428",
  skyBot: "#2a2038",
  horizon: "#1e1830",
  accent: "#39ff9a",
  secondary: "#7b5cff",
  sun: false,
  clouds: false,
  stars: false,
  farColor: "#15101f",
  midColor: "#221a32",
  crystals: true,
  pipes: true,
  fog: true,
};

export const LEVELS = [
  // ─────────────────────────────────────────────────────
  // 1 — Tutorial-friendly: continuous ground, few grunts
  // ─────────────────────────────────────────────────────
  {
    id: 1,
    code: "01",
    name: "NEON AVENUE",
    desc: "Urban warm-up. Clear the street patrol under glass towers.",
    width: 2800,
    height: 540,
    theme: "urban",
    playerStart: { x: 80, y: 360 },
    gravity: 1800,
    bg: URBAN_BG,
    platforms: [
      solid(0, 480, 900, 80, "street"),
      solid(1000, 480, 1800, 80, "street"),
      lava(900, 520, 100, 40),
      platform(300, 400, 180, "neon"),
      platform(700, 400, 160, "neon"),
      ...easyStairs(1400, 400, 2, 160, 50, 40, "neon"),
      solid(1750, 300, 200, 18, "metal"),
      platform(2300, 400, 200, "neon"),
    ],
    enemies: [
      { type: "grunt", x: 450, y: 420 },
      { type: "grunt", x: 750, y: 420 },
      { type: "hopper", x: 1100, y: 420 },
      { type: "grunt", x: 1300, y: 420 },
      { type: "rusher", x: 1550, y: 420 },
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
    name: "PALM DOCKS",
    desc: "Tropical pier run. Rifle guards under the palms — watch the gaps.",
    width: 3400,
    height: 540,
    theme: "tropical",
    playerStart: { x: 80, y: 360 },
    gravity: 1800,
    bg: TROPICAL_BG,
    platforms: [
      solid(0, 480, 600, 80, "sand"),
      solid(720, 480, 500, 80, "sand"),
      solid(1360, 480, 700, 80, "sand"),
      solid(2200, 480, 1200, 80, "sand"),

      lava(600, 520, 120, 40),
      lava(1220, 520, 140, 40),
      lava(2060, 520, 140, 40),

      // Wide low platforms
      platform(200, 400, 180),
      platform(900, 400, 200),
      // Gentle climb
      ...easyStairs(1500, 400, 3, 150, 50, 35, "wood"),
      solid(2050, 250, 220, 18, "wood"),
      platform(2400, 400, 180),
      platform(2700, 380, 160),
    ],
    enemies: [
      { type: "grunt", x: 400, y: 420 },
      { type: "rusher", x: 700, y: 420 },
      { type: "shooter", x: 1000, y: 420 },
      { type: "bomber", x: 1300, y: 420 },
      { type: "grunt", x: 1500, y: 420 },
      { type: "shooter", x: 1680, y: 300 },
      { type: "hopper", x: 1850, y: 420 },
      { type: "drone", x: 2000, y: 200 },
      { type: "shooter", x: 2100, y: 200 },
      { type: "shield", x: 2400, y: 420 },
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
    name: "FROST SPIRES",
    desc: "Snowbound rooftops. Snipers and ice ledges — stay frosty.",
    width: 3800,
    height: 540,
    theme: "snow",
    playerStart: { x: 80, y: 360 },
    gravity: 1750,
    bg: SNOW_BG,
    platforms: [
      solid(0, 480, 500, 80, "ice"),
      solid(640, 480, 450, 80, "ice"),
      solid(1220, 480, 550, 80, "ice"),
      solid(1920, 480, 500, 80, "ice"),
      solid(2560, 480, 1240, 80, "ice"),

      lava(500, 520, 140, 40),
      lava(1090, 520, 130, 40),
      lava(1770, 520, 150, 40),
      lava(2420, 520, 140, 40),
      spikes(1450, 462, 70),

      platform(150, 400, 160),
      ...easyStairs(700, 400, 3, 155, 52, 30),
      solid(1250, 250, 180, 18, "ice"),
      platform(1550, 400, 180),
      ...easyStairs(2000, 400, 3, 150, 50, 30),
      solid(2520, 250, 200, 18, "ice"),
      platform(2900, 400, 180),
      platform(3200, 380, 160),
    ],
    enemies: [
      { type: "grunt", x: 350, y: 420 },
      { type: "rusher", x: 600, y: 420 },
      { type: "shooter", x: 800, y: 420 },
      { type: "sniper", x: 950, y: 420 },
      { type: "turret", x: 1280, y: 218 },
      { type: "shield", x: 1400, y: 420 },
      { type: "bomber", x: 1650, y: 420 },
      { type: "drone", x: 1900, y: 180 },
      { type: "shooter", x: 2100, y: 300 },
      { type: "heavy", x: 2200, y: 420 },
      { type: "turret", x: 2550, y: 218 },
      { type: "hopper", x: 2700, y: 420 },
      { type: "shooter", x: 2750, y: 420 },
      { type: "rusher", x: 3000, y: 420 },
      { type: "sniper", x: 3300, y: 320 },
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
    name: "EMERALD CANOPY",
    desc: "Deep forest combat. Hoppers in the undergrowth, heavies on the trail.",
    width: 4000,
    height: 540,
    theme: "forest",
    playerStart: { x: 80, y: 360 },
    gravity: 1820,
    bg: FOREST_BG,
    platforms: [
      solid(0, 480, 450, 80, "wood"),
      solid(580, 480, 400, 80, "wood"),
      solid(1120, 480, 480, 80, "wood"),
      solid(1760, 480, 420, 80, "wood"),
      solid(2340, 480, 400, 80, "wood"),
      solid(2900, 480, 1100, 80, "wood"),

      lava(450, 520, 130, 40),
      lava(980, 520, 140, 40),
      lava(1600, 520, 160, 40),
      lava(2180, 520, 160, 40),
      lava(2740, 520, 160, 40),
      spikes(1300, 462, 80),
      spikes(2500, 462, 90),

      platform(120, 400, 160, "moss"),
      ...easyStairs(620, 400, 3, 150, 52, 28, "moss"),
      solid(1180, 250, 200, 18, "moss"),
      platform(1500, 400, 170, "moss"),
      ...easyStairs(1850, 400, 3, 150, 52, 28, "moss"),
      solid(2400, 250, 200, 18, "moss"),
      platform(2650, 400, 160, "moss"),
      platform(3100, 400, 180, "moss"),
      platform(3400, 360, 160, "moss"),
    ],
    enemies: [
      { type: "rusher", x: 300, y: 420 },
      { type: "shooter", x: 700, y: 420 },
      { type: "shield", x: 850, y: 420 },
      { type: "turret", x: 1210, y: 218 },
      { type: "bomber", x: 1350, y: 420 },
      { type: "heavy", x: 1550, y: 420 },
      { type: "sniper", x: 1750, y: 420 },
      { type: "drone", x: 1850, y: 200 },
      { type: "shooter", x: 1900, y: 300 },
      { type: "hopper", x: 2000, y: 420 },
      { type: "turret", x: 2430, y: 218 },
      { type: "shield", x: 2550, y: 420 },
      { type: "rusher", x: 2750, y: 420 },
      { type: "bomber", x: 3000, y: 420 },
      { type: "turret", x: 3120, y: 368 },
      { type: "heavy", x: 3350, y: 420 },
      { type: "sniper", x: 3500, y: 420 },
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
    name: "ABYSS CORE",
    desc: "Underground reactor labyrinth. Crystals, pipes, and the Sentinel.",
    width: 4200,
    height: 540,
    theme: "underground",
    playerStart: { x: 80, y: 360 },
    gravity: 1850,
    bg: UNDERGROUND_BG,
    platforms: [
      solid(0, 480, 400, 80, "cave"),
      solid(540, 480, 380, 80, "cave"),
      solid(1060, 480, 420, 80, "cave"),
      solid(1640, 480, 400, 80, "cave"),
      solid(2200, 480, 380, 80, "cave"),
      solid(2740, 480, 1460, 80, "cave"),

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
      { type: "rusher", x: 280, y: 420 },
      { type: "shield", x: 550, y: 420 },
      { type: "shooter", x: 650, y: 420 },
      { type: "bomber", x: 800, y: 420 },
      { type: "turret", x: 1150, y: 218 },
      { type: "heavy", x: 1250, y: 420 },
      { type: "sniper", x: 1400, y: 420 },
      { type: "drone", x: 1500, y: 180 },
      { type: "hopper", x: 1550, y: 420 },
      { type: "turret", x: 1800, y: 300 },
      { type: "shield", x: 1950, y: 420 },
      { type: "rusher", x: 2100, y: 420 },
      { type: "turret", x: 2310, y: 218 },
      { type: "bomber", x: 2500, y: 420 },
      { type: "heavy", x: 2700, y: 420 },
      { type: "sniper", x: 2900, y: 420 },
      { type: "drone", x: 3100, y: 200 },
      { type: "turret", x: 3330, y: 328 },
      { type: "heavy", x: 3450, y: 420 },
      { type: "rusher", x: 3600, y: 420 },
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

const THEME_PLATFORM = {
  urban: "neon",
  tropical: "wood",
  snow: "snow",
  forest: "moss",
  underground: "tech",
};

const THEME_SOLID = {
  urban: "street",
  tropical: "sand",
  snow: "ice",
  forest: "dirt",
  underground: "cave",
};

/** Return a shallow-cloned level with platform styles fitted to scenery theme. */
export function getLevel(index) {
  const src = LEVELS[index];
  if (!src) return null;
  const theme = src.theme || src.bg?.scenery || "urban";
  const platDef = THEME_PLATFORM[theme] || "neon";
  const solidDef = THEME_SOLID[theme] || "street";
  const platforms = src.platforms.map((p) => {
    if (p.hazard) return { ...p };
    let style = p.style || (p.oneWay ? platDef : solidDef);
    // remap generic urban styles to biome
    if (style === "neon") style = platDef;
    if (style === "metal") style = theme === "underground" ? "cave" : solidDef;
    if (style === "street" && theme !== "urban") style = solidDef;
    if (style === "tech" && theme === "forest") style = "moss";
    return { ...p, style };
  });
  return { ...src, platforms };
}

