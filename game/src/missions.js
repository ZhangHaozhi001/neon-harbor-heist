// The story: five jobs for Marisol Vega, owner of Vega's Garage in the
// north-west of Port Marlowe. Jobs unlock in order; each has intro and outro
// dialogue, an objective marker with a live distance readout, and a cash
// reward. Between jobs the city is free to roam, and ten cash crates are
// scattered around town for anyone who explores.

import { GARAGE, HIDEOUT, CASH_CRATE_COUNT, CASH_CRATE_VALUE } from './config.js';
import { makeVehicle } from './vehicles.js';
import { setStars, clearWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    reward: 300,
    intro: [
      ['Marisol Vega', 'You walk in off the street and expect work? Fine. Prove you can drive.'],
      ['Marisol Vega', 'A red Comet sports car sits by the marina, south-east shore. Bring it to my garage. Unscratched pays full.'],
    ],
    outro: [
      ['Marisol Vega', 'Clean paint, full tank. You might be useful after all.'],
    ],
    objective: 'Steal the red Comet by the marina and deliver it to the garage',
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    reward: 450,
    intro: [
      ['Marisol Vega', 'A package waits at the east pier. A cafe on the west side needs it — fast.'],
      ['Marisol Vega', 'Ninety seconds. The clock starts when you pick it up. Do not keep them waiting.'],
    ],
    outro: [
      ['Marisol Vega', 'On time. The cafe owner sends her thanks — and better work.'],
    ],
    objective: 'Pick up the package at the pier, then deliver it to the west cafe in 90 seconds',
  },
  {
    id: 'hot-property',
    title: 'Hot Property',
    reward: 800,
    intro: [
      ['Marisol Vega', 'A cash truck parks downtown at noon and the guards take long lunches.'],
      ['Marisol Vega', 'Take it, lose the police completely, then bring it home. No stars, no delivery.'],
    ],
    outro: [
      ['Marisol Vega', 'A whole cash truck, and not a siren in earshot. Beautiful.'],
    ],
    objective: 'Steal the cash truck, lose your wanted level, then deliver it to the garage',
  },
  {
    id: 'pier-pressure',
    title: 'Pier Pressure',
    reward: 1000,
    intro: [
      ['Marisol Vega', 'Rivals are smuggling parts through my pier. Three crates, marked and stacked.'],
      ['Marisol Vega', 'Smash all three — ram them or shoot them — before the timer dies. Expect heat.'],
    ],
    outro: [
      ['Marisol Vega', 'Their cargo is scrap and their buyers are gone. One job left, the big one.'],
    ],
    objective: 'Destroy the 3 smuggling crates at the pier before time runs out',
  },
  {
    id: 'marlowe-job',
    title: 'The Marlowe Job',
    reward: 2500,
    intro: [
      ['Marisol Vega', 'The Harbour Exchange keeps a vault room with a five-second override. Stand in it, take the money.'],
      ['Marisol Vega', 'Every patrol in Port Marlowe will come. Get to the hideout north-east and the money is yours.'],
    ],
    outro: [
      ['Marisol Vega', 'You did it. Port Marlowe is ours now — the garage, the pier, all of it.'],
      ['Marisol Vega', 'Stick around. A city like this always has more work.'],
    ],
    objective: 'Rob the Harbour Exchange, then escape to the hideout',
  },
];

const CAFE = { x: 300, y: 1560 };
const PIER = { x: 2400, y: 900 };
const MARINA = { x: 2080, y: 1620 };
const EXCHANGE = { x: 1300, y: 760 };

export function createMissionState() {
  return {
    phase: 'idle',       // idle | intro | active | outro | done
    def: null,
    step: 0,
    timer: 0,
    data: {},
    dialogue: null,      // {lines, index, after}
  };
}

export function scatterCrates(game) {
  const spots = [
    [520, 240], [1300, 500], [2080, 240], [780, 1020], [1820, 1280],
    [520, 1540], [1560, 760], [1040, 240], [2340, 1540], [300, 1020],
  ];
  game.crates = spots.slice(0, CASH_CRATE_COUNT).map(([x, y], index) => ({
    index, x, y, taken: game.cratesCollected.includes(index),
  }));
  game.cashCrates = game.crates.filter((c) => !c.taken).map((c) => ({ x: c.x, y: c.y, index: c.index }));
}

export function nearGarage(game) {
  const dx = game.player.x - GARAGE.x;
  const dy = game.player.y - GARAGE.y;
  return dx * dx + dy * dy < GARAGE.radius * GARAGE.radius;
}

