/**
 * Record a short screen capture of the tools, aimed at the theming story.
 *
 *   npm run build && node scripts/serve.mjs
 *   SITE=http://localhost:4173 OUT=./recording node scripts/record-demo.mjs
 *
 * WHY IT LOOKS THE WAY IT DOES. Several attempts, and only the last diagnosis
 * was right. Written down so it is not rediscovered.
 *
 *   1. No click animation, on purpose. A click is the exact moment the grid
 *      rebuilds, and anything moving through that pause reads as a glitch. The
 *      cursor arriving and stopping is the whole signal, and a larger cursor
 *      does the job better than any press effect did.
 *
 *   2. The pause was mostly NETWORK. The grid fetches a separate SVG per asset
 *      per style per size — the library's whole claim is artwork redrawn rather
 *      than scaled — so a cold style switch is ninety round trips, parses and
 *      DOM inserts inside one frame. The warm-up below turns each switch into a
 *      cache read, which took duplicate frames from 6.9% to about 3%.
 *
 *   3. No zoom, in the page or in post. In the page it was worse than the
 *      thing it competed with: scaling the wrapper re-rasters every card at the
 *      new scale and measured 12.2% duplicates. In post it works, but it has to
 *      crop to do it, and cropping a 1440x900 capture throws away more frame
 *      than the effect is worth.
 *
 *   4. Retime only by a factor that DIVIDES the source rate, and output that
 *      rate. The capture is 25fps; 1.25x into 20fps is exactly one source frame
 *      per output frame. Retiming onto 30 maps each source frame onto roughly
 *      1.6 output frames, unevenly, which is its own judder.
 *
 * Measure rather than trust. Zero duplicate frames is achievable and is the bar:
 *
 *   ffmpeg -i out.mp4 -map 0:v -f framemd5 -c rawvideo - | grep -v '^#' \
 *     | awk '{print $NF}' | uniq -c | sort -rn | head
 *
 *   ffmpeg -i raw.webm -vf "trim=8.6:22.2,setpts=PTS-STARTPTS" -an a.mp4
 *   ffmpeg -i raw.webm -vf "trim=28.2:34.2,setpts=PTS-STARTPTS" -an b.mp4
 *   ffmpeg -i a.mp4 -i b.mp4 -filter_complex \
 *     "[0:v][1:v]xfade=transition=fade:duration=.4:offset=13.2,setpts=PTS/1.25[v]" \
 *     -map "[v]" -r 20 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p out.mp4
 *
 * No search anywhere in the sequence: filtering is the one moment the Gallery
 * can show a card whose artwork has not arrived, and a blank tile in a demo
 * reads as a missing asset.
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
    'position:fixed;left:0;top:0;width:38px;height:38px;pointer-events:none;z-index:2147483647;' +
    'transition:transform 760ms cubic-bezier(.32,0,.16,1);will-change:transform';
  // No press animation of any kind. A click is the exact moment the grid
  // re-rasters, and anything moving through that stall is what reads as a
  // glitch. The cursor arriving and stopping is the whole signal.
  cur.innerHTML =
    '<svg viewBox="0 0 26 26" width="38" height="38">' +
    '<path d="M5 2.5 20.5 12.2 13.6 13.6 10.3 20.4Z" fill="#101114" stroke="#fff" ' +
    'stroke-width="1.7" stroke-linejoin="round" paint-order="stroke"/>' +
    '</svg>';
  zoom.appendChild(cur);

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

const b = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}),
  args: [
    '--num-raster-threads=4',
    '--enable-zero-copy',
    '--disable-lcd-text',
    '--force-device-scale-factor=1',
  ],
});
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
/** Arrive, pause, click. No press animation — see the note in the overlay. */
async function click(sel, i = 0, settle = 700, keepHalo = null) {
  const [x, y, el] = await at(sel, i);
  await move(x, y);
  await wait(180);
  await el.click();
  await wait(settle);
  if (keepHalo) await halo(keepHalo);
}

mark('start');
await p.goto(`${SITE}/index.html`);
await p.waitForTimeout(2600);
/* Warm the cache before anything is recorded that matters. The grid fetches a
   separate SVG per asset per style per size — that is the whole point of the
   library, artwork redrawn rather than scaled — so switching style cold means
   ninety round trips, ninety parses and ninety DOM inserts in one frame. That
   is the stall, not rasterization. Pre-fetching turns each switch into a cache
   read. */
await p.evaluate(async () => {
  const res = await fetch('manifest.json', { cache: 'force-cache' });
  const m = await res.json();
  const paths = [];
  for (const a of m.assets) {
    if (a.collection !== 'product' || a.type !== 'icon') continue;
    for (const style of ['standard', 'outline', 'filled']) {
      for (const size of [48, 32, 24]) {
        const p = a.variants?.[style]?.[size];
        if (p) paths.push(p);
      }
    }
  }
  let i = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < paths.length) await fetch(paths[i++], { cache: 'force-cache' }).catch(() => {});
  }));
  return paths.length;
});
await p.waitForTimeout(600);
await overlay();
mark('gallery-ready');

/* 1 — the library as it sits. No search: every card on screen is real, and
       the grid is what will change in a moment. */
await move(W * 0.24, H * 0.30, 620);
await wait(160);

/* 2 — open the first icon, so the style control has something to point at */
await click('.card', 0, 620);

/* No zoom in the page. Scaling the wrapper forces Chromium to re-raster every
   card at the new scale, and with no GPU that measured worse than the grid
   repaints it was competing with: 12.2% duplicate frames against 0.8%. The
   gentle push is added afterwards in ffmpeg, where it costs the renderer
   nothing. */

/* 3 — the style is a property of the whole library, not of one icon.
       Switching it here redraws every card on screen. */
await halo('.panel .segment');
await wait(200);
await click('.panel .segment button', 1, 1400, '.panel .segment');
await wait(260);
await click('.panel .segment button', 2, 1400, '.panel .segment');
await wait(260);
await halo(null);
await wait(80);

/* 4 — and with a monochrome style up, the accent moves the whole grid too */
await halo('.accents');
await wait(180);
await click('.accents button', 3, 1250, '.accents');
await wait(240);
await click('.accents button', 5, 1250, '.accents');
await wait(240);

await halo(null);
await wait(120);

/* 5 — the same library on the other ground */
await click('.theme-switch button[data-mode="dark"]', 0, 1400);
await wait(300);
mark('dark-done');

/* 6 — through to the Customizer */
await click('.app-menu-btn', 0, 400);
await click('.app-menu-pop a[href="customizer.html"]', 0, 200);
await p.waitForTimeout(2800);
await overlay();
mark('customizer-ready');

/* 7 — one click, and a whole set is re-themed */
await move(W * 0.13, H * 0.52, 700);
await halo('.mode-card[data-mode="flat"]');
await wait(200);
await click('.mode-card[data-mode="flat"]', 0, 1600);
await wait(300);
await halo('.mode-card[data-mode="soft"]');
await click('.mode-card[data-mode="soft"]', 0, 1700);
await wait(300);
await halo(null);
await move(W * 0.52, H * 0.46, 620);
await wait(320);
mark('end');
console.log(marks.map((m) => m.join(' ')).join('\n'));
console.log('errors:', errs.slice(0, 3));
await ctx.close();
await b.close();
const path = await (async () => null)();
