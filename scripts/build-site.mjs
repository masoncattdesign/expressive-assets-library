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

  // Inline every variant so the browser makes one request instead of ~110.
  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  const sprite = {};
  for (const asset of manifest.assets) {
    sprite[asset.id] = {};
    for (const [theme, rel] of Object.entries(asset.variants)) {
      sprite[asset.id][theme] = (await readFile(join(ROOT, rel), 'utf8')).trim();
    }
  }
  await writeFile(join(OUT, 'sprite.json'), JSON.stringify(sprite), 'utf8');

  // Stops GitHub Pages from running the content through Jekyll.
  await writeFile(join(OUT, '.nojekyll'), '', 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(sprite));
  console.log(`Built _site/ — ${manifest.total} assets, sprite ${(bytes / 1024).toFixed(1)} KB.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
