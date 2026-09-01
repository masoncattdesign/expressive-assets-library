/**
 * Finish the third-party import: attribution, recolour, status, notes.
 *
 * The importer writes the same meta for every icon collection, which for brand
 * marks is wrong in three ways. They are not ours to recolour. They carry a
 * trademark obligation that has to travel with the file rather than sit in a
 * README. And the boilerplate note describes an Outline style this collection
 * does not have.
 *
 * Owner attribution is best effort and is not a legal opinion. It exists so
 * THIRD-PARTY-NOTICES.md can name a holder for every mark, which is the
 * minimum an audit needs, not the maximum a lawyer would want.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(await readFile(join(ROOT, 'figma-3p-plan.json'), 'utf8'));

let n = 0;
for (const entry of plan.assets) {
  const dir = join(ROOT, 'assets/icons/third-party', entry.id.replace('third-party.', ''));
  const path = join(dir, 'meta.json');
  let meta;
  try { meta = JSON.parse(await readFile(path, 'utf8')); } catch { continue; }

  const styles = Object.keys(meta.variants || {});
  meta.status = 'published';
  // A brand mark is drawn by its owner. Retinting it is the thing their
  // guidelines exist to prevent, so the accent picker stays off entirely.
  meta.recolorable = false;
  // The notices template punctuates for itself, so neither string ends in a
  // full stop of its own or the file reads "Adobe Inc..".
  const owner = entry.source.owner;
  meta.source = {
    project: owner,
    license: 'trademark of the named holder, reproduced for interface use and not licensed for redistribution',
    // The notices file groups by project, so this line stands for every mark
    // in the group rather than for one of them. Naming a single brand there
    // would be accurate about one asset and wrong about the other eight.
    copyright: `The marks in this group are trademarks of ${owner}`,
  };
  meta.notes =
    `${entry.name} brand mark, imported from the 3P Icons page at 32px, the only size the file holds. ` +
    (styles.length > 1
      ? 'Standard is the colour mark and Filled the monochrome one, both as the owner draws them. '
      : `Only one mark exists upstream (${styles[0]}), so this asset has no counterpart style. `) +
    'Not recolourable: altering a third-party mark is what their brand guidelines forbid.';

  await writeFile(path, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  n++;
}
console.log(`Updated ${n} third-party meta files.`);
