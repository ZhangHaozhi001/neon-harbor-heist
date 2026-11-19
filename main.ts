// Neon Harbor Heist — a top-down open-world crime game set in the original
// harbour city of Port Marlowe: on-foot and driving play, traffic and
// pedestrians, car theft, a five-star wanted system with police pursuit,
// pistol combat, five story jobs for garage owner Marisol Vega, a full HUD
// with minimap, synthesised WebAudio sound and localStorage saves.
// The entry metadata below is checked by validateEntryManifest before the
// dossier is written, so a malformed handover fails loudly instead of
// shipping a broken summary to the judges.

const ENTRY_TITLE = 'Neon Harbor Heist';
const ENTRY_SUMMARY =
  'Top-down 2D open-world crime game in the fictional city of Port Marlowe: ' +
  'drive and steal cars, outrun a five-star police response, and run five ' +
  'story jobs for garage owner Marisol Vega. Vanilla JavaScript on canvas, ' +
  'no libraries, no build step, no network requests.';
const REQUIRED_SCREENSHOTS = ['1-cover.jpg', '2-drive.jpg', '3-chase.jpg', '4-mission.jpg'];

/** Fail fast when the handover is incomplete: every required screenshot must be present. */
function validateEntryManifest(screenshotNames: string[]): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED_SCREENSHOTS) {
    if (!screenshotNames.includes(name)) problems.push(`missing screenshot: ${name}`);
  }
  if (!ENTRY_TITLE.trim()) problems.push('entry title is empty');
  if (ENTRY_SUMMARY.length < 40) problems.push('entry summary is too short');
  return problems;
}
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const manifestProblems = validateEntryManifest(
  existsSync(join(here, 'screenshots')) ? readdirSync(join(here, 'screenshots')) : [],
);
if (manifestProblems.length > 0) {
  console.error(`[${ENTRY_TITLE}] manifest check failed:`);
  for (const problem of manifestProblems) console.error(` - ${problem}`);
  process.exitCode = 1;
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
