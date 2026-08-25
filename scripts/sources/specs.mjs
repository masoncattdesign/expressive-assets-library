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
  /* --- System ---------------------------------------------------- */
  {
    id: 'system.settings',
    name: 'Settings',
    collection: 'system',
    colors: { primary: '#0078D4', secondary: '#8764B8' },
    keywords: ['gear', 'config', 'options', 'preferences'],
    glyph: gearPath(12, 12, 9.4, 6.6) + '<circle class="k" cx="12" cy="12" r="2.9"/>',
  },
  {
    id: 'system.search',
    name: 'Search',
    collection: 'system',
    colors: { primary: '#0078D4', secondary: '#2AA0DA' },
    keywords: ['find', 'magnifier', 'lookup', 'query'],
    glyph:
      '<circle class="s" cx="10.6" cy="10.6" r="6.6"/>' +
      '<path class="s" d="M15.4 15.4 20 20"/>',
  },
  {
    id: 'system.security',
    name: 'Security',
    collection: 'system',
    colors: { primary: '#0F6CBD', secondary: '#3B82D6' },
    keywords: ['shield', 'protection', 'defender', 'safety', 'privacy'],
    glyph:
      '<path class="f" d="M12 2.4 4.6 5.3v6.3c0 4.5 3 8.6 7.4 9.9 4.4-1.3 7.4-5.4 7.4-9.9V5.3Z"/>' +
      '<path class="k" d="m8.7 11.9 2.4 2.4 4.4-4.7"/>',
  },
  {
    id: 'system.files',
    name: 'Files',
    collection: 'system',
    colors: { primary: '#F7A501', secondary: '#EB6B0C' },
    keywords: ['folder', 'explorer', 'directory', 'documents'],
    glyph:
      '<path class="f" d="M5.3 4.4h3.5l2.1 2.5h7.8a2.2 2.2 0 0 1 2.2 2.2v9.2a2.2 2.2 0 0 1-2.2 2.2H5.3a2.2 2.2 0 0 1-2.2-2.2V6.6a2.2 2.2 0 0 1 2.2-2.2Z"/>' +
      '<path class="k" d="M3.3 10.3h17.4"/>',
  },
  {
    id: 'system.clock',
    name: 'Clock',
    collection: 'system',
    colors: { primary: '#1B3A57', secondary: '#0F6CBD' },
    keywords: ['time', 'alarm', 'timer', 'schedule'],
    glyph:
      '<circle class="s" cx="12" cy="12" r="8.6"/>' +
      '<path class="s" d="M12 6.9V12l3.6 2.4"/>',
  },
  {
    id: 'system.calendar',
    name: 'Calendar',
    collection: 'system',
    colors: { primary: '#D83B01', secondary: '#F7A501' },
    keywords: ['date', 'schedule', 'agenda', 'month', 'events'],
    glyph:
      '<rect class="s" x="3.6" y="4.8" width="16.8" height="16" rx="2.6"/>' +
      '<path class="s" d="M3.6 9.4h16.8M8.4 3.2v3.4M15.6 3.2v3.4"/>' +
      '<rect class="f" x="7" y="12" width="3.2" height="3.2" rx="1"/>' +
      '<rect class="f" x="13.8" y="12" width="3.2" height="3.2" rx="1"/>',
  },
  {
    id: 'system.notepad',
    name: 'Notepad',
    collection: 'system',
    colors: { primary: '#F7A501', secondary: '#EB6B0C' },
    keywords: ['notes', 'text', 'editor', 'write', 'document'],
    glyph:
      '<rect class="s" x="4.6" y="3" width="14.8" height="18" rx="2.4"/>' +
      '<path class="s" d="M8 8h8M8 12h8M8 16h5"/>',
  },
  {
    id: 'system.trash',
    name: 'Trash',
    collection: 'system',
    colors: { primary: '#0078D4', secondary: '#2AA0DA' },
    keywords: ['delete', 'recycle bin', 'remove', 'bin'],
    glyph:
      '<path class="s" d="M4.4 6.6h15.2M9.4 6.6V4.9a1.6 1.6 0 0 1 1.6-1.6h2a1.6 1.6 0 0 1 1.6 1.6v1.7"/>' +
      '<path class="f" d="M6.4 8.4h11.2l-.8 11.1a2.1 2.1 0 0 1-2.1 2H9.3a2.1 2.1 0 0 1-2.1-2Z"/>' +
      '<path class="k" d="M10.4 11.6v6M13.6 11.6v6"/>',
  },
  {
    id: 'system.volume',
    name: 'Volume',
    collection: 'system',
    colors: { primary: '#0078D4', secondary: '#2AA0DA' },
    keywords: ['sound', 'audio', 'speaker', 'mute'],
    glyph:
      '<path class="f" d="M11.6 4.2 6.9 8H4.2a1.4 1.4 0 0 0-1.4 1.4v5.2A1.4 1.4 0 0 0 4.2 16h2.7l4.7 3.8a.9.9 0 0 0 1.4-.7V4.9a.9.9 0 0 0-1.4-.7Z"/>' +
      '<path class="s" d="M16.4 9.2a4 4 0 0 1 0 5.6M19 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  },
  {
    id: 'system.network',
    name: 'Network',
    collection: 'system',
    colors: { primary: '#0078D4', secondary: '#2AA0DA' },
    keywords: ['wifi', 'connection', 'signal', 'internet', 'wireless'],
    glyph:
      '<path class="s" d="M2.6 8.6a14 14 0 0 1 18.8 0M6 12.4a9 9 0 0 1 12 0M9.4 16.1a4 4 0 0 1 5.2 0"/>' +
      '<circle class="f" cx="12" cy="19.4" r="1.7"/>',
  },
  {
    id: 'system.battery',
    name: 'Battery',
    collection: 'system',
    colors: { primary: '#123B63', secondary: '#0F6CBD' },
    keywords: ['power', 'charge', 'energy', 'level'],
    glyph:
      '<rect class="s" x="2.6" y="7.4" width="16.4" height="9.2" rx="2.4"/>' +
      '<rect class="f" x="4.8" y="9.6" width="7.6" height="4.8" rx="1.2"/>' +
      '<path class="f" d="M20.4 10.4h.3a1.4 1.4 0 0 1 1.4 1.4v.4a1.4 1.4 0 0 1-1.4 1.4h-.3Z"/>',
  },

  /* --- Product --------------------------------------------------- */
  {
    id: 'product.mail',
    name: 'Mail',
    collection: 'product',
    colors: { primary: '#0F6CBD', secondary: '#2AA0DA' },
    keywords: ['email', 'inbox', 'message', 'envelope', 'outlook'],
    glyph:
      '<rect class="s" x="2.8" y="5" width="18.4" height="14" rx="2.6"/>' +
      '<path class="s" d="m3.6 7.6 7.2 5.1a2 2 0 0 0 2.4 0l7.2-5.1"/>',
  },
  {
    id: 'product.chat',
    name: 'Chat',
    collection: 'product',
    colors: { primary: '#0078D4', secondary: '#2AA0DA' },
    keywords: ['message', 'conversation', 'teams', 'bubble', 'talk'],
    glyph:
      '<path class="f" d="M4.6 3.6h14.8A2.4 2.4 0 0 1 21.8 6v8.6a2.4 2.4 0 0 1-2.4 2.4h-8.8l-4.5 3.2a.8.8 0 0 1-1.3-.7V17A2.4 2.4 0 0 1 2.2 14.6V6a2.4 2.4 0 0 1 2.4-2.4Z"/>' +
      '<path class="k" d="M7.2 8.2h9.6M7.2 12h6.2"/>',
  },
  {
    id: 'product.phone',
    name: 'Phone',
    collection: 'product',
    colors: { primary: '#107C10', secondary: '#4CAF50' },
    keywords: ['call', 'dial', 'contact', 'telephone'],
    glyph:
      '<path class="f" d="M6.6 3.2a2 2 0 0 1 2.6.9l1.5 3a2 2 0 0 1-.5 2.4l-1.3 1a12.6 12.6 0 0 0 4.6 4.6l1-1.3a2 2 0 0 1 2.4-.5l3 1.5a2 2 0 0 1 .9 2.6l-.8 1.7a2.6 2.6 0 0 1-3 1.4C11 19.6 4.4 13 2.7 6a2.6 2.6 0 0 1 1.4-3Z"/>',
  },
  {
    id: 'product.photos',
    name: 'Photos',
    collection: 'product',
    colors: { primary: '#2AA0DA', secondary: '#38C6C6' },
    keywords: ['image', 'gallery', 'picture', 'album'],
    glyph:
      '<rect class="s" x="3" y="4.4" width="18" height="15.2" rx="2.6"/>' +
      '<circle class="f" cx="8.4" cy="9.6" r="1.9"/>' +
      '<path class="f" d="M3.2 17.9 8.4 13a1.6 1.6 0 0 1 2.2 0l3 2.9 2-1.9a1.6 1.6 0 0 1 2.2 0l3 2.9v.7a2.6 2.6 0 0 1-2.6 2H5.6a2.6 2.6 0 0 1-2.4-1.7Z"/>',
  },
  {
    id: 'product.music',
    name: 'Music',
    collection: 'product',
    colors: { primary: '#C239B3', secondary: '#E3008C' },
    keywords: ['audio', 'song', 'note', 'player', 'media'],
    glyph:
      '<path class="f" d="M9.4 18.2V7a1.5 1.5 0 0 1 1.2-1.5l7.8-1.7a1.4 1.4 0 0 1 1.7 1.4v10.6h-2V6.6l-6.7 1.5v10.1Z"/>' +
      '<circle class="f" cx="7.2" cy="18" r="3.1"/>' +
      '<circle class="f" cx="18.1" cy="15.8" r="2.9"/>',
  },
  {
    id: 'product.camera',
    name: 'Camera',
    collection: 'product',
    colors: { primary: '#3A3A45', secondary: '#5D5A88' },
    keywords: ['photo', 'capture', 'lens', 'shoot'],
    glyph:
      '<path class="s" d="M4.4 7.6h2.9l1.5-2.4h6.4l1.5 2.4h2.9A2.4 2.4 0 0 1 22 10v7.4a2.4 2.4 0 0 1-2.4 2.4H4.4A2.4 2.4 0 0 1 2 17.4V10a2.4 2.4 0 0 1 2.4-2.4Z"/>' +
      '<circle class="f" cx="12" cy="13.5" r="4"/>' +
      '<circle class="k" cx="12" cy="13.5" r="1.6"/>',
  },
  {
    id: 'product.store',
    name: 'Store',
    collection: 'product',
    colors: { primary: '#E3008C', secondary: '#8764B8' },
    keywords: ['shop', 'bag', 'apps', 'marketplace', 'purchase'],
    glyph:
      '<path class="f" d="M5.4 7.4h13.2a1.8 1.8 0 0 1 1.8 2l-1.1 9.2a2.6 2.6 0 0 1-2.6 2.3H7.3a2.6 2.6 0 0 1-2.6-2.3L3.6 9.4a1.8 1.8 0 0 1 1.8-2Z"/>' +
      '<path class="k" d="M8.6 9.4V6.8a3.4 3.4 0 0 1 6.8 0v2.6"/>',
  },
  {
    id: 'product.weather',
    name: 'Weather',
    collection: 'product',
    colors: { primary: '#2AA0DA', secondary: '#F7A501' },
    keywords: ['cloud', 'sun', 'forecast', 'climate'],
    glyph:
      '<circle class="f" cx="18" cy="5.9" r="3"/>' +
      '<path class="f" d="M6.8 19.8a4.4 4.4 0 0 1 .5-8.7 5.8 5.8 0 0 1 11.1 1.1 3.9 3.9 0 0 1-.6 7.6Z"/>',
  },
  {
    id: 'product.gaming',
    name: 'Gaming',
    collection: 'product',
    colors: { primary: '#107C10', secondary: '#4CAF50' },
    keywords: ['controller', 'xbox', 'play', 'games'],
    glyph:
      '<path class="f" d="M8.2 6.6h7.6a6.4 6.4 0 0 1 6.3 5.3l.7 4a3.4 3.4 0 0 1-6.2 2.4l-1.2-1.7H8.6l-1.2 1.7a3.4 3.4 0 0 1-6.2-2.4l.7-4a6.4 6.4 0 0 1 6.3-5.3Z"/>' +
      '<path class="k" d="M6.4 11.6v3.2M4.8 13.2h3.2M16.4 12.4h.01M18.4 14.6h.01"/>',
  },
  {
    id: 'product.browser',
    name: 'Browser',
    collection: 'product',
    colors: { primary: '#0F6CBD', secondary: '#2AA0DA' },
    keywords: ['web', 'edge', 'internet', 'globe', 'world'],
    glyph:
      '<circle class="s" cx="12" cy="12" r="8.8"/>' +
      '<path class="s" d="M3.2 12h17.6M12 3.2a13.6 13.6 0 0 1 0 17.6 13.6 13.6 0 0 1 0-17.6"/>',
  },
  {
    id: 'product.maps',
    name: 'Maps',
    collection: 'product',
    colors: { primary: '#D13438', secondary: '#EB6B0C' },
    keywords: ['location', 'pin', 'navigation', 'place', 'directions'],
    glyph:
      '<path class="f" d="M12 2.6a7.4 7.4 0 0 0-7.4 7.4c0 5.3 6.5 11 6.8 11.2a.9.9 0 0 0 1.2 0c.3-.2 6.8-5.9 6.8-11.2A7.4 7.4 0 0 0 12 2.6Z"/>' +
      '<circle class="k" cx="12" cy="10" r="2.6"/>',
  },

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
  'system.notepad': { status: 'draft' },
  'product.gaming': { status: 'draft' },
  'product.sync': { status: 'draft' },
  'file.text-file': { status: 'deprecated', replacedBy: 'file.code-file' },
};

