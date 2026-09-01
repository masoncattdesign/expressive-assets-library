/**
 * Gallery — the browsing tool for Expressive Assets.
 *
 * Gallery is the tool; Expressive Assets is the library. Gallery knows nothing
 * about this library in particular — it reads the manifest, so it can show any
 * library that emits one.
 *
 * Reads manifest.json — the library's public contract — and the SVG files it
 * points at. No framework, no build tooling: the whole app is three files
 * GitHub Pages serves as-is, so a designer can open a PR against it without
 * setting up a toolchain.
 *
 * Three things here are sized for a 500+ asset library rather than a demo:
 *
 *  1. Cards render as empty shells immediately and an IntersectionObserver
 *     fills in the artwork as they scroll into view. First paint never waits
 *     on SVG payload, and only what you actually scroll to is ever fetched.
 *  2. Drawings are fetched individually and cached, rather than bundled. The
 *     product icons alone are 828 separate files because Windows artwork is
 *     redrawn per size; bundling them was 2.3 MB for one collection.
 *  3. The grid appends in chunks, so 500 cards never become one long frame.
 */

/** Point this at the repo — drives the "Add Assets" and "View source" links. */
const REPO = 'https://github.com/masoncattdesign/expressive-assets-library';

/** The three themes. Standard is the full-colour base; outline and filled are its
 *  monochrome reductions. Keys and labels deliberately match — an earlier split
 *  had "regular" meaning Outline here and the full-weight base in Fluent, which
 *  is exactly the kind of collision that costs someone an afternoon. */
const THEMES = [
  { key: 'standard', label: 'Standard' },
  { key: 'outline', label: 'Outline' },
  { key: 'filled', label: 'Filled' },
];

/** Windows accent pairs. `null` means "use the asset's own brand colors". */
const ACCENTS = [
  { id: 'default', label: 'Asset default', primary: null, secondary: null },
  { id: 'blue', label: 'Windows blue', primary: '#0078D4', secondary: '#2AA0DA' },
  { id: 'purple', label: 'Purple', primary: '#8764B8', secondary: '#C239B3' },
  { id: 'green', label: 'Green', primary: '#107C10', secondary: '#4CAF50' },
  { id: 'teal', label: 'Teal', primary: '#038387', secondary: '#38C6C6' },
  { id: 'red', label: 'Red', primary: '#D13438', secondary: '#E74856' },
  { id: 'orange', label: 'Orange', primary: '#CA5010', secondary: '#F7A501' },
  { id: 'yellow', label: 'Yellow', primary: '#C19C00', secondary: '#F7A501' },
  { id: 'magenta', label: 'Magenta', primary: '#E3008C', secondary: '#C239B3' },
];

const STATUS_LABEL = { draft: 'Draft', published: 'Published', deprecated: 'Deprecated' };

const NAV_ICONS = {
  all: '<rect x="4" y="4" width="6.4" height="6.4" rx="1.6"/><rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6"/><rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6"/><rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.6"/>',
  system: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/>',
  product: '<circle cx="12" cy="12" r="7.5"/>',
  file: '<path d="M7 3.5h6l4.5 4.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"/>',
  vscode: '<path d="M4 6.5 8.5 3v18L4 17.5Zm5.8 5.5 8.2-7.6v15.2Z"/>',
  illustration: '<path d="M4 17.5 9 8l4 5.5L15.5 10l4.5 7.5Z"/>',
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  manifest: null,
  filter: { group: 'all', collection: null, query: '', status: '' },
  view: 'grid',
  selectedId: null,
  theme: 'standard',
  size: null,
  accent: 'default',
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of [].concat(kids)) node.append(kid);
  return node;
};

/* ------------------------------------------------------------------ */
/* Drawings                                                            */
/* ------------------------------------------------------------------ */

/**
 * Resolve which drawing file to use for an asset at a given theme and size.
 *
 * Windows product icons are REDRAWN per size — the 16px Excel icon is a
 * different drawing from the 48px one, not a scaled copy — so asking for 16px
 * should get the 16px file. Order: exact size, then a size-agnostic "any", then
 * the nearest size below (scaling a bigger drawing down beats blowing a smaller
 * one up), then whatever is left.
 */
