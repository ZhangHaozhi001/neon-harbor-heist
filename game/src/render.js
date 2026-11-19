// World rendering: the city of Port Marlowe from above — water, beach, park,
// roads with lane markings, sidewalks, buildings with lit windows, palm trees,
// street lamps, mission props, vehicles, pedestrians and the player. The
// camera transform (including screen shake) is applied here; game logic never
// touches the canvas.

import { WORLD, VIEW, COLORS, GARAGE, HIDEOUT } from './config.js';
import { AVENUES_X, AVENUES_Y, BEACH_Y, WATER_Y, PIER_X, ROAD_HALF } from './city.js';
import { vehicleCorners } from './vehicles.js';

// Port Marlowe lives at dusk: street lamps throw warm pools of light, some
// rooftops carry neon signs, and a graded overlay warms the whole frame.
// The lamp glow is a pre-rendered radial sprite so the per-frame cost is a
// handful of drawImage calls, never a gradient allocation.
let lampGlowSprite = null;
function getLampGlow() {
  if (lampGlowSprite) return lampGlowSprite;
  const sprite = document.createElement('canvas');
  sprite.width = 128;
  sprite.height = 128;
  const sctx = sprite.getContext('2d');
  const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,196,96,0.30)');
  grad.addColorStop(0.55, 'rgba(255,170,80,0.12)');
  grad.addColorStop(1, 'rgba(255,170,80,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  lampGlowSprite = sprite;
  return sprite;
}

const NEON_SIGNS = [
  { word: 'BAR', color: '#ff5e8a' },
  { word: 'HOTEL', color: '#39d0ff' },
  { word: 'CLUB NEON', color: '#b06fc9' },
  { word: 'DINER', color: '#ffd14a' },
  { word: '24H PAWN', color: '#57ffb0' },
  { word: 'MARINA', color: '#4fc3ff' },
];