/* Aliases: names an asset used to have, or is commonly called. Search matches
   these, so renaming never strands the people who learned the old name. */
export const ALIASES = {
  'system.trash': ['Recycle Bin'],
  'system.network': ['Wi-Fi'],
  'product.browser': ['Edge'],
  'file.word-document': ['Word'],
  'file.spreadsheet': ['Excel'],
  'file.presentation': ['PowerPoint'],
};

/* Descriptions are deliberately sparse. The real library will land with 500+
   assets and mostly empty descriptions, and `npm run validate` reports that
   coverage rather than failing on it — so the placeholder set should show both
   states, not pretend the field is always filled. */
export const DESCRIPTIONS = {
  'system.settings': 'A gear. Application and system settings, preferences, and configuration surfaces.',
  'system.search': 'A magnifier. Search entry points and find-in-page.',
  'system.security': 'A shield with a check. Security posture, protection status, and Defender surfaces.',
  'system.trash': 'A lidded bin. Delete actions and the Recycle Bin itself.',
  'system.network': 'Signal arcs. Wireless connectivity and network status.',
  'product.mail': 'A sealed envelope. Mail clients, inboxes, and send actions.',
  'product.maps': 'A map pin. Location, place, and navigation.',
  'product.store': 'A shopping bag with a handle. App marketplace and purchase flows.',
  'file.pdf': 'A page marked PDF. Portable Document Format files.',
  'file.archive': 'A page marked ZIP. Compressed archives and bundles.',
  'windows.empty-state': 'A planet in a starfield. Zero-state surfaces where no content exists yet.',
  'fluent.success': 'A check in a green disc with confetti. Completion and confirmation moments.',
};

export const ICON_SIZES = [12, 16, 20, 24, 28, 32, 48];
export const ILLUSTRATION_SIZES = [96, 128, 192, 256];
