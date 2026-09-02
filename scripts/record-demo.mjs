/**
 * Record a short screen capture of the tools, aimed at the theming story.
 *
 *   npm run build && node scripts/serve.mjs
 *   SITE=http://localhost:4173 OUT=./recording node scripts/record-demo.mjs
 *
 * It prints wall-clock marks into the raw capture; those are the trim points.
 * Keep the speed-up modest — past about 1.35x the cursor starts to read as
 * jumpy no matter how smooth the source was.
 *
 *   ffmpeg -i raw.webm -vf "trim=3.0:17.6,setpts=PTS-STARTPTS" -an a.mp4
 *   ffmpeg -i raw.webm -vf "trim=23.0:28.7,setpts=PTS-STARTPTS" -an b.mp4
 *   ffmpeg -i a.mp4 -i b.mp4 -filter_complex \
 *     "[0:v][1:v]xfade=transition=fade:duration=.4:offset=14.2,\
 *      setpts=PTS/1.33,fps=30,format=yuv420p[v]" \
 *     -map "[v]" -c:v libx264 -preset slow -crf 19 out.mp4
 *
 * Everything the viewer sees is drawn in the page — cursor, click pulse, zoom —
 * so the browser's own compositor animates it and the capture stays smooth.
 * The zoom is a transform on a wrapper rather than a post-process crop, which
 * keeps text sharp at every scale; the cursor lives inside that wrapper and
 * counter-scales so it stays one size on screen.
 */
import { chromium } from 'playwright';

const W = 1440, H = 900;
const CHROME = process.env.CHROME_PATH;
const SITE = process.env.SITE || 'http://localhost:4173';
const OUT = process.env.OUT || './recording';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY = `
(() => {
  // Idempotent. Calling it twice used to nest a second wrapper inside the
  // first, so the zoom landed on an inner layer while the outer stayed at 1.
  // Unwrap before rebuilding — removing the old wrapper outright would take
  // the whole application with it.
  // Only ever build once per page. Rebuilding tore the app out of its wrapper
  // and put the cursor back off-screen, so every extra call was a visible
  // flinch. After a navigation the element is gone and this runs clean.
  if (document.getElementById('__zoom')) return;
  const app = document.querySelector('.app') || document.body.firstElementChild;
  const zoom = document.createElement('div');
  zoom.id = '__zoom';
  zoom.style.cssText =
    'position:fixed;inset:0;transform-origin:50% 50%;transition:transform 900ms cubic-bezier(.4,0,.2,1);will-change:transform';
  app.parentNode.insertBefore(zoom, app);
  zoom.appendChild(app);
  document.body.style.overflow = 'hidden';

  const cur = document.createElement('div');
  cur.id = '__cursor';
  cur.style.cssText =
    'position:fixed;left:0;top:0;width:26px;height:26px;pointer-events:none;z-index:2147483647;' +
    'transition:transform 620ms cubic-bezier(.33,0,.15,1);will-change:transform';
  cur.innerHTML =
    '<svg viewBox="0 0 26 26" width="26" height="26">' +
    '<path d="M5 2.5 20.5 12.2 13.6 13.6 10.3 20.4Z" fill="#101114" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
    '</svg>';
  zoom.appendChild(cur);

  const ring = document.createElement('div');
  ring.id = '__ring';
  ring.style.cssText =
    'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;' +
    'border:2.5px solid #0078D4;opacity:0;pointer-events:none;z-index:2147483646;will-change:transform,opacity';
  zoom.appendChild(ring);

  const halo = document.createElement('div');
  halo.id = '__halo';
  halo.style.cssText =
    'position:fixed;border-radius:14px;border:2.5px solid #0078D4;box-shadow:0 0 0 6px rgba(0,120,212,.16);' +
    'opacity:0;pointer-events:none;z-index:2147483645;' +
    'transition:opacity 240ms ease,left 380ms cubic-bezier(.4,0,.2,1),top 380ms cubic-bezier(.4,0,.2,1),' +
    'width 380ms cubic-bezier(.4,0,.2,1),height 380ms cubic-bezier(.4,0,.2,1)';
  zoom.appendChild(halo);

  let z = 1, ox = 50, oy = 50;
  window.__z = (scale, x, y) => {
    z = scale;
    if (x != null) { ox = (x / ${W}) * 100; oy = (y / ${H}) * 100; }
    zoom.style.transformOrigin = ox + '% ' + oy + '%';
    zoom.style.transform = 'scale(' + scale + ')';
    if (window.__last) window.__move(window.__last[0], window.__last[1]);
  };
  /* boundingBox() reports where a thing is ON SCREEN. The cursor and the halo
     live inside the scaled wrapper, so a screen coordinate has to be run back
     through the transform or they drift by exactly the zoom factor — which is
     how a highlight meant for the accent swatches landed on a metadata row. */
  const toLocal = (x, y) => {
    const ax = (ox / 100) * ${W}, ay = (oy / 100) * ${H};
    return [(x - ax) / z + ax, (y - ay) / z + ay];
  };

  window.__move = (x, y) => {
    window.__last = [x, y];
    [x, y] = toLocal(x, y);
    cur.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (1 / z) + ')';
    ring.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (1 / z) + ')';
  };
  window.__tap = () => {
    // The press: cursor dips, a ring flares out from under it.
    cur.animate(
      [{ scale: 1 }, { scale: 0.82 }, { scale: 1 }],
      { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)' }
    );
    ring.animate(
      [{ opacity: .85, scale: .35 }, { opacity: 0, scale: 1.5 }],
      { duration: 520, easing: 'cubic-bezier(.2,.6,.3,1)' }
    );
  };
  window.__halo = (x, y, w, h) => {
    if (x == null) { halo.style.opacity = 0; return; }
    const [lx, ly] = toLocal(x, y);
    w = w / z; h = h / z;
    x = lx; y = ly;
    halo.style.left = (x - 6) + 'px';
    halo.style.top = (y - 6) + 'px';
    halo.style.width = (w + 12) + 'px';
    halo.style.height = (h + 12) + 'px';
    halo.style.opacity = 1;
  };
  // Only place the cursor if this page has never had one.
  window.__move(window.__last ? window.__last[0] : ${W * 0.62},
                window.__last ? window.__last[1] : ${H + 60});
})();
`;

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: W, height: H } },
  reducedMotion: 'no-preference',
});
const p = await ctx.newPage();
const T0 = Date.now();
const marks = [];
const mark = (name) => marks.push([name, ((Date.now() - T0) / 1000).toFixed(2)]);
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));

