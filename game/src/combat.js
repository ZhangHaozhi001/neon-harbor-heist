// Pistol combat on foot: mouse aim, click or Space to fire, R to reload.
// Shots are hitscan with a short tracer line; they can wound pedestrians,
// drop police officers, and damage vehicles until they smoke, burn and die.
// Gunfire panics everyone nearby and, when witnessed, raises the wanted level.

import { GUN } from './config.js';
import { pointInVehicle, damageVehicle } from './vehicles.js';
import { knockDownPedestrian, scarePedestrians } from './pedestrians.js';
import { addHeat, isWitnessed } from './police.js';

export function createCombatState() {
  return {
    mag: GUN.magazine,
    reserve: GUN.reserveStart,
    cooldown: 0,
    reloadTimer: 0,
    tracer: null,      // {x1,y1,x2,y2,life}
    muzzleAngle: 0,
  };
}

export function startReload(game) {
  const c = game.combat;
  if (c.reloadTimer > 0 || c.mag >= GUN.magazine || c.reserve <= 0) return;
  c.reloadTimer = GUN.reloadSeconds;
  game.audio.reload();
}

function findHit(game, angle) {
  const p = game.player;
  const step = 8;
  let x = p.x;
  let y = p.y;
  for (let d = step; d <= GUN.range; d += step) {
    x = p.x + Math.cos(angle) * d;
    y = p.y + Math.sin(angle) * d;
    if (game.city.circleHitsBuilding(x, y, 3)) return { x, y, kind: 'wall' };
    for (const car of game.vehicles) {
      if (pointInVehicle(x, y, car)) return { x, y, kind: 'vehicle', vehicle: car };
    }
    for (const ped of game.pedestrians) {
      if (ped.dead) continue;
      const dx = ped.x - x;
      const dy = ped.y - y;
      if (dx * dx + dy * dy < 13 * 13) return { x, y, kind: 'ped', ped };
    }
    // A police driver is hit through their car only when the shot lands on the cabin.
    for (const car of game.vehicles) {
      if (car.driver !== 'police' || car.dead) continue;
      const dx = car.x - x;
      const dy = car.y - y;
      if (dx * dx + dy * dy < 15 * 15) return { x, y, kind: 'officer', vehicle: car };
    }
  }
  return { x, y, kind: 'none' };
}

export function tryFire(game, angle) {
  const c = game.combat;
  if (c.cooldown > 0 || c.reloadTimer > 0 || game.player.vehicle) return;
  if (c.mag <= 0) {
    game.audio.dryFire();
    c.cooldown = 0.3;
    startReload(game);
    return;
  }
  c.mag -= 1;
  c.cooldown = GUN.fireCooldown;
  c.muzzleAngle = angle;
  game.audio.shot();
  game.effects.muzzle(game.player.x, game.player.y, angle);
  game.effects.addShake(1.2);
  scarePedestrians(game, game.player.x, game.player.y, 300);
  const hit = findHit(game, angle);
  c.tracer = { x1: game.player.x, y1: game.player.y, x2: hit.x, y2: hit.y, life: 0.06 };
  if (hit.kind === 'vehicle' || hit.kind === 'officer') {
    damageVehicle(game, hit.vehicle, GUN.damage, hit.x, hit.y);
    game.effects.sparks(hit.x, hit.y, 4);
    if (hit.kind === 'officer') {
      addHeat(game, 1, true);
      if (hit.vehicle.health <= 30) {
        // The officer bails out and goes down.
        hit.vehicle.driver = null;
        hit.vehicle.parked = true;
        game.toast('Officer down');
      }
    }
  } else if (hit.kind === 'ped') {
    knockDownPedestrian(game, hit.ped, true);
  } else if (hit.kind === 'wall') {
    game.effects.sparks(hit.x, hit.y, 3);
  }
  // Gunfire in earshot of a witness is a crime even if nothing was hit.
  if (isWitnessed(game, game.player.x, game.player.y, 260)) addHeat(game, 0.5, true);
  game.onShotFired();
}

export function updateCombat(game, dt) {
  const c = game.combat;
  if (c.cooldown > 0) c.cooldown -= dt;
  if (c.tracer) {
    c.tracer.life -= dt;
    if (c.tracer.life <= 0) c.tracer = null;
  }
  if (c.reloadTimer > 0) {
    c.reloadTimer -= dt;
    if (c.reloadTimer <= 0) {
      const need = GUN.magazine - c.mag;
      const take = Math.min(need, c.reserve);
      c.mag += take;
      c.reserve -= take;
    }
  }
}