export function drawWorld(ctx, game) {
  const cam = game.camera;
  const shakeX = (Math.random() - 0.5) * game.effects.shake;
  const shakeY = (Math.random() - 0.5) * game.effects.shake;
  ctx.save();
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

  const left = cam.x - 40;
  const top = cam.y - 40;
  const right = cam.x + VIEW.width + 40;
  const bottom = cam.y + VIEW.height + 40;

  // Ground: grass base, park, beach, sea.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = COLORS.park;
  ctx.fillRect(30, 30, 470, 440);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(left, BEACH_Y, right - left, WATER_Y - BEACH_Y);
  const wave = Math.sin(game.time * 1.4) * 6;
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(left, WATER_Y + wave * 0.2, right - left, bottom - WATER_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, WATER_Y + wave);
  for (let x = left; x <= right; x += 60) ctx.lineTo(x, WATER_Y + Math.sin(game.time * 1.4 + x * 0.02) * 5);
  ctx.stroke();

  // Pier deck on the east edge.
  ctx.fillStyle = '#7d6a52';
  ctx.fillRect(PIER_X - 30, 560, WORLD.width - PIER_X + 30, 900);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 580; y < 1460; y += 44) ctx.fillRect(PIER_X - 30, y, WORLD.width - PIER_X + 30, 3);

  // Sidewalks then roads.
  ctx.fillStyle = COLORS.sidewalk;
  for (const ax of AVENUES_X) ctx.fillRect(ax - ROAD_HALF - 10, top, (ROAD_HALF + 10) * 2, BEACH_Y - top);
  for (const ay of AVENUES_Y) ctx.fillRect(left, ay - ROAD_HALF - 10, right - left, (ROAD_HALF + 10) * 2);
  ctx.fillStyle = COLORS.road;
  for (const ax of AVENUES_X) ctx.fillRect(ax - ROAD_HALF, top, ROAD_HALF * 2, BEACH_Y - top);
  for (const ay of AVENUES_Y) ctx.fillRect(left, ay - ROAD_HALF, right - left, ROAD_HALF * 2);
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const ax of AVENUES_X) { ctx.moveTo(ax, top); ctx.lineTo(ax, BEACH_Y); }
  for (const ay of AVENUES_Y) { ctx.moveTo(left, ay); ctx.lineTo(right, ay); }
  ctx.stroke();
  ctx.setLineDash([]);

  // Garage lot and hideout clearing.
  drawLot(ctx, GARAGE.x, GARAGE.y, '#c9a227', "VEGA'S GARAGE");
  drawLot(ctx, HIDEOUT.x, HIDEOUT.y, '#7d8c99', 'HIDEOUT');

  // Buildings (only those near the view).
  for (const b of game.city.buildings) {
    if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows in a grid; a few lit.
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(2, Math.floor(b.h / 22));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        const lit = ((cx * 7 + cy * 13 + Math.floor(b.seed * 40)) % 5) === 0;
        ctx.fillStyle = lit ? 'rgba(255,214,120,0.85)' : 'rgba(20,26,36,0.55)';
        ctx.fillRect(b.x + 10 + cx * 20, b.y + 10 + cy * 20, 9, 11);
      }
    }
    // Roughly one building in three carries a neon sign along its top edge:
    // a glowing backing strip, the word itself, and a soft halo spilling
    // onto the roof. The sign is chosen from the building's seed so it is
    // stable across frames and loads.
    const signIndex = Math.floor(b.seed * 89);
    if (signIndex % 3 === 0 && b.w >= 84) {
      const sign = NEON_SIGNS[signIndex % NEON_SIGNS.length];
      ctx.save();
      ctx.shadowColor = sign.color;
      ctx.shadowBlur = 13;
      ctx.fillStyle = sign.color;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(b.x + 8, b.y + 1, b.w - 16, 13);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sign.word, b.x + b.w / 2, b.y + 11);
      ctx.restore();
    }
  }

  // Dressing props: cargo stacks on the pier, umbrellas on the beach.
  for (const prop of game.city.props) {
    if (prop.x < left - 90 || prop.x > right + 90 || prop.y < top - 90 || prop.y > bottom + 90) continue;
    if (prop.kind === 'cargo') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(prop.x - prop.w / 2 + 4, prop.y - prop.h / 2 + 5, prop.w, prop.h);
      ctx.fillStyle = prop.color;
      ctx.fillRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
      ctx.beginPath();
      ctx.moveTo(prop.x - prop.w / 2, prop.y);
      ctx.lineTo(prop.x + prop.w / 2, prop.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(prop.x + 3, prop.y + 4, prop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = prop.color;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Trees and lamps.
  for (const t of game.city.trees) {
    if (t.x < left || t.x > right || t.y < top || t.y > bottom) continue;
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(t.x - 2.5, t.y - 2.5, 5, 5);
    ctx.fillStyle = t.palm ? '#57a05a' : '#2f6b35';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lamp posts, each with its pool of warm light on the asphalt.
  const glow = getLampGlow();
  for (const lamp of game.city.lamps) {
    if (lamp.x < left - 70 || lamp.x > right + 70 || lamp.y < top - 70 || lamp.y > bottom + 70) continue;
    ctx.drawImage(glow, lamp.x - 64, lamp.y - 64, 128, 128);
  }
  ctx.fillStyle = '#3c4046';
  for (const lamp of game.city.lamps) {
    if (lamp.x < left || lamp.x > right || lamp.y < top || lamp.y > bottom) continue;
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    ctx.fillStyle = '#ffd9a0';
    ctx.fillRect(lamp.x - 1, lamp.y - 1, 2, 2);
    ctx.fillStyle = '#3c4046';
  }

  // Skid marks under everything that moves.
  ctx.fillStyle = 'rgba(18,18,20,0.5)';
  for (const s of game.effects.skids) ctx.fillRect(s.x - 3, s.y - 3, 6, 6);

  // Cash crates scattered in the world.
  for (const crate of game.cashCrates) {
    const bob = Math.sin(game.time * 3 + crate.index) * 3;
    ctx.fillStyle = '#2e7d46';
    ctx.fillRect(crate.x - 13, crate.y - 13 + bob, 26, 26);
    ctx.fillStyle = '#8dff9a';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', crate.x, crate.y + 6 + bob);
  }

  // Mission props: smuggling crates on the pier.
  if (game.mission.phase === 'active' && game.mission.def && game.mission.def.id === 'pier-pressure') {
    for (const crate of game.mission.data.crates || []) {
      if (crate.dead) continue;
      ctx.fillStyle = '#8c5a2e';
      ctx.fillRect(crate.x - 17, crate.y - 17, 34, 34);
      ctx.strokeStyle = '#5e3c1d';
      ctx.lineWidth = 3;
      ctx.strokeRect(crate.x - 17, crate.y - 17, 34, 34);
    }
  }

  // Objective marker column of light.
  const objective = game.objectiveCache;
  if (objective && objective.x !== null && objective.x !== undefined) {
    const pulse = 0.6 + Math.sin(game.time * 5) * 0.25;
    ctx.fillStyle = `rgba(255,209,74,${pulse * 0.3})`;
    ctx.fillRect(objective.x - 16, objective.y - 130, 32, 130);
    ctx.fillStyle = '#ffd14a';
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 15 + Math.sin(game.time * 5) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', objective.x, objective.y + 6);
  }

  // Garage mission giver marker.
  if (game.mission.phase === 'idle' && game.missionIndex < 5) {
    ctx.fillStyle = '#ffd14a';
    ctx.beginPath();
    ctx.arc(GARAGE.x, GARAGE.y - 44 + Math.sin(game.time * 4) * 4, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G', GARAGE.x, GARAGE.y - 39 + Math.sin(game.time * 4) * 4);
  }

  // Vehicles, pedestrians, player.
  for (const v of game.vehicles) {
    if (v.x < left - 90 || v.x > right + 90 || v.y < top - 90 || v.y > bottom + 90) continue;
    drawVehicle(ctx, game, v);
  }
  for (const ped of game.pedestrians) {
    if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
    drawPedestrian(ctx, ped);
  }
  if (!game.player.vehicle) drawPlayer(ctx, game);
  drawMarisol(ctx, game);

  // Particles on top.
  for (const p of game.effects.particles) {
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Bullet tracer.
  if (game.combat.tracer) {
    const t = game.combat.tracer;
    ctx.strokeStyle = 'rgba(255,233,163,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }

  ctx.restore();

  // Dusk grade, in screen space: a cool violet wash from the top of the
  // frame, a warm band low over the harbour, and a soft vignette so the
  // centre of the action stays the brightest thing on screen.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, 'rgba(24,16,54,0.20)');
  sky.addColorStop(0.45, 'rgba(24,16,54,0)');
  sky.addColorStop(1, 'rgba(255,110,50,0.07)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const vignette = ctx.createRadialGradient(
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95,
  );
  vignette.addColorStop(0, 'rgba(8,6,20,0)');
  vignette.addColorStop(1, 'rgba(8,6,20,0.26)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawLot(ctx, x, y, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(x, y, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 80);
}

function drawVehicle(ctx, game, v) {
  const corners = vehicleCorners(v);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(corners[0].x + 4, corners[0].y + 6);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x + 4, corners[i].y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = v.dead ? '#2c2c30' : v.color;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  const hl = v.length / 2;
  const hw = v.width / 2;
  // Cabin and windshield.
  ctx.fillStyle = v.type === 'truck' || v.type === 'van' ? 'rgba(230,236,242,0.9)' : '#1d2733';
  if (v.type === 'truck') ctx.fillRect(hl * 0.15, -hw + 5, hl * 0.7, v.width - 10);
  else ctx.fillRect(-hl * 0.25, -hw + 6, hl * 0.75, v.width - 12);
  ctx.fillStyle = '#a8c8e0';
  if (v.type !== 'truck' && v.type !== 'van') ctx.fillRect(hl * 0.28, -hw + 7, 7, v.width - 14);
  // Police livery.
  if (v.type === 'police') {
    ctx.fillStyle = '#24406e';
    ctx.fillRect(-hl + 6, -hw, v.length - 12, 9);
    ctx.fillRect(-hl + 6, hw - 9, v.length - 12, 9);
    const flash = Math.floor(game.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4444' : '#3c6bff';
    ctx.fillRect(-8, -hw + 4, 16, 7);
    ctx.fillStyle = flash ? '#3c6bff' : '#ff4444';
    ctx.fillRect(-8, hw - 11, 16, 7);
  }
  if (v.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6, -8, 12, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (v.missionTag) {
    ctx.fillStyle = '#ffd14a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, -hw - 10);
  }
  // Wheels.
  ctx.fillStyle = '#14161a';
  for (const [wx, wy] of [[hl - 14, -hw - 2], [hl - 14, hw - 3], [-hl + 11, -hw - 2], [-hl + 11, hw - 3]]) {
    ctx.fillRect(wx, wy, 13, 5);
  }
  ctx.restore();
  // Damage bar for hurt vehicles.
  if (!v.dead && v.health < v.def.health) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(v.x - 22, v.y - v.width / 2 - 14, 44, 5);
    ctx.fillStyle = v.health / v.def.health > 0.4 ? '#8dff9a' : '#ff9d3c';
    ctx.fillRect(v.x - 22, v.y - v.width / 2 - 14, 44 * (v.health / v.def.health), 5);
  }
}

function drawPedestrian(ctx, ped) {
  if (ped.dead) {
    ctx.fillStyle = '#7a2e35';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 9, 5, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const bob = Math.sin(ped.legPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(ped.x + 2, ped.y + 3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob * 0.3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob * 0.3, 4.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const bob = p.moving ? Math.sin(game.time * 11) * 1.6 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + 4, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcf4d';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 4.6, 0, Math.PI * 2);
  ctx.fill();
  // Aim line and gun.
  if (game.screen === 'play') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(6, -2, 15, 4);
    ctx.restore();
  }
}

function drawMarisol(ctx, game) {
  // Marisol stands by her garage door.
  const x = GARAGE.x + 52;
  const y = GARAGE.y - 20;
  if (x < game.camera.x - 60 || x > game.camera.x + VIEW.width + 60) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 3, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8c2f4f';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Marisol Vega', x, y - 16);
}
