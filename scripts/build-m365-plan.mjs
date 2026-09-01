/**
 * Build the import plan for the replacement M365 illustrations.
 *
 * The section is 40 plain frames at 512, with no components, no variants and
 * no style axis, so there is nothing to survey into a plan: the node map is
 * read off the file and recorded in scripts/sources/m365-nodes.json.
 *
 * Names are the only handle in that file and they are not unique — two frames
 * are both called Chat and hold different drawings. Ids are therefore assigned
 * per node in the map rather than derived from the name, or one illustration
 * would silently overwrite the other.
 *
 * This replaces the previous 28. Those were 160px with Outline and Filled
 * derived here from Standard; the replacements are 512px Standard only, and
 * whether they get derived styles at all is a separate decision from importing
 * them.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE_KEY = 'l752WyMxGqlvG5g8zkOaxm';

const map = JSON.parse(await readFile(join(ROOT, 'scripts/sources/m365-nodes.json'), 'utf8'));
const SIZE = map.size;

const assets = map.illustrations.map((i) => ({
  id: `m365.${i.id}`,
  name: i.name,
  collection: 'm365',
  type: 'illustration',
  nodeId: i.nodeId,
  sizes: [SIZE],
  renders: { standard: { [SIZE]: i.nodeId } },
}));

const seen = new Map();
for (const a of assets) {
  if (seen.has(a.id)) throw new Error(`duplicate id ${a.id}`);
  seen.set(a.id, a);
}

const plan = {
  fileKey: FILE_KEY,
  page: 'M365 Brand',
  sectionNodeId: map.sectionId,
  generated: new Date().toISOString().slice(0, 10),
  note:
    `${assets.length} illustrations at ${SIZE}px, Standard only. Replaces the previous 28. ` +
    'Ids come from the recorded node map rather than from frame names, because the names ' +
    'collide.',
  warnings: Object.entries(map.collisions).map(([k, v]) => `${k}: ${v}`),
  assets,
};

await writeFile(join(ROOT, 'figma-m365-plan.json'), JSON.stringify(plan, null, 2) + '\n', 'utf8');
console.log(`Wrote figma-m365-plan.json — ${assets.length} illustrations at ${SIZE}px.`);
for (const w of plan.warnings) console.log('  ·', w.split('.')[0]);
