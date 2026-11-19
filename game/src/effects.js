// Transient visual effects: particles (sparks, smoke, muzzle flash, pickup
// glints), skid marks left by hard cornering and braking, floating damage
// smoke on hurt vehicles, and a camera shake value the renderer applies.
// Pools are fixed-size so nothing allocates during play.

const MAX_PARTICLES = 420;
const MAX_SKIDS = 300;

export function createEffects() {
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 0, fade: true });
  }
  const skids = [];
  let shake = 0;

  function spawn(x, y, vx, vy, life, size, color, gravity) {
    for (const p of particles) {
      if (p.active) continue;
      p.active = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life; p.size = size; p.color = color; p.gravity = gravity || 0;
      return;
    }
  }

  return {
    particles,
    skids,
    get shake() { return shake; },
    addShake(amount) { shake = Math.min(14, shake + amount); },
    sparks(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 200;
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.3, 2, Math.random() < 0.5 ? '#ffd76a' : '#ff9d3c', 300);
      }
    },
    smoke(x, y, big) {
      spawn(x, y, (Math.random() - 0.5) * 24, -30 - Math.random() * 30, 0.7 + Math.random() * 0.6, big ? 10 : 6, 'rgba(70,70,78,0.55)', -20);
    },
    fire(x, y) {
      spawn(x, y, (Math.random() - 0.5) * 30, -50 - Math.random() * 40, 0.3 + Math.random() * 0.3, 7, Math.random() < 0.5 ? '#ff7b2e' : '#ffb03a', -60);
    },
    muzzle(x, y, angle) {
      spawn(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.07, 6, '#ffe9a3', 0);
    },
    glint(x, y) {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        spawn(x, y, Math.cos(a) * 55, Math.sin(a) * 55, 0.35, 2.5, '#8dff9a', 0);
      }
    },
    bloodPuff(x, y) {
      for (let i = 0; i < 6; i += 1) {
        const a = Math.random() * Math.PI * 2;
        spawn(x, y, Math.cos(a) * 50, Math.sin(a) * 50, 0.3, 3, '#b03a48', 120);
      }
    },
    addSkid(x, y) {
      skids.push({ x, y, life: 6 });
      if (skids.length > MAX_SKIDS) skids.shift();
    },
    update(dt) {
      shake = Math.max(0, shake - dt * 26);
      for (const p of particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
    },
  };
}
