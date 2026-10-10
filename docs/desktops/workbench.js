/* Workbench prototype. The desktop behaves like a living cell: the nucleus in
   the middle is where work happens, and the cells around it stretch, snap,
   gather and give material to it through the goo filter. The clock follows real
   time, Copilot grows out of the Ask box, the Lisbon task turns the whole
   nucleus into a working view, Stacks takes the nucleus over, and the window
   strip at the top grows and shrinks with the windows that are open. */

const stage = $('#stage');

/* ---- Icon tokens ------------------------------------------------------- */
const TOKENS = {
  chat: ic('chat'), edit: ic('edit'), search: ic('search'), task: ic('task-list-ltr'), pin: ic('pin'),
  send: ic('send', 18, 'filled'), call: ic('call', 18), play: ic('play', 18, 'filled'), pause: ic('pause', 20, 'filled'),
  previous: ic('previous', 20), next: ic('next', 20), add: ic('add', 20), mic: ic('mic', 18), speaker: ic('speaker-2', 20),
  copilot: appIcon(APPS.copilot, 40), explorer: appIcon(APPS.explorer, 38), edge: appIcon(APPS.edge, 38),
  outlook: appIcon(APPS.outlook, 38), photos: appIcon(APPS.photos, 38),
  bulb: ic('lightbulb', 18), doc: ic('document', 18), stack: ic('stack'),
};
stage.innerHTML = stage.innerHTML.replace(/__([a-z-]+)/g, (m, n) => TOKENS[n] || m);
installGoo('goo', 10, 24, -11);
protoNav('workbench');

/* ---- Toast ------------------------------------------------------------- */
let toastT;
function toast(msg, icon = APPS.copilot) {
  const t = $('#toast');
  t.innerHTML = `<img src="${ICONS}${icon}" alt="">${msg}`;
  t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---- Clock and greeting ------------------------------------------------ */
let focusLeft = 0, focusTimer = null;
function tick() {
  const c = clockParts();
  $('#clock-hm').textContent = `${c.h}:${c.m}`;
  $('#clock-ampm').textContent = c.ampm;
  $('#greet-line').textContent = `${greeting(c.h24)}, Alex`;
}
tick(); setInterval(tick, 5000);

/* ---- Goo groups: pull a surface and the neck stretches, thins and snaps - */
function gooGroup(id) {
  const g = $(id);
  const A = $('.blob[data-part="a"]', g), B = $('.blob[data-part="b"]', g);
  const Bc = $('.part[data-part="b"]', g);
  const necks = $$('.neck', g).map(n => ({ el: n, x: +n.dataset.x, broken: false }));
  const aBottom = A.offsetTop + A.offsetHeight, bTop = B.offsetTop;
  const L0 = bTop - aBottom + 28, W0 = 96;
  let dx = 0, dy = 0, vx = 0, vy = 0, raf = 0;

  function layout() {
    const t = `translate(${dx}px, ${dy}px)`;
    B.style.transform = t; Bc.style.transform = t;
    for (const n of necks) {
      const ax = n.x, ay = aBottom - 14, bx = n.x + dx, by = bTop + 14 + dy;
      const vx_ = bx - ax, vy_ = by - ay, L = Math.max(8, Math.hypot(vx_, vy_));
      let w = W0 * Math.min(1.15, Math.pow(L0 / L, 1.25));
      if (w < 30) n.broken = true;
      if (n.broken && L < L0 * 1.5) n.broken = false;
      if (n.broken) w = 0;
      const ang = Math.atan2(-vx_, vy_) * 180 / Math.PI;
      Object.assign(n.el.style, { left: `${ax - w / 2}px`, top: `${ay}px`, width: `${w}px`, height: `${L}px`, transform: `rotate(${ang}deg)` });
    }
  }
  function springBack() {
    cancelAnimationFrame(raf);
    const step = () => {
      // A slightly underdamped spring, so it wobbles once on the way home.
      vx = (vx - dx * .09) * .82; vy = (vy - dy * .09) * .82;
      dx += vx; dy += vy;
      layout();
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(vx) + Math.abs(vy) > .15) raf = requestAnimationFrame(step);
      else { dx = dy = 0; layout(); }
    };
    raf = requestAnimationFrame(step);
  }
  draggable(Bc, {
    onStart: () => { cancelAnimationFrame(raf); vx = vy = 0; },
    onMove: (x, y) => {
      // Resistance grows with distance, like pulling taffy.
      const r = Math.hypot(x, y), k = 1 / (1 + r / 420);
      dx = x * k; dy = y * k; layout();
    },
    onEnd: springBack,
  });
  layout();
  return { wobble(px = 26) { dy = px; springBack(); } };
}
const greetGoo = gooGroup('#g-greet');
const todayGoo = gooGroup('#g-today');

/* ---- Focus ------------------------------------------------------------- */
function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function setFocus(on, minutes = 30) {
  const btn = $('#focus-btn');
  if (on) {
    if (!focusLeft) focusLeft = minutes * 60;
    btn.textContent = 'Pause'; btn.classList.add('running');
    $('#focus-unit').textContent = 'left';
    const end = new Date(Date.now() + focusLeft * 1000), e = clockParts(end);
    $('#greet-text').innerHTML = `<b>Focus is on.</b> Notifications wait until <b>${e.h}:${e.m}</b>. Copilot keeps working.`;
    clearInterval(focusTimer);
    const draw = () => { $('#focus-num').textContent = fmt(focusLeft); };
    draw();
    focusTimer = setInterval(() => { focusLeft = Math.max(0, focusLeft - 1); draw(); if (!focusLeft) setFocus(false); }, 1000);
    greetGoo.wobble(18);
  } else {
    clearInterval(focusTimer);
    btn.textContent = focusLeft ? 'Resume' : 'Focus'; btn.classList.remove('running');
    if (!focusLeft) { $('#focus-num').textContent = '30'; $('#focus-unit').textContent = 'mins'; }
    $('#greet-text').innerHTML = `<b>Book club is at 7.</b> Your invite is <b>ready to send</b> :)`;
  }
}
$('#focus-btn').addEventListener('click', () => setFocus(!$('#focus-btn').classList.contains('running')));

/* ---- Note -------------------------------------------------------------- */
const note = $('#note-body');
const savedNote = store('wb-note'); if (savedNote) note.innerHTML = savedNote;
note.addEventListener('input', () => store('wb-note', note.innerHTML));

/* ---- Stacks ------------------------------------------------------------ */
// Any stack, or the card itself, hands the nucleus over to the stacks view.
$$('.stack').forEach(s => s.addEventListener('click', e => { e.stopPropagation(); s.classList.add('fan'); setTimeout(() => s.classList.remove('fan'), 600); openStacks(s.dataset.stack, $('#stacks')); }));
$('#stacks').addEventListener('click', () => openStacks('Lisbon', $('#stacks')));

/* ---- Tasks ------------------------------------------------------------- */
const TASKS = [
  { id: 'lisbon', app: APPS.word, title: 'Lisbon itinerary', sub: 'Copilot · writing in Word', chip: ['In Word', 'blue'], kind: 'agent', progress: .62, open: 'lisbon', featured: true },
  { id: 'invite', app: APPS.word, title: 'Book club invite', sub: 'Copilot · ready for you to send', chip: ['Review', 'violet'], kind: 'agent', open: 'invite' },
  { id: 'photos', app: APPS.explorer, title: 'Sort vacation photos', sub: 'Agent · 312 photos, 9 duplicates', chip: ['Needs review', 'red'], kind: 'agent', open: 'photos-review' },
  { id: 'parks', app: APPS.outlook, title: 'Dinner with the Parks', sub: 'Sat 7 pm proposed to 4 people', chip: ['Waiting', 'gray'], kind: 'mine', open: 'outlook' },
  { id: 'headphones', app: APPS.copilot, title: 'Return the headphones', sub: 'Label printed, pickup Friday', chip: ['Done', 'green'], kind: 'agent', done: true },
];
let taskFilter = 'all';
function taskRow(t) {
  const el = html(`<button class="task${t.featured ? ' featured' : ''}${t.done ? ' done' : ''}" data-id="${t.id}">
    <span class="t-ic"><img src="${ICONS}${t.app}" alt=""></span>
    <span><b>${t.title}</b><small>${t.sub}</small></span>
    <span class="chip ${t.chip[1]}">${t.chip[0]}</span>
    ${t.progress != null && !t.done ? `<span class="t-bar"><i style="width:${t.progress * 100}%"></i></span>` : ''}
  </button>`);
  el.addEventListener('click', () => t.open ? openWindow(t.open, el) : toast(`${t.title}: ${t.sub}`, t.app));
  return el;
}
function renderTasks() {
  const list = $('#task-list'); list.innerHTML = '';
  for (const t of TASKS) {
    const r = taskRow(t);
    if (taskFilter !== 'all' && t.kind !== taskFilter) r.classList.add('filtered');
    list.appendChild(r);
  }
}
function updateTask(id, patch) {
  const t = TASKS.find(x => x.id === id); if (!t) return;
  Object.assign(t, patch);
  const old = $(`.task[data-id="${id}"]`), nu = taskRow(t);
  if (taskFilter !== 'all' && t.kind !== taskFilter) nu.classList.add('filtered');
  old ? old.replaceWith(nu) : $('#task-list').prepend(nu);
  if (patch.chip) nu.classList.add('enter');
}
function addTask(t) {
  TASKS.unshift(t);
  if (TASKS.length > 6) { const gone = TASKS.pop(); $(`.task[data-id="${gone.id}"]`)?.remove(); }
  const r = taskRow(t); r.classList.add('enter');
  $('#task-list').prepend(r);
}
renderTasks();
$$('#task-filter button').forEach(b => b.addEventListener('click', () => {
  $$('#task-filter button').forEach(x => x.classList.toggle('on', x === b));
  taskFilter = b.dataset.f;
  $$('.task').forEach(r => { const t = TASKS.find(x => x.id === r.dataset.id); r.classList.toggle('filtered', taskFilter !== 'all' && t.kind !== taskFilter); });
}));

