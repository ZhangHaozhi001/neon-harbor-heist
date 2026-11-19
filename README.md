# neon-harbor-heist

[![gta6-01 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/ZhangHaozhi001/neon-harbor-heist/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/ZhangHaozhi001/neon-harbor-heist/reward.svg)](https://make.fun/bounty/gta6-01)

**Neon Harbor Heist** is a top-down 2D open-world crime game set in Port Marlowe, an original harbour city of palm avenues, a southern beach, an east pier and a north-west park. You arrive with nothing; garage owner **Marisol Vega** has five jobs that will make you rich — or get you busted.

Everything is hand-written vanilla JavaScript on a single canvas: no libraries, no build step, no network requests, and all sound is synthesised live with WebAudio. The city, characters, vehicles, names and story are entirely original.

## What's in the city

- **On foot and driving** — walk, sprint, and drive any car with acceleration, braking/reverse, steering, collision damage and sparks; the camera follows smoothly and looks ahead with speed.
- **Living traffic** — AI cars follow the avenue grid, turn at intersections, slow for obstacles; pedestrians stroll the sidewalks, flee from gunfire and crashes, and go down if hit.
- **Car theft** — any vehicle can be taken with E; drivers bail out and run, and a witnessed theft raises your wanted level.
- **Wanted system & police** — 0–5 stars for theft, hit-and-runs, gunfire and mission crimes. Patrol cars spawn to match your stars, ram and box you in, and fill a **BUSTED** meter if they pin you while slow or on foot. Break line of sight and the heat cools star by star. Zero health is **WASTED**; both endings restart.
- **Combat** — a pistol with magazine/reserve ammo, reloads, muzzle flash and tracers; vehicles smoke, burn and die, and officers can be dropped.
- **Five story jobs** for Marisol Vega, unlocked in order, each with intro/outro dialogue, an objective marker and live distance: *First Wheels*, *Harbor Run*, *Hot Property*, *Pier Pressure*, and *The Marlowe Job* — plus 10 cash crates hidden around town.
- **Full HUD** — minimap with roads, traffic, police and mission markers, wanted stars, cash, health, ammo and speed, objective text and event toasts.
- **Title screen, pause, saves** — progress (cash, jobs, crates, position) persists in `localStorage`; Continue from the title screen.
- **First-run guide** — a five-step in-game coach (walk, steal, drive, meet Marisol, take the job) with an on-screen card and a gold edge arrow that always points at your next target; it retires itself once your first job starts. The city is lit for dusk: lamp glow, neon rooftop signs, beach umbrellas and pier cargo.

## Controls

| Keys | Action |
| --- | --- |
| WASD / Arrow keys | Move / drive |
| E | Enter / exit / steal vehicle, talk to Marisol |
| Shift | Sprint |
| Mouse | Aim |
| Click / Space | Shoot (on foot) / handbrake (in a car: hold to swing tight turns) |
| R | Reload |
| Esc / P | Pause |
| M | Mute |

## Run it locally

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No install, no build — `game/` is plain static files.

---

Built for the [make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
