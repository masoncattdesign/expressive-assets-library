#!/usr/bin/env node
/**
 * Imports Microsoft's VS Code icons into the vscode collection.
 *
 *   git clone --depth 1 https://github.com/microsoft/vscode-icons.git
 *   node scripts/import-vscode.mjs --from=./vscode-icons [--dry-run]
 *
 * Upstream layout:
 *   icons/light/<name>.svg    drawn in #424242 for light surfaces
 *   icons/dark/<name>.svg     drawn in #C5C5C5 for dark surfaces
 *
 * The artwork is CC BY 4.0, Copyright (c) Microsoft Corporation — attribution
 * is a licence condition, not a courtesy. Every asset carries a `source` block
 * and `npm run notices` regenerates THIRD-PARTY-NOTICES.md from those.
 *
 * ONE drawing per icon, not two. light and dark are the same geometry at two
 * colours — #424242 and #C5C5C5 — so importing both would be 338 duplicate
 * files each pinned to a surface the library cannot know about. The light
 * drawing is rewritten instead so it adapts to whatever it is placed on:
 *
 *   #424242  -> currentColor    body follows the host's text colour
 *   #007ACC  -> left alone      semantic: debug states, info badges
 *
 * (31 light files carry a white fill, but every one is inside a <clipPath>
 * where fill has no effect. Checked, because a real knockout would have needed
 * handling and an imagined one would have meant dead code.)
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const has = (f) => args.includes(f);

const FROM = (arg('from') || '').replace(/^~/, homedir());
const COLLECTION = arg('collection') || 'vscode';
const DRY = has('--dry-run');

/* The collection is one family, so it shares one gradient rather than each icon
   inventing a brand colour — same reasoning as the Fluent system set. */
const TILE = { primary: '#0F6CBD', secondary: '#38C6C6' };

/* Words that should not be title-cased into "Api" and "Vm". */
const ACRONYMS = new Set(['vm', 'api', 'json', 'html', 'css', 'url', 'id', 'ui', 'io', 'pr', 'sq', 'db']);

const exists = (p) => stat(p).then(() => true, () => false);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** "arrow-small-down" -> "Arrow Small Down"; "vm-running" -> "VM Running" */
const title = (s) =>
  s
    .split('-')
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');

const namespaceIds = (svg, prefix) =>
  svg
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);

function prepareFilled(svg, { prefix, label }) {
  let out = svg.trim().replace(/^\ufeff/, '').replace(/<\?xml[^>]*\?>\s*/g, '');
  out = namespaceIds(out, prefix);
  out = out.replace(/fill="#424242"/gi, 'fill="currentColor"');
  if (!out.includes('role="img"')) out = out.replace('<svg ', '<svg role="img" ');
  if (!out.includes('aria-label=')) {
    out = out.replace('<svg ', `<svg aria-label="${label.replace(/"/g, '&quot;')}" `);
  }
  return out + '\n';
}

/** The synthesised Standard variant: the glyph in white inside a gradient tile. */
function buildStandard(svg, { prefix, label }) {
  const inner = (svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [, ''])[1]
    .replace(/fill="#424242"/gi, 'fill="#fff"')
    .trim();

  const viewBox = Number((svg.match(/viewBox="0 0 (\d+) \d+"/) || [, '16'])[1]);
  const inset = ((24 - 24 * 0.62) / 2).toFixed(2);
  const scale = ((24 * 0.62) / viewBox).toFixed(4);

  const id = `ea-${prefix}`;
  const body =
    `<style>#${id}{--ea-primary:${TILE.primary};--ea-secondary:${TILE.secondary}}` +
    `#${id} .c1{stop-color:var(--ea-primary)}#${id} .c2{stop-color:var(--ea-secondary)}</style>` +
    `<defs><linearGradient id="${id}-g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">` +
    `<stop class="c1"/><stop offset="1" class="c2"/></linearGradient></defs>` +
    `<rect width="24" height="24" rx="6" fill="url(#${id}-g)"/>` +
    `<g transform="translate(${inset} ${inset}) scale(${scale})">` +
    namespaceIds(inner, prefix) +
    '</g>';

  return (
    `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" ` +
    `fill="none" role="img" aria-label="${label.replace(/"/g, '&quot;')}">${body}</svg>\n`
  );
}

