/**
 * Record what was received and what was made here, then publish accordingly.
 *
 * Until now every asset was `draft`, which was honest but uninformative: the
 * 2,891 Fluent system icons are exactly the artwork Microsoft ships, and
 * calling them drafts said nothing true about them.
 *
 * `status` is a property of the asset and provenance is a property of a
 * variant, so the two are separated rather than conflated. Status says the
 * artwork is real and settled. `generated` says which style-by-size cells were
 * produced here instead of received, and a published asset can carry them.
 *
 * Provenance by collection, which is a matter of record rather than a guess:
 *
 *   system         Fluent artwork, unmodified but for a currentColor rewrite.
 *                  Nothing generated.
 *   product icons  Figma artwork in all three styles. The only generated cells
 *                  are the ones fill-product-gaps.mjs already recorded.
 *   file icons     Standard is the Figma import. Outline and Filled were
 *                  derived here by luminance, at every size.
 *   illustrations  Standard is the shipped Figma artwork. Any other style was
 *                  derived here. OOBE and Product illustrations only have
 *                  Standard, so they have nothing generated.
 *
 * Ids are not frozen by this. The naming grammar is still open, and 2,665 ids
 * carry a hyphen inside a name segment which Bridge's scheme does not allow.
 * Published here means the drawing is real, not that its id is final.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from './build-manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

const exists = (p) => stat(p).then(() => true, () => false);

/** Which cells in this asset were made here. */
function generatedCells(meta) {
  // Already recorded by the script that made them.
  if (meta.collection !== 'file' && meta.type !== 'illustration') {
    return [...(meta.generated || meta.placeholders || [])].sort();
  }

  const derived = meta.type === 'illustration'
    ? Object.keys(meta.variants || {}).filter((s) => s !== 'standard')
    : ['outline', 'filled'];

  const cells = new Set(meta.generated || meta.placeholders || []);
  for (const style of derived) {
    for (const size of Object.keys(meta.variants?.[style] || {})) {
      cells.add(`${style}:${size}`);
    }
  }
  return [...cells].sort();
}

async function main() {
  let touched = 0;
  const tally = {};

  for (const group of GROUPS) {
    for (const collection of group.collections) {
      const dir = join(ROOT, group.dir, collection.id);
      if (!(await exists(dir))) continue;
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries.filter((e) => e.isDirectory())) {
        const path = join(dir, entry.name, 'meta.json');
        if (!(await exists(path))) continue;
        const meta = JSON.parse(await readFile(path, 'utf8'));

        const cells = generatedCells(meta);
        const before = JSON.stringify([meta.status, meta.generated || meta.placeholders || []]);

        meta.status = 'published';
        delete meta.placeholders;
        if (cells.length) meta.generated = cells;
        else delete meta.generated;

        const key = `${meta.type}/${meta.collection}`;
        tally[key] = tally[key] || { assets: 0, withGenerated: 0, cells: 0 };
        tally[key].assets++;
        if (cells.length) { tally[key].withGenerated++; tally[key].cells += cells.length; }

        if (JSON.stringify([meta.status, meta.generated || []]) === before) continue;
        touched++;
        if (!DRY) await writeFile(path, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      }
    }
  }

  for (const [key, t] of Object.entries(tally)) {
    console.log(
      `${key.padEnd(24)} ${String(t.assets).padStart(5)} published, ` +
      `${String(t.withGenerated).padStart(4)} carry generated cells (${t.cells})`
    );
  }
  console.log(`\n${touched} meta files ${DRY ? 'would change' : 'updated'}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
