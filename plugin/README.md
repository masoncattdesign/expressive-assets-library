# Expressive Assets Sync

Builds and updates a Figma page from the library, so a page of artwork can be
kept in step with `manifest.json` instead of being redrawn by hand.

## Running it

Figma desktop, Plugins → Development → Import plugin from manifest, and pick
`plugin/manifest.json`. No build step: the plugin is plain JavaScript.

The plugin fetches over the network, so it needs a source it can reach:

| Source | Use when |
|---|---|
| `https://masoncattdesign.github.io/expressive-assets-library` | Normal. The published site. |
| `http://localhost:4173` | You are running `npm run dev` and want to see local changes before pushing. |

Once the site moves behind Entra sign-in, neither will work: a plugin cannot
carry a browser session. At that point either point it at
`raw.githubusercontent.com` for the repo, or bake the artwork into the plugin at
build time, which is what Bridge Builder does.

## What it does

One direction only, library to Figma. It never writes back, and it never
deletes.

  - Creates one component set per icon, named for the icon, holding eighteen
    variants across two properties: Style (Standard, Outline, Filled) and Size
    (16 to 48). A designer drops "Word" and switches both in the properties
    panel.
  - Replaces the artwork INSIDE an existing component when the library's drawing
    has changed, rather than rebuilding the component. That keeps the
    component's identity, so every instance anyone has already placed updates
    with it. Rebuilding would orphan all of them, which is the main reason to
    componentise now rather than later.
  - Reports anything on the page that the library does not have, rather than
    removing it. A node the library does not know about is usually a designer's
    work in progress, and deleting it would be the worst possible default.

Each variant is named `Style=Standard, Size=48`, which is what Figma reads to
build the two properties. The asset id, style, size and a hash of the drawing
are stored on every component under the `expressiveassets` namespace as *shared*
plugin data rather than private, because the REST API can read shared data. That
is how the trip back into the library will identify what it is looking at
without depending on layer names a designer might reasonably rename.

The hash is what makes "has this changed since last sync" answerable without
comparing SVG text on every run. Sets are matched by stamped asset id rather
than by display name, so renaming an icon in the library does not orphan its
component.

## Placeholders

Variants the library generated rather than authored are drawn on an amber
ground and say so in their component description.
180 of the 1,620 product icon cells are stand-ins today: 84 are the same drawing
shown at another size, 96 are silhouettes derived from Standard. They are on the
page so the matrix is square and the gaps are visible, not because they are
finished.

## What it does not do

There is no automatic sync. Nothing can push into a Figma file unattended, so
someone opens the file and runs this. Going the other way, `scripts/import-figma.mjs`
already renders Figma nodes back into the library; the policy for what happens
when both sides changed is still to be settled.
