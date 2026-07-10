/** Minimal Web Audio SFX — no assets required */

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() {
  try {
    ac();
  } catch (_) {}
}

function tone({ freq = 440, type = "square", dur = 0.08, gain = 0.05, slide = 0, delay = 0 }) {
  if (muted) return;
  try {
    const c = ac();
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (_) {}
}

function noise({ dur = 0.12, gain = 0.04, filterFreq = 1200 }) {
  if (muted) return;
  try {
    const c = ac();
    const n = c.sampleRate * dur;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const g = c.createGain();
    const t0 = c.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start();
  } catch (_) {}
}

export const sfx = {
  shoot() {
    tone({ freq: 880, type: "square", dur: 0.05, gain: 0.035, slide: -400 });
  },
  spread() {
    tone({ freq: 660, type: "sawtooth", dur: 0.06, gain: 0.03, slide: -200 });
    tone({ freq: 990, type: "sawtooth", dur: 0.05, gain: 0.02, delay: 0.02 });
  },
  special() {
    tone({ freq: 220, type: "sawtooth", dur: 0.15, gain: 0.05, slide: 600 });
    noise({ dur: 0.1, gain: 0.03, filterFreq: 2000 });
  },
  bazooka() {
    tone({ freq: 140, type: "sawtooth", dur: 0.18, gain: 0.055, slide: -70 });
    noise({ dur: 0.14, gain: 0.05, filterFreq: 900 });
    tone({ freq: 90, type: "square", dur: 0.08, gain: 0.03, delay: 0.02 });
  },
  laser() {
    tone({ freq: 1400, type: "square", dur: 0.04, gain: 0.025, slide: -600 });
    tone({ freq: 2200, type: "triangle", dur: 0.03, gain: 0.015, delay: 0.01 });
  },
  plasma() {
    tone({ freq: 280, type: "sawtooth", dur: 0.1, gain: 0.04, slide: 120 });
    tone({ freq: 180, type: "triangle", dur: 0.12, gain: 0.03, delay: 0.02 });
  },
  rail() {
    tone({ freq: 90, type: "sawtooth", dur: 0.12, gain: 0.06, slide: 900 });
    noise({ dur: 0.1, gain: 0.05, filterFreq: 3500 });
    tone({ freq: 1800, type: "square", dur: 0.05, gain: 0.03, delay: 0.02, slide: -800 });
  },
  tankbuster() {
    tone({ freq: 70, type: "sawtooth", dur: 0.22, gain: 0.07, slide: -30 });
    noise({ dur: 0.2, gain: 0.06, filterFreq: 600 });
    tone({ freq: 140, type: "square", dur: 0.12, gain: 0.04, delay: 0.04 });
  },
  jump() {
    tone({ freq: 300, type: "square", dur: 0.09, gain: 0.03, slide: 280 });
  },
  hit() {
    noise({ dur: 0.08, gain: 0.05, filterFreq: 900 });
    tone({ freq: 180, type: "square", dur: 0.07, gain: 0.04, slide: -100 });
  },
  enemyDie() {
    tone({ freq: 240, type: "sawtooth", dur: 0.12, gain: 0.04, slide: -180 });
    noise({ dur: 0.15, gain: 0.045, filterFreq: 1500 });
  },
  explode() {
    noise({ dur: 0.28, gain: 0.07, filterFreq: 800 });
    tone({ freq: 120, type: "triangle", dur: 0.25, gain: 0.06, slide: -80 });
  },
  pickup() {
    tone({ freq: 520, type: "square", dur: 0.06, gain: 0.04, slide: 200 });
    tone({ freq: 780, type: "square", dur: 0.08, gain: 0.035, delay: 0.06 });
  },
  hurt() {
    tone({ freq: 140, type: "sawtooth", dur: 0.18, gain: 0.06, slide: -60 });
  },
  bossHit() {
    noise({ dur: 0.12, gain: 0.06, filterFreq: 600 });
    tone({ freq: 90, type: "square", dur: 0.1, gain: 0.05 });
  },
  ui() {
    tone({ freq: 640, type: "square", dur: 0.04, gain: 0.03 });
  },
  level() {
    [440, 554, 659, 880].forEach((f, i) =>
      tone({ freq: f, type: "square", dur: 0.12, gain: 0.04, delay: i * 0.1 })
    );
  },
};
