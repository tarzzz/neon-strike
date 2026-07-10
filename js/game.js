import { clamp, lerp, rand, randInt, chance, rectsOverlap, padScore, resolvePlatforms } from "./utils.js";
import { isDown, justPressed, justPressedKey, isFiring, isAnyFire, getFireAim, anyKeyPressed, endFrameInput, consumeWheel } from "./input.js";
import { sfx, unlockAudio } from "./audio.js";
import { ParticleSystem } from "./particles.js";
import { getLevel } from "./levels.js";
import {
  ENABLE_3D,
  drawExtrusion,
  drawPerspectiveGround,
  drawContactBlob,
  extrusionColorsForStyle,
} from "./fx3d.js";
import { hasSave, readRaw, writeSave, clearSave, formatSaveSummary } from "./save.js";
import {
  drawPlayerLive,
  drawEnemyLive,
  drawBossLive,
  drawPlatformLive,
  drawPickupLive,
  drawBulletLive,
  drawScenery,
  drawSoftCloud,
  drawSun,
  roundRectPath,
} from "./gfx.js";

const W = 960;
const H = 540;
const STAND_W = 28;
const STAND_H = 46;
const PRONE_W = 50;
const PRONE_H = 15;

/** Slot order = number keys 1–9 · cycle with K */
export const WEAPON_ORDER = [
  "blaster",
  "rapid",
  "spread",
  "shotgun",
  "laser",
  "plasma",
  "bazooka",
  "rail",
  "tankbuster",
];

const WEAPONS = {
  blaster: {
    name: "BLASTER",
    rate: 0.18,
    dmg: 1,
    speed: 620,
    color: "#00f0ff",
    spread: 0,
    count: 1,
    infinite: true,
  },
  rapid: {
    name: "RAPID",
    rate: 0.07,
    dmg: 1,
    speed: 720,
    color: "#ffe566",
    spread: 0.06,
    count: 1,
    ammoPickup: 90,
    maxAmmo: 200,
  },
  spread: {
    name: "SPREAD",
    rate: 0.22,
    dmg: 1,
    speed: 560,
    color: "#39ff9a",
    spread: 0.3,
    count: 3,
    ammoPickup: 55,
    maxAmmo: 120,
  },
  shotgun: {
    name: "SHOTGUN",
    rate: 0.42,
    dmg: 1,
    speed: 640,
    color: "#ff9f1a",
    spread: 0.55,
    count: 6,
    life: 0.28,
    ammoPickup: 28,
    maxAmmo: 60,
    bw: 8,
    bh: 4,
  },
  laser: {
    name: "LASER",
    rate: 0.05,
    dmg: 1,
    speed: 1200,
    color: "#7df9ff",
    spread: 0,
    count: 1,
    life: 0.55,
    pierce: 3,
    bw: 18,
    bh: 3,
    ammoPickup: 120,
    maxAmmo: 250,
  },
  plasma: {
    name: "PLASMA",
    rate: 0.28,
    dmg: 2,
    speed: 380,
    color: "#c44dff",
    spread: 0.04,
    count: 1,
    life: 1.6,
    bw: 14,
    bh: 14,
    radius: 36,
    splash: true,
    ammoPickup: 36,
    maxAmmo: 80,
  },
  bazooka: {
    name: "BAZOOKA",
    rate: 0.55,
    dmg: 4,
    speed: 400,
    color: "#ff6b1a",
    spread: 0,
    count: 1,
    rocket: true,
    radius: 60,
    life: 2.4,
    bw: 20,
    bh: 9,
    ammoPickup: 10,
    maxAmmo: 24,
  },
  // ── Heavy / anti-armor ──────────────────────────────
  rail: {
    name: "RAILGUN",
    rate: 0.75,
    dmg: 10,
    speed: 1600,
    color: "#e8f7ff",
    spread: 0,
    count: 1,
    life: 0.7,
    pierce: 8,
    antiTank: true, // big bonus vs bosses / turrets
    tankMul: 2.2,
    bw: 28,
    bh: 4,
    ammoPickup: 8,
    maxAmmo: 18,
  },
  tankbuster: {
    name: "T-BUSTER",
    rate: 0.95,
    dmg: 14,
    speed: 340,
    color: "#ff2244",
    spread: 0,
    count: 1,
    rocket: true,
    radius: 90,
    life: 2.8,
    antiTank: true,
    tankMul: 2.5,
    bw: 26,
    bh: 12,
    ammoPickup: 4,
    maxAmmo: 10,
  },
};

