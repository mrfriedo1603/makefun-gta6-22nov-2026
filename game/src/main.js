// main.js — Solmar Bay: boot, input, the game loop and the state machine.
// States: title, playing, paused, busted, wasted, missiondone, alldone.
// The game also stages its own screenshots: ?shot=start|drive|chase|mission
// with &seed=N builds a fixed scene so every screenshot is a real render.

import { createCity, mulberry32, randomRoadPoint, randomSidewalkPoint, resolveBuildingCollision, hitBuilding, WORLD } from './city.js';
import { makeHeroRig } from './rig.js';
import { makeCar, updateCarPhysics, updateTraffic, spawnTrafficCar, carCorners } from './vehicles.js';
import { makePed, updatePed, makeCop, updateCopCar, updateCopFoot } from './peds.js';
import { MISSIONS, startMission, advanceMission, currentStepText, missionPlace } from './missions.js';
import { createCamera, updateCamera, render } from './render.js';
import { drawHUD, drawTitle, drawOverlay } from './hud.js';
import * as audio from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let vw = 1280, vh = 800;

function resize() {
  vw = window.innerWidth; vh = window.innerHeight;
  canvas.width = vw; canvas.height = vh;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '20261123', 10);
const rng = mulberry32(SEED);

const city = createCity(SEED);
const cam = createCamera();

const game = {
  city, cam, time: 0, timeOfDay: 0.42, weather: 'sunny', weatherT: 0,
  cash: 150, wanted: 0, wantedT: 0, state: 'title',
  cars: [], peds: [], cops: [], bullets: [], particles: [], skids: [],
  mission: { index: 0, step: 0, active: false, done: [], collected: 0, target: null, timer: 0, banner: '' },
  missionText: '', banner: '', bannerT: 0,
  player: null,
  shotMode: !!SHOT,
};

function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, health: 100, rig: makeHeroRig(),
    moving: false, pose: 'walk', car: null, speed: 0,
    punchT: 0, shootT: 0, hasGun: false, invuln: 0,
  };
}

function spawnWorld() {
  game.cars = [];
  game.peds = [];
  game.cops = [];
  game.bullets = [];
  game.particles = [];
  game.skids = [];
  // Parked cars around the city.
  for (let i = 0; i < 14; i++) {
    const p = randomRoadPoint(city, rng);
    const car = makeCar(['sedan', 'sports', 'pickup', 'van'][Math.floor(rng() * 4)], p.x, p.y, p.vertical ? Math.PI / 2 : 0);
    game.cars.push(car);
  }
  for (let i = 0; i < 10; i++) {
    const c = spawnTrafficCar(city, rng, game.player);
    if (c) game.cars.push(c);
  }
  for (let i = 0; i < 46; i++) game.peds.push(makePed(city, rng));
}

function setBanner(text, t) {
  game.banner = text; game.bannerT = t || 5;
}

function setWanted(n, reason) {
  game.wanted = Math.max(0, Math.min(5, n));
  game.wantedT = 0;
  if (n > 0 && reason) setBanner(reason, 4);
}

function addParticles(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    game.particles.push({
      x, y, vx: Math.cos(a) * speed * (0.4 + rng() * 0.6),
      vy: Math.sin(a) * speed * (0.4 + rng() * 0.6),
      r: 2 + rng() * 3, life: 0.5 + rng() * 0.4, max: 0.9, color,
    });
  }
}

function burst(x, y, color, n) { addParticles(x, y, color, n, 160); }

// ---- missions ----
function beginMission() {
  const m = startMission(game.mission, city, rng);
  if (!m) return;
  game.missionText = currentStepText(game.mission);
  setBanner(m.name + ' — ' + m.brief, 7);
  audio.playMission();
}

