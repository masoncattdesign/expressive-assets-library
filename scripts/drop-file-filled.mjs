/**
 * Remove Filled from File Icons.
 *
 * Filled here was never authored. It was derived from Standard by luminance,
 * as an inverse of Outline, to square a matrix that did not need squaring: a
 * file icon is a plate with marks on it, and a solid plate with the marks cut
 * out is not a style anyone asked for. Nothing upstream has one.
 *
 * Standard is the Figma import and stays. Outline is derived and stays,
 * because it is the one that earns its place.
 */
import { readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'assets/icons/file');
const DRY = process.argv.includes('--dry');

let removedFiles = 0;
let touchedMeta = 0;

for (const entry of (await readdir(DIR, { withFileTypes: true })).filter((e) => e.isDirectory())) {
  const dir = join(DIR, entry.name);

  for (const file of (await readdir(dir)).filter((f) => f.startsWith('filled-') && f.endsWith('.svg'))) {
    if (!DRY) await rm(join(dir, file));
    removedFiles++;
  }

  const path = join(dir, 'meta.json');
  const meta = JSON.parse(await readFile(path, 'utf8'));

  meta.themes = (meta.themes || []).filter((t) => t !== 'filled');
  if (meta.variants) delete meta.variants.filled;
  if (meta.generated) {
    const kept = meta.generated.filter((c) => !c.startsWith('filled:'));
    if (kept.length) meta.generated = kept;
    else delete meta.generated;
  }
  meta.notes =
    'Imported from Figma. Standard is the shipped artwork and keeps its baked colours. ' +
    'Outline is derived from it by luminance: paper knocks out, ink is the body, drawn in ' +
    'currentColor so it takes an accent. There is no Filled — none exists upstream, and a ' +
    'solid plate with the marks cut out of it is not a style a file icon needs.';

  if (!DRY) await writeFile(path, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  touchedMeta++;
}

console.log(`${DRY ? 'Would remove' : 'Removed'} ${removedFiles} filled drawings across ${touchedMeta} file icons.`);
