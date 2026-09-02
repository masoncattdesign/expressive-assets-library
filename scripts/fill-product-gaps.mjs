/**
 * Complete the product icon matrix: 90 icons x 3 styles x 6 sizes.
 *
 * 1,440 of the 1,620 cells are authored artwork imported from Figma. The other
 * 180 do not exist there: ten icons have no Outline drawn at all, six have no
 * Filled, and Standard is missing scattered sizes across a dozen more.
 *
 * This fills every hole so the matrix is square, and marks every cell it fills.
 * That distinction is the whole point of the script. The library's central
 * claim is that artwork is REDRAWN per size rather than scaled, so a generated
 * cell that pretended to be authored would quietly falsify the thing the
 * contract promises. Each one is therefore recorded in the asset's
 * `generated` list and carries a comment in the file saying where it came
 * from, so the Figma page, the Gallery and anyone opening the SVG can all tell
 * a drawing from a stand-in.
 *
 * Two rules, in order of preference:
 *
 *   scale    The style exists at another size. Keep the drawing, restate its
 *            width and height. Honest: it IS that drawing, shown smaller.
 *
 *   derive   The style does not exist at all. Build it from Standard: Filled is
 *            every solid shape in currentColor, Outline is the same shapes
 *            stroked instead of filled. This is a silhouette, not line work,
 *            and it will look plainly worse than the authored outlines next to
 *            it. That is the intended signal.
 *
 * Usage: node scripts/fill-product-gaps.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 20, 24, 28, 32, 48];
const STYLES = ['standard', 'outline', 'filled'];
const DRY = process.argv.includes('--dry');
const REFRESH = process.argv.includes('--refresh');

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const icons = manifest.assets.filter((a) => a.collection === 'product' && a.type === 'icon');

/** Nearest size with artwork: prefer stepping up, since detail survives being
 *  shown smaller better than it survives being invented. */
function nearest(have, target) {
  if (have.includes(target)) return target;
  const up = have.filter((s) => s > target).sort((a, b) => a - b);
  if (up.length) return up[0];
  return have.filter((s) => s < target).sort((a, b) => b - a)[0] ?? null;
}

const head = (svg) => (svg.includes('<defs') ? svg.slice(0, svg.indexOf('<defs')) : svg);
const DRAWABLE = /<(path|rect|ellipse|circle|polygon)\b[^>]*?\/>/g;

function retitle(svg, name, style, size) {
  return svg
    .replace(/aria-label="[^"]*"/, `aria-label="${name} ${style} ${size}"`)
    .replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`);
}

function stamp(svg, note) {
  return svg.replace(/(<svg[^>]*>)/, `$1\n<!-- ${note} -->`);
}

function scale(svg, name, style, size, from) {
  return stamp(retitle(svg, name, style, size),
    `placeholder: the ${from}px ${style} drawing shown at ${size}px, not authored at this size`);
}

/** Shapes that carry the form. An overlay at partial opacity is a highlight on
 *  top of something else, and stroking it produces noise rather than an edge. */
function solids(svg) {
  return [...head(svg).matchAll(DRAWABLE)]
    .map((m) => m[0])
    .filter((t) => !/fill-opacity="0?\.\d+"/.test(t) && !/opacity="0?\.\d+"/.test(t))
    .filter((t) => !/fill="none"/.test(t));
}

/** A shape's color, resolving a gradient to the mean of its stops. Enough to
 *  ask "is this the body or a mark sitting on it", which is all Filled needs. */
function colorOf(svg, tag) {
  const f = tag.match(/fill="([^"]+)"/);
  if (!f) return null;
  const g = f[1].match(/^url\(#(.+)\)$/);
  if (!g) return toRgb(f[1]);
  const block = svg.match(new RegExp(`<(linear|radial)Gradient[^>]*id="${g[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?</\\1Gradient>`));
  if (!block) return null;
  const stops = [...block[0].matchAll(/stop-color="([^"]+)"/g)].map((m) => toRgb(m[1])).filter(Boolean);
  if (!stops.length) return null;
  return [0, 1, 2].map((i) => Math.round(stops.reduce((n, c) => n + c[i], 0) / stops.length));
}

