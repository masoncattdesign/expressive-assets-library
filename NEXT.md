# Next

The working list. Say **"start the list"** and we go through it in order.

Written to be picked up cold, so it repeats things you already know. Each item
says what it is, why it matters, and what it is waiting on. Anything that needs
a decision from you is marked and collected again at the bottom.

Cross off by deleting. Reorder freely.

---

## Where things stand

3,234 assets, 14,114 drawings, all valid, all published. 980 drawings carry
`generated`, meaning they were produced here rather than received.

| Collection | Count | Sizes | Styles | Matrix |
|---|---|---|---|---|
| Product Icons | 90 | 16–48 (12 of them also 12) | Standard, Outline, Filled | 88% |
| App Icons | 32 | 64 | Standard | 100% |
| Third Party | 61 | 32 | Standard, Filled | 97% |
| File Icons | 88 | 16–256 (8 of them also 64) | Standard, Outline | 91% |
| System Icons | 2,891 | 20, 24 | Outline, Filled | 92% |
| OOBE Illustrations | 27 | 128–362 | Standard | 100% |
| M365 Illustrations | 40 | 512 | Standard | 100% |
| Product Illustrations | 5 | 128–228 | Standard | 100% |

"Matrix" is how full the style-by-size grid is for that collection. A collection
at 100% may still be thin: App Icons is complete because it has one size and one
style, not because it is finished.

Tools are at 2.0. The Figma sync plugin writes; nothing reads back yet.

---

## The list

### 1. Fill out App Icons

32 Windows app tiles at 64px, Standard only. They need the six smaller sizes
scaled down from 64, and Outline and Filled derived. Everything generated gets
flagged, same as the product gaps.

Decided already: 64 joins the whole Product Icons group, so the existing 90 get
a 64 scaled up from 48. That will look soft and the flag will say so.

Nothing blocking. Reuses `scripts/fill-product-gaps.mjs` and the derive logic in
`scripts/rebuild-file-styles.mjs`.

### 2. Even up Product Icons

12 of the 90 carry a 12px size the other 78 do not, which is the whole of that
collection's 12% gap. Either 12 becomes a real size for all 90 or it comes off
those 12. Worth a look before generating: a 12px icon is a different drawing,
not a small one.

**Needs a decision.**

### 3. Decide whether Illustrations get derived styles

M365 is 40 drawings at 512, Standard only. Outline and Filled were derived for
the previous 28 at 160px and the results were mixed. At 512 the luminance
approach has more to work with, but these are brand illustrations rather than
spots.

Plan: derive one, look at it together, then decide for all 40 and for OOBE and
Product Illustrations too.

**Needs a decision, after seeing one.**

### 4. Even up File Icons and System Icons

- **File Icons**: 8 of the 88 have a 64 the other 80 do not. 160 drawings.
- **System Icons**: 385 have only a 20 and 25 have only a 24. 928 drawings.
  These are Fluent's own gaps rather than ours, so the question is whether we
  generate over them or leave the collection honest about what Fluent ships.

**System Icons needs a decision.**

### 5. Re-sync Figma

The plugin has not run since File Icons changed shape and two collections
appeared. Per collection:

- **File Icons** — Filled is gone, 799 drawings deleted, Outline is what was
  previously mislabelled. The page in Figma is stale.
- **App Icons**, **Third Party** — never synced.
- **System Icons** — 2,891 cards. Think about the board size before pressing it;
  two styles at two sizes is a different card shape from the 3 × 6 one.

The plugin's collection list in `plugin/ui.html` is hardcoded and still says
product / file / system. It needs the two new ones.

Run `npm run test:plugin` first. It catches the layout regressions that cost
three runs in Figma yesterday.

### 6. Build the pull half of the round trip

The plugin writes to Figma. Nothing reads back. Every variant it writes carries
a hash of the drawing in *shared* plugin data, which is the kind the REST API
can read, so a pull can tell a cell nobody touched from a cell you redrew
without comparing artwork.

**First step is to prove that.** Fetch one node over REST with `FIGMA_TOKEN` set
and confirm `sharedPluginData` comes back. The whole design rests on it and it
has never been tested. If it does not work, the round trip needs rethinking
before anything else is built on top.

Then: hash matches, skip and stay `generated`. Hash differs, import and clear
the flag, because the drawing is authored now.

See "The round trip" in the README. Pull targets live in `figma-sources.json`.

### 7. Settle the naming grammar

2,698 of 3,234 ids carry a hyphen inside a name segment, which Bridge's scheme
does not allow. It grew by 33 yesterday and grows with every import.

Published means the drawing is real, not that the id is final — that is written
into About and the System Map — so this is not urgent, but it is the one thing
that gets more expensive every day.

**Needs a decision**: the ids change, or the grammar does.

### 8. Put the site behind a sign-in

GitHub Pages has no access control of any kind. `DEPLOY.md` has the Azure Static
Web Apps and Entra path written out, the workflow is in the repo and parked on
`workflow_dispatch`, and the tenant id is still `REPLACE-WITH-YOUR-TENANT-ID`.

More pressing now than it was: 61 third-party brand marks are on that URL.

### 9. Publishing bar

Everything is published on the basis that the artwork was received. There is no
review step behind that, and `deprecated` has never been used on anything, so
that path has never been walked. Worth deciding what publishing should actually
assert before anyone outside relies on it.

---

## Waiting on you

1. **12px on Product Icons** — real size for all 90, or off the 12 that have it.
2. **Derived styles for Illustrations** — after we look at one.
3. **System Icons gaps** — generate over Fluent's missing sizes, or stay honest.
4. **Naming grammar** — ids change or the grammar does.
5. **3P licence review** — 61 marks are imported and public. If it lands badly,
   pulling them is one gitignore line and one build exclusion, and git history
   keeps them regardless.

---

## Upstream, in the Figma file

Found while importing. None of it blocks us; all of it is cheaper to fix at the
source than to keep working around.

- **M365 Brand**: two frames are both called `Chat` and hold different drawings
  (`582232:12654`, `582232:12849`). Imported as `m365.chat` and `m365.chat-2`.
- **M365 Brand**: `Workflow` and `Workflows` are different illustrations one
  letter apart. `Inbox` and `Inbox Empty` read like a state pair expressed as
  two frames.
- **App Icons**: `App36` exists twice with the same value and different node
  ids, which a component set should not permit. `App26` is hidden and parked
  outside the frame. `Blank` is an empty tile. All four excluded on import.
- **App Icons**: casing is inconsistent — `AdminCenter` and `FeedbackHub` beside
  `Command Prompt` and `File Explorer`.
- **3P Icons**: four naming schemes across 61 brands. Most are
  `Size=32, Theme=Color`; five carry Figma's defaults (`Property 1=32`); Adobe
  Indesign has the properties reversed; Adobe Photoshop has no Size property.
- **3P Icons**: `Store DarkTheme` and `Store LightTheme` bake the theme into the
  variant value rather than using a property. Imported as two assets, since the
  library has no light/dark artwork axis and inventing one for a single icon is
  a bad precedent.
- **3P Icons**: `Theme=Regular` and `Theme=Filled` are used for the same role on
  different brands.
- **3P Icons**: four brands ship only one mark — Apple and MCP have no colour
  version, Content Credentials and Polly have no mono.
