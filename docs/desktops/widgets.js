/* Widgets.

   Microsoft's widget set (clock, agenda, weather, traffic, battery, phone,
   briefing and the rest), rebuilt for these desktops. The content is the same
   everyday life the prototypes already show: Lily's recital, dinner with Sam,
   the Tokyo trip. Nothing here is copied from the source designs except the
   idea of each widget.

   One markup per widget fits every size. Each widget is a size container, and
   widgets.css uses container queries to show more as it gets roomier, so the
   same clock works as a Mosaic square, a Mosaic wide tile or a Workbench card.
   Colors come from --wg-* variables that each desktop (and each theme) sets.

   widget(id)            a widget element, ready to place
   widgetStack(ids)      a smart stack that rotates through several widgets
   WIDGETS[id].name      its display name; .fits lists the sizes it suits:
                         s (square), w (wide), t (tall) */

const WIDGETS = {};
const WG_ORDER = [];
function defWidget(id, spec) { WIDGETS[id] = spec; WG_ORDER.push(id); }
const wgToast = m => (typeof toast === 'function' ? toast(m) : console.log(m));
const wgApp = (p, s = 18) => `<img class="wg-app" src="${ICONS}${p}" alt="" style="width:${s}px;height:${s}px">`;
const wgHead = (title, icon, extra = '') => `<div class="wg-head">${icon || ''}<span class="wg-title">${title}</span>${extra}<button class="wg-more" data-wg-act="more" title="More">${ic('more-horizontal', 16)}</button></div>`;

