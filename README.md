# Expressive Assets

The icon and illustration library for **Windows Design Systems** — the artwork, the
metadata that describes it, and the browser designers and engineers use to find it.

| | |
|---|---|
| **Assets** | 3,318 — 2,891 Fluent system, 338 VS Code, 46 product, 27 OOBE illustrations, 16 placeholder |
| **Browser** | `https://masoncattdesign.github.io/expressive-assets-library/` |
| **Contract** | [`manifest.json`](manifest.json) |
| **Schema** | [`schema/asset.schema.json`](schema/asset.schema.json) |

> **Artwork provenance.** System icons are Fluent System Icons (MIT, Microsoft).
> Product icons are a Figma export of the Microsoft product marks. File icons and
> illustrations are still placeholders generated from `scripts/sources/specs.mjs`.
> See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and each asset's `source`.

---

## Layout

```
assets/
  icons/
    system/      System Icons     — OS surfaces: settings, search, battery…
    product/     Product Icons    — first-party apps: mail, photos, store…
    file/        File Icons       — document types: doc, xls, pdf, zip…
    vscode/      VS Code Icons    — VS Code UI glyphs: debug, git, terminal…
  illustrations/
    oobe/        OOBE Illustrations — out-of-box setup: wifi, PIN, privacy…
    windows/     Windows Illustrations
    fluent/      Fluent Illustrations
    product/     Product Illustrations

docs/            Gallery — the browsing tool (plain HTML/CSS/JS, no build step)
schema/          JSON Schema every asset's meta.json must satisfy
scripts/         Generation, manifest, validation, site assembly
manifest.json    Generated index — the file consumers read
```

Each asset is a folder:

```
assets/icons/system/settings/
  standard-any.svg   Standard — full colour, one scalable drawing
  outline-20.svg     Outline  — monochrome, drawn for 20px
  outline-24.svg     Outline  — drawn for 24px, a different drawing
  filled-20.svg      Filled   — monochrome, the solid weight
  filled-24.svg
  meta.json          Metadata for this asset
```

The size in the filename is not decoration. Windows artwork is redrawn per size
— the 16px Excel icon is a different drawing from the 48px one, not a scaled
copy — so `variants` is keyed theme → size. Artwork that genuinely is one
scalable drawing uses the single key `any`.

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
| `collection` | `system` · `product` · `file` · `vscode` · `oobe` · `windows` · `fluent` |
| `product` | Product artwork only — which product it represents |
| `status` | `draft` · `published` · `deprecated`, plus `replacedBy` |
| `themes` | Which of `standard` / `outline` / `filled` exist on disk |
| `sizes` | Pixel sizes the geometry is *legible* at, not what it can scale to |
| `colors` | `primary` / `secondary` baked into the Standard variant |
| `recolorable` | False for brand marks — the browser greys out the accent picker |
| `variants` | Theme → size → SVG path. Windows artwork is redrawn per size, so each drawing is kept |
| `figma` | `fileKey` + `nodeId` — traces an asset back to the component that made it |
| `source` | Upstream project, licence and copyright for vendored artwork |
| `version`, `updated`, `owner` | Provenance |

Two earlier fields are gone on purpose. `status` and `build` were two lifecycle
axes doing one job, and nobody could say what `active` + `alpha` meant together.
`family` overlapped `collection`, and where it carried real information that
information was the product — so it became `product`.

**Theme naming.** `standard` is the full-colour base; `outline` and `filled` are
its monochrome reductions. Keys and labels match deliberately, and `filled`
matches what the upstream sources already call it — Fluent ships `filled`, and
the Figma style axis is spelled `Filled` — so the importers no longer translate
the name on the way in. An earlier split had `regular` meaning Outline here while
Fluent uses "regular" for the full-weight base — the kind of collision that costs
someone an afternoon.

## Using the library

Read `manifest.json`, never the folder tree — the tree is an implementation
detail and the manifest is the contract.

```js
const { assets } = await fetch('https://masoncattdesign.github.io/expressive-assets-library/manifest.json')
  .then((r) => r.json());

const shippable = assets.filter((a) => a.status === 'published');
const settings = assets.find((a) => a.id === 'system.settings');
// settings.variants.outline[24] -> "assets/icons/system/settings/outline-24.svg"
// settings.variants.standard.any -> the one scalable full-colour drawing
```

`manifest.json` is 4.6 MB uncompressed and ~185 KB gzipped, which is what
GitHub Pages actually serves. If you only need part of it, filter on `collection`
after fetching rather than walking the asset tree.

Every SVG declares its colors as custom properties on the root, so a host page
can retint one without touching the file:

```html
<style>#ea-system-settings { --ea-primary: #107C10; --ea-secondary: #4CAF50; }</style>
```

`--ea-knockout` sets the color that punches through solid shapes (the hole in a
gear, the label on a file icon). It defaults to white — override it if you place
Filled assets on a dark surface.

