/**
 * Expressive Assets — browsing interface.
 *
 * Reads manifest.json (the library's public contract) and sprite.json (every
 * SVG inlined by the build step). No framework, no build tooling: the whole app
 * is three files that GitHub Pages can serve as-is, so a designer can open a PR
 * against it without setting up a toolchain.
 */

/** Point this at the repo once it exists — drives the "Add Assets" button. */
const REPO = 'https://github.com/YOUR-ORG/expressive-assets';

/** Display names for the three themes. Left = what designers call it in the
 *  Figma library, right = the theme key stored in metadata. */
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

const NAV_ICONS = {
  all: '<rect x="4" y="4" width="6.4" height="6.4" rx="1.6"/><rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6"/><rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6"/><rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.6"/>',
  system: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/>',
  product: '<circle cx="12" cy="12" r="7.5"/>',
  file: '<path d="M7 3.5h6l4.5 4.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"/>',
  windows: '<path d="M3.5 6.5h17v11h-17Zm3 14h11" />',
  fluent: '<path d="M4 17.5 9 8l4 5.5L15.5 10l4.5 7.5Z"/>',
  illustration: '<path d="M4 17.5 9 8l4 5.5L15.5 10l4.5 7.5Z"/>',
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  manifest: null,
  sprite: {},
  filter: { collection: 'all', category: null, query: '', status: '', build: '' },
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
/* SVG rendering                                                       */
/* ------------------------------------------------------------------ */

const HEX = /#[0-9A-Fa-f]{6}/;

/** Bake the current color choices into an SVG source string. */
function tint(source, { primary, secondary, size }) {
  let out = source;
  if (primary) out = out.replace(new RegExp(`--ea-primary:${HEX.source}`), `--ea-primary:${primary}`);
  if (secondary) out = out.replace(new RegExp(`--ea-secondary:${HEX.source}`), `--ea-secondary:${secondary}`);
  if (size) out = out.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  return out;
}

/** Resolve the effective colors for an asset given the selected accent. */
function colorsFor(asset, accentId = state.accent) {
  const accent = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  return {
    primary: accent.primary || asset.colors.primary,
    secondary: accent.secondary || asset.colors.secondary,
  };
}

/** Turn a source string into a live <svg> node sized for display. */
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

function sourceFor(asset, theme = state.theme) {
  const bank = state.sprite[asset.id] || {};
  const key = bank[theme] ? theme : asset.themes[0];
  return bank[key] || '';
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

function visibleAssets() {
  const { collection, category, query, status, build } = state.filter;
  const q = query.trim().toLowerCase();
  return state.manifest.assets.filter((a) => {
    if (collection !== 'all' && a.type !== collection) return false;
    if (category && a.category !== category) return false;
    if (status && a.status !== status) return false;
    if (build && a.build !== build) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q))
    );
  });
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function navButton({ key, label, count, icon, active, onClick }) {
  const btn = el('button', { className: `nav-item${active ? ' on' : ''}`, type: 'button' });
  btn.innerHTML =
    `<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icon}</svg>` +
    `<span class="label"></span><span class="n">${count}</span>`;
  btn.querySelector('.label').textContent = label;
  btn.dataset.key = key;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderNav() {
  const nav = $('#nav');
  nav.replaceChildren();
  const { collection, category } = state.filter;

  nav.append(
    navButton({
      key: 'all',
      label: 'All Assets',
      count: state.manifest.total,
      icon: NAV_ICONS.all,
      active: collection === 'all' && !category,
      onClick: () => select({ collection: 'all', category: null }),
    })
  );

  for (const group of state.manifest.collections) {
    nav.append(el('div', { className: 'nav-group', textContent: group.label.toUpperCase() }));
    for (const cat of group.categories) {
      nav.append(
        navButton({
          key: `${group.type}:${cat.id}`,
          label: cat.label,
          count: cat.count,
          icon: NAV_ICONS[group.type === 'illustration' ? 'illustration' : cat.id] || NAV_ICONS.all,
          active: collection === group.type && category === cat.id,
          onClick: () => select({ collection: group.type, category: cat.id }),
        })
      );
    }
  }
}

function select({ collection, category }) {
  state.filter.collection = collection;
  state.filter.category = category;
  renderNav();
  renderGrid();
}

/* ------------------------------------------------------------------ */
/* Grid                                                               */
/* ------------------------------------------------------------------ */

function renderGrid() {
  const grid = $('#grid');
  const assets = visibleAssets();

  grid.className = `grid${state.view === 'list' ? ' list' : ''}`;
  grid.replaceChildren();

  $('#count').textContent = `${assets.length} asset${assets.length === 1 ? '' : 's'}`;

  if (!assets.length) {
    const empty = el('div', { className: 'empty' });
    empty.innerHTML = '<strong>No assets match those filters</strong>Try a different search term, or clear the status and build filters.';
    grid.append(empty);
    return;
  }

  for (const asset of assets) {
    const card = el('button', { className: `card${asset.id === state.selectedId ? ' on' : ''}`, type: 'button' });
    card.dataset.id = asset.id;

    const thumb = el('div', { className: 'thumb' });
    const node = svgNode(tint(sourceFor(asset), colorsFor(asset)), null);
    if (node) thumb.append(node);

    const meta = el('div', { className: 'meta' });
    meta.append(el('span', { textContent: asset.id }));
    if (asset.build !== 'stable') meta.append(el('span', { className: `badge ${asset.build}`, textContent: asset.build }));

    card.append(thumb, el('div', { className: 'name', textContent: asset.name }), meta);
    card.addEventListener('click', () => openPanel(asset.id));
    grid.append(card);
  }
}

/* ------------------------------------------------------------------ */
/* Detail panel                                                        */
/* ------------------------------------------------------------------ */

function openPanel(id) {
  const asset = state.manifest.assets.find((a) => a.id === id);
  if (!asset) return;
  state.selectedId = id;
  if (!asset.themes.includes(state.theme)) state.theme = asset.themes[0];
  state.size = asset.sizes.includes(state.size) ? state.size : asset.sizes[asset.sizes.length - 1];
  renderGrid();
  renderPanel();
}

function closePanel() {
  state.selectedId = null;
  $('#panel').hidden = true;
  renderGrid();
}

function renderPanel() {
  const panel = $('#panel');
  const asset = state.manifest.assets.find((a) => a.id === state.selectedId);
  if (!asset) return closePanel();

  panel.hidden = false;
  panel.replaceChildren();

  const colors = colorsFor(asset);
  const categoryLabel =
    state.manifest.collections.flatMap((c) => c.categories).find((c) => c.id === asset.category)?.label || asset.category;

  /* Head */
  const head = el('div', { className: 'panel-head' });
  head.append(el('h2', { textContent: asset.name }));
  const close = el('button', { className: 'close', type: 'button', title: 'Close', ariaLabel: 'Close details' });
  close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  close.addEventListener('click', closePanel);
  head.append(close);
  panel.append(head);
  panel.append(el('p', { className: 'kicker', textContent: `${categoryLabel} · ${asset.type}s` }));

  /* Preview */
  const preview = el('div', { className: 'preview' });
  const node = svgNode(tint(sourceFor(asset), colors), state.size);
  if (node) preview.append(node);
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
      renderGrid();
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
      renderGrid();
      renderPanel();
    });
    accents.append(btn);
  }
  panel.append(accents);

  /* Metadata */
  panel.append(el('h3', { textContent: 'Metadata' }));
  const metaRows = el('div', { className: 'rows' });
  const entries = [
    ['ID', asset.id],
    ['Family', asset.family],
    ['Status', asset.status],
    ['Build', asset.build],
    ['Themes', asset.themes.join(', ')],
    ['Sizes', asset.sizes.join(', ')],
    ['Version', `${asset.version} · ${asset.updated}`],
  ];
  if (asset.deprecatedBy) entries.push(['Replaced by', asset.deprecatedBy]);
  for (const [k, v] of entries) {
    const row = el('div', { className: 'row' });
    row.append(el('span', { className: 'k', textContent: k }), el('span', { className: 'v', textContent: v }));
    metaRows.append(row);
  }
  panel.append(metaRows);

  /* Tags */
  panel.append(el('h3', { textContent: 'Tags' }));
  const tags = el('div', { className: 'tags' });
  for (const tag of asset.tags) {
    const btn = el('button', { type: 'button', textContent: tag });
    btn.addEventListener('click', () => {
      $('#search').value = tag;
      state.filter.query = tag;
      renderGrid();
    });
    tags.append(btn);
  }
  panel.append(tags);

  /* Actions */
  const exportSource = () => tint(sourceFor(asset), { ...colors, size: state.size });

  const actions = el('div', { className: 'actions' });

  const copy = el('button', { className: 'btn', type: 'button' });
  copy.innerHTML = '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" stroke-linecap="round"/></svg>';
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
  download.innerHTML = '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4M4.5 19.5h15"/></svg>';
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

  const source = el('a', {
    className: 'btn',
    href: `${REPO}/tree/main/${asset.variants[state.theme] || asset.variants[asset.themes[0]]}`,
    target: '_blank',
    rel: 'noopener',
    textContent: 'View source on GitHub',
  });

  actions.append(copy, download, source);
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

