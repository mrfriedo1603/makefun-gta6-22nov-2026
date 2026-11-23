// vehicles.js — cars: definitions, driving physics and traffic AI.
// Traffic cars drive the road grid, keep to their lane, turn at
// intersections and slow for the car ahead. All original designs.

import { nearestRoadPoint, onRoad, BEACH_X, WORLD } from './city.js';

export const CAR_TYPES = {
  sedan:  { w: 34, h: 62, accel: 340, top: 330, grip: 2.6, colors: ['#c94f3d', '#3d7dd9', '#d9d9d9', '#2b2b2b', '#7a9a5c'] },
  taxi:   { w: 34, h: 62, accel: 320, top: 310, grip: 2.6, colors: ['#f2c230'] },
  van:    { w: 38, h: 74, accel: 240, top: 260, grip: 2.2, colors: ['#8a8a8a', '#5c7a9a', '#a86a3d'] },
  sports: { w: 34, h: 60, accel: 460, top: 430, grip: 3.1, colors: ['#e81e63', '#ffd23d', '#1ed9c2'] },
  truck:  { w: 40, h: 88, accel: 190, top: 220, grip: 1.9, colors: ['#6a4a2f', '#4a6a4a'] },
  police: { w: 36, h: 64, accel: 400, top: 380, grip: 2.9, colors: ['#1d3f8a'] },
  pickup: { w: 36, h: 68, accel: 300, top: 300, grip: 2.5, colors: ['#7a3d1d', '#3d5c3d'] },
};

export function makeCar(type, x, y, angle, color) {
  const def = CAR_TYPES[type];
  return {
    type, x, y, angle, speed: 0,
    w: def.w, h: def.h,
    color: color ?? def.colors[Math.floor(Math.random() * def.colors.length)],
    steering: 0, health: 100, siren: 0, brakeLight: false,
    traffic: false, dir: 0, // traffic AI: current heading sign
    stuck: 0, honk: 0,
  };
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// Arcade driving: throttle accelerates along the heading, steering turns
// harder at low speed, drag caps the top speed. dt in seconds.
export function updateCarPhysics(car, input, dt) {
  const def = CAR_TYPES[car.type];
  const forward = input.throttle; // -1..1
  car.speed += forward * def.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // drag
  if (input.brake) car.speed -= Math.sign(car.speed) * 520 * dt;
  car.speed = clamp(car.speed, -def.top * 0.45, def.top);
  if (Math.abs(car.speed) < 4 && !forward) car.speed = 0;
  const steer = input.steer * def.grip * clamp(Math.abs(car.speed) / 90, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = !!input.brake;
  // Keep inside the world.
  car.x = clamp(car.x, 30, WORLD - 30);
  car.y = clamp(car.y, 30, WORLD - 30);
}

export function carCorners(car) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const hw = car.w / 2, hh = car.h / 2;
  return [
    { x: car.x + c * hh - s * hw, y: car.y + s * hh + c * hw },
    { x: car.x + c * hh + s * hw, y: car.y + s * hh - c * hw },
    { x: car.x - c * hh + s * hw, y: car.y - s * hh - c * hw },
    { x: car.x - c * hh - s * hw, y: car.y - s * hh + c * hw },
  ];
}

// Traffic AI: pick a road lane, drive along it, turn at intersections,
// slow down when another car is close ahead.
export function updateTraffic(car, city, cars, dt, rng) {
  const def = CAR_TYPES[car.type];
  const target = car.speed < def.top * 0.55 ? 1 : 0;
  let blocked = false;
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 90 && Math.cos(car.angle) * dx + Math.sin(car.angle) * dy > 0) { blocked = true; break; }
  }
  updateCarPhysics(car, { throttle: blocked ? 0 : target, steer: 0, brake: blocked }, dt);
  if (!onRoad(city, car.x, car.y)) {
    // Steer back to the nearest road.
    const p = nearestRoadPoint(city, car.x, car.y);
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
  } else if (rng() < dt * 0.12) {
    // At an intersection, sometimes turn.
    const p = nearestRoadPoint(city, car.x, car.y);
    const alongV = Math.abs(Math.sin(car.angle)) > 0.7;
    const nearCross = Math.min(Math.abs(car.x - p.x), Math.abs(car.y - p.y)) < 4;
    if (nearCross && rng() < 0.35) {
      car.angle += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      car.x = p.x; car.y = p.y;
    }
  }
  car.stuck += dt;
  if (car.stuck > 14) { // teleports a hopelessly stuck car to a fresh road
    const p = nearestRoadPoint(city, car.x + (rng() - 0.5) * 600, car.y + (rng() - 0.5) * 600);
    car.x = p.x; car.y = p.y; car.angle = p.vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    car.stuck = 0;
  }
}

export function spawnTrafficCar(city, rng, exclude) {
  const types = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'truck', 'sports'];
  const type = types[Math.floor(rng() * types.length)];
  const vertical = rng() < 0.5;
  let x, y, angle;
  if (vertical) {
    const rx = city.roadsV[Math.floor(rng() * city.roadsV.length)];
    x = rx + (rng() < 0.5 ? -22 : 22);
    y = 60 + rng() * (WORLD - 120);
    angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const ry = city.roadsH[Math.floor(rng() * city.roadsH.length)];
    x = 60 + rng() * (BEACH_X - 120);
    y = ry + (rng() < 0.5 ? -22 : 22);
    angle = rng() < 0.5 ? 0 : Math.PI;
  }
  const car = makeCar(type, x, y, angle);
  car.traffic = true;
  car.speed = 120 + rng() * 90;
  if (exclude && Math.hypot(car.x - exclude.x, car.y - exclude.y) < 500) return null;
  return car;
}

// Draw a car top-down with a slight 3/4 feel: body, roof, windshield,
// wheels, headlights and (for police) a light bar.
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w, h = car.h;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(3, 5, w * 0.62, h * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#141414';
  const wy = h * 0.30;
  for (const [wx, wyy] of [[-w / 2 - 2, -wy], [w / 2 + 2, -wy], [-w / 2 - 2, wy], [w / 2 + 2, wy]]) {
    ctx.fillRect(wx - 4, wyy - 8, 8, 16);
  }
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fill();
  // Roof + windshield.
  ctx.fillStyle = 'rgba(20,28,40,0.85)';
  roundRect(ctx, -w / 2 + 5, -h * 0.18, w - 10, h * 0.30, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.9)';
  ctx.fillRect(-w / 2 + 6, -h * 0.30, w - 12, 5);
  ctx.fillRect(-w / 2 + 6, h * 0.16, w - 12, 5);
  // Headlights / brake lights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 2, 5, 8);
  ctx.fillRect(w / 2 - 8, -h / 2 + 2, 5, 8);
  ctx.fillStyle = car.brakeLight ? '#ff2d2d' : '#a02020';
  ctx.fillRect(-w / 2 + 3, h / 2 - 10, 5, 8);
  ctx.fillRect(w / 2 - 8, h / 2 - 10, 5, 8);
  if (car.type === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-w / 2 + 4, -4, w - 8, 8);
    ctx.fillStyle = 'BLACK';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 2);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath(); ctx.arc(-w * 0.22, -h * 0.30, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
    ctx.beginPath(); ctx.arc(w * 0.22, -h * 0.30, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, h * 0.36);
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
