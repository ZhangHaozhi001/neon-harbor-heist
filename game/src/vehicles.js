// Vehicles: definitions come from config.js. This module owns the car objects,
// the driving physics the player uses, the traffic AI that follows the avenue
// grid, parked cars, and car-to-car / car-to-building collision response with
// damage, smoke and fire handled through the effects module.

import { VEHICLE_TYPES, TRAFFIC_COUNT, PARKED_COUNT } from './config.js';
import { AVENUES_X, AVENUES_Y, BEACH_Y, ROAD_HALF, isOnRoad } from './city.js';
import { randPick, randRange } from './random.js';

let nextId = 1;

export function makeVehicle(type, x, y, angle, color) {
  const def = VEHICLE_TYPES[type];
  return {
    id: nextId++,
    type,
    def,
    x, y, angle,
    speed: 0,
    width: def.width,
    length: def.length,
    color: color || def.color,
    health: def.health,
    dead: false,
    burning: 0,
    driver: null,       // 'traffic' | 'police' | 'player' | null
    parked: false,
    ai: null,
    smokeTimer: 0,
    skidTimer: 0,
    wasStolen: false,
  };
}

function laneOffset(angle) {
  // Right-hand traffic: offset to the right of the direction of travel.
  return { x: Math.cos(angle + Math.PI / 2) * 24, y: Math.sin(angle + Math.PI / 2) * 24 };
}

export function vehicleCorners(v) {
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  const hl = v.length / 2;
  const hw = v.width / 2;
  return [
    { x: v.x + c * hl - s * hw, y: v.y + s * hl + c * hw },
    { x: v.x + c * hl + s * hw, y: v.y + s * hl - c * hw },
    { x: v.x - c * hl + s * hw, y: v.y - s * hl - c * hw },
    { x: v.x - c * hl - s * hw, y: v.y - s * hl + c * hw },
  ];
}

export function pointInVehicle(x, y, v) {
  const dx = x - v.x;
  const dy = y - v.y;
  const c = Math.cos(-v.angle);
  const s = Math.sin(-v.angle);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) <= v.length / 2 && Math.abs(ly) <= v.width / 2;
}

export function vehiclesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = (a.length + b.length) / 2.6;
  return dx * dx + dy * dy < rr * rr;
}

// --- Spawning ---------------------------------------------------------------

function randomRoadSpawn(random) {
  const vertical = random() < 0.5;
  if (vertical) {
    const ax = randPick(random, AVENUES_X);
    const dir = random() < 0.5 ? 1 : -1;
    const angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const off = laneOffset(angle);
    return { x: ax + off.x, y: randRange(random, 120, BEACH_Y - 120), angle };
  }
  const ay = randPick(random, AVENUES_Y);
  const dir = random() < 0.5 ? 1 : -1;
  const angle = dir > 0 ? 0 : Math.PI;
  const off = laneOffset(angle);
  return { x: randRange(random, 120, 2400), y: ay + off.y, angle };
}

export function spawnTraffic(game) {
  const types = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'comet'];
  const colors = ['#5b8dd9', '#c9574f', '#57a773', '#c7cbd1', '#7a6fc9', '#d97f4f', '#4fa8a0', '#b8b04a'];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const spot = randomRoadSpawn(game.random);
    const type = randPick(game.random, types);
    const car = makeVehicle(type, spot.x, spot.y, spot.angle, randPick(game.random, colors));
    car.driver = 'traffic';
    car.ai = { cruise: randRange(game.random, 0.45, 0.75), turnCooldown: 0 };
    game.vehicles.push(car);
  }
  // Parked cars along avenue edges.
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const vertical = game.random() < 0.5;
    let x; let y; let angle;
    if (vertical) {
      const ax = randPick(game.random, AVENUES_X);
      angle = game.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      x = ax + (game.random() < 0.5 ? ROAD_HALF - 16 : -ROAD_HALF + 16);
      y = randRange(game.random, 140, BEACH_Y - 140);
    } else {
      const ay = randPick(game.random, AVENUES_Y);
      angle = game.random() < 0.5 ? 0 : Math.PI;
      y = ay + (game.random() < 0.5 ? ROAD_HALF - 16 : -ROAD_HALF + 16);
      x = randRange(game.random, 140, 2400);
    }
    if (game.city.circleHitsBuilding(x, y, 30)) continue;
    const type = randPick(game.random, ['sedan', 'van', 'taxi', 'comet', 'sedan']);
    const car = makeVehicle(type, x, y, angle, randPick(game.random, colors));
    car.parked = true;
    game.vehicles.push(car);
  }
}

// --- Physics ------------------------------------------------------------------