export function startMission(game) {
  const def = MISSIONS[game.missionIndex];
  if (!def) return;
  const m = game.mission;
  m.def = def;
  m.phase = 'intro';
  m.step = 0;
  m.timer = 0;
  m.data = {};
  m.dialogue = { lines: def.intro, index: 0, after: 'activate' };
}

export function activateMission(game) {
  const m = game.mission;
  m.phase = 'active';
  const id = m.def.id;
  if (id === 'first-wheels') {
    const car = makeVehicle('comet', MARINA.x, MARINA.y, -Math.PI / 2, '#d92323');
    car.parked = true;
    car.missionTag = 'target-car';
    game.vehicles.push(car);
    m.data.targetCar = car;
  } else if (id === 'harbor-run') {
    m.step = 0; // 0: go to pier, 1: deliver to cafe
  } else if (id === 'hot-property') {
    const truck = makeVehicle('truck', 1300, 1060, 0, '#3f7d5a');
    truck.parked = true;
    truck.missionTag = 'target-truck';
    game.vehicles.push(truck);
    m.data.targetTruck = truck;
  } else if (id === 'pier-pressure') {
    m.timer = 150;
    m.data.crates = [
      { x: 2440, y: 700, hp: 40, dead: false },
      { x: 2470, y: 980, hp: 40, dead: false },
      { x: 2430, y: 1260, hp: 40, dead: false },
    ];
    setStars(game, Math.max(game.police.stars, 1));
  } else if (id === 'marlowe-job') {
    m.step = 0; // 0: rob (stand in circle), 1: escape
    m.data.holdTime = 0;
  }
}

export function failMission(game, reason) {
  const m = game.mission;
  game.toast(`Job failed: ${reason}`);
  game.audio.fail();
  cleanupMissionEntities(game);
  m.phase = 'idle';
  m.def = null;
  m.dialogue = null;
}

function cleanupMissionEntities(game) {
  const m = game.mission;
  if (m.data.targetCar) {
    const i = game.vehicles.indexOf(m.data.targetCar);
    if (i >= 0 && game.player.vehicle !== m.data.targetCar) game.vehicles.splice(i, 1);
  }
  if (m.data.targetTruck) {
    const i = game.vehicles.indexOf(m.data.targetTruck);
    if (i >= 0 && game.player.vehicle !== m.data.targetTruck) game.vehicles.splice(i, 1);
  }
  m.data = {};
}

export function completeMission(game) {
  const m = game.mission;
  const def = m.def;
  game.cash += def.reward;
  game.toast(`Job complete: +$${def.reward}`);
  game.audio.sting();
  cleanupMissionEntities(game);
  game.missionIndex += 1;
  if (game.missionIndex >= MISSIONS.length) game.finished = true;
  m.phase = 'outro';
  m.dialogue = { lines: def.outro, index: 0, after: 'finish' };
  game.saveGame();
}

export function currentObjective(game) {
  const m = game.mission;
  if (m.phase !== 'active' || !m.def) return null;
  const p = game.player;
  const dist = (x, y) => Math.round(Math.hypot(x - p.x, y - p.y) / 10);
  const id = m.def.id;
  if (id === 'first-wheels') {
    const car = m.data.targetCar;
    if (p.vehicle === car) return { text: 'Deliver the Comet to the garage (G)', x: GARAGE.x, y: GARAGE.y, dist: dist(GARAGE.x, GARAGE.y) };
    if (car) return { text: 'Steal the red Comet', x: car.x, y: car.y, dist: dist(car.x, car.y) };
  }
  if (id === 'harbor-run') {
    if (m.step === 0) return { text: 'Pick up the package at the pier', x: PIER.x, y: PIER.y, dist: dist(PIER.x, PIER.y) };
    return { text: `Deliver to the cafe — ${Math.max(0, Math.ceil(m.timer))}s left`, x: CAFE.x, y: CAFE.y, dist: dist(CAFE.x, CAFE.y) };
  }
  if (id === 'hot-property') {
    const truck = m.data.targetTruck;
    if (p.vehicle === truck) {
      if (game.police.stars > 0) return { text: 'Lose the police before delivering', x: null, y: null, dist: null };
      return { text: 'Deliver the cash truck to the garage (G)', x: GARAGE.x, y: GARAGE.y, dist: dist(GARAGE.x, GARAGE.y) };
    }
    if (truck) return { text: 'Steal the cash truck downtown', x: truck.x, y: truck.y, dist: dist(truck.x, truck.y) };
  }
  if (id === 'pier-pressure') {
    const left = m.data.crates.filter((c) => !c.dead).length;
    const next = m.data.crates.find((c) => !c.dead);
    return { text: `Smash the smuggling crates: ${3 - left}/3 — ${Math.max(0, Math.ceil(m.timer))}s left`, x: next ? next.x : null, y: next ? next.y : null, dist: next ? dist(next.x, next.y) : null };
  }
  if (id === 'marlowe-job') {
    if (m.step === 0) return { text: `Stand in the Exchange vault circle: ${Math.floor(m.data.holdTime || 0)}/5s`, x: EXCHANGE.x, y: EXCHANGE.y, dist: dist(EXCHANGE.x, EXCHANGE.y) };
    return { text: 'Escape to the hideout', x: HIDEOUT.x, y: HIDEOUT.y, dist: dist(HIDEOUT.x, HIDEOUT.y) };
  }
  return { text: m.def.objective, x: null, y: null, dist: null };
}

