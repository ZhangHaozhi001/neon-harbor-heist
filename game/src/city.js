// Port Marlowe: an original harbour city on a 2600x2000 map.
// A grid of avenues cuts the map into blocks; each block is filled with
// buildings set back behind sidewalks. The south edge is beach and sea, the
// east edge is a working pier, the north-west corner is a park. Roads are
// derived from the same grid the traffic AI drives on, so rendering, physics
// and navigation can never disagree.

import { WORLD } from './config.js';
import { randPick, randRange } from './random.js';

export const ROAD_HALF = 52;          // half the road width (two lanes + median feel)
export const BLOCK = 260;              // grid pitch

export const AVENUES_X = [260, 520, 780, 1040, 1300, 1560, 1820, 2080, 2340];
export const AVENUES_Y = [240, 500, 760, 1020, 1280, 1540];
export const BEACH_Y = 1760;           // sand starts here
export const WATER_Y = 1880;           // sea starts here
export const PIER_X = 2420;            // pier deck strip on the east edge

const BUILDING_COLORS = ['#7a6a58', '#6d7f8c', '#8c6d5a', '#5f7263', '#84748c', '#96795a', '#5a6d8c', '#8c5a5a', '#746a80', '#6b7d6b'];
const ROOF_COLORS = ['#4a4038', '#3e4a52', '#54423a', '#42503f', '#4c4456', '#584a38'];

export function isOnRoad(x, y) {
  if (y >= BEACH_Y) return false;
  for (const ax of AVENUES_X) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  for (const ay of AVENUES_Y) if (Math.abs(y - ay) <= ROAD_HALF) return true;
  if (x >= PIER_X - 30 && y < BEACH_Y) return true;
  return false;
}

export function isWater(x, y) { return y >= WATER_Y; }
export function isSand(x, y) { return y >= BEACH_Y && y < WATER_Y; }

export function nearestRoadPoint(x, y) {
  let best = { x, y, d: Infinity };
  for (const ax of AVENUES_X) {
    const d = Math.abs(x - ax);
    if (d < best.d) best = { x: ax, y, d };
  }
  for (const ay of AVENUES_Y) {
    const d = Math.abs(y - ay);
    if (d < best.d) best = { x, y: ay, d };
  }
  return best;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Buildings: one or two per block interior, kept off roads, beach and park.
  for (let bx = 0; bx < AVENUES_X.length - 1; bx += 1) {
    for (let by = 0; by < AVENUES_Y.length - 1; by += 1) {
      const x0 = AVENUES_X[bx] + ROAD_HALF + 14;
      const x1 = AVENUES_X[bx + 1] - ROAD_HALF - 14;
      const y0 = AVENUES_Y[by] + ROAD_HALF + 14;
      const y1 = AVENUES_Y[by + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const isParkBlock = bx === 0 && by === 0;
      const isGarageBlock = bx === 0 && by === 0; // garage drawn separately at its lot
      if (isParkBlock) continue;
      const count = random() < 0.4 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = randRange(random, 74, Math.max(80, (x1 - x0) / count - 12));
        const h = randRange(random, 70, 130);
        const cx = count === 1 ? (x0 + x1) / 2 : x0 + (i + 0.5) * ((x1 - x0) / count);
        const cy = (y0 + y1) / 2 + randRange(random, -14, 14);
        buildings.push({
          x: cx - w / 2, y: cy - h / 2, w, h,
          color: randPick(random, BUILDING_COLORS),
          roof: randPick(random, ROOF_COLORS),
          floors: 2 + Math.floor(random() * 5),
          seed: random(),
        });
      }
      void isGarageBlock;
    }
  }

  // Palm trees along the beach and park trees in the north-west.
  for (let x = 90; x < WORLD.width - 60; x += 95) {
    trees.push({ x: x + randRange(random, -18, 18), y: BEACH_Y + 34 + randRange(random, -8, 14), palm: true, r: 15 + random() * 6 });
  }
  for (let i = 0; i < 42; i += 1) {
    trees.push({ x: randRange(random, 60, 440), y: randRange(random, 50, 420), palm: false, r: 13 + random() * 9 });
  }
  for (let i = 0; i < 26; i += 1) {
    const alongX = random() < 0.5;
    if (alongX) trees.push({ x: randRange(random, 60, WORLD.width - 60), y: randPick(random, AVENUES_Y) + ROAD_HALF + 18, palm: false, r: 10 + random() * 5 });
    else trees.push({ x: randPick(random, AVENUES_X) + ROAD_HALF + 18, y: randRange(random, 60, BEACH_Y - 60), palm: false, r: 10 + random() * 5 });
  }

  // Street lamps at intersections.
  for (const ax of AVENUES_X) for (const ay of AVENUES_Y) {
    lamps.push({ x: ax + ROAD_HALF + 8, y: ay + ROAD_HALF + 8 });
  }

  // Dressing props: beach umbrellas along the sand and cargo stacks on the
  // pier deck. Pure decoration — no collision — placed from the same seeded
  // random as everything else so the city is identical on every load.
  const props = [];
  const UMBRELLA_COLORS = ['#e5534b', '#39d0ff', '#ffd14a', '#ff8c42', '#b06fc9'];
  for (let x = 150; x < WORLD.width - 120; x += 165) {
    props.push({
      kind: 'umbrella',
      x: x + randRange(random, -22, 22),
      y: BEACH_Y + randRange(random, 42, 88),
      r: randRange(random, 13, 18),
      color: randPick(random, UMBRELLA_COLORS),
    });
  }
  for (let i = 0; i < 9; i += 1) {
    props.push({
      kind: 'cargo',
      x: PIER_X + randRange(random, 26, 120),
      y: randRange(random, 620, 1400),
      w: randRange(random, 44, 74),
      h: randRange(random, 30, 46),
      color: randPick(random, ['#8c5a2e', '#5f7263', '#7a4a3a', '#4a5a74']),
    });
  }

  // Collision helpers -------------------------------------------------------
  function collideCircle(x, y, r) {
    // World bounds and the sea.
    x = Math.max(r, Math.min(WORLD.width - r, x));
    y = Math.max(r, Math.min(WATER_Y - 6, y));
    for (const b of buildings) {
      const nx = Math.max(b.x, Math.min(b.x + b.w, x));
      const ny = Math.max(b.y, Math.min(b.y + b.h, y));
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) { x = b.x - r; continue; }
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      }
    }
    for (const t of trees) {
      const dx = x - t.x;
      const dy = y - t.y;
      const rr = r + 5;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0) {
        const d = Math.sqrt(d2);
        x = t.x + (dx / d) * rr;
        y = t.y + (dy / d) * rr;
      }
    }
    return { x, y };
  }

  function circleHitsBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  return { buildings, trees, lamps, props, collideCircle, circleHitsBuilding };
}
