/**
 * Record a short screen capture of the tools, aimed at the theming story.
 *
 *   npm run build && node scripts/serve.mjs
 *   SITE=http://localhost:4173 OUT=./recording node scripts/record-demo.mjs
 *
 * No search anywhere in the sequence, deliberately. Filtering the grid is the
 * one moment the Gallery can show a card whose artwork has not been fetched
 * yet, and a blank tile in a demo reads as a missing asset.
 *
 * The point of the Gallery half is that style and accent are properties of the
 * whole library rather than of the icon you happen to have open, so every card
 * on screen redraws at once. Opening one icon is just what gives the control
 * something to point at.
 *
 * FRAME PACING, which is the part that took three attempts. The capture is a
 * clean 25fps. Speeding it up and then asking for 30fps maps each source frame
 * onto roughly 1.6 output frames, unevenly, and the result reads as a cursor
 * that skips — even though nothing in the source stutters. Retime by a factor
 * that divides the source rate and output THAT rate, so every source frame
 * lands on exactly one output frame:
 *
 *   1.25x -> 20fps      exact, what this uses
 *   1.00x -> 25fps      exact, if you would rather not retime at all
 *
 * Verify it rather than trusting it — every delta should be identical:
 *
 *   ffprobe -select_streams v -show_entries frame=pts_time -of csv=p=0 out.mp4
 *
 *   ffmpeg -i raw.webm -vf "trim=3.05:16.95,setpts=PTS-STARTPTS" -an a.mp4
 *   ffmpeg -i raw.webm -vf "trim=22.6:28.05,setpts=PTS-STARTPTS" -an b.mp4
 *   ffmpeg -i a.mp4 -i b.mp4 -filter_complex \
 *     "[0:v][1:v]xfade=transition=fade:duration=.4:offset=13.5,setpts=PTS/1.25[v]" \
 *     -map "[v]" -r 20 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p out.mp4
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
const OUT = process.env.OUT || './recording';
const SITE = process.env.SITE || 'http://localhost:4173';
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
await p.goto(`${SITE}/index.html`);
await p.waitForTimeout(2600);
await overlay();
mark('gallery-ready');

/* 1 — the library as it sits. No search: every card on screen is real, and
       the grid is what will change in a moment. */
await move(W * 0.24, H * 0.30, 620);
await wait(160);

/* 2 — open the first icon, so the style control has something to point at */
await click('.card', 0, 520);

/* 3 — the style is a property of the whole library, not of one icon.
       Switching it here redraws every card on screen. */
await halo('.panel .segment');
await wait(200);
await click('.panel .segment button', 1, 820, '.panel .segment');
await click('.panel .segment button', 2, 870, '.panel .segment');
await halo(null);
await wait(80);

/* 4 — and with a monochrome style up, the accent moves the whole grid too */
await halo('.accents');
await wait(180);
await click('.accents button', 3, 560, '.accents');
await click('.accents button', 5, 560, '.accents');
await click('.accents button', 7, 620, '.accents');
await halo(null);
await wait(120);

/* 5 — the same library on the other ground */
await click('.theme-switch button[data-mode="dark"]', 0, 820);
mark('dark-done');

/* 6 — through to the Customizer */
await click('.app-menu-btn', 0, 400);
await click('.app-menu-pop a[href="customizer.html"]', 0, 200);
await p.waitForTimeout(2800);
await overlay();
mark('customizer-ready');

/* 7 — one click, and a whole set is re-themed */
await move(W * 0.13, H * 0.52, 620);
await halo('.mode-card[data-mode="flat"]');
await wait(200);
await click('.mode-card[data-mode="flat"]', 0, 900);
await halo('.mode-card[data-mode="outline"]');
await click('.mode-card[data-mode="outline"]', 0, 1000);
await halo(null);
await move(W * 0.52, H * 0.46, 620);
await wait(320);
mark('end');
console.log(marks.map((m) => m.join(' ')).join('\n'));
console.log('errors:', errs.slice(0, 3));
await ctx.close();
await b.close();
const path = await (async () => null)();
