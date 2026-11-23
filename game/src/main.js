// Solmar Bay — boot, game loop, input, state machine, wanted system,
// combat, car enter/exit and screenshot staging.

import { generateCity, collideBuildings, WORLD } from './city.js';
import { makeRig, RIG_PALETTES } from './rig.js';
import { makeCar, updateDrive, updateTraffic, CAR_TYPES } from './vehicles.js';
import { makePed, makeCop, spawnPeds, updatePed, updateCop } from './peds.js';
import { MISSIONS, startMission, updateMission, missionTarget } from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawMinimap } from './hud.js';
import { AudioSys } from './audio.js';
import { saveGame, loadGame, clearSave } from './save.js';

const SEED = 20261123;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');

const state = {
  mode: 'title', // title | play | pause | busted | wasted | missiondone
  city: generateCity(SEED),
  player: null,
  traffic: [],
  parkedCars: [],
  policeCars: [],
  peds: [],
  cops: [],
  bullets: [],
  effects: [],
  wanted: 0,
  wantedT: 0,
  crimeT: 0,
  cash: 0,
  completedMissions: [],
  nextMission: 1,
  mission: null,
  timeOfDay: 10.5,
  weather: 'sunny',
  weatherT: 45,
  banner: '',
  bannerT: 0,
  cam: { x: 1250, y: 950, w: 1280, h: 800 },
  audio: new AudioSys(),
  saveT: 0,
  shot: null,
  t: 0,
};

function makePlayer(x, y) {
  return {
    x, y, angle: 0, rig: makeRig(RIG_PALETTES.danny),
    inCar: false, car: null, hasPistol: false,
    moving: false, health: 100, firedRecently: 0,
    punchT: 0, aimAngle: 0,
  };
}

function resetWorld() {
  state.player = makePlayer(1250, 950);
  state.traffic = [];
  state.parkedCars = [];
  state.policeCars = [];
  state.peds = [];
  state.cops = [];
  state.bullets = [];
  state.effects = [];
  state.wanted = 0;
  state.crimeT = 0;
  state.cash = 0;
  state.completedMissions = [];
  state.nextMission = 1;
  state.mission = null;
  state.timeOfDay = 10.5;
  state.weather = 'sunny';
  // Parked cars around town.
  const parkedSpots = [
    ['sedan', 1180, 1010, 0], ['coupe', 1450, 890, 1.57], ['taxi', 1330, 1150, 0],
    ['van', 950, 1250, 1.57], ['sport', 1750, 950, 0], ['sedan', 650, 720, 1.57],
    ['truck', 350, 1950, 0], ['taxi', 1850, 590, 1.57], ['coupe', 2150, 1550, 0],
  ];
  for (const [type, x, y, a] of parkedSpots) {
    const car = makeCar(type, x, y, a);
    car.parked = true;
    state.parkedCars.push(car);
  }
  state.peds = spawnPeds(state.city, 26, 1250, 950, 900);
  state.mission = startMission(state, 1);
  showBanner("Mara: pick up the package at the Docks.");
}

// ---------- wanted ----------
function addWanted(n) {
  state.wanted = Math.min(5, state.wanted + n);
  state.crimeT = 0;
  state.wantedT = 0;
}