function missionTargetReached() {
  const m = MISSIONS[game.mission.index];
  const step = m.steps[game.mission.step];
  if (step.kind === 'goto' || step.kind === 'drive') {
    const res = advanceMission(game.mission, city, rng);
    if (res.finished) {
      game.cash += res.finished.reward;
      if (res.finished.id === 1) {
        game.player.hasGun = true;
        setBanner('Mission complete: ' + res.finished.name + '  +$' + res.finished.reward + ' — Mara gave you a pistol (click to shoot)', 6);
      } else {
        setBanner('Mission complete: ' + res.finished.name + '  +$' + res.finished.reward, 6);
      }
      audio.playMission();
      saveGame(game);
      if (game.mission.index >= MISSIONS.length) { game.state = 'alldone'; return; }
      game.state = 'missiondone';
      game.stateT = 0;
    } else {
      game.missionText = currentStepText(game.mission);
      audio.playPickup();
    }
  }
}

function collectFare(ms, m) {
  const step = m.steps[ms.step];
  const t = ms.target;
  if (!t) return;
  const d = Math.hypot(game.player.x - t.x, game.player.y - t.y);
  if (d < 70) {
    ms.collected++;
    audio.playPickup();
    burst(t.x, t.y, '#7ddc5c', 10);
    if (ms.collected >= step.count) {
      const res = advanceMission(ms, city, rng);
      if (res.finished) {
        game.cash += res.finished.reward;
        setBanner('Mission complete: ' + res.finished.name + '  +$' + res.finished.reward, 6);
        audio.playMission();
        saveGame(game);
        if (ms.index >= MISSIONS.length) { game.state = 'alldone'; return; }
        game.state = 'missiondone'; game.stateT = 0;
      } else {
        game.missionText = currentStepText(ms);
      }
    } else {
      ms.target = missionPlace(city, 'fare', rng);
      game.missionText = currentStepText(ms);
      setBanner('Fare collected: ' + ms.collected + ' / ' + step.count, 3);
    }
  }
}

function updateMission(dt) {
  const ms = game.mission;
  if (!ms.active) return;
  const m = MISSIONS[ms.index];
  const step = m.steps[ms.step];
  ms.timer += dt;
  if (step.kind === 'goto' || step.kind === 'drive') {
    const t = ms.target;
    if (!t) return;
    const d = Math.hypot(game.player.x - t.x, game.player.y - t.y);
    if (d < 70) missionTargetReached();
  } else if (step.kind === 'collect') {
    collectFare(ms, m);
  } else if (step.kind === 'escape') {
    if (game.wanted === 0) {
      const res = advanceMission(ms, city, rng);
      if (res.finished) {
        game.cash += res.finished.reward;
        setBanner('Mission complete: ' + res.finished.name + '  +$' + res.finished.reward, 6);
        audio.playMission();
        saveGame(game);
        if (ms.index >= MISSIONS.length) { game.state = 'alldone'; return; }
        game.state = 'missiondone'; game.stateT = 0;
      } else { game.missionText = currentStepText(ms); audio.playPickup(); }
    }
  }
}

// ---- police ----
function updatePolice(dt) {
  const want = game.wanted;
  const wantCars = want >= 2 ? Math.min(4, want - 1) : 0;
  const wantFoot = want >= 1 ? Math.min(3, want) : 0;
  const copCars = game.cops.filter(c => c.car);
  const copFoot = game.cops.filter(c => !c.car);
  while (copCars.length < wantCars) {
    const a = rng() * Math.PI * 2;
    const cop = makeCop(city, rng, game.player.x + Math.cos(a) * 500, game.player.y + Math.sin(a) * 500, true);
    game.cops.push(cop); copCars.push(cop);
    audio.playSirenBlip();
  }
  while (copFoot.length < wantFoot) {
    const a = rng() * Math.PI * 2;
    const cop = makeCop(city, rng, game.player.x + Math.cos(a) * 320, game.player.y + Math.sin(a) * 320, false);
    game.cops.push(cop); copFoot.push(cop);
  }
  for (const cop of [...game.cops]) {
    const d = Math.hypot(cop.x - game.player.x, cop.y - game.player.y);
    if (game.wanted === 0 && d > 700) { game.cops.splice(game.cops.indexOf(cop), 1); continue; }
    if (cop.car) {
      updateCopCar(cop, game.player, dt);
      if (d < 46) {
        // Ram: damage the player's car or knock the player down.
        if (game.player.car) {
          game.player.car.health -= 18 * dt;
          if (rng() < dt * 2) audio.playCrash();
          if (game.player.car.health <= 0) { explodeCar(game.player.car); exitCar(true); }
        } else if (game.player.invuln <= 0) {
          hurtPlayer(12);
        }
      }
    } else {
      const dist = updateCopFoot(cop, game.player, city, dt);
      if (dist < 26 && game.player.invuln <= 0) {
        if (game.player.car) { /* foot cop cannot grab a driver */ }
        else { busted(); return; }
      }
    }
  }
}

