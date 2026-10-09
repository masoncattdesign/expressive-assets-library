/* Mosaic prototype. Tiles sit on a grid that grows out from a horizon line.
   Copilot does the growing: it suggests tiles from what it knows about your
   week, fills an empty slot when you ask, and builds a whole row from one
   sentence. Every tile can be picked up and moved to an open slot. */

protoNav('mosaic');
const grid = $('#grid');
const CELL = 172, GAP = 16, X0 = 122, Y0 = 144, NC = 9, NR = 5;
const cx = c => X0 + c * (CELL + GAP), cy = r => Y0 + r * (CELL + GAP), cw = w => w * CELL + (w - 1) * GAP;
const COP = ICONS + APPS.copilot;

let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/* ---- Tile content ------------------------------------------------------ */
const now = new Date();
const T = {
  cal: () => `<div class="pad t-cal-in"><div class="eyebrow">${DAYS[now.getDay()]}</div><div class="big">${now.getDate()}</div><p>Run · 6 pm</p><p><span>Dinner · 7:30</span></p></div>`,
  meet: () => `<div class="pad"><small style="color:rgba(42,24,56,.7)">Leave in 20 min for</small><h4>Garden club</h4><small>with the neighbors</small><span class="pill-dark">${ic('calendar-ltr', 14)} 5:30 pm</span></div>`,
  dev: () => `<div class="pad"><div style="display:flex;justify-content:space-between">${ic('pen', 30)}<button class="round-btn" data-act="device">${ic('more-horizontal', 18)}</button></div><h4 data-dev-name>Surface Pen</h4><small data-dev-sub>82% · charging</small><div class="bar"><i data-dev-bar style="width:78%"></i></div></div>`,
  photos: () => `<div class="ph" style="left:18px;top:12px;transform:rotate(-8deg);background-image:url(media/photo-living.jpg)"></div><div class="ph" style="left:44px;top:8px;background-image:url(media/photo-room.jpg)"></div><div class="ph" style="left:68px;top:16px;transform:rotate(8deg);background-image:url(media/photo-bigsur.jpg)"></div><div class="cnt"><b>39</b><small>new photos</small></div>`,
  weather: () => { const h = now.getHours(); return `<div class="pad">It's <em>64°</em> now<br>in <span class="hi">Seattle.</span><br><em>Clear and cool ${h >= 17 ? 'tonight' : h >= 12 ? 'this afternoon' : 'this morning'}.</em></div>`; },
  focus: () => `<div class="pad"><div style="display:flex;align-items:center;gap:12px"><button class="play" data-act="focus">${ic('play', 20, 'filled')}</button><b style="font-size:14px">Deep work</b></div><div class="big" data-focus>25:00</div></div>`,
  flight: () => `<div class="pad"><b style="font-size:18px">Next flight</b><small>Seattle · Tokyo</small></div><div class="board"></div><div class="pad" style="top:72px;padding-top:6px" data-act="flap"><div class="flap" data-flap="TOKYO"></div><div class="flap small" data-flap="18 OCT  07:45"></div></div>`,
  contact: () => `<div class="pad"><h4>Call Sam back?</h4><div class="row"><button data-act="call" title="Call">${ic('call', 16)}</button><button data-act="msg" title="Message">${ic('chat', 16)}</button><button data-act="video" title="Video">${ic('video', 16)}</button></div></div>`,
  music: () => `<div class="art"></div><div class="info"><b data-m-title>Night drive</b><small data-m-sub>Lumen · Late hours</small></div><div class="ctl"><button data-act="play">${ic('play', 18, 'filled')}</button><div class="prog"><i data-m-fill style="width:35%"></i></div></div><div class="times"><span data-m-now>1:14</span><span>3:40</span></div>`,
  lamp: () => `<div class="glow"></div><div class="lamp"><div class="shade"></div><div class="stem"></div><div class="base"></div></div><div class="sw"><button data-act="lamp-off" title="Off">${ic('lightbulb', 16)}</button><button data-act="lamp-on" class="on" title="On">${ic('lightbulb', 16, 'filled')}</button></div>`,
  apps: () => `<div class="pad">${[['Teams', APPS.teams], ['Copilot', APPS.copilot], ['Word', APPS.word], ['News', 'app/news/standard-48.svg']].map(([n, p]) => `<button data-act="app" data-app="${n}" title="${n}"><img src="${ICONS}${p}" alt=""></button>`).join('')}</div>`,
  tasks: () => `<div class="pad"><div class="hd"><b>Today</b><span class="lime-chip" data-left>2 left</span></div>${[['Send party invites', true], ['Book flights'], ['Pick up groceries']].map(([t, d]) => `<button class="check${d ? ' done' : ''}" data-act="check"><i></i>${t}</button>`).join('')}</div>`,
  relax: () => `<div class="orb"></div><div class="pad"><span class="t-il tl" data-illus="crayon"></span><p data-relax>Relax with a creative task</p><button class="outline-pill" data-act="relax">Begin</button></div>`,
  memory: () => `<div class="pad"><div><small>One year ago</small><h4>Big Sur</h4></div><button class="share" data-act="share">Share</button></div>`,
  streak: () => `<div class="pad"><div style="font:600 36px/1 var(--font-display)">5 days</div><small>of morning runs</small></div>`,
  commute: () => `<svg viewBox="0 0 152 80"><path id="cm-path" d="M4 66 C 30 66, 40 40, 70 46 S 110 60, 124 30 S 140 10, 150 8" fill="none" stroke="#d4f07a" stroke-width="5" stroke-linecap="round"/><circle cx="150" cy="8" r="6" fill="#d4f07a"/><circle r="7" fill="#fff" data-car><animateMotion dur="5s" repeatCount="indefinite"><mpath href="#cm-path"/></animateMotion></circle></svg><div class="big">18 min</div><small>to Capitol Hill</small>`,
};
const TILE_CLASS = { streak: 't-streak', cal: 't-cal', meet: 't-meet', dev: 't-dev', photos: 't-photos', weather: 't-weather', focus: 't-focus', flight: 't-flight', contact: 't-contact', music: 't-music', lamp: 't-lamp on', apps: 't-apps', tasks: 't-tasks', relax: 't-relax', memory: 't-memory', commute: 't-commute' };
const TILE_BG = { contact: 'media/person-sam.jpg', relax: 'media/tex-bloom.jpg', memory: 'media/photo-bigsur.jpg' };

