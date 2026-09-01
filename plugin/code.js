/**
 * Expressive Assets Sync — main thread.
 *
 * The UI does the fetching, because a Figma plugin's main thread has no
 * network. This side owns the file: it finds or builds the layout, then for
 * each cell decides create, replace or leave alone.
 *
 * The whole design rests on two things being true of every artwork node:
 *
 *   name        `<asset id>/<style>/<size>` — how a cell is found again on the
 *               next run, and how the importer will read it going the other
 *               way. Stable across moves, broken by renames.
 *   plugin data the hash of the drawing this node was made from, so "did the
 *               library change" is answerable without diffing SVG text.
 *
 * It never deletes. A node the library does not know about is reported and
 * left where it is.
 */

const SIZES = [16, 20, 24, 28, 32, 48];
const STYLES = [
  { key: 'standard', label: 'Standard' },
  { key: 'outline', label: 'Outline' },
  { key: 'filled', label: 'Filled' },
];

const INK = { r: 0.086, g: 0.094, b: 0.114 };
const PAPER = { r: 1, g: 1, b: 1 };
const CELL = { r: 0.976, g: 0.98, b: 0.988 };
const FLAG = { r: 0.996, g: 0.953, b: 0.878 };
const KEY = 'ea-hash';

figma.showUI(__html__, { width: 420, height: 480, themeColors: true });

const solid = (color) => [{ type: 'SOLID', color }];

function text(chars, size, opacity) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.characters = chars;
  t.fontSize = size;
  t.fills = [{ type: 'SOLID', color: INK, opacity }];
  return t;
}

/** Figma has no currentColor: monochrome artwork has to arrive with a value.
 *  Bound to a variable would be better and is the next change here. */
function paint(svg) {
  return svg.split('currentColor').join('#16181D')
            .replace(/var\(--ea-knockout,\s*([^)]+)\)/g, '$1');
}

/** FNV-1a. Short, stable, and good enough to answer "is this the same file". */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function findOrMakePage(name) {
  await figma.loadAllPagesAsync();
  const found = figma.root.children.find((p) => p.name === name);
  if (found) return found;
  const page = figma.createPage();
  page.name = name;
  return page;
}

function findOrMakeBoard(page, name) {
  const found = page.children.find((n) => n.name === name && n.type === 'FRAME');
  if (found) return found;
  const board = figma.createFrame();
  board.name = name;
  board.layoutMode = 'VERTICAL';
  board.primaryAxisSizingMode = 'AUTO';
  board.counterAxisSizingMode = 'AUTO';
  board.itemSpacing = 40;
  board.paddingLeft = 56; board.paddingRight = 56;
  board.paddingTop = 48; board.paddingBottom = 56;
  board.fills = solid(PAPER);
  board.x = 0; board.y = 0;
  page.appendChild(board);
  return board;
}

function findOrMakeSection(board, label) {
  const found = board.children.find((n) => n.name === label);
  if (found) return found;
  const section = figma.createFrame();
  section.name = label;
  section.layoutMode = 'VERTICAL';
  section.primaryAxisSizingMode = 'AUTO';
  section.counterAxisSizingMode = 'AUTO';
  section.itemSpacing = 14;
  section.fills = [];
  section.appendChild(text(label.toUpperCase(), 11, 0.45));
  board.appendChild(section);
  return section;
}

function findOrMakeRow(section, asset) {
  const found = section.children.find((n) => n.name === asset.id);
  if (found) return found;
  const row = figma.createFrame();
  row.name = asset.id;
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisSizingMode = 'AUTO';
  row.counterAxisSizingMode = 'AUTO';
  row.counterAxisAlignItems = 'CENTER';
  row.itemSpacing = 16;
  row.paddingTop = 10; row.paddingBottom = 10;
  row.paddingLeft = 14; row.paddingRight = 14;
  row.cornerRadius = 10;
  row.fills = solid(CELL);
  const label = text(asset.name, 12, 0.85);
  row.appendChild(label);
  label.layoutSizingHorizontal = 'FIXED';
  label.resize(120, label.height);
  section.appendChild(row);
  return row;
}

function findOrMakeCell(row, size, flagged) {
  const name = String(size);
  let cell = row.children.find((n) => n.name === name && n.type === 'FRAME');
  if (!cell) {
    cell = figma.createFrame();
    cell.name = name;
    cell.layoutMode = 'VERTICAL';
    cell.primaryAxisSizingMode = 'AUTO';
    cell.counterAxisSizingMode = 'FIXED';
    cell.counterAxisAlignItems = 'CENTER';
    cell.primaryAxisAlignItems = 'CENTER';
    cell.itemSpacing = 8;
    cell.paddingTop = 6; cell.paddingBottom = 6;
    cell.cornerRadius = 6;
    cell.appendChild(text(name, 10, 0.4));
    row.appendChild(cell);
    cell.resize(76, cell.height);
  }
  // A generated cell reads at a glance, which is the point of the board.
  cell.fills = flagged ? solid(FLAG) : [];
  return cell;
}

async function sync(payload) {
  const { assets, drawings, pageName } = payload;
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const page = await findOrMakePage(pageName);
  await figma.setCurrentPageAsync(page);
  const board = findOrMakeBoard(page, pageName);

  const report = { created: 0, replaced: 0, unchanged: 0, missing: 0, seen: [] };

  for (const style of STYLES) {
    const section = findOrMakeSection(board, style.label);

    for (const asset of assets) {
      const row = findOrMakeRow(section, asset);
      const placeholders = asset.placeholders || [];

      for (const size of SIZES) {
        const key = `${asset.id}|${style.key}|${size}`;
        const svg = drawings[key];
        const nodeName = `${asset.id}/${style.key}/${size}`;
        report.seen.push(nodeName);

        if (!svg) { report.missing++; continue; }

        const flagged = placeholders.indexOf(`${style.key}:${size}`) !== -1;
        const cell = findOrMakeCell(row, size, flagged);
        const existing = cell.children.find((n) => n.name === nodeName);
        const stamp = hash(svg);

        if (existing && existing.getPluginData(KEY) === stamp) {
          report.unchanged++;
          continue;
        }

        const art = figma.createNodeFromSvg(paint(svg));
        art.name = nodeName;
        art.setPluginData(KEY, stamp);

        if (existing) {
          cell.insertChild(cell.children.indexOf(existing), art);
          existing.remove();
          report.replaced++;
        } else {
          cell.insertChild(0, art);
          report.created++;
        }
      }
    }
  }

  // Anything named like a cell that the library did not account for. Reported,
  // never removed: it is usually somebody's work in progress.
  const known = new Set(report.seen);
  const strays = board
    .findAll((n) => /\/(standard|outline|filled)\/\d+$/.test(n.name))
    .filter((n) => !known.has(n.name))
    .map((n) => n.name);

  figma.currentPage.selection = [board];
  figma.viewport.scrollAndZoomIntoView([board]);

  return {
    created: report.created,
    replaced: report.replaced,
    unchanged: report.unchanged,
    missing: report.missing,
    strays: strays.slice(0, 40),
    strayCount: strays.length,
  };
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