function toRgb(c) {
  if (c === 'white') return [255, 255, 255];
  if (c === 'black') return [0, 0, 0];
  const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const KNOCKOUT = 'var(--ea-knockout, #fff)';

function derive(svg, name, style, size) {
  const open = svg.match(/<svg[^>]*>/)[0]
    .replace(/aria-label="[^"]*"/, `aria-label="${name} ${style} ${size}"`)
    .replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`);
  const box = (svg.match(/viewBox="0 0 (\d+)/) || [, '48'])[1];
  const shapes = solids(svg);
  if (!shapes.length) return null;
  const body = shapes.map((t) => {
    const rgb = colorOf(svg, t);
    let s = t.replace(/\s(fill|fill-opacity|opacity|stroke[a-z-]*)="[^"]*"/g, '');
    if (style === 'filled') {
      // Light material is a mark sitting on the body, so it knocks out rather
      // than joining it. Without this, a white letterform vanishes into its
      // plate and the icon reads as a filled rectangle.
      const knock = rgb && luminance(rgb) > 0.72;
      return s.replace('/>', ` fill="${knock ? KNOCKOUT : 'currentColor'}"/>`);
    }
    const w = (1.5 * Number(box)) / 48;
    return s.replace('/>', ` fill="none" stroke="currentColor" stroke-width="${w}" stroke-linejoin="round"/>`);
  });
  const note = style === 'filled'
    ? 'placeholder: silhouette derived from the standard artwork, not an authored Filled drawing'
    : 'placeholder: silhouette derived from the standard artwork, not authored line work';
  return `${open}\n<!-- ${note} -->\n${body.join('\n')}\n</svg>\n`;
}

let scaled = 0, derived = 0, failed = [];
const touched = new Set();

for (const asset of icons) {
  const dir = join(ROOT, 'assets/icons/product', asset.id.split('.')[1]);
  const metaPath = join(dir, 'meta.json');
  if (!existsSync(metaPath)) { failed.push(`${asset.id}: no meta.json`); continue; }
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const generated = new Set(meta.generated || meta.placeholders || []);
  let changed = false;

  // Snapshot what was authored before anything is added, and always source from
  // that. Otherwise a filled cell becomes the source for the next one and the
  // gaps compound: a 16px scaled from a 20px that was itself scaled from 48.
  const authored = {};
  for (const style of STYLES) {
    authored[style] = Object.keys(meta.variants?.[style] || {})
      .map(Number).filter(Number.isFinite)
      .filter((size) => !generated.has(`${style}:${size}`));
  }

  for (const style of STYLES) {
    for (const size of SIZES) {
      if (meta.variants?.[style]?.[size] && !(REFRESH && generated.has(`${style}:${size}`))) continue;

      const haveInStyle = authored[style];
      let out = null, kind = null;

      if (haveInStyle.length) {
        const from = nearest(haveInStyle, size);
        const src = readFileSync(join(ROOT, meta.variants[style][from]), 'utf8');
        out = scale(src, meta.name, style, size, from);
        kind = 'scale';
      } else {
        const std = authored.standard;
        if (!std.length) { failed.push(`${asset.id} ${style}:${size}: no standard to derive from`); continue; }
        const from = nearest(std, size) ?? std[0];
        const src = readFileSync(join(ROOT, meta.variants.standard[from]), 'utf8');
        out = derive(src, meta.name, style, size);
        if (!out) { failed.push(`${asset.id} ${style}:${size}: nothing solid to derive`); continue; }
        out = retitle(out, meta.name, style, size);
        kind = 'derive';
      }

      const rel = `assets/icons/product/${asset.id.split('.')[1]}/${style}-${size}.svg`;
      if (!DRY) writeFileSync(join(ROOT, rel), out, 'utf8');
      (meta.variants[style] ||= {})[size] = rel;
      generated.add(`${style}:${size}`);
      changed = true;
      kind === 'scale' ? scaled++ : derived++;
      touched.add(asset.id);
    }
  }

  if (!changed) continue;

  // Keep the record in a stable order so a diff stays readable.
  meta.themes = STYLES.filter((s) => Object.keys(meta.variants[s] || {}).length);
  meta.sizes = SIZES.slice();
  for (const style of STYLES) {
    if (!meta.variants[style]) continue;
    const sorted = {};
    for (const size of SIZES) if (meta.variants[style][size]) sorted[size] = meta.variants[style][size];
    meta.variants[style] = sorted;
  }
  const ordered = {};
  for (const style of STYLES) if (meta.variants[style]) ordered[style] = meta.variants[style];
  meta.variants = ordered;
  meta.generated = [...generated].sort();
  delete meta.placeholders;
  if (!DRY) writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

console.log(`${DRY ? 'would fill' : 'filled'} ${scaled + derived} cells across ${touched.size} icons`);
console.log(`  ${scaled} scaled from another size`);
console.log(`  ${derived} derived from standard`);
if (failed.length) {
  console.log(`  ${failed.length} could not be filled:`);
  for (const f of failed.slice(0, 10)) console.log('    ' + f);
}
