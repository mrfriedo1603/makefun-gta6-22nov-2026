// Solmar Bay — HUD and minimap. The HUD is drawn on the main canvas;
// the minimap is its own small canvas in the corner.

import { WORLD } from './city.js';
import { missionObjective, missionTarget } from './missions.js';

export function drawHUD(ctx, state, viewW, viewH) {
  const { player } = state;

  // Top-left: cash + wanted stars.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(14, 12, 210, 86);
  ctx.fillStyle = '#7ee787';
  ctx.fillText(`$${state.cash.toLocaleString()}`, 26, 44);
  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffcf3a' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, 30 + i * 34, 72, 11);
  }

  // Top-centre: mission objective + dialogue line.
  const obj = missionObjective(state.mission);
  if (obj) {
    ctx.font = 'bold 17px sans-serif';
    const w = ctx.measureText(obj).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(viewW / 2 - w / 2, 12, w, 34);
    ctx.fillStyle = '#f5b942';
    ctx.textAlign = 'center';
    ctx.fillText(obj, viewW / 2, 35);
  }
  if (state.banner) {
    ctx.font = 'bold 20px sans-serif';
    const w = ctx.measureText(state.banner).width + 30;
    ctx.fillStyle = 'rgba(20,20,30,0.72)';
    ctx.fillRect(viewW / 2 - w / 2, 54, w, 36);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner, viewW / 2, 79);
  }

  // Bottom-left: controls hint.
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive · E car · Space punch · Click shoot · Shift run · P pause · M mute', 16, viewH - 14);

  // Bottom-right: speed when driving.
  if (player.inCar && player.car) {
    const mph = Math.round(Math.abs(player.car.speed) * 0.22);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(viewW - 150, viewH - 58, 136, 44);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(`${mph} mph`, viewW - 26, viewH - 26);
  }

  // Time of day + weather, top-right (above the minimap).
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  const hh = Math.floor(state.timeOfDay) % 24;
  const mm = Math.floor((state.timeOfDay % 1) * 60);
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const weatherName = state.weather === 'rain' ? 'Rain' : state.weather === 'fog' ? 'Fog' : 'Sunny';
  ctx.fillText(`${clock} · ${weatherName}`, viewW - 16, 30);
  ctx.restore();
}

function drawStar(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Live minimap: roads, water, player, cars, cops, mission marker.
export function drawMinimap(mctx, state, size) {
  const scale = size / WORLD;
  mctx.clearRect(0, 0, size, size);
  mctx.fillStyle = '#2c4a26';
  mctx.fillRect(0, 0, size, size);
  // Water.
  mctx.fillStyle = '#2a6a8a';
  mctx.fillRect(0, 2480 * scale, size, size - 2480 * scale);
  // Roads.
  mctx.strokeStyle = '#8a8a82';
  mctx.lineWidth = 3;
  for (const rx of state.city.roadsV) {
    mctx.beginPath();
    mctx.moveTo(rx * scale, 100 * scale);
    mctx.lineTo(rx * scale, 2280 * scale);
    mctx.stroke();
  }
  for (const ry of state.city.roadsH) {
    mctx.beginPath();
    mctx.moveTo(100 * scale, ry * scale);
    mctx.lineTo(2500 * scale, ry * scale);
    mctx.stroke();
  }
  // Mission marker.
  const target = missionTarget(state);
  if (target) {
    mctx.fillStyle = '#f5b942';
    mctx.beginPath();
    mctx.arc(target.x * scale, target.y * scale, 5, 0, Math.PI * 2);
    mctx.fill();
  }
  // Police.
  mctx.fillStyle = '#4a8aff';
  for (const cop of state.cops) {
    mctx.beginPath();
    mctx.arc(cop.x * scale, cop.y * scale, 3, 0, Math.PI * 2);
    mctx.fill();
  }
  for (const car of state.policeCars) {
    mctx.fillStyle = '#4a8aff';
    mctx.beginPath();
    mctx.arc(car.x * scale, car.y * scale, 3.5, 0, Math.PI * 2);
    mctx.fill();
  }
  // Player.
  const p = state.player;
  mctx.fillStyle = '#fff';
  mctx.beginPath();
  mctx.arc(p.x * scale, p.y * scale, 4, 0, Math.PI * 2);
  mctx.fill();
  mctx.strokeStyle = '#ff4a4a';
  mctx.lineWidth = 2;
  mctx.beginPath();
  mctx.arc(p.x * scale, p.y * scale, 6, 0, Math.PI * 2);
  mctx.stroke();
  // Border.
  mctx.strokeStyle = 'rgba(255,255,255,0.5)';
  mctx.lineWidth = 2;
  mctx.strokeRect(1, 1, size - 2, size - 2);
}
