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
 *   <span data-stat="assets">3,234</span>          one value
 *   <!-- stat:collections --> … <!-- /stat --> one generated block
 *
 * Anything with a mark is derived and must not be hand-edited; anything
 * without one is editorial and this script will not touch it. That line is
 * deliberate. The About table is generated whole, because collection, count
 * and styles are all facts. The System Map table keeps its hand-written note
 * per collection and only its counts are filled, because a sentence saying
 * what a collection is for cannot be derived, and a new collection should have
 * to be described by a person before it appears there.
 *
 * Run: npm run stats          write the numbers
 *      npm run stats:check    exit 1 if any are stale, and say which
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const PAGES = ['docs/about.html', 'docs/system-map.html'];

const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
const assets = manifest.assets;

const n = (v) => v.toLocaleString('en-US');
const pct = (part, whole) => `${Math.round((part / whole) * 100)}%`;
const title = (s) => s[0].toUpperCase() + s.slice(1);

/* Counting drawings means counting variant cells, not sizes: an asset with
   three themes at six sizes is eighteen drawings, and `sizes` is the union
   across themes rather than a per-theme count. */
const cells = (a) => Object.values(a.variants).reduce((m, bySize) => m + Object.keys(bySize).length, 0);

const drawings = assets.reduce((m, a) => m + cells(a), 0);
const generated = assets.reduce((m, a) => m + (a.generated?.length || 0), 0);
const themes = [...new Set(assets.flatMap((a) => Object.keys(a.variants)))];
const status = (s) => assets.filter((a) => a.status === s).length;

/* Bridge's grammar does not allow a hyphen inside a name segment. The
   collection prefix is not a name segment, so the test is on what follows the
   first dot. */
const hyphenIds = assets.filter((a) => a.id.split('.').slice(1).join('.').includes('-')).length;

const collections = manifest.groups.flatMap((g) => g.collections);
const themesOf = (id) => {
  const t = [...new Set(assets.filter((a) => a.collection === id).flatMap((a) => Object.keys(a.variants)))];
  const order = ['standard', 'outline', 'filled'];
  return t.sort((x, y) => order.indexOf(x) - order.indexOf(y)).map(title).join(', ');
};

let head = 'unknown';
try {
  head = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim();
} catch {
  /* A tarball with no .git is not a reason to fail; the mark just says so. */
}

const now = new Date();
const long = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const short = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const stats = {
  assets: n(manifest.total),
  collections: String(collections.length),
  groups: String(manifest.groups.length),
  drawings: n(drawings),
  generated: n(generated),
  themes: String(themes.length),
  retintable: n(assets.filter((a) => a.recolorable).length),
  published: n(status('published')),
  draft: n(status('draft')),
  deprecated: n(status('deprecated')),
  'keywords-pct': pct(assets.filter((a) => a.keywords?.length).length, assets.length),
  'descriptions-pct': pct(assets.filter((a) => a.description).length, assets.length),
  'hyphen-ids': n(hyphenIds),
  head,
  date: long,
  'date-short': short,
};
for (const c of collections) {
  stats[`count:${c.id}`] = n(c.count);
  stats[`label:${c.id}`] = c.label;
  stats[`themes:${c.id}`] = themesOf(c.id);
}

/* Generated blocks. Each returns the full inner HTML for its fence. */
const blocks = {
  /* Largest first: the shape of the library is more legible than its
     alphabet, and the reader is looking for the big ones. */
  collections: (indent) =>
    [...collections]
      .sort((a, b) => b.count - a.count)
      .map((c) => `${indent}<tr><td>${c.label}</td><td class="num">${n(c.count)}</td><td>${themesOf(c.id)}</td></tr>`)
      .join('\n'),
};

const unknown = [];
const stale = [];

function fill(html, file) {
  // <span data-stat="assets">…</span>
  html = html.replace(
    /(<(\w+)(?=[\s>])[^>]*\bdata-stat="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (whole, open, tag, key, inner, close) => {
      if (!(key in stats)) { unknown.push(`${file}: data-stat="${key}"`); return whole; }
      if (inner !== stats[key]) stale.push(`${file}: ${key} is "${inner}", should be "${stats[key]}"`);
      return open + stats[key] + close;
    }
  );

  // <!-- stat:collections --> … <!-- /stat -->
  html = html.replace(
    /([ \t]*)(<!-- stat:([\w-]+) -->\n)([\s\S]*?)([ \t]*<!-- \/stat -->)/g,
    (whole, indent, openTag, key, inner, closeTag) => {
      if (!(key in blocks)) { unknown.push(`${file}: stat block "${key}"`); return whole; }
      const built = blocks[key](indent) + '\n';
      if (inner !== built) stale.push(`${file}: block "${key}" is out of date`);
      return indent + openTag + built + closeTag;
    }
  );
  return html;
}

let changed = 0;
for (const rel of PAGES) {
  const path = join(ROOT, rel);
  const before = await readFile(path, 'utf8');
  const after = fill(before, rel);
  if (after !== before) { changed++; if (!CHECK) await writeFile(path, after, 'utf8'); }
}

if (unknown.length) {
  console.error('\nMarks with no matching stat:');
  for (const u of unknown) console.error(`  ${u}`);
  console.error('\nEither the mark is misspelled or the stat needs adding to sync-stats.mjs.');
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
