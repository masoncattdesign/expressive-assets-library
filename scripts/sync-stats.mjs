#!/usr/bin/env node
/**
 * Write the library's own numbers into the document pages.
 *
 * About and the System Map used to state their counts in prose, typed by hand
 * on the day they were written. By 3 September they claimed 3,129 assets in 6
 * collections when the library held 3,234 in 8, said File Icons ship Filled
 * when Filled had been deleted, and one tile read "0 published" on a page whose
 * own paragraph said everything is published. A number that has to be
 * remembered is a number that will be wrong.
 *
 * So the pages carry marks instead of numbers, and this fills them in:
 *
 *   <span data-stat="assets">3,280</span>          one value
 *   <!-- stat:collections --> … <!-- /stat -->     one generated block
 *
 * Anything with a mark is derived and must not be hand-edited; anything
 * without one is editorial and this script will not touch it. That line is
 * deliberate. The About table is generated whole, because collection, count
 * and styles are all facts. The System Map table keeps its hand-written note
 * per collection and only its counts are filled, because a sentence saying
 * what a collection is for cannot be derived, and a new collection should have
 * to be described by a person before it appears there.
 *
 * The computation itself lives in scripts/lib/stats.mjs, because the
 * Customizer kit fills the same marks from its own smaller manifest.
 *
 * Run: npm run stats          write the numbers
 *      npm run stats:check    exit 1 if any are stale, and say which
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statsFor, fillMarks } from './lib/stats.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const PAGES = ['docs/about.html', 'docs/system-map.html'];

let head = 'unknown';
try {
  head = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim();
} catch {
  /* A tarball with no .git is not a reason to fail; the mark just says so. */
}

const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
const { stats, blocks } = statsFor(manifest, { head });

const unknown = [];
const stale = [];
let changed = 0;

for (const rel of PAGES) {
  const path = join(ROOT, rel);
  const before = await readFile(path, 'utf8');
  const after = fillMarks(before, stats, blocks, (msg, isStale) =>
    (isStale ? stale : unknown).push(`${rel}: ${msg}`)
  );
  if (after !== before) { changed++; if (!CHECK) await writeFile(path, after, 'utf8'); }
}

if (unknown.length) {
  console.error('\nMarks with no matching stat:');
  for (const u of unknown) console.error(`  ${u}`);
  console.error('\nEither the mark is misspelled or the stat needs adding to scripts/lib/stats.mjs.');
  process.exit(1);
}

if (CHECK) {
  if (stale.length) {
    console.error(`\n✗ ${stale.length} stale value${stale.length === 1 ? '' : 's'} in the documents:\n`);
    for (const s of stale) console.error(`  ${s}`);
    console.error('\nRun: npm run stats\n');
    process.exit(1);
  }
  console.log(`✓ Document counts match manifest.json — ${stats.assets} assets, ${stats.collections} collections.`);
} else {
  console.log(
    changed
      ? `✓ Updated ${changed} page${changed === 1 ? '' : 's'} — ${stats.assets} assets, ${stats.collections} collections, ${stats.drawings} drawings at ${head}.`
      : `✓ Already current — ${stats.assets} assets, ${stats.collections} collections.`
  );
}
