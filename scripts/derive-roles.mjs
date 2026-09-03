/**
 * Give every drawn shape two addresses.
 *
 * An asset needs to be re-themable without a human deciding, per icon, which
 * shapes may move together. Two ways to answer that were put on the table in
 * the 2026-09-02 review, and the decision was to build both and compare rather
 * than pick one now:
 *
 *   part   What the shape IS. The base, the emblem, the glyph. Structural,
 *          semantic, and it cannot be computed from the artwork -- it has to
 *          come from a person or from the Figma layer names. Left null here
 *          until that harvest exists.
 *
 *   role   What COLOR the shape takes. Derived, deterministic, and complete
 *          for every colored asset today. This is what this script computes.
 *
 * Every shape carries one of each, so a theme can select on either axis or on
 * both together. That is the experiment.
 *
 * How a role is derived, and why each step is the way it is:
 *
 *   1. The unit is a FILL, not a color stop. A three-stop gradient is one
 *      member that owns its stops, not three members. Deduping stops instead
 *      of fills was the first version and it produced ramps nine and eleven
 *      members deep that no one could address. Fills collapse 5,725 stops to
 *      1,635 across the library.
 *
 *   2. Two fills that are the same fill become one member. Figma exports the
 *      same paint onto separate shapes constantly, and they are one thing.
 *
 *   3. Invisible paint is dropped. 6.6% of stops in the library are the
 *      fade-out anchors of bloom gradients, at or under 0.05 alpha. They carry
 *      a hue and would otherwise invent roles for paint no one can see.
 *
 *   4. Intentional white and black are HELD: addressable, but outside the
 *      color system and not themed unless a theme asks for them. A white
 *      letterform is meant to stay white in most themes but not all, so this
 *      is a per-theme choice rather than a hard rule.
 *
 *   5. The rest cluster on CHROMATICITY, not on full color distance. This is
 *      the one place the implementation departs from how the requirement was
 *      first stated, and the reason is measurable: lightness has by far the
 *      widest range in OKLab, so clustering on full distance splits an icon
 *      into light shapes and dark shapes rather than into color families, and
 *      then numbering members by brightness inside those groups measures the
 *      same thing twice. Clustering on chromaticity and reserving lightness
 *      for the member number keeps the two numbers independent, and produces
 *      the intended result: Word becomes blues and purples, Excel becomes the
 *      gray paper and the green.
 *
 *   6. Groups rank by how much of the asset they cover; members number by
 *      brightness within a group. Two groups minimum, four maximum.
 *
 * 48 of the 345 colored assets cannot reach two groups on color alone -- they
 * have fewer than two fills once white and black are held out. Those are
 * exactly the assets that prove the part axis is not optional: a two-color
 * theme has nothing to bind to on them without it.
 *
 * Roles are FROZEN into meta.json once derived. Derived indices are unstable
 * by nature: add a darker stop on a redraw and member 2 silently becomes
 * member 3, and every token bound downstream now points somewhere else. So the
 * mapping is stored with a hash of the paint it was derived from, and --check
 * re-derives and fails loudly on drift instead of renumbering behind your back.
 *
 * Usage:
 *   node scripts/derive-roles.mjs [--collection=product] [--dry] [--check]
 *                                 [--k=silhouette|gap] [--report]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=').slice(1).join('=');
const has = (k) => args.includes(`--${k}`);

const ONLY = arg('collection', '');
const KMODE = arg('k', 'silhouette');
const DRY = has('dry');
const CHECK = has('check');
const REPORT = has('report');
const ORDER = arg('order', 'distinct');   // distinct | weight
const BASEFIRST = has('basecolor-first'); // Ada numbered the held group color1

// Tuning. Every one of these is a judgement call, so they live together.
const GHOST_ALPHA = 0.05;   // a stop at or under this alpha is not visible paint
const GHOST_SHARE = 0.004;  // nor is a fill covering under 0.4% of the asset
const SAME_FILL   = 0.04;   // OKLab distance under which two fills are one fill
const HELD_CHROMA = 0.04;   // chroma under which a color is a neutral
const HELD_LIGHT  = 0.95;   // and lightness over which it is an intentional white
const HELD_DARK   = 0.10;   // or under which it is an intentional black
const K_MIN = 2, K_MAX = 4;

/* ------------------------------------------------------------------ color */