/* ---- Clock: an analog face, and the time where you are going ----------- */
defWidget('clock', {
  name: 'Clock', fits: ['s', 'w'], app: APPS.clock,
  html: () => `<div class="wg-clock-face"><i class="h"></i><i class="m"></i><i class="s"></i><b></b></div>
    <div class="wg-clock-txt"><div class="wg-big"><span data-clock-time>2:38</span><small data-clock-ampm>PM</small></div><span class="wg-sub">Seattle</span>
    <span class="wg-clock-2">Tokyo · <b data-clock-tokyo>6:38 AM</b> tomorrow</span></div>`,
});
function tickClocks() {
  const d = new Date(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  const t = (h % 12 || 12) + ':' + String(m).padStart(2, '0');
  const tk = new Date(d.getTime() + 16 * 3600e3), th = tk.getHours();
  $$('.wg-clock').forEach(w => {
    w.querySelector('.h').style.transform = `rotate(${(h % 12) * 30 + m / 2}deg)`;
    w.querySelector('.m').style.transform = `rotate(${m * 6}deg)`;
    w.querySelector('.s').style.transform = `rotate(${s * 6}deg)`;
    w.querySelector('[data-clock-time]').textContent = t;
    w.querySelector('[data-clock-ampm]').textContent = h < 12 ? 'AM' : 'PM';
    w.querySelector('[data-clock-tokyo]').textContent = `${th % 12 || 12}:${String(tk.getMinutes()).padStart(2, '0')} ${th < 12 ? 'AM' : 'PM'}`;
  });
}
setInterval(tickClocks, 1000);

/* ---- Weather: tap to switch between home and the trip ------------------ */
const WG_WX = [
  { city: 'Seattle', t: 64, c: 'Clear', hl: 'H 68° · L 51°', hours: [['Now', 64, 'weather-sunny'], ['7 PM', 62, 'weather-sunny'], ['8 PM', 59, 'weather-partly-cloudy-day'], ['9 PM', 56, 'weather-partly-cloudy-day'], ['10 PM', 54, 'weather-cloudy']] },
  { city: 'Tokyo', t: 70, c: 'Light rain', hl: 'H 72° · L 63°', hours: [['Now', 70, 'weather-rain'], ['1 PM', 71, 'weather-rain'], ['2 PM', 72, 'weather-cloudy'], ['3 PM', 72, 'weather-partly-cloudy-day'], ['4 PM', 70, 'weather-partly-cloudy-day']] },
];
defWidget('weather', {
  name: 'Weather', fits: ['s', 'w', 't'], app: APPS.weather,
  html: (i = 0) => { const w = WG_WX[i]; return `${wgHead(w.city, '', `<button class="wg-chip" data-wg-act="wx" title="Switch city">${WG_WX[1 - i].city}</button>`)}
    <div class="wg-wx-now"><div class="wg-big">${w.t}°</div><div class="wg-wx-c"><b>${w.c}</b><span class="wg-sub">${w.hl}</span></div><span class="wg-sky${i ? ' rain' : ''}"><i class="sun"></i><i class="cl"></i><i class="cl b"></i><i class="drops"></i></span></div>
    <div class="wg-hours">${w.hours.map(([h, t, n]) => `<div><span>${h}</span>${ic(n, 20, 'filled')}<b>${t}°</b></div>`).join('')}</div>`; },
  act: { wx(el) { el._i = 1 - (el._i || 0); el.firstChild.innerHTML = WIDGETS.weather.html(el._i); } },
});

/* ---- Traffic ----------------------------------------------------------- */
defWidget('traffic', {
  name: 'Traffic', fits: ['s', 'w'], app: APPS.maps,
  html: () => `${wgHead('Moderate traffic', ic('vehicle-car', 16, 'filled'))}
    <div class="wg-big wg-accent"><span data-min>18</span><small>min</small></div>
    <span class="wg-sub">to Capitol Hill via I-5</span>
    <div class="wg-route"><i style="width:62%"></i><b></b></div>
    <button class="wg-chip wg-go" data-wg-act="traffic">${ic('arrow-sync', 14)} Refresh</button>`,
  act: { traffic(el) { const n = 14 + Math.floor(Math.random() * 9); el.querySelector('[data-min]').textContent = n; el.querySelector('.wg-route i').style.width = (40 + Math.random() * 50) + '%'; wgToast(`Updated: ${n} min to Capitol Hill`); } },
});

/* ---- Agenda ------------------------------------------------------------ */
const WG_EVENTS = [['Lily\'s recital', '4:00 PM', 'School auditorium', '#e0457b', true], ['Garden club', '5:30 PM', 'With the neighbors', '#22a06b'], ['Run', '6:00 PM', 'Green Lake loop', '#f08c00'], ['Dinner with Sam', '7:30 PM', 'Cafe Lumen', '#6466f1']];
defWidget('agenda', {
  name: 'Agenda', fits: ['w', 't'], app: APPS.calendar,
  html: () => `${wgHead('Today', '', `<span class="wg-sub wg-date">${DAYS[new Date().getDay()]} ${new Date().getDate()}</span>`)}
    <div class="wg-events">${WG_EVENTS.map(([t, time, where, c, done], i) => `<button class="wg-ev${done ? ' past' : ''}${i === 1 ? ' next' : ''}" style="--c:${c}" data-wg-act="ev"><i></i><span><b>${t}</b><small>${time} · ${where}</small></span>${i === 1 ? '<em>Leave in 20 min</em>' : ''}</button>`).join('')}</div>`,
  act: { ev(el, b) { wgToast(`${b.querySelector('b').textContent}: ${b.querySelector('small').textContent}`); } },
});

/* ---- Alarm ------------------------------------------------------------- */
defWidget('alarm', {
  name: 'Alarm', fits: ['s', 'w'], app: APPS.clock,
  html: () => `${wgHead('Alarm', ic('clock-alarm', 16, 'filled'))}
    <div class="wg-big">6:00<small>AM</small></div>
    <span class="wg-sub">Leave for the airport · Sat</span>
    <button class="wg-switch on" role="switch" aria-checked="true" data-wg-act="alarm" title="Alarm on"><i></i></button>`,
  act: { alarm(el, b) { const on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); wgToast(on ? 'Alarm on for 6:00 AM Saturday' : 'Alarm off'); } },
});

/* ---- Battery: this PC and everything connected to it ------------------- */
const WG_DEV = [['This PC', 'laptop', 80, 'Charging'], ['Earbuds', 'headphones', 66, 'Connected'], ['Surface Pen', 'pen', 79, 'Connected'], ['Keyboard', 'keyboard', 84, 'Connected']];
defWidget('battery', {
  name: 'Battery', fits: ['s', 'w', 't'], app: 'app/surface/standard-48.svg',
  html: () => `${wgHead('Battery', ic('battery-charge', 16, 'filled'))}
    <div class="wg-batt-big"><div class="wg-big">80<small>%</small></div><span class="wg-sub">This PC · charging</span></div>
    <div class="wg-devs">${WG_DEV.map(([n, i, p, s]) => `<div class="wg-dev">${ic(i, 20)}<span><b>${n}</b><small>${s}</small></span><em>${p}%</em><div class="wg-bar"><i style="width:${p}%"></i></div></div>`).join('')}</div>`,
});

