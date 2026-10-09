/* Pinboard prototype. Every widget is a sticker: pick it up, move it, drop it
   and it stays where you put it. The + button pours out new stickers through
   the goo filter, and Copilot can restyle the whole board from one sentence. */

const stage = $('#stage');
const TOK = {
  previous: ic('previous', 22), next: ic('next', 22), play: ic('play', 34, 'filled'), alert: ic('alert', 26, 'filled'),
  music: ic('music-note-2', 24, 'filled'), add: ic('add', 24), mic: ic('mic', 20),
  apps: ['product/word/outline-48.svg', 'product/teams/outline-48.svg', 'product/excel/outline-48.svg'].map(p => `<span class="ic" style="--src:url('${iconSrc(p)}')"></span>`).join('') + ic('sticker', 28) + ic('send', 28),
};
stage.innerHTML = stage.innerHTML.replace(/__([a-z-]+)/g, (m, n) => TOK[n] || m);
installGoo('goo', 9, 22, -9);
protoNav('pinboard');

let toastT;
function toast(m) { const t = $('#toast'); t.innerHTML = `<img src="${ICONS}${APPS.copilot}" alt="">${m}`; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---- Clock ------------------------------------------------------------- */
(function scallop() {
  const N = 18, R = 138, A = 9; let d = '';
  for (let i = 0; i <= 360; i++) { const t = i / 360 * Math.PI * 2, r = R + A * Math.cos(N * t); d += `${i ? 'L' : 'M'}${(150 + r * Math.cos(t)).toFixed(1)} ${(150 + r * Math.sin(t)).toFixed(1)}`; }
  $('#scallop-path').setAttribute('d', d + 'Z');
})();
function tick() {
  const d = new Date(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  $('#hand-h').style.transform = `rotate(${((h % 12) + m / 60) * 30 - 90}deg)`;
  $('#hand-m').style.transform = `rotate(${(m + s / 60) * 6 - 90}deg)`;
  $('#clock-day').textContent = `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()}`;
  $('#dig-h').textContent = h % 12 || 12;
  $('#dig-m').textContent = String(m).padStart(2, '0');
  $('#cal-mon').textContent = MONTHS[d.getMonth()].toUpperCase();
  $('#cal-day').textContent = d.getDate();
}
tick(); setInterval(tick, 1000);

/* ---- Weather: tap to see the next few hours ---------------------------- */
const FORECAST = [['72', 'Sunny'], ['70', 'Clouds at 3'], ['66', 'Clear tonight'], ['72', 'Sunny']];
let fi = 0;
$('.weather').addEventListener('click', () => { fi = (fi + 1) % FORECAST.length; $('#temp').textContent = FORECAST[fi][0]; $('#cond').textContent = FORECAST[fi][1]; });

/* ---- Calendar ---------------------------------------------------------- */
$$('.ev').forEach(e => e.addEventListener('click', () => e.classList.toggle('struck')));

/* ---- Music: the wave only moves while it plays ------------------------- */
const TRACKS = [['Golden hour mix', 220], ['Porch swing', 192], ['Sunday reset', 245]];
let tr = 0, pos = 45, playing = false, phase = 0, musicT;
function drawWave() {
  const W = 310, px = pos / TRACKS[tr][1] * W; let d = 'M0 15';
  for (let x = 0; x <= px; x += 3) d += ` L${x} ${15 + Math.sin(x / 7 + phase) * (playing ? 7 : 5)}`;
  $('#wave-path').setAttribute('d', d);
  const rest = $('#wave-rest'); rest.setAttribute('x1', px + 8);
  $('#m-now').textContent = `${Math.floor(pos / 60)}:${String(pos % 60).padStart(2, '0')}`;
  $('#m-title').textContent = TRACKS[tr][0];
}
function loop() { if (playing) { phase += .12; drawWave(); requestAnimationFrame(loop); } }
function setPlay(p) {
  playing = p; $('#m-play').innerHTML = ic(p ? 'pause' : 'play', 34, 'filled');
  clearInterval(musicT);
  if (p) { musicT = setInterval(() => { pos++; if (pos >= TRACKS[tr][1]) { tr = (tr + 1) % 3; pos = 0; } }, 1000); loop(); }
  drawWave();
}
$('#m-play').addEventListener('click', () => setPlay(!playing));
$('#m-next').addEventListener('click', () => { tr = (tr + 1) % 3; pos = 0; setPlay(true); });
$('#m-prev').addEventListener('click', () => { tr = (tr + 2) % 3; pos = 0; setPlay(true); });
drawWave();

/* ---- Battery ----------------------------------------------------------- */
let batt = 82;
$('.batt').addEventListener('click', () => { $('.batt').classList.toggle('charging'); toast($('.batt').classList.contains('charging') ? 'Charging · full by 6:10' : 'On battery · about 7 hours left'); });
setInterval(() => { const c = $('.batt').classList.contains('charging'); batt = Math.max(5, Math.min(100, batt + (c ? 1 : -1))); $('#batt-n').textContent = batt; $('.batt-in').style.width = `${60 + batt * .86}px`; }, 20000);

/* ---- Volume: drag the fill; the bell holds notifications --------------- */
const track = $('#vol-track');
function setVol(e) { const r = track.getBoundingClientRect(); const v = Math.max(.12, Math.min(1, 1 - (e.clientY - r.top) / r.height)); $('#vol-fill').style.height = `${v * 100}%`; }
track.addEventListener('pointerdown', e => { e.stopPropagation(); setVol(e); const mv = ev => setVol(ev); addEventListener('pointermove', mv); addEventListener('pointerup', () => removeEventListener('pointermove', mv), { once: true }); });
$('#vol-fill').style.height = '82%';
$('#bell').addEventListener('click', () => { const m = $('#bell').classList.toggle('muted'); toast(m ? 'Notifications held until you\'re back' : 'Notifications are on'); });

/* ---- Checklist --------------------------------------------------------- */
$('#ck-list').addEventListener('click', e => { const c = e.target.closest('.ck'); if (c && !e.target.closest('input')) c.classList.toggle('done'); });
$('#ck-add').addEventListener('click', () => {
  if ($('#ck-list input')) return $('#ck-list input').focus();
  const row = html(`<div class="ck"><i></i><input placeholder="Add an item" data-nodrag></div>`);
  $('#ck-list').prepend(row); const i = $('input', row); i.focus();
  const done = () => { const v = i.value.trim(); if (v) row.replaceWith(html(`<button class="ck"><i></i><span>${v.replace(/</g, '&lt;')}</span></button>`)); else row.remove(); };
  i.addEventListener('keydown', e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') row.remove(); });
  i.addEventListener('blur', done);
});

/* ---- Memories ---------------------------------------------------------- */
const MEM = ['media/person-adam.jpg', 'media/person-sam.jpg', 'media/photo-bigsur.jpg', 'media/photo-room.jpg', 'media/tex-bloom.jpg'];
let mi = 1;
$$('.face').forEach(f => f.addEventListener('click', () => { mi = (mi + 1) % MEM.length; f.style.backgroundImage = `url(${MEM[mi]})`; f.animate([{ transform: 'rotateY(90deg)' }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' }); }));

/* ---- Stickers: pick up, move, drop; remembered between visits ---------- */
let zTop = 10;
const pos0 = store('pb-pos') || {};
function makeSticky(w) {
  const id = w.dataset.id;
  if (pos0[id]) { w.style.left = pos0[id][0] + 'px'; w.style.top = pos0[id][1] + 'px'; }
  w.style.setProperty('--tilt', (w.dataset.tilt || 0) + 'deg');
  let ox, oy;
  draggable(w, {
    onStart: () => { ox = w.offsetLeft; oy = w.offsetTop; w.style.zIndex = ++zTop; w.classList.add('lift'); w.classList.remove('drop'); },
    onMove: (dx, dy, e) => {
      w.style.left = ox + dx + 'px'; w.style.top = oy + dy + 'px';
      // Lean into the direction of travel, like paper does.
      w.style.transform = `rotate(${Math.max(-8, Math.min(8, (e.movementX || 0) * .6))}deg) scale(1.04)`;
    },
    onEnd: () => {
      w.classList.remove('lift'); w.style.transform = ''; void w.offsetWidth; w.classList.add('drop');
      const p = store('pb-pos') || {}; p[id] = [w.offsetLeft, w.offsetTop]; store('pb-pos', p);
    },
  });
}
$$('.w').forEach(makeSticky);

/* ---- The gooey + : stickers pour out of it ----------------------------- */
const TRAY = [
  { k: 'note', e: '📝', l: 'Sticky note' },
  { k: 'photo', e: '🖼️', l: 'Photo' },
  { k: 'flower', e: '🎸', l: 'Sticker' },
  { k: 'bot', e: '🫧', l: 'Bot' },
  { k: 'shape', e: '🍪', l: 'Shape' },
  { k: 'count', e: '⏳', l: 'Countdown' },
  { k: 'ask', e: '✨', l: 'Ask Copilot' },
];
// Fan the tray out on an arc above the + button.
TRAY.forEach((t, i) => { const a = Math.PI * (1.08 + .84 * i / (TRAY.length - 1)); t.at = [Math.round(Math.cos(a) * 190), Math.round(Math.sin(a) * 190)]; });
const gooEl = $('#tray-goo'), iconsEl = $('#tray-icons');
gooEl.innerHTML = '<div class="b base"></div>' + TRAY.map(() => '<div class="b"></div>').join('');
iconsEl.innerHTML = TRAY.map(t => `<button type="button" data-k="${t.k}" title="${t.l}">${t.e}<span class="lbl">${t.l}</span></button>`).join('');
let trayOpen = false;
function setTray(o) {
  trayOpen = o; $('#goo-wrap').classList.toggle('open', o);
  const blobs = $$('.b:not(.base)', gooEl), btns = $$('button', iconsEl);
  TRAY.forEach((t, i) => {
    const d = (o ? i : TRAY.length - i) * 45;
    const tf = o ? `translate(${t.at[0]}px, ${t.at[1]}px)` : 'none';
    blobs[i].style.transitionDelay = btns[i].style.transitionDelay = `${d}ms`;
    blobs[i].style.transform = btns[i].style.transform = tf;
  });
}
$('#addbtn').addEventListener('click', e => { e.stopPropagation(); setTray(!trayOpen); });
iconsEl.addEventListener('click', e => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  setTray(false);
  if (b.dataset.k === 'ask') { $('#ask-input').focus(); return; }
  addSticker(b.dataset.k);
});
stage.addEventListener('pointerdown', e => { if (trayOpen && !e.target.closest('#goo-wrap')) setTray(false); if (!e.target.closest('.addbar, .chips')) $('#chips').hidden = true; });

let stickN = 0;
function addSticker(kind, text) {
  const id = `s${Date.now()}`;
  const tilt = (Math.random() * 10 - 5).toFixed(1);
  // Bots and shapes land in open spots on the board rather than on a card.
  const OPEN = [[560, 880], [770, 690], [1420, 850], [300, 360], [1170, 250], [690, 300], [1600, 260]];
  const spot = (kind === 'bot' || kind === 'shape') ? OPEN[stickN % OPEN.length] : null;
  const x = spot ? spot[0] + Math.random() * 30 : 820 + Math.random() * 300, y = spot ? spot[1] + Math.random() * 20 : 120 + Math.random() * 260;
  let inner = '', cls = '';
  if (kind === 'note') { cls = 'note'; inner = text || 'Call the vet about Pepper'; }
  if (kind === 'photo') { cls = 'polaroid'; const p = ['media/photo-bigsur.jpg', 'media/photo-room.jpg', 'media/photo-living.jpg'][stickN++ % 3]; inner = `<div style="background-image:url(${p})"></div><span>${text || 'last summer'}</span>`; }
  if (kind === 'flower') { cls = 'sticker-il'; inner = `<span data-illus="${STICKERS[stickN++ % STICKERS.length]}"></span>`; }
  if (kind === 'bot') { cls = 'bot-w'; }
  if (kind === 'shape') { cls = 'shape-st'; const n = text || SHAPE_NAMES[stickN++ % SHAPE_NAMES.length]; inner = `<svg viewBox="-60 -60 120 120"><path d="${shapePath(SHAPES[n], 54)}"/></svg>`; }
  if (kind === 'count') { cls = 'count'; inner = `<div><span><b>9</b><small>days to Lisbon</small></span></div>`; }
  const w = html(`<div class="w ${cls} new" data-id="${id}" data-tilt="${tilt}" style="left:${x}px;top:${y}px;z-index:${++zTop}${kind === 'flower' ? ';width:130px;height:130px' : ''}">${inner}</div>`);
  if (kind === 'flower') paintIllus(w);
  if (kind === 'note') {
    w.title = 'Double-click to write';
    w.addEventListener('dblclick', () => { w.setAttribute('contenteditable', 'true'); w.spellcheck = false; w.focus(); });
    w.addEventListener('blur', () => w.removeAttribute('contenteditable'));
  }
  $('#board').appendChild(w); makeSticky(w);
  if (kind === 'count') w.style.setProperty('--pct', '72%');
  if (kind === 'bot') mountBot(w, BOT_KINDS[stickN++ % BOT_KINDS.length]);
  if (kind === 'shape') w.style.setProperty('--shape-c', themeColors()[stickN % themeColors().length]);
  return w;
}

/* ---- Copilot decorates ------------------------------------------------- */
const CHIPS = ['Make it cozy for fall', 'Calm night mode', 'Add a countdown to Lisbon', 'Back to my theme'];
$('#ask-input').addEventListener('focus', () => {
  const c = $('#chips'); c.hidden = false;
  c.innerHTML = CHIPS.map((t, i) => `<button type="button" style="animation-delay:${i * 50}ms">${t}</button>`).join('');
  $$('button', c).forEach(b => b.addEventListener('click', () => decorate(b.textContent)));
});
$('#ask').addEventListener('submit', e => { e.preventDefault(); const v = $('#ask-input').value.trim(); if (v) decorate(v); });

function clearDecor() { $$('.leaf, .star').forEach(x => x.remove()); }
function palette(p) { stage.classList.remove('pal-sunny', 'pal-fall', 'pal-night', 'pal-m365', 'pal-riso', 'pal-sketch'); stage.classList.add('pal-' + p); }
function decorate(v) {
  const q = v.toLowerCase();
  // The helper bot gets to work, and the bots on the board join in.
  if (window.copBot) { copBot.work(2000); BOARD_BOTS.forEach((b, i) => setTimeout(() => b.work(1400), 200 + i * 160)); }
  $('#chips').hidden = true; $('#ask-input').value = ''; $('#ask-input').blur();
  if (/fall|autumn|cozy|warm|halloween/.test(q)) {
    palette('fall'); clearDecor();
    ['🍂', '🍁', '🍂', '🍁', '🍂'].forEach((l, i) => { const el = html(`<div class="leaf" style="left:${[380, 1020, 1210, 760, 1600][i]}px;top:${[420, 140, 330, 820, 460][i]}px;animation-delay:${i * 120}ms;transform:rotate(${i * 37}deg)">${l}</div>`); $('#board').appendChild(el); });
    toast('Warmed everything up for fall. Your stickers stayed put.');
  } else if (/night|calm|dark|sleep|evening/.test(q)) {
    palette('night'); clearDecor();
    for (let i = 0; i < 40; i++) { const s = html(`<i class="star" style="left:${Math.random() * 1920}px;top:${Math.random() * 520}px;animation-delay:${Math.random() * 3}s;transform:scale(${.4 + Math.random()})"></i>`); $('#board').prepend(s); }
    toast('Night mode. Quieter colors, same board.');
  } else if (/sun|bright|spring|reset|back|default/.test(q)) {
    palette(THEME.pal); clearDecor(); toast(`Back to ${THEME.label}.`);
  } else if (/countdown|days|lisbon|trip/.test(q)) {
    addSticker('count'); toast('Pinned a countdown. It ticks down on its own.');
  } else if (/photo|picture|memory/.test(q)) {
    addSticker('photo', 'from your phone'); toast('Pinned a photo from this week.');
  } else {
    addSticker('note', v); toast('Pinned it as a note.');
  }
}

/* ---- Themes ------------------------------------------------------------ */
// Windows is the board as designed. M365 swaps in the M365 palette and its
// illustration style. Stipple and Texture lay a print finish over every
// widget and restyle the illustration stickers to match.
const STICKERS = ['crown', 'headphone', 'camera', 'telescope', 'crayon', 'candle', 'compass', 'notes'];
const TEXS = { music: 'stripes', batt: 'stripes', vol: 'dots', check: 'dots', cal: 'grid', mem: 'grid', weather: 'dots', digits: 'stripes', clock: 'none' };
function texify() {
  $$('.board > .w').forEach(w => {
    if (w.classList.contains('sticker-il') || w.classList.contains('bot-w') || w.classList.contains('shape-st') || w.dataset.id === 'clock' || $(':scope > .tex', w)) return;
    const kind = TEXS[w.dataset.id] || 'dots';
    if (w.dataset.id === 'digits') { $$('.pebble', w).forEach(p => { if (!$('.tex', p)) p.appendChild(html('<i class="tex stripes"></i>')); }); return; }
    w.appendChild(html(`<i class="tex ${kind}"></i>`));
  });
}
setupThemes('pinboard', [
  { id: 'windows', label: 'Windows', style: 'windows', pal: 'sunny' },
  { id: 'm365', label: 'M365', style: 'm365', pal: 'm365', outline: true, ink: '#484848' },
  { id: 'stipple', label: 'Stipple', style: 'stipple', pal: 'riso', tex: 'stipple' },
  { id: 'texture', label: 'Texture', style: 'texture', pal: 'sunny', tex: 'pattern' },
  { id: 'sketch', label: 'Sketch', style: 'sketch', pal: 'sketch', ink: '#2b2440', paper: '#fffdf8' },
], t => {
  clearDecor(); palette(t.pal);
  stage.classList.toggle('tex-stipple', t.tex === 'stipple');
  stage.classList.toggle('tex-pattern', t.tex === 'pattern');
  texify();
  if (window.applyBotTheme) applyBotTheme(t);
});

/* ---- Bots on the board -------------------------------------------------- */
// Plush little helpers. They watch the pointer, hop when Copilot is working,
// and doze off if you leave them alone. Tap one to say hi, drag it anywhere.
var BOARD_BOTS = [];
const BOT_KINDS = [
  { shape: 'cookie6', eyes: 'round' }, { shape: 'clover4', eyes: 'dot' }, { shape: 'pill', eyes: 'round' },
  { shape: 'sunny', eyes: 'dot' }, { shape: 'arch', eyes: 'round' }, { shape: 'gem', eyes: 'dot' }, { shape: 'puffy', eyes: 'round' },
];
const BOT_SAYS = ['Hi!', 'Need a hand?', 'I tidied your stickers', '9 days to Lisbon!', 'Run at 6, right?', 'Nice board :)'];
const PALETTES = {
  windows: ['#f4a3c1', '#9fd49a', '#a9b8ff', '#ffc97a', '#c9a7f0', '#7fd6d0'],
  m365: ['#2F95F4', '#8661C5', '#FB966E', '#9fc8f5', '#c3a8ec'],
  stipple: ['#FFD23D', '#E8357A', '#2A3BD9', '#12855A', '#FF8FB8'],
  texture: ['#f4a3c1', '#9fd49a', '#a9b8ff', '#ffc97a', '#c9a7f0'],
  sketch: ['#fffdf8'],
};
function themeColors() { return PALETTES[(THEME && THEME.id) || 'windows'] || PALETTES.windows; }
let saysN = 0;
function mountBot(w, kind, size = 112) {
  const i = BOARD_BOTS.length;
  const b = new Bot({ ...kind, color: themeColors()[i % themeColors().length], size });
  w.appendChild(b.el); w.style.width = size + 'px'; w.style.height = size + 'px';
  b.doze = 18000 + Math.random() * 14000;
  w.addEventListener('click', () => {
    b.poke();
    $('.bot-bubble', w)?.remove();
    const bub = html(`<span class="bot-bubble">${BOT_SAYS[saysN++ % BOT_SAYS.length]}</span>`);
    w.appendChild(bub); setTimeout(() => bub.remove(), 1800);
  });
  w.addEventListener('dblclick', () => b.setState(b.state === 'sleeping' ? 'default' : 'sleeping'));
  BOARD_BOTS.push(b);
  return b;
}
$$('.bot-w').forEach((w, i) => mountBot(w, BOT_KINDS[i], [118, 96, 104][i]));
// The helper in the Copilot bar is a bot too.
var copBot = new Bot({ shape: 'cookie9', color: '#a9b8ff', size: 52, cheeks: false, eyes: 'dot' });
copBot.doze = 40000; $('#cop-bot').appendChild(copBot.el);

/* ---- Shape kit ---------------------------------------------------------- */
const KIT = ['cookie6', 'clover4', 'sunny', 'burst', 'pill', 'arch', 'gem', 'heart', 'flower', 'pentagon', 'cookie12', 'triangle'];
const KIT_NAME = { cookie6: 'Cookie', clover4: 'Clover', sunny: 'Sunny', burst: 'Burst', pill: 'Pill', arch: 'Arch', gem: 'Gem', heart: 'Heart', flower: 'Flower', pentagon: 'Pentagon', cookie12: 'Soft burst', triangle: 'Triangle' };
let kitShape = 'cookie6';
const kitPath = $('#kit-shape');
kitPath.setAttribute('d', shapePath(SHAPES[kitShape], 50)); kitPath._r = SHAPES[kitShape];
$('#kit-grid').innerHTML = KIT.map((n, i) => `<button data-s="${n}" title="${KIT_NAME[n]}" style="--i:${i}"><svg viewBox="-60 -60 120 120"><path d="${shapePath(SHAPES[n], 50)}"/></svg></button>`).join('');
$('#kit-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  kitShape = b.dataset.s; morphPath(kitPath, kitShape, { size: 50 });
  $('#kit-name').textContent = KIT_NAME[kitShape];
  $$('#kit-grid button').forEach(x => x.classList.toggle('on', x === b));
});
$('#kit-grid button').classList.add('on');
$('#kit-stick').addEventListener('click', () => { addSticker('shape', kitShape); });

/* ---- Controls ----------------------------------------------------------- */
$('#m3-switch').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
  e.currentTarget.setAttribute('aria-checked', on);
  BOARD_BOTS.forEach(b => on ? b.setState('sleeping') : b.setState('default'));
  toast(on ? 'Focus on. The bots are napping.' : 'Focus off. Everyone is awake.');
});
const slider = $('#m3-slider');
function setGlow(v) {
  slider.style.setProperty('--v', v);
  $('#board').style.filter = `saturate(${.5 + v}) brightness(${.92 + v * .14})`;
}
slider.addEventListener('pointerdown', e => {
  e.stopPropagation();
  const r = slider.getBoundingClientRect();
  const mv = ev => setGlow(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)));
  mv(e); addEventListener('pointermove', mv); addEventListener('pointerup', () => removeEventListener('pointermove', mv), { once: true });
});
setGlow(.5);
const TILTS = { calm: 0, cozy: 1, busy: 2.6 };
$$('#m3-seg button').forEach(b => b.addEventListener('click', () => {
  $$('#m3-seg button').forEach(x => x.classList.toggle('on', x === b));
  const k = TILTS[b.dataset.v];
  $$('.board > .w').forEach(w => {
    const base = parseFloat(w.dataset.tilt || (Math.random() * 6 - 3).toFixed(1));
    w.dataset.tilt = w.dataset.tilt || base;
    w.style.setProperty('--tilt', (base * k) + 'deg');
    if (!w.classList.contains('sticker-il') && !w.classList.contains('note') && !w.classList.contains('polaroid')) w.style.rotate = (base * k * .6) + 'deg';
  });
}));
// Wavy progress: an expressive loading indicator that wobbles as it fills.
let syncP = .64, wphase = 0;
function drawWavy() {
  wphase += .08; let d = '';
  const end = syncP * TAU;
  for (let a = 0; a <= end; a += .05) { const r = 17 + Math.sin(a * 9 + wphase) * 1.6; d += (a ? 'L' : 'M') + (Math.cos(a - Math.PI / 2) * r).toFixed(2) + ' ' + (Math.sin(a - Math.PI / 2) * r).toFixed(2); }
  $('#wavy').setAttribute('d', d);
  requestAnimationFrame(drawWavy);
}
drawWavy();
setInterval(() => {
  syncP = syncP >= 1 ? .05 : Math.min(1, syncP + .03);
  $('#sync-pct').textContent = Math.round(syncP * 100) + '%';
  $('#sync-txt').textContent = syncP >= 1 ? 'Photos synced' : 'Syncing photos';
}, 900);
// The FAB morphs to a new shape on every press, and a bot hops out.
let fabI = 0;
const fab = $('#fab-shape'); fab.setAttribute('d', shapePath(SHAPES.cookie9, 50)); fab._r = SHAPES.cookie9;
$('#m3-fab').addEventListener('click', e => {
  e.stopPropagation();
  fabI = (fabI + 1) % KIT.length; morphPath(fab, KIT[fabI], { size: 50 });
  addSticker('bot');
});

var applyBotTheme = function (t) {
  botsLook({ sketch: t.id === 'sketch', ink: t.ink || '#2b2440', paper: t.paper || '#fffdf8' });
  const pal = themeColors();
  BOARD_BOTS.forEach((b, i) => b.setColor(pal[i % pal.length]));
  copBot.setColor(pal[(pal.length > 2 ? 2 : 0)]);
  $$('.shape-st').forEach((w, i) => w.style.setProperty('--shape-c', pal[i % pal.length]));
};
applyBotTheme(THEME);
