/**
 * Build the import plan for third-party icons.
 *
 * The 3P page is not shaped like the others and cannot be surveyed into a plan
 * the usual way, for three reasons:
 *
 *   1. Four different naming schemes. Most components are `Size=32, Theme=Color`,
 *      but five brands still carry Figma's defaults (`Property 1=32,
 *      Property 2=Color`), Adobe Indesign has the properties reversed, and
 *      Adobe Photoshop has no Size property at all.
 *   2. Three theme values for two roles. `Color` is the brand mark; `Filled`
 *      and `Regular` both mean the monochrome one, on different brands.
 *   3. Ids come from many namespaces, and a container's id is often from a
 *      different one than its own children. Nothing can be inferred from a
 *      prefix.
 *
 * So the node map is recorded by hand in scripts/sources/3p-nodes.json, read
 * off the file itself, and this turns it into the plan the importer runs.
 *
 * Theme mapping. `Color` becomes Standard, the brand mark as its owner draws
 * it. `Filled` becomes Filled. `Regular` is the awkward one: on brands that
 * also have a Color it is the mono mark, so it becomes Filled; where it is the
 * only mark on the left slot, as on X, it is the primary and becomes Standard.
 *
 * Outline is not here. It does not exist in the file and has to be derived
 * after import, from artwork that has actually landed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE_KEY = 'l752WyMxGqlvG5g8zkOaxm';
const PAGE_NODE = '582219:10748';
const SIZE = 32;

/* Who owns each mark. Best effort for the notices file, and explicitly not a
   legal opinion: every one of these wants confirming before it is relied on. */
const OWNERS = [
  [/^Adobe /, 'Adobe Inc.'],
  [/^(Apple|Apple Mail|Apple Messages|iCloud|Safari)$/, 'Apple Inc.'],
  [/^(Google|Google .*|Android|Youtube)$/, 'Google LLC'],
  [/^(Facebook|Facebook Messenger|Instagram|Whatsapp|Whatsapp Business)$/, 'Meta Platforms, Inc.'],
  [/^(Twitter|Twitter Circle|X)$/, 'X Corp.'],
  [/^Box$/, 'Box, Inc.'],
  [/^Content Credentials$/, 'Coalition for Content Provenance and Authenticity'],
  [/^Dropbox$/, 'Dropbox, Inc.'],
  [/^Evernote$/, 'Evernote Corporation'],
  [/^Figma$/, 'Figma, Inc.'],
  [/^Firefox$/, 'Mozilla Foundation'],
  [/^Instacart$/, 'Maplebear Inc.'],
  [/^Line Messenger$/, 'LY Corporation'],
  [/^Linux$/, 'Linux Mark Institute'],
  [/^MCP$/, 'Anthropic PBC'],
  [/^Meetup$/, 'Meetup LLC'],
  [/^Miro$/, 'RealtimeBoard, Inc.'],
  [/^Opera$/, 'Opera Norway AS'],
  [/^Pearson$/, 'Pearson plc'],
  [/^Polly$/, 'Polly.ai'],
  [/^ServiceNow$/, 'ServiceNow, Inc.'],
  [/^Sketch$/, 'Sketch B.V.'],
  [/^Slack$/, 'Salesforce, Inc.'],
  [/^Squarespace$/, 'Squarespace, Inc.'],
  [/^Stack Overflow$/, 'Stack Exchange, Inc.'],
  [/^Telegram$/, 'Telegram FZ-LLC'],
  [/^TikTok$/, 'ByteDance Ltd.'],
  [/^Trello$/, 'Atlassian Corporation'],
  [/^Viber$/, 'Rakuten Group, Inc.'],
  [/^WeChat$/, 'Tencent Holdings Limited'],
  [/^Weibo$/, 'Weibo Corporation'],
  [/^Wix$/, 'Wix.com Ltd.'],
  [/^WordPress$/, 'Automattic Inc.'],
  [/^Wunderlist$/, 'Microsoft Corporation'],
  [/^Xiaohongshu$/, 'Xingin Information Technology Co., Ltd.'],
  [/^Yahoo$/, 'Yahoo Inc.'],
];

const ownerOf = (name) => (OWNERS.find(([re]) => re.test(name)) || [null, 'Unknown'])[1];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const map = JSON.parse(await readFile(join(ROOT, 'scripts/sources/3p-nodes.json'), 'utf8'));
const assets = [];
const notes = [];

for (const [name, themes] of Object.entries(map)) {
  const renders = {};
  const hasColor = 'Color' in themes;

  if (themes.Color) renders.standard = { [SIZE]: themes.Color };
  if (themes.Filled) renders.filled = { [SIZE]: themes.Filled };
  if (themes.Regular) {
    // The mono mark where there is a Color beside it; the primary where there
    // is not, which is how X and Content Credentials are drawn.
    if (hasColor) renders.filled = { [SIZE]: themes.Regular };
    else renders.standard = { [SIZE]: themes.Regular };
  }

  if (!renders.standard) notes.push(`${name}: no Standard — only a monochrome mark exists`);
  if (!renders.filled) notes.push(`${name}: no Filled — only a color mark exists`);

  assets.push({
    id: `third-party.${slug(name)}`,
    name,
    collection: 'third-party',
    type: 'icon',
    nodeId: Object.values(themes)[0],
    sizes: [SIZE],
    renders,
    recolorable: false,
    source: {
      project: name,
      owner: ownerOf(name),
      note: 'Third-party trademark, reproduced for interface use. Ownership is best effort and not a legal opinion.',
    },
  });
}

assets.sort((a, b) => a.name.localeCompare(b.name));

const plan = {
  fileKey: FILE_KEY,
  page: '3P Icons',
  pageNodeId: PAGE_NODE,
  generated: new Date().toISOString().slice(0, 10),
  note:
    'Third-party brand marks. One size (32) and one or two styles per brand, exactly as the ' +
    'file holds them. Outline does not exist here and is derived after import. Every asset ' +
    'carries a `source.owner`, which THIRD-PARTY-NOTICES.md is built from.',
  warnings: notes,
  assets,
};

await writeFile(join(ROOT, 'figma-3p-plan.json'), JSON.stringify(plan, null, 2) + '\n', 'utf8');

const styles = assets.reduce((n, a) => n + Object.keys(a.renders).length, 0);
console.log(`Wrote figma-3p-plan.json — ${assets.length} brands, ${styles} drawings.`);
for (const n of notes) console.log('  ·', n);