let tiles = [
  { id: 'cal', c: 2, r: 1, w: 1 }, { id: 'meet', c: 3, r: 1, w: 1 }, { id: 'dev', c: 4, r: 1, w: 2 }, { id: 'photos', c: 6, r: 1, w: 1 },
  { id: 'weather', c: 0, r: 2, w: 2 }, { id: 'focus', c: 2, r: 2, w: 1 }, { id: 'flight', c: 3, r: 2, w: 2 }, { id: 'contact', c: 5, r: 2, w: 1 }, { id: 'music', c: 6, r: 2, w: 2 }, { id: 'lamp', c: 8, r: 2, w: 1 },
  { id: 'streak', c: 0, r: 3, w: 1, il: 'achievement' }, { id: 'apps', c: 1, r: 3, w: 1 }, { id: 'tasks', c: 2, r: 3, w: 2 }, { id: 'relax', c: 4, r: 3, w: 1 }, { id: 'memory', c: 5, r: 3, w: 2 }, { id: 'commute', c: 7, r: 3, w: 1 },
];
const slotCells = new Set(['0,1', '1,1', '7,1', '8,1', '0,3', '8,3', '3,0', '4,0', '5,0', '1,4', '6,4', '7,4']);
tiles.forEach(t => { for (let i = 0; i < t.w; i++) slotCells.add(`${t.c + i},${t.r}`); });

function occupied(except) {
  const s = new Set();
  tiles.forEach(t => { if (t !== except) for (let i = 0; i < t.w; i++) s.add(`${t.c + i},${t.r}`); });
  return s;
}

