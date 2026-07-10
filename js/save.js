/** Persist run progress in localStorage */

const SAVE_KEY = "neon-strike-save-v1";
const SAVE_VERSION = 1;

export function hasSave() {
  return !!readRaw();
}

export function readRaw() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    const payload = {
      v: SAVE_VERSION,
      savedAt: Date.now(),
      ...data,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function formatSaveSummary(data) {
  if (!data) return "No save";
  const d = new Date(data.savedAt || 0);
  const time = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const lvl = String((data.levelIndex ?? 0) + 1).padStart(2, "0");
  const score = String(Math.floor(data.score ?? 0)).padStart(6, "0");
  return `Lv ${lvl} · Score ${score} · Lives ${data.lives ?? "?"} · ${time}`;
}
