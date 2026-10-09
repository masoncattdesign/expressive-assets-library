/* Shapes and bots.

   SHAPES is a small shape library in the spirit of Material 3's expressive
   shapes (cookies, clovers, bursts, pills, arches, gems), drawn our own way.
   Every shape is stored as radii sampled around a center, so any shape can
   morph smoothly into any other by interpolating the radii.

   Bot is a plush little character built on one of those shapes: fuzzy edges
   from a turbulence filter, a soft 3D gradient, and a face that looks toward
   the pointer, blinks, hops while it works and dozes off when left alone.
   Inspired by libraries.dev/bots, not a copy of it. */

const SHAPE_N = 160;
const TAU = Math.PI * 2;

function polarFromInside(inside) {
  const r = [];
  for (let i = 0; i < SHAPE_N; i++) {
    const t = i / SHAPE_N * TAU, c = Math.cos(t), s = Math.sin(t);
    let lo = 0, hi = 2;
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; inside(c * m, s * m) ? lo = m : hi = m; }
    r.push(lo);
  }
  return r;
}
const polarFn = f => Array.from({ length: SHAPE_N }, (_, i) => f(i / SHAPE_N * TAU));
// Rounds corners by averaging each radius with its neighbors.
function soften(r, k = 4, passes = 2) {
  for (let p = 0; p < passes; p++) {
    r = r.map((_, i) => { let s = 0; for (let j = -k; j <= k; j++) s += r[(i + j + SHAPE_N) % SHAPE_N]; return s / (2 * k + 1); });
  }
  return r;
}
function polygon(n, rot = -Math.PI / 2) {
  return polarFn(t => { const seg = TAU / n; const a = ((t - rot) % seg + seg) % seg - seg / 2; return Math.cos(Math.PI / n) / Math.cos(a); });
}
function star(n, inner, rot = -Math.PI / 2) {
  return polarFn(t => { const seg = TAU / n; const a = ((((t - rot) % seg) + seg) % seg) / seg; const f = Math.abs(a - .5) * 2; return inner + (1 - inner) * f; });
}
const roundRect = (w, h, rad) => (x, y) => { const qx = Math.abs(x) - w + rad, qy = Math.abs(y) - h + rad; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad <= 0; };

const SHAPES = {
  circle: polarFn(() => 1),
  square: polarFromInside(roundRect(.82, .82, .3)),
  pill: polarFromInside(roundRect(1, .56, .56)),
  arch: soften(polarFromInside((x, y) => (Math.abs(x) <= .78 && y >= -.1 && y <= .9) || (x * x + (y + .1) ** 2 <= .78 * .78)), 3, 2),
  cookie4: polarFn(t => 1 + .12 * Math.cos(4 * t)),
  cookie6: polarFn(t => 1 + .09 * Math.cos(6 * t)),
  cookie9: polarFn(t => 1 + .07 * Math.cos(9 * t)),
  cookie12: polarFn(t => 1 + .05 * Math.cos(12 * t)),
  clover4: soften(polarFn(t => .62 + .38 * Math.pow(Math.abs(Math.cos(2 * t)), .55)), 3, 2),
  clover8: soften(polarFn(t => .74 + .26 * Math.pow(Math.abs(Math.cos(4 * t)), .6)), 2, 2),
  sunny: soften(star(8, .78), 3, 2),
  burst: soften(star(12, .7), 2, 1),
  flower: soften(polarFn(t => .7 + .3 * Math.pow(Math.abs(Math.cos(2.5 * t)), .7)), 2, 2),
  pentagon: soften(polygon(5), 7, 2),
  triangle: soften(polygon(3), 10, 3),
  gem: soften(polygon(6, 0), 5, 2),
  heart: soften(polarFromInside((x, y) => { const X = x * 1.15, Y = -y * 1.15 + .2; return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0; }), 2, 1),
  puffy: soften(polarFn(t => 1 + .1 * Math.cos(3 * t) + .05 * Math.cos(5 * t + 1)), 2, 1),
};
// Normalize every shape so it fills the same box.
for (const k in SHAPES) { const m = Math.max(...SHAPES[k]); SHAPES[k] = SHAPES[k].map(v => v / m); }
const SHAPE_NAMES = Object.keys(SHAPES);

