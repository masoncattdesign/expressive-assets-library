/**
 * Move the Windows app tiles out of Product Icons into their own collection.
 *
 * They were imported into `product` because that is where the request put
 * them, and seven had to be suffixed `-app` to avoid colliding with existing
 * product marks of the same name. That suffix was a symptom: Bookings the app
 * tile and Bookings the product mark are different objects, and the collision
 * was the library saying so.
 *
 * In their own collection the suffix is unnecessary — `app.bookings` and
 * `product.bookings` do not compete — so the ids come out clean and the
 * display names lose the "(app)" they were wearing.
 *
 * The word Product stays on the product marks, because that is what the
 * Fluent and Windows ecosystem calls them, even though it means the group and
 * one of its collections share a name.
 */
import { readFile, writeFile, readdir, rename, mkdir, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FROM = join(ROOT, 'assets/icons/product');
const TO = join(ROOT, 'assets/icons/app');
const DRY = process.argv.includes('--dry');

const plan = JSON.parse(await readFile(join(ROOT, 'figma-appicons-plan.json'), 'utf8'));
const exists = (p) => stat(p).then(() => true, () => false);

if (!DRY) await mkdir(TO, { recursive: true });

let moved = 0;
for (const entry of plan.assets) {
  const oldSlug = entry.id.replace('product.', '');
  const newSlug = oldSlug.replace(/-app$/, '');
  const src = join(FROM, oldSlug);
  const dest = join(TO, newSlug);

  if (!(await exists(src))) {
    console.warn(`  skip ${oldSlug}: not on disk`);
    continue;
  }
  if (await exists(dest)) throw new Error(`${dest} already exists — refusing to overwrite`);

  const metaPath = join(src, 'meta.json');
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));

  meta.id = `app.${newSlug}`;
  meta.collection = 'app';
  meta.name = meta.name.replace(/ \(app\)$/, '');
  meta.notes =
    'Windows app tile, imported from the App Icons section at 64px, the only size the file ' +
    'holds. Its own collection rather than a Product Icon: an app tile and a product mark are ' +
    'different objects, which is why seven of these collided by name on the way in.';

  // Artwork paths carry the collection, so they move with the folder.
  for (const style of Object.keys(meta.variants || {})) {
    for (const size of Object.keys(meta.variants[style])) {
      meta.variants[style][size] = meta.variants[style][size]
        .replace('assets/icons/product/', 'assets/icons/app/')
        .replace(`/${oldSlug}/`, `/${newSlug}/`);
    }
  }

  if (!DRY) {
    await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
    await rename(src, dest);
  }
  moved++;
}

console.log(`${DRY ? 'Would move' : 'Moved'} ${moved} app tiles to assets/icons/app/.`);