/* ---- Phone ------------------------------------------------------------- */
defWidget('phone', {
  name: 'Phone', fits: ['w', 't'], app: 'app/phone-link/standard-48.svg',
  html: () => `${wgHead('Alex\'s phone', ic('phone', 16, 'filled'), `<span class="wg-stat">${ic('wifi-1', 14)}${ic('battery-charge', 14)} 92%</span>`)}
    <div class="wg-msgs">
      <button class="wg-msg" data-wg-act="msg"><span class="wg-av" style="background-image:url(media/person-sam.jpg)"></span><span><b>Sam</b><small>Free after 6, call you then?</small></span></button>
      <button class="wg-msg" data-wg-act="msg"><span class="wg-av ini" style="--c:#f08c00">M</span><span><b>Maya</b><small>Sending the Big Sur pics!</small></span></button>
      <button class="wg-msg" data-wg-act="msg"><span class="wg-av ini" style="--c:#22a06b">P</span><span><b>Priya</b><small>Lemon bars are in the oven</small></span></button>
    </div>
    <div class="wg-reply">${['Sounds good', 'On my way', '❤️'].map(t => `<button class="wg-chip" data-wg-act="reply">${t}</button>`).join('')}</div>`,
  act: { msg(el, b) { wgToast(`Opening your chat with ${b.querySelector('b').textContent}`); }, reply(el, b) { wgToast(`Sent "${b.textContent}" to Sam`); } },
});

/* ---- Daily briefing: Copilot's read on your day ------------------------ */
const WG_BRIEF = [
  [APPS.outlook, 'Lily\'s field trip form is due Thursday. It\'s in your inbox, ready to sign.'],
  [APPS.calendar, 'Book club moved to 7 PM. Priya is bringing lemon bars.'],
  [APPS.photos, 'Maya shared 39 photos from Big Sur.'],
  ['product/to-do/standard-48.svg', 'Sam added oat milk and limes to the grocery list.'],
  [APPS.outlook, 'Your Tokyo flight opens for check-in Friday at 7:45 AM.'],
];
defWidget('briefing', {
  name: 'Daily briefing', fits: ['w', 't'], app: APPS.copilot,
  html: () => `${wgHead('Daily briefing', wgApp(APPS.copilot, 18))}
    <div class="wg-brief">${WG_BRIEF.map(([a, t]) => `<button class="wg-bi" data-wg-act="brief">${wgApp(a, 20)}<span>${t}</span></button>`).join('')}</div>`,
  act: { brief(el, b) { b.classList.toggle('read'); } },
});

/* ---- Photos: on this day ----------------------------------------------- */
const WG_PH = [['media/photo-bigsur.jpg', 'Big Sur', '1 year ago'], ['media/photo-living.jpg', 'Home', '2 years ago'], ['media/photo-room.jpg', 'The new room', '3 years ago']];
defWidget('photos', {
  name: 'Photos', fits: ['s', 'w', 't'], app: APPS.photos,
  html: (i = 0) => `<div class="wg-photo" style="background-image:url(${WG_PH[i][0]})"></div>
    <div class="wg-photo-cap"><small>On this day</small><b>${WG_PH[i][1]}</b><span>${WG_PH[i][2]}</span></div>
    <button class="wg-round wg-next" data-wg-act="photo" title="Next memory">${ic('next', 16, 'filled')}</button>`,
  act: { photo(el) { el._i = ((el._i || 0) + 1) % WG_PH.length; el.firstChild.innerHTML = WIDGETS.photos.html(el._i); } },
});

/* ---- People ------------------------------------------------------------ */
const WG_PPL = [['Sam', 'media/person-sam.jpg', 'on'], ['Maya', '#f08c00', 'on'], ['Mom', '#e0457b', 'away'], ['Priya', '#22a06b', ''], ['Jordan', '#6466f1', 'on'], ['Coach Lee', '#0b7fbf', '']];
defWidget('people', {
  name: 'People', fits: ['w', 't'], app: 'app/people/standard-48.svg',
  html: () => `${wgHead('People', ic('people', 16, 'filled'))}
    <div class="wg-ppl">${WG_PPL.map(([n, a, s]) => `<button class="wg-p" data-wg-act="person" title="${n}"><span class="wg-av${a[0] === '#' ? ' ini' : ''}" style="${a[0] === '#' ? `--c:${a}` : `background-image:url(${a})`}">${a[0] === '#' ? n[0] : ''}<i class="${s}"></i></span><small>${n}</small></button>`).join('')}</div>`,
  act: { person(el, b) { wgToast(`Calling ${b.title}…`); } },
});

