/**
 * Derive Outline and Filled from flat vector illustrations.
 *
 * This is NOT the same problem as scripts/derive-filled.mjs solves for file
 * icons, and it has a better answer. A Windows file icon is one gradient page
 * with marks laid over it: strip the fills and every icon collapses to the
 * same rounded rectangle, which is why Outline is impossible there. These
 * illustrations are built from separate solid shapes, so each shape's own
 * contour is real line work — stroking them produces a drawing rather than a
 * silhouette.
 *
 * OUTLINE — stroke every shape, and fill it with the knockout colour rather
 * than leaving it transparent. The opaque fill is the part that matters: solid
 * artwork occludes what sits behind it for free, and a naive stroke pass throws
 * that away, so you see the hidden half of every overlapping shape. Filling in
 * the page colour buys the occlusion back.
 *
 * FILLED — everything is the body except near-white detail, which knocks out.
 * A luminance split placed lower (the file-icon rule) reads more interior
 * detail but loses any light shape that IS the subject: the lavender speech
 * bubble, the periwinkle bell. Losing the subject is worse than losing a
 * detail, so the threshold sits high deliberately.
 *
 * The limit, stated plainly: one threshold cannot serve both roles, because
 * this palette uses the same colour for both. #CCD5F3 is the checkmark inside
 * the shield AND the whole body of the bell. Any global rule flattens one or
 * drops the other. Assets where that costs something are flagged REVIEW.
 *
 *   node scripts/derive-illustration-themes.mjs --collection=m365 [--dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => args.filter((a) => a.startsWith(`--${n}=`)).pop()?.split('=')[1];
const COLLECTION = arg('collection') || 'm365';
const DRY = args.includes('--dry-run');
const FORCE = args.includes('--force');

const KNOCKOUT = 'var(--ea-knockout, #fff)';
/** Above this a colour reads as paper rather than as part of the drawing. */
const PAPER = 0.92;
/** At a 160 viewBox this lands near 2px on a 96px card — heavy enough to hold
 *  together when the illustration is scaled down, light enough not to fill in. */
const STROKE = 3.2;

const toRgb = (c) => {
  if (!c) return null;
  const s = c.trim().toLowerCase();
  if (s === 'white') return [255, 255, 255];
  if (s === 'black') return [0, 0, 0];
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function deriveFilled(svg, { label } = {}) {
  let out = svg.replace(/(fill|stroke)="([^"]+)"/g, (whole, attr, value) => {
    if (value === 'none') return whole;
    const rgb = toRgb(value);
    if (!rgb) return `${attr}="currentColor"`;
    return `${attr}="${luminance(rgb) > PAPER ? KNOCKOUT : 'currentColor'}"`;
  });
  out = out.replace(/fill="url\(#[^)]+\)"/g, 'fill="currentColor"');
  if (label) out = out.replace(/aria-label="[^"]*"/, `aria-label="${label}"`);
  return out;
}

export function deriveOutline(svg, { label } = {}) {
  let out = svg.replace(/<(path|circle|rect|ellipse|polygon)\b([^>]*?)\/>/g, (whole, tag, attrs) => {
    const cleaned = attrs
      .replace(/\s*fill="[^"]*"/g, '')
      .replace(/\s*stroke="[^"]*"/g, '')
      .replace(/\s*stroke-width="[^"]*"/g, '')
      .replace(/\s*stroke-linejoin="[^"]*"/g, '')
      .replace(/\s*stroke-linecap="[^"]*"/g, '');
    return `<${tag}${cleaned} fill="${KNOCKOUT}" stroke="currentColor" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  if (label) out = out.replace(/aria-label="[^"]*"/, `aria-label="${label}"`);
  return out;
}

async function main() {
  const metas = execSync('find assets -name meta.json', { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean);

  let assets = 0, drawings = 0;
  const skipped = [];

  for (const rel of metas) {
    const meta = JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
    if (meta.collection !== COLLECTION) continue;
    if (!meta.variants.standard) { skipped.push(`${meta.id}: no Standard to derive from`); continue; }
    if (meta.themes.includes('outline') && meta.themes.includes('filled') && !FORCE) {
      skipped.push(`${meta.id}: already has both`);
      continue;
    }

    const added = {};
    for (const [theme, derive] of [['outline', deriveOutline], ['filled', deriveFilled]]) {
      const bySize = {};
      for (const [size, path] of Object.entries(meta.variants.standard)) {
        const svg = await readFile(join(ROOT, path), 'utf8');
        const outRel = path.replace(/\/standard(-[^/]*)?\.svg$/, (_, s) => `/${theme}${s || ''}.svg`);
        if (!DRY) await writeFile(join(ROOT, outRel), derive(svg, { label: `${meta.name} ${theme} ${size}` }), 'utf8');
        bySize[size] = outRel;
        drawings++;
      }
      added[theme] = bySize;
    }

    meta.themes = [...new Set([...meta.themes, 'outline', 'filled'])].sort();
    meta.variants = { ...meta.variants, ...added };
    meta.notes =
      'Standard is the shipped Figma artwork. Outline and Filled are derived here — Outline strokes each shape and fills it with the knockout colour so overlapping shapes still occlude; Filled treats everything but near-white detail as the body. Both are drawn in currentColor and take an accent.';
    meta.updated = new Date().toISOString().slice(0, 10);
    if (!DRY) await writeFile(join(ROOT, rel), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    assets++;
  }

  console.log(`\n${DRY ? 'Would derive' : 'Derived'} Outline + Filled for ${assets} assets — ${drawings} drawings.`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const s of skipped.slice(0, 8)) console.log(`  ${s}`);
  }
  console.log('\n  Everything stays status: draft.\n');
}

main();