const hex = (s) => {
  s = String(s).trim().toLowerCase();
  if (s === 'white') return '#ffffff';
  if (s === 'black') return '#000000';
  if (s[0] !== '#') return null;
  if (s.length === 4) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  return s.slice(0, 7);
};

function oklab(h) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
/* The second address: an ABSOLUTE color name, from a fixed vocabulary shared by
   the whole library. Unlike the first address, which only says how a fill sits
   relative to the other fills in its own icon, this one means the same thing
   everywhere: every forest green in 3,234 assets answers to `green` and every
   sky blue to `cyan`. That is what lets a theme say "all the greens" without
   opening each file.

   Twelve hue bands rather than seven, because ROYGBIV has no word for teal or
   azure and this library is mostly blue. Boundaries are OKLCH hue angles, so
   they track perceived hue rather than the RGB wheel. A lightness qualifier
   carries the difference between forest green and lime; a chroma qualifier
   catches the browns and the dusty shades, which are just dark or desaturated
   oranges and have no hue of their own. */
const HUE_BANDS = [
  [16, 'red'], [44, 'orange'], [74, 'amber'], [100, 'yellow'], [124, 'lime'],
  [152, 'green'], [178, 'teal'], [204, 'cyan'], [240, 'azure'], [275, 'blue'],
  [300, 'violet'], [340, 'magenta'], [360, 'red'],
];
function archetypeOf(lab) {
  const [L, a, b] = lab;
  const C = Math.hypot(a, b);
  if (C < HELD_CHROMA) return L > 0.90 ? 'white' : L < 0.20 ? 'black' : 'gray';
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const band = HUE_BANDS.find(([edge]) => h < edge)?.[1] ?? 'red';
  let q = '';
  if (L >= 0.82) q = 'light-';
  else if (L <= 0.45) q = 'deep-';
  if (C < 0.09) q = q === 'deep-' ? 'muted-deep-' : 'muted-';
  return q + band;
}

const dFull = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dChroma = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]);

/* -------------------------------------------------------------------- svg */

const attrs = (t) => {
  const o = {};
  for (const m of t.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) o[m[1]] = m[2];
  return o;
};

// Rough area, used only to rank groups and to drop paint too small to matter.
// Beziers are flattened to eight segments; exactness is not the job here.
function pathArea(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?[\d.]+(?:e-?\d+)?/g) || [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '', pts = [], area = 0;
  const num = () => parseFloat(toks[i++]);
  const push = (x, y) => pts.push([x, y]);
  const close = () => {
    for (let k = 0; k < pts.length; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[(k + 1) % pts.length];
      area += x1 * y2 - x2 * y1;
    }
    pts = [];
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'M') {
      const x = num(), y = num();
      cx = rel ? cx + x : x; cy = rel ? cy + y : y; sx = cx; sy = cy; push(cx, cy);
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L') {
      const x = num(), y = num(); cx = rel ? cx + x : x; cy = rel ? cy + y : y; push(cx, cy);
    } else if (C === 'H') { const x = num(); cx = rel ? cx + x : x; push(cx, cy); }
    else if (C === 'V') { const y = num(); cy = rel ? cy + y : y; push(cx, cy); }
    else if (C === 'C') {
      const v = [num(), num(), num(), num(), num(), num()];
      const [x1, y1, x2, y2, x3, y3] = v.map((n, k) => (rel ? (k % 2 ? cy : cx) + n : n));
      for (let t = 1; t <= 8; t++) {
        const u = t / 8, w = 1 - u;
        push(w*w*w*cx + 3*w*w*u*x1 + 3*w*u*u*x2 + u*u*u*x3,
             w*w*w*cy + 3*w*w*u*y1 + 3*w*u*u*y2 + u*u*u*y3);
      }
      cx = x3; cy = y3;
    } else if (C === 'Z') { push(sx, sy); close(); cx = sx; cy = sy; }
    else {
      const n = { A: 7, Q: 4, S: 4, T: 2 }[C] || 2;
      const v = []; for (let k = 0; k < n; k++) v.push(num());
      const x = v[n - 2], y = v[n - 1];
      cx = rel ? cx + x : x; cy = rel ? cy + y : y; push(cx, cy);
    }
  }
  close();
  return Math.abs(area) / 2;
}