/* ---- Render ------------------------------------------------------------ */
function placeEl(el, t) { Object.assign(el.style, { left: cx(t.c) + 'px', top: cy(t.r) + 'px', width: cw(t.w) + 'px', height: CELL + 'px' }); }
function makeTile(t) {
  const el = html(`<div class="tile ${t.cls || TILE_CLASS[t.id] || ''}" data-id="${t.id}">${t.html || T[t.id]()}</div>`);
  if (TILE_BG[t.id]) el.style.backgroundImage = `url(${TILE_BG[t.id]})`;
  if (t.il) addIl(el, t.il);
  placeEl(el, t);
  t.el = el;
  grid.appendChild(el);
  bindDrag(t);
  return el;
}
// A Windows illustration on a tile, restyled by the current theme.
function addIl(el, name, cls = '') { el.insertAdjacentHTML('beforeend', `<span class="t-il ${cls}" data-illus="${name}"></span>`); paintIllus(el); }
function renderSlots() {
  $$('.slot', grid).forEach(s => s.remove());
  const occ = occupied();
  for (const k of slotCells) {
    if (occ.has(k)) continue;
    const [c, r] = k.split(',').map(Number);
    const s = html(`<button class="slot" data-c="${c}" data-r="${r}" title="Add a tile">${ic('add', 22)}</button>`);
    Object.assign(s.style, { left: cx(c) + 'px', top: cy(r) + 'px' });
    s.addEventListener('click', e => { e.stopPropagation(); slotPopover(c, r, s); });
    grid.prepend(s);
  }
}
tiles.forEach(makeTile);
renderSlots();

/* ---- Drag a tile to an open slot --------------------------------------- */
function bindDrag(t) {
  let ox, oy, target = null;
  draggable(t.el, {
    onStart: () => { closePopover(); t.el.classList.add('dragging'); ox = cx(t.c); oy = cy(t.r); },
    onMove: (dx, dy) => {
      t.el.style.left = ox + dx + 'px'; t.el.style.top = oy + dy + 'px';
      const c = Math.round((ox + dx - X0) / (CELL + GAP)), r = Math.round((oy + dy - Y0) / (CELL + GAP));
      const occ = occupied(t);
      let ok = c >= 0 && r >= 0 && c + t.w <= NC && r < NR;
      for (let i = 0; ok && i < t.w; i++) if (occ.has(`${c + i},${r}`)) ok = false;
      target = ok ? { c, r } : null;
      $$('.slot', grid).forEach(s => { const sc = +s.dataset.c, sr = +s.dataset.r; s.classList.toggle('target', !!target && sr === r && sc >= c && sc < c + t.w); });
    },
    onEnd: () => {
      t.el.classList.remove('dragging');
      if (target && (target.c !== t.c || target.r !== t.r)) {
        for (let i = 0; i < t.w; i++) slotCells.add(`${target.c + i},${target.r}`);
        t.c = target.c; t.r = target.r;
      }
      placeEl(t.el, t); renderSlots();
    },
  });
}

/* ---- Tile behavior ----------------------------------------------------- */
let focusLeft = 25 * 60, focusT = null, playing = false, mpos = 74, musicT = null, devIdx = 0;
const DEVICES = [['Surface Pen', '82% · charging', 78], ['Earbuds', '64% · in case', 62], ['Phone', '41% · not charging', 40]];
grid.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const tile = b.closest('.tile'); const act = b.dataset.act;
  if (act === 'focus') {
    if (focusT) { clearInterval(focusT); focusT = null; b.innerHTML = ic('play', 20, 'filled'); return; }
    b.innerHTML = ic('pause', 20, 'filled');
    focusT = setInterval(() => { focusLeft = Math.max(0, focusLeft - 1); $('[data-focus]', tile).textContent = fmt(focusLeft); }, 1000);
  }
  if (act === 'play') {
    playing = !playing; tile.classList.toggle('playing', playing);
    b.innerHTML = ic(playing ? 'pause' : 'play', 18, 'filled');
    clearInterval(musicT);
    if (playing) musicT = setInterval(() => { mpos = (mpos + 1) % 220; $('[data-m-now]', tile).textContent = fmt(mpos); $('[data-m-fill]', tile).style.width = mpos / 220 * 100 + '%'; }, 1000);
  }
  if (act === 'lamp-on' || act === 'lamp-off') {
    const on = act === 'lamp-on'; tile.classList.toggle('on', on);
    $$('.sw button', tile).forEach(x => x.classList.toggle('on', x.dataset.act === act));
  }
  if (act === 'check') {
    b.classList.toggle('done');
    const left = $$('.check:not(.done)', tile).length; const chip = $('[data-left]', tile);
    if (chip) chip.textContent = left ? `${left} left` : 'All done';
  }
  if (act === 'relax') {
    const on = !tile.classList.contains('breathing'); tile.classList.toggle('breathing', on);
    $('[data-relax]', tile).textContent = on ? 'Breathe in as it grows, out as it shrinks' : 'Relax with a creative task';
    b.textContent = on ? 'Stop' : 'Begin';
  }
  if (act === 'share') toast('Shared Big Sur with Maya');
  if (act === 'call') toast('Calling Sam…');
  if (act === 'msg') toast('Sent Sam: "Free after 6, call you then"');
  if (act === 'video') toast('Starting a video call with Sam');
  if (act === 'app') toast(`Opening ${b.dataset.app}`);
  if (act === 'flap') runFlaps(tile);
  if (act === 'device') {
    devIdx = (devIdx + 1) % DEVICES.length; const [n, s, p] = DEVICES[devIdx];
    $('[data-dev-name]', tile).textContent = n; $('[data-dev-sub]', tile).textContent = s; $('[data-dev-bar]', tile).style.width = p + '%';
  }
});