/* Rail: Tasks or a Copilot chat that knows the bench */
$$('#nucleus .rail button').forEach(b => b.addEventListener('click', () => showNucleusView(b.dataset.view)));
$('#chat-form').addEventListener('submit', e => { e.preventDefault(); const v = $('#chat-input').value.trim(); if (!v) return; $('#chat-input').value = ''; respond(v, $('#chat-log')); });

/* ---- Today ------------------------------------------------------------- */
// The recommendations live in the Today cell (see renderRecs below).

/* ---- Music ------------------------------------------------------------- */
const TRACKS = [['Golden hour mix', 'Weekend radio', 220], ['Slow Sunday', 'Café acoustic', 198], ['Kitchen dance party', 'Upbeat mix', 241]];
let tr = 0, pos = 102, playing = true, musicT;
const musicEl = $('#g-music');
function drawMusic() {
  const [t, s, len] = TRACKS[tr];
  $('#m-title').textContent = t; $('#m-sub').textContent = s;
  $('#m-now').textContent = fmt(pos); $('#m-len').textContent = fmt(len);
  $('#m-fill').style.width = `${pos / len * 100}%`;
  $('#m-play').innerHTML = playing ? ic('pause', 20, 'filled') : ic('play', 20, 'filled');
  $('.record-btn').innerHTML = playing ? ic('pause', 18, 'filled') : ic('play', 18, 'filled');
  musicEl.classList.toggle('playing', playing);
}
function setPlaying(p) {
  playing = p; clearInterval(musicT);
  if (p) musicT = setInterval(() => { pos++; if (pos >= TRACKS[tr][2]) { tr = (tr + 1) % TRACKS.length; pos = 0; } drawMusic(); }, 1000);
  drawMusic();
  const bump = $('#music-bump');
  bump.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}
$('#m-play').addEventListener('click', () => setPlaying(!playing));
$('#record').addEventListener('click', () => setPlaying(!playing));
$('#m-next').addEventListener('click', () => { tr = (tr + 1) % TRACKS.length; pos = 0; setPlaying(true); });
$('#m-prev').addEventListener('click', () => { if (pos > 5) pos = 0; else { tr = (tr + TRACKS.length - 1) % TRACKS.length; pos = 0; } setPlaying(true); });
$('.m-bar').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); pos = Math.round((e.clientX - r.left) / r.width * TRACKS[tr][2]); drawMusic(); });
setPlaying(false);

