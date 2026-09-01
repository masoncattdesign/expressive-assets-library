/**
 * Put the library's own System Icons into the Gallery sidebar.
 *
 * The nav used six shapes drawn by hand in app.js, which is a small hypocrisy
 * for a tool whose whole argument is that the library is the source. These are
 * real assets now, named here by id so the choice is reviewable and so
 * swapping one for a hand-drawn replacement later is a one-line edit.
 *
 * 24px artwork only, because the nav injects into a fixed `viewBox="0 0 24 24"`
 * and the 20px drawings are a different artboard, not a smaller rendering of
 * the same one. Filled for the group rows and Outline for the collections
 * under them, so the hierarchy is carried by the artwork as well as by indent.
 *
 *   node scripts/inline-nav-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PICKS = [
  // Keyed group-first, because collection ids collide across groups: both
  // Product Icons and Illustrations own one called `product`.
  ['all',                       'system.grid',         'filled',  'Everything, evenly'],
  ['product-icons',             'system.apps',         'filled',  'A group of app tiles'],
  ['product-icons:product',     'system.app-generic',  'outline', 'One app'],
  ['product-icons:file',        'system.document',     'outline', 'A file'],
  ['product-icons:third-party', 'system.puzzle-piece', 'outline', 'Something from outside that plugs in'],
  ['product-icons:wip',         'system.wrench',       'outline', 'Still being made'],
  ['system-icons',              'system.shapes',       'filled',  'Glyphs, which is what a system icon is'],
  ['illustrations',             'system.image',        'filled',  'A picture'],
  ['illustrations:oobe',        'system.rocket',       'outline', 'First run'],
  ['illustrations:m365',        'system.briefcase',    'outline', 'Work'],
  ['illustrations:product',     'system.image',        'outline', 'A picture, one level down'],
];

const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
const byId = new Map(manifest.assets.map((a) => [a.id, a]));

/** The inner markup of a 24px drawing, with its own fills dropped so the nav's
 *  `fill="currentColor"` on the wrapper is what decides the colour. */
async function inner(assetId, theme) {
  const asset = byId.get(assetId);
  if (!asset) throw new Error(`${assetId} is not in the manifest`);
  const path = asset.variants?.[theme]?.['24'];
  if (!path) throw new Error(`${assetId} has no ${theme} at 24`);

  const svg = await readFile(join(ROOT, path), 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (box !== '0 0 24 24') throw new Error(`${assetId} ${theme} is ${box}, not 0 0 24 24`);

  return svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s(fill|class)="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const lines = [];
for (const [key, id, theme, why] of PICKS) {
  lines.push(`  '${key}': '${await inner(id, theme)}', // ${id} ${theme} — ${why}`);
}

const block =
  '/* The sidebar marks are assets, not drawings kept in this file. Regenerate\n' +
  ' * with `node scripts/inline-nav-icons.mjs` after changing the picks there. */\n' +
  'const NAV_ICONS = {\n' + lines.join('\n') + '\n};';

const appPath = join(ROOT, 'docs/app.js');
let app = await readFile(appPath, 'utf8');
const start = app.indexOf('const NAV_ICONS = {');
const end = app.indexOf('};', start) + 2;
if (start < 0) throw new Error('NAV_ICONS not found in docs/app.js');
app = app.slice(0, start) + block + app.slice(end);
await writeFile(appPath, app, 'utf8');

console.log(`Inlined ${PICKS.length} system icons into docs/app.js.`);
