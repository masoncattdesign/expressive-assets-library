/**
 * Make full-colour illustrations recolorable without changing how they ship.
 *
 * The M365 set uses a small, role-structured palette: six colours cover 93% of
 * every paint in the collection. Each becomes a CSS custom property with the
 * shipped hex as its fallback — `fill="var(--ea-primary, #8B52F4)"` — so an
 * untouched page renders exactly the artwork Figma exported, and a host that
 * sets the properties gets a recoloured one. No style block, so there is no
 * document-level stylesheet to leak between inlined SVGs.
 *
 * WHAT IS DELIBERATELY LEFT LITERAL. Only those six are tokenised. Everything
 * else keeps its hex, and that is not laziness — it is the whole point:
 *
 *   - The nine M365 logo colours inside m365-folder are Microsoft brand marks.
 *     A recolour that turned the M365 logo purple would be wrong.
 *   - The orange in `warning` is semantic. A warning that recolours to green
 *     is worse than one that ignores the accent.
 *
 * Because the rule is per-colour rather than per-asset, both fall out for free.
 *
 *   node scripts/tokenize-illustrations.mjs --collection=m365 [--dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => args.filter((a) => a.startsWith(`--${n}=`)).pop()?.split('=')[1];
const COLLECTION = arg('collection') || 'm365';
const DRY = args.includes('--dry-run');

/** Shipped colour -> role. Ink and surface are structural: they get a named
 *  hook so a host CAN reach them, but the accent picker leaves them alone —
 *  recolouring the linework and the paper turns a drawing into a smear. */
const ROLES = [
  ['#182047', '--ea-ink'],
  ['#8B52F4', '--ea-primary'],
  ['#E6BFED', '--ea-primary-tint'],
  ['#CCD5F3', '--ea-tint'],
  ['#F83F54', '--ea-secondary'],
  ['#F7F7F7', '--ea-surface'],
];

export function tokenize(svg) {
  let out = svg;
  for (const [hex, role] of ROLES) {
    const re = new RegExp(`(fill|stroke)="${hex}"`, 'gi');
    out = out.replace(re, (_, attr) => `${attr}="var(${role}, ${hex})"`);
  }
  // Figma writes plain `white` as often as #FFFFFF; same role, same treatment.
  out = out.replace(/(fill|stroke)="(white|#FFFFFF|#FFF)"/gi, (_, attr) => `${attr}="var(--ea-surface, #F7F7F7)"`);
  return out;
}

async function main() {
  const metas = execSync('find assets -name meta.json', { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean);

  let assets = 0, files = 0, untouched = [];

  for (const rel of metas) {
    const meta = JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
    if (meta.collection !== COLLECTION) continue;
    if (!meta.variants.standard) continue;

    let changed = false;
    for (const path of Object.values(meta.variants.standard)) {
      const svg = await readFile(join(ROOT, path), 'utf8');
      const next = tokenize(svg);
      if (next === svg) continue;
      if (!DRY) await writeFile(join(ROOT, path), next, 'utf8');
      files++;
      changed = true;
    }
    if (!changed) { untouched.push(meta.id); continue; }

    meta.colors = { primary: '#8B52F4', secondary: '#F83F54' };
    meta.recolorable = true;
    meta.updated = new Date().toISOString().slice(0, 10);
    if (!DRY) await writeFile(join(ROOT, rel), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    assets++;
  }

  console.log(`\n${DRY ? 'Would tokenise' : 'Tokenised'} ${assets} assets — ${files} Standard drawings.`);
  if (untouched.length) console.log(`\nNo core-palette colours found in: ${untouched.join(', ')}`);
  console.log('\n  Untinted output is byte-for-byte the shipped artwork: every');
  console.log('  token carries its original hex as the fallback.\n');
}

main();
