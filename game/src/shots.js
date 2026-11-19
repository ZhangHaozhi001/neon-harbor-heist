// Deterministic screenshot scenes behind ?shot=cover|drive|chase|mission.
// Each scene stages real game state — real vehicles, real police, the real
// mission machinery — at fixed positions, runs a few simulation steps so
// particles and timers settle, and returns the screen name main.js should
// draw. Same seed, same frame, every time.

import { VIEW, GARAGE } from './config.js';
import { makeVehicle } from './vehicles.js';
import { setStars } from './police.js';
import { startMission, activateMission, currentObjective, MISSIONS } from './missions.js';

function snapCamera(game, x, y) {
  game.camera.x = Math.max(0, Math.min(2600 - VIEW.width, x - VIEW.width / 2));
  game.camera.y = Math.max(0, Math.min(2000 - VIEW.height, y - VIEW.height / 2));
}

function settle(game, steps) {
  for (let i = 0; i < steps; i += 1) {
    game.time += 1 / 60;
    game.effects.update(1 / 60);
  }
}

/** Cover: mid-delivery in the real first job — the stolen Comet at speed on
 * the palm avenue, two stars up, a patrol car on the tail, the objective
 * banner and the minimap all live in one frame. */
function stageCover(game) {
  startMission(game);
  activateMission(game);
  game.mission.dialogue = null; // the scene is mid-job, not mid-conversation
  const car = game.mission.data.targetCar;
  // Clear ambient traffic out of the hero car's patch of avenue so nothing
  // spawns on top of it; the staged cop and taxi are added afterwards.
  game.vehicles = game.vehicles.filter(
    (v) => v === car || Math.hypot(v.x - 2080, v.y - 1210) > 320,
  );
  car.x = 2080;
  car.y = 1210;
  car.angle = Math.PI / 2;
  car.speed = 265;
  car.driver = 'player';
  game.player.vehicle = car;
  game.player.x = car.x;
  game.player.y = car.y;
  const cop = makeVehicle('police', 2080, 1015, Math.PI / 2, '#e8ecf2');
  cop.driver = 'police';
  cop.speed = 240;
  game.vehicles.push(cop);
  const taxi = makeVehicle('taxi', 2195, 1470, -Math.PI / 2, '#e8b93c');
  taxi.driver = 'traffic';
  taxi.speed = 120;
  taxi.ai = { cruise: 0.5, turnCooldown: 0 };
  game.vehicles.push(taxi);
  setStars(game, 2);
  game.police.seen = true;
  game.cash = 450;
  game.objectiveCache = currentObjective(game);
  // A short skid trail behind the Comet sells the speed.
  for (let i = 1; i <= 7; i += 1) {
    game.effects.addSkid(car.x - 16, car.y - i * 26);
    game.effects.addSkid(car.x + 16, car.y - i * 26);
  }
  snapCamera(game, car.x, car.y + 40);
  settle(game, 20);
  return 'play';
}

/** Drive: the player mid-drive downtown, traffic around, HUD and minimap live. */
function stageDrive(game) {
  const car = makeVehicle('comet', 1300, 1020, 0.1, '#d94f6a');
  car.driver = 'player';
  car.speed = 235;
  game.vehicles.push(car);
  game.player.vehicle = car;
  game.player.x = car.x;
  game.player.y = car.y;
  const van = makeVehicle('van', 1300, 830, Math.PI / 2, '#9aa5b1');
  van.driver = 'traffic';
  van.speed = 90;
  van.ai = { cruise: 0.45, turnCooldown: 0 };
  game.vehicles.push(van);
  game.cash = 1250;
  game.missionIndex = 1;
  game.toast('Downtown Port Marlowe');
  for (let i = 1; i <= 6; i += 1) {
    game.effects.addSkid(car.x - i * 30, car.y - 15 + i * 3);
    game.effects.addSkid(car.x - i * 30, car.y + 15 + i * 3);
  }
  snapCamera(game, car.x + 80, car.y);
  settle(game, 20);
  return 'play';
}

/** Chase: three stars, patrol cars closing in, objective banner on screen. */
function stageChase(game) {
  const car = makeVehicle('sedan', 1560, 760, 0, '#5b8dd9');
  car.driver = 'player';
  car.speed = 190;
  car.health = 82;
  game.vehicles.push(car);
  game.player.vehicle = car;
  game.player.x = car.x;
  game.player.y = car.y;
  const spots = [
    [1395, 700], [1420, 830], [1730, 800], [1760, 690],
  ];
  for (const [x, y] of spots) {
    const cop = makeVehicle('police', x, y, Math.atan2(car.y - y, car.x - x), '#e8ecf2');
    cop.driver = 'police';
    cop.speed = 170;
    game.vehicles.push(cop);
  }
  setStars(game, 3);
  game.police.seen = true; // patrol cars are right on top of the player in this scene
  game.police.bust = 0.35;
  game.cash = 2840;
  game.objectiveCache = { text: 'Lose the police before delivering', x: null, y: null, dist: null };
  game.effects.sparks(car.x - 40, car.y + 18, 8);
  snapCamera(game, car.x, car.y);
  settle(game, 12);
  return 'play';
}

/** Mission: on foot at the garage, Marisol's first-job dialogue open. */
function stageMission(game) {
  game.player.x = GARAGE.x + 16;
  game.player.y = GARAGE.y + 26;
  game.player.vehicle = null;
  game.missionIndex = 0;
  startMission(game);
  void MISSIONS;
  game.cash = 150;
  snapCamera(game, GARAGE.x + 120, GARAGE.y + 60);
  settle(game, 15);
  return 'play';
}

export function stageShot(name, game) {
  game.tutorial.active = false; // staged frames never show the first-run guide
  if (name === 'drive') return stageDrive(game);
  if (name === 'chase') return stageChase(game);
  if (name === 'mission') return stageMission(game);
  return stageCover(game);
}