/* Split-flap board */
const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:';
async function runFlaps(root = document) {
  for (const el of $$('[data-flap]', root)) {
    const target = el.dataset.flap;
    el.innerHTML = [...target].map(() => '<span>&nbsp;</span>').join('');
    const spans = $$('span', el);
    [...target].forEach((ch, i) => {
      if (ch === ' ') { spans[i].innerHTML = '&nbsp;'; return; }
      let n = 6 + i * 2 + Math.floor(Math.random() * 4);
      const step = () => {
        spans[i].classList.remove('f'); void spans[i].offsetWidth; spans[i].classList.add('f');
        spans[i].textContent = n-- > 0 ? FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)] : ch;
        if (n >= 0) setTimeout(step, 55);
      };
      setTimeout(step, i * 40);
    });
  }
}
runFlaps();

/* ---- Copilot suggestions (Rev 1) --------------------------------------- */
const SUGG = [
  { id: 'pack', c: 0, r: 1, w: 2, il: 'umbrella', cls: 'suggested t-sugg', html: `<span class="ai-badge"><img src="${COP}" alt=""></span><div class="pad"><div class="src"><img src="${COP}" alt="">Suggested for your trip</div><h4>Tokyo packing</h4><small>6 items from your trip email and last year's list</small><div class="mini-btns"><button data-s="add">Add tile</button><button class="ghost" data-s="no">Not now</button></div></div>`,
    real: `<div class="pad"><div class="hd" style="display:flex;justify-content:space-between;margin-bottom:8px"><b style="font-size:17px">Tokyo packing</b><span class="lime-chip">4 left</span></div>${['Passport', 'Rail pass voucher', 'Adapter (type A)', 'Rain jacket'].map(t => `<button class="check" data-act="check"><i></i>${t}</button>`).join('')}</div>`, realCls: 't-tasks' },
  { id: 'checkin', c: 7, r: 1, w: 1, il: 'compass', cls: 'suggested t-sugg', html: `<span class="ai-badge"><img src="${COP}" alt=""></span><div class="pad"><div class="src"><img src="${COP}" alt="">From TAP</div><h4 style="margin-top:14px">Check-in opens in 6 hours</h4><div class="mini-btns"><button data-s="add">Add</button></div></div>`,
    real: `<div class="pad"><h4 style="margin:0 0 2px;font:600 17px/1.2 var(--font)">Check in</h4><small>Opens 1:45 AM · seat 32A held</small></div>`, realCls: 't-gradline' },
];
grid.addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  const el = b.closest('.tile'); const t = tiles.find(x => x.el === el); const s = SUGG.find(x => x.id === t.id);
  if (b.dataset.s === 'add') {
    el.className = `tile ${s.realCls} grow`; el.innerHTML = s.real; if (s.il) addIl(el, s.il); toast(`${s.id === 'pack' ? 'Tokyo packing' : 'Check-in'} added`);
  } else { el.classList.add('leave'); setTimeout(() => { el.remove(); tiles = tiles.filter(x => x !== t); renderSlots(); }, 420); }
});
function suggest() {
  const occ = occupied();
  SUGG.forEach((s, i) => {
    let free = true; for (let k = 0; k < s.w; k++) if (occ.has(`${s.c + k},${s.r}`)) free = false;
    if (!free || tiles.some(t => t.id === s.id)) return;
    setTimeout(() => { const t = { ...s }; tiles.push(t); makeTile(t).classList.add('grow'); renderSlots(); }, 300 + i * 260);
  });
}
function banner(text, undoLabel = 'Undo', onUndo) {
  const b = $('#banner'); $('#banner-text').textContent = text; $('#banner-undo').textContent = undoLabel;
  b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  $('#banner-undo').onclick = () => { b.hidden = true; onUndo && onUndo(); };
}
setTimeout(() => {
  banner('Travel week is coming up. I have 2 tiles for your Tokyo trip.', 'Show me', () => {
    suggest();
    setTimeout(() => banner('Nothing lands without a tap. Add the ones you want.', 'Got it'), 900);
  });
}, 1400);