## Commands

```bash
npm run generate      # rebuild every placeholder SVG from scripts/sources/specs.mjs
npm run notices       # regenerate THIRD-PARTY-NOTICES.md from asset `source` fields
npm run manifest      # rescan assets/ and rewrite manifest.json
npm run validate      # schema + artwork + manifest check, plus a coverage report
npm run build         # validate, then assemble _site/
npm run dev           # assemble _site/ and serve it at http://localhost:4173

npm run figma:survey  # read the Figma file and report what is in it
npm run figma:plan    # show what an import would do, write nothing
npm run figma:import  # export SVGs and write assets/
npm run figma:run     # run the reviewed figma-plan.json instead of surveying
```

No dependencies. Node 18+ and nothing else — a design-system repo that needs an
`npm install` before it can tell you whether an SVG is valid does not get run
locally.

## Gallery

**Gallery** is the browsing tool; **Expressive Assets** is the library it shows.
The distinction is load-bearing, not branding: Gallery never touches the asset
tree. It reads `manifest.json` and nothing else, which means it can show any
library that emits that manifest, not just this one.

`docs/` is three files: `index.html`, `styles.css`, `app.js`. It reads
`manifest.json` and the SVGs it points at, and gives you search across names,
aliases, ids, keywords and descriptions; sidebar filtering by collection; a
status filter; grid and list views; live theme, size and Windows-accent
switching; arrow-key navigation; and copy/download of the exact SVG on screen.

Three things in it are sized for the real library rather than a demo, each one
measured rather than assumed:

- **Cards paint lazily.** They render as empty shells and an
  `IntersectionObserver` fills in artwork as they scroll into view. A cold load
  is 51 SVG requests and 37 KB, first artwork at ~440 ms — bounded by the
  viewport, not by the 2,953 assets behind it.
- **Cards are added a page at a time.** Building all 2,891 System Icons cards up
  front cost 2.6 s of DOM construction on every collection switch. Rendering 240
  and growing on scroll took that to **9 ms**. `content-visibility` alone did not
  fix it: it skips layout and paint, not element creation.
- **Drawings are fetched individually, not bundled.** Bundling worked at 38
  scalable assets and collapsed once artwork became per-size — the product icons
  alone are 828 drawings, 2.3 MB for one collection.

Because it is unbuilt static files, a designer can edit a color token in
`styles.css` and open a PR without installing a toolchain.

`.github/workflows/pages.yml` publishes it on every push to `main`. The workflow
assembles `_site/` from `docs/` + `assets/` + `manifest.json` rather than keeping
a second copy of the artwork inside `docs/`, which would drift.

**Deploy setup:** Pages must be enabled once under *Settings → Pages → Source:
GitHub Actions*. If the repo is ever renamed or forked, update `REPO` at the top
of `docs/app.js` — it drives the "Add Assets" and "View source" links.

## Importing Fluent System Icons

The system collection is [Fluent System Icons](https://github.com/microsoft/fluentui-system-icons),
MIT licensed, Copyright (c) 2020 Microsoft Corporation.

```bash
git clone --depth 1 https://github.com/microsoft/fluentui-system-icons.git
node scripts/import-fluent.mjs --from=./fluentui-system-icons --dry-run
node scripts/import-fluent.mjs --from=./fluentui-system-icons
npm run manifest && npm run validate
```

Defaults to 20px and 24px (`--sizes=16,20,24,32` to widen). Fluent ships up to
seven sizes per icon — the full set is 21,645 files, which is a lot of git for a
library that also has to hold your own work.

Two things it does to the artwork:

- **`#212121` becomes `currentColor`**, so every system icon takes a Windows
  accent instead of being locked to near-black.
- **Standard is synthesised.** Fluent has no full-colour system icon, so the
  importer insets the filled glyph in the gradient tile. That artwork is drawn
  here, not shipped by Microsoft — every affected asset says so in its `notes`,
  and `THIRD-PARTY-NOTICES.md` says it again. Artwork that looks official and
  isn't is worse than no artwork.

Keywords come from Fluent's own `metaphor` metadata, which is a real synonym
list rather than a restatement of the name — that plus their descriptions took
the library from 12% to 84% description coverage.

Attribution travels with the artwork: each asset carries a `source` block naming
the project, licence, copyright and upstream URL, and the browser shows it in
the detail panel where someone is about to copy the file.
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) is generated from those blocks
by `npm run notices`, so it cannot drift from what the repo actually contains —
a notices file maintained by hand is a licence problem waiting to happen.

## Importing a folder of illustrations

```bash
node scripts/import-illustrations.mjs --from="~/Downloads/OOBE" \
                                      --collection=oobe --dry-run
```

Deliberately general rather than tied to one set — illustration drops arrive as
a folder of exports more often than not, and the next one should not need a new
script. Add the collection to the schema enum and to `GROUPS` first.

