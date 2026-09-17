#!/usr/bin/env node
/**
 * Measures the illustration collections and prints numbers.
 *
 * Written for one question: does a Windows illustration fit the twelve layout
 * taxonomy the Builder inherited, or is it a different kind of drawing that
 * needs its own parts vocabulary? That is not answerable by looking at three
 * files, because the failure mode is a set that is mostly consistent with a
 * handful of expensive exceptions, and the exceptions are what decide it.
 *
 * Everything is normalized to the Builder's 160 unit canvas so the numbers can
 * be compared against the language directly: a stroke of 6.93 on a 360 canvas
 * is a stroke of 3.08 here, and the language says every stroke is 0.5.
 *
 * Reads manifest.json, never the asset tree. Standard library only.
 *
 *   node scripts/illo-survey.mjs                 summary to stdout
 *   node scripts/illo-survey.mjs --tsv out.tsv   plus a row per illustration
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { argv } from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;
const CANVAS = 160;                       // the Builder's canvas
const COLLECTIONS = ['oobe', 'm365', 'device'];

const manifest = JSON.parse(readFileSync(ROOT + 'manifest.json', 'utf8'));
const assets = manifest.assets.filter((a) => COLLECTIONS.includes(a.collection));

/* --- tiny helpers ------------------------------------------------------- */

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};
const tagsOf = (svg, name) => svg.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) || [];
const num = (v) => (v === null || v === '' ? null : Number(v));

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round = (v, p = 2) => (v === null ? null : Number(v.toFixed(p)));
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/* --- one illustration ---------------------------------------------------- */

