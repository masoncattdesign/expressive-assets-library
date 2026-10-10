# Desktop prototypes: notes for the agent

Read this before you change anything. It covers what these files are, how to
run them, how they're built and where things tend to break.

## What this is

These are three working prototypes of desktop concepts. Mason Catt (Windows
Design Systems) built them from Figma frames.

- **Workbench** (`workbench.*`): the desktop works like a living cell.
  - Work happens in the center panel, which the code calls the nucleus.
  - The surrounding widgets stretch, snap, gather and feed the nucleus
    through a goo effect.
  - The Lisbon task turns the nucleus into a working view: Copilot on the
    left, a live document on the right.
  - Stacks takes over the nucleus.
  - The window strip at the top resizes to fit the open windows.
- **Mosaic** (`mosaic.*`): a dark tile grid that grows out from a horizon
  line.
  - Copilot suggests tiles, fills empty slots and builds a whole row from one
    sentence.
  - Tiles can be dragged into open slots.
- **Pinboard** (`pinboard.*`): the desktop as decorated art.
  - Every widget is a sticker you can drag.
  - The + button pours out new stickers through the goo filter.
  - Copilot can restyle the board.

`index.html` is a small launcher. These are explorations, not product code,
and all the content is invented.

## Run it

There's no build step and there are no dependencies. Either of these works:

```
python3 -m http.server 8000
```

```
npx serve .
```

Then open http://localhost:8000. You can also open `index.html` straight from
disk. While you're building, use a local server anyway so you see what the
hosted copy does.

## How it is built

- **Plain HTML, CSS and JavaScript.** There's no framework and no bundler.
  Each desktop is one HTML file, one CSS file and one JS file, plus the shared
  files.
- **`shared.css` and `shared.js`** hold the common shell:
  - `fitStage()` scales `#stage` to fit the window.
  - `ic()`, `iconSrc()` and `appIcon()` handle icons.
  - `installGoo()` adds the goo SVG filter.
  - `draggable()` handles drags in stage coordinates.
  - `store()` wraps localStorage. Keys are prefixed `desktops:`.
  - `protoNav()` draws the pill: desktop switcher, theme switch and Download.
  - `setupThemes()` and `paintIllus()` drive themes and illustrations.
  - Small helpers: `$`, `$$`, `html`, `sleep`, `typeInto`.
- **The canvas is fixed at 1920x1200.** Each desktop is laid out at the
  Figma frame size inside `#stage` and scaled with a CSS transform. Positions
  are absolute pixels taken from the frames. Don't convert to a responsive
  layout unless you're asked to, because staying faithful to the frames is
  the point.
- **Pointer math must use stage coordinates.** Use `stagePoint(e)` or
  `draggable()`, both of which divide by the current scale. Raw `clientX` is
  off by the scale factor.
- **Goo** is the blur-then-threshold SVG filter (`#goo`).
  - The surfaces are plain divs inside a `.goo-layer`.
  - All text and controls sit in a separate `.goo-content` layer above it so
    they stay crisp. Never put text inside a goo layer.
  - In Workbench, `gooGroup()` runs a card pair joined by one centered neck.
  - `enterWork()` / `exitWork()` drive the working view. They morph blobs on
    a full-stage goo layer (`#g-morph`).
  - `absorb()` sends a droplet from a cell into the nucleus.
- **Themes.** `setupThemes(desk, themes, onChange)` handles them.
  - It adds a `theme-<id>` class to `#stage`.
  - It remembers the choice per desktop.
  - It repaints every `[data-illus]` element. Theme looks live in the CSS
    under `.theme-<id>`.
  - Pinboard also swaps palettes, using `pal-*` classes on `#stage`, and adds
    print finishes with `.tex-stipple` and `.tex-pattern`.
