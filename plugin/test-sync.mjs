/**
 * Run the plugin's main thread against a fake Figma, in Node.
 *
 * `node --check` only proves the file parses. It said nothing when a rewrite
 * deleted clearOldLayout, and nothing when an early `continue` skipped the
 * whole layout — both of which cost a real run in Figma to discover. This
 * executes sync() end to end against enough of a stub to catch a missing
 * function, an unplaced variant, or a card that never got dressed.
 *
 *   node plugin/test-sync.mjs
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));

let idSeq = 0;
function node(type, extra = {}) {
  const n = {
    id: String(++idSeq), type, name: '', x: 0, y: 0, width: 100, height: 100,
    children: [], parent: null, _data: {},
    appendChild(c) {
      if (c.parent) c.parent.children = c.parent.children.filter((k) => k !== c);
      c.parent = n; n.children.push(c);
    },
    remove() { if (n.parent) n.parent.children = n.parent.children.filter((k) => k !== n); },
    resize(w, h) { n.width = w; n.height = h; },
    findAll(fn) {
      const out = [];
      (function walk(x) { x.children.forEach((c) => { if (fn(c)) out.push(c); walk(c); }); })(n);
      return out;
    },
    setSharedPluginData(ns, k, v) { n._data[ns + ':' + k] = String(v); },
    getSharedPluginData(ns, k) { return n._data[ns + ':' + k] || ''; },
    // Auto-layout sizing calls are no-ops here; what matters is that they exist,
    // because a missing setter on a text node throws mid-page and leaves half
    // a document behind.
    set layoutSizingHorizontal(v) { n._sizing = v; },
    get layoutSizingHorizontal() { return n._sizing; },
    ...extra,
  };
  return n;
}

const pages = [];
const figma = {
  root: { name: 'Test File', get children() { return pages; } },
  currentPage: null,
  viewport: { scrollAndZoomIntoView() {} },
  ui: { onmessage: null, postMessage() {} },
  showUI() {},
  async loadAllPagesAsync() {},
  async loadFontAsync(f) {
    // Only Regular is installed in this stub, which is the interesting case:
    // the page has to fall back rather than throw.
    if (f && f.style !== 'Regular') throw new Error('font not available: ' + f.style);
  },
  async setCurrentPageAsync(p) { figma.currentPage = p; },
  createPage() { const p = node('PAGE'); pages.push(p); return p; },
  createFrame() { return node('FRAME'); },
  createText() {
    const t = node('TEXT', { characters: '', fontSize: 12, height: 14 });
    t.fontName = { family: 'Inter', style: 'Regular' };
    return t;
  },
  createComponent() { return node('COMPONENT'); },
  createNodeFromSvg(svg) { return node('FRAME', { _svg: svg }); },
  combineAsVariants(list, parent) {
    const set = node('COMPONENT_SET');
    parent.appendChild(set);
    list.forEach((c) => set.appendChild(c));
    return set;
  },
};

globalThis.figma = figma;
const src = await readFile(join(HERE, 'code.js'), 'utf8');
new Function('figma', '__html__', src)(figma, '');
assert.ok(figma.ui.onmessage, 'the plugin never registered a message handler');

/* Two icons, the full 3 x 6 matrix, one of them carrying generated cells. */
const SIZES = [16, 20, 24, 28, 32, 48];
const STYLES = ['standard', 'outline', 'filled'];
const assets = [
  { id: 'product.word', name: 'Word', generated: [] },
  { id: 'product.excel', name: 'Excel', generated: ['outline:28', 'filled:28'] },
];
const drawings = {};
for (const a of assets) {
  for (const s of STYLES) {
    for (const z of SIZES) {
      drawings[a.id + '|' + s + '|' + z] = `<svg viewBox="0 0 ${z} ${z}"><rect width="${z}" height="${z}"/></svg>`;
    }
  }
}

function run() {
  return new Promise((resolve) => {
    figma.ui.postMessage = (m) => resolve(m);
    figma.ui.onmessage({ type: 'sync', payload: { assets, drawings, pageName: 'Product Icons' } });
  });
}

