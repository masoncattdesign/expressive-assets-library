/* Shared shell for the desktop prototypes: fit the 1920x1200 stage to the
   window, icon helpers, the goo filter, dragging in stage coordinates, and a
   few small utilities. No framework; each desktop is one page and one script. */

const ICONS = '../assets/icons/';
const W = 1920, H = 1200;
let SCALE = 1;

/* ---- Stage fit --------------------------------------------------------- */
function fitStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  // Leave a little air around the desktop unless the window is close to its
  // aspect ratio, where a border would only waste pixels.
  const pad = Math.min(innerWidth, innerHeight) > 700 ? 24 : 0;
  SCALE = Math.min((innerWidth - pad * 2) / W, (innerHeight - pad * 2) / H);
  document.body.classList.toggle('fit-full', pad === 0);
  stage.style.transform = `scale(${SCALE}) translate(-50%, -50%)`;
  stage.style.transformOrigin = '0 0';
  // translate(-50%) inside a scaled box moves by the scaled size, so center
  // with left/top in window pixels instead.
  stage.style.left = `${(innerWidth - W * SCALE) / 2}px`;
  stage.style.top = `${(innerHeight - H * SCALE) / 2}px`;
  stage.style.transform = `scale(${SCALE})`;
}
addEventListener('resize', fitStage);

/* Pointer position in stage coordinates. */
function stagePoint(e) {
  const r = document.getElementById('stage').getBoundingClientRect();
  return { x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE };
}

/* ---- Icons ------------------------------------------------------------- */
// System icon, masked so it takes the text color. name is the folder name in
// assets/icons/system; style is outline or filled.
// The downloadable copy inlines its icons as data (icons.js) because browsers
// refuse CSS masks loaded from disk. Served over http this falls through to the file.
function iconSrc(p) { return (window.ICON_DATA && window.ICON_DATA[p]) || ICONS + p; }
function ic(name, size = 20, style = 'outline') {
  const px = size > 20 ? 24 : 20;
  return `<span class="ic" style="--src:url('${iconSrc(`system/${name}/${style}-${px}.svg`)}');width:${size}px;height:${size}px" aria-hidden="true"></span>`;
}
// Full color product or app icon.
function appIcon(path, size = 36) {
  return `<img class="app-ic" src="${ICONS}${path}" width="${size}" height="${size}" style="width:${size}px;height:${size}px" alt="">`;
}
const APPS = {
  word: 'product/word/standard-48.svg',
  excel: 'product/excel/standard-48.svg',
  powerpoint: 'product/powerpoint/standard-48.svg',
  outlook: 'product/outlook/standard-48.svg',
  teams: 'product/teams/standard-48.svg',
  copilot: 'product/copilot/standard-48.svg',
  edge: 'product/edge/standard-48.svg',
  explorer: 'app/file-explorer/standard-48.svg',
  photos: 'app/photos/standard-48.svg',
  weather: 'app/weather/standard-48.svg',
  news: 'app/news/standard-28.svg',
  maps: 'app/maps/standard-48.svg',
  calendar: 'app/calendar/standard-48.svg',
  notepad: 'app/notepad/standard-48.svg',
  paint: 'app/paint/standard-48.svg',
  clock: 'app/alarms-and-clock/standard-48.svg',
  media: 'app/media-player/standard-48.svg',
  store: 'app/store-light-theme/standard-48.svg',
};

/* ---- Goo --------------------------------------------------------------- */
// The classic blur-then-threshold filter: shapes that come close melt into
// one another. Content never goes through it; it sits on a layer above, so
// text stays crisp while the surfaces underneath behave like liquid.
function installGoo(id = 'goo', blur = 10, contrast = 22, shift = -10) {
  if (document.getElementById(id)) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `<defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/>
    <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${shift}" result="g"/>
    <feComposite in="SourceGraphic" in2="g" operator="atop"/>
  </filter></defs>`;
  document.body.appendChild(svg);
}

