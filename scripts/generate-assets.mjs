#!/usr/bin/env node
/**
 * Generates the on-disk asset set from scripts/sources/specs.mjs.
 *
 * For each icon it writes three theme variants derived from one geometry, plus
 * a meta.json conforming to schema/asset.schema.json. Illustrations are copied
 * through as authored (color theme only).
 *
 * Every generated SVG is standalone and self-describing: literal colors are
 * declared once as custom properties on the root, so the file opens correctly
 * in a browser or design tool, AND a host page can retint it live by setting
 * --ea-primary / --ea-secondary / --ea-knockout on the element.
 *
 * Run: npm run generate
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ICONS,
  ILLUSTRATIONS,
  LIFECYCLE,
  ALIASES,
  DESCRIPTIONS,
  ICON_SIZES,
  ILLUSTRATION_SIZES,
} from './sources/specs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = process.env.ASSET_DATE || new Date().toISOString().slice(0, 10);

const STROKE = 'stroke-linecap:round;stroke-linejoin:round';

/**
 * Theme-specific CSS. This is the whole three-theme derivation, in one place.
 *
 * Every selector is written against `$` — a placeholder for an id selector that
 * scopes the rules to this one SVG. That scoping is not cosmetic: a <style>
 * block inside an inline SVG is a DOCUMENT-level stylesheet, so unscoped `.f`
 * rules from forty inlined icons all apply to each other and the last one wins.
 */
function themeCss(theme, container) {
  if (theme === 'color' && container === 'tile') {
    return [
      '$ .f{fill:#fff}',
      `$ .s{fill:none;stroke:#fff;stroke-width:1.7;${STROKE}}`,
      `$ .k{fill:none;stroke:url(#GRAD);stroke-width:1.7;${STROKE}}`,
      '$ .lbl{fill:url(#GRAD)}',
    ].join('');
  }
  if (theme === 'color') {
    return [
      '$ .f{fill:url(#GRAD)}',
      `$ .s{fill:none;stroke:url(#GRAD);stroke-width:1.7;${STROKE}}`,
      `$ .k{fill:none;stroke:var(--ea-knockout);stroke-width:1.5;${STROKE}}`,
      '$ .lbl{fill:var(--ea-knockout)}',
    ].join('');
  }
  if (theme === 'regular') {
    return [
      `$ .f,$ .s,$ .k{fill:none;stroke:var(--ea-primary);stroke-width:1.6;${STROKE}}`,
      '$ .lbl{fill:var(--ea-primary)}',
    ].join('');
  }
  return [
    '$ .f{fill:var(--ea-primary)}',
    `$ .s{fill:none;stroke:var(--ea-primary);stroke-width:2.1;${STROKE}}`,
    `$ .k{fill:none;stroke:var(--ea-knockout);stroke-width:1.8;${STROKE}}`,
    '$ .lbl{fill:var(--ea-knockout)}',
  ].join('');
}

/**
 * Namespace every id in a fragment. Without this, inlining forty icons into one
 * page means forty elements called "ea-g" and every gradient resolves to the
 * first one — the classic multi-inline-SVG bug.
 */
function namespaceIds(svg, prefix) {
  return svg
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
}

function renderIcon(spec, theme) {
  const uid = spec.id.replace(/\./g, '-');
  const container = spec.container || 'tile';
  const { primary, secondary } = spec.colors;

  const css = themeCss(theme, container).replaceAll('#GRAD', '#ea-g');
  const root = `$ {--ea-primary:${primary};--ea-secondary:${secondary};--ea-knockout:#FFFFFF}`;

  const defs =
    theme === 'color'
      ? '<defs><linearGradient id="ea-g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">' +
        '<stop class="c1"/><stop offset="1" class="c2"/></linearGradient></defs>'
      : '';
  const gradCss = theme === 'color' ? '$ .c1{stop-color:var(--ea-primary)}$ .c2{stop-color:var(--ea-secondary)}' : '';

  let body;
  if (theme === 'color' && container === 'tile') {
    // Glyph is inset inside the gradient tile at 62% so it keeps a 4.5px margin.
    body = `<rect width="24" height="24" rx="6" fill="url(#ea-g)"/><g transform="translate(4.56 4.56) scale(0.62)">${spec.glyph}</g>`;
  } else {
    body = spec.glyph;
  }

  const rootId = `ea-${uid}`;
  const style = `<style>${root}${gradCss}${css}</style>`.replaceAll('$', `#${rootId}`);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" role="img" aria-label="${spec.name}">` +
    namespaceIds(style + defs + body, uid) +
    '</svg>';

  // The root id is applied last so namespaceIds() cannot double-prefix it.
  return svg.replace('<svg ', `<svg id="${rootId}" `) + '\n';
}

