#!/usr/bin/env node
/**
 * Imports Microsoft's Fluent System Icons into the system collection.
 *
 *   git clone --depth 1 https://github.com/microsoft/fluentui-system-icons.git
 *   node scripts/import-fluent.mjs --from=./fluentui-system-icons [--dry-run]
 *
 * Upstream layout:
 *   assets/<Icon Name>/metadata.json
 *   assets/<Icon Name>/SVG/ic_fluent_<snake_name>_<size>_<style>.svg
 *
 * MIT licensed, Copyright (c) 2020 Microsoft Corporation. Every imported asset
 * gets a `source` block; `npm run notices` builds THIRD-PARTY-NOTICES.md from
 * those. Attribution that lives only in a README nobody opens is attribution in
 * name only.
 *
 * What it does with the artwork:
 *
 *  - Takes only the sizes named by --sizes (default 20,24). Fluent ships up to
 *    seven per icon; the full set is 21,645 files, which is a lot of git for a
 *    library that also has to hold your own work.
 *  - Rewrites #212121 to currentColor, so every icon takes a Windows accent.
 *  - SYNTHESISES a Standard variant: the filled glyph, white, inside the
 *    gradient tile. Fluent has no full-colour system icon, so this is drawn
 *    here, not shipped by Microsoft — every synthesised asset says so in its
 *    notes, because artwork that looks official and isn't is worse than none.
 *  - Derives keywords from Fluent's `metaphor` metadata, which is a real
 *    synonym list rather than a restatement of the name.
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const has = (f) => args.includes(f);

const FROM = (arg('from') || '').replace(/^~/, homedir());
const COLLECTION = arg('collection') || 'system';
const SIZES = (arg('sizes') || '20,24').split(',').map(Number).filter(Boolean);
const LIMIT = Number(arg('limit')) || Infinity;
const DRY = has('--dry-run');

/* Fluent's style names on the left, this library's themes on the right.
   Note "regular" means the OUTLINE weight in Fluent — the exact collision that
   made renaming this library's themes worth doing. */
const STYLE_MAP = { regular: 'outline', filled: 'mono' };

/* System icons are one family, so they share one gradient rather than each
   inventing a brand colour. These are the same tokens the placeholder system
   icons used, so the collection stays visually coherent. */
const TILE = { primary: '#0078D4', secondary: '#8764B8' };

const exists = (p) => stat(p).then(() => true, () => false);
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * `description` is meant to be one line, and the schema caps it at 280. A
 * handful of Fluent entries run to several sentences, so take the first one and
 * hard-trim only if that is still too long — better a clean sentence than a
 * paragraph truncated mid-word.
 */
function oneLine(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= 280) return clean;
  const firstSentence = clean.match(/^.*?[.!?](?=\s|$)/)?.[0] || clean;
  return firstSentence.length <= 280 ? firstSentence : `${firstSentence.slice(0, 277).trimEnd()}…`;
}

/** ic_fluent_access_time_24_regular.svg -> { size: 24, style: 'regular' } */
function parseFile(name) {
  const m = name.match(/_(\d+)_(regular|filled|light|color)\.svg$/);
  return m ? { size: Number(m[1]), style: m[2] } : null;
}

/** Namespace ids so inlined SVGs cannot clobber each other's defs. */
const namespaceIds = (svg, prefix) =>
  svg
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);

/** Make an upstream SVG safe to inline and tintable. */
function prepareMono(svg, { prefix, label }) {
  let out = svg.trim().replace(/<\?xml[^>]*\?>\s*/g, '');
  out = namespaceIds(out, prefix);
  out = out.replace(/(fill|stroke)="#(212121|242424|000000|000)"/gi, '$1="currentColor"');
  if (!out.includes('role="img"')) out = out.replace('<svg ', '<svg role="img" ');
  if (!out.includes('aria-label=')) {
    out = out.replace('<svg ', `<svg aria-label="${label.replace(/"/g, '&quot;')}" `);
  }
  return out + '\n';
}

