// Wickwatch's hand-in (Node 22, standard library only). The game itself is game/: static files a
// desktop browser plays offline. This program copies game/ and the screenshots beside it to the
// output directory and writes dossier.json there with make.fun's own library, byte for byte what
// the bounty's gate rebuilds. Nothing here depends on the clock or the machine, so every run of it
// writes the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts      (the grader uses /output)
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The gate's caps, as its gate.json gives them: only text_max_bytes shapes the dossier, the rest refuse. */
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn(): void {
  const shots = join(repo, 'screenshots');
  if (!existsSync(shots) || readdirSync(shots).filter((name) => !name.startsWith('.')).length < 3) {
    throw new Error('screenshots/ needs 3 or 4 images of the game');
  }
  mkdirSync(output, { recursive: true });
  cpSync(join(repo, 'game'), join(output, 'game'), { recursive: true });
  cpSync(shots, join(output, 'screenshots'), { recursive: true });
  writeFileSync(join(output, 'dossier.json'), buildDossier(output, GATE_CAPS));
}

handIn();
