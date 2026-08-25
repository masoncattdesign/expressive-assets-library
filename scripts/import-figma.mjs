#!/usr/bin/env node
/**
 * Imports artwork from a Figma library file.
 *
 * Runs in two passes, deliberately. At 500+ components you do not want a script
 * guessing at your file's structure and writing a thousand files based on the
 * guess — you want to SEE the structure, agree the mapping, then import.
 *
 *   1. npm run figma:survey
 *        Reads the file, reports what is actually in it — pages, component
 *        sets, variant property names and their values, naming patterns — and
 *        writes a draft figma.config.json plus a full figma-survey.json.
 *        Writes nothing into assets/.
 *
 *   2. (edit figma.config.json — map pages to collections, confirm the
 *       variant property names)
 *
 *   3. npm run figma:import
 *        Exports SVGs and writes assets/<type>/<collection>/<slug>/ with a
 *        meta.json for each. Add --dry-run to see the plan without writing.
 *
 * Auth: set FIGMA_TOKEN in your environment. Never pass it on the command line
 * (it lands in your shell history) and never commit it.
 *
 *   export FIGMA_TOKEN="figd_..."
 *   export FIGMA_FILE_KEY="abc123..."      # or pass --file=abc123
 *
 * The file key is the segment after /design/ or /file/ in the Figma URL:
 *   figma.com/design/ABC123xyz/My-Library  ->  ABC123xyz
 */
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
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

const exists = (p) => stat(p).then(() => true, () => false);
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/* ------------------------------------------------------------------ */
/* Figma API                                                           */
/* ------------------------------------------------------------------ */

