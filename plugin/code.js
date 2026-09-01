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

function findOrMakeBoard(page, name) {
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
  board.itemSpacing = 24;
  board.counterAxisSpacing = 24;
  board.paddingLeft = 56; board.paddingRight = 56;
  board.paddingTop = 48; board.paddingBottom = 56;
  board.fills = solid(PAPER);
  if (board.width < 1400) board.resize(1720, board.height);
  return board;
}

/** The first version of this plugin laid the page out as three style sections
 *  of ninety rows. Those are ours, so they can go. */
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
   the same square with the artwork centred in it. Uniform cells are what
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
function dressCard(card, set, asset, placeholderCount) {
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

  const sub = text(asset.id + (placeholderCount ? '  ·  ' + placeholderCount + ' generated' : ''), 11, 0.5);
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

  const board = findOrMakeBoard(page, pageName);
  const removedOld = clearOldLayout(board);

  const report = { sets: 0, created: 0, replaced: 0, unchanged: 0, missing: 0, removedOld };

  // Existing sets, by the asset id stamped on them rather than by display name,
  // so renaming an icon in the library does not orphan its component.
  const existingSets = {};
  for (const node of board.findAll((n) => n.type === 'COMPONENT_SET')) {
    const id = node.getSharedPluginData(NS, 'id') || node.name;
    existingSets[id] = node;
  }

  for (const asset of assets) {
    const placeholders = asset.placeholders || [];
    let set = existingSets[asset.id];
    const fresh = [];

    for (const style of STYLES) {
      for (const size of SIZES) {
        const svg = drawings[asset.id + '|' + style.key + '|' + size];
        if (!svg) { report.missing++; continue; }

        const name = variantName(style, size);
        const flagged = placeholders.indexOf(style.key + ':' + size) !== -1;
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
          comp.description = 'Generated to complete the matrix, not authored artwork.';
        }
        fresh.push(comp);
        report.created++;
      }
    }

    if (!fresh.length) continue;

    let card = set && set.parent && set.parent.type === 'FRAME' && set.parent !== board
      ? set.parent
      : null;

    if (!card) {
      card = figma.createFrame();
      board.appendChild(card);
    }

    if (set) {
      fresh.forEach((c) => set.appendChild(c));
    } else {
      set = figma.combineAsVariants(fresh, card);
      report.sets++;
    }

    set.name = asset.name;
    set.setSharedPluginData(NS, 'id', asset.id);
    set.description = asset.id + (placeholders.length
      ? '\n' + placeholders.length + ' of 18 variants are generated rather than authored.'
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
    dressCard(card, set, asset, placeholders.length);
  }

  figma.currentPage.selection = [board];
  figma.viewport.scrollAndZoomIntoView([board]);

  return report;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'sync') return;
  try {
    const result = await sync(msg.payload);
    figma.ui.postMessage({ type: 'done', result });
  } catch (err) {
    figma.ui.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
  }
};
