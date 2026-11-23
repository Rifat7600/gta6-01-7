// Dustline — the player: walking, driving, stealing cars, fighting.
// Raises wanted on crimes through state.addWanted.
import { clamp, dist, angleTo, angleLerp, angleDiff } from './util.js';
import { collideCircle, isOnRoad } from './city.js';
import { addWanted, showMessage } from './state.js';

const FOOT_SPEED = 155;
const CAR_ACCEL = 260;
const CAR_MAX = 345;
const CAR_REVERSE_MAX = 120;

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bd = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function carRadius() {
  return 18;
}

export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.shootTimer = Math.max(0, p.shootTimer - dt);
  p.flash = Math.max(0, p.flash - dt);

  const up = input.isDown('KeyW') || input.isDown('ArrowUp') || state.autoDrive;
  const down = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const handbrake = input.isDown('Space');

  // Enter / exit a car.
  if (input.wasPressed('KeyE')) {
    if (p.onFoot) {
      const car = nearestCar(state, p.x, p.y, 62);
      if (car) {
        if (car.driver) {
          // Steal it: the driver bails out and runs.
          car.driver.fleeing = true;
          car.driver = null;
          addWanted(state, 1, 'steal');
          showMessage(state, 'Car stolen — the heat is on!', 2.5);
          audio.blip(220, 0.15);
        }
        p.onFoot = false;
        p.car = car;
        car.isPlayer = true;
        car.stolen = true;
      }
    } else if (p.car) {
      const car = p.car;
      car.isPlayer = false;
      car.speed = 0;
      p.car = null;
      p.onFoot = true;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      const pos = collideCircle(p.x, p.y, 12);
      p.x = pos.x;
      p.y = pos.y;
      p.angle = car.angle;
    }
  }

  if (p.onFoot) {
    let mx = 0;
    let my = 0;
    if (left) mx -= 1;
    if (right) mx += 1;
    if (up) my -= 1;
    if (down) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      p.angle = Math.atan2(my / len, mx / len);
      p.x += (mx / len) * FOOT_SPEED * dt;
      p.y += (my / len) * FOOT_SPEED * dt;
      const pos = collideCircle(p.x, p.y, 12);
      p.x = pos.x;
      p.y = pos.y;
    }
    p.speed = (mx !== 0 || my !== 0) ? FOOT_SPEED : 0;

    // Punch.
    if (input.wasPressed('KeyF') && p.punchTimer <= 0) {
      p.punchTimer = 0.35;
      punch(state, audio);
    }
    // Shoot with mouse or G.
    if ((input.mouse.clicked || input.wasPressed('KeyG')) && p.shootTimer <= 0) {
      shoot(state, input, audio);
    }
  } else if (p.car) {
    const car = p.car;
    const offRoad = !isOnRoad(car.x, car.y);
    const maxSpeed = offRoad ? CAR_MAX * 0.62 : CAR_MAX;
    if (up) car.speed += CAR_ACCEL * dt * (offRoad ? 0.7 : 1);
    if (down) {
      if (car.speed > 8) car.speed -= CAR_ACCEL * 1.6 * dt;
      else car.speed -= CAR_ACCEL * 0.55 * dt;
    }
    if (!up && !down) car.speed -= Math.sign(car.speed) * 90 * dt;
    if (handbrake) car.speed -= Math.sign(car.speed) * 420 * dt;
    car.speed = clamp(car.speed, -CAR_REVERSE_MAX, maxSpeed);
    if (Math.abs(car.speed) < 4 && !up && !down) car.speed = 0;

    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const steerAuthority = clamp(Math.abs(car.speed) / 90, 0, 1) * (handbrake ? 1.5 : 1);
    car.angle += steer * 2.6 * steerAuthority * dt * (car.speed >= 0 ? 1 : -1);

    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const pos = collideCircle(nx, ny, carRadius());
    // A hard stop against a building hurts the car.
    const hitSpeed = Math.abs(car.speed);
    if ((pos.x !== nx || pos.y !== ny) && hitSpeed > 190) {
      car.hp -= Math.round((hitSpeed - 190) / 9);
      audio.crash();
      if (car.hp <= 0) wreckPlayerCar(state, audio);
    }
    car.x = pos.x;
    car.y = pos.y;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    audio.setEngine(clamp(Math.abs(car.speed) / CAR_MAX, 0, 1));
  }

  // Pickups.
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    const r = p.onFoot ? 30 : 38;
    if (dist(p.x, p.y, pk.x, pk.y) < r) {
      if (pk.kind === 'ammo') {
        state.ammo += 12;
        showMessage(state, '+12 ammo', 1.5);
      } else if (pk.kind === 'cash') {
        state.money += 25;
        showMessage(state, '+$25', 1.5);
      } else if (pk.kind === 'health') {
        state.hp = clamp(state.hp + 30, 0, 100);
        showMessage(state, '+30 health', 1.5);
      }
      audio.blip(880, 0.1);
      state.pickups.splice(i, 1);
    }
  }
}