// A smooth closed path through the sampled points (Catmull-Rom as cubics).
function shapePath(r, size = 50, cx = 0, cy = 0) {
  const P = r.map((v, i) => { const t = i / SHAPE_N * TAU; return [cx + Math.cos(t) * v * size, cy + Math.sin(t) * v * size]; });
  const n = P.length; let d = `M${P[0][0].toFixed(2)} ${P[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + 'Z';
}
// Morph a <path> from its current radii to a named shape, with a little overshoot.
function morphPath(pathEl, toName, { size = 50, dur = 520 } = {}) {
  const from = pathEl._r || SHAPES[toName], to = SHAPES[toName];
  const t0 = performance.now();
  cancelAnimationFrame(pathEl._raf);
  const back = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = back(k);
    const r = from.map((v, i) => v + (to[i] - v) * e);
    pathEl.setAttribute('d', shapePath(r, size)); pathEl._r = r;
    if (k < 1) pathEl._raf = requestAnimationFrame(step); else pathEl._r = to;
  };
  pathEl._raf = requestAnimationFrame(step);
}

/* ---- Colors ------------------------------------------------------------ */
function mixHex(a, b, k) {
  const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const A = h(a), B = h(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

/* ---- Bots -------------------------------------------------------------- */
const BOT_LOOK = { ink: '#24243a', paper: '#fffdf8', sketch: false };
const ALL_BOTS = [];
let botUid = 0;
class Bot {
  constructor({ shape = 'cookie6', color = '#f4a3c1', eyes = 'round', size = 120, cheeks = true } = {}) {
    this.id = 'bot' + (botUid++); this.shape = shape; this.color = color; this.eyesKind = eyes; this.cheeks = cheeks;
    this.state = 'default'; this.last = performance.now();
    const id = this.id, seed = 1 + botUid * 7;
    this.el = html(`<span class="bot" style="width:${size}px;height:${size}px">
      <svg viewBox="-64 -64 128 128" aria-hidden="true">
        <defs>
          <radialGradient id="${id}-g" cx=".36" cy=".3" r=".85"><stop offset="0" class="c1"/><stop offset=".55" class="c2"/><stop offset="1" class="c3"/></radialGradient>
          <filter id="${id}-f" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${seed}" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 -.18" result="hi"/>
            <feComposite in="hi" in2="d" operator="in" result="fuzz"/>
            <feMerge><feMergeNode in="d"/><feMergeNode in="fuzz"/></feMerge>
          </filter>
        </defs>
        <ellipse class="shadow" cx="0" cy="58" rx="34" ry="5"/>
        <g class="hop"><g class="squash">
          <path class="body" fill="url(#${id}-g)" filter="url(#${id}-f)"/>
          <g class="face">
            <g class="eyes"><g class="eye l"></g><g class="eye r"></g></g>
            ${cheeks ? '<ellipse class="cheek" cx="-24" cy="14" rx="7" ry="4"/><ellipse class="cheek" cx="24" cy="14" rx="7" ry="4"/>' : ''}
            <path class="mouth" d="M-6 16 Q0 21 6 16"/>
          </g>
        </g></g>
        <g class="zzz"><text x="30" y="-34">z</text><text x="40" y="-46">z</text></g>
      </svg></span>`);
    this.body = this.el.querySelector('.body');
    this.body.setAttribute('d', shapePath(SHAPES[shape], 54)); this.body._r = SHAPES[shape];
    this.drawEyes(); this.paint();
    ALL_BOTS.push(this);
    this.blinkT = setTimeout(() => this.blink(), 1500 + Math.random() * 3000);
  }
  drawEyes(kind = this.state) {
    const [l, r] = this.el.querySelectorAll('.eye');
    const shapes = {
      default: this.eyesKind === 'dot' ? '<ellipse rx="5" ry="6.5"/><circle class="glint" cx="1.6" cy="-2.4" r="1.6"/>' : '<ellipse rx="6.5" ry="9"/><circle class="glint" cx="2" cy="-3.5" r="2.2"/>',
      working: '<path class="line" d="M-6 2 Q0 -6 6 2"/>',
      sleeping: '<path class="line" d="M-6 0 Q0 5 6 0"/>',
    };
    l.innerHTML = shapes[kind] || shapes.default; r.innerHTML = shapes[kind] || shapes.default;
    l.setAttribute('transform', 'translate(-15 -6)'); r.setAttribute('transform', 'translate(15 -6)');
  }
  paint() {
    const st = this.el.querySelectorAll('stop');
    if (BOT_LOOK.sketch) {
      st.forEach(s => s.setAttribute('stop-color', BOT_LOOK.paper));
      this.body.setAttribute('filter', ''); this.body.setAttribute('stroke', BOT_LOOK.ink); this.body.setAttribute('stroke-width', '2.4');
      this.el.style.setProperty('--bot-ink', BOT_LOOK.ink); this.el.style.setProperty('--bot-cheek', 'transparent');
    } else {
      const c = this.color;
      st[0].setAttribute('stop-color', mixHex(c, '#ffffff', .5)); st[1].setAttribute('stop-color', c); st[2].setAttribute('stop-color', mixHex(c, '#1a1030', .28));
      this.body.setAttribute('filter', `url(#${this.id}-f)`); this.body.removeAttribute('stroke');
      this.el.style.setProperty('--bot-ink', '#2a1d33'); this.el.style.setProperty('--bot-cheek', mixHex(c, '#ff5a8a', .45));
    }
  }
  setColor(c) { this.color = c; this.paint(); }
  setShape(s) { this.shape = s; morphPath(this.body, s, { size: 54, dur: 600 }); }
  setState(s) {
    if (s === this.state) return;
    this.state = s; this.el.dataset.state = s; this.drawEyes(); this.last = performance.now();
  }
  work(ms = 1600) { this.setState('working'); clearTimeout(this.workT); this.workT = setTimeout(() => this.setState('default'), ms); }
  poke() {
    this.last = performance.now();
    if (this.state === 'sleeping') { this.setState('default'); }
    const h = this.el.querySelector('.hop');
    h.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-22px)' }, { transform: 'translateY(0)' }], { duration: 480, easing: 'cubic-bezier(.3,1.6,.6,1)' });
  }
  blink() {
    if (this.state === 'default') {
      const e = this.el.querySelector('.eyes');
      e.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.1)' }, { transform: 'scaleY(1)' }], { duration: 180 });
    }
    this.blinkT = setTimeout(() => this.blink(), 2200 + Math.random() * 4000);
  }
  look(px, py) {
    if (this.state !== 'default') return;
    const r = this.el.getBoundingClientRect(); if (!r.width) return;
    const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300);
    this.el.querySelector('.face').setAttribute('transform', `translate(${(dx / d * 7 * k).toFixed(1)} ${(dy / d * 5 * k).toFixed(1)})`);
    if (d < 140) this.last = performance.now();
  }
}
// Every bot watches the pointer, and dozes off when nothing happens for a while.
addEventListener('pointermove', e => ALL_BOTS.forEach(b => b.look(e.clientX, e.clientY)));
setInterval(() => {
  const now = performance.now();
  ALL_BOTS.forEach(b => { if (b.state === 'default' && !b.noSleep && now - b.last > (b.doze || 22000)) b.setState('sleeping'); });
}, 1500);
function botsLook(look) { Object.assign(BOT_LOOK, look); ALL_BOTS.forEach(b => b.paint()); }
