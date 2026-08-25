/**
 * Expressive Assets — browsing interface.
 *
 * Reads manifest.json (the library's public contract) and per-collection sprite
 * files written by the build. No framework, no build tooling: the whole app is
 * three files GitHub Pages serves as-is, so a designer can open a PR against it
 * without setting up a toolchain.
 *
 * Two things here are sized for a 500+ asset library rather than a demo:
 *
 *  1. Cards render as empty shells immediately and an IntersectionObserver
 *     fills in the artwork as they scroll into view. First paint never waits on
 *     SVG payload.
 *  2. Sprites load per collection, on demand, triggered by what is actually
 *     visible. Opening "System Icons" never downloads the illustration set.
 */

/** Point this at the repo — drives the "Add Assets" and "View source" links. */
const REPO = 'https://github.com/masoncattdesign/expressive-assets-library';

/** Display names for the three themes. Left = what designers call it,
 *  right = the theme key stored in metadata. */
const THEMES = [
  { key: 'color', label: 'Expressive' },
  { key: 'regular', label: 'Outline' },
  { key: 'filled', label: 'Mono' },
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
  illustration: '<path d="M4 17.5 9 8l4 5.5L15.5 10l4.5 7.5Z"/>',
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  manifest: null,
  /** `${type}:${collection}` -> { [assetId]: { [theme]: svgSource } }. Lazy. */
  sprites: {},
  /** In-flight fetches, so ten cards scrolling in don't fire ten requests. */
  pending: {},
  filter: { group: 'all', collection: null, query: '', status: '' },
  view: 'grid',
  selectedId: null,
  theme: 'color',
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
/* Sprites                                                             */
/* ------------------------------------------------------------------ */

const spriteKey = (asset) => `${asset.type}:${asset.collection}`;

function spriteUrl(asset) {
  for (const group of state.manifest.groups) {
    if (group.type !== asset.type) continue;
    const found = group.collections.find((c) => c.id === asset.collection);
    if (found) return found.sprite;
  }
  return null;
}

async function loadSprite(asset) {
  const key = spriteKey(asset);
  if (state.sprites[key]) return state.sprites[key];
  if (state.pending[key]) return state.pending[key];

  const url = spriteUrl(asset);
  const fetchOne = async () => {
    try {
      const bank = await (await fetch(url)).json();
      state.sprites[key] = bank;
      return bank;
    } catch {
      // No prebuilt sprite (serving the repo root directly, say). Fall back to
      // fetching this asset's own files.
      const bank = (state.sprites[key] ||= {});
      bank[asset.id] = {};
      await Promise.all(
        Object.entries(asset.variants).map(async ([theme, path]) => {
          bank[asset.id][theme] = await (await fetch(path)).text();
        })
      );
      return bank;
    } finally {
      delete state.pending[key];
    }
  };

  state.pending[key] = fetchOne();
  return state.pending[key];
}

function sourceFor(asset, theme = state.theme) {
  const bank = state.sprites[spriteKey(asset)]?.[asset.id];
  if (!bank) return null;
  return bank[bank[theme] ? theme : asset.themes[0]] || null;
}

/* ------------------------------------------------------------------ */
/* SVG rendering                                                       */
/* ------------------------------------------------------------------ */

const HEX = '#[0-9A-Fa-f]{6}';

/** Bake the current color choices into an SVG source string. */
function tint(source, { primary, secondary, size }) {
  let out = source;
  if (primary) out = out.replace(new RegExp(`--ea-primary:${HEX}`), `--ea-primary:${primary}`);
  if (secondary) out = out.replace(new RegExp(`--ea-secondary:${HEX}`), `--ea-secondary:${secondary}`);
  if (size) out = out.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  return out;
}

/** Effective colors for an asset. A non-recolorable asset ignores the accent —
 *  brand marks ship in their own colors or not at all. */
function colorsFor(asset, accentId = state.accent) {
  const accent = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  const locked = asset.recolorable === false;
  return {
    primary: (!locked && accent.primary) || asset.colors.primary,
    secondary: (!locked && accent.secondary) || asset.colors.secondary,
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
  if (!sourceFor(asset)) await loadSprite(asset);

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

function renderGrid() {
  const grid = $('#grid');
  const assets = visibleAssets();
  const token = ++renderToken;

  grid.className = `grid${state.view === 'list' ? ' list' : ''}`;
  grid.replaceChildren();
  $('#count').textContent = `${assets.length} asset${assets.length === 1 ? '' : 's'}`;

  if (!assets.length) {
    const empty = el('div', { className: 'empty' });
    empty.innerHTML =
      '<strong>No assets match those filters</strong>Try a different search term, or clear the status filter.';
    grid.append(empty);
    return;
  }

  // Append in chunks so a 500-card render never becomes one long frame.
  const CHUNK = 80;
  let i = 0;
  const step = () => {
    if (token !== renderToken) return;
    const frag = document.createDocumentFragment();
    for (const asset of assets.slice(i, i + CHUNK)) frag.append(buildCard(asset));
    grid.append(frag);
    i += CHUNK;
    if (i < assets.length) requestAnimationFrame(step);
  };
  step();
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

  if (!sourceFor(asset)) await loadSprite(asset);
  if (state.selectedId === id) renderPanel();
}

function closePanel() {
  state.selectedId = null;
  $('#panel').hidden = true;
  for (const card of document.querySelectorAll('.card.on')) card.classList.remove('on');
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
  const locked = asset.recolorable === false;

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
    btn.addEventListener('click', () => {
      state.theme = theme.key;
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
  slider.addEventListener('input', () => {
    state.size = asset.sizes[Number(slider.value)];
    renderPanel();
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
  if (locked) {
    panel.append(
      el('p', {
        className: 'callout',
        textContent: 'Not recolorable — this asset ships in its own brand colors.',
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
    ['Themes', asset.themes.join(', ')],
    ['Sizes', asset.sizes.join(', ')],
    ['Recolorable', locked ? 'No' : 'Yes'],
    ['Version', `${asset.version} · ${asset.updated}`],
  ];
  if (asset.aliases?.length) entries.splice(1, 0, ['Also known as', asset.aliases.join(', ')]);
  if (asset.owner) entries.push(['Owner', asset.owner]);
  for (const [k, v] of entries) {
    const row = el('div', { className: 'row' });
    row.append(el('span', { className: 'k', textContent: k }), el('span', { className: 'v', textContent: v }));
    metaRows.append(row);
  }
  panel.append(metaRows);

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

  actions.append(copy, download);
  actions.append(
    el('a', {
      className: 'btn',
      href: `${REPO}/tree/main/${asset.variants[state.theme] || asset.variants[asset.themes[0]]}`,
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

  const first = state.manifest.assets.find((a) => a.id === 'system.settings') || state.manifest.assets[0];
  if (first) openPanel(first.id);
}

boot();