function updateWanted(dt) {
  state.crimeT += dt;
  const copNear = state.cops.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 420)
    || state.policeCars.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 420);
  // Heat cools when the player stays clean and out of sight.
  if (state.wanted > 0 && state.crimeT > 25 && !copNear) {
    state.wantedT += dt;
    if (state.wantedT > 18) {
      state.wanted--;
      state.wantedT = 0;
    }
  }
  // Spawn police to match the heat.
  const wantCops = Math.min(3, state.wanted);
  const wantCars = state.wanted >= 2 ? Math.min(3, state.wanted - 1) : 0;
  while (state.cops.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    const x = state.player.x + Math.cos(a) * 420;
    const y = state.player.y + Math.sin(a) * 420;
    const fixed = collideBuildings(state.city, x, y, 12);
    state.cops.push(makeCop(state.city, fixed.x, fixed.y));
  }
  while (state.policeCars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    const car = makeCar('police', state.player.x + Math.cos(a) * 500, state.player.y + Math.sin(a) * 500, a);
    car.police = true;
    state.policeCars.push(car);
  }
  // Despawn police that fell far behind when the heat is gone.
  if (state.wanted === 0) {
    state.cops = state.cops.filter((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
    state.policeCars = [];
  }
}

// ---------- banners / overlays ----------
function showBanner(text, secs) {
  state.banner = text;
  state.bannerT = secs || 5;
}

function showOverlay(id) {
  for (const el of document.querySelectorAll('.overlay')) el.classList.add('hidden');
  if (id) document.getElementById(id).classList.remove('hidden');
}

// ---------- input ----------
const keys = {};
let mouse = { x: 0, y: 0, down: false };
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') e.preventDefault();
  if ((e.key === 'p' || e.key === 'Escape') && state.mode === 'play') pauseGame();
  else if ((e.key === 'p' || e.key === 'Escape') && state.mode === 'pause') resumeGame();
  if (e.key === 'Enter' && state.mode === 'title') startGame(false);
  if (e.key.toLowerCase() === 'm') state.audio.setMuted(!state.audio.muted);
  if (e.key.toLowerCase() === 'e' && state.mode === 'play') tryEnterExitCar();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.down = true;
  if (state.mode === 'play') shoot();
});
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });

function readInput() {
  return {
    up: keys['w'] || keys['arrowup'],
    down: keys['s'] || keys['arrowdown'],
    left: keys['a'] || keys['arrowleft'],
    right: keys['d'] || keys['arrowright'],
    handbrake: keys['shift'],
  };
}

// ---------- actions ----------
function tryEnterExitCar() {
  const p = state.player;
  if (p.inCar) {
    // Exit: step out beside the car, leave it parked.
    const car = p.car;
    const side = Math.PI / 2;
    p.x = car.x + Math.cos(car.angle + side) * 40;
    p.y = car.y + Math.sin(car.angle + side) * 40;
    const fixed = collideBuildings(state.city, p.x, p.y, 12);
    p.x = fixed.x; p.y = fixed.y;
    p.inCar = false;
    p.car = null;
    car.speed = 0;
    car.parked = true;
    state.parkedCars.push(car);
    state.audio.click();
    return;
  }
  const all = [...state.traffic, ...state.parkedCars, ...state.policeCars];
  let best = null;
  let bestD = 80;
  for (const car of all) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  p.inCar = true;
  p.car = best;
  best.traffic = false;
  best.parked = false;
  state.traffic = state.traffic.filter((c) => c !== best);
  state.parkedCars = state.parkedCars.filter((c) => c !== best);
  state.policeCars = state.policeCars.filter((c) => c !== best);
  if (best.type === 'police') addWanted(2);
  else addWanted(1);
  showBanner(best.type === 'taxi' ? 'Taxi stolen — work the fares.' : `Stole a ${CAR_TYPES[best.type].name}. The cops noticed.`, 3);
  state.audio.engine(0, true);
}

function punch() {
  const p = state.player;
  if (p.inCar || p.punchT > 0) return;
  p.punchT = 0.35;
  state.audio.punch();
  const fx = { x: p.x + Math.cos(p.angle) * 34, y: p.y + Math.sin(p.angle) * 34, t: 0, life: 0.25 };
  state.effects.push(fx);
  for (const ped of [...state.peds, ...state.cops]) {
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d > 48 || ped.state === 'down') continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    let diff = Math.abs(ang - p.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 1.1) continue;
    ped.state = 'down';
    ped.downT = ped.kind === 'cop' ? 10 : 6;
    addWanted(ped.kind === 'cop' ? 2 : 1);
    if (ped.kind === 'cop') showBanner('You knocked out a cop! Heat is rising.', 3);
    break;
  }
}

function shoot() {
  const p = state.player;
  if (p.inCar || !p.hasPistol) return;
  const now = performance.now();
  if (p.lastShot && now - p.lastShot < 220) return;
  p.lastShot = now;
  p.firedRecently = 0.6;
  state.audio.shoot();
  const cam = state.cam;
  const wx = cam.x - cam.w / 2 + mouse.x;
  const wy = cam.y - cam.h / 2 + mouse.y;
  const ang = Math.atan2(wy - p.y, wx - p.x);
  p.aimAngle = ang;
  p.angle = ang;
  state.bullets.push({ x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20, vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900, life: 0.9 });
  addWanted(1);
}