async function overlay() { await p.evaluate(OVERLAY); }
async function move(x, y, ms = 640) { await p.evaluate(([x, y]) => window.__move(x, y), [x, y]); await wait(ms); }
async function tap() { await p.evaluate(() => window.__tap()); await wait(140); }
async function zoom(s, x, y, ms = 920) { await p.evaluate(([s, x, y]) => window.__z(s, x, y), [s, x, y]); await wait(ms); }
async function halo(sel) {
  if (!sel) return p.evaluate(() => window.__halo(null));
  const bb = await (await p.$(sel)).boundingBox();
  await p.evaluate(([x, y, w, h]) => window.__halo(x, y, w, h), [bb.x, bb.y, bb.width, bb.height]);
}
async function at(sel, i = 0) {
  const els = await p.$$(sel);
  const bb = await els[i].boundingBox();
  return [bb.x + bb.width / 2, bb.y + bb.height / 2, els[i]];
}
/** Move to a target, press, then actually click it. */
async function click(sel, i = 0, settle = 700, keepHalo = null) {
  const [x, y, el] = await at(sel, i);
  await move(x, y);
  await tap();
  await el.click();
  await wait(settle);
  if (keepHalo) await halo(keepHalo);
}

mark('start');
await p.goto('${SITE}/index.html');
await p.waitForTimeout(2400);
await overlay();

mark('gallery-ready');
/* 1 — the library, at rest */
await move(W * 0.30, H * 0.42, 700);
await wait(120);

/* 2 — open one icon */
await p.fill('#search', 'word');
await wait(650);
await overlay();
const wordCard = p.locator('.card', { has: p.locator('.name', { hasText: /^Word$/ }) }).first();
const wb = await wordCard.boundingBox();
await move(wb.x + wb.width / 2, wb.y + wb.height / 2, 620);
await tap();
await wordCard.click();
await wait(820);

mark('panel-open');
/* 3 — the styles: one drawing per style, not a filter */
await zoom(1.32, W, H * 0.40, 780);

await halo('.panel .segment');
await wait(220);
await click('.panel .segment button', 1, 620, '.panel .segment');
await click('.panel .segment button', 2, 620, '.panel .segment');
await halo(null);

mark('styles-done');
/* 4 — the accent: a monochrome style takes a Windows accent */
await click('.panel .segment button', 1, 380);
await halo('.accents');
await click('.accents button', 3, 520, '.accents');
await click('.accents button', 5, 620, '.accents');
await halo(null);

mark('accents-done');
/* 5 — the same library, on the other ground */
await zoom(1, W / 2, H / 2, 700);
await click('.theme-switch button[data-mode="dark"]', 0, 760);

mark('dark-done');
/* 6 — and a style applied across a whole set at once */
await click('.app-menu-btn', 0, 420);
await click('.app-menu-pop a[href="customizer.html"]', 0, 200);
await p.waitForTimeout(2600);
mark('customizer-ready');
await overlay();
await move(W * 0.13, H * 0.55, 620);
await p.evaluate(() => window.__z(1.0));
await halo('.mode-card[data-mode="flat"]');
await click('.mode-card[data-mode="flat"]', 0, 1050);
await halo('.mode-card[data-mode="outline"]');
await click('.mode-card[data-mode="outline"]', 0, 1150);
await halo(null);
await move(W * 0.55, H * 0.45, 700);
await wait(500);

mark('end');
console.log(marks.map((m) => m.join(' ')).join('\n'));
console.log('errors:', errs.slice(0, 3));
await ctx.close();
await b.close();
const path = await (async () => null)();
