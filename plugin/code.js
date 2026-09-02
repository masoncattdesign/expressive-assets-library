/**
 * Expressive Assets Sync — main thread.
 *
 * The UI does the fetching, because a plugin's main thread has no network.
 * This side owns the file.
 *
 * Shape of the output: one COMPONENT SET per icon, named for the icon, holding
 * eighteen variants across two properties — Style and Size. That is what makes
 * the page usable rather than merely complete: a designer drops "Word" and
 * switches style and size in the properties panel instead of hunting a grid for
 * the right cell.
 *
 * It syncs rather than regenerates, and that distinction is the whole point.
 * Replacing the artwork INSIDE an existing component keeps the component's
 * identity, so every instance anyone has already placed updates in place. Wiping
 * the page and rebuilding would orphan all of them. Two things make that
 * possible:
 *
 *   name         a variant is `Style=Standard, Size=48`; a set is the icon's
 *                display name. That is how a cell is found again.
 *   shared data  the asset id and a hash of the drawing, under a namespace.
 *                Shared plugin data rather than private, because the REST API
 *                can read it — which is how the trip back into the library will
 *                identify what it is looking at.
 *
 * It never deletes anyone's work. The only nodes it removes are ones it made.
 */

const NS = 'expressiveassets';
const SIZES = [16, 20, 24, 28, 32, 48];
const STYLES = [
  { key: 'standard', label: 'Standard' },
  { key: 'outline', label: 'Outline' },
  { key: 'filled', label: 'Filled' },
];

const PAPER = { r: 1, g: 1, b: 1 };
const FLAG = { r: 0.996, g: 0.953, b: 0.878 };

figma.showUI(__html__, { width: 420, height: 520, themeColors: true });

const solid = (color) => [{ type: 'SOLID', color }];

function text(chars, size, opacity) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = chars;
  t.fontSize = size;
  t.fills = [{ type: 'SOLID', color: { r: 0.086, g: 0.094, b: 0.114 }, opacity }];
  return t;
}

/** Figma has no currentColor, so monochrome artwork has to arrive with a value.
 *  Binding these to a variable instead is the next change here. */
function paint(svg) {
  return svg.split('currentColor').join('#16181D')
            .replace(/var\(--ea-knockout,\s*([^)]+)\)/g, '$1');
}

/** FNV-1a. Short, stable, enough to answer "is this the same drawing". */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const variantName = (style, size) => 'Style=' + style.label + ', Size=' + size;

async function findOrMakePage(name) {
  await figma.loadAllPagesAsync();
  const found = figma.root.children.find((p) => p.name === name);
  if (found) return found;
  const page = figma.createPage();
  page.name = name;
  return page;
}

/**
 * Refuse to write into somebody else's page. The source library file has a page
 * called "Product Icons" holding real design work, and this would happily start
 * filling it in. Safe means empty, or holding nothing but this plugin's board.
 */
function pageIsSafe(page, boardName) {
  if (page.children.length === 0) return true;
  return page.children.every((n) => n.name === boardName && n.type === 'FRAME');
}

function findOrMakeBoard(page, name, count) {
  let board = page.children.find((n) => n.name === name && n.type === 'FRAME');
  if (!board) {
    board = figma.createFrame();
    board.name = name;
    board.x = 0;
    board.y = 0;
    page.appendChild(board);
  }
  board.layoutMode = 'HORIZONTAL';
  board.layoutWrap = 'WRAP';
  board.primaryAxisSizingMode = 'FIXED';
  board.counterAxisSizingMode = 'AUTO';
  board.itemSpacing = CARD_GAP;
  board.counterAxisSpacing = CARD_GAP;
  board.paddingLeft = PAD; board.paddingRight = PAD;
  board.paddingTop = 48; board.paddingBottom = PAD;
  board.fills = solid(PAPER);

  // Cards are taller than they are wide, so an equal column and row count
  // gives a very tall board. Solve for the column count that makes the whole
  // block roughly square instead, and let wrap do the rest.
  const cols = Math.max(3, Math.round(
    Math.sqrt(Math.max(count, 1) * (CARD_H + CARD_GAP) / (CARD_W + CARD_GAP))
  ));
  board.resize(PAD * 2 + cols * CARD_W + (cols - 1) * CARD_GAP, board.height);
  return board;
}

