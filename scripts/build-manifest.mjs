#!/usr/bin/env node
/**
 * Scans assets/ and writes manifest.json at the repo root.
 *
 * manifest.json is the public contract: anything that consumes this library —
 * the browsing site, a build plugin, an internal package — reads that file and
 * never walks the asset tree itself. It is committed so changes show up in code
 * review as a readable diff.
 *
 * Run: npm run manifest
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const COLLECTIONS = [
  {
    type: 'icon',
    label: 'Icons',
    dir: 'assets/icons',
    categories: [
      { id: 'system', label: 'System Icons' },
      { id: 'product', label: 'Product Icons' },
      { id: 'file', label: 'File Icons' },
    ],
  },
  {
    type: 'illustration',
    label: 'Illustrations',
    dir: 'assets/illustrations',
    categories: [
      { id: 'windows', label: 'Windows Illustrations' },
      { id: 'fluent', label: 'Fluent Illustrations' },
      { id: 'product', label: 'Product Illustrations' },
    ],
  },
];

const exists = (p) => stat(p).then(() => true, () => false);

export async function collectAssets() {
  const assets = [];
  for (const collection of COLLECTIONS) {
    for (const category of collection.categories) {
      const catDir = join(ROOT, collection.dir, category.id);
      if (!(await exists(catDir))) continue;
      const entries = await readdir(catDir, { withFileTypes: true });
      for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        const metaPath = join(catDir, entry.name, 'meta.json');
        if (!(await exists(metaPath))) {
          throw new Error(`Missing meta.json for ${collection.dir}/${category.id}/${entry.name}`);
        }
        const meta = JSON.parse(await readFile(metaPath, 'utf8'));
        assets.push({ ...meta, _dir: `${collection.dir}/${category.id}/${entry.name}` });
      }
    }
  }
  return assets;
}

/** Library order: icons before illustrations, categories in sidebar order,
 *  then alphabetical by display name. Consumers that want a different order
 *  can re-sort; this one exists so the browsing grid reads like the sidebar. */
function order(asset) {
  const c = COLLECTIONS.findIndex((col) => col.type === asset.type);
  const cat = COLLECTIONS[c]?.categories.findIndex((x) => x.id === asset.category) ?? 0;
  return [c, cat];
}

export function buildManifest(assets) {
  const clean = assets
    .map(({ _dir, ...rest }) => rest)
    .sort((a, b) => {
      const [ac, acat] = order(a);
      const [bc, bcat] = order(b);
      return ac - bc || acat - bcat || a.name.localeCompare(b.name);
    });

  return {
    $schema: './schema/asset.schema.json',
    name: 'Expressive Assets',
    description: 'Icon and illustration library for Windows Design Systems.',
    generator: 'scripts/build-manifest.mjs',
    total: clean.length,
    collections: COLLECTIONS.map((c) => ({
      type: c.type,
      label: c.label,
      categories: c.categories.map((cat) => ({
        id: cat.id,
        label: cat.label,
        count: clean.filter((a) => a.type === c.type && a.category === cat.id).length,
      })),
    })),
    assets: clean,
  };
}

async function main() {
  const assets = await collectAssets();
  const manifest = buildManifest(assets);
  await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Wrote manifest.json — ${manifest.total} assets.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
