// The wanted system and the police. Crimes raise the star count (0-5); the
// police force keeps a number of patrol cars in play that grows with the
// stars, chases the player, rams and boxes them in, and fills a bust meter
// when a patrol car stays close to a slow or on-foot player. Staying out of
// sight makes the stars decay one by one.

import { WANTED } from './config.js';
import { makeVehicle, driveStep } from './vehicles.js';
import { AVENUES_X, AVENUES_Y } from './city.js';

export function policeCountForStars(stars) {
  return [0, 2, 3, 4, 6, 8][Math.max(0, Math.min(5, stars))];
}

export function createPoliceState() {
  return {
    stars: 0,
    heat: 0,            // fractional progress toward the next star
    unseenTimer: 0,     // seconds since any police unit saw the player
    bust: 0,            // 0..1 bust meter
    seen: false,
  };
}

export function addHeat(game, amount, witnessed) {
  const police = game.police;
  if (witnessed === false && police.stars === 0 && amount < 1) {
    // Unwitnessed minor crime with no heat yet: nothing happens.
    if (game.random() < 0.6) return;
  }
  police.heat += amount;
  while (police.heat >= 1 && police.stars < WANTED.max) {
    police.heat -= 1;
    police.stars += 1;
    game.toast(`Wanted level ${police.stars}`);
  }
  if (police.stars >= WANTED.max) police.heat = Math.min(police.heat, 0.99);
}

export function setStars(game, stars) {
  game.police.stars = Math.max(0, Math.min(WANTED.max, stars));
  game.police.heat = 0;
}

export function clearWanted(game) {
  game.police.stars = 0;
  game.police.heat = 0;
  game.police.bust = 0;
  game.police.unseenTimer = 0;
}

/** Any pedestrian or police unit close enough with a clear view counts as a witness. */
export function isWitnessed(game, x, y, radius) {
  for (const ped of game.pedestrians) {
    if (ped.dead) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  for (const car of game.vehicles) {
    if (car.driver !== 'police' || car.dead) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    if (dx * dx + dy * dy < (radius + 120) * (radius + 120)) return true;
  }
  return false;
}

function spawnPoliceCar(game) {
  // Spawn on a road a few blocks from the player, out of immediate view.
  const p = game.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const vertical = game.random() < 0.5;
    let x; let y; let angle;
    if (vertical) {
      x = AVENUES_X[Math.floor(game.random() * AVENUES_X.length)];
      y = p.y + (game.random() < 0.5 ? -1 : 1) * (420 + game.random() * 260);
      angle = y < p.y ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = AVENUES_Y[Math.floor(game.random() * AVENUES_Y.length)];
      x = p.x + (game.random() < 0.5 ? -1 : 1) * (420 + game.random() * 260);
      angle = x < p.x ? 0 : Math.PI;
    }
    x = Math.max(70, Math.min(2530, x));
    y = Math.max(70, Math.min(1700, y));
    const car = makeVehicle('police', x, y, angle, '#e8ecf2');
    car.driver = 'police';
    car.ai = { mode: 'chase' };
    game.vehicles.push(car);
    return;
  }
}

function despawnDistantPolice(game) {
  const p = game.player;
  for (let i = game.vehicles.length - 1; i >= 0; i -= 1) {
    const car = game.vehicles[i];
    if (car.driver !== 'police' || car.dead) continue;
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    if (dx * dx + dy * dy > 1500 * 1500) game.vehicles.splice(i, 1);
  }
}

function policeInput(game, car) {
  const target = game.player.vehicle || game.player;
  const tx = target.x + Math.cos(target.angle || 0) * (target.speed || 0) * 0.35;
  const ty = target.y + Math.sin(target.angle || 0) * (target.speed || 0) * 0.35;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  let steer = Math.max(-1, Math.min(1, diff * 2.4));
  let throttle = 1;
  if (Math.abs(diff) > 2.4) throttle = -0.8; // facing away: reverse out
  else if (Math.abs(diff) > 1.2) throttle = 0.35;
  if (dist < 60) throttle = 0.25;            // sit on the player to fill the bust meter
  // One in three units aims for a blocking spot ahead of the player instead.
  if (car.id % 3 === 0 && game.player.vehicle) {
    const bx = game.player.x + Math.cos(game.player.vehicle.angle) * 190;
    const by = game.player.y + Math.sin(game.player.vehicle.angle) * 190;
    const bWant = Math.atan2(by - car.y, bx - car.x);
    let bDiff = bWant - car.angle;
    while (bDiff > Math.PI) bDiff -= Math.PI * 2;
    while (bDiff < -Math.PI) bDiff += Math.PI * 2;
    if (Math.hypot(bx - car.x, by - car.y) > 70) steer = Math.max(-1, Math.min(1, bDiff * 2.4));
  }
  return { throttle, steer };
}

export function updatePolice(game, dt) {
  const police = game.police;
  const want = policeCountForStars(police.stars);
  let active = 0;
  for (const car of game.vehicles) if (car.driver === 'police' && !car.dead) active += 1;
  game.policeSpawnTimer -= dt;
  if (active < want && game.policeSpawnTimer <= 0) {
    spawnPoliceCar(game);
    game.policeSpawnTimer = 1.6;
  }
  if (police.stars === 0) despawnDistantPolice(game);

  // Vision: a live police car within 330 units sees the player.
  let seen = false;
  let busting = false;
  const p = game.player;
  const playerSpeed = p.vehicle ? Math.abs(p.vehicle.speed) : Math.hypot(p.vx || 0, p.vy || 0);
  for (const car of game.vehicles) {
    if (car.driver !== 'police') continue;
    if (car.dead) continue;
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 330 * 330) seen = true;
    if (d2 < WANTED.bustRadius * WANTED.bustRadius && playerSpeed < 55) busting = true;
    driveStep(game, car, dt, policeInput(game, car));
  }
  police.seen = seen;
  if (seen) police.unseenTimer = 0;
  else if (police.stars > 0) {
    police.unseenTimer += dt;
    if (police.unseenTimer >= WANTED.decaySeconds) {
      police.unseenTimer = 0;
      police.stars -= 1;
      if (police.stars === 0) {
        clearWanted(game);
        game.toast('You lost the police');
        game.onWantedCleared();
      } else {
        game.toast(`Heat cooling: ${police.stars} star${police.stars > 1 ? 's' : ''}`);
      }
    }
  }
  if (busting) {
    police.bust = Math.min(1, police.bust + dt * WANTED.bustFill);
    if (police.bust >= 1) game.onBusted();
  } else {
    police.bust = Math.max(0, police.bust - dt * WANTED.bustDrain);
  }
}