const PICKUP_TO_WEAPON = {
  rapid: "rapid",
  spread: "spread",
  shotgun: "shotgun",
  laser: "laser",
  plasma: "plasma",
  bazooka: "bazooka",
  rail: "rail",
  tankbuster: "tankbuster",
};

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.particles = new ParticleSystem();

    this.state = "title"; // title | intro | play | pause | dead | clear | over | win
    this.levelIndex = 0;
    this.level = null;
    this.score = 0;
    this.lives = 3;
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.cam = { x: 0, y: 0 };
    this.fps = 60;
    this._fpsT = 0;
    this._fpsC = 0;

    this.player = null;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.boss = null;
    this.bossActive = false;
    this.floatingTexts = [];
    this.checkpoint = 0;
    this.introReady = false;
    this._saveMsgTimer = 0;

    this._bindUI();
    this.refreshContinueButton();
  }

  _bindUI() {
    const { ui } = this;
    ui.btnStart?.addEventListener("click", () => {
      unlockAudio();
      sfx.ui();
      this.startGame();
    });
    ui.btnHow?.addEventListener("click", () => {
      sfx.ui();
      this.showScreen("how");
    });
    ui.btnHowBack?.addEventListener("click", () => {
      sfx.ui();
      this.showScreen("title");
    });
    ui.btnResume?.addEventListener("click", () => {
      sfx.ui();
      this.state = "play";
      this.showScreen(null);
    });
    ui.btnQuit?.addEventListener("click", () => {
      sfx.ui();
      // keep last save; offer continue
      this.state = "title";
      this.showScreen("title");
      this.ui.hud?.classList.add("hidden");
      this.refreshContinueButton();
    });
    ui.btnRetry?.addEventListener("click", () => {
      unlockAudio();
      sfx.ui();
      this.startGame();
    });
    ui.btnMenu?.addEventListener("click", () => {
      sfx.ui();
      this.state = "title";
      this.showScreen("title");
      this.ui.hud?.classList.add("hidden");
      this.refreshContinueButton();
    });
    ui.btnWinMenu?.addEventListener("click", () => {
      sfx.ui();
      this.state = "title";
      this.showScreen("title");
      this.ui.hud?.classList.add("hidden");
      this.refreshContinueButton();
    });
    ui.btnContinue?.addEventListener("click", () => {
      unlockAudio();
      sfx.ui();
      if (!this.loadGame()) {
        this.setSaveMsg("No save data found.", true);
      }
    });
    ui.btnSave?.addEventListener("click", () => {
      sfx.ui();
      if (this.saveGame()) this.setSaveMsg("Game saved.", false);
      else this.setSaveMsg("Save failed.", true);
    });
    ui.btnLoad?.addEventListener("click", () => {
      sfx.ui();
      if (this.loadGame()) {
        this.setSaveMsg("Game loaded.", false);
      } else {
        this.setSaveMsg("No save data found.", true);
      }
    });
  }

  setSaveMsg(text, isError = false) {
    const el = this.ui.pauseSaveMsg;
    if (el) {
      el.textContent = text;
      el.style.color = isError ? "var(--red)" : "var(--cyan)";
    }
    // also float in-game
    if (this.player && this.state === "play") {
      this.floatText(this.player.x, this.player.y - 50, text, isError ? "#ff3b5c" : "#00f0ff");
    }
  }

  refreshContinueButton() {
    const data = readRaw();
    const btn = this.ui.btnContinue;
    const sum = this.ui.saveSummary;
    if (btn) {
      if (data) {
        btn.classList.remove("hidden");
        btn.textContent = "CONTINUE";
      } else {
        btn.classList.add("hidden");
      }
    }
    if (sum) {
      if (data) {
        sum.classList.remove("hidden");
        sum.textContent = formatSaveSummary(data);
      } else {
        sum.classList.add("hidden");
        sum.textContent = "";
      }
    }
  }

  /** Snapshot current run into localStorage */
  serializeSave() {
    if (!this.level || !this.player) return null;
    const p = this.player;
    return {
      score: this.score,
      lives: this.lives,
      levelIndex: this.levelIndex,
      checkpoint: this.checkpoint,
      bossActive: !!this.bossActive,
      bossHp: this.boss?.alive ? this.boss.hp : 0,
      bossAlive: !!(this.boss && this.boss.alive),
      player: {
        x: p.x,
        y: p.y,
        hp: p.hp,
        energy: p.energy,
        weapon: p.weapon,
        owned: { ...p.owned },
        ammo: { ...p.ammo },
        facing: p.facing,
      },
      enemiesAlive: this.enemies.map((e) => !!e.alive),
      enemyHp: this.enemies.map((e) => e.hp),
      pickupsAlive: this.pickups.map((item) => !!item.alive),
    };
  }

  saveGame() {
    // Allow save during active run states
    if (!["play", "pause", "intro", "dead"].includes(this.state)) {
      return false;
    }
    if (!this.player || !this.level) return false;
    // When paused, still save mid-level state
    if (this.state === "intro" && this.player) {
      // at drop-in: still fine
    }
    const data = this.serializeSave();
    if (!data) return false;
    const ok = writeSave(data);
    if (ok) this.refreshContinueButton();
    return ok;
  }

  loadGame() {
    const data = readRaw();
    if (!data) return false;

    unlockAudio();
    this.score = data.score ?? 0;
    this.lives = data.lives ?? 3;
    this.levelIndex = data.levelIndex ?? 0;
    this.arsenalCarry = data.player
      ? {
          owned: { ...(data.player.owned || {}) },
          ammo: { ...(data.player.ammo || {}) },
          weapon: data.player.weapon || "blaster",
        }
      : null;

    if (!this.loadLevel(this.levelIndex)) return false;

    // restore player
    const p = this.player;
    const sp = data.player || {};
    applyArsenal(p, {
      owned: sp.owned || { blaster: true },
      ammo: sp.ammo || {},
      weapon: sp.weapon || "blaster",
    });
    if (typeof sp.hp === "number") p.hp = Math.max(1, Math.min(p.maxHp, sp.hp));
    if (typeof sp.energy === "number") p.energy = Math.max(0, Math.min(p.maxEnergy, sp.energy));
    if (typeof sp.facing === "number") p.facing = sp.facing || 1;

    // position: prefer saved coords, else checkpoint
    this.checkpoint = data.checkpoint ?? this.level.playerStart.x;
    if (typeof sp.x === "number" && typeof sp.y === "number") {
      // un-prone then place
      if (p.prone) setPlayerProne(p, false);
      p.x = sp.x;
      p.y = sp.y;
      p.w = STAND_W;
      p.h = STAND_H;
      p.prone = false;
    } else {
      p.x = this.checkpoint;
      p.y = this.level.playerStart.y;
    }
    p.invuln = 1.5;
    p.alive = true;
    p.vx = 0;
    p.vy = 0;

    // enemies / pickups
    if (Array.isArray(data.enemiesAlive)) {
      this.enemies.forEach((e, i) => {
        if (data.enemiesAlive[i] === false) {
          e.alive = false;
        } else if (typeof data.enemyHp?.[i] === "number") {
          e.hp = data.enemyHp[i];
          e.alive = e.hp > 0;
        }
      });
    }
    if (Array.isArray(data.pickupsAlive)) {
      this.pickups.forEach((item, i) => {
        if (data.pickupsAlive[i] === false) item.alive = false;
      });
    }

    // boss
    this.bossActive = !!data.bossActive;
    if (this.boss) {
      if (data.bossAlive === false) {
        this.boss.alive = false;
        this.boss.hp = 0;
      } else if (typeof data.bossHp === "number" && data.bossHp > 0) {
        this.boss.hp = Math.min(this.boss.maxHp, data.bossHp);
        this.boss.alive = true;
        this.boss.intro = 0;
      }
    }

    this.bullets = [];
    this.enemyBullets = [];
    this.floatingTexts = [];
    this.shake = 0;
    this.flash = 0;
    this.cam.x = Math.max(0, p.x - W * 0.35);
    this.cam.y = 0;

    this.state = "play";
    this.showScreen(null);
    this.ui.hud?.classList.remove("hidden");
    this.updateHUD();
    this.floatText(p.x, p.y - 40, "LOADED", "#39ff9a");
    this.refreshContinueButton();
    return true;
  }

  showScreen(name) {
    const map = {
      title: this.ui.screenTitle,
      how: this.ui.screenHow,
      intro: this.ui.screenIntro,
      pause: this.ui.screenPause,
      dead: this.ui.screenDead,
      over: this.ui.screenOver,
      clear: this.ui.screenClear,
      win: this.ui.screenWin,
    };
    for (const [k, el] of Object.entries(map)) {
      if (!el) continue;
      el.classList.toggle("hidden", k !== name);
    }
  }

  startGame() {
    // New run — wipe previous save so Continue matches reality
    clearSave();
    this.refreshContinueButton();
    this.score = 0;
    this.lives = 3;
    this.levelIndex = 0;
    this.arsenalCarry = null; // fresh run
    this.loadLevel(0);
    this.state = "intro";
    this.introReady = false;
    this.showIntro();
    this.ui.hud?.classList.remove("hidden");
    this.updateHUD();
  }

  showIntro() {
    const L = this.level;
    if (this.ui.introBadge) this.ui.introBadge.textContent = `LEVEL ${L.code}`;
    if (this.ui.introTitle) this.ui.introTitle.textContent = L.name;
    if (this.ui.introDesc) this.ui.introDesc.textContent = L.desc;
    this.showScreen("intro");
    // slight delay so start click doesn't skip
    setTimeout(() => {
      this.introReady = true;
    }, 300);
  }

  loadLevel(index) {
    const data = getLevel(index);
    if (!data) return false;
    this.levelIndex = index;
    this.level = data;
    this.particles.clear();
    this.bullets = [];
    this.enemyBullets = [];
    this.floatingTexts = [];
    this.bossActive = false;
    this.shake = 0;
    this.flash = 0;
    this.checkpoint = data.playerStart.x;

    // keep guns between levels / rebuild player
    if (this.player) this.arsenalCarry = captureArsenal(this.player);
    this.player = createPlayer(data.playerStart.x, data.playerStart.y);
    applyArsenal(this.player, this.arsenalCarry);
    this.enemies = data.enemies.map((e) => createEnemy(e));
    this.pickups = data.pickups.map((p) => ({
      ...p,
      w: 22,
      h: 22,
      bob: Math.random() * Math.PI * 2,
      alive: true,
    }));
    this.boss = createBoss(data.boss);
    this.cam.x = 0;
    this.cam.y = 0;
    return true;
  }

  respawn() {
    const startX = this.checkpoint;
    const startY = this.level.playerStart.y;
    const kit = captureArsenal(this.player);
    this.player = createPlayer(startX, startY);
    applyArsenal(this.player, kit);
    this.player.invuln = 2;
    this.bullets = [];
    this.enemyBullets = [];
    this.shake = 0;
  }

  // ─── Update ───────────────────────────────────────────
  update(dt) {
    this.time += dt;
    this._fpsC++;
    this._fpsT += dt;
    if (this._fpsT >= 0.5) {
      this.fps = Math.round(this._fpsC / this._fpsT);
      this._fpsC = 0;
      this._fpsT = 0;
      if (this.ui.fps) this.ui.fps.textContent = `${this.fps} FPS`;
    }

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 8);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);

    if (this.state === "intro") {
      if (this.introReady && anyKeyPressed()) {
        unlockAudio();
        sfx.level();
        this.state = "play";
        this.showScreen(null);
        this.saveGame(); // auto-save at level start
      }
      endFrameInput();
      return;
    }

    if (this.state === "dead") {
      if (anyKeyPressed()) {
        if (this.lives > 0) {
          this.respawn();
          this.state = "play";
          this.showScreen(null);
        } else {
          this.state = "over";
          if (this.ui.finalScore) this.ui.finalScore.textContent = `SCORE: ${padScore(this.score)}`;
          this.showScreen("over");
        }
      }
      endFrameInput();
      return;
    }

    if (this.state === "clear") {
      if (anyKeyPressed()) {
        const next = this.levelIndex + 1;
        if (getLevel(next)) {
          this.loadLevel(next);
          this.state = "intro";
          this.introReady = false;
          this.showIntro();
          this.updateHUD();
        } else {
          this.state = "win";
          if (this.ui.winScore) this.ui.winScore.textContent = `FINAL SCORE: ${padScore(this.score)}`;
          this.showScreen("win");
          clearSave();
          this.refreshContinueButton();
        }
      }
      endFrameInput();
      return;
    }

    if (this.state === "pause") {
      if (justPressed("pause")) {
        this.state = "play";
        this.showScreen(null);
      }
      if (justPressedKey("F5")) {
        if (this.saveGame()) this.setSaveMsg("Game saved (F5).", false);
        else this.setSaveMsg("Save failed.", true);
      }
      if (justPressedKey("F9")) {
        if (this.loadGame()) this.setSaveMsg("Game loaded (F9).", false);
        else this.setSaveMsg("No save data.", true);
      }
      endFrameInput();
      return;
    }

    if (this.state === "title" || this.state === "how") {
      if (justPressedKey("F9")) {
        unlockAudio();
        if (this.loadGame()) sfx.ui();
      }
      endFrameInput();
      return;
    }

    if (this.state !== "play") {
      endFrameInput();
      return;
    }

    if (justPressed("pause")) {
      this.state = "pause";
      this.showScreen("pause");
      if (this.ui.pauseSaveMsg) this.ui.pauseSaveMsg.textContent = "";
      endFrameInput();
      return;
    }

    // F5 save · F9 load
    if (justPressedKey("F5")) {
      if (this.saveGame()) this.setSaveMsg("Game saved (F5).", false);
      else this.setSaveMsg("Cannot save here.", true);
    }
    if (justPressedKey("F9")) {
      if (this.loadGame()) this.setSaveMsg("Game loaded (F9).", false);
      else this.setSaveMsg("No save data.", true);
    }

    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updatePickups(dt);
    this.updateCamera(dt);
    this.particles.update(dt);
    this.updateFloating(dt);
    this.checkHazards();
    this.updateHUD();
    endFrameInput();
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p || !p.alive) return;
    const g = this.level.gravity;

    // Hold S / ↓ on ground = lie prone (under enemy fire)
    // Tap S again while already prone = drop through one-way platforms
    if (p.proneLock > 0) p.proneLock -= dt;
    if (justPressed("down") && p.onGround && p.prone) {
      p.dropTimer = 0.2;
      p.proneLock = 0.25; // don't immediately re-prone while still holding S
      setPlayerProne(p, false);
    }
    if (p.dropTimer > 0) p.dropTimer -= dt;
    const dropping = p.dropTimer > 0;

    const wantProne = isDown("down") && p.onGround && !dropping && p.proneLock <= 0;
    if (wantProne && !p.prone) setPlayerProne(p, true);
    else if (!wantProne && p.prone && p.onGround) setPlayerProne(p, false);
    // leave prone if launched into the air
    if (!p.onGround && p.prone) setPlayerProne(p, false);

    // horizontal (crawl when prone)
    let move = 0;
    if (isDown("left")) move -= 1;
    if (isDown("right")) move += 1;
    const maxSp = p.prone ? p.speed * 0.32 : p.speed;
    const target = move * maxSp;
    p.vx = lerp(p.vx, target, clamp(dt * (p.prone ? 10 : 14), 0, 1));
    if (move !== 0) p.facing = move;

    // jump / double jump (jump stands you up)
    if (justPressed("jump")) {
      if (p.prone) setPlayerProne(p, false);
      if (p.onGround) {
        p.vy = p.jumpV;
        p.onGround = false;
        p.jumps = 1;
        p.flip = 0;
        p.flipSpeed = (10 + Math.random() * 4) * p.facing; // somersault
        p.fun = null;
        sfx.jump();
      } else if (p.jumps < p.maxJumps) {
        p.vy = p.jumpV * 0.92;
        p.jumps++;
        // reverse or boost flip on double jump
        p.flipSpeed = (12 + Math.random() * 5) * (Math.random() < 0.5 ? p.facing : -p.facing);
        sfx.jump();
        this.particles.emit(p.x + p.w / 2, p.y + p.h, {
          count: 10,
          colors: ["#00f0ff", "#fff", "#ff2bd6"],
          speed: 120,
          life: 0.28,
          gravity: 200,
          angle: Math.PI / 2,
          spread: 1.4,
        });
      }
    }
    // variable jump height
    if (!isDown("jump") && p.vy < -120) p.vy *= 0.85;

    p.vy += g * dt;
    p.vy = clamp(p.vy, -900, 1100);

    resolvePlatforms(p, this.level.platforms, dt, { allowDrop: dropping });
    if (dropping && p.onGround) {
      p.y += 6;
      p.onGround = false;
      if (p.vy < 60) p.vy = 80;
    }

    // world bounds
    p.x = clamp(p.x, 0, this.level.width - p.w);
    if (p.y > this.level.height + 40) {
      this.hurtPlayer(99);
    }

    // anim + somersault + random fun poses
    p.animT += dt;
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt);
    if (p.landSquash > 0) p.landSquash = Math.max(0, p.landSquash - dt * 2.5);
    if (p.muzzleFlash > 0) p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);

    // airborne flip integration
    if (!p.onGround) {
      p.flip = (p.flip || 0) + (p.flipSpeed || 0) * dt;
      // slight drag so it doesn't spin forever on long falls
      p.flipSpeed = (p.flipSpeed || 0) * (1 - dt * 0.15);
    }

    // landing squash + finish flip + random flourish
    if (p.onGround && !p.wasOnGround && p.vy >= 0) {
      p.landSquash = 1;
      p.flip = 0;
      p.flipSpeed = 0;
      this.particles.emit(p.x + p.w / 2, p.y + p.h, {
        count: 10,
        colors: ["#8899aa", "#00f0ff", "#fff"],
        speed: 90,
        life: 0.28,
        gravity: 200,
        angle: -Math.PI / 2,
        spread: 1.4,
        kind: "smoke",
      });
      // random land flair
      if (Math.random() < 0.45) {
        startFunAnim(p, pickFun(["kick", "flex", "celebrate", "spin", "point"]));
      }
    }
    p.wasOnGround = p.onGround;

    // fun anim timer
    if (p.fun) {
      p.funT += dt;
      if (p.funT >= p.funDur) {
        p.fun = null;
        p.funT = 0;
      }
    }

    // random idle / run flair
    p.funCd = (p.funCd || 0) - dt;
    if (p.onGround && !p.prone && !p.fun && p.funCd <= 0) {
      if (Math.abs(p.vx) < 20 && Math.random() < 0.008) {
        startFunAnim(p, pickFun(["wave", "look", "flex", "dance", "point", "celebrate"]));
        p.funCd = 1.2 + Math.random() * 2;
      } else if (Math.abs(p.vx) > 40 && Math.random() < 0.004) {
        startFunAnim(p, pickFun(["spin", "point", "kick"]));
        p.funCd = 2 + Math.random();
      }
    }

    // base locomotion anim (fun overlays on top)
    if (p.prone) p.anim = Math.abs(p.vx) > 15 ? "crawl" : "prone";
    else if (!p.onGround) p.anim = "flip"; // somersault in air
    else if (p.fun === "spin" || p.fun === "dance" || p.fun === "celebrate") p.anim = "idle";
    else if (Math.abs(p.vx) > 30) p.anim = "run";
    else p.anim = "idle";

    // shooting cancels most fun poses (except mid-flip)
    if (isAnyFire() && p.fun && p.fun !== "spin") {
      p.fun = null;
      p.funT = 0;
    }

    // run dust / foot puffs
    if (p.anim === "run") {
      p.dustT = (p.dustT || 0) - dt;
      if (p.dustT <= 0) {
        p.dustT = 0.08;
        this.particles.emit(p.x + p.w / 2 - p.facing * 4, p.y + p.h - 2, {
          count: 2,
          colors: ["#6a7a90", "#9ab"],
          speed: 40,
          life: 0.25,
          size: 2.5,
          gravity: -20,
          kind: "smoke",
          angle: Math.PI + p.facing * 0.3,
          spread: 0.6,
        });
      }
    }

    // fire
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.specialCd = Math.max(0, p.specialCd - dt);
    if (p.invuln > 0) p.invuln -= dt;

    this.handleWeaponSwitch(p);

    // auto-fallback if current gun is empty
    if (!canUseWeapon(p, p.weapon)) {
      p.weapon = "blaster";
    }

    const wep = WEAPONS[p.weapon] || WEAPONS.blaster;
    // J/Z/click = forward · E = diagonal up · X = diagonal down
    if (isAnyFire() && p.fireCd <= 0 && canUseWeapon(p, p.weapon)) {
      const aimMode = getFireAim();
      this.fireWeapon(p, wep, aimMode);
      p.fireCd = wep.rate;
      p.recoil = Math.min(0.18, 0.06 + (wep.rate > 0.3 ? 0.1 : 0.04));
      p.muzzleFlash = 0.06;
      if (!wep.infinite) {
        p.ammo[p.weapon] = Math.max(0, (p.ammo[p.weapon] || 0) - 1);
        if ((p.ammo[p.weapon] || 0) <= 0) {
          this.floatText(p.x, p.y - 30, "EMPTY", "#ff3b5c");
        }
      }
    }

    if (justPressed("special") && p.specialCd <= 0 && p.energy >= 25) {
      this.fireSpecial(p);
      p.energy -= 25;
      p.specialCd = 0.45;
    }

    // energy regen
    p.energy = Math.min(p.maxEnergy, p.energy + 4 * dt);

    // checkpoints
    for (const cx of this.level.checkpoints) {
      if (p.x >= cx && cx > this.checkpoint) {
        this.checkpoint = cx;
        this.saveGame(); // auto-save at checkpoint
      }
    }

    // boss trigger
    if (!this.bossActive && this.boss && p.x >= this.level.boss.triggerX) {
      this.bossActive = true;
      this.floatText(p.x, p.y - 40, "BOSS!", "#ff2bd6");
      sfx.level();
    }
  }

  fireWeapon(p, wep, aimMode = "forward") {
    const prone = !!p.prone;
    const mx = p.x + (p.facing > 0 ? p.w - 4 : 4);
    const my = p.y + (prone ? p.h * 0.45 : p.h * 0.38);
    const baseAngle = p.facing > 0 ? 0 : Math.PI;

    // Diagonal angles (~40°). E = up, X = down. Arrow keys still nudge when forward.
    const DIAG = 0.70; // radians
    let aim = baseAngle;
    if (aimMode === "up") {
      aim = p.facing > 0 ? -DIAG : Math.PI + DIAG;
    } else if (aimMode === "down") {
      aim = p.facing > 0 ? DIAG : Math.PI - DIAG;
    } else {
      if (isDown("up")) aim = p.facing > 0 ? -0.45 : Math.PI + 0.45;
      if (isDown("down") && !p.onGround) aim = p.facing > 0 ? 0.5 : Math.PI - 0.5;
    }

    const count = wep.count;
    const isRocket = !!wep.rocket;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * wep.spread;
      const ang = aim + offset + (Math.random() - 0.5) * (wep.spread * 0.3);
      this.bullets.push({
        x: mx - (isRocket ? 6 : 0),
        y: my - (isRocket ? 2 : 0),
        w: wep.bw || (isRocket ? 20 : 10),
        h: wep.bh || (isRocket ? 9 : (wep.bw ? wep.bh : 4)),
        vx: Math.cos(ang) * wep.speed,
        vy: Math.sin(ang) * wep.speed,
        dmg: wep.dmg,
        color: wep.color,
        life: wep.life || 1.4,
        friendly: true,
        special: isRocket,
        rocket: isRocket,
        radius: wep.radius || 0,
        pierce: wep.pierce || 0,
        splash: !!wep.splash,
        orb: wep.name === "PLASMA",
        laser: wep.name === "LASER" || wep.name === "RAILGUN",
        rail: wep.name === "RAILGUN",
        antiTank: !!wep.antiTank,
        tankMul: wep.tankMul || 1,
      });
    }
    const wepKey = p.weapon || "blaster";
    this.particles.muzzle(mx, my, p.facing, wepKey === "tankbuster" ? "bazooka" : wepKey);
    this.shake = Math.max(
      this.shake,
      wepKey === "tankbuster" || wepKey === "rail"
        ? 0.35
        : isRocket
          ? 0.22
          : wepKey === "shotgun"
            ? 0.18
            : wepKey === "rapid" || wepKey === "laser"
              ? 0.05
              : 0.1
    );
    if (wepKey === "tankbuster") {
      sfx.tankbuster();
      this.particles.emit(mx, my, {
        count: 16,
        colors: ["#ff2244", "#ffe566", "#fff", "#ff6b1a"],
        speed: 180,
        life: 0.28,
        gravity: 0,
        angle: p.facing > 0 ? 0 : Math.PI,
        spread: 1.0,
        kind: "streak",
      });
      this.flash = Math.max(this.flash, 0.12);
    } else if (wepKey === "rail") {
      sfx.rail();
      this.particles.emit(mx, my, {
        count: 14,
        colors: ["#fff", "#7df9ff", "#e8f7ff"],
        speed: 400,
        life: 0.15,
        gravity: 0,
        angle: p.facing > 0 ? 0 : Math.PI,
        spread: 0.25,
        kind: "streak",
      });
      this.particles.ring(mx + p.facing * 20, my, "#e8f7ff", 0.18);
    } else if (isRocket) {
      sfx.bazooka();
      this.particles.emit(mx, my, {
        count: 12,
        colors: ["#ff6b1a", "#ffe566", "#fff", "#ff3b5c"],
        speed: 140,
        life: 0.22,
        gravity: 0,
        angle: p.facing > 0 ? 0 : Math.PI,
        spread: 0.9,
        kind: "streak",
      });
    } else if (wep.name === "SHOTGUN") {
      sfx.spread();
      sfx.shoot();
    } else if (wep.name === "SPREAD") sfx.spread();
    else if (wep.name === "LASER") sfx.laser();
    else if (wep.name === "PLASMA") sfx.plasma();
    else sfx.shoot();
  }

  handleWeaponSwitch(p) {
    // number keys 1-7
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      const key = String(i + 1);
      if (justPressedKey(key)) {
        this.trySelectWeapon(p, WEAPON_ORDER[i]);
        break;
      }
    }
    if (justPressed("prevWeapon")) this.cycleWeapon(p, -1);
    if (justPressed("nextWeapon")) this.cycleWeapon(p, 1);
    const wheel = consumeWheel();
    if (wheel > 8) this.cycleWeapon(p, 1);
    else if (wheel < -8) this.cycleWeapon(p, -1);
  }

  trySelectWeapon(p, id) {
    if (!p.owned[id]) {
      this.floatText(p.x, p.y - 36, "LOCKED", "#7a8aaa");
      sfx.ui();
      return;
    }
    if (!canUseWeapon(p, id) && id !== "blaster") {
      this.floatText(p.x, p.y - 36, "NO AMMO", "#ff3b5c");
      sfx.ui();
      return;
    }
    if (p.weapon === id) return;
    p.weapon = id;
    p.fireCd = 0.05;
    sfx.ui();
    const w = WEAPONS[id];
    this.floatText(p.x, p.y - 36, w.name, w.color);
  }

  cycleWeapon(p, dir) {
    const usable = WEAPON_ORDER.filter((id) => p.owned[id] && canUseWeapon(p, id));
    if (usable.length <= 1) return;
    let idx = usable.indexOf(p.weapon);
    if (idx < 0) idx = 0;
    idx = (idx + dir + usable.length) % usable.length;
    this.trySelectWeapon(p, usable[idx]);
  }

  fireSpecial(p) {
    const mx = p.x + p.w / 2 + p.facing * 16;
    const my = p.y + (p.prone ? p.h * 0.4 : p.h * 0.4);
    // rocket-ish blast
    this.bullets.push({
      x: mx,
      y: my,
      w: 16,
      h: 10,
      vx: p.facing * 480,
      vy: 0,
      dmg: 5,
      color: "#ff2bd6",
      life: 2,
      friendly: true,
      special: true,
      radius: 48,
    });
    sfx.special();
    this.particles.muzzle(mx, my, p.facing, "bazooka");
    this.particles.emit(mx, my, {
      count: 14,
      colors: ["#ff2bd6", "#fff", "#00f0ff"],
      speed: 180,
      life: 0.25,
      gravity: 0,
      kind: "streak",
    });
    this.shake = Math.max(this.shake, 0.28);
  }

  updateBullets(dt) {
    const plats = this.level.platforms;

    const step = (list, friendly) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        if (b.bomb && b.gravity) b.vy += b.gravity * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        // rocket exhaust trail
        if (b.rocket) {
          const rx = b.x + b.w / 2 - Math.sign(b.vx || 1) * 12;
          const ry = b.y + b.h / 2 + (Math.random() - 0.5) * 4;
          this.particles.trail(rx, ry, chance(0.5) ? "#ff9f1a" : "#ffe566", 5);
          this.particles.trail(rx, ry, "#ff3b5c", 3);
          if (chance(0.65)) {
            this.particles.emit(rx, ry, {
              count: 2,
              colors: ["#ff6b1a", "#ffe566", "#ff2244", "#555"],
              speed: 50,
              life: 0.35,
              size: 3.5,
              gravity: -60,
              kind: "smoke",
            });
          }
          if (chance(0.25)) {
            this.particles.emit(rx, ry, {
              count: 1,
              colors: ["#fff", "#ffe566"],
              speed: 20,
              life: 0.15,
              size: 2,
              gravity: 0,
              kind: "spark",
            });
          }
        } else if (b.friendly) {
          if (b.rail && chance(0.7)) {
            this.particles.trail(b.x + b.w / 2, b.y + b.h / 2, "#e8f7ff", 3.5);
          } else if (b.orb && chance(0.5)) {
            this.particles.trail(b.x + b.w / 2, b.y + b.h / 2, b.color, 4);
          } else if (chance(0.45)) {
            this.particles.trail(b.x + b.w / 2, b.y + b.h / 2, b.color, 2.5);
          }
        }
        const offscreen =
          b.life <= 0 ||
          b.x < this.cam.x - 40 ||
          b.x > this.cam.x + W + 40 ||
          b.y < -40 ||
          b.y > H + 40;
        if (offscreen) {
          list.splice(i, 1);
          continue;
        }
        // solid collision
        let hitWall = false;
        for (const p of plats) {
          if (p.oneWay || p.hazard) continue;
          if (rectsOverlap(b, p)) {
            hitWall = true;
            break;
          }
        }
        if (hitWall) {
          if (b.rocket || b.special) this.explode(b.x + b.w / 2, b.y + b.h / 2, b.radius || 48, b.dmg, b);
          else if (b.bomb) {
            this.particles.burst(b.x, b.y, b.color);
            this.shake = Math.max(this.shake, 0.25);
            sfx.explode();
            const pl = this.player;
            if (pl?.alive && pl.invuln <= 0) {
              const d = Math.hypot(pl.x + pl.w / 2 - b.x, pl.y + pl.h / 2 - b.y);
              if (d < (b.radius || 40)) this.hurtPlayer(b.dmg || 1);
            }
          } else this.particles.sparks(b.x, b.y);
          list.splice(i, 1);
          continue;
        }

        if (friendly) {
          // hit enemies
          let killed = false;
          for (const e of this.enemies) {
            if (!e.alive) continue;
            if (rectsOverlap(b, e)) {
              this.damageEnemy(e, b.dmg, b);
              if (b.special || b.rocket) this.explode(b.x, b.y, b.radius, b.dmg, b);
              else if (b.splash) this.splashDamage(b.x + b.w / 2, b.y + b.h / 2, b.radius || 32, b.dmg, e);
              if (b.pierce > 0) {
                b.pierce -= 1;
                // nudge past target so we don't re-hit same frame forever
                b.x += Math.sign(b.vx || 1) * 8;
              } else {
                list.splice(i, 1);
                killed = true;
              }
              break;
            }
          }
          if (killed) continue;
          if (this.boss && this.boss.alive && this.bossActive && rectsOverlap(b, this.bossHitbox())) {
            this.damageBoss(b.dmg, b);
            if (b.special || b.rocket) this.explode(b.x, b.y, b.radius, b.dmg, b);
            else if (b.splash) this.splashDamage(b.x + b.w / 2, b.y + b.h / 2, b.radius || 32, b.dmg, null);
            if (b.pierce > 0) b.pierce -= 1;
            else {
              list.splice(i, 1);
              continue;
            }
          }
        } else {
          const p = this.player;
          if (p.alive && p.invuln <= 0 && rectsOverlap(b, p)) {
            this.hurtPlayer(b.dmg || 1);
            if (b.bomb) {
              this.particles.burst(b.x, b.y, b.color);
              sfx.explode();
            }
            list.splice(i, 1);
          }
        }
      }
    };

    step(this.bullets, true);
    step(this.enemyBullets, false);
  }

  explode(x, y, radius, dmg, bullet = null) {
    const heavy = bullet?.antiTank || radius >= 80;
    const rocket = !!bullet?.rocket;
    this.particles.burst(x, y, heavy ? "#ff2244" : rocket ? "#ff6b1a" : "#ff2bd6");
    this.particles.kill(x, y, "#ff6b1a");
    this.particles.burst(x, y, "#ffe566");
    this.particles.ring(x, y, "#ffe566", heavy ? 0.5 : 0.38);
    this.particles.ring(x, y, rocket ? "#ff6b1a" : "#ff2bd6", heavy ? 0.55 : 0.42);
    if (heavy || rocket) {
      this.particles.ring(x, y, "#fff", 0.28);
      this.particles.emit(x, y, {
        count: rocket ? 22 : 14,
        colors: ["#ff3b5c", "#ff9f1a", "#ffe566", "#fff", "#333"],
        speed: 280,
        life: 0.55,
        size: 4,
        gravity: 200,
        kind: "square",
      });
    }
    this.shake = Math.max(this.shake, heavy ? 0.8 : rocket ? 0.65 : 0.55);
    this.flash = Math.max(this.flash, heavy ? 0.4 : rocket ? 0.3 : 0.2);
    sfx.explode();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      if (Math.hypot(cx - x, cy - y) < radius) this.damageEnemy(e, dmg, bullet);
    }
    if (this.boss?.alive && this.bossActive) {
      const hb = this.bossHitbox();
      const cx = hb.x + hb.w / 2;
      const cy = hb.y + hb.h / 2;
      if (Math.hypot(cx - x, cy - y) < radius + 20) this.damageBoss(dmg, bullet);
    }
  }

  splashDamage(x, y, radius, dmg, skip) {
    this.particles.burst(x, y, "#c44dff");
    this.particles.ring(x, y, "#c44dff", 0.2);
    this.shake = Math.max(this.shake, 0.15);
    for (const e of this.enemies) {
      if (!e.alive || e === skip) continue;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      if (Math.hypot(cx - x, cy - y) < radius) this.damageEnemy(e, Math.max(1, dmg - 1));
    }
  }

  damageEnemy(e, dmg, bullet) {
    let dealt = dmg;
    // Frontal shield: block weak non-splash hits from the front
    if (e.shield && bullet && !bullet.rocket && !bullet.special && !bullet.splash && !bullet.antiTank) {
      const fromRight = (bullet.vx || 0) < 0;
      const hittingFront = (e.facing > 0 && fromRight) || (e.facing < 0 && !fromRight);
      if (hittingFront) {
        this.particles.sparks(e.x + e.w / 2 + e.facing * 10, e.y + e.h * 0.4);
        this.floatText(e.x, e.y - 16, "BLOCK", "#5b8def");
        sfx.hit();
        return;
      }
    }
    if (e.armored && bullet && !bullet.antiTank && !bullet.rocket && !bullet.special) {
      dealt = Math.max(1, Math.floor(dealt * 0.5));
    }
    if (bullet?.antiTank && (e.type === "turret" || e.type === "shooter" || e.armored || e.shield || e.type === "heavy")) {
      dealt = Math.ceil(dmg * (bullet.tankMul || 2));
      this.particles.sparks(e.x + e.w / 2, e.y + e.h / 2);
    }
    e.hp -= dealt;
    e.flash = 0.12;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    this.particles.hit(cx, cy, e.color);
    this.particles.blood(cx, cy);
    this.shake = Math.max(this.shake, bullet?.antiTank ? 0.2 : 0.08);
    sfx.hit();
    if (e.hp <= 0) {
      e.alive = false;
      this.score += e.score;
      this.particles.kill(cx, cy, e.color);
      this.particles.burst(cx, cy, "#fff");
      this.shake = Math.max(this.shake, 0.4);
      this.flash = Math.max(this.flash, 0.18);
      sfx.enemyDie();
      sfx.explode();
      this.floatText(e.x, e.y - 10, `+${e.score}`, "#ffe566");
      this.floatText(e.x, e.y - 28, "KILL", "#ff2bd6");
      if (this.player?.alive && this.player.onGround && !this.player.prone && Math.random() < 0.28) {
        startFunAnim(this.player, pickFun(["celebrate", "flex", "point", "wave", "kick"]));
      }
      if (chance(0.18)) {
        const types = ["health", "energy", "rapid", "spread", "shotgun", "laser", "plasma", "bazooka", "rail", "tankbuster"];
        this.pickups.push({
          type: types[randInt(0, types.length - 1)],
          x: e.x,
          y: e.y,
          w: 22,
          h: 22,
          bob: 0,
          alive: true,
        });
      }
    }
  }

  bossHitbox() {
    const b = this.boss;
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  }

  damageBoss(dmg, bullet) {
    const b = this.boss;
    if (!b.alive || b.intro > 0) return;
    let dealt = dmg;
    if (bullet?.antiTank) {
      dealt = Math.ceil(dmg * (bullet.tankMul || 2));
      this.floatText(b.x + b.w / 2, b.y - 10, "ARMOR PIERCE", "#ffe566");
    }
    b.hp -= dealt;
    b.flash = 0.12;
    this.shake = Math.max(this.shake, bullet?.antiTank ? 0.55 : 0.3);
    if (bullet?.antiTank) this.flash = Math.max(this.flash, 0.15);
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    this.particles.hit(bx, by, "#ff2bd6");
    this.particles.sparks(bx, by);
    this.particles.flash(bx, by, { r: 40, life: 0.08 });
    sfx.bossHit();
    if (b.hp <= 0) {
      b.alive = false;
      b.hp = 0;
      this.score += b.score;
      this.particles.kill(bx, by, "#ff2bd6");
      this.particles.kill(b.x + 20, b.y + 20, "#00f0ff");
      this.particles.kill(b.x + b.w - 20, b.y + b.h - 20, "#ffe566");
      this.particles.burst(bx, by, "#fff");
      this.particles.ring(bx, by, "#fff", 0.5);
      this.particles.ring(bx, by, "#ff2bd6", 0.7);
      this.shake = 1.2;
      this.flash = 0.75;
      sfx.explode();
      sfx.enemyDie();
      this.floatText(b.x, b.y - 20, `+${b.score}`, "#39ff9a");
      // level clear after short delay
      setTimeout(() => {
        if (this.state !== "play") return;
        const bonus = 2000 + this.lives * 500;
        this.score += bonus;
        if (this.ui.clearBonus) this.ui.clearBonus.textContent = `BONUS +${bonus}`;
        this.state = "clear";
        this.showScreen("clear");
        sfx.level();
        this.updateHUD();
        this.saveGame(); // auto-save after boss
      }, 1200);
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    const g = this.level.gravity;
    // collect new spawns (e.g. none currently) after loop
    const born = [];

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.x < this.cam.x - 140 || e.x > this.cam.x + W + 140) continue;

      e.animT += dt;
      if (e.flash > 0) e.flash -= dt;

      if (e.type === "grunt" || e.type === "heavy" || e.type === "shield") {
        e.vy += g * dt;
        if (e.onGround) {
          e.vx = e.facing * e.speed;
          e.turnT -= dt;
          if (e.turnT <= 0) {
            e.facing *= -1;
            e.turnT = rand(1.2, 2.8);
          }
        }
        resolvePlatforms(e, this.level.platforms, dt);
        if (p && Math.abs(p.x - e.x) < 300 && Math.abs(p.y - e.y) < 140) {
          e.facing = p.x >= e.x ? 1 : -1;
        }
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(e.type === "heavy" ? 2 : 1);
      } else if (e.type === "shooter") {
        e.vy += g * dt;
        resolvePlatforms(e, this.level.platforms, dt);
        e.vx = 0;
        if (p) e.facing = p.x >= e.x ? 1 : -1;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && p && Math.abs(p.x - e.x) < 420) {
          this.enemyShoot(e, 280);
          e.fireCd = rand(1.1, 1.8);
        }
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(1);
      } else if (e.type === "rusher") {
        e.vy += g * dt;
        e.chargeCd -= dt;
        if (e.charging) {
          e.chargeT -= dt;
          e.vx = e.facing * e.speed * 3.2;
          if (e.chargeT <= 0) {
            e.charging = false;
            e.chargeCd = rand(1.4, 2.2);
            e.vx = 0;
          }
        } else if (e.onGround) {
          e.vx = e.facing * e.speed * 0.6;
          if (p && e.chargeCd <= 0 && Math.abs(p.x - e.x) < 260 && Math.abs(p.y - e.y) < 80) {
            e.facing = p.x >= e.x ? 1 : -1;
            e.charging = true;
            e.chargeT = 0.55;
            this.particles.emit(e.x + e.w / 2, e.y + e.h, {
              count: 6, colors: ["#ff6b35", "#fff"], speed: 80, life: 0.2, gravity: 100,
            });
          }
        }
        resolvePlatforms(e, this.level.platforms, dt);
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(e.charging ? 2 : 1);
      } else if (e.type === "bomber") {
        e.vy += g * dt;
        if (e.onGround) {
          e.vx = e.facing * e.speed;
          e.turnT -= dt;
          if (e.turnT <= 0) {
            e.facing *= -1;
            e.turnT = rand(1.4, 2.6);
          }
        }
        resolvePlatforms(e, this.level.platforms, dt);
        if (p && Math.abs(p.x - e.x) < 360) e.facing = p.x >= e.x ? 1 : -1;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && p && Math.abs(p.x - e.x) < 400) {
          this.enemyLob(e, p);
          e.fireCd = rand(1.6, 2.4);
        }
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(1);
      } else if (e.type === "sniper") {
        e.vy += g * dt;
        resolvePlatforms(e, this.level.platforms, dt);
        e.vx = 0;
        if (p) e.facing = p.x >= e.x ? 1 : -1;
        e.fireCd -= dt;
        if (!e.aiming && e.fireCd <= 0 && p && Math.abs(p.x - e.x) < 620) {
          e.aiming = true;
          e.aimT = 0.85;
        }
        if (e.aiming) {
          e.aimT -= dt;
          if (e.aimT <= 0) {
            e.aiming = false;
            this.enemyShoot(e, 520, true, { dmg: 2, color: "#39ff9a", w: 10, h: 4, sniper: true });
            e.fireCd = rand(2.0, 2.8);
          }
        }
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(1);
      } else if (e.type === "hopper") {
        e.vy += g * dt;
        e.hopCd -= dt;
        if (e.onGround) {
          e.vx *= 0.85;
          if (p && e.hopCd <= 0) {
            e.facing = p.x >= e.x ? 1 : -1;
            e.vy = -520;
            e.vx = e.facing * 180;
            e.onGround = false;
            e.hopCd = rand(1.0, 1.7);
          }
        }
        resolvePlatforms(e, this.level.platforms, dt);
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(1);
      } else if (e.type === "drone") {
        e.phase += dt * 2.8;
        e.y = e.baseY + Math.sin(e.phase) * e.amp;
        e.x += e.facing * e.speed * dt;
        if (e.x < e.minX || e.x > e.maxX) e.facing *= -1;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && p && Math.abs(p.x - e.x) < 340) {
          this.enemyShoot(e, 260, true, { color: "#1abc9c" });
          e.fireCd = rand(1.2, 1.9);
        }
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(1);
      } else if (e.type === "turret") {
        e.vx = 0;
        e.vy = 0;
        if (p) e.facing = p.x >= e.x ? 1 : -1;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && p && Math.abs(p.x - e.x) < 500) {
          this.enemyShoot(e, 320, true);
          e.fireCd = rand(0.9, 1.4);
        }
      } else if (e.type === "flyer") {
        // legacy support
        e.phase += dt * e.freq;
        e.y = e.baseY + Math.sin(e.phase) * e.amp;
        e.x += e.facing * e.speed * dt;
        if (e.x < e.minX || e.x > e.maxX) e.facing *= -1;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && p && Math.abs(p.x - e.x) < 380) {
          this.enemyShoot(e, 240, true);
          e.fireCd = rand(1.4, 2.2);
        }
        if (p?.alive && p.invuln <= 0 && rectsOverlap(p, e)) this.hurtPlayer(1);
      }
    }
    if (born.length) this.enemies.push(...born);
  }

  enemyShoot(e, speed, aim = false, opts = {}) {
    const p = this.player;
    let ang = e.facing > 0 ? 0 : Math.PI;
    if (aim && p) {
      const target = playerTorsoAim(p);
      const dx = target.x - (e.x + e.w / 2);
      const dy = target.y - (e.y + e.h * 0.4);
      ang = Math.atan2(dy, dx);
    }
    this.enemyBullets.push({
      x: e.x + e.w / 2,
      y: e.y + e.h * 0.4,
      w: opts.w || 8,
      h: opts.h || 8,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      dmg: opts.dmg || 1,
      color: opts.color || "#ff3b5c",
      life: opts.life || 2.5,
      friendly: false,
      sniper: !!opts.sniper,
    });
  }

  /** Lobbed grenade with gravity */
  enemyLob(e, p) {
    const sx = e.x + e.w / 2;
    const sy = e.y + e.h * 0.3;
    const tx = p.x + p.w / 2;
    const dx = tx - sx;
    const vx = clamp(dx * 0.9, -220, 220);
    const vy = -320 - Math.random() * 80;
    this.enemyBullets.push({
      x: sx,
      y: sy,
      w: 12,
      h: 12,
      vx,
      vy,
      dmg: 2,
      color: "#c4a035",
      life: 3,
      friendly: false,
      bomb: true,
      gravity: 700,
      radius: 40,
    });
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b || !b.alive || !this.bossActive) return;
    const p = this.player;
    const g = this.level.gravity;

    if (b.intro > 0) {
      b.intro -= dt;
      b.y = lerp(b.y, b.targetY, dt * 2);
      return;
    }

    b.animT += dt;
    if (b.flash > 0) b.flash -= dt;
    b.phase += dt;

    if (b.type === "apc") {
      // roll left-right, periodic shots + jump slam
      b.vy += g * dt;
      resolvePlatforms(b, this.level.platforms, dt);
      b.vx = b.facing * b.speed;
      if (b.x < b.minX) {
        b.x = b.minX;
        b.facing = 1;
      }
      if (b.x > b.maxX) {
        b.x = b.maxX;
        b.facing = -1;
      }

      b.fireCd -= dt;
      if (b.fireCd <= 0) {
        // burst of 3
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (!b.alive) return;
            this.enemyBullets.push({
              x: b.x + (b.facing > 0 ? b.w : 0),
              y: b.y + 40,
              w: 12,
              h: 8,
              vx: b.facing * 360,
              vy: -40 + i * 30,
              dmg: 1,
              color: "#ff9f1a",
              life: 2,
              friendly: false,
            });
          }, i * 100);
        }
        b.fireCd = b.hp < b.maxHp * 0.4 ? 1.1 : 1.8;
      }

      b.slamCd -= dt;
      if (b.slamCd <= 0 && b.onGround) {
        b.vy = -620;
        b.slamCd = 3.5;
      }
      if (p?.alive && p.invuln <= 0 && rectsOverlap(p, b)) this.hurtPlayer(1);
    } else if (b.type === "sentinel") {
      // hovering core, orbit shots, dive
      b.hoverT += dt;
      const base = b.targetY + Math.sin(b.hoverT * 1.5) * 30;
      b.y = lerp(b.y, base, dt * 3);
      b.x += Math.sin(b.hoverT * 0.7) * 40 * dt;

      // keep in arena
      b.x = clamp(b.x, b.minX, b.maxX);

      b.fireCd -= dt;
      if (b.fireCd <= 0) {
        const n = b.hp < b.maxHp * 0.5 ? 10 : 8;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + b.phase;
          this.enemyBullets.push({
            x: b.x + b.w / 2,
            y: b.y + b.h / 2,
            w: 10,
            h: 10,
            vx: Math.cos(ang) * 220,
            vy: Math.sin(ang) * 220,
            dmg: 1,
            color: "#39ff9a",
            life: 3,
            friendly: false,
          });
        }
        b.fireCd = b.hp < b.maxHp * 0.35 ? 1.4 : 2.2;
        sfx.special();
      }

      b.slamCd -= dt;
      if (b.slamCd <= 0 && p) {
        // aimed bolt — at standing torso so prone can duck
        const target = playerTorsoAim(p);
        const dx = target.x - (b.x + b.w / 2);
        const dy = target.y - (b.y + b.h / 2);
        const len = Math.hypot(dx, dy) || 1;
        this.enemyBullets.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          w: 14,
          h: 14,
          vx: (dx / len) * 400,
          vy: (dy / len) * 400,
          dmg: 2,
          color: "#fff",
          life: 2,
          friendly: false,
          special: true,
        });
        b.slamCd = 2.8;
      }
      if (p?.alive && p.invuln <= 0 && rectsOverlap(p, b)) this.hurtPlayer(1);
    }
  }

  updatePickups(dt) {
    const p = this.player;
    for (const item of this.pickups) {
      if (!item.alive) continue;
      item.bob += dt * 4;
      if (!p?.alive) continue;
      const box = { x: item.x, y: item.y + Math.sin(item.bob) * 4, w: item.w, h: item.h };
      if (rectsOverlap(p, box)) {
        item.alive = false;
        sfx.pickup();
        this.applyPickup(item.type);
        this.floatText(item.x, item.y, item.type.toUpperCase(), "#00f0ff");
      }
    }
  }

  applyPickup(type) {
    const p = this.player;
    if (type === "health") {
      p.hp = Math.min(p.maxHp, p.hp + 2);
    } else if (type === "energy") {
      p.energy = Math.min(p.maxEnergy, p.energy + 40);
    } else if (PICKUP_TO_WEAPON[type]) {
      const id = PICKUP_TO_WEAPON[type];
      const w = WEAPONS[id];
      const first = !p.owned[id];
      p.owned[id] = true;
      const add = w.ammoPickup || 30;
      p.ammo[id] = Math.min(w.maxAmmo || 99, (p.ammo[id] || 0) + add);
      p.weapon = id;
      p.fireCd = 0;
      this.floatText(p.x, p.y - 40, first ? `NEW ${w.name}` : `+${add} ${w.name}`, w.color);
      this.arsenalCarry = captureArsenal(p);
    }
    this.score += 100;
  }

  checkHazards() {
    const p = this.player;
    if (!p?.alive || p.invuln > 0) return;
    for (const plat of this.level.platforms) {
      if (!plat.hazard) continue;
      if (rectsOverlap(p, plat)) {
        this.hurtPlayer(1);
        p.vy = -400;
        break;
      }
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (!p?.alive || p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 1.1;
    this.shake = 0.5;
    this.flash = 0.25;
    sfx.hurt();
    this.particles.blood(p.x + p.w / 2, p.y + p.h / 2);
    if (p.hp <= 0) {
      p.alive = false;
      p.hp = 0;
      this.lives -= 1;
      this.particles.burst(p.x + p.w / 2, p.y + p.h / 2, "#00f0ff");
      sfx.explode();
      this.updateHUD();
      setTimeout(() => {
        if (this.lives > 0) {
          this.state = "dead";
          if (this.ui.deadMsg) this.ui.deadMsg.textContent = `${this.lives} life unit(s) remaining.`;
          this.showScreen("dead");
        } else {
          this.state = "over";
          if (this.ui.finalScore) this.ui.finalScore.textContent = `SCORE: ${padScore(this.score)}`;
          this.showScreen("over");
        }
      }, 700);
    }
  }

  updateCamera(dt) {
    const p = this.player;
    if (!p) return;
    let targetX = p.x - W * 0.35;
    if (this.bossActive) {
      // lock near boss arena
      const lock = this.level.boss.triggerX - 40;
      targetX = Math.max(targetX, lock);
    }
    targetX = clamp(targetX, 0, Math.max(0, this.level.width - W));
    this.cam.x = lerp(this.cam.x, targetX, clamp(dt * 6, 0, 1));
    this.cam.y = 0;
  }

  updateFloating(dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.life -= dt;
      f.y -= 30 * dt;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  floatText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 0.9, max: 0.9 });
  }

  updateHUD() {
    const p = this.player;
    if (!p) return;
    const hpPct = clamp(p.hp / p.maxHp, 0, 1) * 100;
    if (this.ui.hpFill) this.ui.hpFill.style.width = `${hpPct}%`;
    if (this.ui.lives) this.ui.lives.textContent = "★".repeat(Math.max(0, this.lives)) || "—";
    if (this.ui.score) this.ui.score.textContent = padScore(this.score);
    if (this.ui.weapon) {
      const w = WEAPONS[p.weapon];
      if (w) {
        const ammo = w.infinite ? "∞" : String(p.ammo[p.weapon] || 0);
        this.ui.weapon.textContent = `${w.name} ${ammo}`;
      } else {
        this.ui.weapon.textContent = "BLASTER ∞";
      }
    }
    if (this.ui.levelName) this.ui.levelName.textContent = this.level?.code || "—";
  }

  // ─── Draw ─────────────────────────────────────────────
  draw() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    // screen shake
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 10);
    }

    this.drawBackground(ctx);
    if (this.level && (this.state === "play" || this.state === "pause" || this.state === "dead" || this.state === "clear" || this.state === "intro")) {
      this.drawWorld(ctx);
    } else if (this.state === "title" || this.state === "how") {
      this.drawTitleBG(ctx);
    } else {
      this.drawBackground(ctx);
    }

    // flash overlay
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }

    // boss hp bar
    if (this.bossActive && this.boss?.alive && this.state === "play") {
      this.drawBossBar(ctx);
    }

    // energy + arsenal when playing
    if (this.state === "play" && this.player) {
      this.drawEnergy(ctx);
      this.drawArsenal(ctx);
    }

    ctx.restore();
  }

  drawTitleBG(ctx) {
    drawScenery(ctx, W, H, { x: this.time * 30, y: 0 }, this.time, {
      scenery: "urban",
      skyTop: "#6aa8e0",
      skyBot: "#d4eaf8",
      sun: true,
      clouds: true,
      farColor: "#9bb4c8",
      midColor: "#7a96b0",
    });
    ctx.fillStyle = "rgba(80,100,120,0.85)";
    ctx.fillRect(0, H - 40, W, 40);
    ctx.strokeStyle = "rgba(255, 200, 60, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.lineTo(W, H - 40);
    ctx.stroke();
    const titleFun = ["wave", "flex", "dance", "celebrate", "look"][Math.floor(this.time / 2.5) % 5];
    drawPlayerLive(ctx, W * 0.5 - 14, H - 40 - 46, 28, 46, 1, "idle", this.time, {
      weaponColor: "#2ec4ff",
      fun: titleFun,
      funT: this.time % 2.5,
    });
  }

  drawBackground(ctx) {
    const bg = this.level?.bg || {
      scenery: "urban",
      skyTop: "#6aa8e0",
      skyBot: "#d4eaf8",
      sun: true,
      clouds: true,
    };
    drawScenery(ctx, W, H, this.cam, this.time, bg);
  }

  drawClouds(ctx, parallax = 0.1) {
    const off = this.cam.x * parallax + this.time * 8;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 160 - off) % (W + 140)) - 60;
      const y = 40 + (i * 37) % 120;
      const s = 0.75 + (i % 3) * 0.28;
      drawSoftCloud(ctx, x, y, s);
    }
  }

  drawBuildings(ctx, parallax, alpha, color, count) {
    ctx.globalAlpha = alpha;
    const off = this.cam.x * parallax;
    for (let i = 0; i < count; i++) {
      const bw = 60 + (i % 4) * 25;
      const bh = 100 + ((i * 73) % 200);
      const bx = ((i * 140 - off) % (W + 120)) - 60;
      // building body
      ctx.fillStyle = color;
      ctx.fillRect(bx, H - bh - 20, bw, bh);
      // roof lip
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(bx - 2, H - bh - 24, bw + 4, 5);
      // glass windows (daytime)
      for (let wy = H - bh; wy < H - 40; wy += 18) {
        for (let wx = 8; wx < bw - 8; wx += 14) {
          if ((wx + wy + i) % 3 === 0) continue;
          const shimmer = 0.35 + (Math.sin(this.time * 1.5 + wx * 0.15 + i) * 0.5 + 0.5) * 0.35;
          ctx.fillStyle = `rgba(200, 230, 255, ${shimmer})`;
          ctx.fillRect(bx + wx, wy, 6, 8);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(bx + wx, wy, 2, 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawPipes(ctx) {
    const off = this.cam.x * 0.2;
    ctx.strokeStyle = "rgba(60, 130, 100, 0.28)";
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 200 - off) % (W + 100));
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 40, 120);
      ctx.lineTo(x + 40, H);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(80, 160, 120, 0.1)";
    for (let i = 0; i < 5; i++) {
      const x = ((i * 220 - off * 1.2) % W);
      ctx.beginPath();
      ctx.arc(x, 80 + i * 30, 40, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWorld(ctx) {
    const cam = this.cam;

    // perspective ground grid (pseudo-3D)
    drawPerspectiveGround(ctx, W, H, cam.x, this.level.theme || this.level.bg?.scenery || "urban");

    // platforms (+ optional extrusion)
    for (const p of this.level.platforms) {
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      if (sx + p.w < -40 || sx > W + 40) continue;
      if (ENABLE_3D && !p.oneWay) {
        const cols = extrusionColorsForStyle(p.style || "metal");
        drawExtrusion(ctx, sx, sy, p.w, p.h, {
          topColor: cols.top,
          sideColor: cols.side,
          frontColor: cols.front,
          dx: p.hazard ? 6 : 11,
          dy: p.hazard ? 4 : 8,
        });
      } else if (ENABLE_3D && p.oneWay) {
        const cols = extrusionColorsForStyle(p.style || "neon");
        drawExtrusion(ctx, sx, sy, p.w, p.h, {
          topColor: cols.top,
          sideColor: cols.side,
          frontColor: cols.front,
          dx: 7,
          dy: 5,
        });
      }
      drawPlatformLive(ctx, sx, sy, p.w, p.h, p);
    }

    // pickups
    for (const item of this.pickups) {
      if (!item.alive) continue;
      const sx = item.x - cam.x;
      const sy = item.y - cam.y + Math.sin(item.bob) * 4;
      if (sx < -30 || sx > W + 30) continue;
      drawPickupLive(ctx, sx, sy, item);
    }

    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const sx = e.x - cam.x;
      const sy = e.y - cam.y;
      if (sx < -60 || sx > W + 60) continue;
      drawContactBlob(ctx, sx, sy, e.w, e.h, e.type === "heavy" ? 1.2 : 1);
      drawEnemyLive(ctx, sx, sy, e, this.time);
    }

    // boss
    if (this.boss && (this.boss.alive || this.bossActive)) {
      const b = this.boss;
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      if (b.alive) {
        drawContactBlob(ctx, sx, sy, b.w, b.h, 1.4);
        drawBossLive(ctx, sx, sy, b, this.time);
      }
    }

    // bullets
    for (const b of this.bullets) drawBulletLive(ctx, b.x - cam.x, b.y - cam.y, b, this.time);
    for (const b of this.enemyBullets) drawBulletLive(ctx, b.x - cam.x, b.y - cam.y, b, this.time);

    // player
    if (this.player?.alive) {
      const p = this.player;
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      const blink = p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0;
      if (!blink) {
        drawContactBlob(ctx, sx, sy, p.w, p.h, 1.1);
        const wcol = WEAPONS[p.weapon]?.color || "#00f0ff";
        drawPlayerLive(ctx, sx, sy, p.w, p.h, p.facing, p.anim, p.animT, {
          recoil: p.recoil,
          landSquash: p.landSquash,
          muzzleFlash: p.muzzleFlash,
          weaponColor: wcol,
          invuln: p.invuln > 0,
          flip: p.flip || 0,
          flipSpeed: p.flipSpeed || 0,
          fun: p.fun,
          funT: p.funT || 0,
        });
      }
    }

    this.particles.draw(ctx, cam);

    // floating texts
    ctx.font = "bold 14px Share Tech Mono, monospace";
    ctx.textAlign = "center";
    for (const f of this.floatingTexts) {
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
    }
    ctx.globalAlpha = 1;

    // soft daylight edge
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, "rgba(255,255,255,0)");
    vg.addColorStop(1, "rgba(120, 160, 200, 0.18)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  drawBossBar(ctx) {
    const b = this.boss;
    const pct = clamp(b.hp / b.maxHp, 0, 1);
    const bw = 420;
    const bx = (W - bw) / 2;
    const by = 28;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(bx - 4, by - 16, bw + 8, 28);
    ctx.font = "12px Orbitron, sans-serif";
    ctx.fillStyle = "#ff2bd6";
    ctx.textAlign = "center";
    ctx.fillText(b.name, W / 2, by - 4);
    ctx.fillStyle = "#221018";
    ctx.fillRect(bx, by + 2, bw, 10);
    const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grd.addColorStop(0, "#ff3b5c");
    grd.addColorStop(0.5, "#ff9f1a");
    grd.addColorStop(1, "#39ff9a");
    ctx.fillStyle = grd;
    ctx.fillRect(bx, by + 2, bw * pct, 10);
    ctx.strokeStyle = "rgba(0,240,255,0.5)";
    ctx.strokeRect(bx, by + 2, bw, 10);
  }

  drawEnergy(ctx) {
    const p = this.player;
    const pct = p.energy / p.maxEnergy;
    const bw = 120;
    const bx = 24;
    const by = H - 28;
    ctx.font = "10px Share Tech Mono, monospace";
    ctx.fillStyle = "#7a8aaa";
    ctx.textAlign = "left";
    ctx.fillText("ENERGY", bx, by - 4);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = "#ff2bd6";
    ctx.shadowColor = "#ff2bd6";
    ctx.shadowBlur = 8;
    ctx.fillRect(bx, by, bw * pct, 8);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,43,214,0.4)";
    ctx.strokeRect(bx, by, bw, 8);
  }

  drawArsenal(ctx) {
    const p = this.player;
    if (!p) return;
    const slotW = 58;
    const slotH = 30;
    const total = WEAPON_ORDER.length;
    const gap = 3;
    const startX = W - 16 - total * (slotW + gap);
    const y = H - 42;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < total; i++) {
      const id = WEAPON_ORDER[i];
      const w = WEAPONS[id];
      const x = startX + i * (slotW + gap);
      const owned = !!p.owned[id];
      const active = p.weapon === id;
      const ammo = w.infinite ? "∞" : String(p.ammo[id] || 0);
      const empty = owned && !w.infinite && (p.ammo[id] || 0) <= 0;
      const heavy = !!w.antiTank;

      ctx.globalAlpha = owned ? 1 : 0.32;
      ctx.fillStyle = active ? "rgba(0,40,60,0.9)" : heavy ? "rgba(40,8,12,0.75)" : "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y, slotW, slotH);
      ctx.strokeStyle = active ? w.color : owned ? (heavy ? "rgba(255,50,80,0.5)" : "rgba(0,240,255,0.35)") : "rgba(100,110,130,0.3)";
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, slotW - 1, slotH - 1);

      ctx.fillStyle = owned ? (empty ? "#ff3b5c" : w.color) : "#556";
      ctx.font = "bold 8px Orbitron, sans-serif";
      const label = w.name.length > 7 ? w.name.slice(0, 6) : w.name;
      ctx.fillText(`${i + 1}${heavy ? "★" : ""}`, x + slotW / 2, y + 8);
      ctx.fillText(label, x + slotW / 2, y + 17);
      ctx.font = "8px Share Tech Mono, monospace";
      ctx.fillStyle = owned ? "#e8f0ff" : "#445";
      ctx.fillText(owned ? ammo : "—", x + slotW / 2, y + 25);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.font = "9px Share Tech Mono, monospace";
    ctx.fillStyle = "#7a8aaa";
    ctx.textAlign = "right";
    ctx.fillText("J → · E ↗ · X ↘ · K switch", W - 16, y - 6);
  }
}

// ─── Factories ──────────────────────────────────────────

function createPlayer(x, y) {
  const owned = { blaster: true };
  const ammo = {};
  for (const id of WEAPON_ORDER) {
    if (id !== "blaster") {
      owned[id] = false;
      ammo[id] = 0;
    }
  }
  return {
    x,
    y,
    w: STAND_W,
    h: STAND_H,
    vx: 0,
    vy: 0,
    speed: 300,
    jumpV: -640,
    onGround: false,
    facing: 1,
    jumps: 0,
    maxJumps: 2,
    hp: 6,
    maxHp: 6,
    energy: 100,
    maxEnergy: 100,
    weapon: "blaster",
    owned,
    ammo,
    fireCd: 0,
    specialCd: 0,
    invuln: 1.5,
    alive: true,
    anim: "idle",
    animT: 0,
    dropTimer: 0,
    recoil: 0,
    landSquash: 0,
    muzzleFlash: 0,
    wasOnGround: true,
    dustT: 0,
    prone: false,
    proneLock: 0,
    flip: 0,
    flipSpeed: 0,
    fun: null,
    funT: 0,
    funDur: 0,
    funCd: 0.5,
  };
}

function pickFun(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function startFunAnim(p, name) {
  if (!p || p.prone) return;
  p.fun = name;
  p.funT = 0;
  p.funDur = name === "spin" ? 0.55 : name === "kick" ? 0.4 : name === "dance" ? 0.9 : 0.7;
}

/** Keep feet planted while swapping stand/prone hitboxes */
function setPlayerProne(p, prone) {
  if (!p || !!p.prone === !!prone) return;
  const feet = p.y + p.h;
  const cx = p.x + p.w / 2;
  p.prone = !!prone;
  if (prone) {
    p.w = PRONE_W;
    p.h = PRONE_H;
  } else {
    p.w = STAND_W;
    p.h = STAND_H;
  }
  p.x = cx - p.w / 2;
  p.y = feet - p.h;
}

/** Standing chest/torso aim point from feet — shots sail over a prone player */
function playerTorsoAim(p) {
  const feet = p.y + p.h;
  return {
    x: p.x + p.w / 2,
    y: feet - STAND_H * 0.55,
  };
}

function captureArsenal(p) {
  if (!p) return null;
  return {
    owned: { ...p.owned },
    ammo: { ...p.ammo },
    weapon: p.weapon,
  };
}

function applyArsenal(p, kit) {
  if (!p || !kit) return;
  p.owned = { ...p.owned, ...kit.owned };
  p.ammo = { ...p.ammo, ...kit.ammo };
  p.weapon = kit.weapon && p.owned[kit.weapon] ? kit.weapon : "blaster";
}

function canUseWeapon(p, id) {
  const w = WEAPONS[id];
  if (!w || !p.owned[id]) return false;
  if (w.infinite) return true;
  return (p.ammo[id] || 0) > 0;
}

function createEnemy(def) {
  const base = {
    type: def.type,
    x: def.x,
    y: def.y,
    vx: 0,
    vy: 0,
    facing: -1,
    alive: true,
    flash: 0,
    animT: 0,
    onGround: false,
    fireCd: rand(0.3, 1.2),
  };

  switch (def.type) {
    case "grunt":
      return { ...base, w: 30, h: 40, speed: 70, hp: 3, score: 200, color: "#ff3b5c", turnT: rand(1, 2) };
    case "shooter":
      return { ...base, w: 28, h: 42, speed: 0, hp: 4, score: 350, color: "#ff9f1a" };
    case "turret":
      return { ...base, w: 32, h: 28, speed: 0, hp: 6, score: 400, color: "#b48aff" };
    case "heavy":
      // slow armored brute
      return { ...base, w: 40, h: 48, speed: 42, hp: 12, score: 500, color: "#6b7c93", turnT: rand(1.5, 2.5), armored: true };
    case "rusher":
      // charges the player
      return {
        ...base, w: 28, h: 38, speed: 55, hp: 3, score: 300, color: "#ff6b35",
        chargeCd: rand(0.5, 1.5), charging: false, chargeT: 0, turnT: rand(1, 2),
      };
    case "bomber":
      // lobs arcing grenades
      return { ...base, w: 30, h: 40, speed: 45, hp: 5, score: 400, color: "#c4a035", turnT: rand(1.2, 2.2), fireCd: rand(0.8, 1.6) };
    case "sniper":
      // long-range, telegraph beam then high dmg
      return {
        ...base, w: 26, h: 44, speed: 0, hp: 3, score: 450, color: "#3d8b7a",
        fireCd: rand(1.5, 2.5), aimT: 0, aiming: false,
      };
    case "shield":
      // frontal shield blocks weak shots
      return {
        ...base, w: 32, h: 42, speed: 50, hp: 8, score: 450, color: "#5b8def",
        turnT: rand(1.5, 2.5), shield: true,
      };
    case "hopper":
      // jumps toward player
      return {
        ...base, w: 28, h: 34, speed: 40, hp: 4, score: 350, color: "#9b59b6",
        hopCd: rand(0.6, 1.2),
      };
    case "drone":
      // low hover (not free-fly orbs) — stays near spawn height, short range
      return {
        ...base, w: 30, h: 22, speed: 70, hp: 3, score: 320, color: "#1abc9c",
        baseY: def.y, phase: rand(0, Math.PI * 2), amp: 12, fireCd: rand(0.8, 1.4),
        minX: def.x - 100, maxX: def.x + 100,
      };
    default:
      return { ...base, w: 30, h: 40, speed: 70, hp: 3, score: 200, color: "#ff3b5c", turnT: 1.5 };
  }
}

function createBoss(def) {
  if (def.type === "apc") {
    const hp = def.hp ?? 60;
    return {
      type: "apc",
      name: def.name,
      x: def.x,
      y: def.y - 40,
      targetY: def.y,
      w: 96,
      h: 64,
      vx: 0,
      vy: 0,
      facing: -1,
      speed: def.speed ?? 110,
      hp,
      maxHp: hp,
      score: def.score ?? 5000,
      alive: true,
      flash: 0,
      animT: 0,
      onGround: false,
      fireCd: 1,
      slamCd: 2,
      intro: 1.2,
      minX: def.x - 500,
      maxX: def.x + 80,
      phase: 0,
    };
  }
  const hp = def.hp ?? 80;
  return {
    type: "sentinel",
    name: def.name,
    x: def.x,
    y: 80,
    targetY: def.y,
    w: 72,
    h: 72,
    vx: 0,
    vy: 0,
    facing: -1,
    speed: def.speed ?? 60,
    hp,
    maxHp: hp,
    score: def.score ?? 8000,
    alive: true,
    flash: 0,
    animT: 0,
    onGround: false,
    fireCd: 1.5,
    slamCd: 3,
    intro: 1.5,
    minX: def.x - 450,
    maxX: def.x + 100,
    phase: 0,
    hoverT: 0,
  };
}

// ─── Drawing helpers ────────────────────────────────────

function drawPlatform(ctx, x, y, w, h, p) {
  if (p.hazard) {
    if (p.style === "lava") {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#ff9f1a");
      g.addColorStop(1, "#ff3b5c");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,230,100,0.5)";
      for (let i = 0; i < w; i += 12) {
        const wave = Math.sin(Date.now() / 200 + i) * 3;
        ctx.fillRect(x + i, y + wave, 8, 4);
      }
    } else {
      // spikes
      ctx.fillStyle = "#4a5068";
      ctx.fillRect(x, y + h - 6, w, 6);
      ctx.fillStyle = "#c0c8e0";
      for (let i = 0; i < w; i += 12) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + h - 6);
        ctx.lineTo(x + i + 6, y);
        ctx.lineTo(x + i + 12, y + h - 6);
        ctx.fill();
      }
    }
    return;
  }

  if (p.oneWay) {
    ctx.fillStyle = p.style === "tech" ? "#5a8f78" : "#6a8aaa";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = p.style === "tech" ? "#2ecc8a" : "#3db8e8";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fillRect(x, y, w, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(x + 4, y + 5, w - 8, 2);
    return;
  }

  // solid
  if (p.style === "street") {
    ctx.fillStyle = "#6b7588";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#8a94a8";
    ctx.fillRect(x, y, w, 8);
    ctx.strokeStyle = "#f0d060";
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + w, y + 4);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (p.style === "tech") {
    ctx.fillStyle = "#5a7d6c";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#6f9a82";
    ctx.fillRect(x, y, w, 6);
    ctx.strokeStyle = "rgba(40, 160, 110, 0.45)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    for (let i = 10; i < w; i += 24) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x + i, y + 10, 8, 4);
    }
  } else {
    ctx.fillStyle = "#7a8498";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#9aa4b8";
    ctx.fillRect(x, y, w, 5);
    ctx.strokeStyle = "rgba(60, 140, 180, 0.35)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, Math.min(h, 20));
  }
}

