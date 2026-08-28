#!/usr/bin/env node
/**
 * Imports artwork straight from a Figma library file. No manual exporting.
 *
 * Two passes, deliberately. With thousands of components you do not want a
 * script guessing at your file's structure and writing ten thousand files based
 * on the guess — you want to SEE the structure, agree the mapping, then import.
 *
 *   1. npm run figma:survey
 *        Reads the file and reports what is actually in it: pages, sections,
 *        component sets, variant property names and their values, naming
 *        conventions. Writes a draft figma.config.json and a full
 *        figma-survey.json. Touches nothing in assets/.
 *
 *   2. Edit figma.config.json — map each page (or page › section) to a
 *      collection, confirm the size and theme property names.
 *
 *   3. npm run figma:plan     what would be written, nothing touched
 *   4. npm run figma:import   render and write
 *
 * Auth: set FIGMA_TOKEN in your environment. Never pass it as a command-line
 * argument — that lands in your shell history — and never commit it.
 *
 *   export FIGMA_TOKEN="figd_..."          # Settings > Security > Personal access tokens
 *   export FIGMA_FILE_KEY="abc123..."      # or pass --file=abc123
 *
 * The file key is the segment after /design/ or /file/ in the URL:
 *   figma.com/design/ABC123xyz/My-Library  ->  ABC123xyz
 *
 * WHAT IT KEEPS
 *
 * Every size of every theme, written as variants[theme][size]. Windows artwork
 * is redrawn per size — a 16px icon is a different drawing from the 48px one,
 * not a scaled copy — so collapsing to one drawing per theme throws away most
 * of what the library ships. An earlier version of this script did exactly
 * that; it was rewritten once the product icons proved the point.
 */
