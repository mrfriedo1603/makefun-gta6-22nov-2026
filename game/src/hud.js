// hud.js — the heads-up display: cash, health, wanted stars, clock and
// weather, mission objective, dialogue banners, and the minimap. The minimap
// is a live top-down sketch of the city with the player, police, traffic and
// the mission marker.

import { WORLD, BEACH_X } from './city.js';

export function drawHUD(ctx, game, vw, vh) {
  const pl = game.player;
  const pad = 16;
  // Top-left: cash + health.
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(pad - 6, pad - 6, 210, 104);
  ctx.fillStyle = '#7ddc5c';
  ctx.fillText('$' + game.cash.toLocaleString('en-US'), pad + 6, pad + 26);
  ctx.fillStyle = '#222';
  ctx.fillRect(pad + 6, pad + 40, 180, 12);
  ctx.fillStyle = pl.health > 30 ? '#e8e8e8' : '#e83d3d';
  ctx.fillRect(pad + 6, pad + 40, 180 * Math.max(0, pl.health / 100), 12);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText('HEALTH', pad + 6, pad + 68);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(game.mission.done.length + ' / 5 missions', pad + 6, pad + 92);

  // Top-right: wanted stars.
  ctx.textAlign = 'right';
  ctx.font = 'bold 30px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < game.wanted ? '★' : '☆';
  ctx.fillStyle = game.wanted > 0 ? '#ffd23d' : 'rgba(255,255,255,0.35)';
  ctx.fillText(stars, vw - pad, pad + 30);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const hh = Math.floor(game.timeOfDay * 24);
  const mm = Math.floor((game.timeOfDay * 24 - hh) * 60);
  ctx.fillText(
    String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ·  ' + game.weather.toUpperCase(),
    vw - pad, pad + 54,
  );
  ctx.fillText('SOLMAR BAY', vw - pad, pad + 74);

  // Objective banner.
  if (game.mission.active) {
    const text = game.missionText;
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px sans-serif';
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect((vw - w) / 2, 14, w, 34);
    ctx.fillStyle = '#ffd23d';
    ctx.fillText(text, vw / 2, 37);
  }
  // Dialogue / banner line.
  if (game.banner && game.bannerT > 0) {
    ctx.textAlign = 'center';
    ctx.font = '16px sans-serif';
    const w = Math.min(vw - 80, ctx.measureText(game.banner).width + 36);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect((vw - w) / 2, vh - 96, w, 34);
    ctx.fillStyle = '#fff';
    ctx.fillText(game.banner, vw / 2, vh - 73);
  }
  // Speed, bottom-left above the page hint.
  if (pl.car) {
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.abs(Math.round(pl.car.speed * 0.36)) + ' km/h', pad, vh - 52);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ddd';
    ctx.fillText(pl.car.type.toUpperCase(), pad, vh - 30);
  }

  drawMinimap(ctx, game, vw, vh);
}

function drawMinimap(ctx, game, vw, vh) {
  const size = 168;
  const x0 = vw - size - 16, y0 = vh - size - 16;
  const scale = size / WORLD;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x0 - 5, y0 - 5, size + 10, size + 10);
  ctx.fillStyle = '#4a7a3d';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x0 + BEACH_X * scale, y0, size - BEACH_X * scale, size);
  ctx.fillStyle = '#555';
  for (const rx of game.city.roadsV) ctx.fillRect(x0 + rx * scale - 1, y0, 2, size);
  for (const ry of game.city.roadsH) ctx.fillRect(x0, y0 + ry * scale - 1, size, 2);
  // Mission marker.
  if (game.mission.active && game.mission.target) {
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(x0 + game.mission.target.x * scale, y0 + game.mission.target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#2d6bff';
  for (const cop of game.cops) {
    ctx.beginPath();
    ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const pl = game.player;
  ctx.save();
  ctx.translate(x0 + pl.x * scale, y0 + pl.y * scale);
  ctx.rotate(pl.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // North + border.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 5, y0 - 5, size + 10, size + 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x0 + 4, y0 + 13);
}

export function drawTitle(ctx, vw, vh, save, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#c94f6d');
  grad.addColorStop(1, '#2b1d5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  // Sun + skyline silhouette.
  ctx.fillStyle = 'rgba(255,220,120,0.9)';
  ctx.beginPath(); ctx.arc(vw * 0.72, vh * 0.3, 64, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,10,40,0.85)';
  const base = vh * 0.78;
  for (let i = 0; i < 40; i++) {
    const bw = 30 + ((i * 37) % 60);
    const bh = 60 + ((i * 53) % 180);
    ctx.fillRect(i * (vw / 40), base - bh, bw, bh);
  }
  ctx.fillStyle = '#1a0f2e';
  ctx.fillRect(0, base, vw, vh - base);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR BAY', vw / 2, vh * 0.30);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffd23d';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', vw / 2, vh * 0.30 + 38);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Danny Reyes came home broke. Mara Solis has five jobs. Take them all.', vw / 2, vh * 0.30 + 74);
  const blink = Math.floor(time * 1.4) % 2 === 0;
  if (blink) {
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('PRESS ENTER TO PLAY', vw / 2, vh * 0.58);
  }
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('WASD walk / drive · E enter car · Space punch · Click shoot · P pause', vw / 2, vh * 0.66);
  if (save) ctx.fillText('Saved game found — press C to continue ($' + save.cash + ', ' + save.missionsDone.length + '/5 missions)', vw / 2, vh * 0.70);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game. No content from Rockstar Games or Grand Theft Auto.', vw / 2, vh - 24);
}

export function drawOverlay(ctx, vw, vh, title, lines, hint) {
  ctx.fillStyle = 'rgba(8,8,20,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(title, vw / 2, vh * 0.38);
  ctx.fillStyle = '#fff';
  ctx.font = '19px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, vw / 2, vh * 0.38 + 44 + i * 30));
  if (hint) {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(hint, vw / 2, vh * 0.38 + 44 + lines.length * 30 + 26);
  }
}
