/**
 * Prove that the REST API returns the plugin data the sync plugin writes.
 *
 * The whole round trip rests on this and it has never been tested. The plugin
 * stamps every variant with the asset id, its style, its size and a hash of the
 * drawing, using setSharedPluginData rather than setPluginData specifically
 * because shared data is the kind REST can read. If that turns out to be wrong,
 * the pull half needs rethinking before anything is built on top of it.
 *
 *   export FIGMA_TOKEN="figd_..."     # never pass it as an argument
 *   node scripts/figma-probe-plugindata.mjs
 *
 * Reads the pull target out of figma-sources.json. Writes nothing, anywhere.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NS = 'expressiveassets';
const TOKEN = process.env.FIGMA_TOKEN;

if (!TOKEN) {
  console.error('Set FIGMA_TOKEN in your environment first. Do not pass it as an argument.');
  process.exit(1);
}

const sources = JSON.parse(await readFile(join(ROOT, 'figma-sources.json'), 'utf8'));
const fileKey = sources.fileKey;
const nodeId = sources.collections.product.pull.nodeId;

async function api(path) {
  const res = await fetch('https://api.figma.com/v1' + path, {
    headers: { 'X-Figma-Token': TOKEN },
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status} ${res.statusText}`);
  return res.json();
}

console.log(`Reading ${nodeId} from ${sources.fileName}…`);

/* plugin_data=shared is the parameter that decides this. Without it the field
   is simply absent, which would look identical to the feature not existing. */
const data = await api(
  `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&plugin_data=shared&depth=3`
);

const root = data.nodes[nodeId]?.document;
if (!root) {
  console.error('That node is not in the file. Check figma-sources.json.');
  process.exit(1);
}

/* Walk down to whatever carries our namespace. */
let found = null;
let scanned = 0;
(function walk(n) {
  if (found) return;
  scanned++;
  const shared = n.sharedPluginData && n.sharedPluginData[NS];
  if (shared && Object.keys(shared).length) { found = { node: n, shared }; return; }
  (n.children || []).forEach(walk);
})(root);

console.log(`Scanned ${scanned} nodes.\n`);

if (!found) {
  console.log('✗ No sharedPluginData under "' + NS + '" came back.');
  console.log('  Either the plugin has not run on this node, the depth was too');
  console.log('  shallow, or REST does not return it. Re-run the plugin, then');
  console.log('  raise depth before concluding the design is wrong.');
  process.exit(2);
}

console.log('✓ REST returns the plugin data. The round trip is buildable.\n');
console.log(`  on: ${found.node.name} (${found.node.id}, ${found.node.type})`);
for (const [k, v] of Object.entries(found.shared)) {
  console.log(`    ${NS}:${k} = ${String(v).slice(0, 60)}`);
}
console.log('\nWhat this unlocks: a pull can compare the stored hash against the');
console.log('drawing the library last wrote, and tell a cell nobody touched from');
console.log('one somebody redrew, without comparing any artwork.');
