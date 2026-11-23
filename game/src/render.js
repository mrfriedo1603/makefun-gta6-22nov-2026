// render.js — draws Solmar Bay: ground, roads and lane markings, buildings
// with rooftops, the beach and sea, trees, then cars, people and the player,
// then the day/night light and the weather on top. The camera follows the
// player smoothly and never leaves the city.

import { WORLD, ROAD_W, BEACH_X } from './city.js';
import { drawCar } from './vehicles.js';
import { drawRig } from './rig.js';

const SKY = [
  { t: 0.0, top: '#0b1026', amb: 0.55 },  // night
  { t: 0.22, top: '#1b2f55', amb: 0.6 },  // dawn
  { t: 0.30, top: '#f2a65e', amb: 0.85 }, // sunrise
  { t: 0.45, top: '#7ec8f2', amb: 1.0 },  // morning
  { t: 0.62, top: '#6ec1f2', amb: 1.0 },  // noon
  { t: 0.75, top: '#f2b25e', amb: 0.9 },  // golden hour
  { t: 0.83, top: '#7a4a8a', amb: 0.7 },  // dusk
  { t: 0.92, top: '#0b1026', amb: 0.55 }, // night
  { t: 1.0, top: '#0b1026', amb: 0.55 },
];

export function lightFor(timeOfDay) {
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (timeOfDay >= SKY[i].t && timeOfDay <= SKY[i + 1].t) { a = SKY[i]; b = SKY[i + 1]; break; }
  }
  const f = (timeOfDay - a.t) / Math.max(0.001, b.t - a.t);
  return { top: a.top, amb: a.amb + (b.amb - a.amb) * f, night: a.amb < 0.75 };
}

export function createCamera() {
  return { x: 1700, y: 1700, zoom: 1 };
}

export function updateCamera(cam, target, vw, vh, dt) {
  const k = 1 - Math.pow(0.001, dt);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
  cam.zoom = Math.max(0.5, Math.min(1.15, Math.min(vw / 1100, vh / 800)));
  cam.x = Math.max(vw / 2 / cam.zoom, Math.min(WORLD - vw / 2 / cam.zoom, cam.x));
  cam.y = Math.max(vh / 2 / cam.zoom, Math.min(WORLD - vh / 2 / cam.zoom, cam.y));
}

