// Dustline — the city: a desert-edge grid of avenues and streets, adobe
// blocks, a park, a gas station, a garage safehouse and a motel.
// Everything is placed deterministically from a fixed seed.
import { mulberry32, rand, randInt, pick, clamp } from './util.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;

export const AVENUES = [400, 1000, 1600, 2200, 2800];
export const STREETS = [350, 900, 1450, 2000];
export const ROAD_W = 120;

const ROOF_COLORS = ['#c9a06a', '#b98a52', '#d9b380', '#a87b4f', '#c98f5f', '#bb9463'];

// Landmark buildings (solid rects) and places.
export const LANDMARKS = {
  garage: { x: 1180, y: 1080, w: 240, h: 190, color: '#8a6b3f', label: 'KESTREL GARAGE', kind: 'garage' },
  motel: { x: 2380, y: 1600, w: 240, h: 180, color: '#b0703f', label: 'PALM MOTEL', kind: 'motel' },
  diner: { x: 620, y: 560, w: 160, h: 120, color: '#a8584a', label: 'DINER', kind: 'diner' },
  gasCanopy: { x: 1800, y: 540, w: 220, h: 130, color: '#7a7f85', label: 'GAS', kind: 'gas' },
};

export const PARK = { x: 1660, y: 960, w: 480, h: 430 };

// Gas pumps (small solid rects).
export const PUMPS = [
  { x: 1840, y: 590, w: 26, h: 40 },
  { x: 1930, y: 590, w: 26, h: 40 },
];

// All solid rectangles: landmark buildings + generated blocks + pumps.
export const buildings = [];
export const trees = [];

function buildCity() {
  const rng = mulberry32(20261123);
  // Landmark buildings first.
  for (const key of Object.keys(LANDMARKS)) {
    const l = LANDMARKS[key];
    buildings.push({ x: l.x, y: l.y, w: l.w, h: l.h, color: l.color, label: l.label, kind: l.kind });
  }
  for (const p of PUMPS) buildings.push({ x: p.x, y: p.y, w: p.w, h: p.h, color: '#c23b2e', kind: 'pump' });

  // Block cells between roads.
  const xs = [0, 340, 460, 940, 1060, 1540, 1660, 2140, 2260, 2740, 2860, 3200];
  const ys = [0, 290, 410, 840, 960, 1390, 1510, 1940, 2060, 2400];
  const cells = [];
  for (let i = 0; i < xs.length; i += 2) {
    for (let j = 0; j < ys.length; j += 2) {
      cells.push({ x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] });
    }
  }
  const overlapsLandmark = (r) => {
    for (const b of buildings) {
      if (r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y) return true;
    }
    if (r.x < PARK.x + PARK.w && r.x + r.w > PARK.x && r.y < PARK.y + PARK.h && r.y + r.h > PARK.y) return true;
    return false;
  };
  for (const cell of cells) {
    const n = randInt(rng, 1, 2);
    for (let k = 0; k < n; k++) {
      const bw = rand(rng, 120, Math.min(260, cell.w - 40));
      const bh = rand(rng, 100, Math.min(200, cell.h - 40));
      const bx = cell.x + rand(rng, 10, Math.max(11, cell.w - bw - 10));
      const by = cell.y + rand(rng, 10, Math.max(11, cell.h - bh - 10));
      const rect = { x: bx, y: by, w: bw, h: bh, color: pick(rng, ROOF_COLORS), kind: 'block' };
      if (!overlapsLandmark(rect)) buildings.push(rect);
    }
  }
  // Park trees.
  for (let i = 0; i < 26; i++) {
    trees.push({
      x: rand(rng, PARK.x + 30, PARK.x + PARK.w - 30),
      y: rand(rng, PARK.y + 30, PARK.y + PARK.h - 30),
      r: rand(rng, 14, 26),
    });
  }
}

buildCity();

// All avenue/street crossings.
export const intersections = [];
for (const ax of AVENUES) {
  for (const sy of STREETS) intersections.push({ x: ax, y: sy });
}

export function isOnRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2 + 24) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2 + 24) return true;
  return false;
}

