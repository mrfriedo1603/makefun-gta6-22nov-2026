// Solmar Bay — world rendering: ground, roads, buildings, beach, day/night
// and weather. The camera is a top-down view that follows the player.

import { WORLD, ROAD_W, BEACH_Y, WATER_Y } from './city.js';
import { drawCar } from './vehicles.js';
import { drawPed } from './peds.js';
import { drawRig } from './rig.js';
import { missionTarget } from './missions.js';

// Sky tint for a time of day (0..24). Returns overlay colour + alpha.
export function daylight(timeOfDay) {
  const t = timeOfDay % 24;
  if (t >= 6 && t < 8) return { color: '#ffb36a', alpha: 0.16, sun: 0.4 };   // dawn
  if (t >= 8 && t < 17) return { color: '#ffffff', alpha: 0, sun: 1 };       // day
  if (t >= 17 && t < 19.5) return { color: '#ff7a3c', alpha: 0.22, sun: 0.5 }; // dusk
  if (t >= 19.5 || t < 5) return { color: '#0a1430', alpha: 0.42, sun: 0 };   // night
  return { color: '#8a9ac8', alpha: 0.18, sun: 0.25 };                        // early morning
}

export function drawWorld(ctx, state, cam, t) {
  const { city, player } = state;
  const day = daylight(state.timeOfDay);
  const viewW = cam.w;
  const viewH = cam.h;
  const x0 = cam.x - viewW / 2;
  const y0 = cam.y - viewH / 2;

  // The camera is a translation: everything below is drawn in world
  // coordinates, the view window is (x0, y0, viewW, viewH).
  ctx.save();
  ctx.translate(-x0, -y0);

  // Ground: grass.
  ctx.fillStyle = '#8fbf6a';
  ctx.fillRect(x0, y0, viewW, viewH);

  // Beach sand + sea along the south edge.
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(x0, Math.max(y0, BEACH_Y), viewW, Math.max(0, WATER_Y - Math.max(y0, BEACH_Y)));
  const wave = Math.sin(t * 1.4) * 6;
  ctx.fillStyle = '#3a8ab0';
  ctx.fillRect(x0, Math.max(y0, WATER_Y + wave), viewW, Math.max(0, y0 + viewH - (WATER_Y + wave)));
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let wx = 120; wx < WORLD; wx += 260) {
    ctx.fillRect(wx, WATER_Y + wave + 4, 90, 3);
  }

  // Roads.
  ctx.fillStyle = '#464a53';
  for (const rx of city.roadsV) ctx.fillRect(rx - ROAD_W / 2, 100, ROAD_W, 2200);
  for (const ry of city.roadsH) ctx.fillRect(100, ry - ROAD_W / 2, 2400, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = '#b5b5a8';
  for (const rx of city.roadsV) {
    ctx.fillRect(rx - ROAD_W / 2 - 10, 100, 10, 2200);
    ctx.fillRect(rx + ROAD_W / 2, 100, 10, 2200);
  }
  for (const ry of city.roadsH) {
    ctx.fillRect(100, ry - ROAD_W / 2 - 10, 2400, 10);
    ctx.fillRect(100, ry + ROAD_W / 2, 2400, 10);
  }
  // Lane dashes.
  ctx.fillStyle = '#e8d95a';
  for (const rx of city.roadsV) {
    for (let y = 120; y < 2280; y += 56) ctx.fillRect(rx - 2, y, 4, 26);
  }
  for (const ry of city.roadsH) {
    for (let x = 120; x < 2480; x += 56) ctx.fillRect(x, ry - 2, 26, 4);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of city.roadsV) {
    for (const ry of city.roadsH) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(rx + i * 11 - 3, ry - ROAD_W / 2 + 4, 6, 12);
        ctx.fillRect(rx + i * 11 - 3, ry + ROAD_W / 2 - 16, 6, 12);
      }
    }
  }

  // Buildings and park.
  for (const b of city.buildings) {
    if (b.park) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#5a8a4a';
      for (let i = 0; i < 8; i++) {
        const px = b.x + 20 + ((i * 53) % (b.w - 40));
        const py = b.y + 20 + ((i * 37) % (b.h - 40));
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#6ab0d9';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, 34, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows.
    ctx.fillStyle = 'rgba(255,240,190,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13) % 3 === 0) continue;
        ctx.fillRect(b.x + 10 + i * 24, b.y + 10 + j * 24, 10, 8);
      }
    }
  }

  // District labels.
  ctx.fillStyle = 'rgba(20,30,40,0.55)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  for (const d of city.districts) {
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + 34);
  }

  // Mission marker: pulsing beacon + ground ring.
  const target = missionTarget(state);
  if (target) {
    const pulse = 1 + Math.sin(t * 5) * 0.12;
    ctx.fillStyle = 'rgba(245,185,66,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5b942';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    // Beacon column.
    const grad = ctx.createLinearGradient(target.x, target.y - 180, target.x, target.y);
    grad.addColorStop(0, 'rgba(245,185,66,0)');
    grad.addColorStop(1, 'rgba(245,185,66,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 8, target.y - 180, 16, 180);
    ctx.fillStyle = '#f5b942';
    ctx.beginPath();
    ctx.arc(target.x, target.y - 180, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Traffic cars, police cars, peds, cops.
  for (const car of state.traffic) drawCar(ctx, car, t);
  for (const car of state.policeCars) drawCar(ctx, car, t);
  for (const ped of state.peds) drawPed(ctx, ped, t);
  for (const cop of state.cops) drawPed(ctx, cop, t);

  // The player's car (if driving) and the player on foot.
  if (player.inCar && player.car) {
    drawCar(ctx, player.car, t);
  } else {
    const moving = player.moving ? 1 : 0;
    drawRig(ctx, player.rig, player.x, player.y, player.angle + Math.PI / 2, moving, t);
    // Pistol in hand after mission 1.
    if (player.hasPistol) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.fillStyle = '#222';
      ctx.fillRect(8, -2, 10, 4);
      ctx.restore();
    }
  }

  // Bullets and punch effects.
  for (const b of state.bullets) {
    ctx.fillStyle = '#ffe95a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const fx of state.effects) {
    const age = 1 - fx.t / fx.life;
    ctx.strokeStyle = `rgba(255,220,90,${age})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, (1 - age) * 26 + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rain.
  if (state.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,230,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 140; i++) {
      const rx = x0 + ((i * 137 + t * 900) % viewW);
      const ry = y0 + ((i * 211 + t * 1400) % viewH);
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + 22);
    }
    ctx.stroke();
  }

  // Fog.
  if (state.weather === 'fog') {
    ctx.fillStyle = 'rgba(200,205,215,0.20)';
    ctx.fillRect(x0, y0, viewW, viewH);
  }

  // Day / night tint + vignette.
  if (day.alpha > 0) {
    ctx.fillStyle = day.color;
    ctx.globalAlpha = day.alpha;
    ctx.fillRect(x0, y0, viewW, viewH);
    ctx.globalAlpha = 1;
  }
  if (day.sun < 0.4) {
    // Night: a small light circle around the player.
    const grad = ctx.createRadialGradient(player.x, player.y, 60, player.x, player.y, 320);
    grad.addColorStop(0, 'rgba(255,220,140,0.10)');
    grad.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(player.x - 320, player.y - 320, 640, 640);
  }
  ctx.restore();
}