function drawingPath(asset, theme = state.theme, size = state.size) {
  const drawings = asset.variants?.[theme] || asset.variants?.[asset.themes[0]];
  if (!drawings) return null;

  if (size && drawings[size]) return drawings[size];
  if (drawings.any) return drawings.any;

  const numeric = Object.keys(drawings)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!numeric.length) return Object.values(drawings)[0] || null;

  const below = numeric.filter((n) => n <= (size || Infinity)).pop();
  return drawings[below ?? numeric[numeric.length - 1]];
}

/** path -> svg source. Fetched once, kept for the session. */
const drawings = new Map();
/** path -> in-flight promise, so ten cards scrolling in fire one request each. */
const inflight = new Map();

function loadDrawing(path) {
  if (!path) return Promise.resolve(null);
  if (drawings.has(path)) return Promise.resolve(drawings.get(path));
  if (inflight.has(path)) return inflight.get(path);

  const req = fetch(path)
    .then((r) => (r.ok ? r.text() : null))
    .then((text) => {
      if (text) drawings.set(path, text);
      return text;
    })
    .catch(() => null)
    .finally(() => inflight.delete(path));

  inflight.set(path, req);
  return req;
}

/** Synchronous read of an already-loaded drawing. */
function sourceFor(asset, theme = state.theme, size = state.size) {
  const path = drawingPath(asset, theme, size);
  return path ? drawings.get(path) || null : null;
}

/** Whether the accent picker can actually do anything to this drawing.
 *  Brand artwork ships with its colors baked in and has no tint hooks —
 *  better to say so than to offer a control that silently does nothing. */
function isTintable(asset, theme = state.theme) {
  if (asset.recolorable === false) return false;
  const source = sourceFor(asset, theme);
  return Boolean(source) && (source.includes('--ea-primary') || source.includes('currentColor'));
}

/* ------------------------------------------------------------------ */
/* SVG rendering                                                       */
/* ------------------------------------------------------------------ */

const HEX = '#[0-9A-Fa-f]{6}';

/**
 * Bake the current color choices into an SVG source string.
 *
 * Two tinting conventions live side by side. Generated artwork declares
 * --ea-primary / --ea-secondary custom properties. Imported monochrome artwork
 * (the Outline and Filled themes of the real product icons) is drawn in
 * currentColor, which tints by setting `color` on the root.
 */
/** Mix a hex toward white. The illustration palette pairs every hue with a much
 *  lighter companion — purple with lavender, coral with periwinkle. Recolouring
 *  the hue and leaving its companion behind pulls the drawing in two, so the
 *  companions move with it. */
