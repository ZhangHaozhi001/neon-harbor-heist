// Neon Harbor Heist — boot, the game state machine and the main loop.
// Screens: title, play, paused, busted, wasted, ending. The simulation runs
// in fixed 1/60 steps; rendering and HUD are separate modules. All the
// cross-system glue lives here: entering and stealing cars, crimes witnessed,
// cash crates, mission hooks, saving, and the camera.
//
// ?seed=N fixes the city's dressing. ?shot=cover|drive|chase|mission stages
// a deterministic scene (see shots.js) instead of running the loop.
import { WORLD, VIEW, STEP, PLAYER, CAMERA, GARAGE, CASH_CRATE_VALUE } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_INTERACT, ACTION_PAUSE, ACTION_CONFIRM, ACTION_MUTE, ACTION_RELOAD } from './input.js';
import { createEffects } from './effects.js';
import { spawnTraffic, updateTraffic, driveStep } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, scarePedestrians, knockDownPedestrian } from './pedestrians.js';
import { createPoliceState, addHeat, isWitnessed, clearWanted, updatePolice } from './police.js';
import { createCombatState, tryFire, startReload, updateCombat } from './combat.js';
import {
  createMissionState, scatterCrates, nearGarage, startMission, activateMission,
  updateMissions, currentObjective, damageMissionCrates, MISSIONS,
} from './missions.js';
import { loadSave, storeSave, clearSave } from './save.js';
import { drawWorld } from './render.js';
import {
  drawHUD, drawTitleScreen, drawPauseScreen, drawBustedScreen,
  drawWastedScreen, drawEndingScreen, TITLE_BUTTONS,
} from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function announce(message) { status.textContent = message; }

export function createGame(saved) {
  const random = createRandom(seed);
  const game = {
    random,
    time: 0,
    screen: 'title',
    city: createCity(random),
    audio: createAudio(),
    effects: createEffects(),
    vehicles: [],
    pedestrians: [],
    police: createPoliceState(),
    policeSpawnTimer: 0,
    combat: createCombatState(),
    mission: createMissionState(),
    missionIndex: saved ? saved.missionIndex : 0,
    cash: saved ? saved.cash : 0,
    cratesCollected: saved ? saved.crates : [],
    finished: saved ? saved.finished : false,
    player: {
      x: saved && saved.x !== null ? saved.x : PLAYER.startX,
      y: saved && saved.y !== null ? saved.y : PLAYER.startY,
      vx: 0, vy: 0,
      health: PLAYER.maxHealth,
      aimAngle: -Math.PI / 2,
      vehicle: null,
      moving: false,
    },
    camera: { x: 0, y: 0 },
    lastFine: 0,
    // First-run guide: walks a brand-new player through walk -> steal ->
    // drive -> garage -> first job. Anyone with progress skips it entirely.
    tutorial: {
      active: !saved || (saved.missionIndex === 0 && saved.cash === 0 && saved.crates.length === 0),
      step: 0,
      moved: 0,
      target: null,
      prevX: null,
      prevY: null,
    },
    toasts: [],
    objectiveCache: null,
    interactHint: '',
    hoverButton: null,
    hasSave: Boolean(saved),
    endingShown: false,
  };
  game.toast = (text) => {
    game.toasts.push({ text, life: 3.2 });
    if (game.toasts.length > 4) game.toasts.shift();
  };
  game.saveGame = () => storeSave(game);

  // --- Cross-system callbacks ---------------------------------------------
  game.onPedestrianHit = (ped) => {
    void ped;
    addHeat(game, 1, true);
    game.toast('You hit a pedestrian!');
  };
  game.onVehicleCrash = (v, impact, x, y) => {
    scarePedestrians(game, x, y, 200);
    damageMissionCrates(game, x, y, 70, impact * 0.25);
    if (v.driver === 'player' && impact > 150) game.player.health -= (impact - 150) * 0.05;
  };
  game.onPlayerVehicleDestroyed = () => {
    game.player.health -= 22;
    game.effects.addShake(12);
    game.toast('Your car is wrecked!');
  };
  game.panicDriver = (car) => {
    // The driver bails out and runs; the car is left with the door open.
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    game.pedestrians.push({
      x: car.x + 30, y: car.y + 10, angle: Math.random() * Math.PI * 2,
      speed: 50, shirt: '#c9574f', state: 'flee', panic: 3,
      turnTimer: 2, legPhase: 0, dead: false,
    });
    scarePedestrians(game, car.x, car.y, 130);
  };
  game.onShotFired = () => {
    damageMissionCrates(game, game.player.x + Math.cos(game.player.aimAngle) * 60, game.player.y + Math.sin(game.player.aimAngle) * 60, 60, 20);
  };
  game.onWantedCleared = () => { game.saveGame(); };
  game.onBusted = () => {
    game.screen = 'busted';
    // Record the fine before deducting it: the BUSTED screen reads lastFine,
    // and reading the balance after the deduction understated it.
    game.lastFine = Math.min(200, game.cash);
    game.cash -= game.lastFine;
    clearWanted(game);
    announce('Busted. The police take $200 in fines.');
    game.audio.fail();
  };
  return game;
}