function wireChrome() {
  $('#search').addEventListener('input', (e) => {
    state.filter.query = e.target.value;
    renderGrid();
  });

  for (const id of ['#filter-status', '#filter-build']) {
    $(id).addEventListener('change', (e) => {
      state.filter[id === '#filter-status' ? 'status' : 'build'] = e.target.value;
      renderGrid();
    });
  }

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
    if (e.key === 'Escape' && state.selectedId) closePanel();
    if (e.key === '/' && document.activeElement !== $('#search')) {
      e.preventDefault();
      $('#search').focus();
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

  try {
    state.sprite = await (await fetch('sprite.json')).json();
  } catch {
    // No prebuilt sprite (e.g. serving the repo root directly). Fall back to
    // fetching each variant individually.
    state.sprite = {};
    await Promise.all(
      state.manifest.assets.map(async (asset) => {
        state.sprite[asset.id] = {};
        await Promise.all(
          Object.entries(asset.variants).map(async ([theme, path]) => {
            state.sprite[asset.id][theme] = await (await fetch(path)).text();
          })
        );
      })
    );
  }

  wireChrome();
  renderNav();
  renderGrid();
  openPanel(state.manifest.assets.find((a) => a.id === 'system.settings')?.id || state.manifest.assets[0].id);
}

boot();
