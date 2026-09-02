/**
 * Draw the two figures that Asset Anatomy was explaining in prose.
 *
 * "How it is written down" showed a code block. A reader had to take on faith
 * that two shapes can share one part. So the figure now shows the actual nine
 * shapes of Word, each isolated in place, grouped under the part they belong
 * to — the claim becomes something you can count.
 *
 * "Addressing a part" showed a pill with an address in it. The figure now takes
 * the address apart, names each segment, and shows what the last one reaches:
 * six of nine shapes lit, three left alone.
 *
 * Both are generated from the real artwork rather than drawn by hand, so they
 * cannot drift from the file they describe. Gradient ids are document-global,
 * so every emitted copy gets its own prefix or the eleven svgs on this page
 * would all paint themselves with the first one's gradients.
 *
 *   node scripts/gen-anatomy-figures.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'assets/icons/product/word/standard-48.svg';

/* Word, shape by shape. Six make the document, two make the tile, one is the
   letterform. Read off the artwork, and the reason the figure is worth drawing:
   nothing in the file says this. */
const PARTS = [
  { key: 'base', token: 'p-container', label: 'The document', shapes: [0, 1, 2, 3, 4, 5] },
  { key: 'emblem', token: 'p-emblem', label: 'The tile it sits on', shapes: [6, 7] },
  { key: 'glyph', token: 'p-glyph', label: 'The letterform', shapes: [8] },
];

const svg = await readFile(join(ROOT, SOURCE), 'utf8');

const defs = svg.match(/<defs>[\s\S]*<\/defs>/)?.[0] ?? '';
const body = svg.slice(svg.indexOf('>') + 1, svg.indexOf('<defs>') === -1 ? undefined : svg.indexOf('<defs>'));
const shapes = body.split('\n').map((l) => l.trim()).filter((l) => /^<(path|rect|circle|ellipse|g)\b/.test(l));

if (shapes.length !== 9) throw new Error(`expected 9 shapes in ${SOURCE}, found ${shapes.length}`);

/** One drawing, with `lit` at full strength and everything else barely there.
 *  `ns` keeps this copy's gradients out of every other copy's way. */
function draw(lit, ns, size) {
  const ids = [...defs.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  let d = defs;
  let painted = shapes.map((s, i) =>
    lit.includes(i) ? s : s.replace(/\/>$/, ' opacity="0.055"/>')
  );
  for (const id of ids) {
    const re = new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    d = d.replace(re, `${ns}-${id}`);
    painted = painted.map((s) => s.replace(re, `${ns}-${id}`));
  }
  return (
    `<svg role="img" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 48 48" ` +
    `fill="none" xmlns="http://www.w3.org/2000/svg">${painted.join('')}${d}</svg>`
  );
}

/* --- Figure one: nine shapes, three parts --------------------------- */

const groups = PARTS.map((p) => {
  const chips = p.shapes
    .map(
      (i) =>
        `<figure class="chip">${draw([i], `w${i}`, 46)}` +
        `<figcaption>${i + 1}</figcaption></figure>`
    )
    .join('');
  return (
    `<div class="sgroup" style="--pc:var(--${p.token});--pcb:var(--${p.token}-bg)">` +
    `<div class="sgroup-head"><code>data-part="${p.key}"</code>` +
    `<span class="sgroup-n">${p.shapes.length} shape${p.shapes.length > 1 ? 's' : ''}</span></div>` +
    `<div class="chips">${chips}</div>` +
    `<p class="sgroup-say">${p.label}</p></div>`
  );
}).join('');

const figureOne =
  `<div class="shapes">${groups}</div>` +
  `<p class="fig-note">Every shape carries the attribute; nothing carries a shape number. ` +
  `Shape order is decided by whatever exported the file, so the next re-export from Figma would ` +
  `silently invalidate an index. A name survives it.</p>`;

/* --- Figure two: an address, and what it reaches -------------------- */

const SEGMENTS = [
  ['windows', 'namespace'],
  ['producticon', 'family'],
  ['word', 'asset'],
  ['base', 'part'],
];

/* The separator lives inside the segment it precedes. A dot as its own flex
   item sat on a different baseline and pushed every caption out of line with
   the word it captions. */
const parse = SEGMENTS.map(
  ([v, l], i) =>
    `<span class="addr-seg${i === SEGMENTS.length - 1 ? ' on' : ''}">` +
    `<code>${i ? '<i>.</i>' : ''}${v}</code><span>${l}</span></span>`
).join('');

const base = PARTS[0].shapes;
const figureTwo =
  `<div class="addr-fig">` +
  `<div class="addr-parse">${parse}</div>` +
  `<div class="addr-reach">` +
  `<figure class="reach"><div class="reach-art">${draw(base, 'addr', 96)}</div>` +
  `<figcaption>lit: the ${base.length} shapes this address moves</figcaption></figure>` +
  `<div class="reach-say"><p><strong>One address, six shapes.</strong> Not one per shape &mdash; ` +
  `that is the whole point of a part. The tile and the letterform are untouched, because they are ` +
  `addressed separately.</p>` +
  `<div class="ops"><span>fill</span><span>stroke</span><span>effect</span></div>` +
  `<p class="fig-note">These icons have no strokes at all, so there is nothing to modify. What the ` +
  `address makes possible is <em>authoring</em> one: put a two pixel outline on the base of every ` +
  `product icon and leave the glyph alone.</p></div>` +
  `</div></div>`;

/* --- Splice both in ------------------------------------------------- */

const PAGE = join(ROOT, 'docs/asset-anatomy.html');
let page = await readFile(PAGE, 'utf8');

function replaceBlock(html, name, content) {
  const open = `<!-- generated:${name} -->`;
  const close = `<!-- /generated:${name} -->`;
  const a = html.indexOf(open);
  const b = html.indexOf(close);
  if (a < 0 || b < 0) throw new Error(`markers for "${name}" not found in asset-anatomy.html`);
  return html.slice(0, a + open.length) + '\n' + content + '\n' + html.slice(b);
}

page = replaceBlock(page, 'written', figureOne);
page = replaceBlock(page, 'address', figureTwo);
await writeFile(PAGE, page, 'utf8');

console.log(`Drew both figures from ${SOURCE} — ${shapes.length} shapes, ${PARTS.length} parts.`);
