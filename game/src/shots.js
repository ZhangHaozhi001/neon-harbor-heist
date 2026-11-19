// Deterministic screenshot scenes behind ?shot=cover|drive|chase|mission.
// Each scene stages real game state — real vehicles, real police, the real
// mission dialogue — at fixed positions, runs a few simulation steps so
// particles and timers settle, and returns the screen name main.js should
// draw. Same seed, same frame, every time.

import { VIEW, GARAGE } from './config.js';
import { makeVehicle } from './vehicles.js';
import { setStars } from './police.js';
import { startMission, MISSIONS } from './missions.js';

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

/** Cover: the title screen over a slow aerial view of the city centre. */
function stageCover(game) {
  game.player.x = 1300;
  game.player.y = 900;
  snapCamera(game, 1300, 880);
  settle(game, 30);
  return 'title';
}

/** Drive: the player mid-drive downtown, traffic around, HUD and minimap live. */
function stageDrive(game) {
  const car = makeVehicle('comet', 1300, 1020, 0, '#d94f6a');
  car.driver = 'player';
  car.speed = 235;
  game.vehicles.push(car);
  game.player.vehicle = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.cash = 1250;
  game.missionIndex = 1;
  game.toast('Downtown Port Marlowe');
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
  if (name === 'drive') return stageDrive(game);
  if (name === 'chase') return stageChase(game);
  if (name === 'mission') return stageMission(game);
  return stageCover(game);
}