function measure(asset) {
  const variants = Object.values(asset.variants || {})[0] || {};
  const path = Object.values(variants)[0];
  if (!path) return null;
  const svg = readFileSync(ROOT + path, 'utf8');

  const root = /<svg\b[^>]*>/.exec(svg)?.[0] || '';
  const vb = (attr(root, 'viewBox') || '0 0 160 160').trim().split(/\s+/).map(Number);
  const w = vb[2] || 160;
  const h = vb[3] || 160;
  const k = CANVAS / w;                    // scale everything into Builder units

  /* Structure. Depth is counted on <g> nesting, because a scene drawn as one
     flat list of shapes and a scene drawn as assembled parts are different
     source material even when they render identically. */
  let depth = 0, maxDepth = 0;
  for (const m of svg.matchAll(/<(\/?)g\b/g)) {
    if (m[1]) depth--; else { depth++; maxDepth = Math.max(maxDepth, depth); }
  }

  /* Paint. A gradient reference and a literal hex are counted apart: the
     first is a ramp the Customizer could drive, the second is a decision
     baked into the file. */
  const fills = new Set(), gradRefs = new Set();
  let currentColorFills = 0;
  for (const m of svg.matchAll(/\sfill="([^"]+)"/g)) {
    const v = m[1];
    if (v === 'none') continue;
    if (v === 'currentColor') { currentColorFills++; continue; }
    if (v.startsWith('url(')) gradRefs.add(v);
    else fills.add(v.toUpperCase());
  }

  /* Line work. The one number that decides whether this language has strokes
     at all, normalized so it can be read against 0.5. */
  const strokeWidths = [], strokeColors = new Set();
  let gradientStrokes = 0, strokeOpacity = 0;
  for (const tag of svg.match(/<[^>]*\sstroke="[^"]*"[^>]*>/g) || []) {
    const s = attr(tag, 'stroke');
    if (!s || s === 'none') continue;
    if (s.startsWith('url(')) gradientStrokes++; else strokeColors.add(s.toUpperCase());
    const sw = num(attr(tag, 'stroke-width'));
    if (sw !== null) strokeWidths.push(sw * k);
    if (attr(tag, 'stroke-opacity') !== null) strokeOpacity++;
  }

  /* Depth effects. The language allows exactly one drop shadow shape, twice.
     Inner shadows (feDropShadow inside a filter with an feComposite in, or the
     Figma `_ii_` naming) are a different model entirely. */
  const filterDefs = tagsOf(svg, 'filter').length;
  const filterUses = (svg.match(/\sfilter="url\(/g) || []).length;
  const innerShadow = (svg.match(/_ii_|feComposite|in2="SourceAlpha"/g) || []).length;
  const blurs = (svg.match(/<feGaussianBlur\b/g) || []).length;

  /* Corner language. rx on rects, normalized. Reading the actual radii is the
     only way to know whether a preset multiplier can express this set. */
  const radii = [];
  for (const tag of tagsOf(svg, 'rect')) {
    const rx = num(attr(tag, 'rx'));
    const rw = num(attr(tag, 'width'));
    if (rx !== null && rx > 0) radii.push({ r: rx * k, rel: rw ? rx / rw : null });
  }

  const gradients = tagsOf(svg, 'linearGradient').length + tagsOf(svg, 'radialGradient').length;
  const stops = tagsOf(svg, 'stop').length;
  const shapes = ['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline']
    .reduce((n, t) => n + tagsOf(svg, t).length, 0);

  return {
    id: asset.id,
    collection: asset.collection,
    w, h,
    aspect: round(w / h),
    sizes: (asset.sizes || []).join('/'),
    recolorable: asset.recolorable === true,
    bytes: svg.length,
    shapes,
    maxDepth,
    fills: fills.size,
    fillList: [...fills],
    gradRefs: gradRefs.size,
    currentColorFills,
    gradients,
    stops,
    strokes: strokeWidths.length + gradientStrokes,
    strokeWidthMed: round(median(strokeWidths)),
    strokeWidthMin: round(strokeWidths.length ? Math.min(...strokeWidths) : null),
    strokeWidthMax: round(strokeWidths.length ? Math.max(...strokeWidths) : null),
    strokeColors: strokeColors.size,
    gradientStrokes,
    strokeOpacity,
    filterDefs, filterUses, innerShadow, blurs,
    radiiCount: radii.length,
    radiusMed: round(median(radii.map((r) => r.r))),
    radiusMax: round(radii.length ? Math.max(...radii.map((r) => r.r)) : null),
    hasText: /<text\b/.test(svg),
    hasImage: /<image\b/.test(svg),
    hasClip: /<clipPath\b/.test(svg),
    opacityUses: (svg.match(/\sopacity="/g) || []).length,
  };
}

const rows = assets.map(measure).filter(Boolean);

/* --- aggregate ----------------------------------------------------------- */

const sum = (f) => rows.reduce((n, r) => n + (f(r) || 0), 0);
const all = (f) => rows.map(f).filter((v) => v !== null && v !== undefined);
const countWhere = (f) => rows.filter(f).length;
const n = rows.length;

const canvases = {};
rows.forEach((r) => { const key = `${r.w}x${r.h}`; canvases[key] = (canvases[key] || 0) + 1; });

const byCollection = {};
rows.forEach((r) => {
  const c = byCollection[r.collection] || (byCollection[r.collection] = { n: 0, fills: 0, shapes: 0, filters: 0, strokes: 0 });
  c.n++; c.fills += r.fills; c.shapes += r.shapes; c.filters += r.filterUses; c.strokes += r.strokes;
});

const everyFill = new Set();
rows.forEach((r) => r.fillList.forEach((f) => everyFill.add(f)));

const strokeMeds = all((r) => r.strokeWidthMed);
const radMeds = all((r) => r.radiusMed);

const L = console.log;
L(`\n=== ${n} illustrations, measured ===\n`);

L('CANVAS');
Object.entries(canvases).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => L(`  ${k.padEnd(12)} ${v}`));
L(`  aspect ratios: ${[...new Set(rows.map((r) => r.aspect))].sort().join(', ')}`);
L(`  one drawing per asset at every size: ${countWhere((r) => r.sizes.includes('/'))} of ${n} list several sizes for one file`);

L('\nSCALE, normalized to a 160 canvas');
L(`  shapes per illustration: median ${median(all((r) => r.shapes))}, max ${Math.max(...all((r) => r.shapes))}`);
L(`  the Builder's twelve layouts use roughly 20 to 45 shapes each`);
L(`  max group nesting: median ${median(all((r) => r.maxDepth))}, max ${Math.max(...all((r) => r.maxDepth))}`);

L('\nCOLOR');
L(`  distinct literal fills per illustration: median ${median(all((r) => r.fills))}, max ${Math.max(...all((r) => r.fills))}`);
L(`  distinct literal fills across the whole set: ${everyFill.size}`);
L(`  illustrations using gradients: ${countWhere((r) => r.gradients > 0)} of ${n} (${pct(countWhere((r) => r.gradients > 0), n)}%)`);
L(`  gradients per illustration: median ${median(all((r) => r.gradients))}, max ${Math.max(...all((r) => r.gradients))}`);
L(`  the language allows exactly one gradient, the panel's`);
L(`  currentColor fills anywhere in the set: ${sum((r) => r.currentColorFills)}`);
L(`  marked recolorable in the manifest: ${countWhere((r) => r.recolorable)} of ${n}`);

L('\nLINE WORK');
L(`  illustrations with any stroke: ${countWhere((r) => r.strokes > 0)} of ${n} (${pct(countWhere((r) => r.strokes > 0), n)}%)`);
if (strokeMeds.length) {
  L(`  stroke width in 160 units: median ${round(median(strokeMeds))}, ` +
    `min ${round(Math.min(...all((r) => r.strokeWidthMin)))}, max ${round(Math.max(...all((r) => r.strokeWidthMax)))}`);
}
L(`  the language's one stroke is 0.5`);
L(`  strokes painted with a gradient: ${sum((r) => r.gradientStrokes)}`);
L(`  strokes carrying their own opacity: ${sum((r) => r.strokeOpacity)}`);

L('\nDEPTH');
L(`  illustrations using a filter: ${countWhere((r) => r.filterUses > 0)} of ${n} (${pct(countWhere((r) => r.filterUses > 0), n)}%)`);
L(`  filter applications per illustration: median ${median(all((r) => r.filterUses))}, max ${Math.max(...all((r) => r.filterUses))}`);
L(`  the language allows one, and two only for the corner chip pair`);
L(`  illustrations with inner shadow machinery: ${countWhere((r) => r.innerShadow > 0)} of ${n}`);
L(`  illustrations using a gaussian blur: ${countWhere((r) => r.blurs > 0)} of ${n}`);

L('\nCORNERS, normalized to a 160 canvas');
if (radMeds.length) {
  L(`  rounded rects per illustration: median ${median(all((r) => r.radiiCount))}`);
  L(`  radius: median ${round(median(radMeds))}, max ${round(Math.max(...all((r) => r.radiusMax)))}`);
  L(`  the language's panel radius is 10, cards 8`);
}

L('\nOTHER');
L(`  illustrations containing text: ${countWhere((r) => r.hasText)}`);
L(`  containing a raster image: ${countWhere((r) => r.hasImage)}`);
L(`  using a clip path: ${countWhere((r) => r.hasClip)}`);
L(`  opacity attributes in the set: ${sum((r) => r.opacityUses)}`);

L('\nBY COLLECTION');
Object.entries(byCollection).forEach(([c, v]) => {
  L(`  ${c.padEnd(8)} ${String(v.n).padStart(3)} assets · ` +
    `${(v.shapes / v.n).toFixed(0)} shapes · ${(v.fills / v.n).toFixed(1)} fills · ` +
    `${(v.filters / v.n).toFixed(1)} filters · ${(v.strokes / v.n).toFixed(1)} strokes, each on average`);
});

/* The point of the whole survey, stated as a count rather than a feeling. */
L('\nAGAINST THE LANGUAGE');
const breaks = [
  ['more than one gradient', (r) => r.gradients > 1],
  ['more than one filter applied', (r) => r.filterUses > 1],
  ['any stroke wider than 1 unit', (r) => r.strokeWidthMax !== null && r.strokeWidthMax > 1],
  ['more than one stroke color', (r) => r.strokeColors > 1],
  ['more than six distinct fills', (r) => r.fills > 6],
  ['inner shadows', (r) => r.innerShadow > 0],
  ['a gaussian blur', (r) => r.blurs > 0],
];
breaks.forEach(([label, f]) => {
  const c = countWhere(f);
  L(`  ${String(c).padStart(3)} of ${n} (${String(pct(c, n)).padStart(3)}%)  ${label}`);
});
const clean = countWhere((r) => !breaks.some(([, f]) => f(r)));
L(`\n  ${clean} of ${n} would pass the Builder's checks unchanged.`);

if (argv.includes('--tsv')) {
  const out = argv[argv.indexOf('--tsv') + 1] || 'illo-survey.tsv';
  const cols = Object.keys(rows[0]).filter((c) => c !== 'fillList');
  writeFileSync(out, [cols.join('\t'), ...rows.map((r) => cols.map((c) => r[c]).join('\t'))].join('\n'));
  L(`\nwrote ${out}: ${rows.length} rows, ${cols.length} columns`);
}
