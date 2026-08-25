/**
 * Source of truth for the placeholder asset set.
 *
 * Each icon is authored ONCE on a 24x24 grid. The generator derives all three
 * themes from that single geometry using semantic classes:
 *
 *   .f   filled shape   -> solid in Expressive/Mono, outlined in Outline
 *   .s   stroked shape  -> stroked in every theme
 *   .k   knockout       -> punches through a filled shape (gear hole, checkmark)
 *   .lbl label text     -> knocks out of the page shape on file icons
 *
 * Authoring rule: keep every .f shape a SINGLE path. Composite shapes made of
 * overlapping circles look correct when filled but fall apart in Outline theme,
 * where each sub-shape gets its own visible contour.
 *
 * Replace these placeholders with the real Windows artwork by swapping the
 * `glyph` string. Nothing downstream — schema, manifest, or site — changes.
 */

/**
 * A gear as ONE closed path rather than a circle plus n rotated rectangles.
 * The composite version fills identically but falls apart in Outline theme,
 * where every tooth gets its own contour and the gear reads as a flower.
 */
function gearPath(cx, cy, outer, inner, n = 8, toothDeg = 13, filletDeg = 6) {
  const step = 360 / n;
  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  const d = [];
  for (let i = 0; i < n; i++) {
    const a = i * step;
    d.push(
      `${i === 0 ? 'M' : 'L'}${pt(a - toothDeg, outer)}`,
      `L${pt(a + toothDeg, outer)}`,
      `L${pt(a + toothDeg + filletDeg, inner)}`,
      `L${pt(a + step - toothDeg - filletDeg, inner)}`
    );
  }
  return `<path class="f" d="${d.join('')}Z"/>`;
}

/** The shared page silhouette every file icon is built on. */
const PAGE =
  '<path class="f" d="M6.2 2.6h7.1l5.5 5.5V20a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2V4.6a2 2 0 0 1 2-2Z"/>' +
  '<path class="k" d="M13.1 2.8v4.4a1.6 1.6 0 0 0 1.6 1.6h4.2"/>';

const label = (text) =>
  `<text class="lbl" x="11.6" y="17.6" text-anchor="middle" font-family="Segoe UI Variable, Segoe UI, system-ui, sans-serif" font-size="5.4" font-weight="700" letter-spacing="-0.1">${text}</text>`;

const fileIcon = (id, name, tag, primary, secondary, keywords) => ({
  id: `file.${id}`,
  name,
  type: 'icon',
  collection: 'file',
  container: 'none',
  colors: { primary, secondary },
  keywords,
  glyph: PAGE + label(tag),
});

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

export const ICONS = [
  /* --- File ------------------------------------------------------- */
  fileIcon('word-document', 'Word Document', 'DOC', '#2B579A', '#41A5EE', ['word', 'doc', 'docx', 'text', 'document']),
  fileIcon('spreadsheet', 'Spreadsheet', 'XLS', '#217346', '#33C481', ['excel', 'xls', 'xlsx', 'sheet', 'table', 'data']),
  fileIcon('presentation', 'Presentation', 'PPT', '#D24726', '#ED6C47', ['powerpoint', 'ppt', 'pptx', 'slides', 'deck']),
  fileIcon('pdf', 'PDF', 'PDF', '#D13438', '#EB6B0C', ['acrobat', 'portable document', 'print']),
  fileIcon('image-file', 'Image File', 'IMG', '#8764B8', '#C239B3', ['png', 'jpg', 'picture', 'photo', 'raster']),
  fileIcon('video-file', 'Video File', 'VID', '#CA5010', '#F7A501', ['mp4', 'movie', 'clip', 'media', 'film']),
  fileIcon('audio-file', 'Audio File', 'AUD', '#C239B3', '#E3008C', ['mp3', 'wav', 'sound', 'music', 'track']),
  fileIcon('code-file', 'Code File', 'CODE', '#0F6CBD', '#5D5A88', ['source', 'script', 'developer', 'programming']),
  fileIcon('archive', 'Archive', 'ZIP', '#8E562E', '#CA5010', ['zip', 'compressed', 'rar', 'package', 'bundle']),
  fileIcon('text-file', 'Text File', 'TXT', '#5D5A88', '#8A8886', ['txt', 'plain text', 'notes', 'log']),
];

