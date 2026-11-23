// Solmar Bay — cars: definitions, driving physics and traffic AI.

export const CAR_TYPES = {
  sedan: { name: 'Sedan', color: '#b03a3a', w: 44, l: 78, accel: 340, top: 330, grip: 2.6, price: 0 },
  coupe: { name: 'Coupe', color: '#3a7ab0', w: 42, l: 74, accel: 420, top: 390, grip: 2.2, price: 0 },
  taxi: { name: 'Taxi', color: '#e8b820', w: 44, l: 78, accel: 350, top: 340, grip: 2.6, price: 0 },
  truck: { name: 'Truck', color: '#7a8a7a', w: 48, l: 96, accel: 250, top: 260, grip: 3.2, price: 0 },
  van: { name: 'Van', color: '#8a6ab0', w: 48, l: 88, accel: 280, top: 290, grip: 3.0, price: 0 },
  police: { name: 'Patrol Car', color: '#1e2a3a', w: 46, l: 82, accel: 430, top: 400, grip: 2.4, price: 0 },
  sport: { name: 'Sport', color: '#d94a8a', w: 42, l: 72, accel: 480, top: 430, grip: 2.0, price: 0 },
};

let nextCarId = 1;

export function makeCar(type, x, y, angle) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    id: nextCarId++,
    type,
    def,
    x, y, angle,
    speed: 0,
    steer: 0,
    color: def.color,
    // Traffic state.
    traffic: false,
    target: null,      // next intersection {x, y}
    prev: null,        // previous intersection (to avoid U-turns)
    wait: 0,
    police: false,     // patrol-car chase mode
    siren: 0,
  };
}

// Arcade driving physics: forward speed, steering scales with speed,
// handbrake cuts grip for a drift.
export function updateDrive(car, input, dt) {
  const def = car.def;
  const forward = input.up ? 1 : input.down ? -0.55 : 0;
  if (forward !== 0) {
    car.speed += forward * def.accel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
  }
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  const maxReverse = -140;
  if (car.speed > def.top) car.speed = def.top;
  if (car.speed < maxReverse) car.speed = maxReverse;

  const steerTarget = input.left ? -1 : input.right ? 1 : 0;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 10);
  const grip = input.handbrake ? def.grip * 0.45 : def.grip;
  const turnRate = car.steer * grip * Math.min(1, Math.abs(car.speed) / 140);
  car.angle += turnRate * dt * Math.sign(car.speed || 1);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return car;
}

// Traffic: drive along the road graph, right-hand lane, toward a target
// intersection; on arrival pick a neighbour (not the one we came from).
// Cars drive axis-aligned (one road at a time) so they stay on the roads,
// with a per-car lane offset to the right of their direction of travel.
export function updateTraffic(car, city, dt) {
  if (car.lane === undefined) car.lane = (Math.random() < 0.5 ? -1 : 1) * 16;
  if (!car.target) {
    const near = nearestIntersection(city, car.x, car.y);
    car.target = near;
    car.prev = null;
  }
  const t = car.target;
  const dx = t.x - car.x;
  const dy = t.y - car.y;
  const dist = Math.hypot(dx, dy);
  // Axis-aligned travel: take the longer axis first, with a lane offset.
  let desired;
  if (Math.abs(dx) > 24) desired = dx > 0 ? 0 : Math.PI;
  else desired = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
  // Off the road (pushed by a collision): steer back to the nearest road.
  if (!onRoadPoint(city, car.x, car.y)) {
    desired = Math.atan2(dy, dx);
  }
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff * 4 * dt));
  const targetSpeed = dist < 60 ? 70 : 130;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.6);
  // Lane offset: slide sideways toward the right-hand side of the road.
  const px = -Math.sin(car.angle) * car.lane;
  const py = Math.cos(car.angle) * car.lane;
  car.x += (Math.cos(car.angle) * car.speed * dt) + px * dt * 2;
  car.y += (Math.sin(car.angle) * car.speed * dt) + py * dt * 2;
  if (dist < 26) {
    car.prev = { x: t.x, y: t.y };
    const options = neighbours(city, t.x, t.y).filter(
      (n) => !(car.prev && n.x === car.prev.x && n.y === car.prev.y),
    );
    const pool = options.length ? options : neighbours(city, t.x, t.y);
    car.target = pool[Math.floor(Math.random() * pool.length)];
  }
  return car;
}

function onRoadPoint(city, x, y) {
  for (const rx of city.roadsV) {
    if (Math.abs(x - rx) < 34 && y > 100 && y < 2300) return true;
  }
  for (const ry of city.roadsH) {
    if (Math.abs(y - ry) < 34 && x > 100 && x < 2500) return true;
  }
  return false;
}

function nearestIntersection(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsV) {
    for (const ry of city.roadsH) {
      const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
      if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
    }
  }
  return best;
}

function neighbours(city, ix, iy) {
  const out = [];
  for (const rx of city.roadsV) {
    if (Math.abs(rx - ix) === 300 && iy <= 2200) out.push({ x: rx, y: iy });
  }
  for (const ry of city.roadsH) {
    if (Math.abs(ry - iy) === 300 && ix <= 2400) out.push({ x: ix, y: ry });
  }
  return out;
}

// Draw a car top-down: shadow, body, cabin, windshield, headlights.
export function drawCar(ctx, car, t) {
  const { w, l } = car.def;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.roundRect(-l / 2 + 2, -w / 2 + 3, l, w, 10);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-l / 2, -w / 2, l, w, 10);
  ctx.fill();
  // Cabin.
  ctx.fillStyle = 'rgba(20,26,34,0.92)';
  ctx.beginPath();
  ctx.roundRect(-l * 0.18, -w / 2 + 7, l * 0.34, w - 14, 7);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(140,190,220,0.85)';
  ctx.beginPath();
  ctx.roundRect(l * 0.16, -w / 2 + 8, 7, w - 16, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-l * 0.24, -w / 2 + 8, 6, w - 16, 3);
  ctx.fill();
  // Taxi sign / police light bar.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.roundRect(-6, -w / 2 + 2, 12, 7, 2);
    ctx.fill();
    ctx.fillStyle = '#ffe95a';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -w / 2 + 8);
  }
  if (car.type === 'police') {
    const blink = Math.sin(t * 14 + car.id) > 0;
    ctx.fillStyle = blink ? '#ff2a2a' : '#2a6aff';
    ctx.beginPath();
    ctx.roundRect(-4, -w / 2 + 3, 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2a6aff' : '#ff2a2a';
    ctx.beginPath();
    ctx.roundRect(-4, w / 2 - 9, 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(l / 2 - 2, -w / 2 + 8, 3, 0, Math.PI * 2);
  ctx.arc(l / 2 - 2, w / 2 - 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
