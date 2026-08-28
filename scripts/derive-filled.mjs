/**
 * Derive the Filled theme from full-colour Figma exports.
 *
 * Windows file icons arrive from Figma as one theme: a gradient-filled page
 * with a mark on it. There is no Filled artwork upstream, and a monochrome
 * reduction is a mechanical question rather than a design one — WHICH of the
 * shapes is the body and which is a detail sitting on it.
 *
 * The rule: resolve every fill to a representative colour (a gradient becomes
 * the average of its stops), then anything light enough to read as paper
 * becomes a knockout and everything else becomes the body. That reproduces the
 * knockout convention the rest of the library already uses, so a Filled file
 * icon tints exactly like a Filled system icon.
 *
 * What this is NOT: an Outline derivation. These exports carry no interior
 * line work — the detail exists only as filled shapes against a coloured
 * ground — so stripping fills leaves nothing but the page silhouette. Every
 * icon would collapse to the same rounded rectangle. Outline has to be drawn
 * or sourced; it cannot be recovered from here.
 *
 *   node scripts/derive-filled.mjs --collection=file [--dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const COLLECTION = arg('collection') || 'file';
const DRY = args.includes('--dry-run');
// Redraw artwork for assets that already carry Filled, without touching their
// metadata again — for when the derivation itself is what changed.
const FORCE = args.includes('--force');

const KNOCKOUT = 'var(--ea-knockout, #fff)';
/** Above this, material reads as paper rather than ink. Tuned against the
 *  collection by eye — see the contact sheet in the commit that added this. */
const PAPER = 0.72;

const toRgb = (c) => {
  if (!c) return null;
  if (c === 'white') return [255, 255, 255];
  if (c === 'black') return [0, 0, 0];
  const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function gradientAverage(svg, id) {
  const block = svg.match(new RegExp(`<(linear|radial)Gradient[^>]*id="${id}"[\\s\\S]*?</\\1Gradient>`));
  if (!block) return null;
  const rgbs = [...block[0].matchAll(/stop-color="([^"]+)"/g)].map((m) => toRgb(m[1])).filter(Boolean);
  if (!rgbs.length) return null;
  return rgbs.reduce((a, c) => [a[0] + c[0] / rgbs.length, a[1] + c[1] / rgbs.length, a[2] + c[2] / rgbs.length], [0, 0, 0]);
}

/**
 * Keep the parts of <defs> that geometry still points at.
 *
 * Gradients die with the colour, but clipPaths and masks are structural — the
 * body references them by id, and a reference into a block that no longer
 * exists is not a no-op: the element either vanishes or silently renders
 * unclipped, depending on the browser. Fourteen file icons hit exactly that.
 */
function keepStructuralDefs(svg) {
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/);
  if (!defs) return '';
  const kept = [...defs[0].matchAll(/<(clipPath|mask)\b[\s\S]*?<\/\1>/g)].map((m) => m[0]);
  return kept.length ? `<defs>\n${kept.join('\n')}\n</defs>\n` : '';
}

export function deriveFilled(svg, { label } = {}) {
  const defsAt = svg.indexOf('<defs');
  const head = defsAt === -1 ? svg : svg.slice(0, defsAt);

  let out = head.replace(/fill="([^"]+)"/g, (whole, value) => {
    if (value === 'none') return whole;
    const g = value.match(/^url\(#(.+)\)$/);
    const rgb = g ? gradientAverage(svg, g[1]) : toRgb(value);
    if (!rgb) return 'fill="currentColor"';
    return luminance(rgb) > PAPER ? `fill="${KNOCKOUT}"` : 'fill="currentColor"';
  });

  // Strokes follow the same rule; anything still pointing into defs is a
  // reference that will dangle once the gradients go, so it becomes body.
  out = out
    .replace(/stroke="url\(#[^)]+\)"/g, 'stroke="currentColor"')
    .replace(/fill="url\(#[^)]+\)"/g, 'fill="currentColor"')
    .replace(/<\/svg>\s*$/, '')
    .trimEnd();

  if (label) out = out.replace(/aria-label="[^"]*"/, `aria-label="${label}"`);
  return `${out}\n${keepStructuralDefs(svg)}</svg>\n`;
}

async function main() {
  // Filter on the declared collection, not the path — 'file' is also an asset
  // NAME inside the vscode set, and a path glob happily matches both.
  const metas = execSync('find assets -name meta.json', { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean);

  let assets = 0, drawings = 0;
  const skipped = [];

  for (const rel of metas) {
    const meta = JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
    if (meta.collection !== COLLECTION) continue;
    if (meta.themes.includes('filled') && !FORCE) { skipped.push(`${meta.id}: already has Filled`); continue; }
    if (!meta.variants.standard) { skipped.push(`${meta.id}: no Standard to derive from`); continue; }

    const filled = {};
    for (const [size, path] of Object.entries(meta.variants.standard)) {
      const svg = await readFile(join(ROOT, path), 'utf8');
      const outRel = path.replace(/\/standard(-\d+|-any)?\.svg$/, (_, s) => `/filled${s || ''}.svg`);
      if (!DRY) await writeFile(join(ROOT, outRel), deriveFilled(svg, { label: `${meta.name} filled ${size}` }), 'utf8');
      filled[size] = outRel;
      drawings++;
    }

    if (FORCE && meta.themes.includes('filled')) { assets++; continue; }
    meta.themes = [...meta.themes, 'filled'].sort();
    meta.variants = { ...meta.variants, filled };
    // The Standard artwork still has no tint hooks, and isTintable() checks the
    // source per theme — so opening this up lets Filled take an accent without
    // pretending the brand mark can.
    meta.recolorable = true;
    meta.notes = `${meta.notes ? meta.notes.replace(/\s*$/, '') + ' ' : ''}Filled is derived here from the Standard artwork by luminance, not shipped upstream; it is drawn in currentColor and takes an accent. Outline cannot be derived from these exports and is deliberately absent.`;
    meta.updated = new Date().toISOString().slice(0, 10);
    if (!DRY) await writeFile(join(ROOT, rel), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    assets++;
  }

  console.log(`\n${DRY ? 'Would derive' : 'Derived'} Filled for ${assets} assets — ${drawings} drawings.`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const s of skipped.slice(0, 10)) console.log(`  ${s}`);
  }
  console.log('\n  Everything stays status: draft. A derivation is a starting point, not artwork.\n');
}

main();
