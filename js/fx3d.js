/**
 * Optional pseudo-3D / 2.5D presentation for NEON STRIKE.
 *
 * Toggle with ENABLE_3D (or ?flat=1 / localStorage neon-strike-3d=0).
 * Revert entire feature: git revert <this commit> or set ENABLE_3D = false.
 */

/** Master switch — set false to disable all 3D helpers instantly */
export let ENABLE_3D = true;

const LS_KEY = "neon-strike-3d";

/** Call once at boot to honor URL / localStorage preferences */
export function init3DPreference() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("flat") === "1" || params.get("3d") === "0") {
      ENABLE_3D = false;
      return ENABLE_3D;
    }
    if (params.get("3d") === "1") {
      ENABLE_3D = true;
      return ENABLE_3D;
    }
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "0") ENABLE_3D = false;
    if (stored === "1") ENABLE_3D = true;
  } catch {
    /* ignore */
  }
  return ENABLE_3D;
}

export function set3DEnabled(on) {
  ENABLE_3D = !!on;
  try {
    localStorage.setItem(LS_KEY, ENABLE_3D ? "1" : "0");
  } catch {
    /* ignore */
  }
  sync3DClass();
  return ENABLE_3D;
}

export function sync3DClass() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("fx3d", ENABLE_3D);
  document.documentElement.classList.toggle("fx3d-off", !ENABLE_3D);
}

/** Depth vector — light from upper-left, extruded down-right */
const DEPTH = { x: 10, y: 7 };

function shadeRgb(hex, amt) {
  const n = (hex || "#888").replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
  let b = (num & 0xff) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw a box extrusion behind a 2D rect (platform/entity base).
 * Call BEFORE the flat top face so the top paints over the join.
 */
export function drawExtrusion(ctx, x, y, w, h, opts = {}) {
  if (!ENABLE_3D) return;
  const dx = opts.dx ?? DEPTH.x;
  const dy = opts.dy ?? DEPTH.y;
  const top = opts.topColor || "#8a94a8";
  const side = opts.sideColor || shadeRgb(typeof top === "string" && top.startsWith("#") ? top : "#5a6478", -0.25);
  const front = opts.frontColor || shadeRgb(typeof top === "string" && top.startsWith("#") ? top : "#5a6478", -0.4);

  ctx.save();
  // right face
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + dx, y + dy);
  ctx.lineTo(x + w + dx, y + h + dy);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  // bottom face
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w + dx, y + h + dy);
  ctx.lineTo(x + dx, y + h + dy);
  ctx.closePath();
  ctx.fill();
  // soft depth edge
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + dx, y + dy);
  ctx.lineTo(x + w + dx, y + h + dy);
  ctx.lineTo(x + dx, y + h + dy);
  ctx.lineTo(x, y + h);
  ctx.stroke();
  ctx.restore();
}

/** Perspective ground grid vanishing into horizon (subtle). */
export function drawPerspectiveGround(ctx, W, H, camX, theme = "urban") {
  if (!ENABLE_3D) return;
  const horizon = H * 0.58;
  const colors = {
    urban: "rgba(40, 60, 80, 0.12)",
    tropical: "rgba(20, 100, 120, 0.1)",
    snow: "rgba(100, 130, 160, 0.1)",
    forest: "rgba(30, 70, 40, 0.12)",
    underground: "rgba(100, 60, 180, 0.1)",
  };
  ctx.save();
  ctx.strokeStyle = colors[theme] || colors.urban;
  ctx.lineWidth = 1;
  // vanishing point
  const vpx = W * 0.5 - (camX % 80) * 0.15;
  const vpy = horizon;
  // horizontal lines
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const y = horizon + (H - horizon) * (t * t);
    ctx.globalAlpha = 0.15 + t * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // rays
  for (let i = -6; i <= 6; i++) {
    const x0 = vpx + i * 50;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(vpx, vpy);
    ctx.lineTo(x0 + i * 80, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Drop-shadow "standing on volume" for actors */
export function drawContactBlob(ctx, x, y, w, h, strength = 1) {
  if (!ENABLE_3D) return;
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h + 2;
  const g = ctx.createRadialGradient(cx, cy, 1, cx + 4, cy + 3, w * 0.55);
  g.addColorStop(0, `rgba(20, 30, 40, ${0.35 * strength})`);
  g.addColorStop(1, "rgba(20, 30, 40, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 2, w * 0.42, 5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Map platform style → extrusion colors */
export function extrusionColorsForStyle(style) {
  const map = {
    street: { top: "#6b7588", side: "#4a5366", front: "#3a4255" },
    metal: { top: "#8a94a8", side: "#5a6478", front: "#3a4458" },
    neon: { top: "#5a8aaa", side: "#3a6a88", front: "#2a4a68" },
    ice: { top: "#c5daf0", side: "#8aa8c8", front: "#6a88a8" },
    snow: { top: "#e8f4ff", side: "#b0c8e0", front: "#90a8c0" },
    wood: { top: "#c4a06a", side: "#8b6914", front: "#5a4010" },
    sand: { top: "#f0e0a8", side: "#c4a060", front: "#a08040" },
    dirt: { top: "#8b6b45", side: "#5a4028", front: "#3a2818" },
    moss: { top: "#5a9a5a", side: "#3a6a3a", front: "#2a4a2a" },
    cave: { top: "#4a4060", side: "#2a2040", front: "#1a1028" },
    tech: { top: "#6a9a82", side: "#3a6a52", front: "#2a4a38" },
    lava: { top: "#ff6a1a", side: "#c02030", front: "#801018" },
  };
  return map[style] || map.metal;
}

/**
 * Billboards a layer with slight Y-scale foreshortening for "depth".
 * scaleY < 1 compresses toward horizon.
 */
export function withDepthLayer(ctx, camX, parallax, scaleY, drawFn) {
  if (!ENABLE_3D) {
    drawFn(ctx);
    return;
  }
  ctx.save();
  ctx.translate(0, (1 - scaleY) * 40);
  ctx.scale(1, scaleY);
  // subtle horizontal drift already handled by caller via cam
  drawFn(ctx);
  ctx.restore();
}
