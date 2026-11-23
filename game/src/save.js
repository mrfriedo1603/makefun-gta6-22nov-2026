// Solmar Bay — save / load via localStorage. Progress, cash and completed
// missions persist; the start screen offers Continue when a save exists.

const KEY = 'solmar-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      completedMissions: state.completedMissions,
      hasPistol: state.player.hasPistol,
      nextMission: state.nextMission,
      player: { x: state.player.x, y: state.player.y },
      timeOfDay: state.timeOfDay,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* no storage */ }
}