function damageVehicle(game, v, amount, x, y) {
  if (v.dead) return;
  v.health -= amount;
  if (x !== undefined) game.effects.sparks(x, y, 6);
  if (v.health <= 0) {
    v.dead = true;
    v.burning = 2.2;
    if (v.driver === 'player') game.onPlayerVehicleDestroyed(v);
  }
}

/**
 * Shared driving step used by the player and (with synthetic input) the AI.
 * input: {throttle -1..1, steer -1..1}. Returns the impact speed if the car
 * hit something hard this step, else 0.
 */
export function driveStep(game, v, dt, input) {
  const def = v.def;
  if (v.dead) {
    v.speed *= Math.max(0, 1 - dt * 2);
    return 0;
  }
  const target = input.throttle > 0 ? def.topSpeed : input.throttle < 0 ? -def.topSpeed * 0.42 : 0;
  const rate = input.throttle !== 0 ? def.accel : def.accel * 1.4;
  if (v.speed < target) v.speed = Math.min(target, v.speed + rate * dt);
  else v.speed = Math.max(target, v.speed - rate * dt);
  // Rolling drag.
  if (input.throttle === 0) v.speed *= Math.max(0, 1 - dt * 0.7);

  // Handbrake (player only — AI drivers never set it): scrubs speed and
  // nearly doubles steering authority, so a fast car can be swung around a
  // corner instead of sailing past it. Costs momentum, lays skid marks.
  const handbrake = Boolean(input.handbrake) && Math.abs(v.speed) > 50;
  if (handbrake) v.speed *= Math.max(0, 1 - dt * 1.15);

  const speedRatio = v.speed / def.topSpeed;
  if (Math.abs(v.speed) > 12) {
    // Steering bites quickly at town speeds but eases off near top speed, so
    // a fast car tracks straight instead of twitching with every key tap.
    const lowSpeedBite = Math.min(1, Math.abs(v.speed) / 90);
    const highSpeedCalm = 1 - 0.42 * Math.min(1, speedRatio * speedRatio);
    const steerAuthority = lowSpeedBite * highSpeedCalm * (handbrake ? 1.85 : 1);
    v.angle += input.steer * def.grip * steerAuthority * dt * (v.speed >= 0 ? 1 : -1);
  }

  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;

  // Skid marks when cornering hard or braking at speed.
  v.skidTimer -= dt;
  const hardCorner = Math.abs(input.steer) > 0.6 && Math.abs(speedRatio) > 0.55;
  const hardBrake = input.throttle < 0 && v.speed > 140;
  const handbrakeSlide = handbrake && Math.abs(input.steer) > 0.25;
  if ((hardCorner || hardBrake || handbrakeSlide) && v.skidTimer <= 0) {
    v.skidTimer = 0.03;
    const back = { x: v.x - Math.cos(v.angle) * v.length * 0.36, y: v.y - Math.sin(v.angle) * v.length * 0.36 };
    const side = { x: Math.cos(v.angle + Math.PI / 2) * v.width * 0.36, y: Math.sin(v.angle + Math.PI / 2) * v.width * 0.36 };
    game.effects.addSkid(back.x + side.x, back.y + side.y);
    game.effects.addSkid(back.x - side.x, back.y - side.y);
  }

  // Building collision: stop dead, take damage proportional to impact.
  let impact = 0;
  const hit = game.city.circleHitsBuilding(nx, ny, v.width * 0.52);
  if (hit) {
    impact = Math.abs(v.speed);
    if (impact > 60) {
      // Patrol cars chase in straight lines through the block grid and would
      // wreck themselves on walls within seconds at the full rate — their
      // reinforced frames take building hits at a third of the damage.
      damageVehicle(game, v, impact * 0.09 * (v.driver === 'police' ? 0.35 : 1), nx, ny);
      game.effects.addShake(Math.min(9, impact * 0.03));
      game.audio.crash(Math.abs(v.speed) / def.topSpeed);
      game.onVehicleCrash(v, impact, nx, ny);
    }
    v.speed = 0;
  } else {
    v.x = nx;
    v.y = ny;
  }
  const clamped = game.city.collideCircle(v.x, v.y, v.width * 0.5);
  v.x = clamped.x;
  v.y = clamped.y;

  // Car-to-car.
  for (const other of game.vehicles) {
    if (other === v) continue;
    if (!vehiclesOverlap(v, other)) continue;
    const rel = Math.abs(v.speed - other.speed) + Math.abs(v.speed) * 0.4;
    const midX = (v.x + other.x) / 2;
    const midY = (v.y + other.y) / 2;
    if (rel > 55) {
      // Patrol cars take half car-to-car damage (see the building note):
      // at full mutual damage two traffic bumps kill a chasing unit.
      damageVehicle(game, v, rel * 0.06 * (v.driver === 'police' ? 0.5 : 1), midX, midY);
      damageVehicle(game, other, rel * 0.06 * (other.driver === 'police' ? 0.5 : 1), midX, midY);
      game.effects.sparks(midX, midY, 10);
      game.effects.addShake(Math.min(10, rel * 0.035));
      game.audio.crash(rel / 300);
      game.onVehicleCrash(v, rel, midX, midY);
      if (other.driver === 'traffic') game.panicDriver(other);
      impact = Math.max(impact, rel);
    }
    // Push apart.
    const dx = v.x - other.x;
    const dy = v.y - other.y;
    const d = Math.max(12, Math.hypot(dx, dy));
    const push = ((v.length + other.length) / 2.6 - d) / 2 + 1;
    v.x += (dx / d) * push;
    v.y += (dy / d) * push;
    if (!other.parked) {
      other.x -= (dx / d) * push;
      other.y -= (dy / d) * push;
    }
    const transfer = v.speed * 0.35;
    v.speed *= 0.55;
    if (other.driver) other.speed += transfer;
  }

  // Damage smoke and fire.
  v.smokeTimer -= dt;
  if (!v.dead && v.health < v.def.health * 0.45 && v.smokeTimer <= 0) {
    v.smokeTimer = 0.12;
    game.effects.smoke(v.x, v.y, v.health < v.def.health * 0.2);
  }
  if (v.dead && v.burning > 0) {
    v.burning -= dt;
    game.effects.fire(v.x, v.y);
    if (Math.random() < dt * 2) game.effects.smoke(v.x, v.y, true);
  }
  return impact;
}

