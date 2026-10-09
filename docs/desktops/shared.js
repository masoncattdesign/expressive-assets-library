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
    `<a href="${k}.html"${k === current ? ' aria-current="page"' : ''}>${l}</a>`).join('')}<span class="themes" id="theme-pick" role="group" aria-label="Theme"></span>${location.protocol === 'file:' ? '' : `<a class="dl" href="Desktop-prototypes.zip" download title="Download all three prototypes, with a README and notes for an agent">${ic('arrow-download', 16)}Download</a>`}<span class="hint">Everything here is clickable</span></nav>`);
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
  return styled(src, style || (THEME && THEME.style) || 'windows');
}
function paintIllus(root = document) {
  $$('[data-illus]', root).forEach(el => { el.innerHTML = illusSVG(el.dataset.illus); el.classList.add('illus'); });
}
// themes: [{ id, label, style, cls }]. The chosen one is remembered per desktop.
function setupThemes(desk, themes, onChange) {
  const box = document.getElementById('theme-pick');
  const stage = document.getElementById('stage');
  const apply = id => {
    const t = themes.find(x => x.id === id) || themes[0];
    themes.forEach(x => stage.classList.remove('theme-' + x.id));
    stage.classList.add('theme-' + t.id);
    THEME = t; store(desk + ':theme', t.id);
    if (box) $$('button', box).forEach(b => b.classList.toggle('on', b.dataset.t === t.id));
    paintIllus();
    onChange && onChange(t);
  };
  if (box) {
    box.innerHTML = '<span class="lbl">Theme</span>' + themes.map(t => `<button type="button" data-t="${t.id}">${t.label}</button>`).join('');
    $$('button', box).forEach(b => b.addEventListener('click', () => apply(b.dataset.t)));
  }
  // T cycles themes from the keyboard.
  addEventListener('keydown', e => {
    if (e.target.closest('input, [contenteditable]') || e.key.toLowerCase() !== 't') return;
    const i = themes.findIndex(x => x === THEME);
    apply(themes[(i + 1) % themes.length].id);
  });
  apply(store(desk + ':theme') || themes[0].id);
}

document.addEventListener('DOMContentLoaded', fitStage);
