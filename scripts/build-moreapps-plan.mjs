#!/usr/bin/env node
/**
 * Build the import plan for the "More App Icons" board.
 *
 * This board is shaped differently from the App Icons page the collection was
 * first filled from. That page is one component set of 64px tiles, one drawing
 * each. This one is a frame per app holding four size symbols — 16, 24, 32 and
 * 48 — drawn at each size rather than scaled. That is the library's central
 * claim, so this artwork is better source than what it sits beside, and none
 * of it lands with a `generated` flag.
 *
 * Which apps to import and which to skip is a decision, not a computation, so
 * it lives in scripts/sources/moreapps-nodes.json where it can be read in a
 * review. This script only checks the decision still holds against the current
 * manifest and writes the plan out.
 *
 * Run: npm run figma:plan:moreapps
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const map = JSON.parse(await readFile(join(ROOT, 'scripts/sources/moreapps-nodes.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));

/* An id that already exists anywhere in the library is a collision, not a
   gap. The point of this import is to fill gaps, so a collision is a bug in
   the node map rather than something to resolve at import time. */
const taken = new Map(manifest.assets.map((a) => [a.id, a.collection]));
const collisions = [];

const assets = map.assets.map((a) => {
  const id = `app.${a.id}`;
  if (taken.has(id)) collisions.push(`${id} already exists in ${taken.get(id)}`);
  return {
    id,
    name: a.name,
    collection: 'app',
    type: 'icon',
    status: a.status || 'published',
    nodeId: Object.values(a.nodes)[0],
    sizes: Object.keys(a.nodes).map(Number).sort((x, y) => x - y),
    renders: { standard: a.nodes },
  };
});

if (collisions.length) {
  console.error('Refusing to write the plan. The node map claims these are new:\n');
  for (const c of collisions) console.error(`  ${c}`);
  console.error('\nFix scripts/sources/moreapps-nodes.json rather than the plan.');
  process.exit(1);
}

const drawings = assets.reduce((n, a) => n + Object.keys(a.renders.standard).length, 0);
const deprecated = assets.filter((a) => a.status === 'deprecated');

const plan = {
  fileKey: map.fileKey,
  page: 'More App Icons',
  sectionNodeId: map.boardNodeId,
  generated: new Date().toISOString().slice(0, 10),
  note: `${assets.length} Windows app icons at 16, 24, 32 and 48, drawn at each size rather than scaled. Standard only. ${deprecated.length} land as deprecated: they sit in a board section labeled Retired-Sunsetting-Depricated, and the drawing being real does not make the app current.`,
  warnings: [
    `Branch import. fileKey ${map.fileKey} is a branch of ${map.branchOf}; the board does not exist on main.`,
    'Several frames carry a 20 that is hidden in Figma. Hidden means not ready, so 20 is not imported and the matrix will show the gap.',
    'These are the first app icons drawn per size. The 32 already in the collection are one 64px tile each with 16 through 48 scaled down from it, so the collection now holds two kinds of provenance until those are redrawn.',
  ],
  skipped: map.skipped,
  assets,
};

await writeFile(join(ROOT, 'figma-moreapps-plan.json'), JSON.stringify(plan, null, 2) + '\n', 'utf8');
console.log(`Wrote figma-moreapps-plan.json — ${assets.length} assets, ${drawings} drawings, ${map.skipped.length} skipped by decision.`);
if (deprecated.length) console.log(`  deprecated: ${deprecated.map((a) => a.id).join(', ')}`);