// ---------- game flow ----------
function startGame(continueSave) {
  resetWorld();
  if (continueSave) {
    const save = loadGame();
    if (save) {
      state.cash = save.cash;
      state.completedMissions = save.completedMissions || [];
      state.nextMission = save.nextMission || 1;
      state.player.hasPistol = !!save.hasPistol;
      state.player.x = save.player.x;
      state.player.y = save.player.y;
      state.timeOfDay = save.timeOfDay || 10.5;
      state.mission = startMission(state, state.nextMission);
    }
  }
  state.mode = 'play';
  showOverlay(null);
  state.audio.ensure();
  showBanner(state.mission ? `Job ${state.nextMission}: ${state.mission.def.title} — ${state.mission.def.briefing}` : '', 6);
}

function pauseGame() {
  state.mode = 'pause';
  showOverlay('pause-menu');
}
function resumeGame() {
  state.mode = 'play';
  showOverlay(null);
}

function endRun(kind) {
  state.mode = kind; // 'busted' | 'wasted'
  state.audio.busted();
  const lost = Math.min(state.cash, 100);
  state.cash -= lost;
  state.wanted = 0;
  state.cops = [];
  state.policeCars = [];
  document.getElementById('end-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('end-text').textContent = kind === 'busted'
    ? `The cops caught you. You lost $${lost} in bail.`
    : `You didn't make it. The crew picked you up — minus $${lost}.`;
  showOverlay('end-menu');
  saveGame(state);
}

function respawn() {
  const p = state.player;
  p.x = 650; p.y = 650;
  p.health = 100;
  p.inCar = false;
  p.car = null;
  state.cam.x = p.x;
  state.cam.y = p.y;
  state.mode = 'play';
  showOverlay(null);
}

// ---------- update ----------
function update(dt) {
  state.t += dt;
  const p = state.player;
  p.firedRecently = Math.max(0, p.firedRecently - dt);
  p.punchT = Math.max(0, p.punchT - dt);

  // Clock + weather.
  state.timeOfDay = (state.timeOfDay + dt / 150) % 24;
  state.weatherT -= dt;
  if (state.weatherT <= 0) {
    state.weatherT = 45 + Math.random() * 40;
    const roll = Math.random();
    state.weather = roll < 0.6 ? 'sunny' : roll < 0.85 ? 'rain' : 'fog';
  }
  if (state.bannerT > 0) {
    state.bannerT -= dt;
    if (state.bannerT <= 0) state.banner = '';
  }

  // Player movement.
  const input = readInput();
  // Screenshot staging keeps the car rolling so the shot reads as driving.
  if ((state.shot === 'drive' || state.shot === 'chase') && p.inCar) input.up = true;
  if (p.inCar && p.car) {
    updateDrive(p.car, input, dt);
    const before = { x: p.car.x, y: p.car.y };
    const fixed = collideBuildings(state.city, p.car.x, p.car.y, 26);
    if (fixed.x !== p.car.x || fixed.y !== p.car.y) p.car.speed *= 0.45;
    p.car.x = fixed.x;
    p.car.y = fixed.y;
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.moving = Math.abs(p.car.speed) > 10;
    state.audio.engine(p.car.speed, true);
    // Hit-and-run: fast car clips a pedestrian.
    for (const ped of [...state.peds, ...state.cops]) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 34 && Math.abs(p.car.speed) > 150) {
        ped.state = 'down';
        ped.downT = 8;
        addWanted(1);
        p.car.speed *= 0.7;
      }
    }
  } else {
    state.audio.engine(0, false);
    const run = input.handbrake ? 1.55 : 1;
    const speed = 175 * run;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    p.moving = len > 0;
    if (len > 0) {
      mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      const fixed = collideBuildings(state.city, nx, ny, 12);
      p.x = fixed.x;
      p.y = fixed.y;
    }
    if (keys[' ']) punch();
  }

  // Traffic: keep the streets alive near the player, one car at a time.
  state.spawnT = (state.spawnT || 0) - dt;
  if (state.traffic.length < 14 && state.spawnT <= 0) {
    state.spawnT = 1.2;
    const types = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'truck', 'sport'];
    const type = types[Math.floor(Math.random() * types.length)];
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * (700 + Math.random() * 300);
    const y = p.y + Math.sin(a) * (700 + Math.random() * 300);
    const road = Math.abs(x - 1250) < Math.abs(y - 1250)
      ? { x: Math.round(x / 300) * 300, y }
      : { x, y: Math.round(y / 300) * 300 };
    const car = makeCar(type, Math.max(120, Math.min(2480, road.x)), Math.max(120, Math.min(2260, road.y)), Math.random() * Math.PI * 2);
    car.traffic = true;
    state.traffic.push(car);
  }
  for (const car of state.traffic) updateTraffic(car, state.city, dt);
  // Thin out far traffic.
  state.traffic = state.traffic.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1400);
  // Keep cars from stacking on top of each other (cheap circle separation).
  const allCars = [...state.traffic, ...state.policeCars, ...(p.inCar && p.car ? [p.car] : [])];
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      const a = allCars[i];
      const b = allCars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 68) {
        const push = (68 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
  // Keep pedestrians topped up.
  if (state.peds.length < 22) {
    state.peds.push(...spawnPeds(state.city, 4, p.x, p.y, 800));
  }
  for (const ped of state.peds) updatePed(state.city, ped, state, dt, state.t);
  state.peds = state.peds.filter((pd) => Math.hypot(pd.x - p.x, pd.y - p.y) < 1300);

  // Police cars chase the player's car (or the player on foot).
  for (const car of state.policeCars) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    const desired = Math.atan2(dy, dx);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff * 4 * dt));
    const targetSpeed = d < 80 ? 60 : 380;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.4);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideBuildings(state.city, car.x, car.y, 26);
    if (fixed.x !== car.x || fixed.y !== car.y) car.speed *= 0.5;
    car.x = fixed.x;
    car.y = fixed.y;
    // Ram the player on foot.
    if (!p.inCar && d < 34 && Math.abs(car.speed) > 120) {
      p.health -= 34;
      car.speed *= 0.4;
      showBanner('A patrol car rammed you!', 2);
    }
  }
  const sirenOn = state.policeCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 600);
  state.audio.siren(sirenOn);

  // Foot cops.
  for (const cop of state.cops) {
    if (cop.state === 'down') {
      cop.downT -= dt;
      if (cop.downT <= 0) cop.state = 'chase';
      continue;
    }
    const busted = updateCop(state.city, cop, state, dt, state.t);
    if (busted) { endRun('busted'); return; }
  }
  state.cops = state.cops.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1100 || state.wanted > 0);

  // Bullets.
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const ped of [...state.peds, ...state.cops]) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 15) {
        ped.state = 'down';
        ped.downT = ped.kind === 'cop' ? 12 : 8;
        addWanted(ped.kind === 'cop' ? 2 : 1);
        b.life = 0;
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  for (const fx of state.effects) fx.t += dt;
  state.effects = state.effects.filter((fx) => fx.t < fx.life);

  // Missions.
  if (state.mission && !state.mission.done) {
    const ev = updateMission(state, dt);
    if (ev === 'step') {
      state.audio.pickup();
      const step = state.mission.def.steps[state.mission.stepIndex];
      showBanner(step ? step.text : '', 4);
    } else if (ev === 'complete') {
      state.audio.missionDone();
      state.audio.cash();
      const m = state.mission;
      state.nextMission = m.def.id + 1;
      document.getElementById('mission-title').textContent = `JOB DONE: ${m.def.title}`;
      document.getElementById('mission-text').textContent = `Mara paid you $${m.def.reward}.` + (m.def.grantPistol ? ' She left a pistol in your glovebox — click to shoot.' : '');
      state.mode = 'missiondone';
      showOverlay('mission-menu');
      saveGame(state);
    }
  }

  // Health regen + wasted.
  if (p.health < 100) p.health = Math.min(100, p.health + 4 * dt);
  if (p.health <= 0) { endRun('wasted'); return; }

  updateWanted(dt);

  // Camera follows the player.
  const cam = state.cam;
  cam.x += (p.x - cam.x) * Math.min(1, dt * 4);
  cam.y += (p.y - cam.y) * Math.min(1, dt * 4);
  cam.x = Math.max(cam.w / 2 - 100, Math.min(WORLD - cam.w / 2 + 100, cam.x));
  cam.y = Math.max(cam.h / 2 - 100, Math.min(WORLD - cam.h / 2 + 100, cam.y));

  // Autosave.
  state.saveT += dt;
  if (state.saveT > 15) {
    state.saveT = 0;
    saveGame(state);
  }
}

