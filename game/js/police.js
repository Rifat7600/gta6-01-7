// Dustline — the law: wanted decay, police spawns, chases, rams, busts.
import { clamp, dist, angleTo, angleLerp, rand, pick } from './util.js';
import { nearestIntersection, randomNeighbor, collideCircle, LANDMARKS, WORLD_W, WORLD_H } from './city.js';
import { showMessage, saveGame } from './state.js';
import { damagePlayerCar } from './player.js';

const POLICE_COLORS = ['#1d3a6e', '#16294f'];

function spawnPoliceCar(state, rng) {
  // Spawn at an intersection near a map edge, away from the player.
  const p = state.player;
  const edgeSpots = [];
  for (const it of [
    { x: 400, y: 350 }, { x: 2800, y: 350 }, { x: 400, y: 2000 }, { x: 2800, y: 2000 },
    { x: 1600, y: 350 }, { x: 1600, y: 2000 }, { x: 400, y: 1450 }, { x: 2800, y: 1450 },
  ]) {
    if (dist(p.x, p.y, it.x, it.y) > 700) edgeSpots.push(it);
  }
  const spot = edgeSpots.length ? pick(rng, edgeSpots) : { x: 400, y: 350 };
  const car = {
    x: spot.x, y: spot.y,
    angle: angleTo(spot.x, spot.y, p.x, p.y),
    speed: 0,
    cruise: 0,
    color: pick(rng, POLICE_COLORS),
    hp: 120,
    isPlayer: false,
    isPolice: true,
    isTraffic: false,
    wrecked: false,
    stolen: false,
    driver: null,
    target: null,
    ramTimer: 0,
    sirenPhase: rand(rng, 0, 6),
  };
  state.cars.push(car);
  state.police.push(car);
  return car;
}

export function updatePolice(state, dt, rng, audio) {
  const p = state.player;

  // Wanted decay: when no police can see the player, the heat cools off.
  // Near the safehouse (Kestrel Garage) it cools twice as fast.
  const g = LANDMARKS.garage;
  const garageCx = g.x + g.w / 2;
  const garageCy = g.y + g.h / 2;
  const atSafehouse = dist(p.x, p.y, garageCx, garageCy) < 260;
  let nearestPolice = Infinity;
  for (const cop of state.police) {
    if (cop.wrecked) continue;
    nearestPolice = Math.min(nearestPolice, dist(p.x, p.y, cop.x, cop.y));
  }
  if (state.wanted > 0) {
    if (nearestPolice > 650 || atSafehouse) {
      state.noPoliceTimer += dt;
      const rate = atSafehouse ? 3 : 6;
      if (state.noPoliceTimer > rate) {
        state.noPoliceTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        if (state.wanted === 0) showMessage(state, 'You lost them. Heat is off.', 3);
      }
    } else {
      state.noPoliceTimer = 0;
    }
  }

  // Spawn police while wanted, up to wanted + 1 cars.
  if (state.wanted > 0) {
    const alive = state.police.filter((c) => !c.wrecked).length;
    const want = Math.min(6, state.wanted + 1);
    if (alive < want) {
      state.policeSpawnTimer += dt;
      if (state.policeSpawnTimer > 1.6) {
        state.policeSpawnTimer = 0;
        spawnPoliceCar(state, rng);
      }
    } else {
      state.policeSpawnTimer = 0;
    }
  }

  // Chase: steer at the player, ram on contact.
  for (const cop of state.police) {
    if (cop.wrecked) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const want = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = angleLerp(cop.angle, want, clamp(2.6 * dt, 0, 1));
    const cruise = state.wanted > 0 ? 330 : 120;
    cop.speed = cruise;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    const pos = collideCircle(cop.x, cop.y, 18);
    cop.x = pos.x;
    cop.y = pos.y;
    cop.ramTimer = Math.max(0, cop.ramTimer - dt);

    if (d < 44 && cop.ramTimer <= 0) {
      cop.ramTimer = 0.9;
      audio.crash();
      if (p.onFoot) {
        state.hp -= 22;
        if (state.hp <= 0) {
          state.hp = 0;
          state.mode = 'wasted';
          saveGame(state);
        }
      } else {
        damagePlayerCar(state, 16, audio);
      }
      // Shove the player car.
      if (!p.onFoot && p.car) {
        p.car.x += Math.cos(cop.angle) * 14;
        p.car.y += Math.sin(cop.angle) * 14;
      }
    }

    // Busted: a cop catches the player on foot up close.
    if (p.onFoot && d < 34) {
      state.bustTimer += dt;
      if (state.bustTimer > 0.8) {
        state.mode = 'busted';
        saveGame(state);
        return;
      }
    }
  }
  if (p.onFoot) {
    const near = state.police.some((c) => !c.wrecked && dist(p.x, p.y, c.x, c.y) < 34);
    if (!near) state.bustTimer = 0;
  }

  // Wanted gone: the remaining cops give up and drive off.
  if (state.wanted === 0) {
    for (let i = state.police.length - 1; i >= 0; i--) {
      const cop = state.police[i];
      if (cop.wrecked) continue;
      const away = angleTo(p.x, p.y, cop.x, cop.y);
      cop.angle = angleLerp(cop.angle, away, clamp(2 * dt, 0, 1));
      cop.speed = 160;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (dist(p.x, p.y, cop.x, cop.y) > 1100) {
        const ci = state.cars.indexOf(cop);
        if (ci >= 0) state.cars.splice(ci, 1);
        state.police.splice(i, 1);
      }
    }
  }
}
