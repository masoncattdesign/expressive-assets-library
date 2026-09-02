# Next

The working list. Say **"start the list"** and we go through it in order.

Written to be picked up cold, so it repeats things you already know. Each item
says what it is, why it matters, and what it is waiting on. Anything needing a
decision from Mason is marked and collected again at the bottom.

`CLAUDE.md` is the companion: that one says how to work in here, this one says
what to work on.

---

## Where things stand

3,234 assets, 15,670 drawings, all valid, all published. 2,536 drawings carry
`generated` — a sixth of the library was produced here rather than received,
and says so.

| Collection | Count | Sizes | Styles |
|---|---|---|---|
| Product Icons | 90 | 12–48 | Standard, Outline, Filled |
| App Icons | 32 | 16–64 | Standard, Outline, Filled |
| Third Party | 61 | 16–48 | Standard, Outline, Filled |
| File Icons | 88 | 16–256 | Standard, Outline |
| System Icons | 2,891 | 20, 24 | Outline, Filled |
| OOBE Illustrations | 27 | 128–362 | Standard |
| M365 Illustrations | 40 | 512 | Standard |
| Device Illustrations | 5 | 128–228 | Standard |

Tools at 2.0. The Figma sync plugin writes components and two documentation
pages; nothing reads back yet.

---

## The list

### 1. Confirm the eleven unnamed App Icons sets

**Blocked on Mason, and it is the highest-value thing on this list.** All 576 of
App Icons' six-size cells are generated, because the only artwork those tiles
have is one drawing at 64. The authored replacements exist, at exactly
16/20/24/28/32/48 in three styles, in the Additional App Icons section.

They cannot be imported because eleven of the sixteen component sets are
literally named `App Name` in Figma, and every card's title text reads "App
icon". `scripts/sources/appsizes-nodes.json` records all 288 node ids and my
visual reading of each set. A wrong reading attaches the wrong drawing to the
right name with nothing to catch it, so nothing is imported until the table is
confirmed.

Three specific questions inside it: whether Store maps to `app.store-light-theme`
or to the separate "Store both themes" set, whether Calendar is
`product.calendar-taskbar` or `product.m365-taskbar-calendar`, and whether Edge
should be replaced at all given it already has all six sizes.

### 2. Prove the round trip is buildable

```
export FIGMA_TOKEN="figd_..."
npm run figma:probe
```

Reads one node and reports whether REST returns the `sharedPluginData` the sync
plugin writes. Everything about the pull half rests on it and it has never been
tested. Five minutes, and if it fails the design needs rethinking before
anything else is built on top.

Then build the pull: hash matches, skip the cell and leave it `generated`; hash
differs, import it and clear the flag, because somebody drew over it.

### 3. Re-sync Figma

The plugin has not run since File Icons changed shape and three collections
appeared. Run `npm run test:plugin` first — it catches the layout regressions
that cost three runs in Figma.

- **File Icons** — Filled is gone, 799 drawings deleted, Outline is what used
  to be mislabelled. The page in Figma is stale.
- **App Icons**, **Third Party** — never synced.
- **System Icons** — 2,891 cards. Think about board size before pressing it;
  two styles at two sizes is a different card shape from the 3 × 6 one.

The two documentation pages are also worth a re-run now that they work.

### 4. Settle the naming grammar

The analysis is done and the answer is narrower than we thought. Run
`npm run naming:report` for the current numbers.

Bridge's rule, from `core/naming/normalize.ts` in the Bridge repo and described
there as the single source of truth: **a segment is conjoined-lowercase with no
internal separators.** `appTile` becomes `apptile`, `in-content` becomes
`incontent`. Token ids join segments with `-` and become CSS custom properties;
key ids join with `.` and are authoring-only.

The reason is not taste. Because a segment never contains `-`, splitting a token
id on `-` recovers its segments exactly, which is what lets Bridge import tokens
back out of CSS. A hyphen inside a segment breaks that round trip.