/* ------------------------------------------------------------------ */
/* Illustrations                                                       */
/* ------------------------------------------------------------------ */
/* Illustrations ship in the color theme only and are authored directly
   at 96x96 with literal colors — they are scenes, not glyphs, so the
   three-theme derivation does not apply.                              */

export const ILLUSTRATIONS = [
  {
    id: 'windows.empty-state',
    name: 'Empty State',
    collection: 'windows',
    colors: { primary: '#1B3A57', secondary: '#8764B8' },
    keywords: ['nothing here', 'zero state', 'space', 'blank', 'no results'],
    svg: `<rect x="4" y="10" width="88" height="76" rx="10" fill="url(#night)"/>
<circle cx="24" cy="26" r="1.6" fill="#FFFFFF" opacity=".9"/>
<circle cx="70" cy="22" r="1.1" fill="#FFFFFF" opacity=".7"/>
<circle cx="80" cy="44" r="1.4" fill="#FFFFFF" opacity=".8"/>
<circle cx="16" cy="58" r="1" fill="#FFFFFF" opacity=".6"/>
<circle cx="58" cy="70" r="1.2" fill="#FFFFFF" opacity=".7"/>
<circle cx="38" cy="16" r="1" fill="#FFFFFF" opacity=".5"/>
<ellipse cx="66" cy="42" rx="16" ry="16" fill="#8764B8"/>
<ellipse cx="66" cy="42" rx="24" ry="6" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="2" transform="rotate(-18 66 42)"/>
<path d="M34 72c0-9 7-16 16-16" stroke="#2AA0DA" stroke-width="3" stroke-linecap="round" fill="none"/>
<circle cx="34" cy="72" r="4.5" fill="#2AA0DA"/>
<defs><linearGradient id="night" x1="4" y1="10" x2="92" y2="86" gradientUnits="userSpaceOnUse"><stop stop-color="#16233F"/><stop offset="1" stop-color="#2B1B4A"/></linearGradient></defs>`,
  },
  {
    id: 'windows.welcome',
    name: 'Welcome',
    collection: 'windows',
    colors: { primary: '#0078D4', secondary: '#F7A501' },
    keywords: ['onboarding', 'hello', 'start', 'first run', 'setup'],
    svg: `<rect x="6" y="6" width="84" height="84" rx="14" fill="#F3F6FB"/>
<rect x="22" y="22" width="24" height="24" rx="5" fill="#0078D4"/>
<rect x="50" y="22" width="24" height="24" rx="5" fill="#D13438"/>
<rect x="22" y="50" width="24" height="24" rx="5" fill="#107C10"/>
<rect x="50" y="50" width="24" height="24" rx="5" fill="#F7A501"/>
<circle cx="74" cy="24" r="6" fill="#FFFFFF"/>
<path d="M71 24.2 73.2 26.4 77.2 22" stroke="#107C10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  {
    id: 'fluent.success',
    name: 'Success',
    collection: 'fluent',
    colors: { primary: '#107C10', secondary: '#4CAF50' },
    keywords: ['done', 'complete', 'confirmation', 'checkmark', 'celebrate'],
    svg: `<circle cx="48" cy="48" r="26" fill="url(#succ)"/>
<path d="M37 48.5 45 56.5 61 40" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<path d="M16 22 19 25M80 20l-3 3M14 62l3.4 1M82 58l-3.4 1M30 12l1.2 3.6M66 82l1.2 3.6" stroke="#F7A501" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="22" cy="40" r="2.4" fill="#E3008C"/>
<circle cx="74" cy="72" r="2.4" fill="#2AA0DA"/>
<circle cx="70" cy="14" r="2" fill="#8764B8"/>
<defs><linearGradient id="succ" x1="22" y1="22" x2="74" y2="74" gradientUnits="userSpaceOnUse"><stop stop-color="#4CAF50"/><stop offset="1" stop-color="#107C10"/></linearGradient></defs>`,
  },
  {
    id: 'fluent.error',
    name: 'Error',
    collection: 'fluent',
    colors: { primary: '#D13438', secondary: '#EB6B0C' },
    keywords: ['problem', 'failure', 'warning', 'something went wrong', 'alert'],
    svg: `<path d="M44.5 14.5a4 4 0 0 1 7 0l30 54a4 4 0 0 1-3.5 6h-60a4 4 0 0 1-3.5-6Z" fill="url(#err)"/>
<path d="M48 33v18" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round"/>
<circle cx="48" cy="62" r="3.4" fill="#FFFFFF"/>
<defs><linearGradient id="err" x1="18" y1="14" x2="78" y2="74" gradientUnits="userSpaceOnUse"><stop stop-color="#EB6B0C"/><stop offset="1" stop-color="#D13438"/></linearGradient></defs>`,
  },
  {
    id: 'product.upload',
    name: 'Upload',
    collection: 'product',
    colors: { primary: '#0078D4', secondary: '#8764B8' },
    keywords: ['add files', 'drop zone', 'import', 'attach', 'cloud'],
    svg: `<rect x="8" y="16" width="80" height="64" rx="12" fill="#F0F5FC" stroke="#B9CFE8" stroke-width="2.4" stroke-dasharray="7 6"/>
<path d="M34 56a10 10 0 0 1 1.2-19.9 15 15 0 0 1 28.4 3 9.6 9.6 0 0 1-1.6 16.9" fill="#CFE3F7"/>
<path d="M48 66V40" stroke="#0078D4" stroke-width="5" stroke-linecap="round"/>
<path d="m38.5 49 9.5-9.5 9.5 9.5" stroke="#0078D4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  {
    id: 'product.sync',
    name: 'Sync',
    collection: 'product',
    colors: { primary: '#0F6CBD', secondary: '#38C6C6' },
    keywords: ['refresh', 'update', 'cloud sync', 'in progress', 'loading'],
    svg: `<circle cx="48" cy="48" r="30" fill="#EAF3FB"/>
<path d="M48 26a22 22 0 0 1 21 15.4" stroke="url(#syn)" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M48 70a22 22 0 0 1-21-15.4" stroke="url(#syn)" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M62 28.5 70.5 42l-14 2.5Z" fill="#0F6CBD"/>
<path d="M34 67.5 25.5 54l14-2.5Z" fill="#38C6C6"/>
<defs><linearGradient id="syn" x1="26" y1="26" x2="70" y2="70" gradientUnits="userSpaceOnUse"><stop stop-color="#0F6CBD"/><stop offset="1" stop-color="#38C6C6"/></linearGradient></defs>`,
  },
];

