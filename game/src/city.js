// city.js — Solmar Bay: a seeded grid city with roads, blocks, buildings,
// a beach on the east edge and a park. All layout is deterministic from the
// seed, so the same seed always builds the same city.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD = 3400;          // city is WORLD x WORLD world units
export const ROAD_W = 96;           // road width
export const BLOCK = 340;           // block pitch (road centre to road centre)
export const BEACH_X = WORLD - 420; // beach starts here, sea beyond

const PALETTES = [
  ['#e8b48a', '#d9a06f', '#c98f5f'], // terracotta roofs
  ['#9fb6c9', '#8aa7bd', '#7b9ab2'], // blue-grey
  ['#c9b18a', '#bfa377', '#b09568'], // sand
  ['#b98a9a', '#a87a8a', '#97707e'], // dusty rose
];

export function createCity(seed) {
  const rng = mulberry32(seed);
  const roadsV = []; // vertical road centre x
  const roadsH = []; // horizontal road centre y
  for (let x = 220; x < BEACH_X - 60; x += BLOCK) roadsV.push(x);
  for (let y = 220; y < WORLD - 60; y += BLOCK) roadsH.push(y);

  const buildings = [];
  const trees = [];
  const lots = [];
  for (let ix = 0; ix < roadsV.length - 1; ix++) {
    for (let iy = 0; iy < roadsH.length - 1; iy++) {
      const x0 = roadsV[ix] + ROAD_W / 2 + 14;
      const y0 = roadsH[iy] + ROAD_W / 2 + 14;
      const x1 = roadsV[ix + 1] - ROAD_W / 2 - 14;
      const y1 = roadsH[iy + 1] - ROAD_W / 2 - 14;
      const park = rng() < 0.14;
      const plaza = !park && rng() < 0.10;
      if (park) {
        for (let t = 0; t < 7; t++) {
          trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 10 + rng() * 8 });
        }
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'park' });
        continue;
      }
      if (plaza) { lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'plaza' }); continue; }
      const cols = (x1 - x0) > 200 ? 2 : 1;
      const rows = (y1 - y0) > 200 ? 2 : 1;
      const pal = PALETTES[Math.floor(rng() * PALETTES.length)];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bw = (x1 - x0) / cols - 18;
          const bh = (y1 - y0) / rows - 18;
          const bx = x0 + c * ((x1 - x0) / cols) + 9;
          const by = y0 + r * ((y1 - y0) / rows) + 9;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            tall: rng() < 0.28,
            color: pal[Math.floor(rng() * pal.length)],
            roof: rng() < 0.5 ? 'flat' : 'pitched',
          });
        }
      }
    }
  }
  // Beach palms and boardwalk props.
  for (let y = 120; y < WORLD - 100; y += 130) {
    trees.push({ x: BEACH_X - 40 + rng() * 60, y, r: 12 + rng() * 6, palm: true });
  }
  return { seed, roadsV, roadsH, buildings, trees, lots };
}

export function onRoad(city, x, y) {
  if (x > BEACH_X) return false;
  for (const rx of city.roadsV) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(city, x, y) {
  let best = null; let bd = Infinity;
  for (const rx of city.roadsV) {
    const px = rx, py = Math.max(0, Math.min(WORLD, y));
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = { x: px, y: py, vertical: true }; }
  }
  for (const ry of city.roadsH) {
    const px = Math.max(0, Math.min(BEACH_X, x)), py = ry;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = { x: px, y: py, vertical: false }; }
  }
  return best;
}

export function randomRoadPoint(city, rng) {
  const vertical = rng() < 0.5;
  if (vertical) {
    return { x: city.roadsV[Math.floor(rng() * city.roadsV.length)], y: 80 + rng() * (WORLD - 160), vertical: true };
  }
  return { x: 80 + rng() * (BEACH_X - 160), y: city.roadsH[Math.floor(rng() * city.roadsH.length)], vertical: false };
}

export function randomSidewalkPoint(city, rng) {
  const p = randomRoadPoint(city, rng);
  const off = (ROAD_W / 2 + 16) * (rng() < 0.5 ? -1 : 1);
  if (p.vertical) return { x: p.x + off, y: p.y };
  return { x: p.x, y: p.y + off };
}

// Circle vs building test; returns the building hit or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings (and the world edge); returns true if moved.
export function resolveBuildingCollision(city, p, r) {
  let moved = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r; p.y = cy + (dy / d) * r;
      moved = true;
    } else if (d2 <= 0.0001) {
      p.x += r; moved = true;
    }
  }
  if (p.x < r) { p.x = r; moved = true; }
  if (p.y < r) { p.y = r; moved = true; }
  if (p.x > WORLD - r) { p.x = WORLD - r; moved = true; }
  if (p.y > WORLD - r) { p.y = WORLD - r; moved = true; }
  return moved;
}
