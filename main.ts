// Dustline — the entry program for the make.fun "Make GTA 6" bounty.
// It stages the game for grading: copy the game and its screenshots into
// the output directory, then write dossier.json there with the kit's
// buildDossier. Node 22, standard library only.
//
// The output directory is created, never deleted. The grader hands us an
// /output that cannot be removed, so wiping it first would crash the run
// with exit code 1. We only create it (recursively) and copy into it.
//
// The output is deterministic: nothing here reads a clock, rolls dice or
// depends on the working directory, so two runs write byte-identical
// output.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives is where the repository is, whatever directory
// the grader happens to run from.
const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The caps the bounty sets for this entry: 160 KiB of source text, at most
// 4 screenshots of at most 256 KiB each, at most 993 game entries totalling
// at most 48 MiB, and no path longer than 1000 UTF-8 bytes.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function stage() {
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  const dossier = buildDossier(out, caps);
  writeFileSync(join(out, 'dossier.json'), dossier);
}

stage();