function resetAfterDeathOrBust(game) {
  const p = game.player;
  if (p.vehicle) { p.vehicle.driver = null; p.vehicle = null; }
  p.x = PLAYER.startX;
  p.y = PLAYER.startY;
  p.health = PLAYER.maxHealth;
  clearWanted(game);
  game.screen = 'play';
  game.saveGame();
}

function nearestVehicle(game, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const v of game.vehicles) {
    if (v.dead) continue;
    const dx = v.x - game.player.x;
    const dy = v.y - game.player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = v; }
  }
  return best;
}

function enterOrExitVehicle(game) {
  const p = game.player;
  game.audio.door();
  if (p.vehicle) {
    const v = p.vehicle;
    v.driver = null;
    if (Math.abs(v.speed) < 5) v.parked = true;
    p.x = v.x + Math.cos(v.angle + Math.PI / 2) * (v.width / 2 + 20);
    p.y = v.y + Math.sin(v.angle + Math.PI / 2) * (v.width / 2 + 20);
    const clamped = game.city.collideCircle(p.x, p.y, PLAYER.radius);
    p.x = clamped.x;
    p.y = clamped.y;
    p.vehicle = null;
    return;
  }
  const v = nearestVehicle(game, 62);
  if (!v) return;
  const hadDriver = v.driver === 'traffic';
  if (hadDriver) game.panicDriver(v);
  const witnessed = isWitnessed(game, v.x, v.y, 210);
  if (!v.parked || hadDriver || v.wasStolen) {
    if (witnessed) {
      addHeat(game, 1, true);
      game.toast('Car theft witnessed!');
    }
  }
  if (v.missionTag) game.toast(v.type === 'truck' ? 'Cash truck taken!' : 'Target car taken!');
  v.wasStolen = true;
  v.parked = false;
  v.driver = 'player';
  p.vehicle = v;
}

function updatePlayer(game, input, dt) {
  const p = game.player;
  p.aimAngle = Math.atan2(
    (input.mouse.y + game.camera.y) - p.y,
    (input.mouse.x + game.camera.x) - p.x,
  );
  if (p.vehicle) {
    const v = p.vehicle;
    const driveInput = {
      throttle: (input.held.up ? 1 : 0) + (input.held.down ? -1 : 0),
      steer: (input.held.right ? 1 : 0) + (input.held.left ? -1 : 0),
    };
    driveStep(game, v, dt, driveInput);
    p.x = v.x;
    p.y = v.y;
    p.moving = Math.abs(v.speed) > 10;
    // Running people over.
    for (const ped of game.pedestrians) {
      if (ped.dead) continue;
      const dx = ped.x - v.x;
      const dy = ped.y - v.y;
      if (dx * dx + dy * dy < 34 * 34 && Math.abs(v.speed) > 40) {
        knockDownPedestrian(game, ped, true);
        game.effects.addShake(3);
      }
    }
    // Police ramming hurts a little at high closing speed.
    return;
  }
  const ax = input.axisX();
  const ay = input.axisY();
  const speed = input.held.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(ax, ay) || 1;
  p.vx = (ax / len) * (ax || ay ? speed : 0);
  p.vy = (ay / len) * (ax || ay ? speed : 0);
  p.moving = Boolean(ax || ay);
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  const clamped = game.city.collideCircle(nx, ny, PLAYER.radius);
  p.x = clamped.x;
  p.y = clamped.y;
  // Wading limit: the sea is off limits on foot.
  // Firing.
  if (input.mouse.down || input.held.fire) tryFire(game, p.aimAngle);
}

