/**
 * The library's numbers, computed once.
 *
 * Both the document sync and the Customizer kit fill the same `data-stat`
 * marks, and a kit that states the full library's counts while holding 389
 * assets is exactly the drift the marks were introduced to stop. One function,
 * two callers.
 */
export function statsFor(manifest, { head = 'unknown', now = new Date() } = {}) {
  const assets = manifest.assets;

  const n = (v) => v.toLocaleString('en-US');
  const pct = (part, whole) => `${Math.round((part / whole) * 100)}%`;
  const title = (s) => s[0].toUpperCase() + s.slice(1);

/* Counting drawings means counting variant cells, not sizes: an asset with
   three themes at six sizes is eighteen drawings, and `sizes` is the union
   across themes rather than a per-theme count. */
  const cells = (a) => Object.values(a.variants).reduce((m, bySize) => m + Object.keys(bySize).length, 0);

  const drawings = assets.reduce((m, a) => m + cells(a), 0);
  const generated = assets.reduce((m, a) => m + (a.generated?.length || 0), 0);
  const themes = [...new Set(assets.flatMap((a) => Object.keys(a.variants)))];
  const status = (s) => assets.filter((a) => a.status === s).length;

/* Bridge's grammar does not allow a hyphen inside a name segment. The
   collection prefix is not a name segment, so the test is on what follows the
   first dot. */
  const hyphenIds = assets.filter((a) => a.id.split('.').slice(1).join('.').includes('-')).length;

  const collections = manifest.groups.flatMap((g) => g.collections);
  const themesOf = (id) => {
  const t = [...new Set(assets.filter((a) => a.collection === id).flatMap((a) => Object.keys(a.variants)))];
  const order = ['standard', 'outline', 'filled'];
  return t.sort((x, y) => order.indexOf(x) - order.indexOf(y)).map(title).join(', ');
};

  const long = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const short = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const stats = {
  assets: n(manifest.total),
  collections: String(collections.length),
  groups: String(manifest.groups.length),
  drawings: n(drawings),
  generated: n(generated),
  themes: String(themes.length),
  retintable: n(assets.filter((a) => a.recolorable).length),
  published: n(status('published')),
  draft: n(status('draft')),
  deprecated: n(status('deprecated')),
  'keywords-pct': pct(assets.filter((a) => a.keywords?.length).length, assets.length),
  'descriptions-pct': pct(assets.filter((a) => a.description).length, assets.length),
  'hyphen-ids': n(hyphenIds),
  head,
  date: long,
  'date-short': short,
};
  for (const c of collections) {
  stats[`count:${c.id}`] = n(c.count);
  stats[`label:${c.id}`] = c.label;
  stats[`themes:${c.id}`] = themesOf(c.id);
}

/* Generated blocks. Each returns the full inner HTML for its fence. */
  const blocks = {
  /* Largest first: the shape of the library is more legible than its
     alphabet, and the reader is looking for the big ones. */
  collections: (indent) =>
    [...collections]
      .sort((a, b) => b.count - a.count)
      .map((c) => `${indent}<tr><td>${c.label}</td><td class="num">${n(c.count)}</td><td>${themesOf(c.id)}</td></tr>`)
      .join('\n'),
};


  return { stats, blocks };
}

/* Stamps rather than facts. A page records the commit it was written at, which
   is always the PARENT of the commit that then contains it, so a page can never
   state its own hash and comparing them fails on every push forever. The dates
   go the same way the following morning. They are written on every sync and
   never enforced; the counts, which must be true, are. */
export const STAMPS = new Set(['head', 'date', 'date-short']);

/** Fill `data-stat` marks and `<!-- stat:x -->` blocks in a page. */
export function fillMarks(html, stats, blocks, onIssue = () => {}) {
  html = html.replace(
    /(<(\w+)(?=[\s>])[^>]*\bdata-stat="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (whole, open, tag, key, inner, close) => {
      if (!(key in stats)) { onIssue(`data-stat="${key}"`); return whole; }
      if (inner !== stats[key] && !STAMPS.has(key)) {
        onIssue(`${key} is "${inner}", should be "${stats[key]}"`, true);
      }
      return open + stats[key] + close;
    }
  );
  return html.replace(
    /([ \t]*)(<!-- stat:([\w-]+) -->\n)([\s\S]*?)([ \t]*<!-- \/stat -->)/g,
    (whole, indent, openTag, key, inner, closeTag) => {
      if (!(key in blocks)) { onIssue(`stat block "${key}"`); return whole; }
      const built = blocks[key](indent) + '\n';
      if (inner !== built) onIssue(`block "${key}" is out of date`, true);
      return indent + openTag + built + closeTag;
    }
  );
}
