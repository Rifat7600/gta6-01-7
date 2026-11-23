// Dustline — HUD: health, money, ammo, wanted stars, live minimap,
// objective bar and arrow, plus title / pause / busted / wasted screens.
import { clamp, dist, angleTo, TAU } from './util.js';
import { WORLD_W, WORLD_H, LANDMARKS, PARK } from './city.js';
import { MISSIONS } from './missions.js';

export function drawHUD(ctx, state, vw, vh) {
  const p = state.player;

  // Top-left panel: health, money, ammo, missions.
  ctx.fillStyle = 'rgba(12, 10, 8, 0.72)';
  ctx.fillRect(14, 12, 250, 92);
  ctx.strokeStyle = 'rgba(255, 210, 58, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(14.5, 12.5, 250, 92);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RAE  •  DUSTLINE', 26, 34);
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 44, 150, 12);
  ctx.fillStyle = state.hp > 50 ? '#58c24a' : state.hp > 25 ? '#e8a13a' : '#d83a2e';
  ctx.fillRect(26, 44, 150 * clamp(state.hp / 100, 0, 1), 12);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText(Math.round(state.hp) + ' HP', 184, 55);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText('$' + state.money.toLocaleString('en-US'), 26, 80);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText('Ammo ' + state.ammo + '    Missions done: ' + state.missionsDone + ' / ' + MISSIONS.length, 26, 98);

  // Top-right: wanted stars + minimap.
  const mmX = vw - 214;
  const mmY = 12;
  const mmW = 200;
  const mmH = 150;
  ctx.fillStyle = 'rgba(12, 10, 8, 0.72)';
  ctx.fillRect(mmX - 6, mmY - 6, mmW + 12, mmH + 46);
  ctx.strokeStyle = 'rgba(255, 210, 58, 0.6)';
  ctx.strokeRect(mmX - 5.5, mmY - 5.5, mmW + 12, mmH + 46);
  // Stars.
  ctx.font = '22px Arial, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd23a' : 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('★', mmX + 24 + i * 34, mmY + 24);
  }
  drawMinimap(ctx, state, mmX, mmY + 34, mmW, mmH);

  // Bottom-centre objective bar.
  if (state.objective) {
    const text = state.objective.text;
    ctx.font = 'bold 15px Arial, sans-serif';
    const tw = ctx.measureText(text).width;
    const bw = Math.min(tw + 36, vw - 40);
    ctx.fillStyle = 'rgba(12, 10, 8, 0.78)';
    ctx.fillRect((vw - bw) / 2, vh - 58, bw, 34);
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 1;
    ctx.strokeRect((vw - bw) / 2 + 0.5, vh - 57.5, bw, 34);
    ctx.fillStyle = '#ffd23a';
    ctx.textAlign = 'center';
    ctx.fillText(text, vw / 2, vh - 36);
  }

  // Speed, bottom-right (driving only).
  if (!p.onFoot && p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(12, 10, 8, 0.72)';
    ctx.fillRect(vw - 150, vh - 58, 136, 34);
    ctx.fillStyle = '#f5e9c8';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(mph + ' mph', vw - 26, vh - 35);
  }

  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(245, 233, 200, 0.75)';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD drive / walk   E steal car   F punch   Click shoot   Space handbrake   P pause   M mute', 16, vh - 14);

  // Timed message toast.
  if (state.messageTimer > 0 && state.message) {
    ctx.font = 'bold 17px Arial, sans-serif';
    const tw = ctx.measureText(state.message).width;
    ctx.fillStyle = 'rgba(12, 10, 8, 0.8)';
    ctx.fillRect((vw - tw - 36) / 2, 118, tw + 36, 36);
    ctx.fillStyle = '#ffd23a';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, vw / 2, 142);
  }

  // Objective arrow when the target is off-screen.
  if (state.objective) {
    const tx = state.objective.x;
    const ty = state.objective.y;
    const sx = tx - state.camera.x;
    const sy = ty - state.camera.y;
    if (sx < 30 || sx > vw - 30 || sy < 30 || sy > vh - 30) {
      const cx = clamp(sx, 60, vw - 60);
      const cy = clamp(sy, 90, vh - 90);
      const a = angleTo(cx, cy, sx, sy);
      const d = Math.round(dist(p.x, p.y, tx, ty));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd23a';
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d + 'm', cx, cy + 30);
    }
  }
}