- **Colors.** Each theme takes a `colors` list: `[{ id, label, sw, mode, cls, ...overrides }]`.
  - `colors[0]` is the theme as designed. The others restyle it: one more in
    the same mode, and one in the opposite mode (`mode: 'dark'` or `'light'`).
  - Any theme field can be overridden per color (`ink`, `paper`, `pal`, `bot`).
    `THEME` holds the merged result, with `THEME.color` set to the color id.
  - `#stage` gets `data-color="<id>"`, `mode-dark` or `mode-light`, and any
    `cls` the color lists. Style a color with selectors like
    `.theme-windows[data-color="b"]`.
  - Sketch's `--sk-ink` and `--sk-paper` are set inline from the color, so the
    CSS, the outline icons and the redrawn illustrations all agree.
  - `--wp-tint` and `--wp-blend` on `#stage` tint the wallpaper only (through
    `#stage::before`, under every widget). `mix-blend-mode: color` recolors it.
  - Workbench's dark block is `.mode-dark:not(.theme-sketch)`; Mosaic's light
    block is `.mode-light:not(.theme-sketch)`. Pinboard's colors are extra
    `pal-*` palettes stacked on the theme's own (`'riso riso-dark'`).
  - The swatches sit in `#color-pick`; C cycles them. Choices are remembered
    per desktop and per theme.
- **Illustrations** are real pieces from the Windows illustration library.
  - The pieces are in `illus-data.js`, keyed by short name.
  - `illus-engine.js` is the library's own engine. `styled(svg, style)`
    restyles a drawing by color role.
  - The styles are windows, m365, grain, texture, glass, aero, win95, skeuo,
    neon and stipple.
  - To place one, add `<span data-illus="umbrella"></span>`. The current
    theme paints it. If you insert elements later, call `paintIllus(el)`.
- **Shapes and bots** live in `bots.js`.
  - `SHAPES` is a Material 3-inspired shape library (cookies, clovers, bursts, pills, arches, gems, hearts). Every shape is sampled as radii around a center, so `morphPath(path, name)` can morph any shape into any other.
  - `new Bot({ shape, color, eyes, size })` makes a plush bot: fuzzy edges from a turbulence filter, eyes that follow the pointer, and states `default`, `working` (hops) and `sleeping` (dozes after a while alone). `bot.work(ms)`, `bot.poke()`, `bot.setShape()`, `bot.setColor()`.
  - `botsLook({ sketch, ink, paper })` switches every bot to line work for Sketch.
- **Beam** lives in `beam.js`: a rainbow glow that rides the border of
  anything Copilot touches (inspired by libraries.dev/beam).
  - `beam(el, { on, hover, speed, width })` attaches one. Speeds are in degrees per second.
  - `beamOn`, `beamOff`, `beamSpeed`, `beamBoost` (a short surge) and `beamLap` (one trip around, then fade).
  - One loop eases every beam's speed, so it can race while Copilot builds or surge as you type without jumping.
  - Colors come from `--beam-1` to `--beam-4` on the theme, so Neon and Sketch restyle it in CSS.
- **Icons** are real Microsoft icons from the Expressive Assets library, in
  `icons/`.
  - Product and app icons are `<img>` tags.
  - System icons are CSS masks so they take `currentColor`.
  - Chrome refuses CSS masks loaded from `file://`, so `icons.js` inlines
    every icon this copy uses as a data URI.
  - `iconSrc(path)` prefers that data and falls back to `icons/<path>`.
- **Media.** The wallpapers and photos in `media/` were exported from the
  Figma frames.

## Making changes

- **New behavior** goes in that desktop's JS file. Each file is grouped by
  widget, with section comments.
- **New system icon.** Put the SVG at
  `icons/system/<name>/<style>-<20|24>.svg` and call
  `ic('<name>', size, 'outline'|'filled')`. Over a local server that's all
  you need. To keep opening from disk working, also add it to `icons.js` as a
  base64 data URI under the same path key.
- **`[hidden]`** is forced to `display: none !important`, so toggling
  `el.hidden` works on flex and grid elements too.
- **Dragging.** `draggable()` ignores drags that start in `input`,
  `textarea`, `[contenteditable]` or `[data-nodrag]`. The click that follows
  a drag is swallowed on purpose.
- **Saved state.** Pinboard saves sticker positions to localStorage, and
  themes are remembered there too. Clear the `desktops:` keys to reset.
- **Testing.** After a change, open each desktop, try every theme and click
  through what you touched. Watch the console for errors.

## House style (Mason's)

- American spelling. No em-dashes in any copy.
- Content should read like an everyday customer's desktop: trips, book club,
  family, errands. No internal project names, team names or real employees.
- Copilot proposes and the person decides. Suggested tiles need a tap before
  they land, and anything Copilot builds can be undone. Keep that pattern in
  anything new.
