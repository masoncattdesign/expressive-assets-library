#!/usr/bin/env node
/**
 * Imports a folder export from Figma into the library.
 *
 * Expects the layout Figma produces when you export a page of component sets:
 *
 *   <root>/<Asset Name>/Size=24, Theme=Color.svg
 *   <root>/<Asset Name>/Size=24, Theme=Regular.svg
 *   ...
 *
 * Usage:
 *   node scripts/import-folder.mjs --from="~/Downloads/Product Icons" \
 *                                  --collection=product [--dry-run]
 *
 * Three things it handles that a naive copy would not:
 *
 *  1. PER-SIZE ARTWORK. Windows product icons are redrawn at each size — the
 *     16px Excel icon is a different drawing from the 48px one. Every size is
 *     kept and recorded under variants[theme][size], not collapsed to one file.
 *
 *  2. FIGMA'S DEDUPE SUFFIXES. The exporter appends "-1", "-4" and so on when
 *     names collide across a page ("Size=24, Theme=Color-4.svg"). Those are an
 *     artifact of the export, not a variant, and get stripped.
 *
 *  3. ID COLLISIONS. Figma names gradients and clip paths things like
 *     "paint0_radial_5634_483". Inline forty of those into one page and the
 *     duplicates resolve to whichever came first. Every id is namespaced.
 *
 * Monochrome themes are rewritten to currentColor so they can take a Windows
 * accent. The Color theme keeps its brand gradients untouched — and the browser
 * reads that back at runtime, so the accent picker is offered only where it can
 * actually do something.
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
const COLLECTION = arg('collection') || 'product';
const TYPE = arg('type') || (['windows', 'fluent'].includes(COLLECTION) ? 'illustration' : 'icon');
const DRY = has('--dry-run');

/* Figma's theme names on the left, this library's on the right. Figma calls
   the full-colour base "Color"; here it is "standard", because it is the base
   the other two reduce from. */
const THEME_MAP = { Color: 'standard', Regular: 'outline', Filled: 'mono' };

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const exists = (p) => stat(p).then(() => true, () => false);

/**
 * "Size=24, Theme=Color-4.svg" -> { size: 24, theme: 'standard' }
 *
 * Real exports are messier than the convention suggests. Seen in the wild:
 * Figma's collision suffixes ("Color-4"), a stray leading space
 * ("Theme= Filled"), and theme names outside the library's three
 * ("Theme=Flat"). The first two are noise and get normalised; the third is
 * information, so it comes back labelled rather than silently dropped.
 */
function parseVariantFile(filename) {
  const name = basename(filename, '.svg');
  const size = Number(name.match(/Size=\s*(\d+)/)?.[1]);
  const rawTheme = name.match(/Theme=\s*([A-Za-z]+)/)?.[1];

  if (!Number.isInteger(size) || !rawTheme) return { error: 'unparseable' };
  const theme = THEME_MAP[rawTheme];
  if (!theme) return { error: 'unmapped-theme', rawTheme };
  return { size, theme };
}

/** Namespace every id so inlined SVGs cannot clobber each other's gradients. */
function namespaceIds(svg, prefix) {
  return svg
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
    .replace(/xlink:href="#([^"]+)"/g, (_, id) => `xlink:href="#${prefix}-${id}"`);
}

/** Make an exported SVG safe to inline and, where monochrome, tintable. */
function prepare(svg, { prefix, label, theme }) {
  let out = svg.trim().replace(/<\?xml[^>]*\?>\s*/g, '');

  out = namespaceIds(out, prefix);

  // Monochrome themes come out of Figma as flat black. currentColor lets a host
  // page — or the accent picker — set it without touching the file.
  if (theme !== 'standard') {
    out = out.replace(/(fill|stroke)="(black|#000|#000000)"/gi, '$1="currentColor"');
  }

  // Every asset has to be announceable; the validator enforces it.
  if (!out.includes('role="img"')) out = out.replace('<svg ', '<svg role="img" ');
  if (!out.includes('aria-label=')) {
    out = out.replace('<svg ', `<svg aria-label="${label.replace(/"/g, '&quot;')}" `);
  }
  return out + '\n';
}

/** Pull real brand colors out of the color drawing rather than inventing them. */
function extractColors(svg) {
  const found = [...svg.matchAll(/(?:stop-color|fill)="(#[0-9A-Fa-f]{6})"/g)]
    .map((m) => m[1].toUpperCase())
    .filter((c) => c !== '#FFFFFF' && c !== '#000000');
  const unique = [...new Set(found)];
  return {
    primary: unique[0] || '#0078D4',
    secondary: unique[unique.length - 1] || unique[0] || '#8764B8',
  };
}

