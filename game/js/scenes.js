// Dustline — ?scene= presets that stage a deterministic moment for
// screenshots: cover, chase, mission, foot. Each sets fixed positions,
// a fixed RNG seed and starts play immediately (no title screen).
import { mulberry32, rand } from './util.js';
import { LANDMARKS } from './city.js';
import { spawnTraffic, spawnPeds } from './traffic.js';
import { startMission } from './missions.js';
import { showMessage } from './state.js';

function baseSetup(state, seed) {
  const rng = mulberry32(seed);
  state.cars = [];
  state.peds = [];
  state.police = [];
  state.pickups = [];
  state.tailTarget = null;
  state.wanted = 0;
  state.hp = 100;
  state.ammo = 24;
  state.money = 0;
  state.missionsDone = 0;
  state.bustTimer = 0;
  state.noPoliceTimer = 0;
  state.policeSpawnTimer = 0;
  spawnTraffic(state, rng, 10);
  spawnPeds(state, rng, 16);
  // A few pickups lying around.
  state.pickups.push({ x: 1560, y: 830, kind: 'ammo' });
  state.pickups.push({ x: 1640, y: 1520, kind: 'health' });
  state.pickups.push({ x: 1060, y: 420, kind: 'cash' });
  return rng;
}

function putPlayerInCar(state, car, x, y, angle, speed) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.isPlayer = true;
  car.stolen = true;
  state.player.onFoot = false;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.speed = speed;
  state.camera.x = x - 640;
  state.camera.y = y - 360;
}

function makePolice(state, x, y, angle) {
  const car = {
    x, y, angle,
    speed: 280, cruise: 0,
    color: '#1d3a6e',
    hp: 120,
    isPlayer: false, isPolice: true, isTraffic: false,
    wrecked: false, stolen: false, driver: null, target: null,
    ramTimer: 0, sirenPhase: 0,
  };
  state.cars.push(car);
  state.police.push(car);
  return car;
}

export function applyScene(state, name, rng) {
  const scene = name || 'cover';
  if (scene === 'cover') {
    const r = baseSetup(state, 101);
    const car = state.cars.find((c) => !c.isTraffic && !c.wrecked) || state.cars[0];
    putPlayerInCar(state, car, 1600, 1950, -Math.PI / 2, 120);
    car.color = '#c23b2e';
    state.autoDrive = true;
    startMission(state, 0, r);
    state.money = 1250;
    showMessage(state, 'Got wheels', 3);
    state.mode = 'playing';
  } else if (scene === 'chase') {
    const r = baseSetup(state, 202);
    const car = state.cars.find((c) => !c.isTraffic && !c.wrecked) || state.cars[0];
    putPlayerInCar(state, car, 1600, 1500, -Math.PI / 2, 300);
    car.color = '#c9a13b';
    state.autoDrive = true;
    state.wanted = 3;
    state.bestWanted = 3;
    makePolice(state, 1570, 1630, -Math.PI / 2);
    makePolice(state, 1640, 1710, -Math.PI / 2);
    makePolice(state, 1590, 1790, -Math.PI / 2);
    startMission(state, 3, r);
    state.money = 1250;
    showMessage(state, 'Heat Escape: lose the heat!', 3);
    state.mode = 'playing';
  } else if (scene === 'mission') {
    const r = baseSetup(state, 303);
    state.player.onFoot = true;
    state.player.car = null;
    state.player.x = 1790;
    state.player.y = 780;
    state.player.angle = Math.PI / 4;
    state.player.speed = 0;
    state.camera.x = 1790 - 640;
    state.camera.y = 780 - 360;
    // The player's ride, parked by the pumps.
    const car = state.cars.find((c) => !c.isTraffic && !c.wrecked) || state.cars[0];
    car.x = 1980;
    car.y = 760;
    car.angle = Math.PI / 2;
    car.color = '#c23b2e';
    startMission(state, 1, r);
    state.money = 1250;
    state.mode = 'playing';
  } else if (scene === 'foot') {
    const r = baseSetup(state, 404);
    state.player.onFoot = true;
    state.player.car = null;
    state.player.x = 1300;
    state.player.y = 1330;
    state.player.angle = -Math.PI / 2;
    state.player.speed = 0;
    state.camera.x = 1300 - 640;
    state.camera.y = 1330 - 360;
    state.wanted = 1;
    state.bestWanted = 1;
    makePolice(state, 1600, 900, Math.PI);
    // A couple of pedestrians right by the player.
    state.peds.push({ x: 1240, y: 1290, angle: 0, speed: 40, color: '#e8c39e', tx: 1240, ty: 1290, wait: 0, fleeing: false });
    state.peds.push({ x: 1380, y: 1400, angle: 0, speed: 40, color: '#c98d64', tx: 1380, ty: 1400, wait: 0, fleeing: false });
    startMission(state, 0, r);
    state.money = 1250;
    state.mode = 'playing';
  } else {
    state.mode = 'title';
  }
  return rng;
}