// The first-run guide. Each step completes on the real action it teaches,
// and the step's target (nearest car, then the garage) feeds the HUD's
// coach card and edge arrow. Finishing the last step retires the guide.
function updateTutorial(game) {
  const t = game.tutorial;
  if (!t.active) return;
  const p = game.player;
  if (t.prevX === null) { t.prevX = p.x; t.prevY = p.y; }
  if (t.step === 0) {
    t.target = null;
    if (!p.vehicle) {
      t.moved += Math.hypot(p.x - t.prevX, p.y - t.prevY);
      if (t.moved >= 140) t.step = 1;
    }
  } else if (t.step === 1) {
    const v = nearestVehicle(game, 4000);
    t.target = v ? { x: v.x, y: v.y } : null;
    if (p.vehicle) t.step = 2;
  } else if (t.step === 2) {
    t.target = null;
    if (!p.vehicle) t.step = 1; // bailed out before hitting speed: re-teach the steal
    else if (Math.abs(p.vehicle.speed) * 0.36 >= 70) t.step = 3;
  } else if (t.step === 3) {
    t.target = { x: GARAGE.x, y: GARAGE.y };
    if (nearGarage(game)) t.step = 4;
  } else if (t.step === 4) {
    t.target = { x: GARAGE.x, y: GARAGE.y };
    if (game.mission.phase !== 'idle') {
      t.active = false;
      game.toast('Guide complete — Port Marlowe is yours');
    }
  }
  t.prevX = p.x;
  t.prevY = p.y;
}

function updateCrates(game) {
  const p = game.player;
  for (const crate of game.cashCrates) {
    const dx = crate.x - p.x;
    const dy = crate.y - p.y;
    if (dx * dx + dy * dy < 30 * 30) {
      crate.taken = true;
      game.cratesCollected.push(crate.index);
      game.cash += CASH_CRATE_VALUE;
      game.effects.glint(crate.x, crate.y);
      game.audio.pickup();
      game.toast(`Cash crate: +$${CASH_CRATE_VALUE}`);
      game.saveGame();
    }
  }
  game.cashCrates = game.cashCrates.filter((c) => !c.taken);
}

function updateCamera(game, dt) {
  const p = game.player;
  let tx = p.x - VIEW.width / 2;
  let ty = p.y - VIEW.height / 2;
  if (p.vehicle) {
    tx += Math.cos(p.vehicle.angle) * p.vehicle.speed * CAMERA.lookAhead;
    ty += Math.sin(p.vehicle.angle) * p.vehicle.speed * CAMERA.lookAhead;
  }
  const k = Math.min(1, dt * CAMERA.stiffness);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
  game.camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, game.camera.x));
  game.camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, game.camera.y));
}

function stepGame(game, input, dt) {
  game.time += dt;
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) game.toast(game.audio.toggleMute() ? 'Muted' : 'Sound on');
  if (game.screen === 'paused') {
    if (actions & ACTION_PAUSE) game.screen = 'play';
    return;
  }
  if (game.screen !== 'play') return;
  if (actions & ACTION_PAUSE) { game.screen = 'paused'; announce('Paused.'); return; }

  // Dialogue advances on confirm and swallows other input.
  if (game.mission.dialogue) {
    if (actions & ACTION_CONFIRM) {
      const d = game.mission.dialogue;
      d.index += 1;
      game.audio.pickup();
      if (d.index >= d.lines.length) {
        game.mission.dialogue = null;
        if (d.after === 'activate') activateMission(game);
        else if (d.after === 'finish') {
          game.mission.phase = 'idle';
          game.mission.def = null;
          if (game.finished && !game.endingShown) {
            game.endingShown = true;
            game.screen = 'ending';
            announce('All jobs complete. Port Marlowe is yours.');
          }
        }
      }
    }
    return;
  }

  if (actions & ACTION_INTERACT) {
    if (!game.player.vehicle && game.mission.phase === 'idle' && game.missionIndex < MISSIONS.length && nearGarage(game)) {
      startMission(game);
      announce(`New job: ${MISSIONS[game.missionIndex].title}.`);
    } else {
      enterOrExitVehicle(game);
    }
  }
  if (actions & ACTION_RELOAD) startReload(game);

  updatePlayer(game, input, dt);
  // Other vehicles' damage/fire upkeep happens inside driveStep; parked and
  // driverless cars still burn.
  for (const v of game.vehicles) {
    if (v.driver === null && !v.parked) { v.parked = true; v.speed = 0; }
    if (v.dead && v.burning > 0) {
      v.burning -= dt;
      game.effects.fire(v.x, v.y);
    }
  }
  // Traffic AI.
  updateTraffic(game, dt);
  updatePedestrians(game, dt);
  updatePolice(game, dt);
  updateCombat(game, dt);
  updateMissions(game, dt);
  updateTutorial(game);
  updateCrates(game);
  game.effects.update(dt);
  game.objectiveCache = currentObjective(game);

  // Interact hint text.
  if (game.player.vehicle) game.interactHint = 'E — exit vehicle';
  else if (game.mission.phase === 'idle' && game.missionIndex < MISSIONS.length && nearGarage(game)) {
    game.interactHint = `E — talk to Marisol: ${MISSIONS[game.missionIndex].title}`;
  } else if (nearestVehicle(game, 62)) game.interactHint = 'E — enter / steal vehicle';
  else game.interactHint = '';

  // Toasts decay.
  for (let i = game.toasts.length - 1; i >= 0; i -= 1) {
    game.toasts[i].life -= dt;
    if (game.toasts[i].life <= 0) game.toasts.splice(i, 1);
  }

  // Death.
  if (game.player.health <= 0 && game.screen === 'play') {
    game.screen = 'wasted';
    announce('Wasted.');
    game.audio.fail();
  }

  // Audio follows the action.
  const v = game.player.vehicle;
  game.audio.update(dt, v ? v.speed / v.def.topSpeed : 0, game.police.stars, Boolean(v));
}