// One entry per painted shape, in document order, with the fill resolved to
// its stops. Document order is the shape index, and it is the join key between
// this file, the SVG and whatever assigns parts later.
export function paintsOf(svg) {
  const grads = {};
  for (const m of svg.matchAll(/<(linear|radial)Gradient\b([^>]*)>([\s\S]*?)<\/\1Gradient>/g)) {
    grads[attrs(m[2]).id] = [...m[3].matchAll(/<stop\b([^>]*)\/?>/g)].map((s) => {
      const a = attrs(s[1]);
      return { color: hex(a['stop-color'] ?? '#000000'), alpha: parseFloat(a['stop-opacity'] ?? '1') };
    });
  }
  const out = [];
  let i = 0;
  for (const m of svg.matchAll(/<(path|rect|circle|ellipse|polygon)\b([^>]*?)\/?>/g)) {
    const a = attrs(m[2]);
    if (!a.fill || a.fill === 'none') continue;
    const idx = i++;
    let area = 0;
    if (m[1] === 'path' && a.d) area = pathArea(a.d);
    else if (m[1] === 'rect') area = parseFloat(a.width || 0) * parseFloat(a.height || 0);
    else if (m[1] === 'circle') area = Math.PI * parseFloat(a.r || 0) ** 2;
    else if (m[1] === 'ellipse') area = Math.PI * parseFloat(a.rx || 0) * parseFloat(a.ry || 0);
    const alpha = parseFloat(a['fill-opacity'] ?? '1');
    const g = a.fill.match(/^url\(#(.+)\)$/);
    if (g && grads[g[1]]) {
      out.push({ shape: idx, area, alpha, stops: grads[g[1]].filter((s) => s.color) });
    } else {
      const c = hex(a.fill);
      if (c) out.push({ shape: idx, area, alpha, stops: [{ color: c, alpha: 1 }] });
      else out.push({ shape: idx, area, alpha, token: a.fill, stops: [] });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ roles */

export function derive(paints, kmode = KMODE) {
  const literal = paints.filter((p) => p.stops.length);
  if (!literal.length) return null;

  const total = literal.reduce((n, p) => n + p.area * p.alpha, 0) || 1;
  const visible = literal
    .map((p) => ({ ...p, stops: p.stops.filter((s) => s.alpha * p.alpha > GHOST_ALPHA) }))
    .filter((p) => p.stops.length && (p.area * p.alpha) / total > GHOST_SHARE);
  for (const p of visible) {
    const labs = p.stops.map((s) => oklab(s.color));
    p.lab = [0, 1, 2].map((i) => labs.reduce((n, l) => n + l[i], 0) / labs.length);
    p.w = p.area * p.alpha;
  }

  // the same fill in two places is one member
  const members = [];
  for (const p of [...visible].sort((a, b) => b.w - a.w)) {
    const same = members.find(
      (m) => m.stops.length === p.stops.length &&
             m.stops.every((s, i) => dFull(oklab(s.color), oklab(p.stops[i].color)) < SAME_FILL)
    );
    if (same) { same.w += p.w; same.shapes.push(p.shape); }
    else members.push({ ...p, shapes: [p.shape] });
  }

  const isHeld = (m) => m.stops.every((s) => {
    const [L, a, b] = oklab(s.color);
    return Math.hypot(a, b) < HELD_CHROMA && (L > HELD_LIGHT || L < HELD_DARK);
  });
  const held = members.filter(isHeld).sort((a, b) => b.lab[0] - a.lab[0]);
  const pool = members.filter((m) => !isHeld(m));

  // average-link agglomeration on chromaticity, keeping every cut
  let cl = pool.map((m) => ({ members: [m] }));
  const link = (A, B) => {
    let s = 0, n = 0;
    for (const x of A.members) for (const y of B.members) { s += dChroma(x.lab, y.lab); n++; }
    return s / n;
  };
  const trace = [];
  while (cl.length > 1) {
    let best = null;
    for (let i = 0; i < cl.length; i++)
      for (let j = i + 1; j < cl.length; j++) {
        const d = link(cl[i], cl[j]);
        if (!best || d < best.d) best = { i, j, d };
      }
    trace.push({ k: cl.length, cut: best.d, snap: cl.map((c) => c.members.slice()) });
    cl[best.i] = { members: cl[best.i].members.concat(cl[best.j].members) };
    cl.splice(best.j, 1);
  }
  trace.push({ k: 1, cut: Infinity, snap: cl.map((c) => c.members.slice()) });

  // Choosing k. Largest-gap always answers 2, because the last merge into a
  // single cluster is always the biggest jump; silhouette tends the other way
  // and will split two shades of one hue. Neither is right everywhere, which
  // is why the criterion is a flag and not a constant.
  const silhouette = (snap) => {
    const all = snap.flat();
    if (all.length < 3 || snap.length < 2) return -1;
    let tot = 0;
    snap.forEach((g, gi) => {
      for (const x of g) {
        const own = g.filter((y) => y !== x);
        const a = own.length ? own.reduce((n, y) => n + dChroma(x.lab, y.lab), 0) / own.length : 0;
        let b = Infinity;
        snap.forEach((h, hi) => {
          if (hi === gi) return;
          b = Math.min(b, h.reduce((n, y) => n + dChroma(x.lab, y.lab), 0) / h.length);
        });
        tot += ((b - a) / Math.max(a, b) || 0) * x.w;
      }
    });
    return tot / (all.reduce((n, x) => n + x.w, 0) || 1);
  };

  const opts = trace.filter((t) => t.k >= K_MIN && t.k <= K_MAX);
  let chosen;
  if (!opts.length) chosen = trace[0];
  else if (typeof kmode === 'number') {
    // Force a cut, for side-by-side review. Falls back to the nearest available.
    chosen = opts.find((o) => o.k === kmode) || opts.sort((a, b) => Math.abs(a.k - kmode) - Math.abs(b.k - kmode))[0];
  }
  else if (kmode === 'gap') {
    for (const o of opts) { const n = trace.find((t) => t.k === o.k - 1); o.score = n ? n.cut - o.cut : 0; }
    chosen = opts.sort((a, b) => b.score - a.score || a.k - b.k)[0];
  } else {
    for (const o of opts) o.score = silhouette(o.snap);
    chosen = opts.sort((a, b) => b.score - a.score || a.k - b.k)[0];
  }

  /* ORDERING. This is the part that carries the design intent, and it is not
     ranking by size.

     A theme walks this list and hands out its colors in order, folding whatever
     is left into the last one. So the list has to be ordered by how DISTINCT a
     group is from the others: the group that stands furthest apart takes the
     first color and keeps its separation, and groups that were already similar
     to each other fall to the end and collapse together, which is what the
     original artwork was saying about them anyway.

     The consequence is worth stating plainly: cutting too FINE is now safe,
     because surplus groups merge back at the tail. Cutting too COARSE is not,
     because a theme cannot split what was already merged. When in doubt, cut
     higher. */
  const spread = (g, all) => {
    const others = all.filter((x) => x !== g);
    if (!others.length) return 0;
    let sum = 0, n = 0;
    for (const o of others)
      for (const x of g) for (const y of o) { sum += dChroma(x.lab, y.lab); n++; }
    return sum / n;
  };

  const snaps = chosen.snap.map((ms) => [...ms].sort((a, b) => b.lab[0] - a.lab[0]));
  const ranked = snaps
    .map((ms) => ({
      members: ms,
      w: ms.reduce((n, m) => n + m.w, 0),
      spread: spread(ms, snaps),
    }))
    .sort((a, b) => (ORDER === 'weight' ? b.w - a.w : b.spread - a.spread));

  // Held fills are a group like any other, marked rather than segregated, so a
  // theme filters on the marker instead of remembering a second list.
  const heldGroup = held.length ? [{ members: held, w: 0, spread: 0, basecolor: true }] : [];
  const ordered = BASEFIRST ? heldGroup.concat(ranked) : ranked.concat(heldGroup);

  const shapeRole = {}, shapeArch = {};
  const out = { k: ranked.length, groups: [], archetypes: [], floorMissed: pool.length < K_MIN };

  ordered.forEach((g, gi) => {
    const gid = `color${gi + 1}`;
    const grp = { id: gid, basecolor: !!g.basecolor, members: [] };
    if (!g.basecolor) grp.spread = Math.round(g.spread * 1000) / 1000;
    g.members.forEach((m, mi) => {
      const id = g.basecolor ? `${gid}.basecolor.part${mi + 1}` : `${gid}.part${mi + 1}`;
      grp.members.push({ id, stops: m.stops.map((s) => s.color), shapes: [...m.shapes].sort((a, b) => a - b) });
      for (const s of m.shapes) shapeRole[s] = id;
    });
    out.groups.push(grp);
  });

  // The second address, over the same members. Same shape, different question.
  const byArch = new Map();
  for (const g of ordered) for (const m of g.members) {
    const name = archetypeOf(m.lab);
    (byArch.get(name) ?? byArch.set(name, []).get(name)).push(m);
  }
  for (const [name, ms] of [...byArch].sort((a, b) => a[0].localeCompare(b[0]))) {
    ms.sort((a, b) => b.lab[0] - a.lab[0]);
    const grp = { id: name, members: [] };
    ms.forEach((m, mi) => {
      const id = `${name}.part${mi + 1}`;
      grp.members.push({ id, stops: m.stops.map((s) => s.color), shapes: [...m.shapes].sort((a, b) => a - b) });
      for (const s of m.shapes) shapeArch[s] = id;
    });
    out.archetypes.push(grp);
  }

  /* Two addresses per shape, which is the whole proposal. `role` says how this
     shape sits relative to the rest of THIS icon; `archetype` says what color it
     is in terms the whole library shares. `part` is a structural name and is not
     part of either scheme -- the slot stays for annotation, unfilled. */
  out.shapes = paints.map((p) => ({
    i: p.shape,
    role: shapeRole[p.shape] ?? null,
    archetype: shapeArch[p.shape] ?? null,
    part: null,
  }));
  out.stops = literal.reduce((n, p) => n + p.stops.length, 0);
  out.fills = members.length;
  return out;
}

// Hash the paint the roles were derived from, not the whole file. Whitespace,
// gradient ids and viewBox churn should not invalidate a mapping; a changed
// color should.
export const paintHash = (paints) =>
  createHash('sha256')
    .update(JSON.stringify(paints.map((p) => [p.shape, p.stops.map((s) => [s.color, s.alpha]), p.alpha])))
    .digest('hex')
    .slice(0, 16);

/* ------------------------------------------------------------------- walk */

export function metas(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) metas(p, out);
    else if (e.name === 'meta.json') out.push(p);
  }
  return out;
}

// Only walk when run directly, so a comparison script can import the derivation.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const all = metas(join(ROOT, 'assets'));
  const tally = { seen: 0, colored: 0, written: 0, unchanged: 0, drift: [], floorMissed: [], k: {}, depth: {} };

  for (const file of all) {
    const meta = JSON.parse(readFileSync(file, 'utf8'));
    if (ONLY && meta.collection !== ONLY) continue;
    tally.seen++;

    // Derive from the largest Standard the asset has: it is the authored one,
    // and the one with the most paint to reason about.
    const dir = dirname(file);
    const svgs = readdirSync(dir).filter((f) => f.endsWith('.svg'));
    const pick = (pre) =>
      svgs.filter((f) => f.startsWith(pre))
          .sort((a, b) => parseInt(b.match(/(\d+)\.svg/)?.[1] || 0) - parseInt(a.match(/(\d+)\.svg/)?.[1] || 0))[0];
    const from = pick('standard') || pick('color') || pick('filled') || svgs[0];
    if (!from) continue;

    const paints = paintsOf(readFileSync(join(dir, from), 'utf8'));
    const roles = derive(paints);
    if (!roles) continue;           // currentColor only: nothing to address
    tally.colored++;

    const hash = paintHash(paints);
    const next = {
      from,
      derivedBy: `chromaticity/${KMODE}, ordered by ${ORDER}`,
      k: roles.k,
      groups: roles.groups,
      archetypes: roles.archetypes,
      shapes: roles.shapes,
      hash,
    };

    tally.k[roles.k] = (tally.k[roles.k] || 0) + 1;
    const depth = Math.max(0, ...roles.groups.filter((g) => !g.basecolor).map((g) => g.members.length));
    tally.depth[depth] = (tally.depth[depth] || 0) + 1;
    if (roles.floorMissed) tally.floorMissed.push(meta.id);

    const prev = meta.roles;
    if (prev && prev.hash !== hash) {
      // The artwork moved under a frozen mapping. Say so; do not renumber.
      tally.drift.push({ id: meta.id, was: prev.hash, now: hash, from: prev.from });
      if (CHECK) continue;
    }
    if (prev && prev.hash === hash && JSON.stringify(prev) === JSON.stringify({ ...prev, ...next })) {
      tally.unchanged++;
      continue;
    }
    if (CHECK) continue;

    meta.roles = next;
    if (!DRY) writeFileSync(file, JSON.stringify(meta, null, 2) + '\n');
    tally.written++;
  }

  /* ----------------------------------------------------------------- report */

  const pad = (n) => String(n).padStart(5);
  console.log(`\nderive-roles  ${KMODE}, ordered by ${ORDER}${ONLY ? `  collection=${ONLY}` : ''}${DRY ? '  (dry)' : ''}${CHECK ? '  (check)' : ''}`);
  console.log(`  ${pad(tally.seen)} assets seen`);
  console.log(`  ${pad(tally.colored)} carry literal color`);
  console.log(`  ${pad(tally.written)} written   ${pad(tally.unchanged)} unchanged`);
  console.log(`  groups: ` + Object.entries(tally.k).sort().map(([k, n]) => `${k}->${n}`).join('  '));
  console.log(`  deepest group: ` + Object.entries(tally.depth).sort((a,b)=>a[0]-b[0]).map(([k, n]) => `${k}->${n}`).join('  '));

  if (tally.floorMissed.length) {
    console.log(`\n  ${tally.floorMissed.length} cannot reach two groups on color alone.`);
    console.log(`  A theme with two accents has only one target on these:`);
    console.log(`    ` + tally.floorMissed.slice(0, 12).join(', ') + (tally.floorMissed.length > 12 ? ', ...' : ''));
  }

  if (tally.drift.length) {
    console.log(`\n  ${tally.drift.length} asset(s) drifted from a frozen mapping:`);
    for (const d of tally.drift.slice(0, 20)) console.log(`    ${d.id}  ${d.from}  ${d.was} -> ${d.now}`);
    console.log(`\n  Roles were NOT renumbered. Re-run without --check to re-freeze,`);
    console.log(`  after confirming nothing downstream is bound to the old numbers.`);
    process.exit(1);
  }

  if (REPORT) {
    const rows = [];
    for (const file of all) {
      const m = JSON.parse(readFileSync(file, 'utf8'));
      if (!m.roles) continue;
      const arch = {};
      for (const a of m.roles.archetypes) for (const am of a.members)
        for (const sh of am.shapes) arch[sh] = am.id;
      for (const g of m.roles.groups) for (const mm of g.members)
        rows.push([m.id, mm.id, arch[mm.shapes[0]] ?? '', mm.stops.join('>'), mm.shapes.join('|')].join('\t'));
    }
    writeFileSync(join(ROOT, 'roles-report.tsv'), 'asset\trole\tarchetype\tstops\tshapes\n' + rows.join('\n') + '\n');
    console.log(`\n  roles-report.tsv  ${rows.length} rows`);
  }
  console.log('');
}
