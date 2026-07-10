import { rand, randInt } from "./utils.js";

/**
 * Lightweight particle system with several visual styles:
 * circle, spark, square debris, ring, smoke, star, streak
 */
export class ParticleSystem {
  constructor() {
    this.list = [];
    this.flashes = []; // full additive muzzle / kill flashes
  }

  clear() {
    this.list.length = 0;
    this.flashes.length = 0;
  }

  emit(x, y, opts = {}) {
    const {
      count = 8,
      color = "#00f0ff",
      colors = null,
      speed = 120,
      life = 0.45,
      size = 3,
      gravity = 400,
      spread = Math.PI * 2,
      angle = 0,
      kind = "circle", // circle | spark | square | smoke | star | streak
      drag = 0.98,
      fade = true,
      vx0 = 0,
      vy0 = 0,
    } = opts;

    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.35 + Math.random() * 0.85);
      const maxLife = life * (0.55 + Math.random() * 0.6);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp + vx0,
        vy: Math.sin(a) * sp + vy0,
        life: maxLife,
        maxLife,
        size: size * (0.45 + Math.random() * 0.9),
        color: colors ? colors[randInt(0, colors.length - 1)] : color,
        gravity,
        kind: kind === "spark" || opts.spark ? "spark" : kind,
        drag,
        fade,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 10,
      });
    }
  }

  /** Screen-space additive flash (drawn in world coords) */
  flash(x, y, opts = {}) {
    this.flashes.push({
      x,
      y,
      r: opts.r || 40,
      life: opts.life || 0.12,
      maxLife: opts.life || 0.12,
      color: opts.color || "rgba(255,255,200,0.7)",
    });
  }

  burst(x, y, color) {
    this.emit(x, y, {
      count: 22,
      colors: [color, "#fff", "#ffe566", "#ff9f1a"],
      speed: 280,
      life: 0.55,
      size: 4,
      gravity: 320,
    });
    this.emit(x, y, {
      count: 14,
      colors: [color, "#fff"],
      speed: 320,
      life: 0.4,
      size: 2.2,
      gravity: 80,
      kind: "spark",
    });
    this.emit(x, y, {
      count: 8,
      colors: ["#3a3a48", "#222", color],
      speed: 180,
      life: 0.7,
      size: 4.5,
      gravity: 600,
      kind: "square",
    });
    this.ring(x, y, color, 0.35);
    this.flash(x, y, { r: 70, life: 0.14, color: color + "88" });
  }

  /** Expanding ring shockwave */
  ring(x, y, color = "#fff", life = 0.3) {
    this.list.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      maxLife: life,
      size: 6,
      color,
      gravity: 0,
      kind: "ring",
      drag: 1,
      fade: true,
      rot: 0,
      rotV: 0,
      grow: 220,
    });
  }

  muzzle(x, y, dir, weapon = "blaster") {
    const ang = dir > 0 ? 0 : Math.PI;
    const hot =
      weapon === "bazooka"
        ? ["#fff", "#ffe566", "#ff6b1a", "#ff3b5c"]
        : weapon === "spread"
          ? ["#fff", "#39ff9a", "#00f0ff"]
          : weapon === "rapid"
            ? ["#fff", "#ffe566", "#ff9f1a"]
            : ["#fff", "#ffe566", "#00f0ff", "#ff9f1a"];

    // hot cone flash
    this.emit(x, y, {
      count: weapon === "bazooka" ? 16 : 10,
      colors: hot,
      speed: weapon === "bazooka" ? 260 : 220,
      life: 0.14,
      size: weapon === "bazooka" ? 4 : 3,
      gravity: 0,
      angle: ang,
      spread: weapon === "spread" ? 1.1 : 0.7,
      kind: "streak",
      drag: 0.9,
    });
    // core sparks
    this.emit(x, y, {
      count: 8,
      colors: hot,
      speed: 160,
      life: 0.18,
      size: 2.4,
      gravity: 40,
      angle: ang,
      spread: 0.9,
      kind: "spark",
    });
    // shell casing kick
    this.emit(x, y - 4, {
      count: weapon === "rapid" ? 1 : 1,
      colors: ["#c9a84c", "#ffe566", "#8a7030"],
      speed: 90,
      life: 0.55,
      size: 2.2,
      gravity: 900,
      angle: ang + (dir > 0 ? -2.2 : 2.2),
      spread: 0.5,
      kind: "square",
      drag: 0.96,
    });
    // smoke puff
    this.emit(x + dir * 6, y, {
      count: 4,
      colors: ["#8899aa", "#667788", "#aabbcc"],
      speed: 50,
      life: 0.35,
      size: 5,
      gravity: -30,
      angle: ang,
      spread: 0.8,
      kind: "smoke",
      drag: 0.94,
    });
    this.flash(x + dir * 10, y, {
      r: weapon === "bazooka" ? 55 : 32,
      life: 0.08,
      color: weapon === "bazooka" ? "rgba(255,120,40,0.55)" : "rgba(255,240,180,0.5)",
    });
  }

  hit(x, y, color = "#00f0ff") {
    this.emit(x, y, {
      count: 10,
      colors: [color, "#fff", "#ffe566"],
      speed: 200,
      life: 0.28,
      size: 2.6,
      gravity: 60,
      kind: "spark",
    });
    this.emit(x, y, {
      count: 6,
      colors: [color, "#fff"],
      speed: 140,
      life: 0.22,
      size: 3,
      gravity: 100,
    });
    this.flash(x, y, { r: 22, life: 0.06, color: "rgba(255,255,255,0.35)" });
  }

  blood(x, y) {
    this.emit(x, y, {
      count: 14,
      colors: ["#ff2bd6", "#ff3b5c", "#aa0044", "#ff6b9a"],
      speed: 200,
      life: 0.5,
      size: 3.2,
      gravity: 550,
    });
    this.emit(x, y, {
      count: 6,
      colors: ["#ff3b5c", "#ff2bd6"],
      speed: 120,
      life: 0.45,
      size: 2,
      gravity: 400,
      kind: "streak",
    });
  }

  /** Chunky death explosion with debris + stars */
  kill(x, y, color = "#ff3b5c") {
    this.burst(x, y, color);
    this.emit(x, y, {
      count: 10,
      colors: ["#fff", color, "#ffe566"],
      speed: 160,
      life: 0.55,
      size: 3.5,
      gravity: 50,
      kind: "star",
    });
    this.emit(x, y, {
      count: 12,
      colors: ["#2a2a38", "#444", color, "#ffe566"],
      speed: 240,
      life: 0.85,
      size: 5,
      gravity: 700,
      kind: "square",
    });
    // secondary delayed-feeling smoke
    this.emit(x, y, {
      count: 10,
      colors: ["#555a66", "#889", color],
      speed: 70,
      life: 0.8,
      size: 7,
      gravity: -50,
      kind: "smoke",
      drag: 0.95,
    });
    this.ring(x, y, "#fff", 0.28);
    this.ring(x, y, color, 0.4);
    this.flash(x, y, { r: 90, life: 0.16, color: "rgba(255,255,255,0.45)" });
  }

  sparks(x, y) {
    this.emit(x, y, {
      count: 14,
      colors: ["#00f0ff", "#fff", "#39ff9a", "#ffe566"],
      speed: 240,
      life: 0.35,
      size: 2.2,
      gravity: 120,
      kind: "spark",
    });
    this.emit(x, y, {
      count: 6,
      colors: ["#00f0ff", "#fff"],
      speed: 100,
      life: 0.25,
      size: 3,
      gravity: 40,
    });
  }

  /** Soft glow trail for projectiles */
  trail(x, y, color, size = 2.5) {
    this.emit(x, y, {
      count: 1,
      colors: [color, "#fff"],
      speed: 10,
      life: 0.12,
      size,
      gravity: 0,
      kind: "smoke",
      drag: 0.9,
      spread: 0.5,
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      if (p.kind === "ring") {
        p.size += (p.grow || 180) * dt;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag ?? 0.98;
      p.vy *= p.drag ?? 0.98;
      p.rot += (p.rotV || 0) * dt;
      if (p.kind === "smoke") p.size += 10 * dt;
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }

    // Cap particles for performance
    if (this.list.length > 900) {
      this.list.splice(0, this.list.length - 900);
    }
  }

  draw(ctx, cam) {
    for (const f of this.flashes) {
      const a = Math.max(0, f.life / f.maxLife);
      const sx = f.x - cam.x;
      const sy = f.y - cam.y;
      const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, f.r);
      grd.addColorStop(0, `rgba(255,255,255,${0.7 * a})`);
      grd.addColorStop(0.35, `rgba(255,210,120,${0.35 * a})`);
      grd.addColorStop(1, "rgba(255,80,40,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(sx, sy, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.list) {
      const t = Math.max(0, p.life / p.maxLife);
      const a = p.fade === false ? 1 : t;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      const s = p.size * (p.kind === "ring" ? 1 : 0.5 + t * 0.5);

      if (p.kind === "spark") {
        ctx.fillRect(sx - s, sy, s * 2, 1.4);
        ctx.fillRect(sx, sy - s, 1.4, s * 2);
      } else if (p.kind === "square") {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * t;
        ctx.globalAlpha = a * 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "smoke") {
        ctx.globalAlpha = a * 0.35;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "star") {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? s : s * 0.4;
          // use 10-point star
        }
        // simple 4-point
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.25, -s * 0.25);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.25, s * 0.25);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.25, s * 0.25);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.25, -s * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === "streak") {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.atan2(p.vy, p.vx) || p.rot);
        ctx.fillRect(-s * 1.8, -s * 0.35, s * 3.2, s * 0.7);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.5, s * t), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
