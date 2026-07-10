/**
 * Illustrated (non-pixel) drawing + sprite cache for NEON STRIKE.
 * Heavy path work is baked into offscreen canvases once; runtime is mostly drawImage.
 */

const cache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function cached(key, w, h, paint) {
  if (cache.has(key)) return cache.get(key);
  const { c, ctx } = makeCanvas(w, h);
  paint(ctx, w, h);
  cache.set(key, c);
  return c;
}

export function clearGfxCache() {
  cache.clear();
}

// ─── Primitives ─────────────────────────────────────────

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function limb(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function softCircle(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  // solid core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Player (illustrated) ───────────────────────────────

const FUN_POSES = ["wave", "flex", "dance", "spin", "look", "celebrate", "kick", "point"];

/**
 * pose: { anim, t, recoil, muzzleFlash, flip, fun, funT }
 * flip = radians of body somersault
 * fun  = optional flair animation name
 */
function paintCommando(ctx, W, H, pose, facing, weaponColor) {
  ctx.save();
  ctx.translate(W / 2, H);
  ctx.scale(facing, 1);

  const wc = weaponColor || "#2ec4ff";
  const t = pose.t || 0;
  const fun = pose.fun || null;
  const funT = pose.funT || 0;
  const flip = pose.flip || 0;
  const airborne = pose.anim === "jump" || pose.anim === "fall" || pose.anim === "flip";
  const prone = pose.anim === "prone" || pose.anim === "crawl";
  const run = pose.anim === "run";
  const crawl = pose.anim === "crawl";
  const phase = t * 14;
  const bob = run ? Math.abs(Math.sin(phase)) * 2.5 : Math.sin(t * 3) * 1;
  const recoil = (pose.recoil || 0) * 12;

  // soft ground contact shadow (not rotating)
  ctx.fillStyle = "rgba(20, 40, 60, 0.28)";
  ctx.beginPath();
  const shR = airborne ? 9 : prone ? 22 : 14;
  ctx.ellipse(0, -2, shR, airborne ? 3 : 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (prone) {
    paintProne(ctx, t, crawl, wc, recoil, pose);
    ctx.restore();
    return;
  }

  // Somersault: rotate whole body around mid-torso
  if (airborne && Math.abs(flip) > 0.01) {
    ctx.translate(0, -28);
    ctx.rotate(flip);
    ctx.translate(0, 28);
  }

  // Fun spin (grounded twirl)
  if (fun === "spin") {
    ctx.translate(0, -28);
    ctx.rotate(funT * 14);
    ctx.translate(0, 28);
  }

  // ── Limb targets ──
  const hipY = -18 + bob;
  let lx1 = -5, ly1 = hipY, lx2 = -6, ly2 = -3;
  let rx1 = 5, ry1 = hipY, rx2 = 6, ry2 = -3;
  let armBack = null; // [x2,y2]
  let armGun = null;
  let headOffX = 0;
  let gunHide = false;
  let torsoBob = bob;

  if (airborne) {
    // tucked somersault pose
    const tuck = 0.65 + Math.abs(Math.sin(flip * 2)) * 0.2;
    lx2 = -8 * tuck;
    ly2 = -12 - 4 * tuck;
    rx2 = 9 * tuck;
    ry2 = -11 - 3 * tuck;
    armBack = [-10, -28];
    armGun = [12, -22];
    gunHide = Math.abs(Math.sin(flip)) > 0.85; // flash hide mid-spin
  } else if (run) {
    const a = Math.sin(phase);
    const b = Math.sin(phase + Math.PI);
    lx2 = -4 + a * 11;
    ly2 = -3 + Math.max(0, -a) * 3;
    rx2 = 4 + b * 11;
    ry2 = -3 + Math.max(0, -b) * 3;
    armBack = [-12, -24 + bob + Math.sin(phase + Math.PI) * 7];
  } else if (fun === "wave") {
    // one arm waving overhead
    const wiggle = Math.sin(funT * 16) * 10;
    armBack = [-4 + wiggle * 0.2, -52 + Math.abs(wiggle) * 0.15];
    armGun = [14, -28];
    torsoBob = bob + Math.sin(funT * 8) * 1.5;
  } else if (fun === "flex") {
    armBack = [-14, -40];
    armGun = [14, -40];
    torsoBob = bob - 2;
    lx2 = -8;
    ly2 = -2;
    rx2 = 8;
    ry2 = -2;
  } else if (fun === "dance") {
    const d = Math.sin(funT * 12);
    torsoBob = bob + d * 3;
    lx2 = -6 + d * 6;
    ly2 = -2;
    rx2 = 6 - d * 6;
    ry2 = -2;
    armBack = [-12, -36 + d * 8];
    armGun = [12, -36 - d * 8];
  } else if (fun === "look") {
    headOffX = Math.sin(funT * 3) * 5;
    armGun = [12, -28];
  } else if (fun === "celebrate") {
    const c = Math.sin(funT * 14);
    armBack = [-8, -54 + c * 4];
    armGun = [8, -54 - c * 4];
    torsoBob = bob + Math.abs(c) * 2;
    lx2 = -4 + c * 3;
    rx2 = 4 - c * 3;
  } else if (fun === "kick") {
    const k = Math.min(1, funT * 6);
    rx2 = 6 + k * 16;
    ry2 = -8 - k * 6;
    lx2 = -8;
    ly2 = -2;
    armBack = [-10, -30];
    armGun = [10, -26];
  } else if (fun === "point") {
    armGun = [22, -36];
    armBack = [-8, -28];
    headOffX = 3;
  }

  // legs
  limb(ctx, lx1, ly1, lx2, ly2, 7, "#1a2a40");
  limb(ctx, rx1, ry1, rx2, ry2, 7, "#243550");
  ctx.fillStyle = "#0c1420";
  ctx.beginPath();
  ctx.ellipse(lx2, ly2 + 1, 5.5, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(rx2, ry2 + 1, 5.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // scarf
  if (run || airborne || fun === "dance" || fun === "celebrate" || fun === "spin") {
    const flap = Math.sin(t * 11 + flip * 2) * 4;
    const scarf = ctx.createLinearGradient(-6, -34, -22, -18);
    scarf.addColorStop(0, "#ff3db0");
    scarf.addColorStop(1, "rgba(200, 20, 120, 0.12)");
    ctx.fillStyle = scarf;
    ctx.beginPath();
    ctx.moveTo(-4, -32 + torsoBob);
    ctx.quadraticCurveTo(-18 - Math.abs(flip) * 2, -28 + flap, -22, -12 + flap);
    ctx.quadraticCurveTo(-12, -20, -3, -28 + torsoBob);
    ctx.fill();
  }

  // torso
  const torsoG = ctx.createLinearGradient(-12, -40, 12, -18);
  torsoG.addColorStop(0, "#1a4568");
  torsoG.addColorStop(0.45, fun === "flex" ? "#5ec0f0" : "#3d9fd4");
  torsoG.addColorStop(1, "#163a58");
  ctx.fillStyle = torsoG;
  roundRectPath(ctx, -11, -40 + torsoBob, 22, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#2a6088";
  ctx.beginPath();
  ctx.ellipse(-11, -34 + torsoBob, 5, 4, -0.3, 0, Math.PI * 2);
  ctx.ellipse(11, -34 + torsoBob, 5, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRectPath(ctx, -7, -37 + torsoBob, 8, 10, 3);
  ctx.fill();
  ctx.fillStyle = wc;
  ctx.shadowColor = wc;
  ctx.shadowBlur = 10;
  roundRectPath(ctx, -3.5, -32 + torsoBob, 7, 8, 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // back arm
  if (armBack) {
    limb(ctx, -6, -32 + torsoBob, armBack[0], armBack[1] + torsoBob * 0.3, 5, "#c9a08a");
    ctx.fillStyle = "#c9a08a";
    ctx.beginPath();
    ctx.arc(armBack[0], armBack[1] + torsoBob * 0.3, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (run) {
    const arm = Math.sin(phase + Math.PI) * 7;
    limb(ctx, -6, -32 + torsoBob, -12, -24 + torsoBob + arm, 5, "#c9a08a");
  }

  // head
  const headY = -48 + torsoBob;
  const skin = ctx.createRadialGradient(-2 + headOffX, headY - 3, 1, headOffX, headY, 10);
  skin.addColorStop(0, "#f5d7bc");
  skin.addColorStop(1, "#c48b6a");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(headOffX, headY, 9.5, 0, Math.PI * 2);
  ctx.fill();
  const helm = ctx.createLinearGradient(-9, headY - 10, 9, headY);
  helm.addColorStop(0, "#1a3048");
  helm.addColorStop(1, "#2a4a6a");
  ctx.fillStyle = helm;
  ctx.beginPath();
  ctx.arc(headOffX, headY - 1, 9.5, Math.PI * 1.05, -0.05);
  ctx.fill();
  const visor = ctx.createLinearGradient(-7, headY - 2, 7, headY + 2);
  visor.addColorStop(0, wc);
  visor.addColorStop(0.5, "#ffffff");
  visor.addColorStop(1, wc);
  ctx.fillStyle = visor;
  ctx.shadowColor = wc;
  ctx.shadowBlur = 8;
  roundRectPath(ctx, headOffX - 7, headY - 2, 14, 4, 1.5);
  ctx.fill();
  ctx.shadowBlur = 0;
  // smile spark when celebrating
  if (fun === "celebrate" || fun === "wave") {
    ctx.strokeStyle = "rgba(255,100,140,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(headOffX + 2, headY + 4, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  ctx.fillStyle = "#e91e8c";
  roundRectPath(ctx, headOffX - 8, headY - 9, 16, 3, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headOffX - 8, headY - 7);
  ctx.quadraticCurveTo(headOffX - 16, headY - 5 + Math.sin(t * 9 + flip) * 3, headOffX - 20, headY + 3);
  ctx.lineTo(headOffX - 8, headY - 5);
  ctx.fill();

  // gun arm (skip or tuck mid-somersault)
  if (!gunHide) {
    const gunY = armGun ? armGun[1] : -30 + torsoBob;
    const gunX = armGun ? armGun[0] : 14 - recoil * 0.2;
    limb(ctx, 6, -32 + torsoBob, gunX, gunY, 5.5, "#c9a08a");
    ctx.fillStyle = "#2a3a50";
    ctx.beginPath();
    ctx.arc(gunX, gunY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (fun !== "flex" && fun !== "celebrate" && fun !== "wave") {
      const gun = ctx.createLinearGradient(gunX - 2, gunY - 5, gunX + 20, gunY + 5);
      gun.addColorStop(0, "#2c3548");
      gun.addColorStop(0.5, "#5a6a80");
      gun.addColorStop(1, "#1e2838");
      ctx.fillStyle = gun;
      roundRectPath(ctx, gunX - 2 - (fun === "point" ? 0 : recoil), gunY - 4, fun === "point" ? 18 : 20, 8, 2);
      ctx.fill();
      ctx.fillStyle = wc;
      ctx.shadowColor = wc;
      ctx.shadowBlur = 6;
      ctx.fillRect(gunX + 14 - recoil, gunY - 2, 6, 4);
      ctx.shadowBlur = 0;
    }
    if (pose.muzzleFlash > 0 && !airborne) {
      const mf = Math.min(1, pose.muzzleFlash / 0.06);
      const mx = gunX + 20 - recoil;
      const mg = ctx.createRadialGradient(mx, gunY, 0, mx, gunY, 12 * mf);
      mg.addColorStop(0, "rgba(255,255,255,0.95)");
      mg.addColorStop(0.4, "rgba(255,220,100,0.7)");
      mg.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, gunY, 12 * mf, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // motion lines during fast flip
  if (airborne && Math.abs(pose.flipSpeed || 0) > 8) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = flip + i * 0.4;
      ctx.beginPath();
      ctx.arc(0, -28, 22 + i * 3, a, a + 0.5);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function paintProne(ctx, t, crawl, wc, recoil, pose) {
  const cyc = crawl ? Math.sin(t * 12) * 2.5 : 0;
  limb(ctx, -4, -8, -16 - cyc, -5, 6, "#1a2a40");
  limb(ctx, -4, -8, -14 + cyc, -4, 6, "#243550");
  ctx.fillStyle = "#0e1828";
  ctx.beginPath();
  ctx.ellipse(-18 - cyc, -3, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(-16 + cyc, -3, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createLinearGradient(-18, -14, 14, -2);
  body.addColorStop(0, "#1e4a72");
  body.addColorStop(0.5, "#3a8ec4");
  body.addColorStop(1, "#1a3d62");
  ctx.fillStyle = body;
  roundRectPath(ctx, -16, -14, 30, 12, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  roundRectPath(ctx, -12, -12, 12, 5, 2);
  ctx.fill();
  ctx.fillStyle = wc;
  ctx.shadowColor = wc;
  ctx.shadowBlur = 8;
  ctx.fillRect(-2, -10, 8, 4);
  ctx.shadowBlur = 0;
  const hx = 12, hy = -10;
  const skin = ctx.createRadialGradient(hx - 2, hy - 2, 1, hx, hy, 8);
  skin.addColorStop(0, "#f2d2b6");
  skin.addColorStop(1, "#c99578");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a2c44";
  ctx.beginPath();
  ctx.arc(hx, hy - 1, 7.5, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.fillStyle = wc;
  ctx.shadowColor = wc;
  ctx.shadowBlur = 6;
  roundRectPath(ctx, hx - 5, hy - 2, 11, 3, 1);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#e91e8c";
  roundRectPath(ctx, hx - 6, hy - 7, 12, 2.5, 1);
  ctx.fill();
  ctx.fillStyle = "#2a3344";
  roundRectPath(ctx, 8 - recoil, -7, 24, 5, 2);
  ctx.fill();
  ctx.fillStyle = wc;
  ctx.fillRect(28 - recoil, -6, 5, 3);
  if (pose.muzzleFlash > 0) {
    const mf = pose.muzzleFlash / 0.06;
    ctx.fillStyle = `rgba(255,255,220,${mf})`;
    ctx.beginPath();
    ctx.arc(34 - recoil, -4.5, 6 * mf, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawPlayer(ctx, x, y, w, h, facing, anim, animT, fx = {}) {
  drawPlayerLive(ctx, x, y, w, h, facing, anim, animT, fx);
}

/** Direct illustrated player draw (no offscreen — low latency). */
export function drawPlayerLive(ctx, x, y, w, h, facing, anim, animT, fx = {}) {
  const squash = fx.landSquash || 0;
  const feetX = x + w / 2;
  const feetY = y + h;
  ctx.save();
  ctx.translate(feetX, feetY);
  if (squash > 0) ctx.scale(1 + squash * 0.14, 1 - squash * 0.18);
  const dw = 80;
  const dh = 72;
  ctx.translate(-dw / 2, -dh + 2);
  paintCommando(
    ctx,
    dw,
    dh,
    {
      anim,
      t: animT,
      recoil: fx.recoil || 0,
      muzzleFlash: fx.muzzleFlash || 0,
      flip: fx.flip || 0,
      flipSpeed: fx.flipSpeed || 0,
      fun: fx.fun || null,
      funT: fx.funT || 0,
    },
    facing,
    fx.weaponColor || "#2ec4ff"
  );
  ctx.restore();
  if (fx.invuln) {
    ctx.save();
    ctx.globalAlpha = 0.12 + Math.sin(animT * 28) * 0.08;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.restore();
  }
}

// ─── Enemies ────────────────────────────────────────────

function paintGrunt(ctx, W, H, kind, facing, t, flash) {
  ctx.save();
  ctx.translate(W / 2, H);
  ctx.scale(facing, 1);
  const walk = kind === "grunt" ? t * 12 : t * 3;
  const bob = kind === "grunt" ? Math.abs(Math.sin(walk)) * 2 : Math.sin(t * 2) * 0.8;
  const swing = kind === "grunt" ? Math.sin(walk) * 8 : 0;

  ctx.fillStyle = "rgba(40,10,20,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, -1, 12, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  limb(ctx, -5, -16 + bob, -5 + swing, -2, 5.5, "#3a1520");
  limb(ctx, 5, -16 + bob, 5 - swing, -2, 5.5, "#4a1a28");
  ctx.fillStyle = "#1a080c";
  ctx.beginPath();
  ctx.ellipse(-5 + swing, -1, 4.5, 2.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5 - swing, -1, 4.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  const col = kind === "shooter" ? "#d47820" : "#d43b55";
  const body = ctx.createLinearGradient(-10, -36, 10, -14);
  body.addColorStop(0, flash ? "#fff" : shade(col, -0.25));
  body.addColorStop(0.5, flash ? "#fff" : col);
  body.addColorStop(1, flash ? "#eee" : shade(col, -0.35));
  ctx.fillStyle = body;
  roundRectPath(ctx, -10, -36 + bob, 20, 20, 5);
  ctx.fill();
  // straps
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(-8, -34 + bob, 3, 16);
  ctx.fillRect(5, -34 + bob, 3, 16);

  // head
  const skin = ctx.createRadialGradient(-1, -44 + bob, 1, 0, -42 + bob, 8);
  skin.addColorStop(0, "#e8c4b0");
  skin.addColorStop(1, "#a87860");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -42 + bob, 8, 0, Math.PI * 2);
  ctx.fill();
  // mask / eyes
  ctx.fillStyle = "#1a0508";
  roundRectPath(ctx, 0, -44 + bob, 7, 4, 1);
  ctx.fill();
  ctx.fillStyle = "#ff3040";
  ctx.shadowColor = "#ff3040";
  ctx.shadowBlur = 6;
  ctx.fillRect(3, -43 + bob, 3, 2);
  ctx.shadowBlur = 0;

  if (kind === "shooter") {
    const kick = Math.sin(t * 2) > 0.85 ? 3 : 0;
    const gun = ctx.createLinearGradient(6, 0, 24, 0);
    gun.addColorStop(0, "#333");
    gun.addColorStop(1, "#666");
    ctx.fillStyle = gun;
    roundRectPath(ctx, 6 - kick, -28 + bob, 16, 5, 1);
    ctx.fill();
    ctx.fillStyle = "#ff9f1a";
    ctx.fillRect(20 - kick, -27 + bob, 4, 3);
    if (kick) {
      ctx.fillStyle = "rgba(255,240,180,0.85)";
      ctx.beginPath();
      ctx.arc(26, -25.5 + bob, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    limb(ctx, 8, -30 + bob, 13, -22 + bob - swing * 0.3, 4, "#c09080");
  }
  ctx.restore();
}

function shade(hex, amt) {
  // crude hex shade
  const n = hex.replace("#", "");
  const num = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
  let b = (num & 0xff) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

function paintTurret(ctx, W, H, facing, t, flash) {
  ctx.save();
  // base
  const base = ctx.createLinearGradient(0, H * 0.5, 0, H);
  base.addColorStop(0, "#4a4a5a");
  base.addColorStop(1, "#2a2a35");
  ctx.fillStyle = base;
  roundRectPath(ctx, 4, H * 0.55, W - 8, H * 0.4, 3);
  ctx.fill();
  // dome
  const cx = W / 2;
  const cy = H * 0.42;
  const dome = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 14);
  dome.addColorStop(0, flash ? "#fff" : "#d0a0ff");
  dome.addColorStop(0.6, flash ? "#eee" : "#8b5cf6");
  dome.addColorStop(1, "#3b2060");
  ctx.fillStyle = dome;
  ctx.shadowColor = "#a78bfa";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // ring
  ctx.strokeStyle = "rgba(200,160,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 15, t * 3, t * 3 + 2);
  ctx.stroke();
  // barrel
  const br = 15;
  ctx.fillStyle = "#222";
  if (facing > 0) roundRectPath(ctx, cx + 6, cy - 3, br, 6, 2);
  else roundRectPath(ctx, cx - 6 - br, cy - 3, br, 6, 2);
  ctx.fill();
  // light
  ctx.fillStyle = Math.floor(t * 4) % 2 ? "#ff4050" : "#501018";
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawEnemyLive(ctx, x, y, e, time) {
  const flash = e.flash > 0;
  ctx.save();
  if (flash) ctx.globalAlpha = 0.7 + Math.sin(time * 40) * 0.3;

  if (e.type === "turret") {
    const dw = 40, dh = 36;
    ctx.translate(x + e.w / 2 - dw / 2, y + e.h - dh);
    paintTurret(ctx, dw, dh, e.facing, e.animT, flash);
    ctx.restore();
    return;
  }

  if (e.type === "drone") {
    paintDrone(ctx, x, y, e, time, flash);
    ctx.restore();
    return;
  }

  if (e.type === "sniper" && e.aiming && e.aimT > 0) {
    // telegraph laser toward standing torso height
    const feet = e.y + e.h; // not used
    const sx = x + e.w / 2 + e.facing * 12;
    const sy = y + e.h * 0.35;
    ctx.strokeStyle = `rgba(57,255,154,${0.35 + Math.sin(time * 30) * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + e.facing * 500, sy + e.facing * 0); // mostly horizontal; aim is baked at fire
    // better: draw long line in facing dir slightly down
    ctx.lineTo(sx + e.facing * 480, sy + 20);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const dw = e.type === "heavy" ? 56 : 50;
  const dh = e.type === "heavy" ? 60 : 54;
  ctx.translate(x + e.w / 2 - dw / 2, y + e.h - dh + 2);
  paintUnit(ctx, dw, dh, e, time, flash);
  ctx.restore();
}

function paintUnit(ctx, W, H, e, time, flash) {
  const kind = e.type;
  ctx.save();
  ctx.translate(W / 2, H);
  ctx.scale(e.facing, 1);
  const t = e.animT;
  const walk = (kind === "grunt" || kind === "rusher" || kind === "bomber" || kind === "shield" || kind === "heavy") ? t * (kind === "rusher" && e.charging ? 22 : 11) : t * 3;
  const bob = Math.abs(Math.sin(walk)) * (kind === "heavy" ? 1 : 2);
  const swing = Math.sin(walk) * (kind === "heavy" ? 5 : 8);

  // shadow
  ctx.fillStyle = "rgba(40,10,20,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, -1, kind === "heavy" ? 16 : 12, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // hopper squash/stretch
  let sy = 1, sx = 1;
  if (kind === "hopper") {
    if (!e.onGround) {
      sy = 1.15;
      sx = 0.88;
    } else {
      sy = 0.92 + Math.abs(Math.sin(t * 8)) * 0.05;
    }
  }
  ctx.scale(sx, sy);

  const hopY = kind === "hopper" && !e.onGround ? -4 : 0;

  // legs
  const legCol = kind === "heavy" ? "#2a3040" : "#3a1520";
  limb(ctx, -5, -16 + bob + hopY, -5 + swing * 0.6, -2 + hopY, kind === "heavy" ? 7 : 5.5, legCol);
  limb(ctx, 5, -16 + bob + hopY, 5 - swing * 0.6, -2 + hopY, kind === "heavy" ? 7 : 5.5, shade(legCol, 0.1));

  // body color by type
  const colors = {
    grunt: "#d43b55",
    shooter: "#d47820",
    heavy: "#6b7c93",
    rusher: "#ff6b35",
    bomber: "#c4a035",
    sniper: "#3d8b7a",
    shield: "#5b8def",
    hopper: "#9b59b6",
  };
  const col = colors[kind] || "#d43b55";
  const bw = kind === "heavy" ? 26 : 20;
  const bh = kind === "heavy" ? 24 : 20;
  const body = ctx.createLinearGradient(-bw / 2, -36, bw / 2, -14);
  body.addColorStop(0, flash ? "#fff" : shade(col, -0.25));
  body.addColorStop(0.5, flash ? "#fff" : col);
  body.addColorStop(1, flash ? "#eee" : shade(col, -0.35));
  ctx.fillStyle = body;
  roundRectPath(ctx, -bw / 2, -36 + bob + hopY, bw, bh, 5);
  ctx.fill();

  // type extras
  if (kind === "shield") {
    // frontal energy shield
    ctx.fillStyle = "rgba(100, 180, 255, 0.35)";
    ctx.strokeStyle = "rgba(120, 200, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(14, -26 + bob, 6, 16, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (kind === "heavy") {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    roundRectPath(ctx, -12, -34 + bob, 24, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#8899aa";
    ctx.fillRect(-8, -28 + bob, 16, 3);
  }
  if (kind === "rusher" && e.charging) {
    ctx.strokeStyle = "rgba(255,120,40,0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-18 - i * 6, -20 - i * 2);
      ctx.lineTo(-10 - i * 4, -20 - i * 2);
      ctx.stroke();
    }
  }
  if (kind === "bomber") {
    // backpack bomb
    ctx.fillStyle = "#5a4010";
    roundRectPath(ctx, -14, -32 + bob, 8, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#ff3b5c";
    ctx.beginPath();
    ctx.arc(-10, -34 + bob, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "sniper") {
    ctx.fillStyle = "#2a2a2a";
    roundRectPath(ctx, 6, -30 + bob, 18, 4, 1);
    ctx.fill();
    ctx.fillStyle = "#39ff9a";
    ctx.fillRect(22, -29 + bob, 3, 2);
  }

  // head
  const skin = ctx.createRadialGradient(-1, -44 + bob + hopY, 1, 0, -42 + bob + hopY, 8);
  skin.addColorStop(0, "#e8c4b0");
  skin.addColorStop(1, "#a87860");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -42 + bob + hopY, kind === "heavy" ? 9 : 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a0508";
  roundRectPath(ctx, 0, -44 + bob + hopY, 7, 4, 1);
  ctx.fill();
  ctx.fillStyle = kind === "sniper" ? "#39ff9a" : "#ff3040";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 6;
  ctx.fillRect(3, -43 + bob + hopY, 3, 2);
  ctx.shadowBlur = 0;

  if (kind === "shooter") {
    const kick = Math.sin(t * 2) > 0.85 ? 3 : 0;
    ctx.fillStyle = "#444";
    roundRectPath(ctx, 6 - kick, -28 + bob, 16, 5, 1);
    ctx.fill();
    ctx.fillStyle = "#ff9f1a";
    ctx.fillRect(20 - kick, -27 + bob, 4, 3);
  } else if (kind === "grunt" || kind === "rusher" || kind === "hopper") {
    limb(ctx, 8, -30 + bob + hopY, 13, -22 + bob + hopY - swing * 0.3, 4, "#c09080");
  }

  ctx.restore();
}

function paintDrone(ctx, x, y, e, time, flash) {
  const cx = x + e.w / 2;
  const cy = y + e.h / 2;
  const bob = Math.sin(e.animT * 6) * 2;
  // rotor blur
  ctx.strokeStyle = "rgba(26, 188, 156, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8 + bob, 16, 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  // body
  const g = ctx.createRadialGradient(cx - 3, cy - 2 + bob, 2, cx, cy + bob, 14);
  g.addColorStop(0, flash ? "#fff" : "#7dffe0");
  g.addColorStop(0.5, flash ? "#eee" : "#1abc9c");
  g.addColorStop(1, "#0a5a4a");
  ctx.fillStyle = g;
  ctx.shadowColor = "#1abc9c";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(cx, cy + bob, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // eye
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx + e.facing * 4, cy + bob, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff3b5c";
  ctx.beginPath();
  ctx.arc(cx + e.facing * 5, cy + bob, 2, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Bosses ─────────────────────────────────────────────

export function drawBossLive(ctx, x, y, b, time) {
  ctx.save();
  if (b.flash > 0) ctx.globalAlpha = 0.65 + Math.sin(time * 40) * 0.35;

  if (b.type === "apc") {
    const bob = Math.sin(time * 10) * 1.2;
    // shadow
    ctx.fillStyle = "rgba(30,40,50,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + b.w / 2, y + b.h + 3, b.w * 0.42, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // chassis
    const body = ctx.createLinearGradient(x, y, x, y + b.h);
    body.addColorStop(0, "#5a4a62");
    body.addColorStop(0.4, "#3a3048");
    body.addColorStop(1, "#1e1828");
    ctx.fillStyle = body;
    roundRectPath(ctx, x, y + 14 + bob, b.w, b.h - 14, 8);
    ctx.fill();
    // metallic edge
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, x + 1, y + 15 + bob, b.w - 2, b.h - 16, 7);
    ctx.stroke();
    // neon stripe
    const pulse = 0.5 + Math.sin(time * 5) * 0.5;
    ctx.fillStyle = `rgba(255, 45, 180, ${0.5 + pulse * 0.5})`;
    ctx.shadowColor = "#ff2db4";
    ctx.shadowBlur = 14;
    roundRectPath(ctx, x + 12, y + 26 + bob, b.w - 24, 7, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // cabin
    const cab = ctx.createLinearGradient(0, y, 0, y + 30);
    cab.addColorStop(0, "#6a5a78");
    cab.addColorStop(1, "#2a2038");
    ctx.fillStyle = cab;
    roundRectPath(ctx, x + b.w * 0.52, y + bob, b.w * 0.42, 30, 5);
    ctx.fill();
    // windshield
    const glass = ctx.createLinearGradient(0, y + 6, 0, y + 18);
    glass.addColorStop(0, "rgba(180, 230, 255, 0.85)");
    glass.addColorStop(1, "rgba(40, 120, 180, 0.7)");
    ctx.fillStyle = glass;
    roundRectPath(ctx, x + b.w * 0.58, y + 8 + bob, 22, 10, 2);
    ctx.fill();
    // wheels
    const roll = time * 7;
    for (const wx of [20, b.w - 20]) {
      const cx = x + wx;
      const cy = y + b.h - 2;
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c9a04a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, roll, roll + Math.PI * 1.2);
      ctx.stroke();
      ctx.strokeStyle = "#666";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(roll) * 8, cy + Math.sin(roll) * 8);
      ctx.stroke();
    }
    // gun
    const kick = Math.sin(time * 3) > 0.7 ? 5 : 0;
    ctx.fillStyle = "#3a3a48";
    const gx = b.facing > 0 ? x + b.w - 8 - kick : x - 22 + kick;
    roundRectPath(ctx, gx, y + 30 + bob, 28, 7, 2);
    ctx.fill();
  } else {
    // Sentinel illustrated orb
    const cx = x + b.w / 2;
    const cy = y + b.h / 2;
    const pulse = 0.75 + Math.sin(time * 4.5) * 0.25;
    // aura
    const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, 50 * pulse);
    aura.addColorStop(0, "rgba(80, 255, 180, 0.35)");
    aura.addColorStop(1, "rgba(80, 255, 180, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 50 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // rings
    ctx.strokeStyle = "rgba(60, 200, 140, 0.4)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, (26 + i * 11) * pulse, (14 + i * 5) * pulse, time * (0.7 + i * 0.25), 0, Math.PI * 2);
      ctx.stroke();
    }
    // shards
    for (let i = 0; i < 6; i++) {
      const ang = time * 1.8 + (i / 6) * Math.PI * 2;
      const ox = cx + Math.cos(ang) * 36;
      const oy = cy + Math.sin(ang) * 20;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(ang);
      const sg = ctx.createLinearGradient(-3, -7, 3, 7);
      sg.addColorStop(0, "#fff");
      sg.addColorStop(1, i % 2 ? "#39ff9a" : "#2ec4ff");
      ctx.fillStyle = sg;
      roundRectPath(ctx, -3, -7, 6, 14, 2);
      ctx.fill();
      ctx.restore();
    }
    // core
    const core = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 26);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.25, "#7dffc0");
    core.addColorStop(0.7, "#1a8a60");
    core.addColorStop(1, "#0a2a1c");
    ctx.fillStyle = core;
    ctx.shadowColor = "#39ff9a";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(cx, cy, 24 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // iris
    ctx.fillStyle = "#06120c";
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff3b5c";
    ctx.shadowColor = "#ff3b5c";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(time * 2) * 3.5, cy + Math.cos(time * 1.6) * 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// ─── Platforms (painted) ────────────────────────────────

export function drawPlatformLive(ctx, x, y, w, h, p) {
  if (p.hazard) {
    if (p.style === "lava") {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#ffcc44");
      g.addColorStop(0.4, "#ff6a1a");
      g.addColorStop(1, "#c02030");
      ctx.fillStyle = g;
      roundRectPath(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,200,0.45)";
      for (let i = 0; i < w; i += 10) {
        const wave = Math.sin(Date.now() / 180 + i * 0.2) * 2.5;
        ctx.beginPath();
        ctx.ellipse(x + i + 4, y + 3 + wave, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#6a7080";
      ctx.fillRect(x, y + h - 5, w, 5);
      for (let i = 0; i < w; i += 11) {
        const sg = ctx.createLinearGradient(0, y, 0, y + h);
        sg.addColorStop(0, "#e8ecf4");
        sg.addColorStop(1, "#8a90a0");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(x + i, y + h - 5);
        ctx.lineTo(x + i + 5.5, y);
        ctx.lineTo(x + i + 11, y + h - 5);
        ctx.fill();
      }
    }
    return;
  }

  if (p.oneWay) {
    const base = p.style === "tech" ? ["#4a8a6e", "#2ecc8a"] : ["#5a7a9a", "#3db8e8"];
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, base[0]);
    g.addColorStop(1, shade(base[0], -0.15));
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.fillStyle = base[1];
    ctx.shadowColor = base[1];
    ctx.shadowBlur = 8;
    ctx.fillRect(x + 1, y, w - 2, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x + 4, y + 5, w - 8, 2);
    return;
  }

  if (p.style === "street") {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#8b95a8");
    g.addColorStop(0.15, "#6b7588");
    g.addColorStop(1, "#4a5366");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // asphalt texture lines
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let i = 12; i < w; i += 28) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 10);
      ctx.lineTo(x + i + 8, y + h - 4);
      ctx.stroke();
    }
    ctx.fillStyle = "#9aa4b8";
    ctx.fillRect(x, y, w, 7);
    ctx.strokeStyle = "#f0d060";
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 3.5);
    ctx.lineTo(x + w - 4, y + 3.5);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (p.style === "tech") {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#6a9a82");
    g.addColorStop(1, "#3a5a4a");
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 200, 140, 0.4)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    for (let i = 10; i < w; i += 22) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      roundRectPath(ctx, x + i, y + 9, 8, 4, 1);
      ctx.fill();
    }
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#9aa6ba");
    g.addColorStop(1, "#5a6478");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x, y, w, 4);
  }
}

// ─── Pickups / bullets ──────────────────────────────────

export function drawPickupLive(ctx, x, y, item) {
  const colors = {
    health: "#2ecc8a",
    energy: "#e91e8c",
    rapid: "#e8c040",
    spread: "#2ecc8a",
    shotgun: "#e89a30",
    laser: "#5ad4ff",
    plasma: "#b44dff",
    bazooka: "#ff6b1a",
    rail: "#e8f4ff",
    tankbuster: "#ff2244",
  };
  const labels = {
    health: "H", energy: "E", rapid: "R", spread: "S", shotgun: "G",
    laser: "L", plasma: "P", bazooka: "B", rail: "A", tankbuster: "T",
  };
  const c = colors[item.type] || "#fff";
  const bob = Math.sin(item.bob) * 4;
  const pulse = 0.7 + Math.sin(item.bob * 2) * 0.3;
  const cx = x + 11;
  const cy = y + 11 + bob;

  ctx.save();
  // soft glow
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18 * pulse);
  glow.addColorStop(0, c.replace(")", ",0.45)").replace("rgb", "rgba").includes("rgba") ? c + "99" : c);
  // simpler glow
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.2 * pulse;
  ctx.beginPath();
  ctx.arc(cx, cy, 16 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(item.bob * 0.7) * 0.12);
  // crate body
  const box = ctx.createLinearGradient(-11, -11, 11, 11);
  box.addColorStop(0, "#f4f7fb");
  box.addColorStop(1, "#c5ced8");
  ctx.fillStyle = box;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundRectPath(ctx, -11, -11, 22, 22, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  roundRectPath(ctx, -10, -10, 20, 20, 3);
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.font = "bold 13px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(labels[item.type] || "?", 0, 1);
  ctx.restore();
}

export function drawBulletLive(ctx, x, y, b) {
  ctx.save();
  ctx.translate(x + b.w / 2, y + b.h / 2);
  const ang = Math.atan2(b.vy, b.vx);
  ctx.rotate(ang);
  ctx.shadowColor = b.color;
  ctx.shadowBlur = b.rocket || b.rail ? 16 : 10;
  ctx.fillStyle = b.color;

  if (b.rail) {
    const g = ctx.createLinearGradient(-20, 0, 24, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.3, b.color);
    g.addColorStop(0.7, "#fff");
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    roundRectPath(ctx, -20, -2.5, 44, 5, 2);
    ctx.fill();
  } else if (b.laser) {
    const g = ctx.createLinearGradient(-14, 0, 16, 0);
    g.addColorStop(0, "rgba(255,255,255,0.2)");
    g.addColorStop(0.5, "#fff");
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    roundRectPath(ctx, -14, -1.5, 30, 3, 1);
    ctx.fill();
  } else if (b.orb) {
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.4, b.color);
    g.addColorStop(1, "rgba(40,0,60,0.8)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.rocket) {
    const body = ctx.createLinearGradient(-12, 0, 14, 0);
    body.addColorStop(0, "#333");
    body.addColorStop(0.4, b.color);
    body.addColorStop(1, "#fff");
    ctx.fillStyle = body;
    roundRectPath(ctx, -12, -4, 24, 8, 2);
    ctx.fill();
    ctx.fillStyle = "#ff3b5c";
    ctx.beginPath();
    ctx.moveTo(-12, -3);
    ctx.lineTo(-18 - Math.random() * 3, 0);
    ctx.lineTo(-12, 3);
    ctx.fill();
  } else if (b.special && b.friendly) {
    roundRectPath(ctx, -10, -5, 20, 10, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-4, -2, 8, 4);
  } else if (b.bomb) {
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
    g.addColorStop(0, "#fff4c0");
    g.addColorStop(0.5, b.color);
    g.addColorStop(1, "#5a3010");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff3b5c";
    ctx.fillRect(-1, -9, 2, 4);
  } else if (!b.friendly) {
    const g = ctx.createRadialGradient(-1, -1, 0, 0, 0, b.w / 2 + 1);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, b.w / 2 + (b.sniper ? 1 : 0), 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createLinearGradient(-10, 0, 10, 0);
    g.addColorStop(0, "rgba(255,255,255,0.2)");
    g.addColorStop(0.5, "#fff");
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    roundRectPath(ctx, -8, -2.5, 16, 5, 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Background helpers (smooth painted) ────────────────

export function drawSoftCloud(ctx, x, y, s) {
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.beginPath();
  ctx.ellipse(x, y, 38 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 24 * s, y + 2, 30 * s, 13 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 20 * s, y + 3, 26 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 8 * s, y - 6, 22 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSun(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r * 2.2);
  g.addColorStop(0, "rgba(255, 250, 220, 1)");
  g.addColorStop(0.25, "rgba(255, 220, 100, 0.9)");
  g.addColorStop(0.5, "rgba(255, 200, 80, 0.25)");
  g.addColorStop(1, "rgba(255, 200, 80, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe566";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