async function figma(path) {
  const res = await fetch(`${API}${path}`, { headers: { 'X-Figma-Token': TOKEN } });
  if (res.status === 429) {
    // Figma rate-limits hard on big files. Back off rather than hammering.
    const wait = Number(res.headers.get('retry-after') || 30);
    console.log(`  rate limited, waiting ${wait}s…`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return figma(path);
  }
  if (!res.ok) {
    throw new Error(`Figma API ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

/** Walk the document tree, yielding every node together with the page it is on. */
function* walk(node, page = null) {
  const currentPage = node.type === 'CANVAS' ? node.name : page;
  yield { node, page: currentPage };
  for (const child of node.children || []) yield* walk(child, currentPage);
}

/** Figma encodes variants as "Size=24, Theme=Color" in the child's name. */
function parseVariant(name) {
  return Object.fromEntries(
    name
      .split(',')
      .map((part) => part.split('='))
      .filter((pair) => pair.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()])
  );
}

/** Collect every component set, plus loose components that are not in a set. */
function collectComponentSets(document) {
  const sets = [];
  for (const { node, page } of walk(document)) {
    if (node.type === 'COMPONENT_SET') {
      sets.push({
        id: node.id,
        name: node.name,
        page,
        description: node.description || '',
        variants: (node.children || []).map((child) => ({
          id: child.id,
          name: child.name,
          props: parseVariant(child.name),
        })),
      });
    } else if (node.type === 'COMPONENT' && !node.name.includes('=')) {
      // A standalone component with no variants — still importable, single variant.
      sets.push({
        id: node.id,
        name: node.name,
        page,
        description: node.description || '',
        variants: [{ id: node.id, name: node.name, props: {} }],
        standalone: true,
      });
    }
  }
  // A COMPONENT inside a COMPONENT_SET is also yielded by walk(); drop those.
  const setIds = new Set(sets.filter((s) => !s.standalone).flatMap((s) => s.variants.map((v) => v.id)));
  return sets.filter((s) => !(s.standalone && setIds.has(s.id)));
}

/* ------------------------------------------------------------------ */
/* Survey                                                              */
/* ------------------------------------------------------------------ */

function tally(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function survey() {
  console.log(`Reading Figma file ${FILE_KEY}…`);
  const file = await figma(`/files/${FILE_KEY}`);
  const sets = collectComponentSets(file.document);

  if (!sets.length) {
    console.log('\nNo components or component sets found. Check the file key and that the token has access.');
    return;
  }

  const pages = tally(sets.map((s) => s.page || '(no page)'));
  const propNames = tally(sets.flatMap((s) => s.variants.flatMap((v) => Object.keys(v.props))));

  const propValues = {};
  for (const [prop] of propNames) {
    propValues[prop] = tally(sets.flatMap((s) => s.variants.map((v) => v.props[prop]).filter(Boolean))).slice(0, 12);
  }

  const withDescription = sets.filter((s) => s.description.trim()).length;

  console.log(`\nFound ${sets.length} component sets across ${pages.length} pages.\n`);

  console.log('PAGES');
  for (const [page, count] of pages) console.log(`  ${String(count).padStart(4)}  ${page}`);

  console.log('\nVARIANT PROPERTIES');
  if (!propNames.length) console.log('  (none — components have no variants)');
  for (const [prop, count] of propNames) {
    const values = propValues[prop].map(([v, n]) => `${v}(${n})`).join('  ');
    console.log(`  ${String(count).padStart(4)}  ${prop}: ${values}`);
  }

  console.log(`\nDESCRIPTIONS  ${withDescription}/${sets.length} component sets have one`);

  console.log('\nSAMPLE NAMES');
  for (const s of sets.slice(0, 12)) {
    console.log(`  ${(s.page || '?').padEnd(22)} ${s.name}  [${s.variants.length} variant${s.variants.length === 1 ? '' : 's'}]`);
  }

  await writeFile(SURVEY_PATH, JSON.stringify({ fileKey: FILE_KEY, name: file.name, sets }, null, 2));

  // Draft a config from what we saw, so the mapping starts from reality.
  const guessProp = (candidates) => propNames.map(([p]) => p).find((p) => candidates.includes(p.toLowerCase())) || null;
  const draft = {
    fileKey: FILE_KEY,
    sizeProperty: guessProp(['size']),
    themeProperty: guessProp(['theme', 'style']),
    themeMap: { Color: 'standard', Regular: 'outline', Filled: 'mono' },
    defaultType: 'icon',
    collections: Object.fromEntries(pages.map(([page]) => [page, null])),
    skipPages: [],
  };

  if (await exists(CONFIG_PATH)) {
    console.log(`\nfigma.config.json already exists — leaving it alone. Draft written into ${SURVEY_PATH}.`);
    draft._note = 'Draft only; figma.config.json already existed.';
  } else {
    await writeFile(CONFIG_PATH, JSON.stringify(draft, null, 2) + '\n');
    console.log(`\nWrote figma.config.json.`);
  }

  console.log(`Wrote figma-survey.json (${sets.length} component sets, full detail).\n`);
  console.log('NEXT: open figma.config.json and fill in the `collections` map — each Figma');
  console.log('page name maps to one of: system, product, file, windows, fluent (or null to');
  console.log('skip). Confirm sizeProperty/themeProperty, then run `npm run figma:import`.\n');
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

/** Ask Figma for SVG render URLs, in batches. The endpoint caps ids per call. */
async function exportUrls(ids) {
  const out = {};
  const BATCH = 80;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    console.log(`  rendering ${i + 1}–${Math.min(i + BATCH, ids.length)} of ${ids.length}…`);
    const res = await figma(`/images/${FILE_KEY}?ids=${batch.join(',')}&format=svg`);
    Object.assign(out, res.images || {});
  }
  return out;
}

async function importAssets() {
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const dryRun = has('--dry-run');

  const survey = (await exists(SURVEY_PATH))
    ? JSON.parse(await readFile(SURVEY_PATH, 'utf8'))
    : { sets: collectComponentSets((await figma(`/files/${FILE_KEY}`)).document) };

  const plan = [];
  const skipped = [];

  for (const set of survey.sets) {
    const collection = config.collections?.[set.page || '(no page)'];
    if (!collection || config.skipPages?.includes(set.page)) {
      skipped.push({ name: set.name, page: set.page, why: 'page not mapped to a collection' });
      continue;
    }

    // Group variants by theme, keeping the largest size of each — that variant
    // carries the most detail, and SVG scales down cleanly.
    const byTheme = new Map();
    for (const variant of set.variants) {
      const rawTheme = config.themeProperty ? variant.props[config.themeProperty] : null;
      const theme = config.themeMap?.[rawTheme] || (rawTheme ? slug(rawTheme) : 'standard');
      const size = Number(config.sizeProperty ? variant.props[config.sizeProperty] : 0) || 0;
      const current = byTheme.get(theme);
      if (!current || size > current.size) byTheme.set(theme, { id: variant.id, size });
    }

    const themes = [...byTheme.keys()].filter((t) => ['standard', 'outline', 'mono'].includes(t));
    if (!themes.length) {
      skipped.push({ name: set.name, page: set.page, why: 'no recognisable theme variants' });
      continue;
    }

    const sizes = [
      ...new Set(
        set.variants
          .map((v) => Number(config.sizeProperty ? v.props[config.sizeProperty] : NaN))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ].sort((a, b) => a - b);

    const type = collection === 'windows' || collection === 'fluent' ? 'illustration' : config.defaultType || 'icon';

    plan.push({
      id: `${collection}.${slug(set.name)}`,
      name: set.name,
      type,
      collection,
      themes,
      sizes: sizes.length ? sizes : [24],
      nodeId: set.id,
      renders: Object.fromEntries(themes.map((t) => [t, byTheme.get(t).id])),
      description: set.description.trim() || undefined,
    });
  }

  /* Report before doing anything destructive. */
  const byCollection = plan.reduce((acc, p) => ({ ...acc, [p.collection]: (acc[p.collection] || 0) + 1 }), {});
  console.log(`\nPlan: ${plan.length} assets to import`);
  for (const [c, n] of Object.entries(byCollection)) console.log(`  ${String(n).padStart(4)}  ${c}`);

  const dupes = plan.map((p) => p.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length) {
    console.error(`\n✗ ${new Set(dupes).size} duplicate ids would be produced, e.g. ${[...new Set(dupes)].slice(0, 5).join(', ')}`);
    console.error('  Two component sets slugify to the same name. Rename them in Figma or add an override.\n');
    process.exit(1);
  }

  if (skipped.length) {
    console.log(`\nSkipping ${skipped.length}:`);
    for (const s of skipped.slice(0, 12)) console.log(`  ${s.name} — ${s.why}`);
    if (skipped.length > 12) console.log(`  …and ${skipped.length - 12} more (see figma-import-report.json)`);
  }

  if (dryRun) {
    await writeFile(join(ROOT, 'figma-import-report.json'), JSON.stringify({ plan, skipped }, null, 2));
    console.log('\nDry run — nothing written. Full plan in figma-import-report.json\n');
    return;
  }

  /* Render and write. */
  const allNodeIds = [...new Set(plan.flatMap((p) => Object.values(p.renders)))];
  console.log(`\nAsking Figma to render ${allNodeIds.length} nodes as SVG…`);
  const urls = await exportUrls(allNodeIds);

  const today = new Date().toISOString().slice(0, 10);
  let written = 0;
  const failures = [];

  for (const asset of plan) {
    const [, name] = asset.id.split('.');
    const dir = `assets/${asset.type}s/${asset.collection}/${name}`;
    const variants = {};

    for (const [theme, nodeId] of Object.entries(asset.renders)) {
      const url = urls[nodeId];
      if (!url) {
        failures.push(`${asset.id} (${theme}): Figma returned no render URL`);
        continue;
      }
      const svg = await (await fetch(url)).text();
      await mkdir(join(ROOT, dir), { recursive: true });
      await writeFile(join(ROOT, dir, `${theme}.svg`), svg, 'utf8');
      variants[theme] = `${dir}/${theme}.svg`;
    }

    if (!Object.keys(variants).length) continue;

    const meta = {
      id: asset.id,
      name: asset.name,
      keywords: [],
      ...(asset.description ? { description: asset.description } : {}),
      type: asset.type,
      collection: asset.collection,
      status: 'draft',
      themes: Object.keys(variants),
      sizes: asset.sizes,
      colors: { primary: '#0078D4', secondary: '#8764B8' },
      // Imported SVGs come out of Figma with their colors hard-coded, so they
      // have none of the --ea-primary hooks the generated set uses. Marking
      // them non-recolorable keeps the browser honest: the accent picker is
      // greyed out with a reason rather than appearing to work and doing
      // nothing. Promote to true once artwork has been through a tokenising
      // pass that swaps literal fills for the custom properties.
      recolorable: false,
      variants,
      figma: { fileKey: FILE_KEY, nodeId: asset.nodeId },
      version: '1.0.0',
      updated: today,
    };
    await writeFile(join(ROOT, dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    written++;
    if (written % 25 === 0) console.log(`  wrote ${written}/${plan.length}…`);
  }

  await writeFile(join(ROOT, 'figma-import-report.json'), JSON.stringify({ plan, skipped, failures }, null, 2));

  console.log(`\n✓ Imported ${written} assets.`);
  if (failures.length) console.log(`  ${failures.length} render failures — see figma-import-report.json`);
  console.log(`
  Everything landed as status: "draft" and with empty keywords. That is
  deliberate — nothing gets marked published until a person has looked at it,
  and \`npm run validate\` will report the keyword coverage gap.

  Next: npm run manifest && npm run validate
`);
}

/* ------------------------------------------------------------------ */

async function main() {
  if (!TOKEN) {
    console.error(`
Missing FIGMA_TOKEN.

  1. Figma -> your avatar -> Settings -> Security -> Personal access tokens
  2. Generate one with "File content: read-only"
  3. export FIGMA_TOKEN="figd_..."

Keep it out of your shell history and out of this repo.
`);
    process.exit(1);
  }
  if (!FILE_KEY) {
    console.error('\nMissing file key. Pass --file=KEY or set FIGMA_FILE_KEY.');
    console.error('It is the segment after /design/ in the Figma URL.\n');
    process.exit(1);
  }

  if (has('--survey') || !(await exists(CONFIG_PATH))) {
    if (!(await exists(CONFIG_PATH))) console.log('No figma.config.json yet — running a survey first.\n');
    return survey();
  }
  return importAssets();
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
