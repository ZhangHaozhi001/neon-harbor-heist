// HUD and screens: wanted stars, cash, health bar, ammo, speed, the objective
// line with distance, toasts, the bust meter, the minimap (roads, player
// arrow, traffic, police, mission marker, north indicator), dialogue panels,
// and the title / pause / busted / wasted / ending screens.

import { WORLD, VIEW, FONT, GARAGE } from './config.js';
import { AVENUES_X, AVENUES_Y, BEACH_Y } from './city.js';
import { MISSIONS } from './missions.js';

const MAP = { x: VIEW.width - 216, y: 14, w: 202, h: 156 };

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12,16,24,${alpha === undefined ? 0.78 : alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,209,74,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

function bar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, ratio)), h - 2);
}

export function drawHUD(ctx, game) {
  ctx.textAlign = 'left';
  // Wanted stars, top centre.
  const stars = game.police.stars;
  ctx.font = '30px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd14a' : 'rgba(255,255,255,0.18)';
    ctx.fillText('★', VIEW.width / 2 - 64 + i * 32, 40);
  }
  if (stars > 0 && !game.police.seen) {
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('BREAK LINE OF SIGHT — HEAT COOLING', VIEW.width / 2, 62);
  }

  // Top-left: cash, health, ammo / speed.
  ctx.textAlign = 'left';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = '#8dff9a';
  ctx.fillText(`$${game.cash}`, 18, 38);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = '#eef1f5';
  ctx.fillText('HEALTH', 18, 66);
  bar(ctx, 76, 54, 170, 14, game.player.health / 100, game.player.health > 30 ? '#57c96b' : '#e5534b');
  if (game.player.vehicle) {
    const kmh = Math.round(Math.abs(game.player.vehicle.speed) * 0.36);
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${kmh} km/h`, 18, 100);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(game.player.vehicle.def.name + (game.player.vehicle.dead ? ' — WRECKED' : ''), 110, 100);
  } else {
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillStyle = '#fff';
    const c = game.combat;
    ctx.fillText(`PISTOL  ${c.mag} / ${c.reserve}`, 18, 100);
    if (c.reloadTimer > 0) {
      ctx.font = `13px ${FONT}`;
      ctx.fillStyle = '#ffd14a';
      ctx.fillText('RELOADING…', 190, 100);
    }
  }
  if (game.audio.muted) {
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('MUTED (M)', 18, 124);
  }

  // Bust meter under the stars.
  if (game.police.bust > 0.02) {
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = '#ff6b5e';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED METER', VIEW.width / 2, 88);
    bar(ctx, VIEW.width / 2 - 110, 96, 220, 12, game.police.bust, '#e5534b');
    ctx.textAlign = 'left';
  }

  // Objective line, bottom centre.
  const objective = game.objectiveCache;
  if (objective) {
    ctx.font = `bold 17px ${FONT}`;
    const text = objective.dist !== null && objective.dist !== undefined
      ? `${objective.text}  —  ${objective.dist}m`
      : objective.text;
    const w = ctx.measureText(text).width + 30;
    panel(ctx, (VIEW.width - w) / 2, VIEW.height - 52, w, 34, 0.72);
    ctx.fillStyle = '#ffd14a';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, VIEW.height - 29);
    ctx.textAlign = 'left';
  } else if (game.mission.phase === 'idle' && game.missionIndex < MISSIONS.length) {
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(`Visit Marisol at Vega's Garage (G) for: ${MISSIONS[game.missionIndex].title}`, VIEW.width / 2, VIEW.height - 28);
    ctx.textAlign = 'left';
  }

  // Interact hint.
  if (game.interactHint) {
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    panel(ctx, VIEW.width / 2 - 150, VIEW.height - 96, 300, 32, 0.72);
    ctx.fillText(game.interactHint, VIEW.width / 2, VIEW.height - 74);
    ctx.textAlign = 'left';
  }

  // Toasts, stacked under the minimap.
  ctx.font = `bold 15px ${FONT}`;
  let ty = MAP.y + MAP.h + 26;
  for (const toast of game.toasts) {
    ctx.fillStyle = `rgba(12,16,24,${0.75 * Math.min(1, toast.life)})`;
    const w = ctx.measureText(toast.text).width + 24;
    ctx.fillRect(VIEW.width - w - 14, ty - 17, w, 25);
    ctx.fillStyle = `rgba(255,209,74,${Math.min(1, toast.life)})`;
    ctx.textAlign = 'right';
    ctx.fillText(toast.text, VIEW.width - 26, ty);
    ty += 30;
  }
  ctx.textAlign = 'left';

  drawMinimap(ctx, game);
  if (game.mission.dialogue) drawDialogue(ctx, game);
}