/* ---- Calculator: it really calculates ---------------------------------- */
defWidget('calc', {
  name: 'Calculator', fits: ['t'], app: 'app/calculator/standard-48.svg',
  html: () => `<div class="wg-calc-out"><small data-calc-expr>Dinner for 4, split</small><b data-calc-val>0</b></div>
    <div class="wg-keys">${['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='].map(k => `<button data-wg-act="key" class="${/[÷×−+=]/.test(k) ? 'op' : ''}${k === '=' ? ' eq' : ''}">${k}</button>`).join('')}</div>`,
  act: {
    key(el, b) {
      const k = b.textContent, out = el.querySelector('[data-calc-val]'), ex = el.querySelector('[data-calc-expr]');
      el._e = el._e || '';
      if (k === 'C') el._e = '';
      else if (k === '⌫') el._e = el._e.slice(0, -1);
      else if (k === '±') el._e = el._e ? `-(${el._e})` : '';
      else if (k === '=') { try { const v = Function(`return (${el._e.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-').replace(/%/g, '/100')})`)(); ex.textContent = el._e + ' ='; el._e = String(Math.round(v * 1e8) / 1e8); } catch (e) { ex.textContent = 'Not quite'; } }
      else el._e += k;
      out.textContent = el._e || '0';
      if (k !== '=' && el._e) ex.textContent = ' ';
    },
  },
});

/* ---- Markets: a fund you follow ---------------------------------------- */
function wgSpark(seed, n = 40) {
  let v = 50, pts = [];
  for (let i = 0; i < n; i++) { v += Math.sin(i * 1.7 + seed) * 4 + Math.cos(i * .6 + seed * 2) * 3 + .9; pts.push(v); }
  const lo = Math.min(...pts), hi = Math.max(...pts);
  return pts.map((p, i) => `${(i / (n - 1) * 100).toFixed(1)},${(36 - (p - lo) / (hi - lo) * 32).toFixed(1)}`).join(' ');
}
defWidget('markets', {
  name: 'Markets', fits: ['s', 'w'], app: 'product/msn/standard-48.svg',
  html: () => { const pts = wgSpark(3); return `${wgHead('Total market fund', ic('arrow-trending', 16))}
    <div class="wg-big">302.45</div><span class="wg-up">▲ 0.82% today</span>
    <svg class="wg-spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points="${pts}" /><polygon points="0,40 ${pts} 100,40" /></svg>`; },
});

/* ---- Sports: the game that matters in this house ----------------------- */
defWidget('sports', {
  name: 'Sports', fits: ['s', 'w'], app: 'product/msn/standard-48.svg',
  html: (next) => `${wgHead('Lily\'s soccer', ic('sport-soccer', 16, 'filled'), `<button class="wg-chip" data-wg-act="sport">${next ? 'Last game' : 'Next game'}</button>`)}
    ${next ? `<div class="wg-score"><span class="wg-crest" style="--c:#f08c00">H</span><div><small>Saturday · 10 AM</small><b>vs Rockets</b><small>Meadow Park, field 3</small></div><span class="wg-crest" style="--c:#0b7fbf">R</span></div>`
      : `<div class="wg-score"><span class="wg-crest" style="--c:#f08c00">H</span><div><small>Final</small><b>3 – 2</b><small>Hornets win</small></div><span class="wg-crest" style="--c:#7048e8">C</span></div>`}
    <div class="wg-teams"><span>Hornets</span><span>${next ? 'Rockets' : 'Comets'}</span></div>`,
  act: { sport(el) { el._n = !el._n; el.firstChild.innerHTML = WIDGETS.sports.html(el._n); } },
});

/* ---- News -------------------------------------------------------------- */
const WG_NEWS = [['Farmers market adds a Thursday night', 'Neighborhood Daily · 1h', 'notes'], ['A sunny stretch ahead: five easy hikes', 'Outdoors Weekly · 3h', 'compass'], ['The library is lending telescopes now', 'City News · 5h', 'telescope']];
defWidget('news', {
  name: 'News', fits: ['w', 't'], app: APPS.news,
  html: () => `${wgHead('Local news', ic('news', 16, 'filled'))}
    <div class="wg-newslist">${WG_NEWS.map(([h, s, il]) => `<button class="wg-n" data-wg-act="news"><span><b>${h}</b><small>${s}</small></span><span class="wg-n-il" data-illus="${il}"></span></button>`).join('')}</div>`,
  act: { news(el, b) { wgToast(`Opening "${b.querySelector('b').textContent}"`); } },
});

