# Working on Expressive Assets

Read this first. It is the operating manual, not the documentation — the docs
are in `README.md`, and what is not done yet is in `NEXT.md`.

Mason Catt owns this. Senior UX/UI Designer, Windows Design Systems, Microsoft.

## Say "start the list" and go

`NEXT.md` is the ordered work list, written to be picked up cold. It says what
each item is, why it matters, what it is waiting on, and which decisions are
Mason's rather than yours. Start there unless he says otherwise.

## The one rule the whole thing rests on

`manifest.json` is the only public contract. Consumers never walk the asset
tree. Adding a collection, a style or a size changes nothing in the tools,
which is why a new tool takes an afternoon rather than a sprint.

The second rule: **artwork is redrawn at every size, never scaled.** A 16px
icon is a different drawing from a 48px one, not a smaller copy. This is the
library's central claim, so anything produced here rather than received is
recorded in the asset's `generated` list and surfaces in the Gallery. Never
quietly pass a scaled or derived drawing off as authored.

## House style

- **American spelling.** Color, organize, gray, license, labeled, center.
- **No em-dashes in prose.** Mason has asked for this specifically.
- **Commit messages explain the why**, in full sentences, and name the thing
  that was actually wrong. A commit that says what changed is worth less than
  one that says what was believed, what turned out to be true, and how it was
  proved. Sign off with:

      Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

- **Code comments earn their place** by explaining a decision or a trap, never
  by restating the line below them.

## Before every commit

```
npm run manifest && npm run validate
```

Validation must end `✓ N assets valid; manifest.json is current.` If a script
changed the asset tree, `npm run notices` too.

## Mason pushes, not you

The shell has no GitHub credentials, no `gh`, no SSH key. `git push` fails with
`could not read Username`. Commit freely, then hand him:

```
cd ~/Downloads/expressive-assets && git push origin main
```

## Two filesystems

`device_bash` runs on Mason's machine where this repo lives; `Bash` runs in a
cloud container that cannot see it. Work on repo files with `device_bash`.
Stage files into the container only when you need something it alone has — a
browser for screenshots, a library that will not install on his side.

Rendering the site to check a change: the published site is not reachable from
the container, so stage `docs/`, `manifest.json` and the assets you need, serve
them, and drive Chromium with Playwright at `/opt/pw-browsers/chromium-1194`.

## Things that have bitten, and will again

- **SVG gradient and mask ids are document-global.** Inlining several copies of
  one drawing on a page makes them all paint with the first one's gradients.
  Namespace per copy.
- **A knockout is a hole, not white paint.** Use an SVG `<mask>`. Painting an
  opaque color looks right on one background and wrong on every other.
- **Figma throws if you size a node before it has an auto-layout parent**, and
  `createText` parents to the page — so the throw leaves an orphan layer behind.
  Append first, size second.
- **`node --check` only proves a file parses.** It said nothing when a rewrite
  deleted a function, and nothing when an early `continue` skipped a whole
  layout pass. Run `npm run test:plugin` for the Figma plugin.
- **A test that cannot fail is decoration.** After fixing something, put the bug
  back and confirm the test catches it.
- **Collection ids collide across groups.** Product Icons and Illustrations both
  had one called `product`. Key on group and collection together.

## Published means the drawing is real, not the id

Every asset is `published`. The naming grammar is still unsettled: thousands of
ids carry a hyphen inside a name segment, which Bridge's scheme does not allow,
and those ids will change. This is stated in About and the System Map. Do not
let it quietly become a promise.
