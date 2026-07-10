import { initInput } from "./input.js";
import { Game } from "./game.js";

const canvas = document.getElementById("game");
const ui = {
  hud: document.getElementById("hud"),
  hpFill: document.getElementById("hp-fill"),
  lives: document.getElementById("lives"),
  score: document.getElementById("score"),
  weapon: document.getElementById("weapon"),
  levelName: document.getElementById("level-name"),
  fps: document.getElementById("fps"),
  screenTitle: document.getElementById("screen-title"),
  screenHow: document.getElementById("screen-how"),
  screenIntro: document.getElementById("screen-intro"),
  screenPause: document.getElementById("screen-pause"),
  screenDead: document.getElementById("screen-dead"),
  screenOver: document.getElementById("screen-over"),
  screenClear: document.getElementById("screen-clear"),
  screenWin: document.getElementById("screen-win"),
  introBadge: document.getElementById("intro-badge"),
  introTitle: document.getElementById("intro-title"),
  introDesc: document.getElementById("intro-desc"),
  deadMsg: document.getElementById("dead-msg"),
  finalScore: document.getElementById("final-score"),
  clearBonus: document.getElementById("clear-bonus"),
  winScore: document.getElementById("win-score"),
  btnStart: document.getElementById("btn-start"),
  btnHow: document.getElementById("btn-how"),
  btnHowBack: document.getElementById("btn-how-back"),
  btnResume: document.getElementById("btn-resume"),
  btnQuit: document.getElementById("btn-quit"),
  btnRetry: document.getElementById("btn-retry"),
  btnMenu: document.getElementById("btn-menu"),
  btnWinMenu: document.getElementById("btn-win-menu"),
  btnFullscreen: document.getElementById("btn-fullscreen"),
};

// Logical resolution stays fixed for consistent gameplay;
// DPR scaling keeps vectors sharp without changing physics.
const LOGICAL_W = 960;
const LOGICAL_H = 540;
const ctx = canvas.getContext("2d");

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(LOGICAL_W * dpr);
  canvas.height = Math.floor(LOGICAL_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}
fitCanvas();
window.addEventListener("resize", fitCanvas);

initInput(canvas);
const game = new Game(canvas, ui);

// Browser fullscreen (F or button)
function toggleFullscreen() {
  const root = document.getElementById("app") || document.documentElement;
  if (!document.fullscreenElement) {
    root.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

ui.btnFullscreen?.addEventListener("click", toggleFullscreen);
window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    // don't steal when typing (n/a) — toggle FS
    if (e.target === document.body || e.target === document.documentElement || e.target === canvas) {
      toggleFullscreen();
    }
  }
});

document.addEventListener("fullscreenchange", () => {
  if (ui.btnFullscreen) {
    ui.btnFullscreen.textContent = document.fullscreenElement ? "EXIT FULL" : "FULLSCREEN";
  }
});

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