async function main() {
  if (!FROM || !(await exists(FROM))) {
    console.error(`\nPass --from=<folder>. Got: ${FROM || '(nothing)'}\n`);
    process.exit(1);
  }

  const entries = await readdir(FROM, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith('__') && !e.name.startsWith('.'));

  if (!folders.length) {
    console.error(`\nNo asset folders under ${FROM}.`);
    console.error('Expected <root>/<Asset Name>/Size=24, Theme=Color.svg\n');
    process.exit(1);
  }

  const plan = [];
  const problems = [];
  const unmapped = [];

  for (const folder of folders.sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = join(FROM, folder.name);
    const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.svg'));

    /* theme -> size -> source filename. Later files win, which is fine: the
       dedupe suffixes are the same drawing exported twice. */
    const drawings = {};
    for (const file of files) {
      const parsed = parseVariantFile(file);
      if (parsed.error === 'unmapped-theme') {
        unmapped.push({ folder: folder.name, theme: parsed.rawTheme, file });
        continue;
      }
      if (parsed.error) {
        problems.push(`${folder.name}/${file}: does not parse as Size=N, Theme=X`);
        continue;
      }
      (drawings[parsed.theme] ||= {})[parsed.size] = file;
    }

    const themes = Object.keys(drawings).filter((t) => Object.keys(drawings[t]).length);
    if (!themes.length) {
      problems.push(`${folder.name}: no usable SVGs`);
      continue;
    }

    const sizes = [...new Set(themes.flatMap((t) => Object.keys(drawings[t]).map(Number)))].sort((a, b) => a - b);

    plan.push({ name: folder.name, dir, id: `${COLLECTION}.${slug(folder.name)}`, drawings, themes, sizes });
  }

  /* Report before writing anything. */
  const full = plan.filter((p) => p.themes.length === 3 && p.sizes.length >= 6).length;
  console.log(`\n${plan.length} assets found in ${FROM}`);
  console.log(`  ${full} with all three themes and six or more sizes`);
  console.log(`  ${plan.length - full} partial\n`);

  const partial = plan.filter((p) => p.themes.length < 3 || p.sizes.length < 6);
  if (partial.length) {
    console.log('PARTIAL COVERAGE (imported as-is — the metadata records what exists)');
    for (const p of partial) {
      console.log(`  ${p.name.padEnd(26)} themes: ${p.themes.join(', ').padEnd(24)} sizes: ${p.sizes.join(', ')}`);
    }
    console.log('');
  }

  const dupes = plan.map((p) => p.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length) {
    console.error(`✗ Duplicate ids: ${[...new Set(dupes)].join(', ')}`);
    console.error('  Two folder names slugify the same. Rename one before importing.\n');
    process.exit(1);
  }

  if (unmapped.length) {
    const byTheme = unmapped.reduce((acc, u) => {
      (acc[u.theme] ||= new Set()).add(u.folder);
      return acc;
    }, {});
    console.log('THEMES THIS LIBRARY DOES NOT DEFINE — skipped, not lost');
    for (const [theme, folders] of Object.entries(byTheme)) {
      console.log(`  Theme=${theme.padEnd(10)} ${[...folders].join(', ')}`);
    }
    console.log('  Add them to THEME_MAP here and to the schema\'s theme enum to import them.\n');
  }

  if (problems.length) {
    console.log(`UNPARSEABLE FILES (${problems.length})`);
    for (const p of problems.slice(0, 10)) console.log(`  ${p}`);
    if (problems.length > 10) console.log(`  …and ${problems.length - 10} more`);
    console.log('');
  }

  if (DRY) {
    console.log('Dry run — nothing written.\n');
    return;
  }

  /* Write. */
  const today = new Date().toISOString().slice(0, 10);
  const outBase = `assets/${TYPE}s/${COLLECTION}`;
  let written = 0;

  for (const asset of plan) {
    const name = asset.id.split('.').slice(1).join('.');
    const outDir = `${outBase}/${name}`;
    await mkdir(join(ROOT, outDir), { recursive: true });

    const variants = {};
    let colorSample = '';

    for (const theme of asset.themes) {
      variants[theme] = {};
      for (const [size, file] of Object.entries(asset.drawings[theme])) {
        const raw = await readFile(join(asset.dir, file), 'utf8');
        const prepared = prepare(raw, {
          prefix: `${asset.id.replace(/\./g, '-')}-${theme}-${size}`,
          label: `${asset.name} ${theme} ${size}`,
          theme,
        });
        const rel = `${outDir}/${theme}-${size}.svg`;
        await writeFile(join(ROOT, rel), prepared, 'utf8');
        variants[theme][size] = rel;
        if (theme === 'standard' && !colorSample) colorSample = raw;
      }
    }

    const meta = {
      id: asset.id,
      name: asset.name,
      keywords: [...new Set(slug(asset.name).split('-'))].filter((w) => w.length > 1),
      type: TYPE,
      collection: COLLECTION,
      product: asset.name,
      status: 'draft',
      themes: asset.themes,
      sizes: asset.sizes,
      colors: extractColors(colorSample),
      // Monochrome themes were rewritten to currentColor and do take an accent.
      // The standard theme keeps its brand gradients; the browser detects that per
      // theme at runtime, so the picker is only offered where it works.
      recolorable: true,
      variants,
      version: '1.0.0',
      updated: today,
    };

    await writeFile(join(ROOT, outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    written++;
  }

  console.log(`✓ Imported ${written} assets into ${outBase}/`);
  console.log(`
  Everything landed as status: "draft" with keywords derived from the folder
  name only. That is deliberate — nothing is published until a person looks at
  it, and invented keywords are worse than none.

  Next: npm run manifest && npm run validate
`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