import { mkdir, writeFile, readFile, stat, readdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.figma.com/v1';
const CONFIG_PATH = join(ROOT, 'figma.config.json');
const SURVEY_PATH = join(ROOT, 'figma-survey.json');

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = arg('file') || process.env.FIGMA_FILE_KEY;
const LIMIT = Number(arg('limit')) || Infinity;
const ONLY = arg('only');
const PLAN = arg('plan');

const exists = (p) => stat(p).then(() => true, () => false);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* A leading marker like "*Retired* Desktop folder" is a lifecycle signal, not
   part of the name. Seen in the wild in this library's own Figma file. */
const RETIRED = /^\s*\*?\s*(retired|deprecated|do not use|dnu)\s*\*?\s*[-–—:]?\s*/i;
const isRetired = (name) => RETIRED.test(name);
const cleanName = (name) => name.replace(RETIRED, '').trim();

/* ------------------------------------------------------------------ */
/* Figma API                                                           */
/* ------------------------------------------------------------------ */

async function figma(path) {
  const res = await fetch(`${API}${path}`, { headers: { 'X-Figma-Token': TOKEN } });
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after') || 30);
    console.log(`  rate limited, waiting ${wait}s…`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return figma(path);
  }
  if (!res.ok) throw new Error(`Figma API ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Walk the tree carrying the page and the nearest section/frame heading. */
function* walk(node, page = null, section = null) {
  const nextPage = node.type === 'CANVAS' ? node.name : page;
  const nextSection = node.type === 'SECTION' ? node.name : node.type === 'CANVAS' ? null : section;
  yield { node, page: nextPage, section: nextSection };
  for (const child of node.children || []) yield* walk(child, nextPage, nextSection);
}

/** Figma encodes variants as "Size=24, Theme=Color" in the child's name. */
const parseVariant = (name) =>
  Object.fromEntries(
    name
      .split(',')
      .map((part) => part.split('='))
      .filter((pair) => pair.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()])
  );

function collectComponentSets(document) {
  const sets = [];
  const insideSet = new Set();

  for (const { node, page, section } of walk(document)) {
    if (node.type === 'COMPONENT_SET') {
      for (const child of node.children || []) insideSet.add(child.id);
      sets.push({
        id: node.id,
        name: node.name,
        page,
        section,
        description: (node.description || '').trim(),
        variants: (node.children || []).map((c) => ({ id: c.id, name: c.name, props: parseVariant(c.name) })),
      });
    }
  }
  // Standalone components — real assets that just have no variants.
  for (const { node, page, section } of walk(document)) {
    if (node.type === 'COMPONENT' && !insideSet.has(node.id) && !node.name.includes('=')) {
      sets.push({
        id: node.id,
        name: node.name,
        page,
        section,
        description: (node.description || '').trim(),
        variants: [{ id: node.id, name: node.name, props: {} }],
      });
    }
  }
  return sets;
}

/* ------------------------------------------------------------------ */
/* Survey                                                              */
/* ------------------------------------------------------------------ */

function tally(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const scopeOf = (s) => (s.section ? `${s.page} › ${s.section}` : s.page || '(no page)');

async function survey() {
  console.log(`Reading Figma file ${FILE_KEY}…`);
  const file = await figma(`/files/${FILE_KEY}`);
  const sets = collectComponentSets(file.document);

  if (!sets.length) {
    console.log('\nNo components found. Check the file key, and that the token can read this file.\n');
    return;
  }

  const scopes = tally(sets.map(scopeOf));
  const propNames = tally(sets.flatMap((s) => s.variants.flatMap((v) => Object.keys(v.props))));
  const propValues = Object.fromEntries(
    propNames.map(([prop]) => [
      prop,
      tally(sets.flatMap((s) => s.variants.map((v) => v.props[prop]).filter(Boolean))).slice(0, 14),
    ])
  );

  const drawings = sets.reduce((n, s) => n + s.variants.length, 0);
  const retired = sets.filter((s) => isRetired(s.name));

  console.log(`\n${sets.length} component sets, ${drawings} individual drawings\n`);

  console.log('SCOPES  (map each of these to a collection in figma.config.json)');
  for (const [scope, count] of scopes) console.log(`  ${String(count).padStart(5)}  ${scope}`);

  console.log('\nVARIANT PROPERTIES');
  if (!propNames.length) console.log('  (none — components have no variants)');
  for (const [prop, count] of propNames) {
    console.log(`  ${String(count).padStart(5)}  ${prop}: ${propValues[prop].map(([v, n]) => `${v}(${n})`).join('  ')}`);
  }

  console.log(`\nDESCRIPTIONS  ${sets.filter((s) => s.description).length}/${sets.length} carry one`);
  if (retired.length) {
    console.log(`\nRETIRED MARKERS  ${retired.length} names look retired, e.g.`);
    for (const s of retired.slice(0, 5)) console.log(`  ${s.name}`);
    console.log('  These import as draft with a note; give them a replacedBy to deprecate properly.');
  }

  console.log('\nSAMPLE');
  for (const s of sets.slice(0, 10)) {
    console.log(`  ${scopeOf(s).padEnd(34)} ${s.name}  [${s.variants.length}]`);
  }

  await writeFile(SURVEY_PATH, JSON.stringify({ fileKey: FILE_KEY, name: file.name, sets }, null, 2));

  const guess = (cands) => propNames.map(([p]) => p).find((p) => cands.includes(p.toLowerCase())) || null;
  const draft = {
    fileKey: FILE_KEY,
    sizeProperty: guess(['size']),
    themeProperty: guess(['theme', 'style']),
    themeMap: { Color: 'standard', Regular: 'outline', Filled: 'filled' },
    /* Map each scope to a collection id, or null to skip it. Collections must
       already exist in the schema enum and in GROUPS in build-manifest.mjs. */
    collections: Object.fromEntries(scopes.map(([scope]) => [scope, null])),
    /* Which collections are illustrations rather than icons. */
    illustrationCollections: ['oobe', 'windows', 'fluent'],
  };

  if (await exists(CONFIG_PATH)) {
    console.log(`\nfigma.config.json exists — left alone. Scopes above are what it needs to cover.`);
  } else {
    await writeFile(CONFIG_PATH, JSON.stringify(draft, null, 2) + '\n');
    console.log('\nWrote figma.config.json.');
  }
  console.log(`Wrote figma-survey.json (${sets.length} sets).\n`);
  console.log('NEXT: fill in the `collections` map, then `npm run figma:plan`.\n');
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

/** Ask Figma for SVG render URLs, in batches the endpoint will accept. */
async function renderUrls(ids, fileKey = FILE_KEY) {
  const out = {};
  const BATCH = 60;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    console.log(`  rendering ${i + 1}–${Math.min(i + BATCH, ids.length)} of ${ids.length}…`);
    const res = await figma(`/images/${fileKey}?ids=${batch.join(',')}&format=svg`);
    Object.assign(out, res.images || {});
  }
  return out;
}

const namespaceIds = (svg, prefix) =>
  svg
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);

function prepare(svg, { prefix, label }) {
  let out = svg.trim().replace(/^﻿/, '').replace(/<\?xml[^>]*\?>\s*/g, '');
  out = namespaceIds(out, prefix);
  if (!out.includes('role="img"')) out = out.replace('<svg ', '<svg role="img" ');
  if (!out.includes('aria-label=')) {
    out = out.replace('<svg ', `<svg aria-label="${label.replace(/"/g, '&quot;')}" `);
  }
  return out + '\n';
}