function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  ctx.fillStyle = '#2c2620';
  ctx.fillRect(x, y, w, h);
  // Roads.
  ctx.fillStyle = '#4a453e';
  for (const ax of [400, 1000, 1600, 2200, 2800]) ctx.fillRect(x + ax * sx - 3, y, 6, h);
  for (const syy of [350, 900, 1450, 2000]) ctx.fillRect(x, y + syy * sy - 3, w, 6);
  // Park.
  ctx.fillStyle = '#4e7a33';
  ctx.fillRect(x + PARK.x * sx, y + PARK.y * sy, PARK.w * sx, PARK.h * sy);
  // Garage.
  const g = LANDMARKS.garage;
  ctx.fillStyle = '#ffd23a';
  ctx.fillRect(x + (g.x + g.w / 2) * sx - 3, y + (g.y + g.h / 2) * sy - 3, 6, 6);
  // Mission target.
  if (state.objective) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ff5a2e';
    ctx.beginPath();
    ctx.arc(x + state.objective.x * sx, y + state.objective.y * sy, pulse, 0, TAU);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#5aa0ff';
  for (const cop of state.police) {
    if (cop.wrecked) continue;
    ctx.beginPath();
    ctx.arc(x + cop.x * sx, y + cop.y * sy, 3, 0, TAU);
    ctx.fill();
  }
  // Player arrow.
  const px = x + state.player.x * sx;
  const py = y + state.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawTitle(ctx, state, vw, vh, saved) {
  ctx.fillStyle = 'rgba(20, 12, 6, 0.82)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 92px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DUSTLINE', vw / 2, vh / 2 - 90);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText('A desert-edge open-world crime game', vw / 2, vh / 2 - 52);
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('You are Rae, a wheelwoman. Mara has four jobs that pay.', vw / 2, vh / 2 - 20);
  ctx.fillStyle = '#cbb27f';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('WASD move / drive    E steal or exit a car    F punch    Click or G shoot    Space handbrake', vw / 2, vh / 2 + 24);
  ctx.fillText('P pause    M mute    R restart after busted / wasted    Progress saves automatically', vw / 2, vh / 2 + 50);
  if (saved) {
    ctx.fillStyle = '#7ee787';
    ctx.fillText('Save found: $' + saved.money + ' earned, ' + saved.missionsDone + ' jobs done, best wanted ' + saved.bestWanted + ' stars', vw / 2, vh / 2 + 84);
  }
  ctx.fillStyle = '#ffd23a';
  ctx.font = 'bold 22px Arial, sans-serif';
  const blink = Math.sin(state.time * 4) > -0.2;
  if (blink) ctx.fillText('Press ENTER to start', vw / 2, vh / 2 + 132);
}

export function drawPaused(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(12, 10, 8, 0.7)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 10);
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('Press P to keep playing', vw / 2, vh / 2 + 26);
}

export function drawBusted(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(10, 16, 40, 0.78)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#5aa0ff';
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED', vw / 2, vh / 2 - 20);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('The Dustline PD caught up with Rae.', vw / 2, vh / 2 + 18);
  ctx.fillText('Press R to try again', vw / 2, vh / 2 + 52);
}

export function drawWasted(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(40, 8, 6, 0.8)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ff5a2e';
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', vw / 2, vh / 2 - 20);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText('Rae went down in the dust.', vw / 2, vh / 2 + 18);
  ctx.fillText('Press R to try again', vw / 2, vh / 2 + 52);
}