/** The first version of this page laid the icons out in four big frames, one
 *  per style plus a heading. Those are ours, so they can go; anything else on
 *  the board is left where it is. */
function clearOldLayout(board) {
  const old = board.children.filter(
    (n) => n.type === 'FRAME' && ['Heading', 'Standard', 'Outline', 'Filled'].indexOf(n.name) !== -1
  );
  old.forEach((n) => n.remove());
  return old.length;
}

/* The grid, laid out by hand.
   ------------------------------------------------------------------
   Letting Figma auto-arrange the variants was the mistake. A wrap layout
   packs them by intrinsic size, so columns do not line up between rows, the
   largest icon gets clipped by a frame sized before it was added, and there
   is nowhere to hang a label that stays put.

   Component sets accept manually positioned variants, so the grid is
   computed instead: three columns of styles, six rows of sizes, every cell
   the same square with the artwork centered in it. Uniform cells are what
   make the labels alignable, and centring in a constant square is also the
   honest way to show a 16 next to a 48 — you see the size difference against
   something fixed. */

const CELL = 64;
const GAP = 8;
const LEFT = 52;   // room for the size labels
const TOP = 96;    // room for the title and the style labels

const gridX = (col) => col * (CELL + GAP);
const gridY = (row) => row * (CELL + GAP);
const gridW = 3 * CELL + 2 * GAP;
const gridH = 6 * CELL + 5 * GAP;
const CARD_W = LEFT + gridW + 24;
const CARD_H = TOP + gridH + 24;
const CARD_GAP = 24;
const PAD = 56;

/** A variant is a component at the icon's true size, so an instance someone
 *  places is 16x16 when they pick 16. The cell is the space around it. */
function buildVariant(svg, size, flagged) {
  const art = figma.createNodeFromSvg(paint(svg));
  art.name = 'art';
  const comp = figma.createComponent();
  comp.resize(size, size);
  comp.appendChild(art);
  art.x = 0;
  art.y = 0;
  comp.fills = flagged ? solid(FLAG) : [];
  comp.clipsContent = false;
  return comp;
}

function placeVariant(comp, col, row, size) {
  comp.x = gridX(col) + (CELL - size) / 2;
  comp.y = gridY(row) + (CELL - size) / 2;
}

function swapArtwork(comp, svg) {
  const art = figma.createNodeFromSvg(paint(svg));
  art.name = 'art';
  comp.children.slice().forEach((c) => c.remove());
  comp.appendChild(art);
  art.x = 0;
  art.y = 0;
}

/** The card is the bounding box: name, the style headings across the top, the
 *  sizes down the left, and the component set sitting in the grid. */
function dressCard(card, set, asset, generatedCount) {
  card.name = asset.name;
  card.layoutMode = 'NONE';
  card.fills = solid(PAPER);
  card.strokes = solid({ r: 0.902, g: 0.902, b: 0.910 });
  card.strokeWeight = 1;
  card.cornerRadius = 14;
  card.clipsContent = false;
  card.resize(LEFT + gridW + 24, TOP + gridH + 24);

  card.children.slice().forEach((c) => { if (c.type === 'TEXT') c.remove(); });

  const title = text(asset.name, 15, 1);
  title.x = 20; title.y = 18;
  card.appendChild(title);

  const sub = text(asset.id + (generatedCount ? '  ·  ' + generatedCount + ' generated' : ''), 11, 0.5);
  sub.x = 20; sub.y = 40;
  card.appendChild(sub);

  STYLES.forEach((style, col) => {
    const t = text(style.label, 10, 0.5);
    card.appendChild(t);
    t.textAlignHorizontal = 'CENTER';
    t.resize(CELL, t.height);
    t.x = LEFT + gridX(col);
    t.y = TOP - 18;
  });

  SIZES.forEach((size, row) => {
    const t = text(String(size), 10, 0.5);
    card.appendChild(t);
    t.textAlignHorizontal = 'RIGHT';
    t.resize(LEFT - 14, t.height);
    t.x = 6;
    t.y = TOP + gridY(row) + (CELL - t.height) / 2;
  });

  set.x = LEFT;
  set.y = TOP;
}