function punch(state, audio) {
  const p = state.player;
  audio.blip(180, 0.08);
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d < 48) {
      const a = angleTo(p.x, p.y, ped.x, ped.y);
      if (Math.abs(angleDiff(p.angle, a)) < 1.1) {
        state.peds.splice(i, 1);
        state.pickups.push({ x: ped.x, y: ped.y, kind: 'cash' });
        addWanted(state, 1, 'assault');
        showMessage(state, 'You knocked a pedestrian down!', 2);
        return;
      }
    }
  }
}

function shoot(state, input, audio) {
  const p = state.player;
  if (state.ammo <= 0) {
    showMessage(state, 'Out of ammo — find a pickup', 2);
    audio.blip(140, 0.12);
    p.shootTimer = 0.3;
    return;
  }
  state.ammo -= 1;
  p.shootTimer = 0.28;
  p.flash = 0.07;
  audio.shot();
  // Aim at the mouse; G fires straight ahead.
  let aimAngle = p.angle;
  if (input.mouse.clicked) {
    const wx = state.camera.x + input.mouse.x - 640;
    const wy = state.camera.y + input.mouse.y - 360;
    aimAngle = angleTo(p.x, p.y, wx, wy);
  }
  const range = 430;
  let best = null;
  let bestD = range;
  for (const ped of state.peds) {
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d < bestD) {
      const a = angleTo(p.x, p.y, ped.x, ped.y);
      if (Math.abs(angleDiff(aimAngle, a)) < 0.16) { bestD = d; best = { kind: 'ped', ref: ped }; }
    }
  }
  for (const car of state.cars) {
    if (car.isPlayer) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      const a = angleTo(p.x, p.y, car.x, car.y);
      if (Math.abs(angleDiff(aimAngle, a)) < 0.16) { bestD = d; best = { kind: 'car', ref: car }; }
    }
  }
  if (best) {
    if (best.kind === 'ped') {
      const idx = state.peds.indexOf(best.ref);
      if (idx >= 0) state.peds.splice(idx, 1);
      state.pickups.push({ x: best.ref.x, y: best.ref.y, kind: 'cash' });
    } else {
      best.ref.hp -= 25;
      if (best.ref.hp <= 0) best.ref.wrecked = true;
      if (best.ref.isPolice) addWanted(state, 1, 'copshot');
    }
    addWanted(state, 1, 'shoot');
  }
}

function wreckPlayerCar(state, audio) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.wrecked = true;
  car.isPlayer = false;
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + 40;
  p.y = car.y;
  const pos = collideCircle(p.x, p.y, 12);
  p.x = pos.x;
  p.y = pos.y;
  audio.crash();
  showMessage(state, 'Your car is wrecked!', 3);
  if (state.wanted > 0) {
    state.mode = 'busted';
  }
}

export function damagePlayerCar(state, amount, audio) {
  const p = state.player;
  if (!p.car) return;
  p.car.hp -= amount;
  if (p.car.hp <= 0) wreckPlayerCar(state, audio);
}