export function nearestIntersection(x, y) {
  let best = intersections[0];
  let bd = Infinity;
  for (const it of intersections) {
    const d = (it.x - x) * (it.x - x) + (it.y - y) * (it.y - y);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

// A neighbouring intersection along the road graph.
export function randomNeighbor(rng, from) {
  const options = [];
  for (const it of intersections) {
    if (it === from) continue;
    if (it.x === from.x || it.y === from.y) options.push(it);
  }
  return options.length ? pick(rng, options) : from;
}

export function randomPointOnRoad(rng) {
  const it = pick(rng, intersections);
  return { x: it.x + rand(rng, -40, 40), y: it.y + rand(rng, -40, 40) };
}

// Push a circle out of every solid rect and clamp it inside the world.
// Returns the corrected position.
export function collideCircle(x, y, r) {
  for (const b of buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Center inside the rect: push out along the smallest penetration.
        const pl = x - b.x + r;
        const pr = b.x + b.w - x + r;
        const pt = y - b.y + r;
        const pb = b.y + b.h - y + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r;
        else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  x = clamp(x, 24, WORLD_W - 24);
  y = clamp(y, 24, WORLD_H - 24);
  return { x, y };
}

export function drawCity(ctx, camX, camY, vw, vh, time) {
  const x0 = camX - 40;
  const y0 = camY - 40;
  const x1 = camX + vw + 40;
  const y1 = camY + vh + 40;

  // Sandy ground.
  ctx.fillStyle = '#cbb27f';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Dust patches.
  ctx.fillStyle = 'rgba(160, 125, 80, 0.25)';
  for (let i = 0; i < 40; i++) {
    const px = ((i * 977) % WORLD_W) - 200;
    const py = ((i * 571) % WORLD_H) - 100;
    if (px > x0 - 120 && px < x1 && py > y0 - 80 && py < y1) {
      ctx.beginPath();
      ctx.ellipse(px, py, 90, 46, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Park.
  ctx.fillStyle = '#7ba24f';
  ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
  ctx.fillStyle = '#6a8f43';
  ctx.fillRect(PARK.x + 14, PARK.y + 14, PARK.w - 28, PARK.h - 28);
  for (const t of trees) {
    if (t.x < x0 - 40 || t.x > x1 + 40 || t.y < y0 - 40 || t.y > y1 + 40) continue;
    ctx.fillStyle = '#4e7a33';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d8f3c';
    ctx.beginPath();
    ctx.arc(t.x - 4, t.y - 4, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads.
  ctx.fillStyle = '#3a3632';
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Road edge lines.
  ctx.strokeStyle = 'rgba(230, 220, 200, 0.5)';
  ctx.lineWidth = 3;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(ax - ROAD_W / 2 + 6, 0);
    ctx.lineTo(ax - ROAD_W / 2 + 6, WORLD_H);
    ctx.moveTo(ax + ROAD_W / 2 - 6, 0);
    ctx.lineTo(ax + ROAD_W / 2 - 6, WORLD_H);
    ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath();
    ctx.moveTo(0, sy - ROAD_W / 2 + 6);
    ctx.lineTo(WORLD_W, sy - ROAD_W / 2 + 6);
    ctx.moveTo(0, sy + ROAD_W / 2 - 6);
    ctx.lineTo(WORLD_W, sy + ROAD_W / 2 - 6);
    ctx.stroke();
  }
  // Dashed centre lines.
  ctx.strokeStyle = '#d8b13a';
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, WORLD_H);
    ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(WORLD_W, sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings.
  for (const b of buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    if (b.kind === 'block') {
      ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 40));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(b.x + 12 + i * 46, b.y + 12 + j * 40, 14, 12);
        }
      }
    }
    if (b.label) {
      ctx.fillStyle = 'rgba(20, 14, 8, 0.85)';
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }

  // Safehouse beacon ring around the garage.
  const g = LANDMARKS.garage;
  const pulse = 1 + Math.sin(time * 2.2) * 0.08;
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(g.x + g.w / 2, g.y + g.h / 2, 150 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}