**2,737 of 3,234 ids (85%) would change.** Two options, both legal:

- **A — conjoin**, matching Bridge's own `apptile`: `product.calendar-taskbar`
  becomes `product.calendartaskbar`. Mechanical, and consistent with Bridge.
- **B — split on the hyphen**: `product.calendar.taskbar`. More readable, but it
  invents hierarchy that is not there, and produces nonsense on some names —
  `product.copilot.for.sales` makes "for" a segment.

**A is the recommendation**, with one catch worth knowing: it collides on two
pairs, and both are real.

| | |
|---|---|
| `system.re-order` + `system.reorder` | different artwork, and Re Order has a 24 that Reorder does not |
| `system.text-box-settings` + `system.textbox-settings` | different artwork |

Those are two genuinely distinct Fluent icons that Fluent named inconsistently.
Conjoining would merge them, so they need a decision of their own before any
rename runs.

**Needs a decision:** A or B, and what to do about those two pairs.

### 5. Even up the remaining collections

- **System Icons**: 385 ship at 20 only and 25 at 24 only. These are Fluent's
  gaps rather than ours, so the question is whether to generate over them or
  leave the collection honest about what Fluent ships. **Needs a decision.**
- **Illustrations**: Standard only. Whether derived styles make sense at 512px
  is worth deciding by looking at one rather than in the abstract. **Needs a
  decision, after seeing one.**
- **Product Icons**: twelve of the ninety carry a 12px the other seventy-eight
  do not. Either 12 becomes real for all ninety or it comes off those twelve. A
  12px icon is a different drawing, not a small one. **Needs a decision.**

### 6. Put the site behind a sign-in

GitHub Pages has no access control of any kind. `DEPLOY.md` has the Azure Static
Web Apps and Entra path written out, the workflow is in the repo and parked on
`workflow_dispatch`, and the tenant id is still a placeholder.

More pressing than it was: sixty-one third-party brand marks are on that URL,
and so is the demo video.

### 7. What publishing should assert

Everything is published on the basis that the artwork was received. There is no
review step behind that, and `deprecated` has never been used on anything, so
that path has never been walked.

---

## Waiting on Mason

1. **The eleven App Icons names** — unblocks 576 cells of real artwork.
2. **Naming: A or B**, and the two colliding Fluent pairs.
3. **System Icons gaps** — generate over Fluent's, or stay honest.
4. **Illustration styles** — after looking at one derived at 512.
5. **12px on Product Icons** — real for all ninety, or off the twelve.
6. **3P licence review** — sixty-one marks are imported and public. Pulling them
   is one gitignore line and one build exclusion if it lands badly.

---

## Upstream, in the Figma file

Found while importing. None of it blocks us; all of it is cheaper to fix at the
source than to keep working around.

- **Additional App Icons**: eleven of sixteen sets are named `App Name`, and
  every card title reads "App icon". This is what blocks item 1.
- **Additional App Icons**: sizes 16/20/24/32/48 exist under both
  `UI margins=True` and `False` with different ids and different artwork. Only
  the True ladder is recorded, since it is exactly the six we want.
- **Additional App Icons**: Edge is missing Regular and Filled across the whole
  False ladder.
- **M365 Brand**: two frames are both called `Chat` and hold different drawings.
  Imported as `m365.chat` and `m365.chat-2`.
- **M365 Brand**: `Workflow` against `Workflows`, and `Inbox` against
  `Inbox Empty`, are one letter and one word apart.
- **App Icons**: `App36` exists twice with the same value and different node
  ids, which a component set should not permit. `App26` is hidden and parked
  outside the frame. Both excluded on import.
- **3P Icons**: four naming schemes across sixty-one brands, and
  `Store DarkTheme` / `Store LightTheme` bake a theme into the variant value.
- **Fluent, upstream**: `Re Order` against `Reorder`, and `Text Box Settings`
  against `TextBox Settings` — four distinct icons, two names apart by a space.