async function sync(payload) {
  const { assets, drawings, pageName, force } = payload;
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const page = await findOrMakePage(pageName);
  await figma.setCurrentPageAsync(page);

  if (!force && !pageIsSafe(page, pageName)) {
    return {
      refused: true,
      pageName,
      fileName: figma.root.name,
      layers: page.children.length,
      sample: page.children.slice(0, 6).map((n) => n.name),
    };
  }

  const board = findOrMakeBoard(page, pageName, assets.length);
  const removedOld = clearOldLayout(board);

  const report = { sets: 0, created: 0, replaced: 0, unchanged: 0, missing: 0, laid: 0, removedOld };

  // Existing sets, by the asset id stamped on them rather than by display name,
  // so renaming an icon in the library does not orphan its component.
  const existingSets = {};
  for (const node of board.findAll((n) => n.type === 'COMPONENT_SET')) {
    const id = node.getSharedPluginData(NS, 'id') || node.name;
    existingSets[id] = node;
  }

  for (const asset of assets) {
    const generated = asset.generated || [];
    let set = existingSets[asset.id];
    const fresh = [];

    for (const style of STYLES) {
      for (const size of SIZES) {
        const svg = drawings[asset.id + '|' + style.key + '|' + size];
        if (!svg) { report.missing++; continue; }

        const name = variantName(style, size);
        const flagged = generated.indexOf(style.key + ':' + size) !== -1;
        const stamp = hash(svg);
        const existing = set ? set.children.find((c) => c.name === name) : null;

        if (existing) {
          if (existing.getSharedPluginData(NS, 'hash') === stamp) {
            report.unchanged++;
            continue;
          }
          // In place, so every instance already placed updates with it.
          swapArtwork(existing, svg);
          existing.setSharedPluginData(NS, 'hash', stamp);
          existing.fills = flagged ? solid(FLAG) : [];
          report.replaced++;
          continue;
        }

        const comp = buildVariant(svg, size, flagged);
        comp.name = name;
        comp.setSharedPluginData(NS, 'id', asset.id);
        comp.setSharedPluginData(NS, 'style', style.key);
        comp.setSharedPluginData(NS, 'size', String(size));
        comp.setSharedPluginData(NS, 'hash', stamp);
        if (flagged) {
          comp.description = 'Generated here to complete the matrix, not received artwork.';
        }
        fresh.push(comp);
        report.created++;
      }
    }

    if (!set && !fresh.length) continue;

    let card = set && set.parent && set.parent.type === 'FRAME' && set.parent !== board
      ? set.parent
      : null;

    if (!card) {
      card = figma.createFrame();
      board.appendChild(card);
    }

    if (fresh.length) {
      if (set) {
        fresh.forEach((c) => set.appendChild(c));
      } else {
        set = figma.combineAsVariants(fresh, card);
        report.sets++;
      }
    }

    set.name = asset.name;
    set.setSharedPluginData(NS, 'id', asset.id);
    set.description = asset.id + (generated.length
      ? '\n' + generated.length + ' of 18 variants were generated here rather than received.'
      : '');
    set.layoutMode = 'NONE';
    set.clipsContent = false;
    set.fills = [];
    set.strokes = [];
    set.resize(gridW, gridH);

    // Every variant to its computed cell, including ones that already existed.
    STYLES.forEach((style, col) => {
      SIZES.forEach((size, row) => {
        const v = set.children.find((c) => c.name === variantName(style, size));
        if (v) placeVariant(v, col, row, size);
      });
    });

    if (!card.children.includes(set)) card.appendChild(set);
    dressCard(card, set, asset, generated.length);
    report.laid++;
  }

  figma.currentPage.selection = [board];
  figma.viewport.scrollAndZoomIntoView([board]);

  return report;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'docs') {
    try {
      const pages = await syncDocs(msg.payload);
      figma.ui.postMessage({ type: 'docs-done', pages });
    } catch (err) {
      figma.ui.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
    }
    return;
  }
  if (msg.type !== 'sync') return;
  try {
    const result = await sync(msg.payload);
    figma.ui.postMessage({ type: 'done', result });
  } catch (err) {
    figma.ui.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
  }
};

