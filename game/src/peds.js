// Solmar Bay — pedestrians and police AI.

import { makeRig, drawRig, drawDowned, RIG_PALETTES } from './rig.js';
import { collideBuildings, onRoad } from './city.js';

let nextPedId = 1;

export function makePed(city, x, y, kind) {
  const palettes = RIG_PALETTES.ped;
  const pal = palettes[Math.floor(Math.random() * palettes.length)];
  return {
    id: nextPedId++,
    kind: kind || 'ped',
    rig: makeRig(pal),
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 26 + Math.random() * 22,
    // Sidewalk wandering: pick a road to walk alongside.
    target: null,
    state: 'walk',       // walk | flee | down | chase | arrest
    stateT: 0,
    downT: 0,
    panic: 0,
  };
}

export function spawnPeds(city, n, cx, cy, radius) {
  const peds = [];
  let guard = 0;
  while (peds.length < n && guard++ < n * 40) {
    const x = cx + (Math.random() * 2 - 1) * radius;
    const y = cy + (Math.random() * 2 - 1) * radius;
    if (x < 80 || y < 80 || x > 2520 || y > 2240) continue;
    if (onRoad(city, x, y)) continue;
    peds.push(makePed(city, x, y, 'ped'));
  }
  return peds;
}

export function makeCop(city, x, y) {
  const cop = makePed(city, x, y, 'cop');
  cop.rig = makeRig(RIG_PALETTES.cop);
  cop.speed = 118;
  cop.state = 'chase';
  return cop;
}

// Pedestrian update: walk the sidewalks, flee from danger, get up after
// being knocked down.
export function updatePed(city, ped, player, dt, t) {
  ped.stateT += dt;
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) {
      ped.state = 'walk';
      ped.panic = 0.4;
    }
    return;
  }

  // Danger: a fast car or a gunshot nearby makes peds flee.
  const dx = ped.x - player.x;
  const dy = ped.y - player.y;
  const d = Math.hypot(dx, dy);
  const playerSpeed = player.inCar ? Math.abs(player.car ? player.car.speed : 0) : 0;
  if (d < 160 && (playerSpeed > 200 || player.firedRecently > 0)) {
    ped.state = 'flee';
    ped.panic = 1;
  }
  if (ped.state === 'flee') {
    ped.panic -= dt * 0.25;
    const runAngle = Math.atan2(dy, dx);
    ped.angle = runAngle;
    const sp = 150;
    const nx = ped.x + Math.cos(runAngle) * sp * dt;
    const ny = ped.y + Math.sin(runAngle) * sp * dt;
    const fixed = collideBuildings(city, nx, ny, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
    if (ped.panic <= 0) ped.state = 'walk';
    return;
  }

  // Stroll: pick a nearby sidewalk target, walk to it, pick another.
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
    const road = city.roadsV[Math.floor(Math.random() * city.roadsV.length)];
    const along = 120 + Math.random() * 2000;
    const side = Math.random() < 0.5 ? -1 : 1;
    ped.target = { x: road + side * 52, y: along };
    if (Math.random() < 0.5) {
      const hroad = city.roadsH[Math.floor(Math.random() * city.roadsH.length)];
      ped.target = { x: 120 + Math.random() * 2200, y: hroad + side * 52 };
    }
  }
  const ta = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  let diff = ta - ped.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff * 4 * dt));
  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  const fixed = collideBuildings(city, nx, ny, 10);
  ped.x = fixed.x;
  ped.y = fixed.y;
}

// Police on foot: chase the player; touching the player for a beat busts them.
export function updateCop(city, cop, player, dt, t) {
  cop.stateT += dt;
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const d = Math.hypot(dx, dy);
  const ta = Math.atan2(dy, dx);
  let diff = ta - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cop.angle += Math.max(-4 * dt, Math.min(4 * dt, diff * 5 * dt));
  // Cops are slower than a sprinting player, faster than a walking one.
  const sp = player.inCar ? cop.speed * 1.35 : cop.speed;
  const nx = cop.x + Math.cos(cop.angle) * sp * dt;
  const ny = cop.y + Math.sin(cop.angle) * sp * dt;
  const fixed = collideBuildings(city, nx, ny, 10);
  cop.x = fixed.x;
  cop.y = fixed.y;
  // Arrest: stay glued to the player for a moment.
  if (d < 26) {
    cop.stateT += dt * 2;
    return cop.stateT > 1.6;
  }
  return false;
}

export function drawPed(ctx, ped, t) {
  if (ped.state === 'down') {
    drawDowned(ctx, ped.rig, ped.x, ped.y, ped.angle);
    return;
  }
  const moving = ped.state === 'flee' || ped.state === 'chase' || ped.state === 'walk';
  const speed = ped.state === 'flee' || ped.state === 'chase' ? 1 : 0.55;
  drawRig(ctx, ped.rig, ped.x, ped.y, ped.angle + Math.PI / 2, moving ? speed : 0, t);
}