/** Read the artwork's own palette instead of inventing one. */
function extractColors(svg) {
  const found = [...(svg || '').matchAll(/(?:stop-color|fill)="(#[0-9A-Fa-f]{6})"/g)]
    .map((m) => m[1].toUpperCase())
    .filter((c) => !['#FFFFFF', '#000000'].includes(c));
  const unique = [...new Set(found)];
  return { primary: unique[0] || '#0078D4', secondary: unique[unique.length - 1] || unique[0] || '#8764B8' };
}

async function importAssets() {
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const dryRun = has('--dry-run');
  const illustrations = new Set(config.illustrationCollections || []);

  const survey = (await exists(SURVEY_PATH))
    ? JSON.parse(await readFile(SURVEY_PATH, 'utf8'))
    : { sets: collectComponentSets((await figma(`/files/${FILE_KEY}`)).document) };

  const plan = [];
  const skipped = [];

  for (const set of survey.sets) {
    const scope = scopeOf(set);
    const collection = config.collections?.[scope] ?? config.collections?.[set.page];
    if (!collection) {
      skipped.push({ name: set.name, scope, why: 'scope not mapped to a collection' });
      continue;
    }
    if (ONLY && collection !== ONLY) continue;

    /* EVERY size of every theme. The point of shipping six sizes is that they
       are six different drawings. */
    const byTheme = {};
    for (const variant of set.variants) {
      const rawTheme = config.themeProperty ? variant.props[config.themeProperty] : null;
      const theme = config.themeMap?.[rawTheme] || (rawTheme ? slug(rawTheme) : 'standard');
      if (!['standard', 'outline', 'filled'].includes(theme)) continue;
      const rawSize = config.sizeProperty ? variant.props[config.sizeProperty] : null;
      const size = Number(rawSize);
      const key = Number.isInteger(size) && size > 0 ? String(size) : 'any';
      (byTheme[theme] ||= {})[key] = variant.id;
    }

    const themes = Object.keys(byTheme);
    if (!themes.length) {
      skipped.push({ name: set.name, scope, why: 'no recognisable theme variants' });
      continue;
    }

    const sizes = [
      ...new Set(themes.flatMap((t) => Object.keys(byTheme[t]).filter((k) => k !== 'any').map(Number))),
    ].sort((a, b) => a - b);

    const name = cleanName(set.name);
    const key = slug(name);
    if (!key) {
      // A name of only punctuation or emoji slugs to nothing, which would
      // produce the id "collection." and fail the schema at the very end of a
      // long import. Catch it here, by name, while it is still fixable.
      skipped.push({ name: set.name, scope, why: 'name does not slugify to anything usable' });
      continue;
    }
    plan.push({
      id: `${collection}.${key}`,
      name,
      retired: isRetired(set.name),
      type: illustrations.has(collection) ? 'illustration' : 'icon',
      collection,
      byTheme,
      themes,
      sizes: sizes.length ? sizes : [24],
      nodeId: set.id,
      description: set.description || undefined,
    });
    if (plan.length >= LIMIT) break;
  }

  /* Report before anything destructive. */
  const byCollection = plan.reduce((a, p) => ({ ...a, [p.collection]: (a[p.collection] || 0) + 1 }), {});
  const drawings = plan.reduce((n, p) => n + p.themes.reduce((m, t) => m + Object.keys(p.byTheme[t]).length, 0), 0);

  console.log(`\nPlan: ${plan.length} assets, ${drawings} drawings`);
  for (const [c, n] of Object.entries(byCollection)) console.log(`  ${String(n).padStart(5)}  ${c}`);

  const dupes = plan.map((p) => p.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length) {
    console.error(`\n✗ ${new Set(dupes).size} duplicate ids, e.g. ${[...new Set(dupes)].slice(0, 6).join(', ')}`);
    console.error('  Two component sets slugify the same. Rename in Figma, or split them across collections.\n');
    process.exit(1);
  }

  const retired = plan.filter((p) => p.retired);
  if (retired.length) {
    console.log(`\n${retired.length} marked retired upstream — imported as draft with a note.`);
    console.log('  Deprecating properly needs a replacedBy, and inventing one would be worse than leaving it.');
  }

  if (skipped.length) {
    console.log(`\nSkipping ${skipped.length}:`);
    const why = tally(skipped.map((s) => s.why));
    for (const [reason, n] of why) console.log(`  ${String(n).padStart(5)}  ${reason}`);
  }

  if (dryRun) {
    await writeFile(join(ROOT, 'figma-import-report.json'), JSON.stringify({ plan, skipped }, null, 2));
    console.log('\nDry run — nothing written. Full plan in figma-import-report.json\n');
    return;
  }

  /* Render, then write. */
  const allIds = [...new Set(plan.flatMap((p) => p.themes.flatMap((t) => Object.values(p.byTheme[t]))))];
  console.log(`\nAsking Figma to render ${allIds.length} nodes as SVG…`);
  const urls = await renderUrls(allIds);

  const today = new Date().toISOString().slice(0, 10);
  let written = 0;
  const failures = [];

  for (const asset of plan) {
    const slugName = asset.id.split('.').slice(1).join('.');
    const dir = `assets/${asset.type}s/${asset.collection}/${slugName}`;
    const variants = {};
    let sample = '';

    for (const theme of asset.themes) {
      for (const [size, nodeId] of Object.entries(asset.byTheme[theme])) {
        const url = urls[nodeId];
        if (!url) {
          failures.push(`${asset.id} ${theme}/${size}: Figma returned no render URL`);
          continue;
        }
        const svg = await (await fetch(url)).text();
        await mkdir(join(ROOT, dir), { recursive: true });
        const rel = `${dir}/${theme}-${size}.svg`;
        await writeFile(
          join(ROOT, rel),
          prepare(svg, { prefix: `${asset.id.replace(/\./g, '-')}-${theme}-${size}`, label: `${asset.name} ${theme} ${size}` }),
          'utf8'
        );
        (variants[theme] ||= {})[size] = rel;
        if (!sample) sample = svg;
      }
    }

    if (!Object.keys(variants).length) continue;

    // Drop artwork the new meta no longer references. When real drawings land
    // on top of a generated placeholder the old standard/outline/filled files are
    // still sitting there, referenced by nothing — dead weight that reads as
    // real artwork to anyone browsing the tree.
    const keep = new Set(Object.values(variants).flatMap((b) => Object.values(b)));
    for (const file of await readdir(join(ROOT, dir))) {
      if (!file.endsWith('.svg') || keep.has(`${dir}/${file}`)) continue;
      await rm(join(ROOT, dir, file));
    }

    const notes = [];
    if (asset.retired) notes.push('Marked retired in Figma. Set status to deprecated and add replacedBy once a replacement is agreed.');
    notes.push('Imported from Figma. Colours are baked in, so the accent picker is off until the artwork is tokenised.');

    const meta = {
      id: asset.id,
      name: asset.name,
      keywords: [...new Set(slug(asset.name).split('-').filter((w) => w.length > 1))],
      ...(asset.description ? { description: asset.description.slice(0, 280) } : {}),
      type: asset.type,
      collection: asset.collection,
      status: 'draft',
      themes: Object.keys(variants),
      sizes: asset.sizes,
      colors: extractColors(sample),
      // Figma renders colours literally — none of the --ea-primary or
      // currentColor hooks the generated set uses. The browser detects this at
      // runtime anyway; saying it here keeps the data honest.
      recolorable: false,
      variants,
      figma: { fileKey: FILE_KEY, nodeId: asset.nodeId },
      version: '1.0.0',
      updated: today,
      notes: notes.join(' '),
    };

    await writeFile(join(ROOT, dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    written++;
    if (written % 100 === 0) console.log(`  wrote ${written}/${plan.length}…`);
  }

  await writeFile(join(ROOT, 'figma-import-report.json'), JSON.stringify({ plan, skipped, failures }, null, 2));

  console.log(`\n✓ Imported ${written} assets.`);
  if (failures.length) console.log(`  ${failures.length} render failures — see figma-import-report.json`);
  console.log(`
  Everything lands as status: "draft" with keywords from the name only.
  Nothing is published until a person has looked at it, and invented keywords
  are worse than none.

  Next: npm run notices && npm run manifest && npm run validate
`);
}

/* ------------------------------------------------------------------ */
/* Precomputed plan                                                     */
/* ------------------------------------------------------------------ */

const PLACEHOLDER = /^Placeholder artwork\./;

/**
 * Retire generated placeholders once real artwork lands in the same collection.
 *
 * The generator stamps every asset it invents with a notes line starting
 * "Placeholder artwork." — that string is the only thing this looks at, so it
 * can never eat imported work. Only runs on a full import of a collection:
 * with --limit or --only in play the collection is half-populated and pulling
 * the placeholders would leave holes in the grid rather than close them.
 */
async function retirePlaceholders(collections) {
  const retired = [];
  for (const collection of collections) {
    for (const type of ['icons', 'illustrations']) {
      const base = join(ROOT, 'assets', type, collection);
      let entries;
      try {
        entries = await readdir(base, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = join(base, entry.name);
        let meta;
        try {
          meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
        } catch {
          continue;
        }
        if (!PLACEHOLDER.test(meta.notes || '')) continue;
        await rm(dir, { recursive: true, force: true });
        retired.push(meta.id);
      }
    }
  }
  return retired;
}

/**
 * Run a plan that was worked out ahead of time against the real file.
 *
 * The survey → config → import path is right when nobody has looked at the
 * file yet. Once the structure IS known — which sets are live, which are
 * retired, how the size property is spelled in each corner — baking that into
 * a reviewed plan beats re-deriving it on every run. The plan is committed, so
 * what got imported and what got skipped is visible in code review rather than
 * living in someone's terminal history.
 */
async function runPlan() {
  const plan = JSON.parse(await readFile(PLAN.replace(/^~/, process.env.HOME || '~'), 'utf8'));
  const assets = plan.assets.slice(0, LIMIT).filter((a) => !ONLY || a.collection === ONLY);
  const fileKey = plan.fileKey || FILE_KEY;

  const drawings = assets.reduce(
    (n, a) => n + Object.values(a.renders).reduce((m, byS) => m + Object.keys(byS).length, 0),
    0
  );
  console.log(`\nPlan: ${plan.page || 'file'} — ${assets.length} assets, ${drawings} drawings`);
  if (plan.skipped?.length) {
    const why = tally(plan.skipped.map((s) => s.why));
    console.log(`Excluded by decision (${plan.skipped.length}):`);
    for (const [reason, n] of why) console.log(`  ${String(n).padStart(4)}  ${reason}`);
  }

  if (has('--dry-run')) {
    console.log('\nDry run — nothing written.\n');
    return;
  }

  const ids = [...new Set(assets.flatMap((a) => Object.values(a.renders).flatMap((b) => Object.values(b))))];
  console.log(`\nAsking Figma to render ${ids.length} nodes as SVG…`);
  const urls = await renderUrls(ids, fileKey);

  const today = new Date().toISOString().slice(0, 10);
  let written = 0;
  const failures = [];

  for (const asset of assets) {
    const name = asset.id.split('.').slice(1).join('.');
    const dir = `assets/${asset.type}s/${asset.collection}/${name}`;
    const variants = {};
    let sample = '';

    for (const [theme, bySize] of Object.entries(asset.renders)) {
      for (const [size, nodeId] of Object.entries(bySize)) {
        const url = urls[nodeId];
        if (!url) {
          failures.push(`${asset.id} ${theme}/${size}: no render URL`);
          continue;
        }
        const svg = await (await fetch(url)).text();
        await mkdir(join(ROOT, dir), { recursive: true });
        const rel = `${dir}/${theme}-${size}.svg`;
        await writeFile(
          join(ROOT, rel),
          prepare(svg, {
            prefix: `${asset.id.replace(/\./g, '-')}-${theme}-${size}`,
            label: `${asset.name} ${theme} ${size}`,
          }),
          'utf8'
        );
        (variants[theme] ||= {})[size] = rel;
        if (!sample) sample = svg;
      }
    }
    if (!Object.keys(variants).length) continue;

    await writeFile(
      join(ROOT, dir, 'meta.json'),
      JSON.stringify(
        {
          id: asset.id,
          name: asset.name,
          keywords: [...new Set(slug(asset.name).split('-').filter((w) => w.length > 1))],
          type: asset.type,
          collection: asset.collection,
          status: 'draft',
          themes: Object.keys(variants),
          sizes: asset.sizes,
          colors: extractColors(sample),
          recolorable: false,
          variants,
          figma: { fileKey, nodeId: asset.nodeId },
          version: '1.0.0',
          updated: today,
          notes:
            'Imported from Figma. Colours are baked in, so the accent picker stays off until the artwork is tokenised.',
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    written++;
    if (written % 25 === 0) console.log(`  wrote ${written}/${assets.length}…`);
  }

  if (failures.length) {
    await writeFile(join(ROOT, 'figma-import-report.json'), JSON.stringify({ failures }, null, 2));
  }
  console.log(`\n✓ Imported ${written} assets${failures.length ? `, ${failures.length} render failures` : ''}.`);

  const partial = LIMIT !== Infinity || ONLY;
  if (written && !partial) {
    const touched = [...new Set(assets.map((a) => a.collection))];
    const retired = await retirePlaceholders(touched);
    if (retired.length) {
      console.log(`\n  Retired ${retired.length} generated placeholders, now superseded by real artwork:`);
      console.log(`    ${retired.join(', ')}`);
    }
  } else if (written && partial) {
    console.log('\n  Partial run — generated placeholders left in place.');
  }

  console.log('\n  Next: npm run notices && npm run manifest && npm run validate\n');
}

/* ------------------------------------------------------------------ */

async function main() {
  // A plan dry run reads a committed file and asks Figma for nothing, so it
  // works before anyone has a token — which is the point of reviewing it first.
  if (PLAN && has('--dry-run')) return runPlan();

  if (!TOKEN) {
    console.error(`
Missing FIGMA_TOKEN.

  1. Figma → your avatar → Settings → Security → Personal access tokens
  2. Generate one, scope "File content: read-only"
  3. export FIGMA_TOKEN="figd_..."

Keep it out of your shell history and out of this repo.
`);
    process.exit(1);
  }
  if (PLAN) return runPlan();

  if (!FILE_KEY) {
    console.error('\nMissing file key. Pass --file=KEY or set FIGMA_FILE_KEY.');
    console.error('It is the segment after /design/ in the Figma URL.\n');
    process.exit(1);
  }

  if (has('--survey') || !(await exists(CONFIG_PATH))) {
    if (!(await exists(CONFIG_PATH))) console.log('No figma.config.json yet — surveying first.\n');
    return survey();
  }
  return importAssets();
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