// ---------- render ----------
function render() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawWorld(ctx, state, state.cam, state.t);
  if (state.mode !== 'title') {
    drawHUD(ctx, state, w, h);
    minimap.style.display = 'block';
    drawMinimap(mctx, state, 200);
  } else {
    minimap.style.display = 'none';
  }
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'play') update(dt);
  else state.t += dt * 0.2;
  render();
  requestAnimationFrame(frame);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.cam.w = canvas.width;
  state.cam.h = canvas.height;
}
window.addEventListener('resize', resize);
resize();

// ---------- menus ----------
document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', () => {
  state.mode = 'title';
  showOverlay('title-menu');
  document.getElementById('btn-continue').classList.toggle('hidden', !loadGame());
});
document.getElementById('btn-respawn').addEventListener('click', respawn);
document.getElementById('btn-next-job').addEventListener('click', () => {
  if (state.nextMission <= MISSIONS.length) {
    state.mission = startMission(state, state.nextMission);
    showBanner(`Job ${state.nextMission}: ${state.mission.def.title} — ${state.mission.def.briefing}`, 6);
  } else {
    state.mission = null;
    showBanner('All jobs done. Solmar Bay is yours — free roam!', 6);
  }
  state.mode = 'play';
  showOverlay(null);
});

// ---------- screenshot staging ----------
function stageShot(shot) {
  state.shot = shot;
  resetWorld();
  if (shot === 'start') {
    state.mode = 'title';
    state.cam.x = 1250;
    state.cam.y = 950;
    showOverlay('title-menu');
    return;
  }
  state.mode = 'play';
  showOverlay(null);
  if (shot === 'drive') {
    const car = makeCar('coupe', 1250, 1100, 0);
    state.player.inCar = true;
    state.player.car = car;
    car.speed = 300;
    state.player.x = car.x;
    state.player.y = car.y;
    state.cam.x = 1250;
    state.cam.y = 1100;
    state.timeOfDay = 13;
    state.weather = 'sunny';
  } else if (shot === 'chase') {
    const car = makeCar('sport', 1100, 1100, 0);
    state.player.inCar = true;
    state.player.car = car;
    car.speed = 340;
    state.player.x = car.x;
    state.player.y = car.y;
    state.wanted = 3;
    state.mission = startMission(state, 3);
    state.timeOfDay = 18.2;
    state.weather = 'rain';
    state.cam.x = 1100;
    state.cam.y = 1100;
    for (let i = 0; i < 2; i++) {
      const pc = makeCar('police', 950 - i * 110, 1100 + 20 * i, 0);
      pc.police = true;
      pc.speed = 330;
      state.policeCars.push(pc);
    }
    state.cops.push(makeCop(state.city, 1200, 1180));
    showBanner('Lose them — reach the Safehouse!', 5);
  } else if (shot === 'mission') {
    state.player.x = 420;
    state.player.y = 1980;
    state.cam.x = 420;
    state.cam.y = 1980;
    state.timeOfDay = 10;
    state.weather = 'sunny';
    showBanner("Mara: pick up the package at the Docks.", 5);
  }
}

// ---------- boot ----------
(function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const hasSave = !!loadGame();
  document.getElementById('btn-continue').classList.toggle('hidden', !hasSave);
  if (shot) {
    stageShot(shot);
  } else {
    resetWorld();
    state.mode = 'title';
    showOverlay('title-menu');
  }
  requestAnimationFrame(frame);
  window.__solmar = state; // for debugging / playtests
})();