/* ---- Open windows strip ------------------------------------------------ */
const THUMBS = [
  { key: 'lisbon', badge: APPS.word, tv: `<div class="tv doc">${[14, 22, 30, 38, 46].map((y, i) => `<i style="top:${y}px;${i === 0 ? 'right:40px;background:#9aa3c0' : ''}"></i>`).join('')}</div>`, active: true },
  { key: 'edge', badge: APPS.edge, tv: `<div class="tv web"><div class="hd"></div><b style="left:10px"></b><b style="left:39px"></b><b style="left:68px"></b></div>` },
  { key: 'slide-book', badge: APPS.powerpoint, tv: `<div class="tv slide" style="background:linear-gradient(135deg,#ff7b3a,#e2401c)">Book club<u></u></div>` },
  { key: 'slide-garden', badge: APPS.powerpoint, tv: `<div class="tv slide" style="background:linear-gradient(135deg,#3fae5a,#1c7a3e)">Garden party<u></u></div>` },
  { key: 'outlook', badge: APPS.outlook, tv: `<div class="tv mail"><div class="side"></div>${[12, 22, 32, 42, 52].map(y => `<i style="top:${y}px"></i>`).join('')}</div>` },
  { key: 'explorer-family', badge: APPS.explorer, tv: `<div class="tv files">${'<i></i>'.repeat(6)}</div>` },
  { key: 'photos', badge: APPS.photos, tv: `<div class="tv sunset"></div>` },
  { key: 'maps', badge: APPS.edge, tv: `<div class="tv map">${mapSvg(104, 68, 6)}</div>` },
  { key: 'call', badge: APPS.teams, tv: `<div class="tv call"><span style="background-image:url(media/person-sam.jpg)"></span><span style="background:linear-gradient(135deg,#6466f1,#a78bfa)"></span></div>` },
];
function mapSvg(w, h, n) {
  let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><rect width="${w}" height="${h}" fill="#f2efe6"/>`;
  s += `<path d="M0 ${h * .7} Q${w * .3} ${h * .55} ${w * .55} ${h * .8} T${w} ${h * .65} V${h} H0Z" fill="#bfe3f2"/>`;
  s += `<rect x="${w * .62}" y="${h * .1}" width="${w * .22}" height="${h * .25}" rx="${n}" fill="#cfe9c4"/>`;
  for (let i = 1; i < 6; i++) s += `<line x1="0" y1="${h * i / 6}" x2="${w}" y2="${h * i / 6 - h * .1}" stroke="#fff" stroke-width="${n / 3}"/>`;
  for (let i = 1; i < 6; i++) s += `<line x1="${w * i / 6}" y1="0" x2="${w * i / 6 + w * .05}" y2="${h}" stroke="#fff" stroke-width="${n / 3}"/>`;
  s += `<path d="M${w * .2} ${h * .3} L${w * .45} ${h * .45} L${w * .7} ${h * .4}" stroke="#3b82f6" stroke-width="${n / 2}" fill="none" stroke-linecap="round"/>`;
  s += `<circle cx="${w * .7}" cy="${h * .4}" r="${n * .7}" fill="#e5484d" stroke="#fff" stroke-width="${n / 4}"/></svg>`;
  return s;
}
function thumbEl(t) {
  const el = html(`<button class="thumb" data-key="${t.key}" title="${WIN[t.key]?.title || ''}">${t.tv}${t.active ? '<span class="active-bar"></span>' : ''}<span class="badge"><img src="${ICONS}${t.badge}" alt=""></span><span class="x" title="Close">${ic('dismiss', 12)}</span></button>`);
  el.addEventListener('click', e => {
    if (e.target.closest('.x')) { e.stopPropagation(); return closeWin(t.key); }
    t.key === 'lisbon' ? enterWork() : openWindow(t.key, el);
  });
  return el;
}

/* ---- Windows ----------------------------------------------------------- */
const openWins = {};
const WIN = {
  lisbon: { title: 'Lisbon itinerary', app: APPS.word, rect: [250, 150, 1420, 900], body: lisbonBody, onOpen: runLisbon },
  invite: { title: 'Book club invite', app: APPS.word, rect: [330, 160, 1260, 880], body: inviteBody },
  'photos-review': { title: 'Vacation photos · 9 duplicates', app: APPS.explorer, rect: [330, 160, 1260, 860], body: () => explorerBody('review') },
  'explorer-family': { title: 'Family', app: APPS.explorer, rect: [330, 160, 1260, 860], body: () => explorerBody('family') },
  'explorer-personal': { title: 'Personal', app: APPS.explorer, rect: [330, 160, 1260, 860], body: () => explorerBody('personal') },
  photos: { title: 'Photos', app: APPS.photos, rect: [330, 160, 1260, 860], body: () => explorerBody('photos') },
  outlook: { title: 'Dinner with the Parks', app: APPS.outlook, rect: [330, 160, 1260, 860], body: outlookBody, onOpen: runRsvp },
  edge: { title: 'Lisbon in four days · Travel guide', app: APPS.edge, rect: [330, 160, 1260, 860], body: edgeBody },
  maps: { title: 'Maps · Alfama to Belém', app: APPS.edge, rect: [330, 160, 1260, 860], body: mapsBody },
  'slide-book': { title: 'Book club night', app: APPS.powerpoint, rect: [330, 160, 1260, 800], body: () => slideBody('Book club night', 'Pride and Prejudice · Thursday at 7 · Adam\'s place', '#ff7b3a,#e2401c') },
  'slide-garden': { title: 'Garden party', app: APPS.powerpoint, rect: [330, 160, 1260, 800], body: () => slideBody('Garden party', 'Saturday the 24th · bring a chair and a dish', '#3fae5a,#1c7a3e') },
  call: { title: 'Call with Sam', app: APPS.teams, rect: [330, 160, 1260, 800], body: callBody },
};
THUMBS.forEach(t => $('#strip-row').appendChild(thumbEl(t)));

let z = 50;
function openWindow(key, from, raw) {
  // The Lisbon task opens the nucleus working view, unless Word itself is asked for.
  if (key === 'lisbon' && !raw) return enterWork();
  closeAsk(); $('#start').hidden = true;
  const spec = WIN[key]; if (!spec) return;
  if (openWins[key]) { openWins[key].style.zIndex = ++z; openWins[key].hidden = false; openWins[key].classList.remove('closing'); openWins[key].classList.add('opening'); return; }
  const [x, y, w, h] = spec.rect;
  const win = html(`<section class="win opening" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++z}" aria-label="${spec.title}">
    <header class="win-bar"><img src="${ICONS}${spec.app}" alt=""><b>${spec.title}</b><span class="sp"></span>
      <button data-a="min" title="Back to the strip">${ic('subtract', 16)}</button><button data-a="max" title="Maximize">${ic('square', 14)}</button><button class="x" data-a="close" title="Close">${ic('dismiss', 16)}</button></header>
    <div class="win-body">${spec.body()}</div></section>`);
  $('#windows').appendChild(win);
  openWins[key] = win;
  win.addEventListener('pointerdown', () => { win.style.zIndex = ++z; });
  win.querySelector('[data-a="min"]').addEventListener('click', () => minimize(key));
  win.querySelector('[data-a="close"]').addEventListener('click', () => closeWin(key));
  win.querySelector('[data-a="max"]').addEventListener('click', () => {
    const m = win.dataset.max === '1'; win.dataset.max = m ? '' : '1';
    Object.assign(win.style, m ? { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' } : { left: '24px', top: '136px', width: '1872px', height: '948px' });
  });
  let ox, oy;
  draggable(win.querySelector('.win-bar'), {
    onStart: () => { ox = win.offsetLeft; oy = win.offsetTop; },
    onMove: (dx, dy) => { win.style.left = `${ox + dx}px`; win.style.top = `${Math.max(0, oy + dy)}px`; },
  });
  // Make sure there is a thumbnail for it in the strip.
  if (!$(`.thumb[data-key="${key}"]`)) {
    const t = THUMBS.find(t => t.key === key) || { key, badge: spec.app, tv: `<div class="tv doc">${[14, 26, 38].map(y => `<i style="top:${y}px"></i>`).join('')}</div>` };
    const el = thumbEl(t); el.classList.add('arriving'); $('#strip-row').appendChild(el);
    layoutStrip();
  }
  spec.onOpen && spec.onOpen(win);
}
function minimize(key) {
  const w = openWins[key]; if (!w) return;
  w.classList.remove('opening'); w.classList.add('closing');
  setTimeout(() => { w.hidden = true; w.classList.remove('closing'); }, 380);
  const th = $(`.thumb[data-key="${key}"]`);
  th && th.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 500, delay: 250, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}
function closeWin(key) {
  const w = openWins[key];
  if (w) { w.classList.add('closing'); setTimeout(() => w.remove(), 380); delete openWins[key]; }
  const th = $(`.thumb[data-key="${key}"]`); if (th) { th.classList.add('closing'); setTimeout(() => th.remove(), 300); }
  layoutStrip();
}
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#ask-panel').hidden) return closeAsk();
  if (working) return exitWork();
  if (!$('#start').hidden) { $('#start').hidden = true; return; }
  const top = Object.entries(openWins).filter(([, w]) => !w.hidden).sort((a, b) => b[1].style.zIndex - a[1].style.zIndex)[0];
  if (top) minimize(top[0]);
});
$$('[data-open]').forEach(b => b.addEventListener('click', () => openWindow(b.dataset.open, b)));

/* Window bodies ---------------------------------------------------------- */
const LISBON = [
  ['h1', 'Lisbon, four slow days'],
  ['meta', 'Oct 16 to 19 · Alex and Maya · Hotel in Príncipe Real'],
  ['h2', 'Thursday · Arrive and wander'],
  ['p', 'Land 11:40. Drop bags, lunch at a tasca near the hotel, then the miradouro at sunset. Early night.'],
  ['h2', 'Friday · Alfama and the river'],
  ['p', 'Tram 28 early before the crowds, the cathedral, then down to the river. Fado dinner booked for 8:30, the place Maya saved in May.'],
  ['h2', 'Saturday · Belém'],
  ['p', 'Pastéis in the morning, the monastery and the riverside walk. Afternoon is open on purpose.'],
  ['h2', 'Sunday · Sintra, if you feel like it'],
  ['p', 'Train from Rossio at 9:10. If it rains, swap for the tile museum and a long lunch. Flight home at 18:05.'],
];
function lisbonBody() {
  return `<div class="w-tools"><span>${ic('home')}</span><span class="on">${ic('sparkle')}</span><span>${ic('edit')}</span><span>${ic('image')}</span><span>${ic('table')}</span><span>${ic('share')}</span></div>
  <div class="w-ai"><div class="chat-log" id="lis-log"></div>
    <form class="chat-input" id="lis-form"><input placeholder="Ask Copilot to change the plan" autocomplete="off"><button>${ic('send', 18, 'filled')}</button></form></div>
  <div class="w-page-wrap"><article class="w-page" id="lis-page"></article></div>`;
}
let lisbonDone = 0;
async function runLisbon(win) {
  const log = $('#lis-log', win), page = $('#lis-page', win);
  if (log.children.length) return;
  bubble(log, 'me', 'Plan four days in Lisbon for Maya and me. Mid October, not too packed.');
  const ai = bubble(log, 'ai', 'Writing it now. I\'m using your flight from Outlook, the hotel confirmation and the fado place Maya saved.');
  const steps = html('<ul class="ai-steps"></ul>'); ai.appendChild(steps);
  for (const s of ['Found your flight · TAP 237', 'Hotel confirmed for 3 nights', 'Checked the weather · mild, some rain Sunday']) { await sleep(450); steps.appendChild(html(`<li>${s}</li>`)); }
  // Paint what is already written, then keep writing.
  const already = 6;
  LISBON.slice(0, already).forEach(b => page.appendChild(block(b)));
  lisbonDone = already;
  $('#lis-form', win).addEventListener('submit', e => {
    e.preventDefault(); const i = e.target.querySelector('input'); const v = i.value.trim(); if (!v) return; i.value = '';
    bubble(log, 'me', v);
    setTimeout(() => {
      bubble(log, 'ai', 'Done. I updated Saturday and kept the rest as it was.');
      const p = page.querySelectorAll('p')[3]; if (p) { p.textContent = 'Slow start. ' + v.charAt(0).toUpperCase() + v.slice(1) + '. Pastéis on the way, and the riverside walk if you still feel like it.'; p.classList.add('new'); }
    }, 900);
  });
  for (let i = already; i < LISBON.length; i++) {
    await sleep(1100);
    if (!document.body.contains(page)) return;
    const el = block(LISBON[i]); page.appendChild(el);
    if (LISBON[i][0] === 'p') { const t = el.textContent; el.textContent = ''; el.classList.add('writing'); await typeChars(el, t); el.classList.remove('writing'); }
    lisbonDone = i + 1;
    updateTask('lisbon', { progress: lisbonDone / LISBON.length });
  }
  updateTask('lisbon', { progress: null, sub: 'Copilot · finished in Word', chip: ['Ready', 'green'], featured: true });
  const end = bubble(log, 'ai', 'All four days are in. Want me to share it with Maya?');
  const act = html(`<div class="ai-actions"><button class="primary">Share with Maya</button><button>Not yet</button></div>`);
  end.appendChild(act);
  act.firstElementChild.addEventListener('click', () => { act.remove(); bubble(log, 'ai', 'Shared. She can edit it too.'); toast('Lisbon itinerary shared with Maya', APPS.word); });
  act.lastElementChild.addEventListener('click', () => act.remove());
}
async function typeChars(el, t) { for (let i = 0; i < t.length; i += 3) { el.textContent = t.slice(0, i + 3); await sleep(16); } }
function block([k, t]) { return html(k === 'meta' ? `<p class="meta new">${t}</p>` : `<${k} class="new">${t}</${k}>`); }
function bubble(log, who, text) { const b = html(`<div class="bubble ${who}"></div>`); b.textContent = text; log.appendChild(b); log.scrollTop = 1e6; return b; }

function inviteBody() {
  return `<div class="w-tools"><span>${ic('home')}</span><span class="on">${ic('sparkle')}</span><span>${ic('edit')}</span><span>${ic('image')}</span><span>${ic('people')}</span></div>
  <div class="w-ai"><div class="chat-log">
    <div class="bubble ai">I drafted the invite from last month's thread. It goes to the 8 people in your book club group.</div>
    <div class="bubble ai">Anything to change before it goes out?</div></div>
    <div class="ai-actions" style="margin-top:12px"><button class="primary" id="send-invite">Send to 8 people</button><button id="warm-invite">Make it warmer</button></div></div>
  <div class="w-page-wrap"><div class="invite"><div class="hero"></div><div class="in">
    <h1>Book club: <em>Pride and Prejudice</em></h1>
    <p id="invite-copy">Thursday at 7, at Adam's place. Finish the book if you can, come anyway if you can't.</p>
    <p>Alex is bringing lemon bars.</p></div></div></div>`;
}
document.addEventListener('click', e => {
  if (e.target.id === 'send-invite') {
    updateTask('invite', { sub: 'Sent to 8 people · 3 replied', chip: ['Done', 'green'], done: true });
    closeWin('invite'); toast('Invite sent to 8 people', APPS.outlook);
  }
  if (e.target.id === 'warm-invite') {
    const p = $('#invite-copy'); p.textContent = ''; typeInto(p, 'Thursday at 7, at Adam\'s place. Bring a friend, bring your opinions about Mr. Darcy, and don\'t worry if you didn\'t finish. We never do.', 90);
  }
  if (e.target.id === 'keep-best') {
    $$('.ex-item.dupe').forEach((d, i) => setTimeout(() => d.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.6)' }], { duration: 300, fill: 'forwards' }), i * 70));
    setTimeout(() => { updateTask('photos', { sub: 'Agent · 303 photos, sorted by day', chip: ['Done', 'green'], done: true }); closeWin('photos-review'); toast('Kept the best of 9 duplicates', APPS.photos); }, 900);
  }
});

function explorerBody(mode) {
  const pics = ['media/photo-bigsur.jpg', 'media/photo-room.jpg', 'media/photo-living.jpg', 'media/person-adam.jpg', 'media/person-sam.jpg', 'media/tex-bloom.jpg', 'media/tex-focus.jpg', 'media/tex-dusk.jpg', 'media/tex-violet.jpg'];
  const side = `<div class="ex-side"><div class="${mode === 'family' ? 'on' : ''}">${ic('home')} Family</div><div class="${mode === 'personal' ? 'on' : ''}">${ic('folder')} Personal</div><div class="${mode === 'review' || mode === 'photos' ? 'on' : ''}">${ic('image')} Vacation photos</div><div>${ic('star')} Favorites</div></div>`;
  if (mode === 'family' || mode === 'personal') {
    const names = mode === 'family' ? ['Lily school', 'Recipes', 'House', 'Taxes 2026', 'Kitchen remodel', 'Birthdays'] : ['Lisbon', 'Book club', 'Running', 'Journal', 'Music'];
    return side + `<div class="ex-grid">${names.map(n => `<div class="ex-item"><div class="fold"></div>${n}</div>`).join('')}${pics.slice(0, 4).map((p, i) => `<div class="ex-item"><div class="pic" style="background-image:url(${p})"></div>IMG_20${41 + i}.jpg</div>`).join('')}</div>`;
  }
  const dupes = mode === 'review' ? [1, 3, 5] : [];
  return side + `<div style="flex:1;display:flex;flex-direction:column;min-width:0">
    ${mode === 'review' ? `<div style="display:flex;align-items:center;gap:12px;padding:18px 24px 0"><span class="chip red">9 look like duplicates</span><span class="muted" style="font-size:13px">Copilot picked the sharpest of each set</span><span style="flex:1"></span><div class="ai-actions" style="margin:0"><button class="primary" id="keep-best">Keep the best</button></div></div>` : ''}
    <div class="ex-grid">${[...pics, ...pics.slice(0, 3)].map((p, i) => `<div class="ex-item${dupes.includes(i) ? ' dupe' : ''}"><div class="pic" style="background-image:url(${p})"></div>${dupes.includes(i) ? '<span class="tag">Duplicate</span>' : `Oct ${3 + i}`}</div>`).join('')}</div></div>`;
}
function outlookBody() {
  return `<div class="ml-list">
    <div class="ml-item on"><b>Dinner with the Parks</b>Sat 7 pm · proposed to 4 people</div>
    <div class="ml-item"><b>Priya</b>Re: lemon bars recipe, double it?</div>
    <div class="ml-item"><b>TAP Air Portugal</b>Your trip to Lisbon · TAP 237</div>
    <div class="ml-item"><b>Lily's school</b>Picture day is moved to Tuesday</div>
    <div class="ml-item"><b>Kitchen Co.</b>Your quote for the remodel</div></div>
  <div class="ml-read"><h2>Dinner with the Parks</h2><p class="muted">Saturday at 7 pm · Our place · Copilot sent this for you on Tuesday</p>
    <p>Hi both, want to come over Saturday? Alex is making the paella again.</p>
    <div class="rsvp" id="rsvp">
      <div><span class="av">JP</span><span>Jin Park</span><span class="chip gray">Waiting</span></div>
      <div><span class="av">SP</span><span>Soo Park</span><span class="chip green">Yes</span></div>
      <div><span class="av">M</span><span>Maya</span><span class="chip green">Yes</span></div>
      <div><span class="av">A</span><span>Alex</span><span class="chip green">Yes</span></div></div></div>`;
}
function runRsvp(win) {
  setTimeout(() => {
    const c = $('#rsvp .chip', win); if (!c || c.textContent !== 'Waiting') return;
    c.textContent = 'Yes'; c.className = 'chip green'; c.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    updateTask('parks', { sub: 'Sat 7 pm · all 4 are coming', chip: ['Confirmed', 'green'] });
  }, 1600);
}
function edgeBody() {
  return `<div class="web"><div style="height:8px"></div><div class="web-addr">${ic('search', 16)} travelguide.example/lisbon-in-four-days</div>
    <div class="web-page"><div class="web-hero">Lisbon in four days</div>
    <div class="web-cards"><div style="background:linear-gradient(135deg,#ffb36b,#ff7a59)">Where to eat in Alfama</div><div style="background:linear-gradient(135deg,#6aa7ff,#4b6cff)">Day trip to Sintra</div><div style="background:linear-gradient(135deg,#5ed1a8,#2fa57d)">The best miradouros</div></div></div></div>`;
}
function mapsBody() {
  return `<div class="map-view">${mapSvg(1260, 808, 22)}<div class="map-card"><b>Alfama to Belém</b>28 min by tram 15 · or a 1 hr walk along the river<div class="ai-actions"><button class="primary">Start</button><button>Save to Lisbon</button></div></div></div>`;
}
function slideBody(t, s, g) {
  return `<div class="slide-view"><div class="slide-big" style="background:linear-gradient(135deg,${g})"><h1>${t}</h1><p>${s}</p></div></div>`;
}
function callBody() {
  return `<div class="call-view"><div class="tile-v" style="background-image:url(media/person-sam.jpg)"><span>Sam</span></div><div class="tile-v you"><b>A</b><span>You · camera off</span></div>
    <div class="call-ctrls"><button>${ic('mic', 20)}</button><button>${ic('video', 20)}</button><button>${ic('share', 20)}</button><button class="end" onclick="closeWin('call')">${ic('call-end', 20, 'filled')}</button></div></div>`;
}

/* ---- Copilot, out of the Ask box --------------------------------------- */
const SUGGEST = ['Finish the Lisbon plan', 'Send the book club invite', 'Remind me to water the plants', 'Play something calm'];
function openAsk() {
  const g = $('#g-ask');
  if (g.classList.contains('open')) return;
  $('#start').hidden = true;
  g.classList.add('open');
  const p = $('#ask-panel'); p.hidden = false;
  if (!$('#ask-log').children.length) {
    $('#ask-log').appendChild(html(`<div class="ask-panel-head"><span class="head-bot"></span>Copilot <span class="muted" style="font-weight:400">· sees your bench, not your screen</span></div>`));
    bubble($('#ask-log'), 'ai', `${greeting(new Date().getHours())}, Alex. Lisbon is ${Math.round((TASKS[0].progress || 1) * 100)}% written and the invite is waiting on you. What can I take off your plate?`);
  }
  $('#ask-suggest').innerHTML = '';
  SUGGEST.forEach(s => { const b = html(`<button type="button">${s}</button>`); b.addEventListener('click', () => submitAsk(s)); $('#ask-suggest').appendChild(b); });
}
function closeAsk() {
  const g = $('#g-ask'); if (!g.classList.contains('open')) return;
  g.classList.remove('open'); $('#ask-panel').hidden = true;
}
function submitAsk(v) { openAsk(); respond(v, $('#ask-log')); $('#ask-input').value = ''; }
$('#ask-input').addEventListener('focus', openAsk);
$('#ask').addEventListener('submit', e => { e.preventDefault(); const v = $('#ask-input').value.trim(); if (v) submitAsk(v); });
$('#tb-copilot').addEventListener('click', () => { if ($('#g-ask').classList.contains('open')) closeAsk(); else { openAsk(); $('#ask-input').focus(); } });
stage.addEventListener('pointerdown', e => {
  if (!e.target.closest('#g-ask, .ask, #tb-copilot, #btn-msg')) closeAsk();
  if (!e.target.closest('#start, #tb-start')) $('#start').hidden = true;
});

async function respond(v, log) {
  bubble(log, 'me', v);
  // The little helper hops while Copilot works on it.
  BENCH_BOTS.forEach(b => b.work(1300));
  const q = v.toLowerCase();
  await sleep(500);
  const say = t => bubble(log, 'ai', t);
  const actions = (list) => { const a = html('<div class="ai-actions"></div>'); list.forEach(([label, fn, primary]) => { const b = html(`<button type="button" class="${primary ? 'primary' : ''}">${label}</button>`); b.addEventListener('click', () => { a.remove(); fn(); }); a.appendChild(b); }); log.lastElementChild.appendChild(a); log.scrollTop = 1e6; };
  if (/lisbon|trip|itinerary|flight|travel/.test(q)) {
    say(`Your Lisbon itinerary is ${Math.round((TASKS.find(t => t.id === 'lisbon').progress || 1) * 100)}% written. I'll keep going in Word, you can watch or leave it.`);
    actions([['Watch it work', () => enterWork(), true], ['Keep going in the background', () => toast('Still writing Lisbon in the background', APPS.word)]]);
  } else if (/invite|book club/.test(q)) {
    say('The invite is ready: Thursday at 7 at Adam\'s, to 8 people. Send it as is?');
    actions([['Send it', () => { updateTask('invite', { sub: 'Sent to 8 people', chip: ['Done', 'green'], done: true }); say('Sent. I\'ll tell you when people reply.'); }, true], ['Let me look first', () => openWindow('invite')]]);
  } else if (/lemon|bake|recipe/.test(q)) {
    say('From your note: crust 20 minutes at 350°, then 25 more with the filling. I told Adam you\'re bringing them.');
    actions([['Start a 20 min timer', () => { focusLeft = 20 * 60; setFocus(true); }, true]]);
  } else if (/play|music|song|calm/.test(q)) {
    tr = 1; pos = 0; setPlaying(true); say('Playing Slow Sunday. I\'ll lower it when a call comes in.');
  } else if (/focus|concentrate|quiet/.test(q)) {
    setFocus(true); say('Focus is on for 30 minutes. I\'ll hold everything except Lily\'s school.');
  } else {
    const id = 't' + Date.now();
    const title = v.replace(/^(remind me to|please|can you|could you)\s+/i, '').replace(/^./, c => c.toUpperCase());
    const mine = /remind|water|buy|call|pick up/.test(q);
    addTask({ id, app: mine ? APPS.calendar : APPS.copilot, title: title.length > 34 ? title.slice(0, 32) + '…' : title, sub: mine ? 'Reminder · tomorrow 9:00 AM' : 'Copilot · working on it', chip: mine ? ['Mine', 'violet'] : ['Working', 'blue'], kind: mine ? 'mine' : 'agent', progress: mine ? null : .05 });
    say(mine ? 'Added to your Tasks for tomorrow at 9. I\'ll nudge you then.' : 'On it. It\'s on your bench now so you can see how it\'s going.');
    if (!mine) { let p = .05; const t = setInterval(() => { p += .19; if (p >= 1) { clearInterval(t); updateTask(id, { progress: null, sub: 'Copilot · done', chip: ['Done', 'green'], done: true }); } else updateTask(id, { progress: p }); }, 1400); }
  }
}

