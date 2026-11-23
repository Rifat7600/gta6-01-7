// Dustline — boot, game loop, entity rendering, camera, mode handling.
import { mulberry32, clamp, dist, TAU } from './util.js';
import { WORLD_W, WORLD_H, drawCity } from './city.js';
import { createState, saveGame, loadGame } from './state.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { updatePlayer } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, checkPlayerRunOver } from './traffic.js';
import { updatePolice } from './police.js';
import { startMission, updateMissions } from './missions.js';
import { applyScene } from './scenes.js';
import { drawHUD, drawTitle, drawPaused, drawBusted, drawWasted } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VW = 1280;
const VH = 720;

const rng = mulberry32(777);
const state = createState();
const input = createInput(canvas);
const audio = createAudio();
const saved = loadGame();

function freshWorld() {
  const s = state;
  s.cars = [];
  s.peds = [];
  s.police = [];
  s.pickups = [];
  s.tailTarget = null;
  s.wanted = 0;
  s.hp = 100;
  s.ammo = 24;
  s.missionsDone = 0;
  s.bustTimer = 0;
  s.noPoliceTimer = 0;
  s.policeSpawnTimer = 0;
  s.message = '';
  s.messageTimer = 0;
  s.player.x = 1300;
  s.player.y = 900;
  s.player.angle = -Math.PI / 2;
  s.player.onFoot = true;
  s.player.car = null;
  s.player.speed = 0;
  s.camera.x = 1300 - VW / 2;
  s.camera.y = 900 - VH / 2;
  spawnTraffic(s, rng, 10);
  spawnPeds(s, rng, 16);
  s.pickups.push({ x: 1560, y: 830, kind: 'ammo' });
  s.pickups.push({ x: 1640, y: 1520, kind: 'health' });
  s.pickups.push({ x: 1060, y: 420, kind: 'cash' });
  if (saved) {
    s.money = saved.money || 0;
    s.missionsDone = saved.missionsDone || 0;
    s.bestWanted = saved.bestWanted || 0;
  } else {
    s.money = 0;
  }
  startMission(s, s.missionsDone < 4 ? s.missionsDone : 0, rng);
}

// Scene preset from the URL (?scene=cover|chase|mission|foot) — used for
// deterministic screenshots. Without one, the title screen shows.
const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');
if (scene) {
  freshWorld();
  applyScene(state, scene, rng);
  state.mode = 'playing';
  audio.ensure();
} else {
  state.mode = 'title';
}

let last = performance.now();

function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  state.time += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;

  // Global keys.
  if (input.wasPressed('KeyM')) {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
  }

  if (state.mode === 'title') {
    if (input.wasPressed('Enter') || input.mouse.clicked) {
      audio.ensure();
      freshWorld();
      state.mode = 'playing';
    }
  } else if (state.mode === 'playing') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      state.mode = 'paused';
    } else {
      updatePlayer(state, input, dt, audio);
      checkPlayerRunOver(state);
      updateTraffic(state, dt, rng);
      updatePolice(state, dt, rng, audio);
      updateMissions(state, dt, rng, audio);
      audio.setSiren(state.wanted > 0, state.time);
      if (state.player.onFoot) audio.setEngine(0);
      // Camera follows the player smoothly.
      const tx = clamp(state.player.x - VW / 2, 0, WORLD_W - VW);
      const ty = clamp(state.player.y - VH / 2, 0, WORLD_H - VH);
      const k = 1 - Math.exp(-6 * dt);
      state.camera.x += (tx - state.camera.x) * k;
      state.camera.y += (ty - state.camera.y) * k;
    }
  } else if (state.mode === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      state.mode = 'playing';
    }
  } else if (state.mode === 'busted' || state.mode === 'wasted') {
    if (input.wasPressed('KeyR')) {
      audio.ensure();
      freshWorld();
      state.mode = 'playing';
    }
  }

  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = 40;
  const W = 20;
  // Wheels.
  ctx.fillStyle = '#141414';
  ctx.fillRect(-14, -W / 2 - 3, 10, 5);
  ctx.fillRect(8, -W / 2 - 3, 10, 5);
  ctx.fillRect(-14, W / 2 - 2, 10, 5);
  ctx.fillRect(8, W / 2 - 2, 10, 5);
  // Body.
  ctx.fillStyle = car.wrecked ? '#3c3a38' : car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Roof + windshield.
  ctx.fillStyle = car.wrecked ? '#2a2826' : 'rgba(20, 24, 30, 0.85)';
  ctx.fillRect(-4, -W / 2 + 3, 12, W - 6);
  ctx.fillStyle = 'rgba(200, 220, 235, 0.75)';
  ctx.fillRect(10, -W / 2 + 3, 5, W - 6);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 2, 4);
  ctx.fillRect(L / 2 - 2, W / 2 - 6, 2, 4);
  // Police light bar.
  if (car.isPolice && !car.wrecked) {
    const phase = Math.sin(state.time * 9 + (car.sirenPhase || 0)) > 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-6, -W / 2 - 1, 12, 4);
    ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-6, W / 2 - 3, 12, 4);
  }
  // Player car outline.
  if (car.isPlayer) {
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 7);
    ctx.stroke();
  }
  // Tail target marker.
  if (car.isTailTarget) {
    ctx.strokeStyle = '#3a6ea5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(ped.x, ped.y + 4, 8, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, 0, TAU);
  ctx.fill();
}

function render() {
  const camX = Math.round(state.camera.x);
  const camY = Math.round(state.camera.y);
  ctx.clearRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(-camX, -camY);

  drawCity(ctx, camX, camY, VW, VH, state.time);

  // Pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(state.time * 3 + pk.x) * 2;
    if (pk.kind === 'ammo') {
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(pk.x - 9, pk.y - 9 + bob, 18, 18);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 12px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', pk.x, pk.y + 4 + bob);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#58c24a';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4 + bob);
    } else {
      ctx.fillStyle = '#d83a2e';
      ctx.fillRect(pk.x - 9, pk.y - 9 + bob, 18, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', pk.x, pk.y + 5 + bob);
    }
  }

  // Cars: traffic, parked, police, tail target.
  for (const car of state.cars) drawCar(ctx, car);
  // Pedestrians.
  for (const ped of state.peds) drawPed(ctx, ped);

  // Player on foot.
  const p = state.player;
  if (p.onFoot) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 5, 9, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8b13a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, TAU);
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17);
    ctx.stroke();
    // Muzzle flash.
    if (p.flash > 0) {
      ctx.fillStyle = 'rgba(255, 220, 80, 0.9)';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, 9, 0, TAU);
      ctx.fill();
    }
  }

  // Mission target beacon.
  if (state.objective) {
    const pulse = 26 + Math.sin(state.time * 4) * 5;
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.objective.x, state.objective.y, pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(state.objective.x, state.objective.y, 5, 0, TAU);
    ctx.fill();
  }

  ctx.restore();

  if (state.mode === 'playing' || state.mode === 'paused') {
    drawHUD(ctx, state, VW, VH);
  }
  if (state.mode === 'title') drawTitle(ctx, state, VW, VH, saved);
  if (state.mode === 'paused') drawPaused(ctx, VW, VH);
  if (state.mode === 'busted') drawBusted(ctx, VW, VH);
  if (state.mode === 'wasted') drawWasted(ctx, VW, VH);
}

requestAnimationFrame(frame);
