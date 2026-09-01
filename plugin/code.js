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
  board.itemSpacing = 32;
  board.counterAxisSpacing = 32;
  board.paddingLeft = 56; board.paddingRight = 56;
  board.paddingTop = 48; board.paddingBottom = 56;
  board.fills = solid(PAPER);
  if (board.width < 1400) board.resize(1800, board.height);
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

/** A variant is a component wrapping one SVG frame, sized to the icon. */
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

function swapArtwork(comp, svg) {
  const art = figma.createNodeFromSvg(paint(svg));
  art.name = 'art';
  comp.children.slice().forEach((c) => c.remove());
  comp.appendChild(art);
  art.x = 0;
  art.y = 0;
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
  for (const node of board.children) {
    if (node.type !== 'COMPONENT_SET') continue;
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

    if (set) {
      fresh.forEach((c) => set.appendChild(c));
    } else {
      set = figma.combineAsVariants(fresh, board);
      report.sets++;
    }

    set.name = asset.name;
    set.setSharedPluginData(NS, 'id', asset.id);
    set.description = asset.id + (placeholders.length
      ? '\n' + placeholders.length + ' of 18 variants are generated rather than authored.'
      : '');
    set.layoutMode = 'HORIZONTAL';
    set.layoutWrap = 'WRAP';
    set.itemSpacing = 20;
    set.counterAxisSpacing = 20;
    set.paddingLeft = 20; set.paddingRight = 20;
    set.paddingTop = 20; set.paddingBottom = 20;
    set.resize(Math.max(set.width, 420), set.height);
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