Illustrations are not icons, and the importer treats them differently. They get
one theme (`standard`) because they are scenes, not glyphs with monochrome
reductions. They are marked non-recolorable, because the colour *is* the
artwork. Their palette is read out of their own gradients rather than invented.
And the browser gives them a larger thumbnail — a 360px scene in a 40px box is
a smudge you cannot tell from the next one.

It also reports **embedded rasters**. Three of the OOBE files carry bitmaps
inside the SVG, which will not scale like vector artwork; those assets say so in
their `notes` rather than looking identical to the ones that will.

## Importing VS Code icons

```bash
git clone --depth 1 https://github.com/microsoft/vscode-icons.git
node scripts/import-vscode.mjs --from=./vscode-icons --dry-run
node scripts/import-vscode.mjs --from=./vscode-icons
npm run notices && npm run manifest && npm run validate
```

CC BY 4.0, Copyright (c) Microsoft Corporation — attribution is a licence
condition here, not a courtesy.

**One drawing per icon, not two.** Upstream ships `icons/light` and `icons/dark`,
but they are the same geometry at two colours (`#424242` and `#C5C5C5`).
Importing both would be 338 duplicate files each pinned to a surface the library
cannot know about. The light drawing is rewritten to `currentColor` instead, so
one file adapts to whatever it sits on. The 43 icons carrying semantic colour —
debug states, info badges — keep it.

Standard is synthesised the same way as the Fluent set, and flagged the same
way. VS Code has no full-colour icon.

## Importing a folder export

If you already have artwork exported out of Figma as folders — the shape Figma
produces, `<Asset Name>/Size=24, Theme=Color.svg` — import it directly:

```bash
node scripts/import-folder.mjs --from="~/Downloads/Product Icons" \
                               --collection=product --dry-run
```

Drop `--dry-run` to write. It reports partial coverage, unmapped theme names
and unparseable filenames before touching anything.

Three things it handles that a copy would not. It keeps **every size** rather
than collapsing to one drawing. It strips Figma's dedupe suffixes (`Color-4`)
and tolerates the stray spaces real exports contain (`Theme= Filled`). And it
**namespaces every id** — Figma names gradients things like
`paint0_radial_5634_483`, and inlining forty of those into one page makes
duplicates resolve to whichever came first.

Monochrome themes are rewritten to `currentColor` so they take a Windows
accent. The Color theme keeps its brand gradients untouched, and the browser
detects that per theme at runtime — so the accent picker is offered exactly
where it can do something, and explains itself where it cannot.

## Importing from the Figma API

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

### Running a reviewed plan

Survey → config → import is the right path the first time nobody has read the
file. Once the structure *is* known — which component sets are live, which are
retired, how the size property is spelled in each corner — that knowledge belongs
in a committed plan rather than being re-derived, differently, on every run.

`figma-plan.json` is that file for the **File icons** page of the Expressive
Assets Library. It names 88 assets and the exact Figma node behind each of their
800 drawings, and it records every set it excludes and why. Reviewing it is
reading a diff, not trusting a run.

```bash
npm run figma:run -- --dry-run   # what it will do — needs no token
export FIGMA_TOKEN="figd_..."
npm run figma:run                # render and write
npm run notices && npm run manifest && npm run validate
```

What the plan leaves out, on purpose:

- **87 retired or hidden sets.** Anything upstream named `*Retired*`,
  `Deprecated` or `Do not use`. Importing those and then hiding them in the
  browser is a slower way to arrive at the same place.
- **7 folder sets.** Folders carry extra variant axes (Item Count, Preview) that
  the `theme × size` schema has no room for. They need a modelling decision
  first, so they get their own pass.
- **3 section labels** that are text, not artwork.

A full run also **retires generated placeholders** in any collection it
populates — the ten invented file icons come out once the real drawings land.
It identifies them only by the `Placeholder artwork.` marker the generator
stamps into `notes`, so it cannot touch imported work, and it skips this
entirely on a partial run (`--limit`, `--only`), where pulling placeholders
would open holes rather than close them.

## Replacing the placeholders

Each icon is authored once on a 24×24 grid and all three themes are derived from
it. Open `scripts/sources/specs.mjs` and replace an entry's `glyph` with the real
path data, using the semantic classes:

| Class | Standard | Outline | Filled |
|---|---|---|---|
| `.f` | filled white | stroked | filled |
| `.s` | stroked white | stroked | stroked, heavier |
| `.k` | knockout (tile gradient) | stroked | knockout |
| `.lbl` | knockout text | colored text | knockout text |

Two rules that are load-bearing:

1. **Keep every `.f` shape a single path.** A shape composed of overlapping
   circles fills correctly but falls apart in Outline, where each sub-shape gets
   its own visible contour.
2. **Don't overlap `.f` and `.s` in the same region** — in Standard both are
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
