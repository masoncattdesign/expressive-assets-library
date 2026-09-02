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
 *   _site/CHANGELOG.md  <- for the Figma plugin's About page
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
  // The Figma plugin reads this to write the About page's "Recently" section.
  // It lives at the repo root, so without this it is only reachable from the
  // GitHub raw source and the published-site source silently omits the section.
  await cp(join(ROOT, 'CHANGELOG.md'), join(OUT, 'CHANGELOG.md'));

  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));

  /* No sprite bundles.
     Bundling every SVG into per-collection JSON worked at 38 scalable assets.
     It collapses the moment artwork is drawn per size: 46 product icons are
     828 separate drawings, which bundled to 2.3 MB — and the library is headed
     for 500+. The site fetches individual SVGs on demand instead, gated by the
     same IntersectionObserver that already decides what to paint, so only the
     ~50 drawings actually on screen are ever requested. They are small, they
     cache, and HTTP/2 multiplexes them. It also deletes a build step. */

  // Stops GitHub Pages from running the content through Jekyll.
  await writeFile(join(OUT, '.nojekyll'), '', 'utf8');

  const drawings = manifest.assets.reduce(
    (sum, a) => sum + Object.values(a.variants).reduce((n, d) => n + Object.keys(d).length, 0),
    0
  );
  console.log(`Built _site/ — ${manifest.total} assets, ${drawings} drawings, fetched on demand.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