function explodeCar(car) {
  burst(car.x, car.y, '#ff7a1e', 26);
  burst(car.x, car.y, '#3a3a3a', 18);
  audio.playCrash();
  const i = game.cars.indexOf(car);
  if (i >= 0) game.cars.splice(i, 1);
}

function hurtPlayer(n) {
  const pl = game.player;
  if (pl.invuln > 0) return;
  pl.health -= n;
  pl.invuln = 0.7;
  burst(pl.x, pl.y, '#c92d2d', 8);
  if (pl.health <= 0) { pl.health = 0; game.state = 'wasted'; game.stateT = 0; audio.playFail(); }
}

function busted() {
  game.state = 'busted'; game.stateT = 0;
  game.cash = Math.max(0, game.cash - 200);
  audio.playFail();
  saveGame(game);
}

function exitCar(wrecked) {
  const pl = game.player;
  if (!pl.car) return;
  const car = pl.car;
  pl.car = null;
  pl.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  pl.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  pl.angle = car.angle;
  resolveBuildingCollision(city, pl, 14);
  audio.stopEngine();
  if (!wrecked) setBanner('On foot — press E near a car to take it', 3);
}

// ---- input ----
const keys = {};
const mouse = { x: 0, y: 0, down: false };
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  audio.ensureAudio();
  if (e.key === 'Enter' && game.state === 'title') startGame(false);
  if ((e.key === 'c' || e.key === 'C') && game.state === 'title' && hasSave()) startGame(true);
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && game.state === 'playing') { game.state = 'paused'; saveGame(game); }
  else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && game.state === 'paused') { game.state = 'playing'; }
  if ((e.key === 'm' || e.key === 'M')) audio.setMuted(!audio.isMuted());
  if (e.key === 'Enter' && (game.state === 'missiondone' || game.state === 'busted' || game.state === 'wasted')) {
    if (game.state === 'missiondone') { game.state = 'playing'; beginMission(); }
    else { respawn(); }
  }
  if (e.key === 'Enter' && game.state === 'alldone') { game.state = 'title'; }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  mouse.down = true; audio.ensureAudio();
  if (game.state === 'title') { startGame(false); return; }
  if (game.state === 'playing' && game.player && !game.player.car && game.player.hasGun) shoot();
});
window.addEventListener('mouseup', () => { mouse.down = false; });

function startGame(continueSave) {
  audio.ensureAudio();
  audio.playClick();
  let saved = null;
  if (continueSave) saved = loadGame();
  game.player = makePlayer(saved ? saved.x : 1700, saved ? saved.y : 1700);
  if (saved) {
    game.cash = saved.cash;
    game.player.health = saved.health;
    game.mission.done = saved.missionsDone || [];
    game.mission.index = saved.missionIndex || 0;
    game.timeOfDay = saved.timeOfDay ?? 0.42;
  } else {
    game.cash = 150;
    game.mission.done = [];
    game.mission.index = 0;
    game.timeOfDay = 0.42;
  }
  game.wanted = 0;
  spawnWorld();
  cam.x = game.player.x; cam.y = game.player.y;
  game.state = 'playing';
  if (game.mission.index < MISSIONS.length) beginMission();
  else { game.mission.active = false; game.missionText = 'All missions done — free roam!'; }
}

function respawn() {
  game.player.health = 100;
  game.player.x = 1700; game.player.y = 1700;
  game.player.car = null;
  game.wanted = 0;
  game.cops = [];
  game.state = 'playing';
  setBanner('Back on the streets. Mara is waiting.', 4);
}