function draw(game) {
  ctx.fillStyle = '#101623';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  updateCamera(game, 1 / 60);
  drawWorld(ctx, game);
  if (game.screen !== 'title') drawHUD(ctx, game);
  if (game.screen === 'title') drawTitleScreen(ctx, game);
  else if (game.screen === 'paused') drawPauseScreen(ctx);
  else if (game.screen === 'busted') drawBustedScreen(ctx, game);
  else if (game.screen === 'wasted') drawWastedScreen(ctx);
  else if (game.screen === 'ending') drawEndingScreen(ctx, game);
}

function boot() {
  const saved = loadSave();
  const game = createGame(saved);
  spawnTraffic(game);
  spawnPedestrians(game);
  scatterCrates(game);
  // Snap the camera to the player for the first frame.
  game.camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, game.player.x - VIEW.width / 2));
  game.camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, game.player.y - VIEW.height / 2));
  return game;
}

if (shot) {
  const game = boot();
  game.screen = 'play';
  const scene = stageShot(shot, game);
  if (scene) game.screen = scene;
  let painted = 0;
  const paint = () => {
    draw(game);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  const game = boot();
  const input = createInput(canvas);
  game.screen = 'title';
  announce('Neon Harbor Heist. Choose New Game or Continue.');

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    game.hoverButton = null;
    if (game.screen === 'title') {
      for (const [name, b] of Object.entries(TITLE_BUTTONS)) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) game.hoverButton = name;
      }
    }
  });
  canvas.addEventListener('pointerdown', () => {
    game.audio.unlock();
    if (game.screen === 'title' && game.hoverButton) {
      // The click that starts the game must not leak into it as a held
      // trigger — otherwise the player's first act is firing their pistol.
      input.mouse.down = false;
      if (game.hoverButton === 'new') {
        clearSave();
        const fresh = createGame(null);
        fresh.hasSave = false;
        Object.assign(game.player, fresh.player);
        game.cash = 0;
        game.missionIndex = 0;
        game.cratesCollected = [];
        game.finished = false;
        game.endingShown = false;
        game.mission = fresh.mission;
        game.tutorial = fresh.tutorial;
        scatterCrates(game);
        game.screen = 'play';
        game.saveGame();
        announce('New game. Visit Marisol at the garage, marked G.');
      } else if (game.hoverButton === 'continue' && game.hasSave) {
        game.screen = 'play';
        announce('Welcome back to Port Marlowe.');
      }
    } else if (game.screen === 'busted' || game.screen === 'wasted' || game.screen === 'ending') {
      resetAfterDeathOrBust(game);
      if (game.screen === 'play') announce('Back on the street.');
    }
  });

  let accumulator = 0;
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25);
    last = now;
    // Title screen: Enter starts a new game.
    if (game.screen === 'title') {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        game.screen = 'play';
        announce('Visit Marisol at the garage, marked G.');
      }
      accumulator = 0;
      game.time += 1 / 60;
      draw(game);
      return;
    }
    if (game.screen === 'busted' || game.screen === 'wasted' || game.screen === 'ending') {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) resetAfterDeathOrBust(game);
      accumulator = 0;
      draw(game);
      return;
    }
    while (accumulator >= STEP) {
      stepGame(game, input, STEP);
      accumulator -= STEP;
      if (game.screen !== 'play' && game.screen !== 'paused') break;
    }
    draw(game);
  };
  requestAnimationFrame(frame);
}