export function render(ctx, game, vw, vh) {
  const { city, cam, timeOfDay, weather, time } = game;
  const light = lightFor(timeOfDay);
  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = '#0e1a2a';
  ctx.fillRect(0, 0, vw, vh);
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const vx0 = cam.x - vw / 2 / cam.zoom - 60, vx1 = cam.x + vw / 2 / cam.zoom + 60;
  const vy0 = cam.y - vh / 2 / cam.zoom - 60, vy1 = cam.y + vh / 2 / cam.zoom + 60;
  const inView = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  // Ground.
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Beach + sea.
  ctx.fillStyle = '#e8d5a0';
  ctx.fillRect(BEACH_X, vy0, WORLD - BEACH_X, vy1 - vy0);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(BEACH_X + 260, vy0, WORLD - BEACH_X - 260, vy1 - vy0);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let y = Math.floor(vy0 / 90) * 90; y < vy1; y += 90) {
    const wob = Math.sin(y * 0.02 + time * 0.8) * 14;
    ctx.moveTo(BEACH_X + 260 + wob, y);
    ctx.lineTo(BEACH_X + 300 + wob, y + 40);
  }
  ctx.stroke();

  // Parks and plazas.
  for (const lot of city.lots) {
    if (!inView(lot.x + lot.w / 2, lot.y + lot.h / 2, lot.w)) continue;
    ctx.fillStyle = lot.kind === 'park' ? '#5d9a4a' : '#b8a888';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
  }
  // Roads.
  ctx.fillStyle = '#3a3f46';
  for (const rx of city.roadsV) ctx.fillRect(rx - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
  for (const ry of city.roadsH) ctx.fillRect(vx0, ry - ROAD_W / 2, vx1 - vx0, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = '#9a9a92';
  for (const rx of city.roadsV) {
    ctx.fillRect(rx - ROAD_W / 2 - 12, vy0, 12, vy1 - vy0);
    ctx.fillRect(rx + ROAD_W / 2, vy0, 12, vy1 - vy0);
  }
  for (const ry of city.roadsH) {
    ctx.fillRect(vx0, ry - ROAD_W / 2 - 12, vx1 - vx0, 12);
    ctx.fillRect(vx0, ry + ROAD_W / 2, vx1 - vx0, 12);
  }
  // Lane markings.
  ctx.strokeStyle = '#e8d23d';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const rx of city.roadsV) {
    ctx.beginPath(); ctx.moveTo(rx, vy0); ctx.lineTo(rx, vy1); ctx.stroke();
  }
  for (const ry of city.roadsH) {
    ctx.beginPath(); ctx.moveTo(vx0, ry); ctx.lineTo(vx1, ry); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  for (const rx of city.roadsV) {
    for (const ry of city.roadsH) {
      if (!inView(rx, ry, 120)) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx + i * 12 - 4, ry - ROAD_W / 2 + 8, 8, 14);
        ctx.fillRect(rx + i * 12 - 4, ry + ROAD_W / 2 - 22, 8, 14);
      }
    }
  }
  // Trees.
  for (const t of city.trees) {
    if (!inView(t.x, t.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r * 0.8, t.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#4a9a3d' : '#3d7a33';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  // Buildings, sorted so nearer ones draw over farther ones.
  const visible = city.buildings.filter(b => inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h)));
  visible.sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of visible) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, 10);
    if (b.roof === 'pitched') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h * 0.5);
      ctx.lineTo(b.x + b.w / 2, b.y);
      ctx.lineTo(b.x + b.w, b.y + b.h * 0.5);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    }
    if (b.tall) {
      ctx.fillStyle = '#2b3a4a';
      for (let wx = b.x + 16; wx < b.x + b.w - 12; wx += 26) {
        for (let wy = b.y + 18; wy < b.y + b.h - 12; wy += 30) {
          ctx.fillRect(wx, wy, 10, 13);
        }
      }
    }
  }
  // Mission marker.
  if (game.mission.active && game.mission.target) {
    const t = game.mission.target;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(t.x, t.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 52); ctx.lineTo(t.x - 10, t.y - 34); ctx.lineTo(t.x + 10, t.y - 34);
    ctx.closePath(); ctx.fill();
  }
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 5;
  for (const s of game.skids) {
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  // Cars.
  for (const car of game.cars) drawCar(ctx, car, time);
  if (game.player.car) drawCar(ctx, game.player.car, time);
  // People.
  for (const ped of game.peds) {
    if (!inView(ped.x, ped.y, 60)) continue;
    drawRig(ctx, ped.rig, ped.x, ped.y, ped.angle, ped.state === 'flee' ? 1 : 0.6, 'walk');
  }
  for (const cop of game.cops) {
    if (cop.car) continue;
    if (!inView(cop.x, cop.y, 60)) continue;
    drawRig(ctx, cop.rig, cop.x, cop.y, cop.angle, 1, 'walk');
  }
  // Player.
  const pl = game.player;
  if (!pl.car) {
    drawRig(ctx, pl.rig, pl.x, pl.y, pl.angle, pl.moving ? 1 : 0, pl.pose);
  }
  // Bullets and muzzle flashes.
  ctx.fillStyle = '#ffd23d';
  for (const b of game.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Blood / impact puffs.
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Night darkening + headlight glow.
  if (light.night) {
    ctx.fillStyle = 'rgba(8,12,38,' + (0.42 * (0.75 - light.amb) / 0.2).toFixed(2) + ')';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }
  // Weather.
  if (weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,230,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = vx0 + ((i * 173 + time * 900) % (vx1 - vx0));
      const ry = vy0 + ((i * 97 + time * 1400) % (vy1 - vy0));
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + 22);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,140,170,0.10)';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  } else if (weather === 'fog') {
    ctx.fillStyle = 'rgba(200,205,215,0.16)';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }
  ctx.restore();
}
