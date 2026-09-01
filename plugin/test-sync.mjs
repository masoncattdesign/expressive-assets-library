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
  async loadFontAsync() {},
  async setCurrentPageAsync(p) { figma.currentPage = p; },
  createPage() { const p = node('PAGE'); pages.push(p); return p; },
  createFrame() { return node('FRAME'); },
  createText() { return node('TEXT', { characters: '', fontSize: 12, height: 14 }); },
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

console.log('✓ sync builds, re-lays out, and replaces in place — 3 runs, all assertions passed');