/* ---- An empty slot: Copilot offers what fits --------------------------- */
const OPTIONS = [
  { t: 'Package', s: 'Arrives today by 8 pm', w: 1, il: 'mailbox', html: `<div class="pad"><h4 style="margin:0 0 2px;font:600 17px/1.2 var(--font)">Arrives by 8 pm</h4><small>Rain jacket · 2 stops away</small></div>` },
  { t: 'Guitar practice', s: 'You played 4 days this week', w: 1, il: 'guitar', html: `<div class="pad" style="background:linear-gradient(160deg,#3b2a6b,#1f1840)"><h4 style="margin:0 0 2px;font:600 17px/1.2 var(--font)">15 min today</h4><small>4-day streak</small></div>` },
  { t: 'Steps', s: 'From your phone', w: 1, il: 'stopwatch', html: `<div class="pad"><div style="font:600 32px/1 var(--font-display)">6,240</div><small>steps today · goal 8,000</small></div>` },
  { t: "Lily's school", s: 'Picture day, field trip, early release', w: 2, il: 'calendar', html: `<div class="pad" style="background:linear-gradient(135deg,#4f46e5,#7c3aed)"><b style="font-size:17px">Lily's school</b><small style="color:rgba(255,255,255,.75)">This week</small><div style="margin-top:18px;display:grid;gap:6px;font:400 14px/1.2 var(--font)"><span>Tue · Picture day</span><span>Thu · Field trip, pack lunch</span><span>Fri · Early release 1:30</span></div></div>` },
  { t: 'Stargazing', s: 'Clear skies tonight after 9', w: 2, il: 'telescope', html: `<div class="pad" style="background:linear-gradient(135deg,#1b2a63,#3a6fe8)"><small style="color:rgba(255,255,255,.8)">Tonight</small><b style="display:block;font-size:22px;margin-top:4px">Clear skies after 9</b><small style="color:rgba(255,255,255,.8);margin-top:30px">Saturn rises at 9:40</small></div>` },
];
function slotPopover(c, r, slotEl) {
  closePopover();
  slotEl.classList.add('picked');
  const occ = occupied();
  const wide = c + 1 < NC && slotCells.has(`${c + 1},${r}`) && !occ.has(`${c + 1},${r}`);
  const opts = OPTIONS.filter(o => o.w === 1 || wide).filter(o => !tiles.some(t => t.id === 'o-' + o.t)).slice(0, 4);
  const p = $('#popover');
  p.innerHTML = `<h5><img src="${COP}" alt="">What should grow here?</h5><small>Picked from what you use and what's coming up${wide ? ' · fits one or two wide' : ''}</small>
    ${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="sw il" data-illus="${o.il}"></span><span><b>${o.t}${o.w === 2 ? ' · wide' : ''}</b><small>${o.s}</small></span></button>`).join('')}
    <button class="opt" data-ask><span class="sw" style="background:rgba(255,255,255,.1)">${ic('sparkle', 20)}</span><span><b>Something else</b><small>Describe it and Copilot builds it</small></span></button>`;
  const left = Math.min(cx(c), 1920 - 350), top = r >= 3 ? cy(r) - 330 : cy(r) + CELL + 10;
  Object.assign(p.style, { left: left + 'px', top: top + 'px' });
  p.hidden = false; paintIllus(p);
  $$('.opt[data-i]', p).forEach(b => b.addEventListener('click', () => {
    const o = opts[+b.dataset.i]; closePopover();
    const t = { id: 'o-' + o.t, c, r, w: o.w, html: o.html, cls: '', il: o.il };
    for (let i = 0; i < t.w; i++) slotCells.add(`${c + i},${r}`);
    tiles.push(t); makeTile(t).classList.add('grow'); renderSlots();
    toast(`${o.t} grew into place`);
  }));
  $('[data-ask]', p).addEventListener('click', () => { closePopover(); openBuild(); });
}
function closePopover() { $('#popover').hidden = true; $$('.slot.picked').forEach(s => s.classList.remove('picked')); }
$('#stage').addEventListener('click', e => { if (!e.target.closest('.popover, .slot')) closePopover(); });

/* ---- Ask and it builds (Rev 3) ----------------------------------------- */
const BUILDS = {
  tokyo: { match: /tokyo|trip|travel|pack/, label: 'Get ready for Tokyo', status: 'from your trip email, calendar and saved places', tiles: [
    { il: 'map', w: 2, cls: 't-new', html: `<div class="pad"><small>Tokyo trip</small><b style="display:block;font-size:19px;margin:2px 0 8px">Before you go</b><span class="chip-new">New</span>${[['Order yen', 1], ['Rail pass voucher'], ['Hold the mail']].map(([t, d]) => `<button class="check${d ? ' done' : ''}" data-act="check"><i></i>${t}</button>`).join('')}</div>` },
    { il: 'umbrella', w: 1, cls: 't-gradline', html: `<div class="pad"><b style="font-size:15px">Hotel</b><small>Shibuya · 4 nights</small><div class="sk" style="width:80%"></div><div class="sk" style="width:55%"></div><small style="margin-top:22px">From your email</small></div>` },
    { il: 'weather', w: 2, cls: 't-gradline', html: `<div class="pad"><b style="font-size:15px">Weather in Tokyo</b><div style="display:flex;gap:18px;margin-top:22px;font:600 26px/1 var(--font-display)"><span>21°</span><span style="opacity:.7">19°</span><span style="opacity:.5">23°</span><span style="opacity:.5">20°</span></div><small style="margin-top:14px">Light rain Saturday, pack the jacket</small></div>` },
    { il: 'card-box', w: 1, cls: 't-gradline', html: `<div class="pad"><b style="font-size:15px">Yen budget</b><div style="font:600 30px/1 var(--font-display);margin-top:30px">¥84k</div><small>left of ¥120k</small></div>` },
  ] },
  party: { match: /party|birthday|lily/, label: "Plan Lily's birthday party", status: 'from your messages, calendar and saved places', tiles: [
    { il: 'crown', w: 2, cls: 't-new', html: `<div class="pad"><small>Lily turns 8</small><b style="display:block;font-size:19px;margin:2px 0 8px">Party checklist</b><span class="chip-new">New</span>${[['Book the park shelter', 1], ['Order the cake'], ['Send invites to her class']].map(([t, d]) => `<button class="check${d ? ' done' : ''}" data-act="check"><i></i>${t}</button>`).join('')}</div>` },
    { il: 'candle', w: 1, cls: 't-gradline', html: `<div class="pad"><b style="font-size:15px">Bakery</b><small>Sweet Kitchen · 0.6 mi</small><div style="font:600 26px/1 var(--font-display);margin-top:30px">Sat 10a</div><small>pickup</small></div>` },
    { il: 'chat', w: 2, cls: 't-gradline', html: `<div class="pad"><b style="font-size:15px">Guests</b><div style="display:flex;align-items:baseline;gap:8px;margin-top:20px"><span style="font:600 40px/1 var(--font-display)">12</span><small>of 18 replied</small></div><small style="margin-top:14px">2 allergies noted · nuts, dairy</small></div>` },
    { il: 'card-box', w: 1, cls: 't-gradline', html: `<div class="pad"><b style="font-size:15px">Budget</b><div style="font:600 30px/1 var(--font-display);margin-top:30px">$240</div><small>planned · $65 spent</small></div>` },
  ] },
};
let built = [];
function openBuild() {
  closePopover();
  const f = $('#build'); f.hidden = false; f.classList.remove('working');
  $('#build-status').textContent = 'Try one of these, or ask your own';
  $('#build-stop').textContent = 'Close';
  const chips = $('#build-chips'); chips.hidden = false;
  chips.innerHTML = ['Help me get ready for Tokyo', "Plan Lily's birthday party"].map((t, i) => `<button type="button" style="animation-delay:${i * 60}ms">${t}</button>`).join('');
  $$('button', chips).forEach(b => b.addEventListener('click', () => { $('#build-input').value = b.textContent; runBuild(b.textContent); }));
  $('#build-input').focus();
}
function closeBuild() { $('#build').hidden = true; $('#build-chips').hidden = true; $('#stage').classList.remove('recede'); }
$('#build').addEventListener('submit', e => { e.preventDefault(); const v = $('#build-input').value.trim(); if (v) runBuild(v); });
$('#build-stop').addEventListener('click', () => {
  const lbl = $('#build-stop').textContent;
  if (lbl === 'Undo') { undoBuild(); }
  closeBuild();
});
$('#shaped').addEventListener('click', openBuild);

async function runBuild(prompt) {
  $('#build-chips').hidden = true;
  const key = Object.keys(BUILDS).find(k => BUILDS[k].match.test(prompt.toLowerCase())) || 'party';
  const plan = BUILDS[key];
  undoBuild(true);
  const f = $('#build'); f.classList.add('working');
  $('#build-stop').textContent = 'Stop';
  $('#stage').classList.add('recede');
  // A new row above the horizon: start where the empty slots are.
  let c = 2; const r = 0; const n = plan.tiles.length;
  for (let i = 0; i < n; i++) {
    const spec = plan.tiles[i];
    $('#build-status').textContent = `Building ${n} tiles ${plan.status} · ${i + 1} of ${n}`;
    // Anything already sitting in the row steps aside.
    const t = { id: `b-${key}-${i}`, c, r, w: spec.w, cls: spec.cls + ' building', html: `<div class="shimmer"></div><div class="pad"><div class="sk" style="width:40%"></div><div class="sk" style="width:70%;margin-top:18px"></div><div class="sk" style="width:55%"></div></div>` };
    for (const o of tiles.filter(o => o.r === r && o.c < c + spec.w && o.c + o.w > c)) { o.r = 4; o.c = Math.min(o.c, NC - o.w); placeEl(o.el, o); }
    for (let k = 0; k < spec.w; k++) slotCells.add(`${c + k},${r}`);
    tiles.push(t); built.push(t);
    const el = makeTile(t); el.classList.add('grow'); renderSlots();
    await sleep(900);
    el.innerHTML = spec.html; el.classList.remove('building');
    if (spec.il) addIl(el, spec.il);
    el.animate([{ filter: 'brightness(1.6)' }, { filter: 'none' }], { duration: 500 });
    c += spec.w;
    await sleep(250);
  }
  f.classList.remove('working');
  $('#stage').classList.remove('recede');
  $('#build-status').textContent = `Built ${n} tiles above your horizon. They update on their own.`;
  $('#build-input').value = '';
  $('#build-input').placeholder = 'Ask for changes, or something new';
  $('#build-stop').textContent = 'Undo';
}
function undoBuild(silent) {
  built.forEach(t => { t.el.classList.add('leave'); setTimeout(() => t.el.remove(), 420); });
  tiles = tiles.filter(t => !built.includes(t)); built = [];
  setTimeout(renderSlots, 430);
  if (!silent) toast('Put your mosaic back the way it was');
}

/* ---- Dock -------------------------------------------------------------- */
const DOCK = [['File Explorer', 'app/file-explorer/standard-48.svg', '#f5b400', true], ['Edge', 'product/edge/outline-48.svg', '#2ab0d6'], ['Excel', 'product/excel/outline-48.svg', '#47c16f'], ['Word', 'product/word/outline-48.svg', '#4b8cf5'], ['PowerPoint', 'product/powerpoint/outline-48.svg', '#f0654a'], ['Photos', 'app/photos/standard-48.svg', '#5aa8ff', true]];
$('#dock').innerHTML = `<button class="cop" id="dock-cop" title="Copilot"><img src="${COP}" alt=""></button><span class="sep"></span>` + DOCK.map(([n, p, col, full]) =>
  full ? `<button title="${n}" data-app="${n}"><img src="${ICONS}${p}" alt="" style="width:34px;height:34px"></button>`
       : `<button title="${n}" data-app="${n}" style="color:${col}"><span class="ic" style="--src:url('${iconSrc(p)}')"></span></button>`).join('');
$('#dock-cop').addEventListener('click', () => $('#build').hidden ? openBuild() : closeBuild());
$$('#dock [data-app]').forEach(b => b.addEventListener('click', () => toast(`Opening ${b.dataset.app}`)));
addEventListener('keydown', e => { if (e.key === 'Escape') { closePopover(); closeBuild(); } });

/* ---- Themes ------------------------------------------------------------ */
setupThemes('mosaic', [
  { id: 'windows', label: 'Windows', style: 'windows' },
  { id: 'm365', label: 'M365', style: 'm365' },
  { id: 'neon', label: 'Neon', style: 'neon' },
  { id: 'sketch', label: 'Sketch', style: 'sketch', ink: '#f1ede2', paper: '#1d1d24' },
]);
