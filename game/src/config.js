// Neon Harbor Heist — every tuning number in one place.
// The world is a fixed 2600x2000 map of Port Marlowe; the camera shows a
// 1280x760 window into it. Nothing outside this file hard-codes a balance value.

export const WORLD = { width: 2600, height: 2000 };
export const VIEW = { width: 1280, height: 760 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  sprintSpeed: 235,
  maxHealth: 100,
  startX: 640,
  startY: 1560,
};

export const CAMERA = { lookAhead: 0.45, stiffness: 5.5 };

export const WANTED = {
  max: 5,
  decaySeconds: 14,      // unseen time per star before one star fades
  bustRadius: 46,        // police car this close to a slow/on-foot player fills the bust meter
  bustFill: 0.55,        // per second
  bustDrain: 0.8,
};

export const GUN = {
  magazine: 12,
  reserveStart: 48,
  reloadSeconds: 1.1,
  fireCooldown: 0.16,
  range: 430,
  damage: 34,
};

export const VEHICLE_TYPES = {
  sedan:  { name: 'Sedan',   width: 44, length: 92,  topSpeed: 300, accel: 210, grip: 3.4, health: 120, color: '#5b8dd9' },
  taxi:   { name: 'Taxi',    width: 44, length: 92,  topSpeed: 290, accel: 200, grip: 3.4, health: 120, color: '#e8b93c' },
  comet:  { name: 'Comet',   width: 42, length: 96,  topSpeed: 430, accel: 330, grip: 4.2, health: 110, color: '#d94f6a' },
  van:    { name: 'Van',     width: 48, length: 104, topSpeed: 250, accel: 170, grip: 2.9, health: 170, color: '#9aa5b1' },
  truck:  { name: 'Cash Truck', width: 50, length: 116, topSpeed: 235, accel: 150, grip: 2.6, health: 260, color: '#3f7d5a' },
  police: { name: 'Patrol',  width: 44, length: 94,  topSpeed: 385, accel: 300, grip: 4.0, health: 150, color: '#e8ecf2' },
};

export const TRAFFIC_COUNT = 16;
export const PARKED_COUNT = 14;
export const PED_COUNT = 26;
export const CASH_CRATE_COUNT = 10;
export const CASH_CRATE_VALUE = 75;

export const GARAGE = { x: 300, y: 420, radius: 60 };
export const HIDEOUT = { x: 2380, y: 300, radius: 70 };

export const SAVE_KEY = 'neon-harbor-heist.save.v1';

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

export const COLORS = {
  water: '#14506e',
  sand: '#d9c184',
  grass: '#3e7d46',
  park: '#4c9153',
  road: '#33373d',
  roadLine: '#c8b45a',
  sidewalk: '#8f949c',
  plaza: '#a7a29a',
  night: '#101623',
};