function drawMinimap(ctx, game) {
  const { x, y, w, h } = MAP;
  ctx.fillStyle = 'rgba(14,20,28,0.88)';
  ctx.fillRect(x, y, w, h);
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  // Water and beach.
  ctx.fillStyle = '#14506e';
  ctx.fillRect(x, y + 1880 * sy, w, h - 1880 * sy);
  ctx.fillStyle = '#d9c184';
  ctx.fillRect(x, y + BEACH_Y * sy, w, (1880 - BEACH_Y) * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(220,224,230,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const ax of AVENUES_X) { ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + BEACH_Y * sy); }
  for (const ay of AVENUES_Y) { ctx.moveTo(x, y + ay * sy); ctx.lineTo(x + w, y + ay * sy); }
  ctx.stroke();
  // Traffic and police.
  for (const v of game.vehicles) {
    if (v.dead) continue;
    ctx.fillStyle = v.driver === 'police' ? '#3c6bff' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + v.x * sx - 1.5, y + v.y * sy - 1.5, 3, 3);
  }
  // Garage and objective.
  ctx.fillStyle = '#ffd14a';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('G', x + GARAGE.x * sx, y + GARAGE.y * sy + 4);
  const objective = game.objectiveCache;
  if (objective && objective.x !== null && objective.x !== undefined) {
    ctx.fillStyle = Math.floor(game.time * 3) % 2 === 0 ? '#ff5e4d' : '#ffd14a';
    ctx.beginPath();
    ctx.arc(x + objective.x * sx, y + objective.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x + game.player.x * sx;
  const py = y + game.player.y * sy;
  const angle = game.player.vehicle ? game.player.vehicle.angle : game.player.aimAngle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.4, 5);
  ctx.lineTo(-4.4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('N', x + w - 12, y + 15);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'left';
}

function drawDialogue(ctx, game) {
  const d = game.mission.dialogue;
  const line = d.lines[d.index];
  const w = 760;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - 190;
  panel(ctx, x, y, w, 118, 0.92);
  ctx.fillStyle = '#ffd14a';
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillText(line[0], x + 22, y + 32);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `16px ${FONT}`;
  wrapText(ctx, line[1], x + 22, y + 60, w - 44, 21);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(d.index < d.lines.length - 1 ? 'Click / Space ▸' : 'Click / Space to start ▸', x + w - 18, y + 104);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function bigScreen(ctx, title, color, lines, prompt) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText(title, VIEW.width / 2, 210);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `18px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 268 + i * 30));
  if (prompt) {
    ctx.fillStyle = '#ffd14a';
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText(prompt, VIEW.width / 2, 268 + lines.length * 30 + 26);
  }
  ctx.textAlign = 'left';
}

export function drawTitleScreen(ctx, game) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ff5e8a';
  ctx.font = `bold 76px ${FONT}`;
  ctx.fillText('NEON HARBOR', VIEW.width / 2, 168);
  ctx.fillStyle = '#ffd14a';
  ctx.fillText('HEIST', VIEW.width / 2, 248);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `17px ${FONT}`;
  const story = [
    'Port Marlowe: a harbour city of palm avenues, fast cars and dirty money.',
    'You are a driver with nothing. Marisol Vega, who runs the north-west garage,',
    'has five jobs that will make you rich — or get you busted. Steal, run, deliver.',
  ];
  story.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 300 + i * 25));
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const controls = [
    'WASD / Arrows — move & drive      E — enter / exit / steal car      Shift — sprint',
    'Mouse — aim      Click / Space — shoot      R — reload      Esc / P — pause      M — mute',
  ];
  controls.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 402 + i * 24));
  // Buttons.
  drawButton(ctx, VIEW.width / 2 - 220, 478, 200, 52, 'NEW GAME', game.hoverButton === 'new');
  drawButton(ctx, VIEW.width / 2 + 20, 478, 200, 52, game.hasSave ? 'CONTINUE' : 'NO SAVE YET', game.hoverButton === 'continue');
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('Click a button, or press Enter for New Game', VIEW.width / 2, 566);
  ctx.textAlign = 'left';
}

function drawButton(ctx, x, y, w, h, label, hover) {
  ctx.fillStyle = hover ? '#ffd14a' : 'rgba(16,22,32,0.9)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd14a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = hover ? '#20242c' : '#ffd14a';
  ctx.font = `bold 19px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 34);
  ctx.textAlign = 'left';
}

export const TITLE_BUTTONS = {
  new: { x: VIEW.width / 2 - 220, y: 478, w: 200, h: 52 },
  continue: { x: VIEW.width / 2 + 20, y: 478, w: 200, h: 52 },
};

export function drawPauseScreen(ctx) {
  bigScreen(ctx, 'PAUSED', '#eef1f5', ['The city waits. It is good at that.'], 'Esc / P to resume');
}

export function drawBustedScreen(ctx, game) {
  bigScreen(ctx, 'BUSTED', '#3c6bff', [
    'The Port Marlowe police take your keys, your cash stash',
    `and $${Math.min(200, game.cash)} in fines. You walk free at dawn.`,
  ], 'Click or press Space to keep playing');
}

export function drawWastedScreen(ctx) {
  bigScreen(ctx, 'WASTED', '#e5534b', [
    'You wake up outside Marlowe General with a headache',
    'and an empty holster. The city keeps your car.',
  ], 'Click or press Space to keep playing');
}

export function drawEndingScreen(ctx, game) {
  bigScreen(ctx, 'PORT MARLOWE IS YOURS', '#ffd14a', [
    'All five jobs done. The garage, the pier and the harbour money',
    `now answer to you. Final cash: $${game.cash}.`,
    'Free roam continues — the crates and the police are still out there.',
  ], 'Click or press Space to keep roaming');
}