function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const car of game.cars) {
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function shoot() {
  const pl = game.player;
  if (pl.shootT > 0 || pl.car) return;
  pl.shootT = 0.35;
  pl.pose = 'aim';
  const wx = cam.x + (mouse.x - vw / 2) / cam.zoom;
  const wy = cam.y + (mouse.y - vh / 2) / cam.zoom;
  pl.angle = Math.atan2(wy - pl.y, wx - pl.x);
  const bx = pl.x + Math.cos(pl.angle) * 26;
  const by = pl.y + Math.sin(pl.angle) * 26;
  game.bullets.push({ x: bx, y: by, vx: Math.cos(pl.angle) * 900, vy: Math.sin(pl.angle) * 900, life: 0.6 });
  audio.playGunshot();
  setWanted(Math.max(game.wanted, 1), 'Shots fired — the cops are coming');
  for (const ped of game.peds) updatePed(ped, city, 0, rng, { x: pl.x, y: pl.y });
}

// ---- per-frame update ----
function update(dt) {
  game.time += dt;
  // Day/night clock: a full day is 8 minutes of play.
  game.timeOfDay = (game.timeOfDay + dt / 480) % 1;
  game.weatherT -= dt;
  if (game.weatherT <= 0) {
    const r = rng();
    game.weather = r < 0.62 ? 'sunny' : r < 0.86 ? 'rain' : 'fog';
    game.weatherT = 60 + rng() * 120;
    audio.setRain(game.weather === 'rain');
  }
  if (game.bannerT > 0) game.bannerT -= dt;
  const pl = game.player;
  pl.invuln = Math.max(0, pl.invuln - dt);
  pl.punchT = Math.max(0, pl.punchT - dt);
  pl.shootT = Math.max(0, pl.shootT - dt);

  // Wanted decay: lay low and it cools off.
  if (game.wanted > 0) {
    game.wantedT += dt;
    const cool = pl.car && Math.abs(pl.car.speed) > 240 ? 26 : 40;
    if (game.wantedT > cool) { game.wanted--; game.wantedT = 0; if (game.wanted === 0) setBanner('You lost them.', 3); }
  }

  // Input → movement.
  const up = keys['w'] || keys['arrowup'];
  const down = keys['s'] || keys['arrowdown'];
  const left = keys['a'] || keys['arrowleft'];
  const right = keys['d'] || keys['arrowright'];
  if (pl.car) {
    const car = pl.car;
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const throttle = (up ? 1 : 0) + (down ? -0.6 : 0);
    updateCarPhysics(car, { throttle, steer, brake: keys[' '] || keys['shift'], }, dt);
    audio.setEngine(true, Math.abs(car.speed) / 430);
    // Car vs buildings: stop and spark.
    const hit = hitBuilding(city, car.x, car.y, 26);
    if (hit) {
      car.speed *= -0.25;
      car.x -= Math.cos(car.angle) * 6;
      car.y -= Math.sin(car.angle) * 6;
      car.health -= 6;
      if (rng() < dt * 6) audio.playCrash();
      if (car.health <= 0) { explodeCar(car); exitCar(true); hurtPlayer(15); }
    }
    // Car vs traffic: bump.
    for (const other of game.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 52 && Math.abs(car.speed) > 120) {
        other.speed = car.speed * 0.4;
        other.x += (other.x - car.x) / d * 12;
        other.y += (other.y - car.y) / d * 12;
        car.speed *= 0.82;
        car.health -= 4;
        burst(other.x, other.y, '#ffd23d', 6);
        audio.playCrash();
        setWanted(Math.max(game.wanted, 1), 'Reckless driving — the cops noticed');
      }
    }
    // Skid marks at speed + steering.
    if (Math.abs(car.speed) > 200 && steer !== 0) {
      game.skids.push({ x1: car.x - Math.cos(car.angle) * 20, y1: car.y - Math.sin(car.angle) * 20, x2: car.x, y2: car.y });
      if (game.skids.length > 220) game.skids.splice(0, 40);
    }
    pl.x = car.x; pl.y = car.y; pl.angle = car.angle;
  } else {
    audio.setEngine(false, 0);
    const run = keys['shift'] ? 1.7 : 1;
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    const len = Math.hypot(mx, my);
    pl.moving = len > 0;
    if (len > 0) {
      mx /= len; my /= len;
      pl.angle = Math.atan2(my, mx);
      const sp = 165 * run;
      pl.x += mx * sp * dt;
      pl.y += my * sp * dt;
      pl.rig.phase += dt * (run > 1 ? 13 : 9);
      resolveBuildingCollision(city, pl, 14);
    }
    pl.pose = pl.punchT > 0 ? 'punch' : pl.shootT > 0 ? 'aim' : 'walk';
    // Punch.
    if (keys[' '] && pl.punchT <= 0) {
      pl.punchT = 0.4;
      audio.playPunch();
      const fx = pl.x + Math.cos(pl.angle) * 34, fy = pl.y + Math.sin(pl.angle) * 34;
      for (const ped of game.peds) {
        if (Math.hypot(ped.x - fx, ped.y - fy) < 30) {
          ped.state = 'flee'; ped.flee = 3;
          burst(ped.x, ped.y, '#c92d2d', 6);
          setWanted(Math.max(game.wanted, 1), 'Assault — the cops are coming');
        }
      }
      for (const cop of game.cops.filter(c => !c.car)) {
        if (Math.hypot(cop.x - fx, cop.y - fy) < 30) {
          burst(cop.x, cop.y, '#c92d2d', 6);
          setWanted(Math.min(5, game.wanted + 1), 'You hit a cop!');
        }
      }
    }
    // Enter a car.
    if (keys['e']) {
      keys['e'] = false;
      const car = nearestCar(64);
      if (car) {
        pl.car = car;
        const i = game.cars.indexOf(car);
        if (i >= 0) game.cars.splice(i, 1);
        setWanted(Math.max(game.wanted, car.type === 'police' ? 2 : 0), car.type === 'police' ? 'You stole a police car!' : '');
        if (car.type === 'police') setBanner('You stole a police car!', 4);
        audio.playClick();
      }
    }
  }
  // Exit a car.
  if (pl.car && keys['e']) { keys['e'] = false; exitCar(false); }

  // Traffic + pedestrians.
  for (const car of [...game.cars]) updateTraffic(car, city, game.cars, dt, rng);
  while (game.cars.filter(c => c.traffic).length < 12) {
    const c = spawnTrafficCar(city, rng, pl);
    if (c) game.cars.push(c); else break;
  }
  const danger = (pl.punchT > 0 || game.bullets.length > 0) ? { x: pl.x, y: pl.y } : null;
  for (const ped of game.peds) updatePed(ped, city, dt, rng, danger);
  while (game.peds.length < 46) game.peds.push(makePed(city, rng));

  // Bullets.
  for (const b of [...game.bullets]) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { game.bullets.splice(game.bullets.indexOf(b), 1); continue; }
    if (hitBuilding(city, b.x, b.y, 2)) { burst(b.x, b.y, '#aaa', 4); game.bullets.splice(game.bullets.indexOf(b), 1); continue; }
    for (const cop of [...game.cops]) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 20) {
        burst(cop.x, cop.y, '#c92d2d', 10);
        if (cop.car) { cop.car.health -= 34; if (cop.car.health <= 0) explodeCar(cop.car); }
        else game.cops.splice(game.cops.indexOf(cop), 1);
        setWanted(Math.min(5, game.wanted + 1), 'Officer down — every unit is coming');
        game.bullets.splice(game.bullets.indexOf(b), 1);
        break;
      }
    }
  }
  // Particles.
  for (const p of [...game.particles]) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) game.particles.splice(game.particles.indexOf(p), 1);
  }
  updatePolice(dt);
  updateMission(dt);
  if (game.mission.active) game.missionText = currentStepText(game.mission);
  updateCamera(cam, pl, vw, vh, dt);
}