function drawCommando(ctx, x, y, w, h, facing, anim, t, flash, fx = {}) {
  ctx.save();
  const squash = fx.landSquash || 0;
  const scaleY = 1 - squash * 0.18;
  const scaleX = 1 + squash * 0.12;
  ctx.translate(x + w / 2, y + h);
  ctx.scale(facing * scaleX, scaleY);
  ctx.translate(0, -h);

  const prone = anim === "prone" || anim === "crawl";
  const runPhase = t * 16;
  const runBob = anim === "run" ? Math.abs(Math.sin(runPhase)) * 3 : anim === "idle" ? Math.sin(t * 3) * 1.2 : 0;
  const bodyH = h;
  const bodyY = prone ? 0 : runBob;
  const recoil = (fx.recoil || 0) * 14;
  const wc = fx.weaponColor || "#00f0ff";

  // ── PRONE / CRAWL: flat on the ground, under fire ──
  if (prone) {
    const crawl = anim === "crawl" ? Math.sin(t * 14) * 3 : 0;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, h - 1, w * 0.48, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs stretched back
    ctx.strokeStyle = "#152238";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, h * 0.55);
    ctx.lineTo(-18 - crawl, h * 0.7);
    ctx.lineTo(-22 - crawl, h - 2);
    ctx.moveTo(-2, h * 0.55);
    ctx.lineTo(-12 + crawl, h * 0.72);
    ctx.lineTo(-16 + crawl, h - 2);
    ctx.stroke();
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(-26 - crawl, h - 5, 8, 3);
    ctx.fillRect(-20 + crawl, h - 5, 8, 3);

    // torso flat
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, flash || fx.invuln ? "#fff" : "#2f7fb0");
    grd.addColorStop(1, "#1a3558");
    ctx.fillStyle = grd;
    roundRect(ctx, -w * 0.42, h * 0.15, w * 0.7, h * 0.7, 4);
    ctx.fill();

    // chest glow
    ctx.fillStyle = wc;
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = wc;
    ctx.shadowBlur = 8;
    ctx.fillRect(-4, h * 0.35, 10, 5);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // head low, facing forward
    ctx.fillStyle = flash ? "#fff" : "#d0dceb";
    ctx.beginPath();
    ctx.arc(w * 0.22, h * 0.4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(w * 0.14, h * 0.32, 12, 5);
    ctx.fillStyle = wc;
    ctx.shadowColor = wc;
    ctx.shadowBlur = 8;
    ctx.fillRect(w * 0.16, h * 0.34, 10, 2.5);
    ctx.shadowBlur = 0;

    // bandana
    ctx.fillStyle = "#ff2bd6";
    ctx.fillRect(w * 0.12, h * 0.28, 12, 2);

    // gun along ground
    ctx.fillStyle = "#1e2838";
    roundRect(ctx, w * 0.18 - recoil, h * 0.55, 22, 6, 2);
    ctx.fill();
    ctx.fillStyle = wc;
    ctx.fillRect(w * 0.18 + 18 - recoil, h * 0.56, 5, 4);

    if ((fx.muzzleFlash || 0) > 0) {
      const mf = fx.muzzleFlash / 0.06;
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = mf;
      ctx.beginPath();
      ctx.arc(w * 0.18 + 24 - recoil, h * 0.58, 5 * mf, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    return;
  }

  // ground shadow (pulse with run)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  const shW = w * (0.38 + (anim === "run" ? 0.06 * Math.sin(runPhase) : 0));
  ctx.ellipse(0, h - 1, shW, 4 + (anim === "jump" || anim === "fall" ? 1 : 0), 0, 0, Math.PI * 2);
  ctx.fill();

  // legs — explicit walk cycle
  ctx.strokeStyle = "#152238";
  ctx.lineWidth = 5.5;
  ctx.lineCap = "round";
  if (anim === "run") {
    const a = Math.sin(runPhase);
    const b = Math.sin(runPhase + Math.PI);
    // thigh/shin bend illusion
    ctx.beginPath();
    ctx.moveTo(-5, bodyY + bodyH * 0.52);
    ctx.lineTo(-8 + a * 4, bodyY + bodyH * 0.72);
    ctx.lineTo(-6 + a * 10, bodyY + bodyH - 1 + Math.max(0, -a) * 2);
    ctx.moveTo(5, bodyY + bodyH * 0.52);
    ctx.lineTo(8 + b * 4, bodyY + bodyH * 0.72);
    ctx.lineTo(6 + b * 10, bodyY + bodyH - 1 + Math.max(0, -b) * 2);
    ctx.stroke();
    // boots
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(-10 + a * 10, bodyY + bodyH - 5, 9, 4);
    ctx.fillRect(2 + b * 10, bodyY + bodyH - 5, 9, 4);
  } else if (anim === "jump") {
    ctx.beginPath();
    ctx.moveTo(-6, bodyY + bodyH * 0.5);
    ctx.lineTo(-12, bodyY + bodyH * 0.72);
    ctx.lineTo(-8, bodyY + bodyH * 0.9);
    ctx.moveTo(5, bodyY + bodyH * 0.5);
    ctx.lineTo(12, bodyY + bodyH * 0.7);
    ctx.lineTo(10, bodyY + bodyH * 0.88);
    ctx.stroke();
  } else if (anim === "fall") {
    ctx.beginPath();
    ctx.moveTo(-5, bodyY + bodyH * 0.52);
    ctx.lineTo(-3, bodyY + bodyH * 0.95);
    ctx.moveTo(5, bodyY + bodyH * 0.52);
    ctx.lineTo(8, bodyY + bodyH * 0.95);
    ctx.stroke();
  } else {
    const idleShift = Math.sin(t * 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(-4, bodyY + bodyH * 0.55);
    ctx.lineTo(-5 + idleShift, bodyY + bodyH - 2);
    ctx.moveTo(4, bodyY + bodyH * 0.55);
    ctx.lineTo(5 - idleShift, bodyY + bodyH - 2);
    ctx.stroke();
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(-8, bodyY + bodyH - 5, 8, 4);
    ctx.fillRect(1, bodyY + bodyH - 5, 8, 4);
  }

  // cape / scarf trail when moving
  if (anim === "run" || anim === "jump" || anim === "fall") {
    const flap = Math.sin(t * 12) * 4;
    ctx.fillStyle = "rgba(255,43,214,0.55)";
    ctx.beginPath();
    ctx.moveTo(-6, bodyY + bodyH * 0.28);
    ctx.quadraticCurveTo(-16 - Math.abs(pVel(anim)), bodyY + bodyH * 0.45 + flap, -14, bodyY + bodyH * 0.65);
    ctx.lineTo(-4, bodyY + bodyH * 0.4);
    ctx.fill();
  }

  // torso
  const grd = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grd.addColorStop(0, "#1a3558");
  grd.addColorStop(0.5, flash || fx.invuln ? "#fff" : "#2f7fb0");
  grd.addColorStop(1, "#1a3558");
  ctx.fillStyle = grd;
  roundRect(ctx, -w * 0.36, bodyY + bodyH * 0.22, w * 0.72, bodyH * 0.42, 5);
  ctx.fill();

  // armor plates
  ctx.fillStyle = "rgba(0,240,255,0.15)";
  ctx.fillRect(-w * 0.28, bodyY + bodyH * 0.28, w * 0.2, bodyH * 0.28);
  ctx.fillRect(w * 0.08, bodyY + bodyH * 0.28, w * 0.2, bodyH * 0.28);

  // chest core pulse
  const pulse = 0.55 + Math.sin(t * 8) * 0.45;
  ctx.fillStyle = fx.weaponColor || "#00f0ff";
  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.shadowColor = fx.weaponColor || "#00f0ff";
  ctx.shadowBlur = 10;
  ctx.fillRect(-4, bodyY + bodyH * 0.34, 8, 10);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // back arm swing
  if (anim === "run") {
    const arm = Math.sin(runPhase + Math.PI) * 8;
    ctx.strokeStyle = "#6a849e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, bodyY + bodyH * 0.32);
    ctx.lineTo(-12, bodyY + bodyH * 0.45 + arm);
    ctx.stroke();
  }

  // head + helmet
  const headY = bodyY + bodyH * 0.15;
  ctx.fillStyle = flash ? "#fff" : "#d0dceb";
  ctx.beginPath();
  ctx.arc(0, headY, 10, 0, Math.PI * 2);
  ctx.fill();
  // helmet shell
  ctx.fillStyle = "#1a2840";
  ctx.beginPath();
  ctx.arc(0, headY - 2, 10, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(-9, headY - 2, 18, 6);
  // animated visor scanline
  ctx.fillStyle = fx.weaponColor || "#00f0ff";
  ctx.shadowColor = fx.weaponColor || "#00f0ff";
  ctx.shadowBlur = 12;
  ctx.fillRect(-7, headY - 1, 14, 3.5);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(-7 + (Math.sin(t * 6) * 0.5 + 0.5) * 10, headY - 1, 3, 3.5);
  ctx.shadowBlur = 0;

  // bandana streamers
  ctx.fillStyle = "#ff2bd6";
  ctx.fillRect(-9, headY - 8, 18, 3);
  const stream = Math.sin(t * 10) * 3;
  ctx.beginPath();
  ctx.moveTo(-9, headY - 6);
  ctx.quadraticCurveTo(-18, headY - 4 + stream, -20, headY + 4 + stream);
  ctx.lineTo(-9, headY - 4);
  ctx.fill();

  // gun arm with recoil
  const gunY = bodyY + bodyH * 0.36;
  ctx.strokeStyle = "#8aa0c0";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(6, bodyY + bodyH * 0.34);
  ctx.lineTo(16 - recoil * 0.3, gunY);
  ctx.stroke();

  // weapon body
  ctx.fillStyle = "#1e2838";
  roundRect(ctx, 12 - recoil, gunY - 4, 20, 9, 2);
  ctx.fill();
  ctx.fillStyle = wc;
  ctx.shadowColor = wc;
  ctx.shadowBlur = 8;
  ctx.fillRect(28 - recoil, gunY - 2, 6, 5);
  ctx.shadowBlur = 0;

  // muzzle flash sprite
  if ((fx.muzzleFlash || 0) > 0) {
    const mf = fx.muzzleFlash / 0.06;
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = mf;
    ctx.beginPath();
    ctx.moveTo(34 - recoil, gunY);
    ctx.lineTo(34 - recoil + 14 * mf, gunY - 6 * mf);
    ctx.lineTo(34 - recoil + 10 * mf, gunY);
    ctx.lineTo(34 - recoil + 14 * mf, gunY + 6 * mf);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = wc;
    ctx.beginPath();
    ctx.arc(34 - recoil + 4, gunY, 5 * mf, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function pVel(anim) {
  return anim === "run" ? 6 : anim === "jump" || anim === "fall" ? 10 : 0;
}

function drawEnemy(ctx, x, y, e, time) {
  ctx.save();
  if (e.flash > 0) ctx.globalAlpha = 0.45 + Math.sin(time * 50) * 0.55;

  if (e.type === "flyer") {
    ctx.translate(x + e.w / 2, y + e.h / 2);
    const flap = Math.sin(e.animT * 18) * 10;
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(0, Math.sin(e.animT * 6) * 2, e.w / 2, e.h / 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,240,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(-14, flap, 14, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(14, -flap, 14, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-4, -3, 8, 5);
    ctx.fillStyle = "#ff3b5c";
    ctx.fillRect(-1, -2, 4, 3);
  } else if (e.type === "turret") {
    const spin = e.animT * 4;
    // base
    ctx.fillStyle = "#1a1a2a";
    ctx.fillRect(x + 2, y + e.h * 0.55, e.w - 4, e.h * 0.45);
    // rotating ring
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + e.w / 2, y + e.h * 0.42, 14, spin, spin + Math.PI * 1.2);
    ctx.stroke();
    ctx.fillStyle = e.flash > 0 ? "#fff" : e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x + e.w / 2, y + e.h * 0.42, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // barrel recoil pulse
    const br = 14 + Math.sin(e.animT * 8) * 1;
    ctx.fillStyle = "#111";
    const bx = e.facing > 0 ? x + e.w / 2 + 6 : x + e.w / 2 - 6 - br;
    ctx.fillRect(bx, y + e.h * 0.36, br, 7);
    // status light blink
    ctx.fillStyle = Math.floor(time * 4) % 2 ? "#ff3b5c" : "#3a0a10";
    ctx.beginPath();
    ctx.arc(x + e.w / 2, y + e.h * 0.42, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // grunt / shooter — walk cycle
    ctx.translate(x + e.w / 2, y);
    ctx.scale(e.facing, 1);
    const walk = e.type === "grunt" ? e.animT * 12 : e.animT * 4;
    const bob = e.type === "grunt" ? Math.abs(Math.sin(walk)) * 2 : Math.sin(e.animT * 3);
    const swing = e.type === "grunt" ? Math.sin(walk) * 9 : 0;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, e.h - 1, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    ctx.strokeStyle = "#2a0a14";
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-5, e.h * 0.52 + bob);
    ctx.lineTo(-6 + swing, e.h - 2);
    ctx.moveTo(5, e.h * 0.52 + bob);
    ctx.lineTo(6 - swing, e.h - 2);
    ctx.stroke();

    // body
    ctx.fillStyle = e.flash > 0 ? "#fff" : e.color;
    roundRect(ctx, -e.w * 0.36, e.h * 0.2 + bob, e.w * 0.72, e.h * 0.42, 4);
    ctx.fill();
    // shoulder pads
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-e.w * 0.38, e.h * 0.24 + bob, 8, 10);
    ctx.fillRect(e.w * 0.18, e.h * 0.24 + bob, 8, 10);

    // head
    ctx.fillStyle = "#f0d8d8";
    ctx.beginPath();
    ctx.arc(0, e.h * 0.16 + bob, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0508";
    ctx.fillRect(1, e.h * 0.12 + bob, 7, 4);
    // eye glow
    ctx.fillStyle = "#ff3b5c";
    ctx.shadowColor = "#ff3b5c";
    ctx.shadowBlur = 6;
    ctx.fillRect(4, e.h * 0.13 + bob, 3, 2);
    ctx.shadowBlur = 0;

    if (e.type === "shooter") {
      // aim pose + muzzle blink when "firing" phase
      const aimKick = Math.sin(e.animT * 2) > 0.85 ? 3 : 0;
      ctx.fillStyle = "#333";
      ctx.fillRect(8 - aimKick, e.h * 0.34 + bob, 16, 6);
      ctx.fillStyle = "#ff9f1a";
      ctx.fillRect(22 - aimKick, e.h * 0.35 + bob, 4, 4);
      if (aimKick) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(26, e.h * 0.37 + bob);
        ctx.lineTo(34, e.h * 0.34 + bob);
        ctx.lineTo(34, e.h * 0.4 + bob);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      // fist pump while running
      ctx.strokeStyle = "#4a1520";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, e.h * 0.32 + bob);
      ctx.lineTo(14, e.h * 0.4 + bob - swing * 0.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBoss(ctx, x, y, b, time) {
  ctx.save();
  if (b.flash > 0) ctx.globalAlpha = 0.55 + Math.sin(time * 40) * 0.4;

  if (b.type === "apc") {
    const roll = time * 8;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(x + b.w / 2, y + b.h + 2, b.w * 0.45, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // chassis bob
    const bob = Math.sin(time * 10) * 1.5;
    // body
    ctx.fillStyle = "#2a2030";
    roundRect(ctx, x, y + 16 + bob, b.w, b.h - 16, 6);
    ctx.fill();
    // neon stripe pulse
    const stripe = 0.5 + Math.sin(time * 6) * 0.5;
    ctx.fillStyle = `rgba(255,43,214,${0.45 + stripe * 0.55})`;
    ctx.shadowColor = "#ff2bd6";
    ctx.shadowBlur = 16;
    ctx.fillRect(x + 10, y + 24 + bob, b.w - 20, 8);
    ctx.shadowBlur = 0;
    // cabin
    ctx.fillStyle = "#3a3048";
    roundRect(ctx, x + b.w * 0.55, y + bob, b.w * 0.4, 28, 4);
    ctx.fill();
    // animated window glow
    ctx.fillStyle = `rgba(0,240,255,${0.4 + stripe * 0.5})`;
    ctx.fillRect(x + b.w * 0.62, y + 8 + bob, 20, 8);
    // armor panels
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < 4; i++) {
      ctx.strokeRect(x + 12 + i * 18, y + 36 + bob, 14, 12);
    }
    // wheels spin
    for (const wx of [22, b.w - 22]) {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.arc(x + wx, y + b.h - 4, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ff9f1a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + wx, y + b.h - 4, 9, roll + wx, roll + wx + Math.PI);
      ctx.stroke();
      ctx.strokeStyle = "#666";
      ctx.beginPath();
      ctx.moveTo(x + wx, y + b.h - 4);
      ctx.lineTo(x + wx + Math.cos(roll) * 8, y + b.h - 4 + Math.sin(roll) * 8);
      ctx.stroke();
    }
    // gun with recoil pulse
    const kick = Math.sin(time * 3) > 0.7 ? 6 : 0;
    ctx.fillStyle = "#555";
    const gx = b.facing > 0 ? x + b.w - 10 - kick : x - 20 + kick;
    ctx.fillRect(gx, y + 30 + bob, 30, 8);
    if (kick) {
      ctx.fillStyle = "#ff9f1a";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      const tip = b.facing > 0 ? gx + 30 : gx;
      ctx.arc(tip, y + 34 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    // sentinel — orbiting shards + pulse core
    const cx = x + b.w / 2;
    const cy = y + b.h / 2;
    const pulse = 0.7 + Math.sin(time * 5) * 0.3;

    // outer energy field
    ctx.strokeStyle = `rgba(57,255,154,${0.25 * pulse})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, (28 + i * 12) * pulse, (16 + i * 5) * pulse, time * (0.8 + i * 0.3), 0, Math.PI * 2);
      ctx.stroke();
    }

    // orbiting shards
    for (let i = 0; i < 6; i++) {
      const ang = time * 2 + (i / 6) * Math.PI * 2;
      const ox = cx + Math.cos(ang) * 38;
      const oy = cy + Math.sin(ang) * 22;
      ctx.fillStyle = i % 2 ? "#39ff9a" : "#00f0ff";
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(ang);
      ctx.fillRect(-3, -6, 6, 12);
      ctx.restore();
    }

    const grd = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, 32);
    grd.addColorStop(0, "#fff");
    grd.addColorStop(0.25, "#39ff9a");
    grd.addColorStop(1, "#0a2a20");
    ctx.fillStyle = grd;
    ctx.shadowColor = "#39ff9a";
    ctx.shadowBlur = 28 * pulse;
    ctx.beginPath();
    ctx.arc(cx, cy, 24 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // iris tracks player-ish
    ctx.fillStyle = "#050a08";
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff3b5c";
    ctx.shadowColor = "#ff3b5c";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(time * 2.2) * 4, cy + Math.cos(time * 1.7) * 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawPickup(ctx, x, y, item, time = 0) {
  const colors = {
    health: "#39ff9a",
    energy: "#ff2bd6",
    rapid: "#ffe566",
    spread: "#39ff9a",
    shotgun: "#ff9f1a",
    laser: "#7df9ff",
    plasma: "#c44dff",
    bazooka: "#ff6b1a",
    rail: "#e8f7ff",
    tankbuster: "#ff2244",
  };
  const labels = {
    health: "H",
    energy: "E",
    rapid: "R",
    spread: "S",
    shotgun: "G",
    laser: "L",
    plasma: "P",
    bazooka: "B",
    rail: "A",
    tankbuster: "T",
  };
  const c = colors[item.type] || "#fff";
  const bob = Math.sin(item.bob) * 4;
  const spin = item.bob * 0.8;
  const pulse = 0.65 + Math.sin(item.bob * 2) * 0.35;

  ctx.save();
  ctx.translate(x + 11, y + 11 + bob);
  // glow halo
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20 * pulse);
  g.addColorStop(0, c + "66");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(Math.sin(spin) * 0.15);
  ctx.shadowColor = c;
  ctx.shadowBlur = 14 * pulse;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(-11, -11, 22, 22);
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.strokeRect(-10, -10, 20, 20);
  // corner ticks
  ctx.fillStyle = c;
  ctx.fillRect(-11, -11, 5, 2);
  ctx.fillRect(6, -11, 5, 2);
  ctx.fillRect(-11, 9, 5, 2);
  ctx.fillRect(6, 9, 5, 2);
  ctx.shadowBlur = 0;
  ctx.font = "bold 12px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(labels[item.type] || "?", 0, 1);
  ctx.restore();
}

function drawBullet(ctx, x, y, b) {
  ctx.save();
  ctx.translate(x + b.w / 2, y + b.h / 2);
  const ang = Math.atan2(b.vy, b.vx);
  ctx.rotate(ang);
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = b.rocket ? 22 : b.special ? 18 : 12;
  if (b.rail && b.friendly) {
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#fff";
    roundRect(ctx, -20, -2, 44, 4, 1);
    ctx.fill();
    ctx.fillStyle = b.color;
    roundRect(ctx, -16, -3, 36, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#7df9ff";
    ctx.globalAlpha = 0.7;
    roundRect(ctx, -24, -1, 12, 2, 1);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (b.laser && b.friendly) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = b.color;
    roundRect(ctx, -12, -1.5, 28, 3, 1);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 1;
    roundRect(ctx, -4, -1, 16, 2, 1);
    ctx.fill();
  } else if (b.orb && b.friendly) {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(-1, -1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (b.rocket && b.friendly) {
    // Bazooka rocket body + fins + nose
    ctx.fillStyle = b.color;
    roundRect(ctx, -12, -4, 22, 8, 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.fillRect(-12, -3, 6, 6);
    ctx.fillStyle = "#ffe566";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(16, -3);
    ctx.lineTo(16, 3);
    ctx.closePath();
    ctx.fill();
    // exhaust glow
    ctx.fillStyle = "#ff3b5c";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(-18 - Math.random() * 4, 0);
    ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (b.special && b.friendly) {
    roundRect(ctx, -10, -5, 20, 10, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-4, -2, 8, 4);
  } else if (!b.friendly) {
    ctx.beginPath();
    ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // glowing slug + soft trail core
    ctx.globalAlpha = 0.35;
    roundRect(ctx, -14, -3, 18, 6, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    roundRect(ctx, -7, -2.5, 14, 5, 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.95;
    ctx.fillRect(-1, -1.5, 8, 3);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
