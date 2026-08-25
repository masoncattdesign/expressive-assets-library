#!/usr/bin/env node
/**
 * Assembles the deployable site into _site/.
 *
 * The site lives in docs/ but needs assets/ and manifest.json to sit alongside
 * it at the same URL root. Rather than duplicating the asset tree inside docs/
 * (two copies in git, guaranteed to drift), the deploy step composes them:
 *
 *   _site/            <- docs/*
 *   _site/assets/     <- assets/
 *   _site/manifest.json
 *   _site/sprite.json <- every SVG inlined, so the grid renders in one request
 *
 * _site/ is gitignored. GitHub Pages publishes it from the workflow.
 *
 * Run: npm run build
 */
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  await cp(join(ROOT, 'docs'), OUT, { recursive: true });
  await cp(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
  await cp(join(ROOT, 'manifest.json'), join(OUT, 'manifest.json'));

  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));

  /* One sprite PER COLLECTION rather than one for the whole library.
     Inlining every SVG into a single file is great at 38 assets and terrible at
     500+: a couple of megabytes that blocks first paint and pins the lot in
     memory whether or not you ever open that collection. Chunked this way the
     browser fetches only what the sidebar selection actually needs. */
  await mkdir(join(OUT, 'sprites'), { recursive: true });

  const report = [];
  for (const group of manifest.groups) {
    for (const collection of group.collections) {
      const members = manifest.assets.filter((a) => a.type === group.type && a.collection === collection.id);
      const sprite = {};
      for (const asset of members) {
        sprite[asset.id] = {};
        for (const [theme, rel] of Object.entries(asset.variants)) {
          sprite[asset.id][theme] = (await readFile(join(ROOT, rel), 'utf8')).trim();
        }
      }
      const body = JSON.stringify(sprite);
      await writeFile(join(OUT, collection.sprite), body, 'utf8');
      report.push({ name: collection.sprite, count: members.length, kb: Buffer.byteLength(body) / 1024 });
    }
  }

  // Stops GitHub Pages from running the content through Jekyll.
  await writeFile(join(OUT, '.nojekyll'), '', 'utf8');

  const totalKb = report.reduce((sum, r) => sum + r.kb, 0);
  console.log(`Built _site/ — ${manifest.total} assets in ${report.length} sprites, ${totalKb.toFixed(1)} KB total:`);
  for (const r of report.filter((r) => r.count)) {
    console.log(`  ${r.name.padEnd(34)} ${String(r.count).padStart(4)} assets  ${r.kb.toFixed(1).padStart(7)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