/* ---- Drag -------------------------------------------------------------- */
// Calls onMove with the offset from where the drag started, in stage pixels.
function draggable(el, { onStart, onMove, onEnd, threshold = 4, handle } = {}) {
  (handle || el).addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('input, textarea, [contenteditable], [data-nodrag]')) return;
    const p0 = stagePoint(e);
    let started = false;
    const move = ev => {
      const p = stagePoint(ev);
      const dx = p.x - p0.x, dy = p.y - p0.y;
      if (!started) {
        if (Math.hypot(dx, dy) < threshold) return;
        started = true;
        onStart && onStart(e);
      }
      onMove && onMove(dx, dy, ev);
    };
    const up = ev => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      if (started) {
        // Swallow the click that follows a drag.
        const kill = c => { c.stopPropagation(); c.preventDefault(); };
        addEventListener('click', kill, { capture: true, once: true });
        setTimeout(() => removeEventListener('click', kill, { capture: true }), 0);
        onEnd && onEnd(ev);
      }
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
}

/* ---- Utilities --------------------------------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };

function clockParts(d = new Date()) {
  let h = d.getHours(); const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { h, m: String(m).padStart(2, '0'), ampm, h24: d.getHours() };
}
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function greeting(h) { return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

// Types text into an element a few characters at a time.
async function typeInto(el, text, cps = 60) {
  el.classList.add('typing-caret');
  for (let i = 1; i <= text.length; i++) {
    el.textContent = text.slice(0, i);
    await sleep(1000 / cps * (text[i - 1] === ' ' ? .6 : 1));
  }
  el.classList.remove('typing-caret');
}

function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem('desktops:' + key));
    localStorage.setItem('desktops:' + key, JSON.stringify(val));
  } catch { return null; }
}

/* ---- Switcher ---------------------------------------------------------- */
function protoNav(current) {
  const items = [['workbench', 'Workbench'], ['mosaic', 'Mosaic'], ['pinboard', 'Pinboard']];
  const nav = html(`<nav class="proto-nav" aria-label="Desktops">${items.map(([k, l]) =>
    `<a href="${k}.html"${k === current ? ' aria-current="page"' : ''}>${l}</a>`).join('')}<span class="themes" id="theme-pick" role="group" aria-label="Theme"></span><span class="colors" id="color-pick" role="group" aria-label="Colors"></span>${location.protocol === 'file:' ? '' : `<a class="dl" href="Desktop-prototypes.zip" download title="Download all three prototypes, with a README and notes for an agent">${ic('arrow-download', 16)}Download</a>`}<span class="hint">Everything here is clickable</span></nav>`);
  document.body.appendChild(nav);
  let t;
  const show = () => { nav.classList.add('show'); clearTimeout(t); t = setTimeout(() => nav.classList.remove('show'), 1800); };
  addEventListener('pointermove', e => { if (e.clientY < 120) show(); });
  show();
  // Number keys switch desktops.
  addEventListener('keydown', e => {
    if (e.target.closest('input')) return;
    const i = ['1', '2', '3'].indexOf(e.key);
    if (i >= 0) location.href = items[i][0] + '.html';
  });
}

/* ---- Illustrations and themes ----------------------------------------- */
// Windows illustrations come from the Windows illustration library (illus-data.js)
// and are restyled by its own engine (illus-engine.js), so a theme can show the
// same drawing as drawn, in the M365 style, stippled, textured or neon.
let THEME = null;
function illusSVG(name, style) {
  const src = window.ILLUS && ILLUS[name];
  if (!src || typeof styled !== 'function') return '';
  const st = style || (THEME && THEME.style) || 'windows';
  if (st === 'sketch') return sketchSVG(src, THEME.ink, THEME.paper);
  return styled(src, st);
}