/**
 * Build the Standard variant: the filled glyph in white, inset in a gradient
 * tile. Uses the same --ea-primary/--ea-secondary hooks the generated set uses,
 * so the accent picker works on it.
 */
function buildStandard(filledSvg, { prefix, label }) {
  const inner = (filledSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [, ''])[1]
    .replace(/<\?xml[^>]*\?>\s*/g, '')
    .replace(/(fill|stroke)="#(212121|242424|000000|000)"/gi, '$1="#fff"')
    .trim();

  const viewBox = (filledSvg.match(/viewBox="0 0 (\d+) \d+"/) || [, '24'])[1];
  const scale = (0.62).toFixed(2);
  const inset = ((24 - 24 * 0.62) / 2).toFixed(2);
  const unit = (24 / Number(viewBox)).toFixed(4);

  const id = `ea-${prefix}`;
  const body =
    `<style>#${id}{--ea-primary:${TILE.primary};--ea-secondary:${TILE.secondary}}` +
    `#${id} .c1{stop-color:var(--ea-primary)}#${id} .c2{stop-color:var(--ea-secondary)}</style>` +
    `<defs><linearGradient id="${id}-g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">` +
    `<stop class="c1"/><stop offset="1" class="c2"/></linearGradient></defs>` +
    `<rect width="24" height="24" rx="6" fill="url(#${id}-g)"/>` +
    `<g transform="translate(${inset} ${inset}) scale(${(Number(scale) * Number(unit)).toFixed(4)})">` +
    namespaceIds(inner, prefix) +
    '</g>';

  return (
    `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" ` +
    `fill="none" role="img" aria-label="${label.replace(/"/g, '&quot;')}">${body}</svg>\n`
  );
}

