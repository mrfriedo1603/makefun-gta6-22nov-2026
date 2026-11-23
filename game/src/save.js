// save.js — Solmar Bay saves to the browser's localStorage: cash, health,
// completed missions, the player's position and the time of day. Saving is
// automatic on mission completion and on pause; loading restores a run.

const KEY = 'solmar-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.cash,
      health: state.player.health,
      missionsDone: state.mission.done,
      missionIndex: state.mission.index,
      x: state.player.x,
      y: state.player.y,
      timeOfDay: state.timeOfDay,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch (e) { return null; }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