/* ---- Start ------------------------------------------------------------- */
$('#start').innerHTML = `<h4>Pinned</h4><div class="start-grid">${[['Word', APPS.word], ['Excel', APPS.excel], ['PowerPoint', APPS.powerpoint], ['Outlook', APPS.outlook], ['Edge', APPS.edge], ['Photos', APPS.photos], ['File Explorer', APPS.explorer], ['Teams', APPS.teams], ['Weather', APPS.weather], ['Notepad', APPS.notepad], ['Paint', APPS.paint], ['Calendar', APPS.calendar], ['Maps', APPS.maps], ['Clock', APPS.clock], ['Copilot', APPS.copilot]].map(([n, p]) => `<button data-app="${n}"><img src="${ICONS}${p}" alt="">${n}</button>`).join('')}</div>`;
$('#tb-start').addEventListener('click', () => { closeAsk(); $('#start').hidden = !$('#start').hidden; });
$$('#start [data-app]').forEach(b => b.addEventListener('click', () => {
  const map = { Word: 'lisbon', Outlook: 'outlook', Edge: 'edge', Photos: 'photos', 'File Explorer': 'explorer-family', Teams: 'call', PowerPoint: 'slide-book', Maps: 'maps', Copilot: null };
  const k = map[b.dataset.app];
  $('#start').hidden = true;
  if (k) openWindow(k, null, k === 'lisbon'); else if (b.dataset.app === 'Copilot') { openAsk(); $('#ask-input').focus(); } else toast(`${b.dataset.app} would open here`, APPS[b.dataset.app.toLowerCase()] || APPS.copilot);
}));