function lighten(hex, toward) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const parts = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * toward);
  });
  return `#${parts.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function tint(source, { primary, secondary, size }) {
  let out = source;

  // Generated artwork declares the properties inside a <style> block, so the
  // value is substituted in place.
  if (primary) out = out.replace(new RegExp(`--ea-primary:${HEX}`), `--ea-primary:${primary}`);
  if (secondary) out = out.replace(new RegExp(`--ea-secondary:${HEX}`), `--ea-secondary:${secondary}`);

  // Imported artwork carries its hooks inline as `var(--ea-role, #shipped)` and
  // has no style block to patch, so the properties are set on the root instead.
  // Both kinds, plus currentColor, resolve into ONE style attribute — writing a
  // second one produces invalid markup that browsers silently drop.
  const decls = [];
  if (primary && out.includes('currentColor')) decls.push(`color:${primary}`);
  if (primary && out.includes('var(--ea-primary,')) {
    const second = secondary || primary;
    decls.push(
      `--ea-primary:${primary}`,
      `--ea-primary-tint:${lighten(primary, 0.72)}`,
      `--ea-secondary:${second}`,
      `--ea-tint:${lighten(second, 0.8)}`
    );
  }
  if (decls.length && !/<svg[^>]*\sstyle=/.test(out)) {
    out = out.replace('<svg ', `<svg style="${decls.join(';')}" `);
  }

  if (size) out = out.replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`);
  return out;
}

/** Effective colors for an asset. Artwork with no tint hooks keeps its own
 *  colors — brand marks ship as authored or not at all. */
function colorsFor(asset, accentId = state.accent, theme = state.theme) {
  const accent = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  const canTint = isTintable(asset, theme);
  return {
    primary: (canTint && accent.primary) || asset.colors.primary,
    secondary: (canTint && accent.secondary) || asset.colors.secondary,
  };
}

function svgNode(source, size) {
  const wrap = document.createElement('div');
  wrap.innerHTML = source;
  const svg = wrap.firstElementChild;
  if (svg && size) {
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
  }
  return svg;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

function visibleAssets() {
  const { group, collection, query, status } = state.filter;
  const q = query.trim().toLowerCase();
  return state.manifest.assets.filter((a) => {
    if (group !== 'all' && a.type !== group) return false;
    if (collection && a.collection !== collection) return false;
    if (status && a.status !== status) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.keywords || []).some((k) => k.includes(q)) ||
      (a.aliases || []).some((x) => x.toLowerCase().includes(q)) ||
      (a.description || '').toLowerCase().includes(q)
    );
  });
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function navButton({ label, count, icon, active, onClick }) {
  const btn = el('button', { className: `nav-item${active ? ' on' : ''}`, type: 'button' });
  btn.innerHTML =
    `<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icon}</svg>` +
    `<span class="label"></span><span class="n">${count}</span>`;
  btn.querySelector('.label').textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderNav() {
  const nav = $('#nav');
  nav.replaceChildren();
  const { group, collection } = state.filter;

  nav.append(
    navButton({
      label: 'All Assets',
      count: state.manifest.total,
      icon: NAV_ICONS.all,
      active: group === 'all' && !collection,
      onClick: () => selectCollection('all', null),
    })
  );

  for (const g of state.manifest.groups) {
    nav.append(el('div', { className: 'nav-group', textContent: g.label.toUpperCase() }));
    for (const c of g.collections) {
      nav.append(
        navButton({
          label: c.label,
          count: c.count,
          icon: NAV_ICONS[g.type === 'illustration' ? 'illustration' : c.id] || NAV_ICONS.all,
          active: group === g.type && collection === c.id,
          onClick: () => selectCollection(g.type, c.id),
        })
      );
    }
  }
}

function selectCollection(group, collection) {
  state.filter.group = group;
  state.filter.collection = collection;
  renderNav();
  renderGrid();
}

/* ------------------------------------------------------------------ */
/* Grid                                                               */
/* ------------------------------------------------------------------ */

/** Fills a card's artwork once it is actually on screen. Everything below the
 *  fold in a 500-asset library costs nothing until you scroll to it. */
const painter = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      painter.unobserve(entry.target);
      paintCard(entry.target);
    }
  },
  { rootMargin: '400px' }
);

async function paintCard(card) {
  const asset = state.manifest.assets.find((a) => a.id === card.dataset.id);
  if (!asset) return;
  await loadDrawing(drawingPath(asset));

  const source = sourceFor(asset);
  const thumb = card.querySelector('.thumb');
  if (!source || !thumb || !card.isConnected) return;

  const node = svgNode(tint(source, colorsFor(asset)), null);
  if (node) thumb.replaceChildren(node);
}

/** Repaint cards already showing artwork — after a theme or accent change. */
function repaintVisible() {
  for (const card of document.querySelectorAll('.card')) {
    if (card.querySelector('.thumb')?.childElementCount) paintCard(card);
  }
}

function buildCard(asset) {
  const card = el('button', { className: `card${asset.id === state.selectedId ? ' on' : ''}`, type: 'button' });
  card.dataset.id = asset.id;
  // Illustrations get a bigger thumbnail than icons. A 360px scene shown in a
  // 40px box is a smudge — you cannot tell two onboarding illustrations apart.
  card.dataset.type = asset.type;

  const thumb = el('div', { className: 'thumb' });
  const meta = el('div', { className: 'meta' });
  meta.append(el('span', { textContent: asset.id }));
  if (asset.status !== 'published') {
    meta.append(el('span', { className: `badge ${asset.status}`, textContent: STATUS_LABEL[asset.status] }));
  }

  card.append(thumb, el('div', { className: 'name', textContent: asset.name }), meta);
  card.addEventListener('click', () => openPanel(asset.id));
  painter.observe(card);
  return card;
}

let renderToken = 0;

/**
 * Cards are added a page at a time as you scroll, not all at once.
 *
 * Building every card up front is what a 2,900-icon collection costs: measured
 * at 2.6s of pure DOM construction on every collection switch, before a single
 * pixel was painted. content-visibility fixes layout and paint but not element
 * creation, so the only real answer is to create fewer.
 *
 * A sentinel after the last card pulls in the next page when it scrolls close.
 * The count in the toolbar always reflects the full filtered set, not what
 * happens to be rendered — the paging is a rendering detail, not a filter.
 */
const PAGE_SIZE = 240;

const paging = { assets: [], rendered: 0, token: 0 };

/* A scroll check rather than an IntersectionObserver on a sentinel. The
   observer version fired once and then stopped: appending cards moves the
   sentinel, and the intersection state never cleanly re-entered. A scroll
   handler is one line of logic with no such subtlety, and it runs on a frame
   the browser was already going to render. */
function maybeRenderMore() {
  const grid = $('#grid');
  if (paging.rendered >= paging.assets.length) return;
  const remaining = grid.scrollHeight - grid.scrollTop - grid.clientHeight;
  if (remaining < 800) renderNextPage();
}

function renderNextPage() {
  const grid = $('#grid');
  const token = paging.token;

  const slice = paging.assets.slice(paging.rendered, paging.rendered + PAGE_SIZE);
  if (!slice.length) return;

  const frag = document.createDocumentFragment();
  for (const asset of slice) frag.append(buildCard(asset));
  if (token !== paging.token) return;

  grid.append(frag);
  paging.rendered += slice.length;
}

function renderGrid() {
  const grid = $('#grid');
  const assets = visibleAssets();
  renderToken++;

  grid.className = `grid${state.view === 'list' ? ' list' : ''}`;
  grid.replaceChildren();

  const searching = state.filter.query.trim().length > 0;
  $('#count').textContent = searching
    ? `${assets.length} match${assets.length === 1 ? '' : 'es'}`
    : `${assets.length} asset${assets.length === 1 ? '' : 's'}`;

  if (!assets.length) {
    const empty = el('div', { className: 'empty' });
    empty.innerHTML =
      '<strong>No assets match those filters</strong>Try a different search term, or clear the status filter.';
    grid.append(empty);
    return;
  }

  paging.assets = assets;
  paging.rendered = 0;
  paging.token++;
  renderNextPage();

  // The first page may not fill a tall window; keep going until it does.
  requestAnimationFrame(maybeRenderMore);
}

/* ------------------------------------------------------------------ */
/* Detail panel                                                        */
/* ------------------------------------------------------------------ */

async function openPanel(id) {
  const asset = state.manifest.assets.find((a) => a.id === id);
  if (!asset) return;

  state.selectedId = id;
  if (!asset.themes.includes(state.theme)) state.theme = asset.themes[0];
  state.size = asset.sizes.includes(state.size) ? state.size : asset.sizes[asset.sizes.length - 1];

  for (const card of document.querySelectorAll('.card')) {
    card.classList.toggle('on', card.dataset.id === id);
  }

  // Load every theme's drawing at this size so the Style toggle and the
  // accent-availability note are correct the moment the panel opens.
  await Promise.all(asset.themes.map((t) => loadDrawing(drawingPath(asset, t))));
  if (state.selectedId === id) renderPanel();
}

function closePanel() {
  state.selectedId = null;
  $('#panel').hidden = true;
  for (const card of document.querySelectorAll('.card.on')) card.classList.remove('on');
}

/** "One scalable drawing" vs "6 sizes: 16, 20, 24…" — tells you at a glance
 *  whether you are looking at per-size artwork or one scalable file. */
function drawingSummary(asset) {
  const drawings = asset.variants?.[state.theme] || {};
  const sizes = Object.keys(drawings).filter((k) => k !== 'any');
  if (!sizes.length) return 'One scalable drawing';
  return `${sizes.length} per-size (${sizes.map(Number).sort((a, b) => a - b).join(', ')})`;
}

/** Repo path of the drawing currently on screen. */
function sourcePath(asset) {
  const drawings = asset.variants?.[state.theme] || asset.variants?.[asset.themes[0]] || {};
  if (drawings[state.size]) return drawings[state.size];
  if (drawings.any) return drawings.any;
  const numeric = Object.keys(drawings).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const below = numeric.filter((n) => n <= state.size).pop();
  return drawings[below ?? numeric[numeric.length - 1]] || '';
}

function collectionLabel(asset) {
  for (const g of state.manifest.groups) {
    const c = g.collections.find((x) => x.id === asset.collection);
    if (g.type === asset.type && c) return c.label;
  }
  return asset.collection;
}

function renderPanel() {
  const panel = $('#panel');
  const asset = state.manifest.assets.find((a) => a.id === state.selectedId);
  if (!asset) return closePanel();

  panel.hidden = false;
  panel.replaceChildren();

  const colors = colorsFor(asset);
  const canTint = isTintable(asset);
  // Which themes CAN take an accent — used to explain why the picker is off.
  const tintableThemes = asset.themes.filter((t) => isTintable(asset, t));

  /* Head */
  const head = el('div', { className: 'panel-head' });
  head.append(el('h2', { textContent: asset.name }));
  const close = el('button', { className: 'close', type: 'button', title: 'Close', ariaLabel: 'Close details' });
  close.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  close.addEventListener('click', closePanel);
  head.append(close);
  panel.append(head);

  const kicker = el('p', { className: 'kicker' });
  kicker.append(`${collectionLabel(asset)}${asset.product ? ` · ${asset.product}` : ''}`);
  if (asset.status !== 'published') {
    kicker.append(' ', el('span', { className: `badge ${asset.status}`, textContent: STATUS_LABEL[asset.status] }));
  }
  panel.append(kicker);

  if (asset.status === 'deprecated' && asset.replacedBy) {
    const note = el('p', { className: 'callout' });
    note.append('Deprecated. Use ');
    const link = el('button', { className: 'linkish', type: 'button', textContent: asset.replacedBy });
    link.addEventListener('click', () => openPanel(asset.replacedBy));
    note.append(link, ' instead.');
    panel.append(note);
  }

  if (asset.description) panel.append(el('p', { className: 'blurb', textContent: asset.description }));

  /* Preview */
  const preview = el('div', { className: 'preview' });
  const source = sourceFor(asset);
  if (source) {
    const node = svgNode(tint(source, colors), state.size);
    if (node) preview.append(node);
  }
  panel.append(preview);
  panel.append(el('p', { className: 'preview-note', textContent: `Shown at actual size — ${state.size}px` }));

  /* Style */
  panel.append(el('h3', { textContent: 'Style' }));
  const seg = el('div', { className: 'segment', role: 'group' });
  for (const theme of THEMES) {
    const available = asset.themes.includes(theme.key);
    const btn = el('button', {
      type: 'button',
      textContent: theme.label,
      className: state.theme === theme.key ? 'on' : '',
      disabled: !available,
      title: available ? `${theme.label} (${theme.key})` : `Not authored for ${asset.name}`,
    });
    btn.setAttribute('aria-pressed', String(state.theme === theme.key));
    btn.addEventListener('click', async () => {
      state.theme = theme.key;
      await loadDrawing(drawingPath(asset));
      repaintVisible();
      renderPanel();
    });
    seg.append(btn);
  }
  panel.append(seg);

  /* Size */
  const sizeRow = el('div', { className: 'size-row' });
  sizeRow.append(el('h3', { textContent: 'Size' }), el('span', { className: 'val', textContent: `${state.size}px` }));
  panel.append(sizeRow);
  const slider = el('input', {
    type: 'range',
    min: 0,
    max: asset.sizes.length - 1,
    step: 1,
    value: asset.sizes.indexOf(state.size),
  });
  slider.setAttribute('aria-label', 'Preview size');
  slider.addEventListener('input', async () => {
    state.size = asset.sizes[Number(slider.value)];
    // Per-size artwork means a new size is a different FILE, which may not be
    // fetched yet. Render immediately so the slider feels live, then re-render
    // once the drawing lands.
    renderPanel();
    if (await loadDrawing(drawingPath(asset))) renderPanel();
  });
  panel.append(slider);

  /* Colors */
  panel.append(el('h3', { textContent: 'Colors' }));
  const rows = el('div', { className: 'rows' });
  for (const [key, value] of [['Primary', colors.primary], ['Secondary', colors.secondary]]) {
    const row = el('div', { className: 'row' });
    const v = el('div', { className: 'v' });
    v.append(el('code', { textContent: value }), el('span', { className: 'chip-color', style: `background:${value}` }));
    row.append(el('span', { className: 'k', textContent: key }), v);
    rows.append(row);
  }
  panel.append(rows);

  /* Accents */
  panel.append(el('h3', { textContent: 'Windows accents' }));
  if (!canTint) {
    const others = tintableThemes.map((t) => THEMES.find((x) => x.key === t)?.label).filter(Boolean);
    panel.append(
      el('p', {
        className: 'callout',
        textContent: others.length
          ? `${THEMES.find((t) => t.key === state.theme)?.label} ships in brand colors and can't be retinted. Switch to ${others.join(' or ')} to apply an accent.`
          : 'Not recolorable — this asset ships in its own brand colors.',
      })
    );
  } else {
    const accents = el('div', { className: 'accents' });
    for (const accent of ACCENTS) {
      const btn = el('button', {
        type: 'button',
        className: state.accent === accent.id ? 'on' : '',
        title: accent.label,
        ariaLabel: accent.label,
        style: `background:linear-gradient(135deg, ${accent.primary || asset.colors.primary}, ${accent.secondary || asset.colors.secondary})`,
      });
      btn.addEventListener('click', () => {
        state.accent = accent.id;
        repaintVisible();
        renderPanel();
      });
      accents.append(btn);
    }
    panel.append(accents);
  }

  /* Metadata */
  panel.append(el('h3', { textContent: 'Metadata' }));
  const metaRows = el('div', { className: 'rows' });
  const entries = [
    ['ID', asset.id],
    ['Status', STATUS_LABEL[asset.status]],
    ['Themes', THEMES.filter((t) => asset.themes.includes(t.key)).map((t) => t.label).join(', ')],
    ['Sizes', asset.sizes.join(', ')],
    ['Accent', tintableThemes.length ? `${tintableThemes.length} of ${asset.themes.length} themes` : 'Not applicable'],
    ['Drawings', drawingSummary(asset)],
    ['Version', `${asset.version} · ${asset.updated}`],
  ];
  if (asset.aliases?.length) entries.splice(1, 0, ['Also known as', asset.aliases.join(', ')]);
  if (asset.owner) entries.push(['Owner', asset.owner]);
  if (asset.source) entries.push(['Source', `${asset.source.project} · ${asset.source.license}`]);
  for (const [k, v] of entries) {
    const row = el('div', { className: 'row' });
    row.append(el('span', { className: 'k', textContent: k }), el('span', { className: 'v', textContent: v }));
    metaRows.append(row);
  }
  panel.append(metaRows);

  /* Provenance. Shown where someone is about to copy the artwork, not buried
     in a repo file they will never open. */
  if (asset.source) {
    const note = el('p', { className: 'callout' });
    note.append(`${asset.source.copyright || asset.source.project}. Used under ${asset.source.license}. `);
    if (asset.source.url) {
      note.append(
        el('a', { href: asset.source.url, target: '_blank', rel: 'noopener', className: 'linkish', textContent: 'View upstream' })
      );
    }
    if (asset.notes) note.append(el('span', { className: 'fine', textContent: asset.notes }));
    panel.append(note);
  }

  /* Keywords */
  panel.append(el('h3', { textContent: 'Keywords' }));
  if (asset.keywords?.length) {
    const tags = el('div', { className: 'tags' });
    for (const keyword of asset.keywords) {
      const btn = el('button', { type: 'button', textContent: keyword });
      btn.addEventListener('click', () => {
        $('#search').value = keyword;
        state.filter.query = keyword;
        renderGrid();
      });
      tags.append(btn);
    }
    panel.append(tags);
  } else {
    panel.append(el('p', { className: 'muted', textContent: 'None yet — findable only by name.' }));
  }

  /* Actions */
  const exportSource = () => tint(sourceFor(asset) || '', { ...colors, size: state.size });
  const actions = el('div', { className: 'actions' });

  const copy = el('button', { className: 'btn', type: 'button' });
  copy.innerHTML =
    '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" stroke-linecap="round"/></svg>';
  copy.append('Copy SVG code');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportSource());
      toast('SVG copied to clipboard');
    } catch {
      toast('Clipboard blocked — use Download instead');
    }
  });

  const download = el('button', { className: 'btn btn-primary', type: 'button' });
  download.innerHTML =
    '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4M4.5 19.5h15"/></svg>';
  download.append('Download SVG');
  download.addEventListener('click', () => {
    const blob = new Blob([exportSource()], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `${asset.id.replace('.', '-')}-${state.theme}-${state.size}.svg` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Customizer is the sibling tool: Gallery shows the library, Customizer
  // restyles a piece of it. Deep-linked by asset id rather than file path so
  // the link survives a re-import that changes which sizes exist. Standard
  // only: it reads source colour, which Outline and Filled do not carry.
  const customize = el('a', {
    className: 'btn',
    href: `customizer.html?asset=${encodeURIComponent(asset.id)}`,
    target: '_blank',
    rel: 'noopener',
  });
  customize.innerHTML =
    '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="15" r="1.3" fill="currentColor" stroke="none"/><path d="M12 20.5a2.6 2.6 0 0 0 2.2-4 1.7 1.7 0 0 1 1.4-2.7h1.3"/></svg>';
  customize.append('Open in Customizer');

  actions.append(copy, download, customize);
  actions.append(
    el('a', {
      className: 'btn',
      href: `${REPO}/tree/main/${sourcePath(asset)}`,
      target: '_blank',
      rel: 'noopener',
      textContent: 'View source on GitHub',
    })
  );
  panel.append(actions);
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

let toastTimer;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('on'), 2200);
}

function columnCount() {
  if (state.view === 'list') return 1;
  const cols = getComputedStyle($('#grid')).gridTemplateColumns.split(' ').length;
  return Math.max(1, cols);
}

function moveSelection(delta) {
  const cards = [...document.querySelectorAll('.card')];
  if (!cards.length) return;
  const current = cards.findIndex((c) => c.dataset.id === state.selectedId);
  const next = cards[Math.max(0, Math.min(cards.length - 1, current + delta))];
  if (!next) return;
  next.scrollIntoView({ block: 'nearest' });
  openPanel(next.dataset.id);
}

function wireChrome() {
  $('#search').addEventListener('input', (e) => {
    state.filter.query = e.target.value;
    renderGrid();
  });

  $('#filter-status').addEventListener('change', (e) => {
    state.filter.status = e.target.value;
    renderGrid();
  });

  for (const btn of document.querySelectorAll('.view button')) {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      for (const other of document.querySelectorAll('.view button')) {
        const on = other === btn;
        other.classList.toggle('on', on);
        other.setAttribute('aria-pressed', String(on));
      }
      renderGrid();
    });
  }

  let scrollQueued = false;
  $('#grid').addEventListener(
    'scroll',
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        maybeRenderMore();
      });
    },
    { passive: true }
  );

  $('#contribute').href = `${REPO}/blob/main/CONTRIBUTING.md`;

  document.addEventListener('keydown', (e) => {
    const typing = document.activeElement === $('#search');
    if (e.key === 'Escape' && state.selectedId) return closePanel();
    if (e.key === '/' && !typing) {
      e.preventDefault();
      return $('#search').focus();
    }
    if (typing || !state.selectedId) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columnCount(), ArrowUp: -columnCount() };
    if (moves[e.key]) {
      e.preventDefault();
      moveSelection(moves[e.key]);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  try {
    state.manifest = await (await fetch('manifest.json')).json();
  } catch {
    $('#grid').innerHTML =
      '<div class="empty"><strong>Could not load manifest.json</strong>Run <code>npm run build</code> and serve the <code>_site</code> folder — opening index.html straight from disk blocks the fetch.</div>';
    return;
  }

  wireChrome();
  renderNav();
  renderGrid();

  // Open the first asset in library order, so the panel matches whatever the
  // sidebar puts first rather than a hard-coded favourite.
  const [first] = state.manifest.assets;
  if (first) openPanel(first.id);
}

boot();
