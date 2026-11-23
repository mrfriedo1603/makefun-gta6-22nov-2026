// Solmar Bay — procedural character rigs.
// A rig is a small bone chain: hips -> torso -> head, with two arms and two
// legs hanging off the torso. The walk cycle swings the limbs on a sine
// phase, so every pedestrian, cop and the player walks with the same rig
// format but their own colours, height and stride.

export function makeRig(opts) {
  return {
    shirt: opts.shirt || '#c84a3a',
    pants: opts.pants || '#2e3a4a',
    skin: opts.skin || '#e8b48a',
    hair: opts.hair || '#2a2018',
    height: opts.height || 1,
    stride: opts.stride || 1,
    phase: Math.random() * Math.PI * 2,
  };
}

export const RIG_PALETTES = {
  danny: { shirt: '#c84a3a', pants: '#2e3a4a', skin: '#e8b48a', hair: '#1c1410', height: 1.05 },
  mara: { shirt: '#7a4a8a', pants: '#1e1e26', skin: '#d9a06f', hair: '#3a1a1a', height: 1.0 },
  cop: { shirt: '#2a4a7a', pants: '#1e2a3a', skin: '#c99a6a', hair: '#101010', height: 1.08 },
  ped: [
    { shirt: '#4a7a4a', pants: '#3a3a2a', skin: '#e8b48a', hair: '#4a2a10' },
    { shirt: '#d9a03a', pants: '#4a4a5a', skin: '#b07a4a', hair: '#0a0a0a' },
    { shirt: '#3a7a8a', pants: '#2a2a2a', skin: '#f0c9a0', hair: '#6a4a2a' },
    { shirt: '#a04a6a', pants: '#3a2a4a', skin: '#d9a06f', hair: '#2a2a2a' },
    { shirt: '#5a5a7a', pants: '#4a3a2a', skin: '#c98d5a', hair: '#8a8a8a' },
  ],
};

// Draw a rigged character, top-down with a slight side view so the walk
// cycle reads. (x, y) is the feet position; angle faces the walk direction;
// speed 0..1 drives the swing; t is the animation clock.
export function drawRig(ctx, rig, x, y, angle, speed, t) {
  const s = rig.height;
  const swing = Math.sin(t * 9 + rig.phase) * 0.55 * speed * rig.stride;
  const swing2 = Math.sin(t * 9 + rig.phase + Math.PI) * 0.55 * speed * rig.stride;
  const bob = Math.abs(Math.sin(t * 9 + rig.phase)) * 2.2 * speed * s;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 11 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const legLen = 9 * s;
  const armLen = 8 * s;

  // Legs (behind the torso): two bones swinging opposite.
  ctx.strokeStyle = rig.pants;
  ctx.lineWidth = 4.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2.5 * s, 0);
  ctx.lineTo(-2.5 * s + swing * 10, legLen);
  ctx.moveTo(2.5 * s, 0);
  ctx.lineTo(2.5 * s + swing2 * 10, legLen);
  ctx.stroke();

  // Feet.
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(-2.5 * s + swing * 10, legLen, 2.6 * s, 0, Math.PI * 2);
  ctx.arc(2.5 * s + swing2 * 10, legLen, 2.6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Torso.
  ctx.fillStyle = rig.shirt;
  ctx.beginPath();
  ctx.ellipse(0, -6 * s - bob, 8.5 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms: swing opposite to the legs.
  ctx.strokeStyle = rig.shirt;
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(-7 * s, -12 * s - bob);
  ctx.lineTo(-9 * s + swing2 * 8, -4 * s - bob);
  ctx.moveTo(7 * s, -12 * s - bob);
  ctx.lineTo(9 * s + swing * 8, -4 * s - bob);
  ctx.stroke();

  // Hands.
  ctx.fillStyle = rig.skin;
  ctx.beginPath();
  ctx.arc(-9 * s + swing2 * 8, -4 * s - bob, 2.4 * s, 0, Math.PI * 2);
  ctx.arc(9 * s + swing * 8, -4 * s - bob, 2.4 * s, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = rig.skin;
  ctx.beginPath();
  ctx.arc(0, -20 * s - bob, 6.5 * s, 0, Math.PI * 2);
  ctx.fill();
  // Hair cap.
  ctx.fillStyle = rig.hair;
  ctx.beginPath();
  ctx.arc(0, -21.5 * s - bob, 6.3 * s, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Draw a simple top-down car shadow + body is done in vehicles.js; this
// helper draws a lying-down body (for a knocked-out ped).
export function drawDowned(ctx, rig, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rig.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rig.skin;
  ctx.beginPath();
  ctx.arc(11, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