/* ==================================================================== */
/* Documentation pages                                                  */
/* ==================================================================== */

/**
 * Two pages that explain the library inside the file it fills.
 *
 * Someone who opens this Figma file sees several thousand components and no
 * indication of where they came from, who owns them, or what changed last
 * week. That belongs in the file rather than in a link nobody clicks.
 *
 * Both pages are written from the manifest and the changelog, not typed here,
 * so they cannot drift. Both are rebuilt from scratch on each run — unlike the
 * component pages, there is no identity to preserve in a paragraph, and a
 * stale sentence is worse than a rewritten one.
 */

const DOC_W = 720;
const DOC_INK = { r: 0.078, g: 0.09, b: 0.106 };
const DOC_MUTED = { r: 0.44, g: 0.46, b: 0.49 };
const DOC_RULE = { r: 0.894, g: 0.886, b: 0.867 };
const DOC_SUNK = { r: 0.965, g: 0.961, b: 0.949 };

async function loadDocFonts() {
  const wanted = [
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Medium' },
    { family: 'Inter', style: 'Semi Bold' },
  ];
  const ok = [];
  for (const f of wanted) {
    try { await figma.loadFontAsync(f); ok.push(f.style); } catch (e) { /* not installed */ }
  }
  // Everything falls back to Regular, which the component pages already load,
  // so a missing weight costs emphasis rather than the whole run.
  return {
    regular: { family: 'Inter', style: 'Regular' },
    medium: { family: 'Inter', style: ok.indexOf('Medium') !== -1 ? 'Medium' : 'Regular' },
    bold: {
      family: 'Inter',
      style: ok.indexOf('Semi Bold') !== -1 ? 'Semi Bold'
        : ok.indexOf('Medium') !== -1 ? 'Medium' : 'Regular',
    },
  };
}

function docText(chars, size, font, color, lineHeight) {
  const t = figma.createText();
  t.fontName = font;
  t.characters = String(chars);
  t.fontSize = size;
  t.fills = solid(color);
  t.lineHeight = { unit: 'PERCENT', value: lineHeight || 150 };
  t.textAutoResize = 'HEIGHT';
  t.layoutSizingHorizontal = 'FILL';
  return t;
}

function column(gap, padding) {
  const f = figma.createFrame();
  f.layoutMode = 'VERTICAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = gap;
  f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = padding || 0;
  f.fills = [];
  f.clipsContent = false;
  return f;
}

/** A label/value row, which is most of what these pages are. */
function docRow(fonts, k, v) {
  const row = figma.createFrame();
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  row.itemSpacing = 20;
  row.paddingTop = row.paddingBottom = 10;
  row.fills = [];
  row.resize(DOC_W, 10);

  const key = docText(k, 13, fonts.medium, DOC_INK);
  row.appendChild(key);
  key.layoutSizingHorizontal = 'FIXED';
  key.resize(190, key.height);

  const val = docText(v, 13, fonts.regular, DOC_MUTED);
  row.appendChild(val);
  val.layoutSizingHorizontal = 'FILL';
  return row;
}

function docRule() {
  const r = figma.createFrame();
  r.resize(DOC_W, 1);
  r.fills = solid(DOC_RULE);
  return r;
}

function docCard(fonts, title, body) {
  const c = column(6, 18);
  c.fills = solid(DOC_SUNK);
  c.cornerRadius = 10;
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'FIXED';
  c.resize(DOC_W, 10);
  const h = docText(title, 13.5, fonts.bold, DOC_INK);
  c.appendChild(h);
  const p = docText(body, 12.5, fonts.regular, DOC_MUTED);
  c.appendChild(p);
  return c;
}

