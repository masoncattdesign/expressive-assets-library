/**
 * File icons: what was called Filled is Outline, and Filled has to be made.
 *
 * derive-filled.mjs read the Standard artwork and painted anything lighter
 * than paper as a knockout and everything else as the body. On a file icon
 * that produces a dark silhouette with a white interior — a ring. It is line
 * work. Correct output, wrong name, and the library has been calling it Filled
 * since it landed.
 *
 * So:
 *
 *   outline   the existing artwork, renamed. Nothing is redrawn; the files are
 *             moved and the metadata follows them.
 *   filled    the inverse of the same classification. Paper becomes the body
 *             and the marks knock out of it, which is a solid plate carrying
 *             cut-out detail — the convention the system icons already use.
 *
 * Inverting the RULE rather than swapping colors in the outline files matters:
 * a swap would depend on shape order, and the first path being the silhouette
 * is a habit of this exporter rather than a guarantee. Classifying each shape
 * against the same luminance threshold gives the same answer whatever order
 * they arrive in.
 *
 *   node scripts/rebuild-file-styles.mjs [--dry-run]
 */
import { readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

const KNOCKOUT = 'var(--ea-knockout, #fff)';
const PAPER = 0.72;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const toRgb = (c) => {
  if (!c) return null;
  if (c === 'white') return [255, 255, 255];
  if (c === 'black') return [0, 0, 0];
  const m = c.match(HEX);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function gradientAverage(svg, id) {
  const block = svg.match(new RegExp(`<(linear|radial)Gradient[^>]*id="${id}"[\\s\\S]*?</\\1Gradient>`));
  if (!block) return null;
  const stops = [...block[0].matchAll(/stop-color="([^"]+)"/g)].map((m) => toRgb(m[1])).filter(Boolean);
  if (!stops.length) return null;
  return [0, 1, 2].map((i) => Math.round(stops.reduce((n, c) => n + c[i], 0) / stops.length));
}

/** Everything before <defs> is drawn; the rest is paint definitions. */
const head = (svg) => (svg.includes('<defs') ? svg.slice(0, svg.indexOf('<defs')) : svg);

/**
 * Filled: paper becomes the body, ink knocks out of it. The inverse of the
 * rule that produced the outline, applied to the same Standard source.
 */
/**
 * Rough extent of a shape, as a fraction of the artboard.
 *
 * Only used to tell a letter tile from a line of text, so a crude read of the
 * coordinate stream is enough: min and max over every number in the geometry.
 * Curve control points push the box out a little, which does not matter for a
 * size comparison.
 */
function extent(tag, box) {
  const rect = tag.match(/<rect[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);
  if (rect) return (Number(rect[1]) * Number(rect[2])) / (box * box);
  const d = tag.match(/ d="([^"]+)"/);
  if (!d) return 0;
  const nums = (d[1].match(/-?\d*\.?\d+/g) || []).map(Number);
  if (nums.length < 4) return 0;
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return (w * h) / (box * box);
}

/** Above this, a knocked-out shape is a plate in its own right rather than a
 *  mark on one, so it needs an edge to survive leaving the page. Below it, an
 *  outline would simply paint the mark back in — which is what happened to the
 *  lines of text on the PDF icon the first time. */
const TILE = 0.06;

/**
 * Filled: a solid plate with real holes cut through it.
 *
 * The first attempt painted knockouts as an opaque color, which is not a
 * knockout at all. Two things gave it away. A shape carrying fill-opacity let
 * the ink beneath bleed through, so the PowerPoint tile came out gray instead
 * of clear. And on any surface that was not exactly the knockout color, the
 * holes were visible as pale shapes rather than as background.
 *
 * So the holes are a mask now. Every shape is painted currentColor inside a
 * masked group; the mask itself replays the same shapes in document order,
 * white where material is body and black where it is a hole. Painting order
 * does the compositing for free — a letterform drawn after the tile it sits in
 * repaints itself white in the mask and survives the hole around it.
 *
 * Shapes big enough to be a plate in their own right also get a stroked edge
 * outside the mask, because the letter tile overhangs the page and would
 * otherwise lose the part hanging past it.
 */
function deriveFilled(svg, name, size) {
  const at = svg.indexOf('<defs');
  const body = at === -1 ? svg : svg.slice(0, at);
  const box = Number((svg.match(/viewBox="0 0 (\d+)/) || [, 48])[1]) || 48;
  const weight = Math.max(0.75, Math.round((1.5 * box) / 48 * 100) / 100);
  const maskId = `ea-knock-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${size}`;

  const open = (svg.match(/<svg[^>]*>/) || ['<svg>'])[0]
    .replace(/aria-label="[^"]*"/, `aria-label="${name} filled ${size}"`);

  const shapes = [...body.matchAll(/<(path|rect|ellipse|circle|polygon)\b[^>]*?\/>/g)].map((m) => m[0]);

  const painted = [];   // every shape, flat, in currentColor
  const maskParts = []; // the same shapes, white for body and black for a hole
  const edges = [];     // outlines for holes large enough to be plates

  for (const tag of shapes) {
    const f = tag.match(/fill="([^"]+)"/);
    if (!f || f[1] === 'none') continue;

    let rgb = toRgb(f[1]);
    const g = f[1].match(/^url\(#(.+)\)$/);
    if (g) rgb = gradientAverage(svg, g[1]);
    const isBody = !rgb || luminance(rgb) > PAPER;

    // Opacity is what turned a knockout gray. Strip every trace of it: the
    // mask decides what is visible now, so a shape is either fully painted or
    // fully absent.
    const bare = tag.replace(/\s(fill|fill-opacity|opacity|stroke[a-z-]*)="[^"]*"/g, '');

    painted.push(bare.replace('/>', ' fill="currentColor"/>'));
    maskParts.push(bare.replace('/>', ` fill="${isBody ? '#fff' : '#000'}"/>`));

    if (!isBody && extent(tag, box) > TILE) {
      edges.push(bare.replace('/>', ` fill="none" stroke="currentColor" stroke-width="${weight}" stroke-linejoin="round"/>`));
    }
  }

  return [
    open,
    '<defs>',
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${box}" height="${box}">`,
    `<rect width="${box}" height="${box}" fill="#fff"/>`,
    ...maskParts,
    '</mask>',
    '</defs>',
    `<g mask="url(#${maskId})">`,
    ...painted,
    '</g>',
    ...edges,
    '</svg>',
    '',
  ].join('\n');
}

const dir = join(ROOT, 'assets/icons/file');
const folders = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory());

let renamed = 0, derived = 0, metas = 0;

for (const folder of folders) {
  const base = join(dir, folder.name);
  const metaPath = join(base, 'meta.json');
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));
  if (!meta.variants?.filled) continue;

  // Second run onwards: outline already exists, so only Filled is rebuilt.
  const REDERIVE_ONLY = Boolean(meta.variants.outline);
  const sizes = Object.keys(meta.variants.filled);

  // 1. The existing Filled is Outline. Move the files, keep the drawings.
  for (const size of REDERIVE_ONLY ? [] : sizes) {
    const from = join(ROOT, meta.variants.filled[size]);
    const to = from.replace(/\/filled-(\d+)\.svg$/, '/outline-$1.svg');
    if (!DRY) {
      await rename(from, to);
      const svg = await readFile(to, 'utf8');
      await writeFile(to, svg.replace(/aria-label="([^"]*?) filled /, '$1 outline '), 'utf8');
    }
    renamed++;
  }
  if (!REDERIVE_ONLY) {
    meta.variants.outline = {};
    for (const size of sizes) {
      meta.variants.outline[size] = meta.variants.filled[size].replace(/\/filled-(\d+)\.svg$/, '/outline-$1.svg');
    }
  }

  // 2. A real Filled, from the Standard artwork, by the inverted rule.
  meta.variants.filled = {};
  for (const size of Object.keys(meta.variants.standard)) {
    const src = await readFile(join(ROOT, meta.variants.standard[size]), 'utf8');
    const rel = `assets/icons/file/${folder.name}/filled-${size}.svg`;
    if (!DRY) await writeFile(join(ROOT, rel), deriveFilled(src, meta.name, size), 'utf8');
    meta.variants.filled[size] = rel;
    derived++;
  }

  // Stable order in the file, so the diff stays readable.
  const ordered = {};
  for (const style of ['standard', 'outline', 'filled']) {
    if (meta.variants[style]) ordered[style] = meta.variants[style];
  }
  meta.variants = ordered;
  meta.themes = ['standard', 'outline', 'filled'].filter((t) => meta.variants[t]);
  meta.notes = (meta.notes || '')
    .replace(/Filled is derived here[^]*?deliberately absent\./, '')
    .trim();
  meta.notes = (meta.notes ? meta.notes + ' ' : '') +
    'Outline is derived from the Standard artwork by luminance: paper knocks out, ink is the body. ' +
    'Filled is the inverse of the same classification, so the plate is solid and the marks cut out of it. ' +
    'Both are drawn in currentColor and take an accent.';
  if (!DRY) await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  metas++;
}

console.log(`${DRY ? 'would rename' : 'renamed'} ${renamed} files to outline`);
console.log(`${DRY ? 'would derive' : 'derived'} ${derived} filled drawings`);
console.log(`${DRY ? 'would update' : 'updated'} ${metas} meta.json files`);