// --- Traffic AI ---------------------------------------------------------------

function trafficInput(game, car, dt) {
  car.ai.turnCooldown -= dt;
  const aheadX = car.x + Math.cos(car.angle) * 95;
  const aheadY = car.y + Math.sin(car.angle) * 95;
  let throttle = car.ai.cruise;
  // Slow for obstacles ahead.
  for (const other of game.vehicles) {
    if (other === car) continue;
    const dx = other.x - aheadX;
    const dy = other.y - aheadY;
    if (dx * dx + dy * dy < 60 * 60) { throttle = -0.4; break; }
  }
  if (throttle > 0 && game.city.circleHitsBuilding(aheadX, aheadY, 26)) throttle = -0.4;
  for (const ped of game.pedestrians) {
    if (ped.dead) continue;
    const dx = ped.x - aheadX;
    const dy = ped.y - aheadY;
    if (dx * dx + dy * dy < 46 * 46) { throttle = -0.5; break; }
  }
  // At an intersection, sometimes turn onto the crossing avenue.
  if (car.ai.turnCooldown <= 0) {
    const nearX = AVENUES_X.find((ax) => Math.abs(car.x - ax) < 30);
    const nearY = AVENUES_Y.find((ay) => Math.abs(car.y - ay) < 30);
    const horizontal = Math.abs(Math.cos(car.angle)) > 0.7;
    if (horizontal && nearX !== undefined && game.random() < 0.4) {
      car.angle = game.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.ai.turnCooldown = 2.5;
    } else if (!horizontal && nearY !== undefined && game.random() < 0.4) {
      car.angle = game.random() < 0.5 ? 0 : Math.PI;
      car.ai.turnCooldown = 2.5;
    }
  }
  // Keep to the lane: re-centre on the road, and never drive onto the beach.
  if (!isOnRoad(car.x, car.y) || car.y > BEACH_Y - 90) {
    const near = { x: car.x, y: car.y };
    let bestD = Infinity;
    for (const ax of AVENUES_X) { const d = Math.abs(car.x - ax); if (d < bestD) { bestD = d; near.x = ax; near.y = car.y; } }
    for (const ay of AVENUES_Y) { const d = Math.abs(car.y - ay); if (d < bestD) { bestD = d; near.x = car.x; near.y = ay; } }
    const want = Math.atan2(near.y - car.y, near.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return { throttle: 0.5, steer: Math.max(-1, Math.min(1, diff * 2.2)) };
  }
  // Lane keeping is handled by the spawn offsets and the road re-centring
  // above, so cruising traffic simply holds its heading.
  return { throttle, steer: 0 };
}

export function updateTraffic(game, dt) {
  for (const car of game.vehicles) {
    if (car.driver !== 'traffic' || car.dead) continue;
    const input = trafficInput(game, car, dt);
    driveStep(game, car, dt, input);
  }
}

export { damageVehicle };