/** Blocks in, page out. Rebuilt whole, so nothing stale survives. */
async function buildDocPage(pageName, blocks, fonts) {
  const page = await findOrMakePage(pageName);

  const board = page.children.filter(
    (n) => n.getSharedPluginData(NS, 'doc') === pageName
  );
  const foreign = page.children.filter(
    (n) => n.getSharedPluginData(NS, 'doc') !== pageName
  );
  if (foreign.length) return { page: pageName, refused: true, layers: foreign.length };
  board.forEach((n) => n.remove());

  const root = column(0, 56);
  root.name = pageName;
  root.fills = solid(PAPER);
  root.counterAxisSizingMode = 'FIXED';
  root.resize(DOC_W + 112, 10);
  root.setSharedPluginData(NS, 'doc', pageName);
  page.appendChild(root);

  for (const b of blocks) {
    if (b.type === 'h1') {
      const t = docText(b.text, 30, fonts.bold, DOC_INK, 120);
      root.appendChild(t);
      t.layoutSizingHorizontal = 'FILL';
    } else if (b.type === 'h2') {
      const t = docText(b.text, 17, fonts.bold, DOC_INK, 135);
      root.appendChild(t);
      t.layoutSizingHorizontal = 'FILL';
      t.y = 0;
    } else if (b.type === 'p') {
      const t = docText(b.text, 13.5, fonts.regular, DOC_MUTED, 160);
      root.appendChild(t);
      t.layoutSizingHorizontal = 'FILL';
    } else if (b.type === 'lede') {
      const t = docText(b.text, 15, fonts.regular, DOC_MUTED, 160);
      root.appendChild(t);
      t.layoutSizingHorizontal = 'FILL';
    } else if (b.type === 'row') {
      root.appendChild(docRow(fonts, b.k, b.v));
    } else if (b.type === 'card') {
      root.appendChild(docCard(fonts, b.title, b.body));
    } else if (b.type === 'rule') {
      root.appendChild(docRule());
    } else if (b.type === 'space') {
      const s = figma.createFrame();
      s.resize(DOC_W, b.size || 18);
      s.fills = [];
      root.appendChild(s);
    }
  }

  root.itemSpacing = 12;
  return { page: pageName, blocks: blocks.length };
}