/* ==== The strip grows and shrinks with the windows ====================== */
let stripW = 1260, stripRaf = 0;
function stripPath(w) { return `M0 0 H${w} L${w - 74} 100 Q${w - 92} 124 ${w - 120} 124 H120 Q92 124 74 100 Z`; }
function drawStrip() {
  const s = $('#strip');
  s.style.width = stripW + 'px'; s.style.left = (960 - stripW / 2) + 'px';
  const svg = $('.strip-shape', s);
  svg.setAttribute('viewBox', `0 0 ${stripW} 124`);
  $('path', svg).setAttribute('d', stripPath(stripW));
  s.style.setProperty('--clip', `path("${stripPath(stripW)}")`);
}
function layoutStrip(animate = true) {
  const n = $$('#strip-row .thumb:not(.closing)').length;
  const target = Math.max(360, 228 + n * 116 - 12);
  const from = stripW, t0 = performance.now(), dur = animate ? 700 : 0;
  // Ease out with a little overshoot, so the glass settles like a membrane.
  const back = k => { const c = 1.3; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  cancelAnimationFrame(stripRaf);
  const step = now => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1;
    stripW = from + (target - from) * back(k); drawStrip();
    if (k < 1) stripRaf = requestAnimationFrame(step);
  };
  stripRaf = requestAnimationFrame(step);
}
layoutStrip(false);