function renderIllustration(spec) {
  const uid = spec.id.replace(/\./g, '-');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" fill="none" role="img" aria-label="${spec.name}">` +
    spec.svg +
    '</svg>';
  return namespaceIds(svg, uid) + '\n';
}

function metaFor(spec, { type, themes, sizes, dir }) {
  const slug = spec.id.split('.')[1];
  const life = LIFECYCLE[spec.id] || {};
  // Placeholder artwork is one scalable drawing per theme, so it uses the
  // "any" key. Real per-size artwork keys each drawing by its pixel size.
  const variants = Object.fromEntries(themes.map((t) => [t, { any: `${dir}/${slug}/${t}.svg` }]));
  const description = DESCRIPTIONS[spec.id];
  const aliases = ALIASES[spec.id];

  return {
    id: spec.id,
    name: spec.name,
    ...(aliases ? { aliases } : {}),
    keywords: spec.keywords,
    ...(description ? { description } : {}),
    type,
    collection: spec.collection,
    status: life.status || 'published',
    ...(life.replacedBy ? { replacedBy: life.replacedBy } : {}),
    themes,
    sizes,
    colors: spec.colors,
    recolorable: spec.recolorable !== false,
    variants,
    owner: '@windows-design-systems',
    version: '1.0.0',
    updated: TODAY,
    notes: 'Placeholder artwork. Replace the geometry in scripts/sources/specs.mjs with the shipping Windows drawing; metadata and consumers are unaffected.',
  };
}

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
}

async function main() {
  /* Remove only what THIS script produces.
     It used to wipe assets/ wholesale, which was fine when every asset was
     generated and catastrophic the moment real imported artwork moved in —
     one `npm run generate` would have deleted the whole product icon set. */
  for (const spec of [...ICONS, ...ILLUSTRATIONS]) {
    const kind = ICONS.includes(spec) ? 'icons' : 'illustrations';
    const slug = spec.id.split('.')[1];
    await rm(join(ROOT, 'assets', kind, spec.collection, slug), { recursive: true, force: true });
  }

  let count = 0;

  for (const spec of ICONS) {
    const slug = spec.id.split('.')[1];
    const dir = `assets/icons/${spec.collection}`;
    const themes = ['color', 'regular', 'filled'];
    for (const theme of themes) {
      await write(join(ROOT, dir, slug, `${theme}.svg`), renderIcon(spec, theme));
    }
    await write(
      join(ROOT, dir, slug, 'meta.json'),
      JSON.stringify(metaFor(spec, { type: 'icon', themes, sizes: ICON_SIZES, dir }), null, 2) + '\n'
    );
    count++;
  }

  for (const spec of ILLUSTRATIONS) {
    const slug = spec.id.split('.')[1];
    const dir = `assets/illustrations/${spec.collection}`;
    await write(join(ROOT, dir, slug, 'color.svg'), renderIllustration(spec));
    await write(
      join(ROOT, dir, slug, 'meta.json'),
      JSON.stringify(metaFor(spec, { type: 'illustration', themes: ['color'], sizes: ILLUSTRATION_SIZES, dir }), null, 2) + '\n'
    );
    count++;
  }

  console.log(`Generated ${count} assets (${ICONS.length} icons, ${ILLUSTRATIONS.length} illustrations).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