async function main() {
  const assetsDir = join(FROM, 'assets');
  if (!FROM || !(await exists(assetsDir))) {
    console.error(`\nPass --from=<clone of fluentui-system-icons>. Looked for ${assetsDir}\n`);
    process.exit(1);
  }

  const folders = (await readdir(assetsDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, LIMIT);

  const plan = [];
  const skipped = [];

  for (const folder of folders) {
    const svgDir = join(assetsDir, folder, 'SVG');
    if (!(await exists(svgDir))) {
      skipped.push({ name: folder, why: 'no SVG folder' });
      continue;
    }

    const files = await readdir(svgDir);
    const byTheme = {};
    let filledSource = null;
    let filledSize = 0;

    for (const file of files) {
      const parsed = parseFile(file);
      if (!parsed) continue;

      // Keep the largest filled drawing to synthesise Standard from — more
      // detail survives being scaled down than up.
      if (parsed.style === 'filled' && parsed.size > filledSize) {
        filledSize = parsed.size;
        filledSource = file;
      }

      const theme = STYLE_MAP[parsed.style];
      if (!theme || !SIZES.includes(parsed.size)) continue;
      (byTheme[theme] ||= {})[parsed.size] = file;
    }

    const themes = Object.keys(byTheme);
    if (!themes.length) {
      skipped.push({ name: folder, why: `no ${SIZES.join('/')}px regular or filled drawings` });
      continue;
    }

    let meta = {};
    try {
      meta = JSON.parse(await readFile(join(assetsDir, folder, 'metadata.json'), 'utf8'));
    } catch {
      /* metadata is optional upstream */
    }

    plan.push({
      id: `${COLLECTION}.${slug(folder)}`,
      name: folder,
      svgDir,
      byTheme,
      filledSource,
      metaphors: Array.isArray(meta.metaphor) ? meta.metaphor : [],
      description: oneLine(meta.description),
    });
  }

  const dupes = plan.map((p) => p.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length) {
    console.error(`\n✗ ${new Set(dupes).size} duplicate ids, e.g. ${[...new Set(dupes)].slice(0, 5).join(', ')}\n`);
    process.exit(1);
  }

  const withStandard = plan.filter((p) => p.filledSource).length;
  const files = plan.reduce((n, p) => n + Object.values(p.byTheme).reduce((m, d) => m + Object.keys(d).length, 0), 0);

  console.log(`\n${plan.length} icons from Fluent at ${SIZES.join(', ')}px`);
  console.log(`  ${files} imported drawings + ${withStandard} synthesised Standard = ${files + withStandard} files`);
  console.log(`  ${plan.filter((p) => p.metaphors.length).length} carry metaphor keywords`);
  console.log(`  ${plan.filter((p) => p.description).length} carry a description`);
  if (skipped.length) console.log(`  ${skipped.length} skipped (${skipped[0]?.why})`);

  if (DRY) {
    console.log('\nDry run — nothing written.\n');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const outBase = `assets/icons/${COLLECTION}`;
  let written = 0;

  for (const icon of plan) {
    const name = icon.id.split('.').slice(1).join('.');
    const outDir = `${outBase}/${name}`;
    await mkdir(join(ROOT, outDir), { recursive: true });

    const prefix = icon.id.replace(/\./g, '-');
    const variants = {};
    const sizes = new Set();

    for (const [theme, drawings] of Object.entries(icon.byTheme)) {
      variants[theme] = {};
      for (const [size, file] of Object.entries(drawings)) {
        const raw = await readFile(join(icon.svgDir, file), 'utf8');
        const rel = `${outDir}/${theme}-${size}.svg`;
        await writeFile(
          join(ROOT, rel),
          prepareMono(raw, { prefix: `${prefix}-${theme}-${size}`, label: `${icon.name} ${theme} ${size}` }),
          'utf8'
        );
        variants[theme][size] = rel;
        sizes.add(Number(size));
      }
    }

    if (icon.filledSource) {
      const raw = await readFile(join(icon.svgDir, icon.filledSource), 'utf8');
      const rel = `${outDir}/standard-any.svg`;
      await writeFile(
        join(ROOT, rel),
        buildStandard(raw, { prefix: `${prefix}-standard`, label: `${icon.name} standard` }),
        'utf8'
      );
      variants.standard = { any: rel };
    }

    const keywords = [
      ...new Set(
        [...icon.metaphors, ...icon.name.split(/\s+/)]
          .map((k) => slug(String(k)).replace(/-/g, ' ').trim())
          .filter((k) => k.length > 1)
      ),
    ];

    const themes = Object.keys(variants);
    const meta = {
      id: icon.id,
      name: icon.name,
      keywords: keywords.length ? keywords : [slug(icon.name).replace(/-/g, ' ')],
      ...(icon.description ? { description: icon.description } : {}),
      type: 'icon',
      collection: COLLECTION,
      status: 'draft',
      themes,
      sizes: [...sizes].sort((a, b) => a - b),
      colors: { primary: TILE.primary, secondary: TILE.secondary },
      recolorable: true,
      variants,
      version: '1.0.0',
      updated: today,
      source: {
        project: 'Fluent System Icons',
        url: `https://github.com/microsoft/fluentui-system-icons/tree/main/assets/${encodeURIComponent(icon.name)}`,
        license: 'MIT',
        copyright: 'Copyright (c) 2020 Microsoft Corporation',
      },
      ...(variants.standard
        ? {
            notes:
              'Outline and Mono are Fluent System Icons artwork, unmodified except for a currentColor rewrite. Standard is NOT shipped by Fluent — it is generated here by insetting the filled glyph in a gradient tile.',
          }
        : {}),
    };

    await writeFile(join(ROOT, outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    written++;
    if (written % 250 === 0) console.log(`  wrote ${written}/${plan.length}…`);
  }

  console.log(`\n✓ Imported ${written} icons into ${outBase}/`);
  console.log(`
  All land as status: "draft". Keywords come from Fluent's own metaphor
  metadata rather than being invented.

  Next: npm run notices && npm run manifest && npm run validate
`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
