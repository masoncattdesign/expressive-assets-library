# Expressive Assets

The icon and illustration library for **Windows Design Systems** — the artwork, the
metadata that describes it, and the browser designers and engineers use to find it.

| | |
|---|---|
| **Assets** | 38 (32 icons, 6 illustrations) |
| **Browser** | `https://masoncattdesign.github.io/expressive-assets-library/` |
| **Contract** | [`manifest.json`](manifest.json) |
| **Schema** | [`schema/asset.schema.json`](schema/asset.schema.json) |

> **Artwork status: placeholder.** Every SVG in this repo is generated from
> `scripts/sources/specs.mjs` so the pipeline is testable end to end. Swapping in
> the real Windows drawings changes nothing about the schema, the manifest, or
> the site — see [Replacing the placeholders](#replacing-the-placeholders).

---

## Layout

```
assets/
  icons/
    system/      System Icons     — OS surfaces: settings, search, battery…
    product/     Product Icons    — first-party apps: mail, photos, store…
    file/        File Icons       — document types: doc, xls, pdf, zip…
  illustrations/
    windows/     Windows Illustrations
    fluent/      Fluent Illustrations
    product/     Product Illustrations

docs/            The browsing interface (plain HTML/CSS/JS, no build step)
schema/          JSON Schema every asset's meta.json must satisfy
scripts/         Generation, manifest, validation, site assembly
manifest.json    Generated index — the file consumers read
```

Each asset is a folder:

```
assets/icons/system/settings/
  color.svg      Expressive — gradient tile, white glyph
  regular.svg    Outline    — stroked, single color
  filled.svg     Mono       — solid, single color
  meta.json      Metadata for this asset
```

## Metadata

Every field earns its place at 500+ assets: identity that never breaks, enough
text to make the thing findable, one lifecycle axis, and a trail back to source.

| Field | Notes |
|---|---|
| `id` | `<collection>.<slug>`. Stable forever — consumers reference it. Rename `name` instead. |
| `name`, `aliases` | Display name, plus names it used to have. Search matches both |
| `keywords` | Synonyms someone would type who doesn't know the name |
| `description` | One line on what it depicts. Also the duplicate-detector |
| `type` | `icon` or `illustration` |
| `collection` | `system` · `product` · `file` · `windows` · `fluent` |
| `product` | Product artwork only — which product it represents |
| `status` | `draft` · `published` · `deprecated`, plus `replacedBy` |
| `themes` | Which of `color` / `regular` / `filled` exist on disk |
| `sizes` | Pixel sizes the geometry is *legible* at, not what it can scale to |
| `colors` | `primary` / `secondary` baked into the Expressive variant |
| `recolorable` | False for brand marks — the browser greys out the accent picker |
| `variants` | Path to each theme's SVG |
| `figma` | `fileKey` + `nodeId` — traces an asset back to the component that made it |
| `version`, `updated`, `owner` | Provenance |

Two earlier fields are gone on purpose. `status` and `build` were two lifecycle
axes doing one job, and nobody could say what `active` + `alpha` meant together.
`family` overlapped `collection`, and where it carried real information that
information was the product — so it became `product`.

**Theme naming.** The library stores `color` / `regular` / `filled`; the UI labels
them **Expressive** / **Outline** / **Mono**. Same three things, two audiences —
the mapping lives in one constant at the top of `docs/app.js`.

## Using the library

Read `manifest.json`, never the folder tree — the tree is an implementation
detail and the manifest is the contract.

```js
const { assets } = await fetch('https://masoncattdesign.github.io/expressive-assets-library/manifest.json')
  .then((r) => r.json());

const shippable = assets.filter((a) => a.status === 'active' && a.build === 'stable');
const settings = assets.find((a) => a.id === 'system.settings');
// settings.variants.color -> "assets/icons/system/settings/color.svg"
```

Every SVG declares its colors as custom properties on the root, so a host page
can retint one without touching the file:

```html
<style>#ea-system-settings { --ea-primary: #107C10; --ea-secondary: #4CAF50; }</style>
```

`--ea-knockout` sets the color that punches through solid shapes (the hole in a
gear, the label on a file icon). It defaults to white — override it if you place
Mono assets on a dark surface.

## Commands

```bash
npm run generate      # rebuild every placeholder SVG from scripts/sources/specs.mjs
npm run manifest      # rescan assets/ and rewrite manifest.json
npm run validate      # schema + artwork + manifest check, plus a coverage report
npm run build         # validate, then assemble _site/
npm run dev           # assemble _site/ and serve it at http://localhost:4173

npm run figma:survey  # read the Figma file and report what is in it
npm run figma:plan    # show what an import would do, write nothing
npm run figma:import  # export SVGs and write assets/
```

No dependencies. Node 18+ and nothing else — a design-system repo that needs an
`npm install` before it can tell you whether an SVG is valid does not get run
locally.

## The browsing interface

`docs/` is three files: `index.html`, `styles.css`, `app.js`. It reads
`manifest.json` plus build-time sprite files, and gives you search across names,
aliases, ids, keywords and descriptions; sidebar filtering by collection; a
status filter; grid and list views; live theme, size and Windows-accent
switching; arrow-key navigation; and copy/download of the exact SVG on screen.

Two things in it are sized for 500+ assets rather than a demo. Cards render as
empty shells immediately and an `IntersectionObserver` fills in artwork as they
scroll into view, so first paint never waits on SVG payload. And sprites are
chunked **per collection** and fetched on demand — opening System Icons never
downloads the illustration set. A single whole-library sprite is fine at 38
assets and a multi-megabyte stall at 500.

Because it is unbuilt static files, a designer can edit a color token in
`styles.css` and open a PR without installing a toolchain.

`.github/workflows/pages.yml` publishes it on every push to `main`. The workflow
assembles `_site/` from `docs/` + `assets/` + `manifest.json` rather than keeping
a second copy of the artwork inside `docs/`, which would drift.

**Deploy setup:** Pages must be enabled once under *Settings → Pages → Source:
GitHub Actions*. If the repo is ever renamed or forked, update `REPO` at the top
of `docs/app.js` — it drives the "Add Assets" and "View source" links.

## Importing from Figma

`scripts/import-figma.mjs` runs in two passes on purpose. At 500+ components you
do not want a script guessing at your file's structure and writing a thousand
files based on the guess — you want to see the structure, agree the mapping, and
then import.

```bash
export FIGMA_TOKEN="figd_..."        # Settings -> Security -> Personal access tokens
export FIGMA_FILE_KEY="..."          # the segment after /design/ in the file URL

npm run figma:survey                 # 1. what's actually in the file
#    edit figma.config.json          # 2. map each Figma page to a collection
npm run figma:plan                   # 3. what the import would do
npm run figma:import                 # 4. do it
npm run manifest && npm run validate # 5. index and check
```

The survey reports every page, every variant property and its values, how many
component sets carry descriptions, and a sample of names — then drafts a
`figma.config.json` from what it saw. That file is the mapping from your Figma
page names to collections, and it is committed, because how the library is
organised is a reviewable decision.

Three things the importer deliberately does not do:

- **It does not mark anything `published`.** Everything lands as `draft`. Nothing
  becomes publishable until a person has looked at it.
- **It does not invent keywords or descriptions.** Those come out empty and
  `npm run validate` reports the coverage gap. Fabricated search terms are worse
  than none — they return the wrong asset confidently.
- **It marks imported artwork `recolorable: false`.** SVGs exported from Figma
  have their colors hard-coded and none of the `--ea-primary` hooks the
  generated set uses, so the accent picker could not actually retint them. The
  browser greys the picker out with a reason rather than appearing to work.
  Flip these to `true` once artwork has been through a tokenising pass.

Your token never enters the repo — the script reads it from the environment and
`figma-survey.json` / `figma-import-report.json` are gitignored.

## Replacing the placeholders

Each icon is authored once on a 24×24 grid and all three themes are derived from
it. Open `scripts/sources/specs.mjs` and replace an entry's `glyph` with the real
path data, using the semantic classes:

| Class | Expressive | Outline | Mono |
|---|---|---|---|
| `.f` | filled white | stroked | filled |
| `.s` | stroked white | stroked | stroked, heavier |
| `.k` | knockout (tile gradient) | stroked | knockout |
| `.lbl` | knockout text | colored text | knockout text |

Two rules that are load-bearing:

1. **Keep every `.f` shape a single path.** A shape composed of overlapping
   circles fills correctly but falls apart in Outline, where each sub-shape gets
   its own visible contour.
2. **Don't overlap `.f` and `.s` in the same region** — in Expressive both are
   white and the detail disappears. Use `.k` for anything that sits on top of a
   filled shape.

Then `npm run generate && npm run manifest && npm run validate`.

If the real artwork arrives as finished per-theme SVGs rather than geometry to
re-author, drop them straight into `assets/<type>s/<collection>/<slug>/` alongside a
`meta.json`, skip `npm run generate`, and run the manifest and validate steps.
The generator is a convenience for authoring, not a requirement of the format.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
