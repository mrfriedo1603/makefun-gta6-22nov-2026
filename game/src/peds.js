// peds.js — pedestrians and the police. Pedestrians stroll the sidewalks
// and scatter from gunfire and speeding cars. The police respond to the
// wanted level: foot cops at 1 star, patrol cars from 2, and they get faster
// and bolder as the heat rises.

import { randomSidewalkPoint, resolveBuildingCollision, WORLD } from './city.js';
import { makeCar, updateCarPhysics } from './vehicles.js';
import { makeRig, makeCopRig } from './rig.js';

export function makePed(city, rng, x, y) {
  const p = x !== undefined ? { x, y } : randomSidewalkPoint(city, rng);
  return {
    ...p, angle: rng() * Math.PI * 2, speed: 26 + rng() * 26,
    rig: makeRig(rng), phase: rng() * 6, state: 'walk',
    wait: 0, flee: 0, panic: 0,
  };
}

export function updatePed(ped, city, dt, rng, danger) {
  ped.phase += dt * (ped.state === 'flee' ? 11 : 5);
  if (danger && Math.hypot(danger.x - ped.x, danger.y - ped.y) < 260) {
    ped.state = 'flee'; ped.flee = 2.5;
    ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
  }
  if (ped.state === 'flee') {
    ped.flee -= dt;
    if (ped.flee <= 0) ped.state = 'walk';
  }
  if (ped.state === 'walk') {
    ped.wait -= dt;
    if (ped.wait <= 0) {
      ped.angle += (rng() - 0.5) * 1.6;
      ped.wait = 1.5 + rng() * 3;
    }
  }
  const sp = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
  ped.x += Math.cos(ped.angle) * sp * dt;
  ped.y += Math.sin(ped.angle) * sp * dt;
  resolveBuildingCollision(city, ped, 12);
  if (ped.x < 20 || ped.y < 20 || ped.x > WORLD - 20 || ped.y > WORLD - 20) {
    ped.angle += Math.PI;
    ped.x = Math.max(20, Math.min(WORLD - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD - 20, ped.y));
  }
  ped.rig.phase = ped.phase;
}

export function makeCop(city, rng, x, y, inCar) {
  const cop = makePed(city, rng, x, y);
  cop.rig = makeCopRig();
  cop.cop = true;
  cop.state = 'chase';
  cop.car = null;
  if (inCar) {
    cop.car = makeCar('police', x, y, 0);
    cop.car.traffic = false;
    cop.car.siren = 1;
  }
  return cop;
}

// A police car chases the player: steer toward them, ram gently, and back
// off to re-approach when it overshoots.
export function updateCopCar(cop, player, dt) {
  const car = cop.car;
  const dx = player.x - car.x, dy = player.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.8));
  const throttle = dist > 60 ? 1 : 0.25;
  updateCarPhysics(car, { throttle, steer, brake: dist < 40 }, dt);
  car.siren = 1;
  cop.x = car.x; cop.y = car.y;
}

// A foot cop runs at the player and tries to grab them.
export function updateCopFoot(cop, player, city, dt) {
  const dx = player.x - cop.x, dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  const sp = 150;
  cop.x += Math.cos(cop.angle) * sp * dt;
  cop.y += Math.sin(cop.angle) * sp * dt;
  cop.phase += dt * 11;
  cop.rig.phase = cop.phase;
  resolveBuildingCollision(city, cop, 12);
  return dist;
}
