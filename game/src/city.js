// Solmar Bay — seeded city generation: roads, blocks, buildings, beach.
// Everything is deterministic from the seed: the same seed builds the same city.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD = 2600;
export const ROAD_STEP = 300;
export const ROAD_W = 64;
export const BEACH_Y = 2280;
export const WATER_Y = 2480;

const BUILDING_COLORS = [
  '#e8b48a', '#d9a06f', '#f0c9a0', '#c98d6b', '#e6d3a3',
  '#b7c9d9', '#a8b8c8', '#d9b8c4', '#f2e3c9', '#c4b49a',
  '#9fb8a6', '#d9a0a0', '#e0c080', '#b0a8c8', '#8fb8a8',
];
const ROOF_COLORS = ['#8a6a4a', '#6a5a6a', '#7a7a6a', '#9a7a5a', '#5a6a7a'];

export function generateCity(seed) {
  const rand = mulberry32(seed);
  const roadsV = [];
  const roadsH = [];
  for (let x = 200; x <= 2400; x += ROAD_STEP) roadsV.push(x);
  for (let y = 200; y <= 2200; y += ROAD_STEP) roadsH.push(y);

  // Buildings fill the blocks between roads.
  const buildings = [];
  for (let bx = 0; bx < roadsV.length - 1; bx++) {
    for (let by = 0; by < roadsH.length - 1; by++) {
      const x0 = roadsV[bx] + ROAD_W / 2 + 14;
      const y0 = roadsH[by] + ROAD_W / 2 + 14;
      const x1 = roadsV[bx + 1] - ROAD_W / 2 - 14;
      const y1 = roadsH[by + 1] - ROAD_W / 2 - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      // One plaza / park in the middle of town.
      if (bx === 3 && by === 3) {
        buildings.push({ x: x0, y: y0, w, h, park: true, color: '#7fb069', roof: '#5a8a4a' });
        continue;
      }
      const n = 1 + Math.floor(rand() * 3);
      if (n === 1) {
        buildings.push({
          x: x0 + rand() * w * 0.2, y: y0 + rand() * h * 0.2,
          w: w * (0.6 + rand() * 0.25), h: h * (0.6 + rand() * 0.25),
          color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
          roof: ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)],
        });
      } else {
        const vertical = rand() < 0.5;
        for (let i = 0; i < n; i++) {
          const bw = vertical ? w * (0.85 + rand() * 0.1) : w / n - 12;
          const bh = vertical ? h / n - 12 : h * (0.85 + rand() * 0.1);
          buildings.push({
            x: vertical ? x0 + 4 : x0 + i * (w / n) + 4,
            y: vertical ? y0 + i * (h / n) + 4 : y0 + 4,
            w: bw, h: bh,
            color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)],
            roof: ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)],
          });
        }
      }
    }
  }

  // Named districts for flavour.
  const districts = [
    { name: 'Old Port', x: 200, y: 200, w: 600, h: 600 },
    { name: 'Downtown', x: 1100, y: 800, w: 600, h: 600 },
    { name: 'Marina', x: 1700, y: 1700, w: 700, h: 500 },
    { name: 'Solmar Beach', x: 200, y: 2280, w: 2200, h: 320 },
  ];

  // Landmarks: the safehouse, Mara's office, the bank, the docks.
  const landmarks = {
    safehouse: { x: 650, y: 650, label: 'Safehouse' },
    marasOffice: { x: 1250, y: 950, label: "Mara's Office" },
    bank: { x: 1550, y: 1250, label: 'Bay Bank' },
    docks: { x: 350, y: 2050, label: 'Docks' },
    casino: { x: 1850, y: 650, label: 'Palms Casino' },
  };

  return { seed, roadsV, roadsH, buildings, districts, landmarks, rand };
}

// Is a point on a road (drivable)?
export function onRoad(city, x, y) {
  for (const rx of city.roadsV) {
    if (Math.abs(x - rx) < ROAD_W / 2 && y > 100 && y < 2300) return true;
  }
  for (const ry of city.roadsH) {
    if (Math.abs(y - ry) < ROAD_W / 2 && x > 100 && x < 2500) return true;
  }
  return false;
}

// Nearest intersection to a point.
export function nearestIntersection(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsV) {
    for (const ry of city.roadsH) {
      const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
      if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
    }
  }
  return best;
}

// Neighbouring intersections of one intersection (up/down/left/right).
export function neighbours(city, ix, iy) {
  const out = [];
  for (const rx of city.roadsV) {
    if (rx === ix) continue;
    if (Math.abs(rx - ix) === ROAD_STEP) {
      if (iy <= 2200) out.push({ x: rx, y: iy });
    }
  }
  for (const ry of city.roadsH) {
    if (ry === iy) continue;
    if (Math.abs(ry - iy) === ROAD_STEP) {
      if (ix <= 2400) out.push({ x: ix, y: ry });
    }
  }
  return out;
}

// Circle vs building collision: push a circle out of any building it overlaps.
export function collideBuildings(city, x, y, r) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    if (b.park) continue;
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: push out along the shortest side.
      const left = nx - b.x;
      const right = b.x + b.w - nx;
      const top = ny - b.y;
      const bottom = b.y + b.h - ny;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.x - r;
      else if (m === right) nx = b.x + b.w + r;
      else if (m === top) ny = b.y - r;
      else ny = b.y + b.h + r;
    }
  }
  // World bounds + water keep-out (the sea is not drivable).
  nx = Math.max(40, Math.min(WORLD - 40, nx));
  ny = Math.max(40, Math.min(WATER_Y - 30, ny));
  return { x: nx, y: ny };
}