function check(label, r) {
  assert.equal(r.type, 'done', `${label}: ${r.message || 'sync failed'}`);
  const board = figma.currentPage.children.find((n) => n.name === 'Product Icons');
  assert.ok(board, `${label}: no board`);
  assert.equal(board.children.length, assets.length, `${label}: expected one card per icon`);

  for (const card of board.children) {
    const set = card.children.find((c) => c.type === 'COMPONENT_SET');
    assert.ok(set, `${label}: ${card.name} has no component set`);
    assert.equal(set.children.length, 18, `${label}: ${card.name} has ${set.children.length} variants`);

    // Dressed: a title, an id line, three style headings, six size labels.
    const texts = card.children.filter((c) => c.type === 'TEXT');
    assert.equal(texts.length, 11, `${label}: ${card.name} has ${texts.length} labels, expected 11`);

    // Laid out: every variant inside the card, nothing stacked at the origin.
    const seen = new Set();
    for (const v of set.children) {
      const key = v.x + ',' + v.y;
      assert.ok(!seen.has(key), `${label}: ${card.name} stacks variants at ${key}`);
      seen.add(key);
      assert.ok(v.x >= 0 && v.y >= 0, `${label}: ${card.name} places a variant off the card`);
      assert.ok(set.x + v.x + v.width <= card.width, `${label}: ${card.name} overflows its card`);
      assert.ok(set.y + v.y + v.height <= card.height, `${label}: ${card.name} overflows its card`);
    }
  }
  return { board, r };
}

const first = await run();
const a = check('first run', first);
assert.equal(a.r.result.created, 36, 'first run should create every variant');
assert.equal(a.r.result.laid, 2, 'first run should lay out both cards');

/* The bug that shipped: a second run changes nothing and so laid out nothing. */
const second = await run();
const b = check('second run', second);
assert.equal(b.r.result.created, 0, 'second run should create nothing');
assert.equal(b.r.result.replaced, 0, 'second run should replace nothing');
assert.equal(b.r.result.unchanged, 36, 'second run should find every variant unchanged');
assert.equal(b.r.result.laid, 2, 'second run must still lay out both cards');
assert.equal(b.board.children.length, 2, 'second run must not duplicate cards');

/* Changed artwork replaces in place rather than making a new component. */
const before = b.board.findAll((n) => n.type === 'COMPONENT').length;
drawings['product.word|standard|48'] = '<svg viewBox="0 0 48 48"><circle r="9"/></svg>';
const third = await run();
const c = check('third run', third);
assert.equal(c.r.result.replaced, 1, 'changed artwork should replace exactly one variant');
assert.equal(c.board.findAll((n) => n.type === 'COMPONENT').length, before, 'replacing must not add components');

/* --- Documentation pages ------------------------------------------- */

const stats = {
  assets: 3234,
  drawings: 14114,
  generated: 980,
  collections: [
    { label: 'Product Icons', count: 90, sizes: '16–48', styles: 'standard, outline, filled' },
    { label: 'System Icons', count: 2891, sizes: '20, 24', styles: 'outline, filled' },
  ],
};
const changelog = [{ version: '2.0 — 1 September 2026', lines: ['Contract break.', 'Sidebar splits.'] }];

function runDocs() {
  return new Promise((resolve) => {
    figma.ui.postMessage = (m) => resolve(m);
    figma.ui.onmessage({ type: 'docs', payload: { stats, changelog } });
  });
}

const d1 = await runDocs();
assert.equal(d1.type, 'docs-done', `docs failed: ${d1.message || ''}`);
assert.equal(d1.pages.length, 2, 'expected an About and a Get Started');
for (const p of d1.pages) {
  assert.ok(!p.refused, `${p.page} was refused on an empty file`);
  assert.ok(p.blocks > 10, `${p.page} has only ${p.blocks} blocks`);
}

const aboutPage = pages.find((p) => p.name === 'About');
assert.ok(aboutPage, 'no About page was made');
const texts = aboutPage.findAll((n) => n.type === 'TEXT');
assert.ok(texts.some((t) => t.characters.includes('3,234')), 'About never states the asset count');
assert.ok(texts.some((t) => t.characters.includes('Mason Catt')), 'About has no owner');
assert.ok(texts.some((t) => t.characters.includes('2.0')), 'About omitted the changelog');
assert.ok(texts.every((t) => t.fontName.style === 'Regular'),
  'a weight was used that this stub never installed — the fallback did not hold');

/* Rebuilt whole, not appended to. */
const aboutSize = aboutPage.findAll(() => true).length;
const d2 = await runDocs();
assert.equal(d2.type, 'docs-done', 'second docs run failed');
assert.equal(pages.filter((p) => p.name === 'About').length, 1, 'a second About page was made');
assert.equal(
  pages.find((p) => p.name === 'About').findAll(() => true).length, aboutSize,
  'the About page grew on a second run — it is appending rather than rebuilding'
);

/* Somebody else's page is left alone. */
const gs = pages.find((p) => p.name === 'Get Started');
const mine = figma.createFrame();
mine.name = 'My notes';
gs.appendChild(mine);
const d3 = await runDocs();
assert.ok(d3.pages.some((p) => p.page === 'Get Started' && p.refused),
  'the plugin overwrote a page holding work it did not make');
assert.ok(gs.children.includes(mine), 'it removed a layer it did not make');

console.log('✓ sync builds, re-lays out, and replaces in place — 3 runs');
console.log('✓ docs pages build, rebuild whole, fall back on fonts, and refuse a page with other work');
