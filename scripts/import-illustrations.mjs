#!/usr/bin/env node
/**
 * Imports a flat folder of illustration SVGs into a collection.
 *
 *   node scripts/import-illustrations.mjs --from="~/Downloads/OOBE" \
 *                                         --collection=oobe [--dry-run]
 *
 * Expects `<root>/<Display Name>.svg`. Deliberately general rather than
 * OOBE-specific — illustration sets arrive as a folder of exports more often
 * than not, and the next one should not need a new script.
 *
 * Illustrations are not icons, and this treats them differently:
 *
 *  - ONE theme. They are full-color scenes, not glyphs with monochrome
 *    reductions. `themes: ["standard"]` and nothing else. The browser already
 *    grays out styles an asset was not authored for.
 *  - NOT recolorable. The color is the artwork. The accent picker is disabled
 *    and says why, rather than pretending to work.
 *  - Colors are read out of the file's own gradients, not invented.
 *
 * It also reports embedded rasters. An SVG with a bitmap inside does not scale
 * like vector artwork, and that is worth knowing before someone puts it on a
 * 4K onboarding screen.
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const has = (f) => args.includes(f);

const FROM = (arg('from') || '').replace(/^~/, homedir());
const COLLECTION = arg('collection');
const OWNER = arg('owner') || '@windows-design-systems';
const DRY = has('--dry-run');

const exists = (p) => stat(p).then(() => true, () => false);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const namespaceIds = (svg, prefix) =>
  svg
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
    .replace(/xlink:href="#([^"]+)"/g, (_, id) => `xlink:href="#${prefix}-${id}"`);

function prepare(svg, { prefix, label }) {
  let out = svg.trim().replace(/^﻿/, '').replace(/<\?xml[^>]*\?>\s*/g, '');
  out = namespaceIds(out, prefix);
  if (!out.includes('role="img"')) out = out.replace('<svg ', '<svg role="img" ');
  if (!out.includes('aria-label=')) {
    out = out.replace('<svg ', `<svg aria-label="${label.replace(/"/g, '&quot;')}" `);
  }
  return out + '\n';
}

/** Read the artwork's own palette rather than inventing one. */
function extractColors(svg) {
  const found = [...svg.matchAll(/(?:stop-color|fill)="(#[0-9A-Fa-f]{3,8})"/g)]
    .map((m) => m[1].toUpperCase())
    .filter((c) => c.length === 7 && !['#FFFFFF', '#000000'].includes(c));
  const unique = [...new Set(found)];
  return { primary: unique[0] || '#0078D4', secondary: unique[unique.length - 1] || unique[0] || '#8764B8' };
}

/**
 * Sizes an illustration reads at. Authored dimension first, plus the halving
 * steps above 128 — a scene keeps its composition down to about a third of its
 * authored size, below which the detail that makes it an illustration is gone.
 */
function sizesFor(authored) {
  const steps = [authored, 256, 192, 128].filter((n) => n <= authored && n >= Math.round(authored / 3));
  return [...new Set(steps)].sort((a, b) => a - b);
}

async function main() {
  if (!COLLECTION) {
    console.error('\nPass --collection=<id>, and add it to GROUPS in build-manifest.mjs\n');
    process.exit(1);
  }
  if (!FROM || !(await exists(FROM))) {
    console.error(`\nPass --from=<folder of .svg files>. Got: ${FROM || '(nothing)'}\n`);
    process.exit(1);
  }

  const files = (await readdir(FROM)).filter((f) => f.toLowerCase().endsWith('.svg')).sort();
  if (!files.length) {
    console.error(`\nNo .svg files directly under ${FROM}\n`);
    process.exit(1);
  }

  const plan = [];
  for (const file of files) {
    const svg = await readFile(join(FROM, file), 'utf8');
    const name = basename(file, '.svg');
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const authored = vb ? Math.round(Math.max(Number(vb[1]), Number(vb[2]))) : 256;
    plan.push({
      file,
      name,
      id: `${COLLECTION}.${slug(name)}`,
      svg,
      authored,
      rasters: (svg.match(/data:image\//g) || []).length,
      bytes: Buffer.byteLength(svg),
    });
  }

  const dupes = plan.map((p) => p.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length) {
    console.error(`\n✗ Duplicate ids: ${[...new Set(dupes)].join(', ')}. Rename before importing.\n`);
    process.exit(1);
  }

  const withRasters = plan.filter((p) => p.rasters);
  const total = plan.reduce((n, p) => n + p.bytes, 0);

  console.log(`\n${plan.length} illustrations for the "${COLLECTION}" collection`);
  console.log(`  authored at ${[...new Set(plan.map((p) => p.authored))].sort((a, b) => a - b).join(', ')}px`);
  console.log(`  ${(total / 1024).toFixed(0)} KB total\n`);

  if (withRasters.length) {
    console.log('EMBEDDED RASTERS — these will not scale like vector artwork');
    for (const p of withRasters.sort((a, b) => b.bytes - a.bytes)) {
      console.log(`  ${p.name.padEnd(24)} ${p.rasters} image${p.rasters === 1 ? '' : 's'}, ${(p.bytes / 1024).toFixed(0)} KB`);
    }
    console.log('');
  }

  if (DRY) {
    console.log('Names:');
    for (const p of plan) console.log(`  ${p.name.padEnd(24)} -> ${p.id}`);
    console.log('\nDry run — nothing written.\n');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const outBase = `assets/illustrations/${COLLECTION}`;
  let written = 0;

  for (const item of plan) {
    const name = item.id.split('.').slice(1).join('.');
    const outDir = `${outBase}/${name}`;
    await mkdir(join(ROOT, outDir), { recursive: true });

    const rel = `${outDir}/standard-any.svg`;
    await writeFile(
      join(ROOT, rel),
      prepare(item.svg, { prefix: `${COLLECTION}-${name}`, label: item.name }),
      'utf8'
    );

    const meta = {
      id: item.id,
      name: item.name,
      keywords: [...new Set(slug(item.name).split('-').filter((w) => w.length > 1))],
      type: 'illustration',
      collection: COLLECTION,
      status: 'draft',
      themes: ['standard'],
      sizes: sizesFor(item.authored),
      colors: extractColors(item.svg),
      // The color IS the artwork. Nothing here has tint hooks, and the browser
      // reads that back at runtime anyway — this just states it in the data.
      recolorable: false,
      variants: { standard: { any: rel } },
      owner: OWNER,
      version: '1.0.0',
      updated: today,
      ...(item.rasters
        ? {
            notes: `Contains ${item.rasters} embedded raster image${item.rasters === 1 ? '' : 's'}. It will not scale like vector artwork — check it at the largest size you intend to ship before relying on it.`,
          }
        : {}),
    };

    await writeFile(join(ROOT, outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    written++;
  }

  console.log(`✓ Imported ${written} illustrations into ${outBase}/`);
  console.log(`
  All land as status: "draft" with keywords from the filename. Illustrations
  benefit more than icons from a written description — a scene is harder to
  find by name than a glyph is.

  Next: npm run manifest && npm run validate
`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