export function updateMissions(game, dt) {
  const m = game.mission;
  if (m.phase !== 'active' || !m.def) return;
  const p = game.player;
  const id = m.def.id;
  const near = (x, y, r) => {
    const dx = p.x - x;
    const dy = p.y - y;
    return dx * dx + dy * dy < r * r;
  };

  if (id === 'first-wheels') {
    const car = m.data.targetCar;
    if (car && car.dead) { failMission(game, 'the Comet was destroyed'); return; }
    if (p.vehicle === car && near(GARAGE.x, GARAGE.y, GARAGE.radius + 20)) {
      p.vehicle = null;
      car.driver = null;
      car.parked = true;
      completeMission(game);
    }
  } else if (id === 'harbor-run') {
    if (m.step === 0 && near(PIER.x, PIER.y, 55)) {
      m.step = 1;
      m.timer = 90;
      game.toast('Package picked up — go!');
      game.audio.pickup();
    } else if (m.step === 1) {
      m.timer -= dt;
      if (m.timer <= 0) { failMission(game, 'too slow'); return; }
      if (near(CAFE.x, CAFE.y, 55)) completeMission(game);
    }
  } else if (id === 'hot-property') {
    const truck = m.data.targetTruck;
    if (truck && truck.dead) { failMission(game, 'the cash truck was destroyed'); return; }
    if (p.vehicle === truck && game.police.stars === 0 && near(GARAGE.x, GARAGE.y, GARAGE.radius + 20)) {
      p.vehicle = null;
      truck.driver = null;
      truck.parked = true;
      completeMission(game);
    }
  } else if (id === 'pier-pressure') {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(game, 'time ran out'); return; }
    // Crates break from ramming or nearby vehicle explosions handled in main via crate checks.
    if (m.data.crates.every((c) => c.dead)) completeMission(game);
  } else if (id === 'marlowe-job') {
    if (m.step === 0) {
      if (!p.vehicle && near(EXCHANGE.x, EXCHANGE.y, 46)) {
        m.data.holdTime = (m.data.holdTime || 0) + dt;
        if (m.data.holdTime >= 5) {
          m.step = 1;
          setStars(game, 4);
          game.cash += 500;
          game.toast('Vault emptied! Run!');
          game.audio.alarm();
        }
      } else {
        m.data.holdTime = Math.max(0, (m.data.holdTime || 0) - dt * 1.5);
      }
    } else if (near(HIDEOUT.x, HIDEOUT.y, HIDEOUT.radius)) {
      clearWanted(game);
      completeMission(game);
    }
  }
}

/** Ram and bullet damage to mission crates (pier-pressure). Called from main's collision hooks. */
export function damageMissionCrates(game, x, y, radius, amount) {
  const m = game.mission;
  if (m.phase !== 'active' || !m.def || m.def.id !== 'pier-pressure') return;
  for (const crate of m.data.crates || []) {
    if (crate.dead) continue;
    const dx = crate.x - x;
    const dy = crate.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      crate.hp -= amount;
      game.effects.sparks(crate.x, crate.y, 5);
      if (crate.hp <= 0) {
        crate.dead = true;
        game.effects.smoke(crate.x, crate.y, true);
        game.toast('Crate smashed');
        game.audio.crash(0.5);
      }
    }
  }
}

export const MISSION_SPOTS = { CAFE, PIER, MARINA, EXCHANGE };
