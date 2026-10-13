#!/usr/bin/env node
/**
 * Brings a folder of PNGs or JPEGs into Backgrounds or Personas.
 *
 * The rule this script exists to enforce: the repo holds the web-sized copy,
 * and the master lives outside it. A design-system repo that accumulates
 * print-resolution photography is a repo that takes twenty minutes to clone a
 * year from now, and GitHub Pages will not resolve an LFS pointer, so the
 * usual escape hatch is closed. Every file that comes in here is checked
 * against that ceiling and refused if it is over it.
 *
 * This script does not resize. Resizing a photograph well needs a real image
 * pipeline, and guessing at one here would quietly degrade somebody's artwork.
 * Export the web copy from wherever the master lives, then import that.
 *
 *   node scripts/import-raster.mjs --type=background --from=~/Desktop/walls
 *   node scripts/import-raster.mjs --type=persona --from=./approved \
 *     --approved-by="Brand marketing" --approved-on=2026-10-13 --scope=internal
 *
 * One asset per file. The slug comes from the filename, the display name from
 * the slug, and everything else is a flag or a blank you fill in afterwards —
 * the point is to get the files filed correctly, not to invent metadata.
 *
 * --dry-run prints what it would write and touches nothing.
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  formatOf, dimensionsOf, aspectOf, extOf,
  RASTER_MAX_BYTES, RASTER_WARN_BYTES,
} from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  background: { collection: 'background', dir: 'assets/media/background', label: 'background' },
  persona: { collection: 'persona', dir: 'assets/media/persona', label: 'persona' },
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);

const kb = (n) => `${Math.round(n / 1024)} KB`;
const expand = (p) => (p.startsWith('~') ? join(homedir(), p.slice(1)) : p);

/** my-great-wallpaper_2x.PNG -> my-great-wallpaper. Slugs are the id, and an
 *  id never changes once published, so this is deliberately strict rather than
 *  clever: lowercase, letters and digits, single hyphens. */
function slugify(name) {
  return basename(name, extname(name))
    .replace(/@?[0-9]+x$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleize(slug) {
  return slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

const exists = (p) => stat(p).then(() => true, () => false);

async function main() {
  const type = String(args.type || '');
  if (!TYPES[type]) {
    console.error(`--type must be one of ${Object.keys(TYPES).join(', ')}`);
    process.exit(1);
  }
  if (!args.from) {
    console.error('--from=<folder of images> is required');
    process.exit(1);
  }

  const spec = TYPES[type];
  const from = resolve(expand(String(args.from)));
  const dry = Boolean(args['dry-run']);
  const today = new Date().toISOString().slice(0, 10);

  const approval =
    args['approved-by'] && args['approved-on']
      ? {
          approvedBy: String(args['approved-by']),
          approvedOn: String(args['approved-on']),
          ...(args.scope ? { scope: String(args.scope) } : {}),
          ...(args.expires ? { expires: String(args.expires) } : {}),
        }
      : null;

  if (type === 'persona' && !approval) {
    console.log(
      'No --approved-by / --approved-on, so these land as drafts.\n' +
      'That is the right thing when the clearance has not come through yet: validate\n' +
      'refuses a published persona with no approval on record.\n'
    );
  }

  const files = (await readdir(from, { withFileTypes: true }))
    .filter((e) => e.isFile() && ['png', 'jpg', 'webp'].includes(extOf(e.name)))
    .map((e) => e.name)
    .sort();

  if (!files.length) {
    console.error(`No PNG, JPEG or WebP files in ${from}`);
    process.exit(1);
  }

  let written = 0;
  const refused = [];

  for (const file of files) {
    const buf = await readFile(join(from, file));
    const slug = slugify(file);
    const where = `${file} -> ${type}.${slug}`;

    if (!slug) { refused.push(`${file}: the name reduces to an empty slug`); continue; }

    const format = formatOf(buf);
    if (!format) { refused.push(`${file}: carries no PNG, JPEG or WebP signature`); continue; }
    if (format !== extOf(file)) { refused.push(`${file}: is really a ${format}`); continue; }

    if (buf.length > RASTER_MAX_BYTES) {
      refused.push(`${file}: ${kb(buf.length)}, over the ${kb(RASTER_MAX_BYTES)} ceiling — export a web-sized copy and keep the master outside the repo`);
      continue;
    }

    const dim = dimensionsOf(buf);
    if (!dim) { refused.push(`${file}: its header could not be read`); continue; }

    const long = Math.max(dim.width, dim.height);
    const square = dim.width === dim.height;
    const rel = `${spec.dir}/${slug}/${slug}-${long}.${format}`;
    const dir = join(ROOT, spec.dir, slug);

    if (await exists(join(dir, 'meta.json'))) {
      refused.push(`${file}: ${type}.${slug} already exists — rename the file or remove the asset first`);
      continue;
    }

    const meta = {
      id: `${spec.collection}.${slug}`,
      name: titleize(slug),
      type,
      collection: spec.collection,
      status: type === 'persona' && !approval ? 'draft' : 'published',
      description: '',
      keywords: [type, ...slug.split('-').filter((w) => w.length > 2)],
      themes: ['standard'],
      sizes: [long],
      ...(square ? {} : { aspect: aspectOf(dim.width, dim.height) }),
      colors: { primary: '#000000', secondary: '#FFFFFF' },
      recolorable: false,
      variants: { standard: { [long]: rel } },
      ...(type === 'persona'
        ? { persona: { role: '', ...(approval ? { approval } : {}) } }
        : {}),
      notes: 'Web-sized copy. The master lives outside this repo.',
      version: '1.0.0',
      updated: today,
    };

    console.log(
      `  ${where.padEnd(52)} ${dim.width}×${dim.height}  ${kb(buf.length).padStart(7)}` +
      (buf.length > RASTER_WARN_BYTES ? '  (heavy)' : '')
    );

    if (!dry) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(ROOT, rel), buf);
      await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    }
    written++;
  }

  if (refused.length) {
    console.log(`\n${refused.length} not imported:`);
    for (const r of refused) console.log(`  · ${r}`);
  }

  console.log(
    dry
      ? `\nDry run — ${written} would be imported, nothing written.`
      : `\nImported ${written} ${spec.label}${written === 1 ? '' : 's'}.\n` +
        'Each one lands with an empty description' +
        (type === 'persona' ? ', an empty persona role' : '') +
        ' — fill those in, then run `npm run manifest && npm run validate`.'
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
