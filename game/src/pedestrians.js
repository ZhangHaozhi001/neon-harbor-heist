// Pedestrians: they stroll along sidewalks, panic and run when they hear a
// gunshot or see a crash nearby, and fall when hit by a car or a bullet —
// which the wanted system hears about through game callbacks.

import { PED_COUNT } from './config.js';
import { AVENUES_X, AVENUES_Y, BEACH_Y, ROAD_HALF } from './city.js';
import { randPick, randRange } from './random.js';

const SHIRTS = ['#c9574f', '#5b8dd9', '#57a773', '#e8b93c', '#b06fc9', '#e8e4da', '#4fa8a0', '#d97f4f'];

export function spawnPedestrians(game) {
  for (let i = 0; i < PED_COUNT; i += 1) {
    const vertical = game.random() < 0.5;
    let x; let y; let angle;
    if (vertical) {
      const ax = randPick(game.random, AVENUES_X);
      x = ax + (game.random() < 0.5 ? ROAD_HALF + 12 : -ROAD_HALF - 12);
      y = randRange(game.random, 120, BEACH_Y - 80);
      angle = game.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ay = randPick(game.random, AVENUES_Y);
      y = ay + (game.random() < 0.5 ? ROAD_HALF + 12 : -ROAD_HALF - 12);
      x = randRange(game.random, 120, 2400);
      angle = game.random() < 0.5 ? 0 : Math.PI;
    }
    game.pedestrians.push({
      x, y, angle,
      speed: randRange(game.random, 34, 58),
      shirt: randPick(game.random, SHIRTS),
      state: 'walk',       // walk | flee | down
      panic: 0,
      turnTimer: randRange(game.random, 1, 4),
      legPhase: game.random() * Math.PI * 2,
      dead: false,
    });
  }
}

/** Everyone within earshot of (x, y) runs away from it. */
export function scarePedestrians(game, x, y, radius) {
  for (const ped of game.pedestrians) {
    if (ped.dead) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.state = 'flee';
      ped.panic = randRange(game.random, 2.2, 3.6);
      ped.angle = Math.atan2(dy, dx);
    }
  }
}

export function knockDownPedestrian(game, ped, byPlayer) {
  if (ped.dead) return;
  ped.dead = true;
  ped.state = 'down';
  game.effects.bloodPuff(ped.x, ped.y);
  if (byPlayer) game.onPedestrianHit(ped);
}

export function updatePedestrians(game, dt) {
  for (const ped of game.pedestrians) {
    if (ped.dead) continue;
    ped.legPhase += dt * (ped.state === 'flee' ? 13 : 7);
    if (ped.state === 'flee') {
      ped.panic -= dt;
      if (ped.panic <= 0) ped.state = 'walk';
    } else {
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.turnTimer = randRange(game.random, 1.5, 4.5);
        if (game.random() < 0.35) ped.angle += Math.PI; // turn around
        else if (game.random() < 0.3) ped.angle += (game.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    const speed = ped.state === 'flee' ? 165 : ped.speed;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const clamped = game.city.collideCircle(nx, ny, 9);
    if (Math.abs(clamped.x - nx) > 0.01 || Math.abs(clamped.y - ny) > 0.01) {
      ped.angle += Math.PI * 0.8; // bumped into a wall: turn away
    }
    ped.x = clamped.x;
    ped.y = clamped.y;
    if (ped.y > BEACH_Y - 30) { ped.y = BEACH_Y - 30; ped.angle = -Math.PI / 2; }
  }
}