/* ---- Sketch ------------------------------------------------------------ */
// The Sketch theme redraws everything as line work. Illustrations lose their
// fills and gradients and keep only their outlines, in one ink color, with
// shapes filled in paper so overlapping parts read like a pen drawing.
function sketchSVG(src, ink = '#24243a', paper = '#fffdf8') {
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  const svg = doc.documentElement;
  svg.querySelectorAll('[filter]').forEach(e => e.removeAttribute('filter'));
  svg.querySelectorAll('defs').forEach(d => d.remove());
  svg.querySelectorAll('path,rect,circle,ellipse,polygon,line,polyline').forEach(e => {
    const f = (e.getAttribute('fill') || '').toLowerCase();
    const white = f === 'white' || f === '#fff' || f === '#ffffff';
    e.setAttribute('fill', white ? ink : paper);
    e.setAttribute('fill-opacity', white ? '.0' : '1');
    e.setAttribute('stroke', ink); e.setAttribute('stroke-width', '1.6');
    e.setAttribute('stroke-linejoin', 'round'); e.setAttribute('stroke-linecap', 'round');
    e.setAttribute('vector-effect', 'non-scaling-stroke');
    e.removeAttribute('opacity'); e.removeAttribute('fill-rule');
  });
  svg.removeAttribute('width'); svg.removeAttribute('height');
  return new XMLSerializer().serializeToString(svg);
}
// App and product icons swap to their outline drawings (Sketch, and any theme
// that sets outline: true, like M365, where they match the M365 illustrations). Product icons have
// outline masters in the library; app icons do not, so they borrow the
// closest system icon. Everything is recolored to the theme's ink.
const SKETCH_ICON = {
  'product/word/standard-48.svg': 'product/word/outline-48.svg', 'product/excel/standard-48.svg': 'product/excel/outline-48.svg',
  'product/powerpoint/standard-48.svg': 'product/powerpoint/outline-48.svg', 'product/outlook/standard-48.svg': 'product/outlook/outline-48.svg',
  'product/teams/standard-48.svg': 'product/teams/outline-48.svg', 'product/copilot/standard-48.svg': 'product/copilot/outline-48.svg',
  'product/edge/standard-48.svg': 'product/edge/outline-48.svg',
  'app/file-explorer/standard-48.svg': 'system/folder/outline-24.svg', 'app/photos/standard-48.svg': 'system/image/outline-24.svg',
  'app/weather/standard-48.svg': 'system/weather-sunny/outline-24.svg', 'app/calendar/standard-48.svg': 'system/calendar-ltr/outline-24.svg',
  'app/notepad/standard-48.svg': 'system/notepad/outline-24.svg', 'app/paint/standard-48.svg': 'system/paint-brush/outline-24.svg',
  'app/alarms-and-clock/standard-48.svg': 'system/clock/outline-24.svg', 'app/maps/standard-48.svg': 'system/map/outline-24.svg',
  'app/media-player/standard-48.svg': 'system/play/outline-24.svg', 'app/news/standard-28.svg': 'system/news/outline-24.svg',
  'app/news/standard-48.svg': 'system/news/outline-24.svg', 'app/store-light-theme/standard-48.svg': 'system/store-microsoft/outline-24.svg',
};
const sketchCache = {};
async function sketchIconURL(path, ink) {
  const key = path + ink;
  if (sketchCache[key]) return sketchCache[key];
  let txt;
  const d = window.ICON_DATA && ICON_DATA[path];
  if (d) txt = atob(d.split(',')[1]); else txt = await (await fetch(ICONS + path)).text();
  txt = txt.replace(/currentColor/g, ink);
  return (sketchCache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt));
}
function sketchImgs(root, on) {
  const imgs = root.tagName === 'IMG' ? [root] : $$('img', root);
  imgs.forEach(async img => {
    const orig = img.dataset.orig || img.getAttribute('src') || '';
    const m = orig.match(/(?:product|app)\/[a-z0-9-]+\/[a-z0-9-]+\.svg/);
    if (!m) return;
    if (!on) { if (img.dataset.orig) { img.src = img.dataset.orig; delete img.dataset.orig; img.classList.remove('sk-ic'); } return; }
    const to = SKETCH_ICON[m[0]]; if (!to) return;
    img.dataset.orig = orig;
    img.src = await sketchIconURL(to, THEME.ink);
    img.classList.add('sk-ic');
  });
}
let sketchObs = null;
function sketchMode(on) {
  const stage = document.getElementById('stage');
  sketchImgs(document.body, on);
  if (sketchObs) { sketchObs.disconnect(); sketchObs = null; }
  if (on) {
    // Windows, tasks and tiles are added as you use the desktop; keep them sketched too.
    sketchObs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && (n.tagName === 'IMG' || n.querySelector('img'))) sketchImgs(n, true);
    })));
    sketchObs.observe(stage, { childList: true, subtree: true });
  }
}
function paintIllus(root = document) {
  $$('[data-illus]', root).forEach(el => { el.innerHTML = illusSVG(el.dataset.illus); el.classList.add('illus'); });
}
// themes: [{ id, label, style, mode, colors }]. Each theme has a few color
// options: colors[0] is the theme as designed, the rest restyle it. A color can
// set mode ('light' or 'dark') and override any theme field (ink, paper, pal).
// The chosen theme, and the color for each theme, are remembered per desktop.
// #stage gets theme-<id>, data-color=<color id> and mode-dark when it is dark.
function setupThemes(desk, themes, onChange) {
  const box = document.getElementById('theme-pick');
  const cbox = document.getElementById('color-pick');
  const stage = document.getElementById('stage');
  const colorsOf = t => t.colors && t.colors.length ? t.colors : [{ id: 'a', label: t.label }];
  const apply = (id, cid) => {
    const t = themes.find(x => x.id === id) || themes[0];
    const cols = colorsOf(t);
    // Switch instantly: some elements animate their background, and Chrome can
    // leave them on the old color when only a color variable changes.
    stage.classList.add('retheming'); void stage.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('retheming')));
    const c = cols.find(x => x.id === (cid || store(desk + ':color:' + t.id))) || cols[0];
    themes.forEach(x => stage.classList.remove('theme-' + x.id));
    stage.classList.add('theme-' + t.id);
    stage.dataset.color = c.id;
    themes.forEach(x => colorsOf(x).forEach(y => y.cls && y.cls.split(' ').forEach(k => stage.classList.remove(k))));
    if (c.cls) c.cls.split(' ').forEach(k => stage.classList.add(k));
    THEME = { ...t, ...c, id: t.id, label: t.label, color: c.id, colorLabel: c.label };
    // Sketch ink and paper follow the color, in CSS and in the redrawn icons and illustrations.
    if (THEME.style === 'sketch' && THEME.ink) { stage.style.setProperty('--sk-ink', THEME.ink); stage.style.setProperty('--sk-paper', THEME.paper || '#fffdf8'); }
    else { stage.style.removeProperty('--sk-ink'); stage.style.removeProperty('--sk-paper'); }
    const dark = (THEME.mode || 'light') === 'dark';
    stage.classList.toggle('mode-dark', dark); stage.classList.toggle('mode-light', !dark);
    store(desk + ':theme', t.id); store(desk + ':color:' + t.id, c.id);
    sketchMode(THEME.style === 'sketch' || !!THEME.outline);
    if (box) $$('button', box).forEach(b => b.classList.toggle('on', b.dataset.t === t.id));
    if (cbox) {
      cbox.innerHTML = cols.map(x => `<button type="button" data-c="${x.id}" title="${x.label}${x.mode === 'dark' ? ' · dark' : x.mode === 'light' ? ' · light' : ''}" aria-label="${x.label}" class="${x.id === c.id ? 'on' : ''}" style="--a:${(x.sw || [])[0] || '#fff'};--b:${(x.sw || [])[1] || (x.sw || [])[0] || '#ddd'}"></button>`).join('')
        + `<span class="clbl">${c.label}</span>`;
      $$('button', cbox).forEach(b => b.addEventListener('click', () => apply(t.id, b.dataset.c)));
    }
    paintIllus();
    onChange && onChange(THEME);
  };
  if (box) {
    box.innerHTML = '<span class="lbl">Theme</span>' + themes.map(t => `<button type="button" data-t="${t.id}">${t.label}</button>`).join('');
    $$('button', box).forEach(b => b.addEventListener('click', () => apply(b.dataset.t)));
  }
  // T cycles themes and C cycles the colors of the current theme.
  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const i = themes.findIndex(x => x.id === THEME.id);
    if (k === 't') apply(themes[(i + 1) % themes.length].id);
    if (k === 'c') { const cols = colorsOf(themes[i]); const j = cols.findIndex(x => x.id === THEME.color); apply(THEME.id, cols[(j + 1) % cols.length].id); }
  });
  apply(store(desk + ':theme') || themes[0].id);
}

document.addEventListener('DOMContentLoaded', fitStage);
