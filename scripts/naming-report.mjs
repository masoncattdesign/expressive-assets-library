/**
 * Measure the library's ids against Bridge's naming scheme, and say what it
 * would cost to conform.
 *
 * Bridge's rule, from core/naming/normalize.ts in the Bridge repo, approved
 * 2026-07-23 and described there as the single source of truth:
 *
 *   A SEGMENT is conjoined-lowercase, with no internal separators.
 *   `appTile` -> `apptile`, `in-content` -> `incontent`.
 *   A TOKEN id joins segments with `-` and becomes a CSS custom property.
 *   A KEY id joins segments with `.` and is authoring-only.
 *
 * The reason is not taste. Because a segment never contains `-`, splitting a
 * token id on `-` recovers its segments exactly, which is what lets Bridge
 * import tokens back out of CSS. A hyphen inside a segment breaks that round
 * trip. Our ids are dotted keys, so today they are legal as keys; they stop
 * being legal the moment an id has to become a token — which is exactly what
 * the anatomy addressing proposal does.
 *
 * This reports rather than renames. Renaming ids is a contract break and
 * Mason's call.
 *
 *   node scripts/naming-report.mjs [--write]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');

/** Bridge's conjoinSegment, ported verbatim. */
const conjoin = (seg) => {
  const paren = seg.match(/^\(([^)]*)\)$/);
  if (paren) return '(' + paren[1].replace(/-/g, '') .toLowerCase() + ')';
  return seg.replace(/-/g, '').toLowerCase();
};

/** Bridge's pathPattern, which validates a dotted key. */
const LEGAL = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;

const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));

const rows = manifest.assets.map((a) => {
  const segs = a.id.split('.');
  const conjoined = segs.map(conjoin).join('.');
  const split = segs.flatMap((s) => s.split('-')).map(conjoin).join('.');
  return { id: a.id, name: a.name, collection: a.collection, conjoined, split };
});

const illegal = rows.filter((r) => !LEGAL.test(r.id));
const changed = rows.filter((r) => r.conjoined !== r.id);

/** Two different assets landing on one id is the only thing that makes a
 *  scheme unusable rather than merely ugly. */
function collisions(key) {
  const seen = new Map();
  const hits = [];
  for (const r of rows) {
    const v = r[key];
    if (seen.has(v)) hits.push([seen.get(v), r.id, v]);
    else seen.set(v, r.id);
  }
  return hits;
}

const cA = collisions('conjoined');
const cB = collisions('split');

const byCollection = {};
for (const r of changed) byCollection[r.collection] = (byCollection[r.collection] || 0) + 1;

console.log(`${rows.length} assets`);
console.log(`${illegal.length} fail Bridge's key pattern today (${Math.round(100 * illegal.length / rows.length)}%)`);
console.log(`${changed.length} would change under conjoining\n`);
console.log('by collection:');
for (const [k, v] of Object.entries(byCollection).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(14)} ${v}`);
}
console.log(`\nA — conjoin the segment:   ${cA.length} collisions`);
cA.slice(0, 8).forEach(([a, b, v]) => console.log(`     ${a} + ${b} -> ${v}`));
console.log(`B — split on the hyphen:   ${cB.length} collisions`);
cB.slice(0, 8).forEach(([a, b, v]) => console.log(`     ${a} + ${b} -> ${v}`));

console.log('\nA sample of what changes:');
for (const r of changed.slice(0, 10)) {
  console.log(`  ${r.id.padEnd(34)} A: ${r.conjoined.padEnd(32)} B: ${r.split}`);
}

if (WRITE) {
  const out = ['id\tname\tcollection\tconjoined\tsplit']
    .concat(changed.map((r) => [r.id, r.name, r.collection, r.conjoined, r.split].join('\t')));
  await writeFile(join(ROOT, 'naming-report.tsv'), out.join('\n') + '\n', 'utf8');
  console.log(`\nWrote naming-report.tsv — ${changed.length} rows.`);
}
