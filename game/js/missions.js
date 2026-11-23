// Dustline — the four story missions: Hot Start, The Courier,
// Tail the Runner, Heat Escape. Each pays out on completion.
import { clamp, dist, angleTo, angleLerp, pick } from './util.js';
import { LANDMARKS, nearestIntersection, randomNeighbor } from './city.js';
import { showMessage, saveGame, addWanted } from './state.js';

const GARAGE = { x: LANDMARKS.garage.x + LANDMARKS.garage.w / 2, y: LANDMARKS.garage.y + LANDMARKS.garage.h / 2 };
const GAS = { x: 1900, y: 700 };
const MOTEL = { x: LANDMARKS.motel.x + LANDMARKS.motel.w / 2, y: LANDMARKS.motel.y + LANDMARKS.motel.h / 2 };

export const MISSIONS = [
  {
    title: 'Hot Start',
    brief: 'Mara needs wheels. Steal a car and bring it to Kestrel Garage.',
    payout: 150,
  },
  {
    title: 'The Courier',
    brief: 'Pick up the package at the gas station, then run it to the Palm Motel. Fast.',
    payout: 250,
  },
  {
    title: 'Tail the Runner',
    brief: 'Follow the blue sedan. Stay in the window — not too close, not too far.',
    payout: 350,
  },
  {
    title: 'Heat Escape',
    brief: 'Three stars and every cop in Dustline on you. Lose the heat, then get to the garage.',
    payout: 500,
  },
];

export function startMission(state, index, rng) {
  const def = MISSIONS[index];
  if (!def) {
    state.mission = null;
    state.objective = null;
    return;
  }
  state.missionIndex = index;
  const m = {
    index,
    title: def.title,
    brief: def.brief,
    payout: def.payout,
    stage: 0,
    timer: 0,
    target: null,
  };
  state.mission = m;
  if (index === 0) {
    m.target = { x: GARAGE.x, y: GARAGE.y };
    state.objective = { x: GARAGE.x, y: GARAGE.y, text: 'Hot Start: drive a car to Kestrel Garage' };
    showMessage(state, 'MISSION: Hot Start — steal a car, reach the garage', 4);
  } else if (index === 1) {
    m.target = { x: GAS.x, y: GAS.y };
    state.objective = { x: GAS.x, y: GAS.y, text: 'The Courier: pick up the package at the gas station' };
    showMessage(state, 'MISSION: The Courier — grab the package at the gas station', 4);
  } else if (index === 2) {
    spawnTailTarget(state, rng);
    state.objective = { x: state.tailTarget.x, y: state.tailTarget.y, text: 'Tail the Runner: stay in the window' };
    showMessage(state, 'MISSION: Tail the Runner — follow the blue sedan', 4);
  } else if (index === 3) {
    state.wanted = 3;
    if (state.wanted > state.bestWanted) state.bestWanted = 3;
    m.target = { x: GARAGE.x, y: GARAGE.y };
    state.objective = { x: GARAGE.x, y: GARAGE.y, text: 'Heat Escape: lose the heat, then reach the garage' };
    showMessage(state, 'MISSION: Heat Escape — three stars! Lose them first.', 4);
  }
}

function spawnTailTarget(state, rng) {
  const p = state.player;
  const spot = nearestIntersection(p.x + 500, p.y);
  const car = {
    x: spot.x, y: spot.y,
    angle: 0,
    speed: 0,
    cruise: 150,
    color: '#3a6ea5',
    hp: 100,
    isPlayer: false,
    isPolice: false,
    isTraffic: false,
    wrecked: false,
    stolen: false,
    driver: null,
    target: randomNeighbor(rng, spot),
    isTailTarget: true,
  };
  car.angle = angleTo(car.x, car.y, car.target.x, car.target.y);
  state.cars.push(car);
  state.tailTarget = car;
  state.tailTime = 0;
  state.tailSpotted = 0;
}

function completeMission(state, audio, rng) {
  const m = state.mission;
  if (!m) return;
  state.money += m.payout;
  state.missionsDone += 1;
  showMessage(state, m.title + ' complete! +$' + m.payout, 4);
  audio.blip(660, 0.12);
  setTimeout(() => audio.blip(990, 0.18), 130);
  // Clean up the tail target if it was one.
  if (state.tailTarget) {
    const i = state.cars.indexOf(state.tailTarget);
    if (i >= 0) state.cars.splice(i, 1);
    state.tailTarget = null;
  }
  saveGame(state);
  const next = state.missionIndex + 1;
  if (next < MISSIONS.length) {
    startMission(state, next, rng);
  } else {
    state.mission = null;
    state.objective = { x: GARAGE.x, y: GARAGE.y, text: 'All jobs done — Dustline is yours. Free roam!' };
    showMessage(state, 'All jobs done! Dustline is yours.', 5);
  }
}