async function main() {
  const lightDir = join(FROM, 'icons', 'light');
  if (!FROM || !(await exists(lightDir))) {
    console.error(`\nPass --from=<clone of microsoft/vscode-icons>. Looked for ${lightDir}\n`);
    process.exit(1);
  }

  const files = (await readdir(lightDir)).filter((f) => f.toLowerCase().endsWith('.svg')).sort();
  const darkDir = join(FROM, 'icons', 'dark');
  const hasDark = await exists(darkDir);

  console.log(`\n${files.length} icons in ${lightDir}`);
  console.log(`  dark variants ${hasDark ? 'present (not imported — same geometry, see header)' : 'absent'}`);

  const colored = [];
  for (const f of files) {
    const svg = await readFile(join(lightDir, f), 'utf8');
    const extra = [...svg.matchAll(/fill="(#(?!424242|FFFFFF|FFF\b)[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
    if (extra.length) colored.push({ name: f, colors: [...new Set(extra)] });
  }
  console.log(`  ${colored.length} carry semantic colour beyond the body (left untouched)`);

  if (DRY) {
    console.log('\nSample:');
    for (const f of files.slice(0, 8)) console.log(`  ${basename(f, '.svg')} -> ${title(basename(f, '.svg'))}`);
    console.log('\nDry run — nothing written.\n');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const outBase = `assets/icons/${COLLECTION}`;
  let written = 0;

  for (const file of files) {
    const name = slug(basename(file, '.svg'));
    const display = title(basename(file, '.svg'));
    const outDir = `${outBase}/${name}`;
    await mkdir(join(ROOT, outDir), { recursive: true });

    const raw = await readFile(join(lightDir, file), 'utf8');
    const prefix = `${COLLECTION}-${name}`;

    const filledRel = `${outDir}/filled-16.svg`;
    await writeFile(
      join(ROOT, filledRel),
      prepareFilled(raw, { prefix: `${prefix}-filled`, label: `${display} filled` }),
      'utf8'
    );

    const stdRel = `${outDir}/standard-any.svg`;
    await writeFile(
      join(ROOT, stdRel),
      buildStandard(raw, { prefix: `${prefix}-standard`, label: `${display} standard` }),
      'utf8'
    );

    const meta = {
      id: `${COLLECTION}.${name}`,
      name: display,
      keywords: [...new Set(name.split('-').filter((w) => w.length > 1))],
      type: 'icon',
      collection: COLLECTION,
      status: 'draft',
      themes: ['standard', 'filled'],
      sizes: [16],
      colors: { primary: TILE.primary, secondary: TILE.secondary },
      recolorable: true,
      variants: { standard: { any: stdRel }, filled: { 16: filledRel } },
      version: '1.0.0',
      updated: today,
      source: {
        project: 'VS Code Icons',
        url: `https://github.com/microsoft/vscode-icons/blob/main/icons/light/${file}`,
        license: 'CC BY 4.0',
        copyright: 'Copyright (c) Microsoft Corporation',
      },
      notes:
        'Filled is the VS Code light drawing with #424242 rewritten to currentColor, so it adapts to light and dark surfaces. Standard is NOT shipped by VS Code — it is generated here by insetting the glyph in a gradient tile.',
    };

    await writeFile(join(ROOT, outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    written++;
  }

  console.log(`\n✓ Imported ${written} icons into ${outBase}/`);
  console.log(`
  All land as status: "draft" with keywords from the filename only — VS Code
  ships no synonym metadata, so there is nothing honest to derive.

  Next: npm run notices && npm run manifest && npm run validate
`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
