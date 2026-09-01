/**
 * Build the import plan for the App Icons section.
 *
 * The page is one component set with a single `App` property, so every icon is
 * a variant rather than a set of its own. No Size property, no Theme property:
 * one drawing each, at 64.
 *
 * Four variants are not icons and are excluded by name in the node map: an
 * empty tile, two placeholders sharing the value `App36`, and a hidden `App26`
 * parked outside the frame. A component set cannot normally hold two variants
 * with the same value, so the duplicate is a conflict rather than a decision.
 *
 * Eight names already exist in the collection from the Product icons page,
 * where they are 16–48px marks in three styles. These are 64px app tiles: the
 * same product, different artwork. They land as `<name>-app` beside the
 * originals rather than over them, so both can be looked at before either is
 * retired.
 *
 * Store ships two drawings, Light and Dark, with the theme baked into the
 * variant name rather than expressed as a property. The library has no
 * light/dark artwork axis, so rather than invent one for a single icon both
 * are imported as separate assets and the question is left open.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE_KEY = 'l752WyMxGqlvG5g8zkOaxm';
const SIZE = 64;

const map = JSON.parse(await readFile(join(ROOT, 'scripts/sources/appicons-nodes.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
const existing = new Set(
  manifest.assets.filter((a) => a.collection === 'product').map((a) => a.id)
);

/** PascalCase is a name, not an id. Split it before slugging or AdminCenter
 *  becomes `admincenter` and stops being two words forever. */
const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
const slug = (s) => words(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const assets = [];
const renamed = [];

for (const [name, nodeId] of Object.entries(map.variants)) {
  let base = slug(name);
  let display = words(name);

  // Store DarkTheme / Store LightTheme
  const store = /^store (dark|light)theme$/.exec(base);
  if (store) {
    base = `store-${store[1]}`;
    display = `Store (${store[1] === 'dark' ? 'Dark' : 'Light'})`;
  }

  let id = `product.${base}`;
  if (existing.has(id)) {
    id = `product.${base}-app`;
    display = `${display} (app)`;
    renamed.push(`${name}: product.${base} is taken, imported as ${id}`);
  }

  assets.push({
    id,
    name: display,
    collection: 'product',
    type: 'icon',
    nodeId,
    sizes: [SIZE],
    renders: { standard: { [SIZE]: nodeId } },
  });
}

assets.sort((a, b) => a.name.localeCompare(b.name));

const plan = {
  fileKey: FILE_KEY,
  page: 'App Icons',
  sectionNodeId: map.sectionId,
  componentSetId: map.componentSetId,
  generated: new Date().toISOString().slice(0, 10),
  note:
    'Windows app tiles, 64px, Standard only. Outline, Filled and the smaller ' +
    'sizes are derived after import. Four non-icon variants are excluded; see ' +
    'scripts/sources/appicons-nodes.json for which and why.',
  warnings: renamed,
  excluded: map.excluded,
  assets,
};

await writeFile(join(ROOT, 'figma-appicons-plan.json'), JSON.stringify(plan, null, 2) + '\n', 'utf8');
console.log(`Wrote figma-appicons-plan.json — ${assets.length} icons at ${SIZE}px.`);
for (const r of renamed) console.log('  ·', r);
