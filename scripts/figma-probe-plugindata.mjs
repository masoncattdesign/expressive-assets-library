/**
 * Prove that the REST API returns the plugin data the sync plugin writes.
 *
 * The whole round trip rests on this and it has never been tested. The plugin
 * stamps every variant with the asset id, its style, its size and a hash of the
 * drawing, using setSharedPluginData rather than setPluginData specifically
 * because shared data is the kind REST can read. If that turns out to be wrong,
 * the pull half needs rethinking before anything is built on top of it.
 *
 *   export FIGMA_TOKEN="figd_yourrealtoken"
 *   npm run figma:probe
 *
 * Checks in stages, because a bare 403 from the final call cannot tell you
 * whether the token is wrong, the scope is missing, the file is not shared with
 * you, or plugin data specifically is being refused. Each stage narrows it.
 *
 * Writes nothing, anywhere, and never prints the token.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NS = 'expressiveassets';
const TOKEN = process.env.FIGMA_TOKEN;
const DEPTH = Number(process.env.DEPTH || 6);

if (!TOKEN) {
  console.error('Set FIGMA_TOKEN in your environment first. Never pass it as an argument.');
  process.exit(1);
}
if (/^figd_\.\.\.$|^figd_your|\.\.\.$/.test(TOKEN)) {
  console.error('FIGMA_TOKEN is still the placeholder from the docs, not a real token.');
  console.error('Figma returns 403 for that, which looks exactly like a permissions problem.');
  process.exit(1);
}

const sources = JSON.parse(await readFile(join(ROOT, 'figma-sources.json'), 'utf8'));
const fileKey = sources.fileKey;
const nodeId = sources.collections.product.pull.nodeId;

async function api(path) {
  const res = await fetch('https://api.figma.com/v1' + path, {
    headers: { 'X-Figma-Token': TOKEN },
  });
  let body = null;
  try { body = await res.json(); } catch { /* not json */ }
  return { ok: res.ok, status: res.status, statusText: res.statusText, body };
}

const step = (n, what) => process.stdout.write(`${n}. ${what.padEnd(46)}`);

/* 1 — is the token real, and what is it allowed to do? ---------------- */
step(1, 'Token accepted at all');
const me = await api('/me');
if (me.ok) {
  console.log(`yes — ${me.body?.email || me.body?.handle || 'signed in'}`);
} else if (me.status === 403) {
  console.log('403');
  console.log('\n   The token is not valid, has been revoked, or lacks even');
  console.log('   current_user:read. Two tokens were exposed in a transcript');
  console.log('   earlier and were meant to be revoked — check this is not one.');
  console.log('   Make a fresh one at Settings > Security > Personal access tokens.');
  process.exit(2);
} else {
  console.log(`${me.status} ${me.statusText}`);
  process.exit(2);
}

/* 2 — can it read this file's contents at all? ------------------------ */
step(2, 'File readable (file_content:read)');
const shallow = await api(`/files/${fileKey}?depth=1`);
if (shallow.ok) {
  console.log(`yes — "${shallow.body?.name}"`);
} else {
  console.log(`${shallow.status} ${shallow.statusText}`);
  console.log('\n   The token is valid but cannot read this file. Two causes,');
  console.log('   and they need different fixes:');
  console.log('     · the token is missing the file_content:read scope. Scopes');
  console.log('       are set when the token is created and cannot be added');
  console.log('       later — make a new one with that scope ticked.');
  console.log('     · the file is not shared with the account the token belongs');
  console.log('       to. Scopes never supersede file permissions.');
  process.exit(2);
}

/* 3 — the actual question ------------------------------------------- */
step(3, 'Node readable with plugin_data=shared');
const withData = await api(
  `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&plugin_data=shared&depth=${DEPTH}`
);
if (!withData.ok) {
  console.log(`${withData.status} ${withData.statusText}`);
  console.log('\n   The file reads fine but this call does not, which points at');
  console.log('   plugin_data specifically rather than at access in general.');
  process.exit(2);
}
console.log('yes');

const root = withData.body.nodes?.[nodeId]?.document;
if (!root) {
  console.log(`\n   Node ${nodeId} is not in the file. Check figma-sources.json.`);
  process.exit(2);
}

/* Finding ANY stamp is not the question. A component set carries only the asset
   id; the thing the pull actually needs is the per-variant hash, which lives one
   level further down. Stopping at the first node with data would report success
   without having tested that. */
let scanned = 0;
let withAny = 0;
let carrier = null;
const keysSeen = new Set();

(function walk(n) {
  scanned++;
  const shared = n.sharedPluginData && n.sharedPluginData[NS];
  if (shared) {
    const keys = Object.keys(shared);
    if (keys.length) {
      withAny++;
      keys.forEach((k) => keysSeen.add(k));
      if (!carrier && shared.hash) carrier = { node: n, shared };
    }
  }
  (n.children || []).forEach(walk);
})(root);

console.log(`\nScanned ${scanned} nodes under "${root.name}".`);
console.log(`${withAny} carry data under "${NS}" — keys seen: ${[...keysSeen].join(', ') || 'none'}\n`);

if (!withAny) {
  console.log('✗ Nothing under the "' + NS + '" namespace came back.');
  console.log('  The call succeeded, so this is not permissions. Either the plugin');
  console.log('  has not run since it started stamping, or the depth did not reach');
  console.log('  far enough. Re-run the plugin, then raise depth, before concluding');
  console.log('  the design is wrong.');
  process.exit(3);
}

if (!carrier) {
  console.log('~ Plugin data comes back, but no node carrying a hash was reached.');
  console.log('  The asset id sits on the component set and the hash sits on each');
  console.log('  variant inside it, so this is almost certainly a depth limit and');
  console.log('  not a missing stamp. Raise depth and run again — the pull needs');
  console.log('  the hash specifically, since that is what tells a cell nobody');
  console.log('  touched from one somebody redrew.');
  process.exit(3);
}

console.log('✓ REST returns the per-variant stamp. The round trip is buildable.\n');
console.log(`  on: ${carrier.node.name} (${carrier.node.id}, ${carrier.node.type})`);
for (const [k, v] of Object.entries(carrier.shared)) {
  console.log(`    ${NS}:${k} = ${String(v).slice(0, 60)}`);
}
console.log('\nWhich means a pull can compare that hash against the drawing the');
console.log('library last wrote, and tell a cell nobody touched from one somebody');
console.log('redrew, without comparing any artwork.');