/* Lifecycle. Anything not listed here is `published`.
   Kept in one place so a release manager can move an asset between states
   without touching artwork. A `deprecated` entry must name its replacement —
   validation rejects a deprecation that strands consumers. */
export const LIFECYCLE = {
  'file.text-file': { status: 'deprecated', replacedBy: 'file.code-file' },
};

/* Aliases: names an asset used to have, or is commonly called. Search matches
   these, so renaming never strands the people who learned the old name. */
export const ALIASES = {
  'file.word-document': ['Word'],
  'file.spreadsheet': ['Excel'],
  'file.presentation': ['PowerPoint'],
};

/* Descriptions are deliberately sparse. The real library will land with 500+
   assets and mostly empty descriptions, and `npm run validate` reports that
   coverage rather than failing on it — so the placeholder set should show both
   states, not pretend the field is always filled. */
export const DESCRIPTIONS = {
  'file.pdf': 'A page marked PDF. Portable Document Format files.',
  'file.archive': 'A page marked ZIP. Compressed archives and bundles.',
  'windows.empty-state': 'A planet in a starfield. Zero-state surfaces where no content exists yet.',
  'fluent.success': 'A check in a green disc with confetti. Completion and confirmation moments.',
};

export const ICON_SIZES = [12, 16, 20, 24, 28, 32, 48];
export const ILLUSTRATION_SIZES = [96, 128, 192, 256];