export function updateMissions(state, dt, rng, audio) {
  const m = state.mission;
  const p = state.player;
  if (!m) return;

  if (m.index === 0) {
    // Hot Start: reach the garage in a car.
    if (!p.onFoot && dist(p.x, p.y, GARAGE.x, GARAGE.y) < 110) {
      completeMission(state, audio, rng);
    }
  } else if (m.index === 1) {
    if (m.stage === 0) {
      if (dist(p.x, p.y, GAS.x, GAS.y) < 80) {
        m.stage = 1;
        m.timer = 75;
        state.objective = { x: MOTEL.x, y: MOTEL.y, text: 'The Courier: deliver to the Palm Motel' };
        showMessage(state, 'Package secured — run it to the Palm Motel!', 3);
        audio.blip(880, 0.1);
      }
    } else {
      m.timer -= dt;
      state.objective = {
        x: MOTEL.x, y: MOTEL.y,
        text: 'The Courier: deliver to the Palm Motel — ' + Math.max(0, Math.ceil(m.timer)) + 's left',
      };
      if (m.timer <= 0) {
        m.stage = 0;
        state.objective = { x: GAS.x, y: GAS.y, text: 'The Courier: pick up the package at the gas station' };
        showMessage(state, 'Too slow — the package moved. Try again.', 3);
      } else if (dist(p.x, p.y, MOTEL.x, MOTEL.y) < 110) {
        completeMission(state, audio, rng);
      }
    }
  } else if (m.index === 2) {
    const t = state.tailTarget;
    if (!t || t.wrecked) {
      // Target lost: restart the tail.
      if (t) {
        const i = state.cars.indexOf(t);
        if (i >= 0) state.cars.splice(i, 1);
      }
      state.tailTarget = null;
      state.tailTime = 0;
      state.tailSpotted = 0;
      spawnTailTarget(state, rng);
      showMessage(state, 'You lost the runner — he is back on the road.', 3);
      return;
    }
    // Drive the target along the road graph.
    const d = dist(t.x, t.y, t.target.x, t.target.y);
    if (d < 30) {
      t.target = randomNeighbor(rng, nearestIntersection(t.x, t.y));
    } else {
      const want = angleTo(t.x, t.y, t.target.x, t.target.y);
      t.angle = angleLerp(t.angle, want, clamp(3 * dt, 0, 1));
      t.speed = t.cruise;
      t.x += Math.cos(t.angle) * t.speed * dt;
      t.y += Math.sin(t.angle) * t.speed * dt;
    }
    const pd = dist(p.x, p.y, t.x, t.y);
    state.objective = {
      x: t.x, y: t.y,
      text: 'Tail the Runner: stay 100–320px behind — ' + Math.floor(state.tailTime) + '/20s',
    };
    if (pd >= 100 && pd <= 320) {
      state.tailTime += dt;
      state.tailSpotted = 0;
      if (state.tailTime >= 20) completeMission(state, audio, rng);
    } else {
      state.tailTime = Math.max(0, state.tailTime - dt * 0.5);
      if (pd < 60) {
        state.tailSpotted += dt;
        if (state.tailSpotted > 2) {
          state.tailSpotted = 0;
          state.tailTime = 0;
          addWanted(state, 1, 'spotted');
          showMessage(state, 'Spotted! Back off — the runner is nervous.', 3);
        }
      } else {
        state.tailSpotted = 0;
      }
    }
  } else if (m.index === 3) {
    // Heat Escape: first lose the wanted level, then reach the garage.
    if (state.wanted > 0) {
      state.objective = {
        x: GARAGE.x, y: GARAGE.y,
        text: 'Heat Escape: lose the heat first (' + state.wanted + ' stars)',
      };
    } else {
      state.objective = { x: GARAGE.x, y: GARAGE.y, text: 'Heat Escape: reach Kestrel Garage' };
      if (dist(p.x, p.y, GARAGE.x, GARAGE.y) < 120) {
        completeMission(state, audio, rng);
      }
    }
  }
}