// ---- screenshot staging ----
function stageShot(name) {
  game.player = makePlayer(1700, 1700);
  game.cash = 2450;
  game.player.hasGun = true;
  spawnWorld();
  game.state = 'playing';
  if (name === 'start') { game.state = 'title'; return; }
  if (name === 'drive') {
    const car = makeCar('sports', 1500, 1580, 0, '#e81e63');
    car.speed = 260;
    game.cars = game.cars.filter(c => !c.traffic);
    game.player.car = car;
    game.player.x = car.x; game.player.y = car.y;
    game.timeOfDay = 0.5;
    game.weather = 'sunny';
    game.weatherT = 999;
    game.mission.active = true;
    game.mission.index = 0;
    game.missionText = 'Bring the car to Mara\u2019s garage';
    game.mission.target = { x: 560, y: 560 };
    game.banner = 'Mission 1: First Gear — steal the car, bring it to the garage';
    game.bannerT = 999;
    cam.x = 1500; cam.y = 1580;
    for (let i = 0; i < 40; i++) updateTraffic(game.cars[0], city, game.cars, 0.016, rng);
    return;
  }
  if (name === 'chase') {
    const car = makeCar('sports', 1500, 1580, 0, '#ffd23d');
    game.player.car = car;
    game.player.x = car.x; game.player.y = car.y;
    car.speed = 300;
    game.timeOfDay = 0.78;
    game.weather = 'rain';
    game.weatherT = 999;
    setWanted(3, '');
    const copSpots = [[1280, 1580, 0], [1180, 1550, 0.2], [1300, 1620, -0.2]];
    for (const [cx, cy, ca] of copSpots) {
      const cop = makeCop(city, rng, cx, cy, true);
      cop.car.angle = ca;
      game.cops.push(cop);
    }
    game.mission.active = true;
    game.mission.index = 1;
    game.mission.step = 2; // escape step of mission 2: target is null by design
    game.missionText = 'Lose the heat — get your wanted level to 0';
    game.banner = 'WANTED ★★★ — lose the patrol cars!';
    game.bannerT = 999;
    cam.x = car.x; cam.y = car.y;
    return;
  }
  if (name === 'mission') {
    game.player.x = 900; game.player.y = 330;
    game.player.angle = -Math.PI / 2;
    game.timeOfDay = 0.32;
    game.weather = 'sunny';
    game.weatherT = 999;
    game.mission.active = true;
    game.mission.index = 1;
    game.missionText = 'Pick up the package at the north market';
    game.mission.target = { x: 900, y: 220 };
    game.banner = 'Mission 2: The Courier — Mara: "Package is at the north market. Don\u2019t keep it waiting."';
    game.bannerT = 999;
    for (let i = 0; i < 6; i++) game.peds.push(makePed(city, rng, 860 + rng() * 120, 200 + rng() * 120));
    cam.x = 900; cam.y = 260;
    return;
  }
}

