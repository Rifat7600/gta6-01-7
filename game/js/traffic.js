// Dustline — traffic cars that follow the road graph, and pedestrians
// wandering the sidewalks. All spawned from a seeded RNG.
import { mulberry32, rand, randInt, pick, clamp, dist, angleTo, angleLerp } from './util.js';
import { nearestIntersection, randomNeighbor, collideCircle, isOnRoad, WORLD_W, WORLD_H } from './city.js';
import { addWanted, showMessage } from './state.js';

const TRAFFIC_COLORS = ['#c23b2e', '#3a6ea5', '#c9a13b', '#5a7a4a', '#7a5aa5', '#c97b2e', '#4a4a4a', '#d8d3c8'];
const PED_COLORS = ['#e8c39e', '#c98d64', '#8a5a3b', '#f0d0b0', '#6b4a2f'];

export function spawnTraffic(state, rng, count) {
  for (let i = 0; i < count; i++) {
    const spot = nearestIntersection(rand(rng, 200, WORLD_W - 200), rand(rng, 200, WORLD_H - 200));
    const car = {
      x: spot.x + rand(rng, -30, 30),
      y: spot.y + rand(rng, -30, 30),
      angle: rand(rng, 0, Math.PI * 2),
      speed: rand(rng, 55, 95),
      cruise: rand(rng, 55, 95),
      color: pick(rng, TRAFFIC_COLORS),
      hp: 100,
      isPlayer: false,
      isPolice: false,
      isTraffic: true,
      wrecked: false,
      stolen: false,
      driver: null,
      target: null,
    };
    car.target = randomNeighbor(rng, spot);
    state.cars.push(car);
  }
  // A few parked cars along the roads for the player to steal.
  for (let i = 0; i < 6; i++) {
    const spot = nearestIntersection(rand(rng, 200, WORLD_W - 200), rand(rng, 200, WORLD_H - 200));
    const parked = {
      x: spot.x + pick(rng, [-78, 78]) + rand(rng, -14, 14),
      y: spot.y + rand(rng, -30, 30),
      angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rand(rng, -0.1, 0.1),
      speed: 0,
      cruise: 0,
      color: pick(rng, TRAFFIC_COLORS),
      hp: 100,
      isPlayer: false,
      isPolice: false,
      isTraffic: false,
      wrecked: false,
      stolen: false,
      driver: null,
      target: null,
    };
    const pos = collideCircle(parked.x, parked.y, 18);
    parked.x = pos.x;
    parked.y = pos.y;
    state.cars.push(parked);
  }
}

export function spawnPeds(state, rng, count) {
  for (let i = 0; i < count; i++) {
    const x = rand(rng, 100, WORLD_W - 100);
    const y = rand(rng, 100, WORLD_H - 100);
    state.peds.push({
      x, y,
      angle: rand(rng, 0, Math.PI * 2),
      speed: rand(rng, 28, 52),
      color: pick(rng, PED_COLORS),
      tx: x, ty: y,
      wait: rand(rng, 0, 2),
      fleeing: false,
    });
  }
}

export function updateTraffic(state, dt, rng) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.wrecked || !car.isTraffic) continue;
    if (car.isPlayer) continue;
    // Drive toward the current intersection target.
    const target = car.target;
    const d = dist(car.x, car.y, target.x, target.y);
    if (d < 26) {
      const from = nearestIntersection(car.x, car.y);
      car.target = randomNeighbor(rng, from);
    } else {
      const want = angleTo(car.x, car.y, target.x, target.y);
      car.angle = angleLerp(car.angle, want, clamp(3.2 * dt, 0, 1));
      // Slow down for a car directly ahead.
      let ahead = false;
      for (const other of state.cars) {
        if (other === car || other.wrecked) continue;
        const od = dist(car.x, car.y, other.x, other.y);
        if (od < 58) {
          const oa = angleTo(car.x, car.y, other.x, other.y);
          if (Math.abs(oa - car.angle) < 0.6) { ahead = true; break; }
        }
      }
      const speed = ahead ? 0 : car.cruise;
      car.speed = speed;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const pos = collideCircle(car.x, car.y, 18);
      car.x = pos.x;
      car.y = pos.y;
    }
  }

  // Car-to-car shoves (soft, keeps traffic from stacking).
  for (let i = 0; i < state.cars.length; i++) {
    for (let j = i + 1; j < state.cars.length; j++) {
      const a = state.cars[i];
      const b = state.cars[j];
      if (a.wrecked || b.wrecked) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 34 && d > 0.01) {
        const push = (34 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        if (!a.isPlayer) { a.x -= nx * push; a.y -= ny * push; }
        if (!b.isPlayer) { b.x += nx * push; b.y += ny * push; }
      }
    }
  }

  // Pedestrians wander; fleeing ones run away from the player.
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    if (ped.fleeing) {
      const a = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle = a;
      ped.x += Math.cos(a) * 120 * dt;
      ped.y += Math.sin(a) * 120 * dt;
      if (dist(p.x, p.y, ped.x, ped.y) > 500) ped.fleeing = false;
    } else {
      if (ped.wait > 0) {
        ped.wait -= dt;
      } else {
        const d = dist(ped.x, ped.y, ped.tx, ped.ty);
        if (d < 12) {
          ped.tx = clamp(ped.x + rand(rng, -260, 260), 60, WORLD_W - 60);
          ped.ty = clamp(ped.y + rand(rng, -260, 260), 60, WORLD_H - 60);
          ped.wait = rand(rng, 0, 3);
        } else {
          ped.angle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.y += Math.sin(ped.angle) * ped.speed * dt;
        }
      }
    }
    const pos = collideCircle(ped.x, ped.y, 10);
    ped.x = pos.x;
    ped.y = pos.y;
  }
}

// The player running someone over: handled here to keep player.js clean.
export function checkPlayerRunOver(state) {
  const p = state.player;
  if (p.onFoot || !p.car) return;
  if (Math.abs(p.car.speed) < 40) return;
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    if (dist(p.car.x, p.car.y, ped.x, ped.y) < 26) {
      state.peds.splice(i, 1);
      state.pickups.push({ x: ped.x, y: ped.y, kind: 'cash' });
      addWanted(state, 1, 'runover');
      showMessage(state, 'You ran someone over!', 2);
    }
  }
}
