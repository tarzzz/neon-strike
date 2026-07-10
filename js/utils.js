/** Math / geometry helpers */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const chance = (p) => Math.random() < p;
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

export function padScore(n) {
  return String(Math.floor(n)).padStart(6, "0");
}

/** AABB vs solid platforms (one-way from above when oneWay=true) */
export function resolvePlatforms(entity, platforms, dt, opts = {}) {
  const { allowDrop = false } = opts;
  const prevBottom = entity.y + entity.h - entity.vy * dt;
  entity.onGround = false;
  entity.y += entity.vy * dt;

  for (const p of platforms) {
    if (p.hazard) continue;
    const oneWay = !!p.oneWay;
    if (oneWay && allowDrop) continue;

    const box = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
    const plat = { x: p.x, y: p.y, w: p.w, h: p.h };
    if (!rectsOverlap(box, plat)) continue;

    if (oneWay) {
      // Only land when falling onto top
      if (entity.vy >= 0 && prevBottom <= p.y + 4) {
        entity.y = p.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
      }
      continue;
    }

    // Solid: resolve vertical first
    const overlapTop = entity.y + entity.h - p.y;
    const overlapBot = p.y + p.h - entity.y;
    if (entity.vy >= 0 && overlapTop < overlapBot && prevBottom <= p.y + 6) {
      entity.y = p.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    } else if (entity.vy < 0 && overlapBot < overlapTop) {
      entity.y = p.y + p.h;
      entity.vy = 0;
    }
  }

  entity.x += entity.vx * dt;
  for (const p of platforms) {
    if (p.hazard || p.oneWay) continue;
    const box = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
    const plat = { x: p.x, y: p.y, w: p.w, h: p.h };
    if (!rectsOverlap(box, plat)) continue;

    const overlapLeft = entity.x + entity.w - p.x;
    const overlapRight = p.x + p.w - entity.x;
    if (overlapLeft < overlapRight) {
      entity.x = p.x - entity.w;
    } else {
      entity.x = p.x + p.w;
    }
    entity.vx = 0;
  }
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