// ---- loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state === 'playing') update(dt);
  else if (game.state === 'missiondone' || game.state === 'busted' || game.state === 'wasted' || game.state === 'alldone') {
    game.stateT = (game.stateT || 0) + dt;
  }
  if (game.state === 'title') {
    drawTitle(ctx, vw, vh, hasSave() ? loadGame() : null, game.time);
    game.time += dt;
  } else {
    render(ctx, game, vw, vh);
    drawHUD(ctx, game, vw, vh);
    if (game.state === 'paused') drawOverlay(ctx, vw, vh, 'PAUSED', ['Progress saved.', 'Mara is still waiting.'], 'Press P to keep playing · M to mute');
    if (game.state === 'missiondone') drawOverlay(ctx, vw, vh, 'MISSION COMPLETE', ['Cash: $' + game.cash.toLocaleString('en-US')], 'Press Enter for the next job');
    if (game.state === 'busted') drawOverlay(ctx, vw, vh, 'BUSTED', ['The department caught up with you.', 'Bail: $200'], 'Press Enter to get back out there');
    if (game.state === 'wasted') drawOverlay(ctx, vw, vh, 'WASTED', ['Solmar Bay is unforgiving.'], 'Press Enter to try again');
    if (game.state === 'alldone') drawOverlay(ctx, vw, vh, 'SOLMAR BAY IS YOURS', ['All five jobs done. $' + game.cash.toLocaleString('en-US') + ' banked.', 'Free roam unlocked — the city never sleeps.'], 'Press Enter for the title screen');
  }
  if (!game.shotMode) requestAnimationFrame(frame);
}

if (SHOT) {
  stageShot(SHOT);
  // One deterministic frame, then stop: headless screenshots capture it.
  frame(performance.now());
  document.title = 'Solmar Bay — shot ' + SHOT;
  window.__shotReady = true;
} else {
  game.player = makePlayer(1700, 1700);
  requestAnimationFrame(frame);
}
