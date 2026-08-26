#!/usr/bin/env node
/**
 * Scans assets/ and writes manifest.json at the repo root.
 *
 * manifest.json is the public contract: anything that consumes this library —
 * the browsing site, a build plugin, an internal package — reads that file and
 * never walks the asset tree itself. It is committed so changes show up in code
 * review as a readable diff.
 *
 * Vocabulary: a GROUP is icons vs illustrations. A COLLECTION is the sub-bucket
 * within a group (system, product, file, …) and is what an asset's `collection`
 * field names.
 *
 * Run: npm run manifest
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const GROUPS = [
  {
    type: 'icon',
    label: 'Icons',
    dir: 'assets/icons',
    collections: [
      { id: 'product', label: 'Product Icons' },
      { id: 'system', label: 'System Icons' },
      { id: 'file', label: 'File Icons' },
      { id: 'vscode', label: 'VS Code Icons' },
    ],
  },
  {
    type: 'illustration',
    label: 'Illustrations',
    dir: 'assets/illustrations',
    collections: [
      { id: 'oobe', label: 'OOBE Illustrations' },
      { id: 'windows', label: 'Windows Illustrations' },
      { id: 'fluent', label: 'Fluent Illustrations' },
      { id: 'product', label: 'Product Illustrations' },
    ],
  },
];


const exists = (p) => stat(p).then(() => true, () => false);

export async function collectAssets() {
  const assets = [];
  for (const group of GROUPS) {
    for (const collection of group.collections) {
      const dir = join(ROOT, group.dir, collection.id);
      if (!(await exists(dir))) continue;
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        const metaPath = join(dir, entry.name, 'meta.json');
        if (!(await exists(metaPath))) {
          throw new Error(`Missing meta.json for ${group.dir}/${collection.id}/${entry.name}`);
        }
        const meta = JSON.parse(await readFile(metaPath, 'utf8'));
        assets.push({ ...meta, _dir: `${group.dir}/${collection.id}/${entry.name}` });
      }
    }
  }
  return assets;
}

/** Library order: icons before illustrations, collections in sidebar order,
 *  then alphabetical by display name. Consumers that want a different order can
 *  re-sort; this one exists so the browsing grid reads like the sidebar. */
function order(asset) {
  const g = GROUPS.findIndex((x) => x.type === asset.type);
  const c = GROUPS[g]?.collections.findIndex((x) => x.id === asset.collection) ?? 0;
  return [g, c];
}

export function buildManifest(assets) {
  const clean = assets
    .map(({ _dir, ...rest }) => rest)
    .sort((a, b) => {
      const [ag, ac] = order(a);
      const [bg, bc] = order(b);
      return ag - bg || ac - bc || a.name.localeCompare(b.name);
    });

  return {
    $schema: './schema/asset.schema.json',
    name: 'Expressive Assets',
    description: 'Icon and illustration library for Windows Design Systems.',
    generator: 'scripts/build-manifest.mjs',
    total: clean.length,
    groups: GROUPS.map((g) => ({
      type: g.type,
      label: g.label,
      collections: g.collections.map((c) => ({
        id: c.id,
        label: c.label,
        count: clean.filter((a) => a.type === g.type && a.collection === c.id).length,
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