/* ==== Geometry helpers ================================================== */
function rectOf(el) {
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { x: (r.left - s.left) / SCALE, y: (r.top - s.top) / SCALE, w: r.width / SCALE, h: r.height / SCALE };
}
function blob(layer, r, radius = 28) {
  const b = html('<div class="blob"></div>');
  Object.assign(b.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', borderRadius: radius + 'px' });
  layer.appendChild(b); return b;
}
function moveBlob(b, r, ms = 750, radius, ease = 'cubic-bezier(.45,1.25,.45,1)') {
  const from = { left: b.style.left, top: b.style.top, width: b.style.width, height: b.style.height, borderRadius: b.style.borderRadius };
  const to = { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', borderRadius: (radius ?? parseFloat(from.borderRadius)) + 'px' };
  Object.assign(b.style, to);
  // Never let a choreography hang on an animation that got interrupted.
  return Promise.race([b.animate([from, to], { duration: ms, easing: ease }).finished.catch(() => {}), sleep(ms + 80)]);
}
const NUC = { x: 783, y: 300, w: 620, h: 760 };

/* A droplet leaves a cell and is taken in by the nucleus. */
async function absorb(from) {
  const L = $('#morph-layer');
  const d = blob(L, from, 26);
  const port = { x: NUC.x - 26, y: Math.min(Math.max(from.y + from.h / 2 - 40, NUC.y + 60), NUC.y + NUC.h - 140), w: 70, h: 80 };
  const bump = blob(L, { x: NUC.x - 2, y: port.y + 10, w: 8, h: 60 }, 30);
  moveBlob(bump, { x: NUC.x - 18, y: port.y - 4, w: 40, h: 88 }, 380, 40);
  await moveBlob(d, port, 460, 40, 'cubic-bezier(.6,0,.4,1)');
  moveBlob(d, { x: NUC.x + 4, y: port.y + 30, w: 10, h: 20 }, 280, 10);
  await moveBlob(bump, { x: NUC.x - 2, y: port.y + 30, w: 6, h: 20 }, 300, 10);
  d.remove(); bump.remove();
}

/* ==== Recommendations in the Today cell ================================= */
const RECS = {
  tasks: { title: 'Tasks for today', items: [['peach', 'Pick up Lily', '3:15 PM', 'task', 'clock'], ['blue', 'Call Mom', '5:30 PM', 'task', 'video-call'], ['lilac', 'Book club', '7:00 PM', 'task', 'news']] },
  ideas: { title: 'Ideas for you', items: [['peach', 'Bring lemon bars', 'From your note', 'idea', 'candle'], ['blue', 'Sintra on Sunday', 'Fits your Lisbon plan', 'idea', 'map'], ['lilac', 'Start a garden journal', 'You saved 6 plant posts', 'idea']] },
  files: { title: 'Pick up where you left off', items: [['peach', 'Lisbon trip.docx', 'Copilot is writing', 'file', APPS.word, 'work'], ['blue', 'Book club invite', 'Ready to send', 'file', APPS.word, 'invite'], ['lilac', 'Kitchen quote.pdf', 'From Kitchen Co.', 'file', APPS.explorer, 'stacks']] },
};
function renderRecs(kind, wobble = true) {
  const r = RECS[kind];
  $('#recs-title').textContent = r.title;
  $$('#recs-pick button').forEach(b => b.classList.toggle('on', b.dataset.rec === kind));
  const box = $('#todos');
  box.innerHTML = r.items.map(([c, t, sub, type = 'task', icon, go = '']) => `<button class="todo ${c}${type === 'idea' ? ' idea' : ''}" data-type="${type}" data-go="${go}" data-text="${t}">
    ${type === 'file' ? `<span class="t-ico"><img src="${ICONS}${icon}" alt=""></span>` : `<span class="t-ico il" data-illus="${icon || 'tips'}"></span>`}
    <span><b>${t}</b><small>${sub}</small></span>${type === 'task' ? '<i class="end"></i>' : ''}</button>`).join('');
  paintIllus(box);
  box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
  if (wobble) todayGoo.wobble(18);
}
$$('#recs-pick button').forEach(b => b.addEventListener('click', () => renderRecs(b.dataset.rec)));
$('#todos').addEventListener('click', e => {
  const t = e.target.closest('.todo'); if (!t) return;
  const type = t.dataset.type;
  if (type === 'task') { t.classList.toggle('done'); todayGoo.wobble(t.classList.contains('done') ? 16 : -10); }
  if (type === 'idea') submitAsk(t.dataset.text);
  if (type === 'file') {
    const go = t.dataset.go;
    if (go === 'work') enterWork(); else if (go === 'stacks') openStacks('Kitchen', t); else openWindow(go);
  }
});
renderRecs('tasks', false);

/* ==== The nucleus can show Tasks, Stacks or a chat ====================== */
const STACKS = {
  Lisbon: [[APPS.word, 'Lisbon trip.docx', 'Copilot is writing now', 'new', 'work'], [APPS.outlook, 'TAP flight confirmation', 'Inbox · Sep 28', '', 'outlook'], [APPS.edge, "Maya's saved places", '14 places', '', 'maps'], [APPS.excel, 'Trip budget.xlsx', 'Changed today by Copilot', 'new']],
  'Book club': [[APPS.word, 'Book club invite', 'Ready to send', 'new', 'invite'], [APPS.powerpoint, 'Book club night', 'Slides for Thursday', '', 'slide-book'], [APPS.excel, 'RSVPs', '3 replied today', 'new'], [APPS.notepad, 'Lemon bars', "Priya's recipe"]],
  Kitchen: [[APPS.explorer, 'Kitchen quote.pdf', 'From Kitchen Co.'], [APPS.photos, 'Tile ideas', '12 photos', '', 'photos'], [APPS.excel, 'Measurements', 'Updated by you'], [APPS.explorer, 'Receipt · Home Depot', 'Belongs in Taxes 2026', 'receipt'], [APPS.explorer, 'Receipt · Lumber Co.', 'Belongs in Taxes 2026', 'receipt']],
};
let svFocus = 'Lisbon', svFilter = 'all', receiptsMoved = false;
function renderStacks() {
  const v = $('#stacks-view');
  const files = name => STACKS[name].filter(f => !(receiptsMoved && f[3] === 'receipt')).filter(f => svFilter === 'all' || f[3] === 'new');
  v.innerHTML = `<div class="tasks-head"><h2>Stacks</h2><div class="seg" id="sv-filter"><button class="${svFilter === 'all' ? 'on' : ''}" data-f="all">All</button><button class="${svFilter === 'new' ? 'on' : ''}" data-f="new">Changed today</button></div></div>
    <div class="sv-cols">${Object.keys(STACKS).map(n => `<div class="sv-col${n === svFocus ? ' focus' : ''}" data-stack="${n}"><span class="sv-il" data-illus="${{ Lisbon: 'map', 'Book club': 'news', Kitchen: 'toolbox' }[n]}"></span><h4>${n}<small>${files(n).length} items</small></h4>
      ${files(n).map(([icon, t, sub, tag, go], i) => `<button class="sv-file${tag === 'new' ? ' new' : ''}" data-go="${go || ''}" data-tag="${tag || ''}" style="animation-delay:${i * 50}ms"><img src="${ICONS}${icon}" alt=""><span><b>${t}</b><small>${sub}</small></span></button>`).join('')}</div>`).join('')}</div>
    <div class="sv-tip" id="sv-tip"><img src="${ICONS}${APPS.copilot}" alt=""><span>${receiptsMoved ? 'Moved 2 receipts into Taxes 2026. Your Kitchen stack is just the remodel now.' : 'Two receipts in Kitchen belong in Taxes 2026. Want me to move them?'}</span>${receiptsMoved ? '' : '<div class="ai-actions" style="margin:0"><button class="primary" id="sv-move">Move them</button></div>'}</div>`;
  paintIllus(v);
  $$('#sv-filter button', v).forEach(b => b.addEventListener('click', () => { svFilter = b.dataset.f; renderStacks(); }));
  $$('.sv-col', v).forEach(c => c.addEventListener('click', e => { if (e.target.closest('.sv-file')) return; svFocus = c.dataset.stack; $$('.sv-col', v).forEach(x => x.classList.toggle('focus', x === c)); }));
  $$('.sv-file', v).forEach(f => f.addEventListener('click', () => {
    const go = f.dataset.go;
    if (go === 'work') enterWork(); else if (go) openWindow(go); else toast(`${$('b', f).textContent} would open here`);
  }));
  $('#sv-move', v)?.addEventListener('click', () => {
    $$('.sv-file[data-tag="receipt"]', v).forEach((f, i) => setTimeout(() => f.classList.add('leaving'), i * 90));
    setTimeout(() => { receiptsMoved = true; renderStacks(); toast('Moved 2 receipts to Taxes 2026', APPS.explorer); }, 500);
  });
}
function showNucleusView(view, focus) {
  if (focus) svFocus = focus;
  $$('#nucleus .rail button').forEach(x => x.classList.toggle('on', x.dataset.view === view));
  const isChat = view === 'chat', isStacks = view === 'stacks';
  $('#tasks-chat').hidden = !isChat; $('#stacks-view').hidden = !isStacks; $('#tasks-main').hidden = isChat || isStacks;
  $('#tasks-title').textContent = { notes: 'Notes', search: 'Search', pins: 'Pinned' }[view] || 'Tasks';
  if (isStacks) renderStacks();
  if (isChat) {
    if (!$('#chat-log').children.length) bubble($('#chat-log'), 'ai', 'Two things are moving: your Lisbon trip is being written, and the book club invite is ready to send.');
    $('#chat-input').focus();
  }
  $('#stack-chip').textContent = isStacks ? 'Open in the nucleus' : '3 changed today';
}
async function openStacks(focus = 'Lisbon', fromEl) {
  if (working) await exitWork();
  if (fromEl) await absorb(rectOf(fromEl));
  showNucleusView('stacks', focus);
}

/* ==== The nucleus at work =============================================== */
let working = false, busy = false, workStarted = false;
const WK = { x: 270, y: 150, w: 1610, h: 922 };
const T_RECT = { x: 1419, y: 300, w: 270, h: 366 }, M_RECT = { x: 1419, y: 688, w: 270, h: 372 };
// Cells that gather into a column on the left: [selector, visible rect, offset of that rect inside the element]
const CELLS = [['#g-greet', { x: 231, y: 300, w: 260, h: 464 }, [30, 30]], ['#note', { x: 507, y: 300, w: 260, h: 300 }], ['#f-personal', { x: 231, y: 775, w: 260, h: 170 }], ['#f-family', { x: 507, y: 616, w: 260, h: 170 }], ['#stacks', { x: 507, y: 802, w: 260, h: 258 }]];
const COL_X = 96, COL_W = 150, COL_GAP = 12;
CELLS.forEach(([sel]) => $(sel).classList.add('cell'));
['#g-today', '#g-music'].forEach(s => $(s).classList.add('cell-out'));
function colTargets() {
  const k = COL_W / 260;
  const hs = CELLS.map(c => c[1].h * k);
  const total = hs.reduce((a, b) => a + b, 0) + COL_GAP * (CELLS.length - 1);
  let y = WK.y + (WK.h - total) / 2;
  return CELLS.map((c, i) => { const t = { x: COL_X, y, w: COL_W, h: hs[i], k }; y += hs[i] + COL_GAP; return t; });
}
function placeCells(on, extra = {}) {
  const ts = colTargets();
  CELLS.forEach(([sel, r, off = [0, 0]], i) => {
    const el = $(sel); el.style.transformOrigin = `${off[0]}px ${off[1]}px`;
    if (!on) { el.style.transform = ''; return; }
    const t = ts[i], d = extra[i] || [0, 0];
    el.style.transform = `translate(${t.x - r.x + d[0]}px, ${t.y - r.y + d[1]}px) scale(${t.k})`;
  });
}

// The column itself is one gooey body: each cell sits on a blob, and the
// blobs overlap just enough to read as connected.
let colBlobs = [], colRafs = [];
function buildColumn() {
  const L = $('#col-layer'); L.innerHTML = ''; $('#col-hit').innerHTML = '';
  colBlobs = colTargets().map((t, i) => {
    const b = blob(L, { x: t.x - 8, y: t.y - 8, w: t.w + 16, h: t.h + 16 }, 24);
    const hit = html(`<div title="Pull me, or tap to go back to the bench"></div>`);
    Object.assign(hit.style, { left: t.x + 'px', top: t.y + 'px', width: t.w + 'px', height: t.h + 'px' });
    $('#col-hit').appendChild(hit);
    let dx = 0, dy = 0, vx = 0, vy = 0, raf = 0;
    const apply = () => {
      if (!working || busy && !stage.classList.contains('working')) return;
      b.style.transform = `translate(${dx}px, ${dy}px)`;
      const extra = {}; extra[i] = [dx, dy];
      placeCells(true, extra);
      hit.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    draggable(hit, {
      onStart: () => { cancelAnimationFrame(raf); $(CELLS[i][0]).style.transition = 'none'; },
      onMove: (x, y) => { const k = 1 / (1 + Math.hypot(x, y) / 260); dx = x * k; dy = y * k; apply(); },
      onEnd: () => {
        const step = () => {
          vx = (vx - dx * .1) * .8; vy = (vy - dy * .1) * .8; dx += vx; dy += vy; apply();
          if (working && Math.abs(dx) + Math.abs(dy) + Math.abs(vx) + Math.abs(vy) > .2) { raf = requestAnimationFrame(step); colRafs[i] = raf; }
          else { dx = dy = vx = vy = 0; apply(); $(CELLS[i][0]).style.transition = ''; }
        };
        raf = requestAnimationFrame(step); colRafs[i] = raf;
      },
    });
    hit.addEventListener('click', () => {
      const sel = CELLS[i][0];
      exitWork().then(() => { if (sel === '#stacks') openStacks('Lisbon', $('#stacks')); });
    });
    return b;
  });
}

async function enterWork() {
  if (working || busy) return;
  busy = true; working = true;
  closeAsk(); $('#start').hidden = true;
  Object.keys(openWins).forEach(k => { if (!openWins[k].hidden) minimize(k); });
  const L = $('#morph-layer');
  // The nucleus becomes a blob, the right-hand cells flow into it, and it grows.
  const b0 = blob(L, NUC, 28), b1 = blob(L, T_RECT, 28), b2 = blob(L, M_RECT, 28);
  stage.classList.add('working');
  buildColumn(); placeCells(true);
  const inside = { x: WK.x + WK.w - 260, y: WK.y + 300, w: 140, h: 140 };
  moveBlob(b1, inside, 650, 70, 'cubic-bezier(.6,0,.3,1)');
  moveBlob(b2, { ...inside, y: inside.y + 160 }, 700, 70, 'cubic-bezier(.6,0,.3,1)');
  await moveBlob(b0, WK, 800, 34);
  b1.remove(); b2.remove();
  renderWork();
  $('#work').hidden = false;
  await sleep(200);
  b0.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).finished.then(() => b0.remove());
  busy = false;
  if (!workStarted) { workStarted = true; runWork(); }
}
async function exitWork() {
  if (!working || busy) return;
  busy = true;
  const L = $('#morph-layer');
  const b0 = blob(L, WK, 34);
  $('#work').hidden = true;
  const inside = { x: WK.x + WK.w - 260, y: WK.y + 300, w: 140, h: 140 };
  const b1 = blob(L, inside, 70), b2 = blob(L, { ...inside, y: inside.y + 160 }, 70);
  colRafs.forEach(cancelAnimationFrame); colRafs = [];
  CELLS.forEach(([sel]) => { $(sel).style.transition = ''; });
  stage.classList.remove('working'); stage.classList.add('returning');
  placeCells(false);
  $('#col-layer').innerHTML = ''; $('#col-hit').innerHTML = '';
  moveBlob(b1, T_RECT, 700, 28); moveBlob(b2, M_RECT, 760, 28);
  await moveBlob(b0, NUC, 750, 28);
  stage.classList.remove('returning');
  await sleep(120);
  [b0, b1, b2].forEach(b => b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).finished.then(() => b.remove()));
  working = false; busy = false;
}

/* Work view content */
const SOURCES = [
  [APPS.outlook, 'TAP flight confirmation', 'Inbox · from TAP Air Portugal · Sep 28', 'Seattle to Lisbon on Oct 16, landing 11:40. Seats 32A and 32B, one checked bag each.', 'pass'],
  [APPS.edge, "Maya's saved places", 'Saved in Edge · 14 places', 'Fado in Alfama, the tile museum and two bakeries in Belém. Most are walkable from the hotel.', 'map'],
  [APPS.word, 'Lisbon notes from last spring', 'OneDrive · edited in May', 'Your own list from the last trip: what you missed and what to skip this time.', 'notes'],
  [APPS.excel, 'Trip budget.xlsx', 'Copilot updated it today', 'Flights, three nights and a food estimate come to about $1,850.', 'sheet'],
];
const WDAYS = [
  ['Day 1', 'Arrive and wander', 'Lunch near the hotel, sunset at the miradouro', '#f97316'],
  ['Day 2', 'Alfama and the castle', 'Tram 28 early, fado at 8:30', '#eab308'],
  ['Day 3', 'Belém', 'Pastéis, the monastery, a river walk', '#2563eb'],
  ['Day 4', 'Sintra, if you feel like it', 'Train from Rossio at 9:10, flight home at 18:05', '#7c3aed'],
];
const PACK = ['Passports', 'Comfortable walking shoes', 'Rain jacket for Sunday', 'Plug adapter (type F)', 'A book for the flight'];
function srcThumb(kind) {
  if (kind === 'pass') return `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#1f4fbf,#3b82f6);color:#fff;padding:16px 18px;font:600 12px/1.3 var(--font)">TAP AIR PORTUGAL<div style="font:700 30px/1 var(--font-display);margin-top:14px;letter-spacing:1px">SEA → LIS</div><div style="opacity:.8;margin-top:8px">Oct 16 · 32A, 32B</div></div>`;
  if (kind === 'map') return `<div class="src-il" style="background:#eaf2ff"><span data-illus="map"></span></div>`;
  if (kind === 'notes') return `<div class="src-il" style="background:#fff4e8"><span data-illus="pencil"></span></div>`;
  if (kind === 'doc') return `<div style="position:absolute;inset:0;padding:16px 20px">${[70, 90, 80, 60, 85].map(w => `<div class="skel" style="width:${w}%;margin:0 0 10px"></div>`).join('')}</div>`;
  return `<div style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:20px;gap:2px;padding:10px;background:#f3f8f4">${Array.from({ length: 16 }, (_, i) => `<i style="background:${i < 4 ? '#c8e6cf' : '#fff'};border-radius:2px"></i>`).join('')}</div>`;
}
function renderWork() {
  const w = $('#work');
  if (w.children.length) return;
  const blds = [[60, 64, '#f3d9a4'], [116, 84, '#e7b77d'], [172, 56, '#f6e7c6'], [228, 92, '#fff4e0'], [284, 70, '#e9a86b'], [340, 80, '#f2c38b'], [396, 60, '#e3956b'], [452, 74, '#f3d9a4']];
  w.innerHTML = `<nav class="rail">
      <button class="on" title="Copilot">${ic('sparkle')}</button><button title="Notes">${ic('edit')}</button><button title="Search">${ic('search')}</button><button title="Tasks">${ic('task-list-ltr')}</button><button title="Pinned">${ic('pin')}</button>
      <img class="rail-avatar" src="media/person-adam.jpg" alt=""></nav>
    <div class="wk-chat">
      <div class="me">Plan four days in Lisbon for Maya and me. Mid October, not too packed.</div>
      <p class="lead">Here's a relaxed plan built from what's already on your PC: your flight, the hotel and the places Maya saved. I'm writing it into Lisbon trip.docx on the right, and it stays editable the whole time.</p>
      <hr><h3>Lisbon Trip</h3>
      <div class="wk-src" id="wk-src"></div>
      <form class="wk-ask" id="wk-ask">${ic('add', 20)}<input placeholder="Ask Copilot to change the plan" autocomplete="off">${ic('mic', 18)}<button type="button" class="ask-voice">${ic('speaker-2', 20)}</button></form>
    </div>
    <div class="wk-prev">
      <div class="wk-head"><img src="${ICONS}${APPS.word}" alt=""><span><b>Lisbon trip.docx</b> <small>Saved · Draft by Copilot</small></span><span class="sp"></span>
        <button class="back" id="wk-back">${ic('arrow-left', 16)} Bench</button><button id="wk-share">${ic('share', 16)} Share</button><button class="primary" id="wk-word">Open in Word</button></div>
      <div class="wk-page-wrap"><i class="wk-nub l"></i><i class="wk-nub r"></i>
        <div class="wk-page"><div class="wk-hero"><div class="sun"></div>${blds.map(([x, h, c]) => `<div class="bld" style="left:${x}px;height:${h}px;background:${c}"></div>`).join('')}</div>
          <div class="wk-doc" id="wk-doc"><h1>Lisbon, Oct 16 to 19</h1><p class="meta">4 days · 2 travelers · about $1,850</p>
            <div id="wk-days"><div class="skel" style="width:60%"></div><div class="skel" style="width:80%"></div><div class="skel" style="width:40%"></div></div></div></div></div>
      <div class="wk-pill" id="wk-pill"><span class="pill-bot"></span><span class="pill-t">Reading your flight and hotel</span></div>
    </div>`;
  $('#wk-back').addEventListener('click', exitWork);
  $('#wk-word').addEventListener('click', () => { exitWork().then(() => openWindow('lisbon', null, true)); });
  $('#wk-share').addEventListener('click', () => toast('Lisbon trip shared with Maya', APPS.word));
  $('#wk-ask').addEventListener('submit', e => {
    e.preventDefault(); const i = $('input', e.target); const v = i.value.trim(); if (!v) return; i.value = '';
    const src = $('#wk-src');
    src.appendChild(html(`<div class="me" style="align-self:flex-end">${v.replace(/</g, '&lt;')}</div>`));
    setTimeout(() => { src.appendChild(html(`<p class="lead" style="margin:0">Done. I changed the plan on the right and kept everything else as it was.</p>`)); src.scrollTop = 1e6;
      const d = $$('#wk-days .day')[2]; if (d) { $('span', d).textContent = v.charAt(0).toUpperCase() + v.slice(1); d.style.animation = 'none'; void d.offsetWidth; d.style.animation = ''; } }, 800);
    src.scrollTop = 1e6;
  });
  $('#wk-pill').addEventListener('click', () => { if ($('#wk-pill').classList.contains('done')) { toast('Lisbon trip shared with Maya', APPS.word); $('#wk-pill .pill-t').textContent = 'Shared with Maya'; } });
}
async function runWork() {
  const src = $('#wk-src'), days = $('#wk-days'), pill = $('#wk-pill .pill-t');
  for (const [icon, t, meta, p, th] of SOURCES) {
    src.appendChild(html(`<div class="src"><img src="${ICONS}${icon}" alt=""><div><b>${t}</b><small>${meta}</small><p>${p}</p></div><div class="thumb-s">${srcThumb(th)}</div></div>`)); paintIllus(src);
    await sleep(450);
  }
  days.innerHTML = '';
  for (let i = 0; i < WDAYS.length; i++) {
    const [n, t, sub, c] = WDAYS[i];
    pill.textContent = `Writing ${n.toLowerCase()}`;
    await sleep(900);
    days.appendChild(html(`<div class="day" style="--c:${c}"><small>${n.toUpperCase()}</small><b>${t}</b><span>${sub}</span></div>`));
    updateTask('lisbon', { progress: .62 + (i + 1) / WDAYS.length * .3 });
  }
  pill.textContent = 'Writing packing list';
  await sleep(900);
  days.appendChild(html('<h2>Packing list</h2>'));
  for (const item of PACK) { await sleep(320); const el = html(`<div class="pack"><i></i><span>${item}</span></div>`); el.addEventListener('click', () => el.classList.toggle('done')); days.appendChild(el); }
  $('#wk-pill').classList.add('done'); pill.textContent = 'Ready · Share with Maya';
  BENCH_BOTS.forEach(b => { if (b.el.closest('.pill-bot')) { b.noSleep = false; b.setState('default'); b.poke(); } });
  updateTask('lisbon', { progress: null, sub: 'Copilot · finished, ready to share', chip: ['Ready', 'green'], featured: true });
}

/* ---- Themes ------------------------------------------------------------ */
setupThemes('workbench', [
  { id: 'windows', label: 'Default', style: 'windows' },
  { id: 'm365', label: 'Comic strip', style: 'm365', outline: true, ink: '#484848' },
  { id: 'sketch', label: 'Sketch', style: 'sketch', ink: '#24243a', paper: '#fffdf8' },
], t => { if (window.benchBotTheme) benchBotTheme(t); });

/* ---- Bots: Copilot's little helpers ------------------------------------- */
// A plush bot stands in for Copilot in the Ask panel and in the working view,
// hopping while it works and dozing between tasks.
var BENCH_BOTS = [];
const BENCH_BOT_C = { windows: '#a9b8ff', m365: '#2F95F4', sketch: '#fffdf8' };
function benchBot(host, opts) {
  if (!host || host.querySelector('.bot')) return;
  const b = new Bot({ shape: 'cookie9', eyes: 'dot', cheeks: false, color: BENCH_BOT_C[THEME.id] || '#a9b8ff', ...opts });
  host.appendChild(b.el); BENCH_BOTS.push(b); return b;
}
var benchBotTheme = function (t) {
  botsLook({ sketch: t.id === 'sketch', ink: t.ink || '#24243a', paper: t.paper || '#fffdf8' });
  BENCH_BOTS.forEach(b => b.setColor(BENCH_BOT_C[t.id] || '#a9b8ff'));
};
// Mount them as their hosts appear.
new MutationObserver(() => {
  $$('.head-bot').forEach(h => benchBot(h, { size: 34 }));
  $$('.pill-bot').forEach(h => { const b = benchBot(h, { size: 30, color: '#ffffff' }); if (b) { b.noSleep = true; b.setState('working'); } });
}).observe(stage, { childList: true, subtree: true });
benchBotTheme(THEME);
