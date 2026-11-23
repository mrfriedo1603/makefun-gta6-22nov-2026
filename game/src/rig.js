// rig.js — procedural character rigs. Every person in Solmar Bay is built
// from the same small skeleton: a spine and two leg and two arm bone chains
// whose joint angles come from a walk-cycle function, so walk, run, punch
// and aim are all poses of one rig, not sprite frames. The reference
// package's idea (named skeleton rigs with walk phases) is rebuilt here in
// this game's own format; no rig data is imported from anywhere.

const SKINS = ['#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6e4426'];
const SHIRTS = ['#d94f3d', '#3d7dd9', '#e8c33d', '#4fae5c', '#8a5fbf', '#e8e8e8', '#2b2b2b', '#e87fa8'];
const PANTS = ['#2b3a55', '#3d3d3d', '#5a3b2b', '#7a8a99'];
const HAIRS = ['#1a1a1a', '#4a2f1d', '#b8b8b8', '#d9a03d', '#7a2f1d'];

export function makeRig(rng) {
  return {
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    pants: PANTS[Math.floor(rng() * PANTS.length)],
    hair: HAIRS[Math.floor(rng() * HAIRS.length)],
    phase: rng() * Math.PI * 2,
    tall: 0.92 + rng() * 0.2,
  };
}

export function makeHeroRig() {
  return { skin: '#c98d5f', shirt: '#d94f3d', pants: '#2b3a55', hair: '#1a1a1a', phase: 0, tall: 1.05 };
}

export function makeCopRig() {
  return { skin: '#e8b88a', shirt: '#1d3f8a', pants: '#16233d', hair: '#1a1a1a', phase: 0, tall: 1.05, cop: true };
}

// Walk-cycle joint angles for one leg chain at phase p (0..2π).
function legSwing(p, amp) {
  return { hip: Math.sin(p) * amp, knee: Math.max(0, Math.sin(p + 0.6)) * amp * 1.1 };
}

function drawLimb(ctx, x, y, angle, len1, len2, a1, a2, width, color) {
  const x1 = x + Math.cos(angle + a1) * len1;
  const y1 = y + Math.sin(angle + a1) * len1;
  const x2 = x1 + Math.cos(angle + a1 + a2) * len2;
  const y2 = y1 + Math.sin(angle + a1 + a2) * len2;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  return { x: x2, y: y2 };
}

// Draw a rigged person at (x, y) facing `angle` (radians, 0 = east).
// `move` is 0..1 (how hard they are moving), `pose` is 'walk' | 'punch' |
// 'aim' | 'idle'. All drawing is in world units; the camera scales it.
export function drawRig(ctx, rig, x, y, angle, move, pose) {
  const s = 15 * rig.tall; // shoulder height in world units
  const bob = pose === 'walk' ? Math.abs(Math.sin(rig.phase)) * 2.2 * move : 0;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.72, s * 0.62, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  const hx = x, hy = y - bob; // hip
  const sx = x, sy = y - s - bob; // shoulder
  const amp = 0.55 * Math.min(1, move + 0.25);
  const legL = legSwing(rig.phase, amp);
  const legR = legSwing(rig.phase + Math.PI, amp);
  const armL = legSwing(rig.phase + Math.PI, amp * 0.7);
  const armR = legSwing(rig.phase, amp * 0.7);

  // Legs (behind torso).
  drawLimb(ctx, hx, hy, Math.PI / 2, s * 0.42, s * 0.42, -legL.hip, legL.knee, 5, rig.pants);
  drawLimb(ctx, hx, hy, Math.PI / 2, s * 0.42, s * 0.42, -legR.hip, legR.knee, 5, rig.pants);
  // Torso.
  ctx.strokeStyle = rig.shirt;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy + 2);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  if (rig.cop) {
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(sx - 5, sy + 2, 10, 3);
  }
  // Arms.
  if (pose === 'punch') {
    drawLimb(ctx, sx, sy, angle, s * 0.34, s * 0.34, 0, 0, 4.5, rig.skin);
    drawLimb(ctx, sx, sy, angle + 0.5, s * 0.3, s * 0.3, 0, 0.4, 4.5, rig.skin);
  } else if (pose === 'aim') {
    drawLimb(ctx, sx, sy, angle, s * 0.34, s * 0.34, 0, 0, 4.5, rig.skin);
    drawLimb(ctx, sx, sy, angle, s * 0.34, s * 0.34, 0, 0, 4.5, rig.shirt);
  } else {
    drawLimb(ctx, sx, sy, Math.PI / 2, s * 0.34, s * 0.34, -armL.hip * 0.8, armL.knee * 0.5, 4.5, rig.skin);
    drawLimb(ctx, sx, sy, Math.PI / 2, s * 0.34, s * 0.34, -armR.hip * 0.8, armR.knee * 0.5, 4.5, rig.skin);
  }
  // Head + hair.
  ctx.fillStyle = rig.skin;
  ctx.beginPath();
  ctx.arc(sx, sy - s * 0.34, s * 0.30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rig.hair;
  ctx.beginPath();
  ctx.arc(sx, sy - s * 0.40, s * 0.30, Math.PI, Math.PI * 2);
  ctx.fill();
  if (rig.cop) {
    ctx.fillStyle = '#16233d';
    ctx.fillRect(sx - s * 0.30, sy - s * 0.52, s * 0.60, s * 0.14);
  }
}
