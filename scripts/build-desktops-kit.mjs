#!/usr/bin/env node
/**
 * Packs the desktop prototypes (docs/desktops) into a folder that runs on its
 * own, for the Download button on the prototypes.
 *
 * The prototypes on the site reach up into ../assets/icons for real library
 * icons. A downloaded copy has no library next to it, so this copies in just
 * the icons the pages use and points the pages at them. It also writes
 * icons.js, which inlines those icons as data URIs, because Chrome refuses CSS
 * masks loaded from file:// and the system icons are masks. Opening the
 * download by double-clicking index.html would otherwise show no system icons.
 *
 * build-site.mjs runs this at deploy and zips the result, the same way as the
 * Customizer kit, so the download is never stale and never stored in git.
 *
 * Run: node scripts/build-desktops-kit.mjs <out-dir>
 */
import { cp, mkdir, readdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'docs', 'desktops');
const ICONS = join(ROOT, 'assets', 'icons');
const TEMPLATES = join(ROOT, 'scripts', 'desktops-kit');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
const exists = p => access(p).then(() => true, () => false);

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('Usage: build-desktops-kit.mjs <out-dir>');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  // 1. The pages, minus scratch files and any zip already sitting there.
  let text = '';
  for (const f of await walk(SRC)) {
    const rel = relative(SRC, f).split(sep).join('/');
    if (rel.split('/').some(s => s.startsWith('_') || s.startsWith('.')) || rel.endsWith('.zip')) continue;
    await mkdir(dirname(join(out, rel)), { recursive: true });
    if (/\.(html|js|css)$/.test(rel)) {
      let s = await readFile(f, 'utf8');
      // Redirect stubs exist for old links on the site; a download has no old links.
      if (rel.endsWith('.html') && s.includes('http-equiv="refresh"')) continue;
      s = s.replaceAll("'../assets/icons/'", "'icons/'").replaceAll('../assets/icons/', 'icons/');
      if (rel.endsWith('.html')) s = s.replace('<script src="shared.js"></script>', '<script src="icons.js"></script>\n<script src="shared.js"></script>');
      await writeFile(join(out, rel), s);
      text += s;
    } else {
      await cp(f, join(out, rel));
    }
  }

  // 2. Every icon the pages can ask for. Literal paths are easy. System icons
  //    are asked for by name, sometimes through a variable, so take every
  //    quoted kebab-case word that names a real system icon, in both styles
  //    and both sizes. A few extra icons cost nothing; a missing one is a hole.
  const paths = new Set(text.match(/(?:product|app|system)\/[a-z0-9-]+\/[a-z0-9-]+\.svg/g) || []);
  for (const [, name] of text.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)*)'/g)) {
    if (!(await exists(join(ICONS, 'system', name)))) continue;
    for (const style of ['outline', 'filled']) for (const px of ['20', '24']) paths.add(`system/${name}/${style}-${px}.svg`);
  }
  const data = {};
  for (const p of [...paths].sort()) {
    const f = join(ICONS, p);
    if (!(await exists(f))) continue;
    const b = await readFile(f);
    await mkdir(dirname(join(out, 'icons', p)), { recursive: true });
    await writeFile(join(out, 'icons', p), b);
    data[p] = 'data:image/svg+xml;base64,' + b.toString('base64');
  }
  await writeFile(join(out, 'icons.js'),
    '/* Icons from the Expressive Assets library, inlined so CSS masks work when the pages are opened from disk. */\n' +
    `window.ICON_DATA = ${JSON.stringify(data)};\n`);

  // 3. A README for the person and a CLAUDE.md for their agent.
  for (const t of ['README.txt', 'CLAUDE.md']) await cp(join(TEMPLATES, t), join(out, t));

  console.log(`Desktops kit: ${Object.keys(data).length} icons inlined.`);
}

main().catch(err => { console.error(err); process.exit(1); });
