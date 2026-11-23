// Dustline — game state, plus localStorage save/load.
export const SAVE_KEY = 'dustline-save-v1';

export function createState() {
  return {
    mode: 'title', // title | playing | paused | busted | wasted
    time: 0,
    money: 0,
    ammo: 24,
    hp: 100,
    wanted: 0,
    bestWanted: 0,
    missionsDone: 0,
    missionIndex: 0,
    mission: null, // current mission runtime object
    objective: null, // {x, y, text}
    message: '',
    messageTimer: 0,
    muted: false,
    // Player.
    player: {
      x: 1300, y: 900, angle: -Math.PI / 2, onFoot: true,
      speed: 0, car: null, punchTimer: 0, shootTimer: 0, flash: 0,
    },
    cars: [], // traffic + parked + police cars
    peds: [],
    police: [],
    pickups: [], // {x, y, kind: 'ammo'|'cash'|'health'}
    camera: { x: 1300, y: 900 },
    // When true (scene presets), the player car auto-accelerates so staged
    // screenshots show it moving.
    autoDrive: false,
    // Wanted bookkeeping.
    wantedCooldowns: {},
    noPoliceTimer: 0,
    decayTimer: 0,
    policeSpawnTimer: 0,
    bustTimer: 0,
    // Mission runtime helpers.
    tailTarget: null,
    tailTime: 0,
    tailSpotted: 0,
    heatTimer: 0,
  };
}

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      missionsDone: state.missionsDone,
      bestWanted: state.bestWanted,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable: ignore */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function showMessage(state, text, seconds) {
  state.message = text;
  state.messageTimer = seconds || 3;
}

// Raise the wanted level, with a per-reason cooldown so one crime cannot
// jump straight to five stars. Cap is 5.
export function addWanted(state, n, reason) {
  const now = state.time;
  const last = state.wantedCooldowns[reason] || -100;
  if (now - last < 4) return;
  state.wantedCooldowns[reason] = now;
  state.wanted = Math.min(5, state.wanted + n);
  if (state.wanted > state.bestWanted) state.bestWanted = state.wanted;
}
