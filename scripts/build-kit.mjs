#!/usr/bin/env node
/**
 * Build a standalone Customizer kit to hand to someone outside the repo.
 *
 * Ada wants to configure the Customizer, add styles and work on asset
 * anatomy. She does not want a git clone, a toolchain, or 88MB of artwork,
 * and she should not have to ask before changing anything.
 *
 * So the kit is a folder that runs from a double-click, holds unmodified
 * copies of the pages, and carries only the artwork the Customizer can
 * actually use: assets with a `standard` variant. Outline and Filled are
 * drawn in currentColor and this pipeline works by reading source colors,
 * so there is nothing in them for it to read; System Icons have no standard
 * at all and are the bulk of the library. Dropping both takes it from 15,474
 * drawings to about 2,200.
 *
 * Nothing here is edited on the way out. A copy that has been "helpfully
 * adjusted" is a copy whose changes cannot come back.
 *
 * Run: npm run kit          -> ../expressive-assets-customizer-kit
 *      npm run kit -- <dir>
 */
import { readFile, writeFile, mkdir, rm, cp, chmod } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statsFor, fillMarks } from './lib/stats.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2]
  ? process.argv[2].replace(/^~/, process.env.HOME)
  : join(ROOT, '..', 'expressive-assets-customizer-kit');

/* Every page the kit's pages link to, so the folder has no dead links. The
   first pass shipped the Customizer without styles.css, which it needs, and
   left four links pointing at pages that were not there. A kit you hand
   someone should not 404 on its own navigation. */
const PAGES = [
  'customizer.html', 'customizer-v1.html', 'styles.css',
  'index.html', 'app.js',
  'about.html', 'system-map.html', 'asset-anatomy.html', 'anatomy-pilot.html',
  'doc.css', 'chrome.js',
];

/* About and the System Map carry marks that state the library's counts. Filled
   from THIS folder's manifest rather than the repo's, because a kit holding 389
   assets that says 3,280 is the drift the marks exist to stop. */
const MARKED = ['about.html', 'system-map.html'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const f of PAGES) await cp(join(ROOT, 'docs', f), join(OUT, f));

const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
const kept = [];
let copied = 0;

for (const a of manifest.assets) {
  if (!a.variants?.standard) continue;
  const variants = { standard: a.variants.standard };
  for (const rel of Object.values(variants.standard)) {
    await mkdir(join(OUT, dirname(rel)), { recursive: true });
    await cp(join(ROOT, rel), join(OUT, rel));
    copied++;
  }
  kept.push({ ...a, variants, themes: ['standard'] });
}

/* The groups block is trimmed to what survived, so the counts a consumer
   reads are the counts of what is actually in the folder. */
const groups = manifest.groups
  .map((g) => ({
    ...g,
    collections: g.collections
      .map((c) => ({ ...c, count: kept.filter((a) => a.collection === c.id).length }))
      .filter((c) => c.count > 0),
  }))
  .filter((g) => g.collections.length);

const kitManifest = { ...manifest, total: kept.length, groups, assets: kept };
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(kitManifest, null, 2) + '\n');

const { stats, blocks } = statsFor(kitManifest, { head: 'kit' });
for (const f of MARKED) {
  const path = join(OUT, f);
  await writeFile(path, fillMarks(await readFile(path, 'utf8'), stats, blocks), 'utf8');
}

/* macOS blocks fetch() on file://, so the library row needs a server. One
   double-click is a lower bar than one terminal command. */
const launcher = `#!/bin/bash
# Double-click this. It serves the folder and opens the Customizer.
# If macOS refuses because it came from the internet: right-click, Open.
cd "$(dirname "$0")"
PORT=8777
python3 -m http.server $PORT >/dev/null 2>&1 &
SERVER=$!
sleep 1
open "http://localhost:$PORT/customizer.html"
echo "Serving on http://localhost:$PORT — close this window to stop."
wait $SERVER
`;
await writeFile(join(OUT, 'START-HERE.command'), launcher);
await chmod(join(OUT, 'START-HERE.command'), 0o755);

const readme = `# Customizer kit

A working copy of the Customizer, the Gallery and the anatomy documents, with
the artwork the Customizer can actually use. Change anything in here. Nothing
is shared, nothing is watched, and there is no build step.

## Running it

**Double-click \`START-HERE.command\`.** It serves the folder and opens the
Customizer. Close the terminal window it opens to stop.

If macOS refuses because the file came from the internet, right-click it and
choose Open, then Open again.

You can also just double-click \`customizer.html\`. Everything works except the
library row, because a browser will not let a page opened from your disk read
files next to it. The built-in sample icons still load, so for tuning styles
that is enough.

## What is here

| | |
|---|---|
| \`customizer.html\` | The tool. One file, no dependencies. |
| \`index.html\` | The Gallery, for browsing what you can swap in. |
| \`asset-anatomy.html\` | How the parts inside an icon are named and addressed. |
| \`anatomy-pilot.html\` | The twelve icons the vocabulary was worked out against. |
| \`about.html\`, \`system-map.html\` | Orientation. Their counts describe this folder, not the full library. |
| \`manifest.json\` | ${kept.length} assets, trimmed to Standard. |
| \`assets/\` | ${copied} drawings. |

Only Standard artwork is here. Outline and Filled are drawn in \`currentColor\`
and the Customizer works by reading the colors in the source and re-filling
them, so there is nothing in those for it to read. System Icons have no
Standard at all, which is why 2,891 of them are absent.

## Adding a style

Two places in \`customizer.html\`, both findable by searching:

1. **The button.** Search \`data-mode="acrylic"\` for the row of style cards.
   Copy one, change the \`data-mode\`, the \`setMode('...')\` call and the
   \`<span class="mode-name">\`.

2. **The function.** Search \`function applyAcrylic\`. Every style is one
   function taking an SVG string and returning an SVG string. The eight that
   exist are \`applyFlat\`, \`applyOutline\`, \`applyRoles\`, \`applyTinted\`,
   \`applySoft\`, \`applySoftRoles\`, \`applyDichromic\` and \`applyAcrylic\`. Copy
   the closest one and work from there.

A style's controls are declared in \`RESET_KEYS\`, which is also what the reset
arrow reads.

The pipeline knows nothing about where a drawing came from, so a style that
works on a sample works on the whole library.

## Sending changes back

Send Mason the changed \`customizer.html\`, or just the new function and button
if that is easier. Do not send the whole folder back: \`assets/\` and
\`manifest.json\` are generated from the library and will be regenerated anyway.

Every page here is an unmodified copy apart from the counts in About and the
System Map, so a diff against his will show only what you changed.

Built ${new Date().toISOString().slice(0, 10)} from ${manifest.total} assets.
`;
await writeFile(join(OUT, 'README.md'), readme);

console.log(`Kit at ${OUT}`);
console.log(`  ${kept.length} assets, ${copied} drawings, standard only.`);