/** Compose both pages from the numbers and the changelog the UI fetched. */
async function syncDocs(payload) {
  const fonts = await loadDocFonts();
  const s = payload.stats;
  const out = [];

  const about = [
    { type: 'h1', text: 'Expressive Assets' },
    { type: 'lede', text:
      'The icon and illustration library for Windows Design Systems. Artwork is designed in ' +
      'Figma, imported through a reviewed plan, and stored as flat SVG with metadata beside it. ' +
      'A build step turns that tree into one file, manifest.json, and every tool reads only that.' },
    { type: 'space', size: 6 },
    { type: 'rule' },
    { type: 'h2', text: 'What is in it' },
  ];
  for (const c of s.collections) {
    about.push({ type: 'row', k: c.label, v:
      c.count.toLocaleString() + ' assets  ·  ' + c.sizes + '  ·  ' + c.styles });
  }
  about.push({ type: 'row', k: 'Total', v:
    s.assets.toLocaleString() + ' assets, ' + s.drawings.toLocaleString() + ' drawings' });
  about.push({ type: 'card', title: 'Artwork is redrawn at every size, never scaled',
    body: 'Which is why the unit that matters here is the drawing rather than the icon. ' +
      s.generated.toLocaleString() + ' of those drawings were produced here rather than ' +
      'received, and each one says so in its metadata.' });

  about.push({ type: 'space', size: 6 });
  about.push({ type: 'rule' });
  about.push({ type: 'h2', text: 'This page' });
  about.push({ type: 'p', text:
    'Written by the Expressive Assets Sync plugin from the library itself, so it cannot drift ' +
    'from what the file holds. Rebuilt on every run. Edits made here will not survive the next ' +
    'one — change the library instead.' });

  about.push({ type: 'space', size: 6 });
  about.push({ type: 'rule' });
  about.push({ type: 'h2', text: 'Owner' });
  about.push({ type: 'row', k: 'Mason Catt', v: 'Senior UX/UI Designer, Windows Design Systems' });
  about.push({ type: 'row', k: 'Source', v: 'github.com/masoncattdesign/expressive-assets-library' });
  about.push({ type: 'row', k: 'Gallery', v: 'masoncattdesign.github.io/expressive-assets-library' });
  about.push({ type: 'row', k: 'Issues', v: 'Open one on the repo for a missing asset or a wrong drawing' });

  if (payload.changelog && payload.changelog.length) {
    about.push({ type: 'space', size: 6 });
    about.push({ type: 'rule' });
    about.push({ type: 'h2', text: 'Recently' });
    for (const entry of payload.changelog) {
      about.push({ type: 'h2', text: entry.version });
      for (const line of entry.lines) about.push({ type: 'p', text: '·  ' + line });
    }
  }

  out.push(await buildDocPage('About', about, fonts));

  const started = [
    { type: 'h1', text: 'Get Started' },
    { type: 'lede', text:
      'What is in this file, how it is organized, and how to use the components without ' +
      'fighting them.' },
    { type: 'space', size: 6 },
    { type: 'rule' },
    { type: 'h2', text: 'How this file is organized' },
    { type: 'p', text:
      'One page per collection. Each page holds one component set per icon, and every set is ' +
      'named for the icon rather than for a style or a size.' },
  ];
  for (const c of s.collections) {
    started.push({ type: 'row', k: c.label, v: c.count.toLocaleString() + ' component sets' });
  }

  started.push({ type: 'space', size: 6 });
  started.push({ type: 'rule' });
  started.push({ type: 'h2', text: 'Using an icon' });
  started.push({ type: 'card', title: '1 · Drag the set, not a variant',
    body: 'Every icon is one component set with Style and Size as properties. Place the set and ' +
      'switch both in the properties panel. You never have to hunt the grid for the right cell.' });
  started.push({ type: 'card', title: '2 · Leave the instance attached',
    body: 'The plugin replaces artwork inside components rather than rebuilding them, so an ' +
      'instance you placed today picks up a redrawn icon tomorrow. Detaching opts out of that ' +
      'for good.' });
  started.push({ type: 'card', title: '3 · A variant is drawn at its own size',
    body: 'Size 16 is a different drawing from size 48, not a smaller copy. Scaling a 48 down to ' +
      '16 throws away the drawing that exists for 16.' });

  started.push({ type: 'space', size: 6 });
  started.push({ type: 'rule' });
  started.push({ type: 'h2', text: 'Styles' });
  started.push({ type: 'row', k: 'Standard', v: 'Brand color, as the artwork ships. Not recolorable.' });
  started.push({ type: 'row', k: 'Outline', v: 'Monochrome, drawn in currentColor, takes an accent.' });
  started.push({ type: 'row', k: 'Filled', v: 'Monochrome and solid, the inverse of Outline.' });
  started.push({ type: 'p', text:
    'Not every collection has all three. System Icons are Outline and Filled only, because a ' +
    'system icon is a monochrome glyph and a Standard would be inventing one.' });

  started.push({ type: 'space', size: 6 });
  started.push({ type: 'rule' });
  started.push({ type: 'h2', text: 'Flagged variants' });
  started.push({ type: 'card', title: 'A cream background means the drawing was generated here',
    body: s.generated.toLocaleString() + ' of ' + s.drawings.toLocaleString() + ' drawings were ' +
      'produced to complete a style-by-size grid rather than received as artwork. They are usable ' +
      'and they are flagged, so a stand-in is never mistaken for a drawing somebody made.' });

  started.push({ type: 'space', size: 6 });
  started.push({ type: 'rule' });
  started.push({ type: 'h2', text: 'Getting it updated' });
  started.push({ type: 'p', text:
    'Run Plugins › Expressive Assets Sync and pick a collection. It adds what is missing, ' +
    'replaces artwork inside components that changed, and leaves everything else alone. It ' +
    'never deletes.' });

  out.push(await buildDocPage('Get Started', started, fonts));
  return out;
}