/* ---- Music ------------------------------------------------------------- */
defWidget('music', {
  name: 'Music', fits: ['s', 'w'], app: APPS.media,
  html: () => `<div class="wg-art"></div><div class="wg-music-txt"><small>Now playing</small><b>Golden hour mix</b><span class="wg-sub">Weekend radio</span></div>
    <div class="wg-music-ctl"><button class="wg-round" data-wg-act="prev" title="Previous">${ic('previous', 16, 'filled')}</button><button class="wg-round wg-play" data-wg-act="play" title="Play">${ic('play', 18, 'filled')}</button><button class="wg-round" data-wg-act="next" title="Next">${ic('next', 16, 'filled')}</button></div>
    <div class="wg-prog"><i></i></div>`,
  act: {
    play(el, b) { const on = !el.classList.contains('playing'); el.classList.toggle('playing', on); b.innerHTML = ic(on ? 'pause' : 'play', 18, 'filled'); },
    next(el) { el.querySelector('.wg-music-txt b').textContent = ['Golden hour mix', 'Sunday slow', 'Kitchen dance party'][(el._t = ((el._t || 0) + 1) % 3)]; },
    prev(el) { el.querySelector('.wg-prog i').style.width = '0%'; },
  },
});

/* ---- Games ------------------------------------------------------------- */
defWidget('game', {
  name: 'Games', fits: ['s', 'w'], app: 'app/xbox/standard-48.svg',
  html: () => `${wgHead('Continue playing', wgApp('app/xbox/standard-48.svg', 16))}
    <div class="wg-gamerow"><span class="wg-game-il" data-illus="achievement"></span><span><b>Puzzle Isle</b><small>Level 12 · 3 stars to go</small></span></div>
    <button class="wg-chip wg-go" data-wg-act="game">${ic('play', 14, 'filled')} Resume</button>`,
  act: { game() { wgToast('Resuming Puzzle Isle, level 12'); } },
});

/* ---- Building and wiring ----------------------------------------------- */
function widget(id, opts = {}) {
  const spec = WIDGETS[id];
  const el = html(`<div class="wg" data-wg="${id}"><div class="wg-in wg-${id}">${spec.html()}</div></div>`);
  if (opts.size) el.classList.add('sz-' + opts.size);
  paintIllus(el);
  if (id === 'clock') setTimeout(tickClocks);
  return el;
}
// Every widget action goes through one listener.
document.addEventListener('click', e => {
  const b = e.target.closest('[data-wg-act]'); if (!b) return;
  const el = b.closest('.wg'); if (!el) return;
  e.stopPropagation();
  const act = b.dataset.wgAct, spec = WIDGETS[el.dataset.wg];
  if (act === 'more') { wgToast(`${spec.name}: pin, resize or hide`); return; }
  spec.act && spec.act[act] && spec.act[act](el, b);
}, true);
// The music widget's progress creeps along while it plays.
setInterval(() => $$('.wg.playing .wg-prog i').forEach(i => { const w = (parseFloat(i.style.width) || 30) + .6; i.style.width = (w > 100 ? 0 : w) + '%'; }), 500);

/* A smart stack: several widgets in one place, taking turns. It advances on
   its own, a scroll flips it, and hovering holds it still. */
function widgetStack(ids, { every = 6000, size } = {}) {
  const st = html(`<div class="wg-stack" data-stack><div class="wg-stack-in"></div><div class="wg-dots">${ids.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div></div>`);
  const inner = st.firstChild;
  ids.forEach((id, i) => { const w = widget(id, { size }); w.classList.toggle('on', !i); inner.appendChild(w); });
  let i = 0, hold = false;
  const go = d => {
    const ws = [...inner.children], dots = [...st.querySelectorAll('.wg-dots i')];
    ws[i].classList.remove('on'); ws[i].classList.add(d > 0 ? 'out-up' : 'out-down');
    const old = ws[i]; setTimeout(() => old.classList.remove('out-up', 'out-down'), 600);
    i = (i + d + ws.length) % ws.length;
    ws[i].classList.add('on', d > 0 ? 'in-up' : 'in-down'); setTimeout(() => ws[i].classList.remove('in-up', 'in-down'), 600);
    dots.forEach((x, k) => x.classList.toggle('on', k === i));
  };
  st.addEventListener('pointerenter', () => hold = true);
  st.addEventListener('pointerleave', () => hold = false);
  st.addEventListener('wheel', e => { e.preventDefault(); if (st._lock) return; st._lock = true; setTimeout(() => st._lock = false, 500); go(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  st.querySelector('.wg-dots').addEventListener('click', e => { e.stopPropagation(); go(1); });
  st._timer = setInterval(() => { if (!hold && st.isConnected) go(1); }, every);
  return st;
}
