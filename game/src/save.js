// localStorage save: cash, mission progress, collected cash crates and the
// player's position. Everything is wrapped in try/catch — with storage off
// (private windows) the game simply starts fresh every visit.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : 0,
      missionIndex: Number.isFinite(data.missionIndex) ? data.missionIndex : 0,
      crates: Array.isArray(data.crates) ? data.crates.filter((n) => Number.isInteger(n)) : [],
      x: Number.isFinite(data.x) ? data.x : null,
      y: Number.isFinite(data.y) ? data.y : null,
      finished: data.finished === true,
    };
  } catch {
    return null;
  }
}

export function storeSave(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash,
      missionIndex: game.missionIndex,
      crates: game.cratesCollected,
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      finished: game.finished,
    }));
  } catch {
    // Storage unavailable: progress lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
