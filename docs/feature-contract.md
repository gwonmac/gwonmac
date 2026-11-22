# Feature contract

A Feature is one thing a player can turn on: a card in the launcher's Features tab, a
Feature page there (and in the Hub's Settings) with its switch, options and shortcuts, and a
page on www.gwonmac.com. Each Feature is one folder,
`app/features/<folder>/`, and one entry in `FEATURES` in
[`app/features/index.ts`](../app/features/index.ts). Everything else derives from them.

This page is enough to add a **group A** Feature: one that reads the game through the
typed building blocks and draws on screen, with no memory of its own, no window, no Hub
page and no main-process part. For those, and for new client facts, read
[Core and Tools development](enhancement-development.md).

Code owns the exact values; this page links to it.

## Safety rules

Every Feature follows the product safety rule in [AGENTS.md](../AGENTS.md#the-product-safety-rule).
For a group A Feature that means:

- Read the game only through `game.*` and draw only through `ui.*` or your own DOM element.
  No memory reads, pointers, packets, generic calls or writes, and no new reader in the
  renderer.
- Display only. No input it sends for the player, no bots, macros, chat or trade automation.
- A DOM element you draw is pointer-transparent (`pointer-events: none`), or only
  draggable to move it, with its place stored in settings.
- List in `uses` every verifier capability the Feature needs, and the certified stage it runs
  on (`STAGE_USES`; Maps runs on the `cartography` stage). Without proof of each one, it does
  not start; the untouched official client stays playable.
- No network. Only a `main` part may reach the hosts in `network`.
- Never log names, account identifiers, chat text or local paths.

**If no block gives the value you need, stop.** A new value is a new client fact: it needs
a certified capability, a kernel field and a block (see
[ArenaNet compatibility](arenanet-compatibility.md) and
[Research a new client fact](enhancement-development.md#research-a-new-client-fact)). That
is platform work, not a group A Feature. Do not read it any other way.

## Start

```bash
pnpm new-feature quickNote --kind combat   # --purpose picks another player goal
pnpm check
```

The id is camelCase; the folder is its kebab case (`quickNote` → `app/features/quick-note/`).
The scaffold ([`scripts/new-feature.ts`](../scripts/new-feature.ts)) writes the folder with a
game part that does nothing visible, adds the Feature to `FEATURES` and its part's export line
to `app/features/companion-parts.ts`, and passes every contract check as written. It refuses an id that exists.
Then fill in the summary, the README and the game part, and run `pnpm check` again.

## The folder

| File | Owns |
| --- | --- |
| `feature.ts` | The manifest (`defineFeature`), read by every process. Data only. |
| `companion.ts` | The game part (`featurePart`), renderer only. |
| `README.md` | What it does, for players: the launcher's Feature page and `/docs/<folder>` on the website. |
| `CHANGELOG.md` | One `- ` bullet per player-facing change under `## Unreleased`. |
| `media/` | `shot-1.webp`, `shot-2.webp`, … one per `shots` caption (`.gitkeep` while empty). |
| `renderer/` | Other renderer-only modules of the Feature (DOM, formatting). No Node.js. |
| `shared/` | Pure logic or types that two processes read. |

Every module under `app/` starts with a block comment that says what it owns.

## The manifest

[`app/features/define.ts`](../app/features/define.ts) documents each field. TypeScript checks
the shapes; [`app/features/contract.ts`](../app/features/contract.ts) checks the rest, and
`tests/policy/feature-contract.test.ts` runs it on every folder in `pnpm check`.

| Field | What | Guarded by |
| --- | --- | --- |
| `id` | camelCase; the folder is its kebab case; listed once in `FEATURES` | contract: id matches folder, registered, listed once |
| `name`, `summary` | Card title and one plain sentence under it | contract: not empty |
| `kind`, `purpose` | Features tab groups (`FEATURE_KINDS`, `FEATURE_PURPOSES`) | TypeScript; contract: every card names a purpose |
| `icon` | A Lucide icon name in kebab case | contract: kebab case; launcher test: the name is in [`feature-icon.ts`](../app/ui/launcher/src/feature-icon.ts), which imports only the icons Features use (pick one there, or add a line) |
| `settings` | The switch, and options (below) | contract: one switch, labels and help |
| `settingsHelp` | Optional: one line under Settings on its Feature page, for a rule that spans its options (Reminders: an item and a time) | contract: not empty when present |
| `region` | `any`, `non-pvp` or `pve` | TypeScript; `resolve` applies it |
| `uses` | Verifier capabilities and certified stages it cannot work without | contract: each one is in `ENHANCEMENT_CAPABILITY_FIELDS` or `STAGE_USES`; a folder that imports a stage's contract (`app/shared/cartography-spike.ts`) names that stage |
| `requires` | Features that must be on for this one to run | contract: ids exist, no cycles |
| `tool` | `{ id: "<folder>" }`: the id its switch is saved and searched under (`tool:<id>`) | TypeScript; contract: the Feature has a switch of its own |
| `shots` | Captions for `media/shot-N.webp` | contract: one file per caption, no file without one |
| `parts` | The part kinds it has; group A has `["game"]` | contract: `game` when `companion.ts` exists, `main` exactly when `main.ts` exists; TypeScript: `featurePart` builds only for a Feature that lists `game` |
| `links`, `offers` | Calls between Features (below) | contract and [`links.ts`](../app/features/links.ts) types |
| `network`, `hub`, `shortcuts`, `programs`, `optInWithTools` | Not used by group A | see `define.ts` |

## The game part

```ts
export default featurePart("quickNote", ({ game, ui, settings, links }) => {
  const stops = [game.target.subscribe((target) => { /* draw it */ })];
  return { stop() { for (const stop of stops) stop(); } };
});
```

`featurePart` ([`app/renderer/tools-companion-part.ts`](../app/renderer/tools-companion-part.ts))
runs `start` while `resolve` has the Feature on and stops what it returns when `resolve` turns
it off. Never ask whether the Feature is on. Subscribe or claim in `start`; undo each one in
`stop`. `stop` must leave nothing behind: no element, listener or timer.

The blocks are in [`app/renderer/game-blocks.ts`](../app/renderer/game-blocks.ts):
`game.target`, `game.region`, `game.session`, `game.skillbar`, `game.chat`, `game.effects`,
`game.alcohol`, `game.progress` to read, and `ui.skillLabels`, `ui.skillKeys`,
`ui.effectLabels` to draw. Each block's type says exactly which values it has. A block is
`available` only when the verifier proved the capability behind it (`createGameBlocks`
names it, as `capabilities.<name>`); put that capability in `uses`. `settings` is a block
of the saved settings.

A label of your own is a DOM element in `document.body`, styled inline, removed in `stop`
([`target-readout/renderer/enhancement-readout.ts`](../app/features/target-readout/renderer/enhancement-readout.ts)
is the example). A stylesheet file instead needs a line in `scripts/copy-renderer.mjs`.

Examples: [`skill-cooldowns/`](../app/features/skill-cooldowns/) and
[`target-readout/`](../app/features/target-readout/).

## Settings

- **The switch.** One per Feature, declared with `featureSwitch(fallback, { tools: true })` under
  the key `<id>Enabled`. It names nothing: players see it under the Feature's name and
  summary, so the contract refuses a `label` or `help` on it. A Feature without a switch
  lists in `requires` the Features it runs with. Never rename a released switch key
  ([Feature switches](settings.md#feature-switches)).
- **Options.** Each one is a `setting.*` from
  [`app/shared/settings/define.ts`](../app/shared/settings/define.ts) with a `label` and
  one line of `help`; the contract refuses one without. An option also needs a line in
  `app/shared/settings-catalogue.ts` and a control in the launcher
  ([Add a setting](settings.md#add-a-setting)), so it is not yet a one-folder change.

## Release stages

A Feature, or one option of it, that is still in development stays on main with one manifest
line, `stage: "beta"` or `stage: "dev"`, instead of on a side branch. Without the line it is
stable and shows everywhere.

| Build | Shows |
| --- | --- |
| Development (`pnpm dev`, not packaged) | stable, `beta` and `dev` |
| Packaged Beta or RC (`1.4.0-beta.1`, `1.4.0-rc.1`) | stable and `beta` |
| Packaged Stable (`1.4.0`) | stable only |

Bootstrap derives the build's stage once (`buildStage` in
[`app/shared/release.ts`](../app/shared/release.ts)), and the Feature facts carry it to the
launcher, the Hub and every game window.

- **A staged Feature** (`stage` on its `defineFeature`): where the build does not show it,
  `resolve` answers off with `not-in-release`, a reason players never read. The catalog does not
  list it, its Hub rows and shortcuts do not exist, Settings search does not find it, and its
  website page is not built.
- **A staged option** (`stage` in its `setting.boolean(...)` options): no Feature page draws it,
  Settings search does not find it, and the game reads it as `false`, so its code does not run.
  The stored value stays as it is. Only a boolean option that is not the switch may have a stage
  (the contract checks it); stage a whole Feature on its manifest.
- **The label.** Where it shows, a staged Feature or option has a "Beta" (or, in development
  builds, "Dev") label beside its name, on its Feature page and its option row.
- **Words for players wait.** A staged Feature's README stays in place (the website leaves its
  page out). A staged option's README lines move to `STAGED.md` beside the README, with where they
  go back; the contract refuses a README that names a staged option. Its CHANGELOG bullet starts
  with the setting key, `- [cartographyQuestRouteEnabled] Leads to your quest.`; the release
  notes leave it out, and it stays under `## Unreleased`, until a release shows the option
  ([releasing](releasing.md#feature-notes)).

**Ship it:** delete the `stage` line. For an option, also move its lines from `STAGED.md` back
into the README. The next release that shows it lists its CHANGELOG bullet without the key.

## Links between Features

A Feature that calls another names it in `links` (`{ whispers: ["open"] }`); its part gets
`links.whispers`, typed from the target's `shared/link.ts` and null while the target is off.
A Feature that offers a link lists the method names in `offers` and registers its type once
in `FeatureLinkApis` ([`app/features/links.ts`](../app/features/links.ts)). The contract
refuses a link to an unknown Feature, to one that offers nothing, to a method it does not
offer, or to itself. Features never call each other through window events.

A Feature with a window of its own that its shortcut and Hub row open offers `toggle`
(`ToolLink` in [`links.ts`](../app/features/links.ts)) instead of naming a `tool.event`:
the shortcut calls it with `toggle`, the Hub row with `show`, and it answers `"shown"`,
`"hidden"` or `"unavailable"`. [`whispers/`](../app/features/whispers/) is the example.
The type check refuses a manifest with `offers` whose link type is not registered in
`FeatureLinkApis`, and a unit test refuses a manifest that lists a `window` part without its
line in [`window-parts.ts`](../app/features/window-parts.ts).

`tool.event` is left only for Call Target: its chord is balanced against the keys the player
holds, which only the input host knows, so the input host claims `gw:call-target`
([`input.ts`](../app/renderer/input.ts)) instead of a Feature part offering `toggle`. A new
tool offers `toggle`; a Hub row never opens through an event.

Shortcuts, menu items and Hub rows open a tool through `toggleTool` in
[`feature-links.ts`](../app/renderer/feature-links.ts), never the link itself; a Feature that
names `toggle` in its manifest `links` calls it there and words its own refusal (the Build
Library's storage button opens [Xunlai Storage](../app/features/xunlai-storage/shared/link.ts)). It answers
`ToolAnswer`: `"shown"`, `"hidden"`, or why the tool did not open, as `resolve`'s own off
value (`{ on: false, reason }`). While resolve has the Feature off, that is resolve's reason
(off in settings, needs an update, needs another Feature, …). While the Feature is on but its
part is not running yet or its `toggle` answered `"unavailable"`, it is `wrong-area`: the game
cannot open the tool where the character is now. `offReasonText` in
[`feature-status.ts`](../app/shared/feature-status.ts) words each reason the way the
launcher's Features tab and the Hub already do, so a caller never writes its own. The Hub
row shows it as the row's refusal. A refused shortcut, menu item or `/trade` alias shows
nothing yet: main only logs the Tools window's refusal.

**A key pressed right after a shortcut stays with the game.** A tool that opens over the
game takes the keyboard a frame later, and the next key the player presses cancels that
(Trade's pending focus in [`toolbox-foundation.ts`](../app/renderer/toolbox-foundation.ts)).
That works only if the tool opened before the key ran, so the path from the renderer command
to the open call never awaits: the command router
([`commands.ts`](../app/renderer/commands.ts)) keeps its tables and `toggleTool` as values
loaded once at window start, `toggleTool` calls the link directly, and `toggle` returns a
value, never a promise (its type refuses an `async` one). A Feature's `toggle` must open, or
start opening, before it returns; a tool that loads later keeps a pending focus that the next
key cancels. `tests/unit/main-to-renderer-commands-carry-values-not-source.test.ts` checks
the order for every Feature that offers `toggle`.

## README and CHANGELOG

The README is the Feature's only player documentation. The contract allows a small
Markdown subset, so the launcher and the website show the same text:

- Start with a plain sentence that says what it does.
- `###` headings only; a Feature with a switch has a `### Details` section with a
  `- **Turn on:** ` line, as the scaffold writes it.
- Paragraphs, lists, **bold**, `code`, `<kbd>` keys, `:setting[Label]{to="section/key"}`, and
  one `>` note.
- Links only to `https://www.gwonmac.com` or a docs page as `$docs.<page>`. No images,
  tables or other HTML.
- Nothing about an option that still has a `stage` ([Release stages](#release-stages)).

The CHANGELOG keeps a `## Unreleased` heading. Add one `- ` bullet per player-facing change
under it; `pnpm release:notes` stamps the version and builds the release notes from it
([releasing](releasing.md#feature-notes)).

## What the verifier gates

[`resolve`](../app/shared/feature-resolve.ts) is the only on/off decision. It turns a Feature
on only when its switch (or the Features it `requires`) is on, the player is not playing the
plain game, the area fits `region`, and the verifier proved, for this exact client build,
every capability and stage in `uses`. What a capability must prove is in
[ArenaNet compatibility](arenanet-compatibility.md). A Feature cannot grant itself a
capability, and a product setting cannot either.

## Checks

`pnpm check` runs typecheck, lint, the unit, certification and policy tests and the UI tests. For a Feature:

- the contract on every folder (`tests/policy/feature-contract.test.ts`), each message naming
  the file and what to change;
- `tests/unit/every-companion-part-is-registered.test.ts`: a `companion.ts` with no line in
  `companion-parts.ts`, or with another Feature's id;
- `tests/policy/feature-docs.test.ts`: the website page and `$docs.<page>` links;
- ESLint import boundaries: renderer code outside the folder reaches only `feature.ts`,
  `renderer/host.ts` and `shared/`;
- the metric ceilings in `scripts/feature-metrics-ceilings.json` (never raise one); a hit that
  is correct where it is (a certified stage, a kernel region, a fixture) goes in
  `scripts/feature-metrics-allowed.json` with a category and a reason;
- `tests/certification/feature-region-gating.test.ts`: the safety rules over every Feature in
  `FEATURES` (a confirmed PvP map turns it off unless its `region` is `any`, an unknown area
  keeps a `pve` Feature off, a developer program replaces the saved switches, and without a
  program it needs `gwonmacTools` and its own switch on). It is Must stay in AGENTS.md, and a
  new Feature does not edit it; only a new `region: "any"` Feature, a safety decision, adds
  itself to the list of Features allowed on a PvP map.
- `tests/certification/window-area.test.ts`: only the Features it lists declare
  `windowArea: "any"` (a window that opens outside its `region`, the Build Library's saved
  authoring), each one has a window part and a `non-pvp` or `pve` region. A new exception is a
  safety decision and edits that list.

### Shared files a new Feature touches

The scaffold writes both registry lines: the Feature in `FEATURES` and its game part's
`export { default as <id> } from …` line in `app/features/companion-parts.ts`. The renderer is
one static Rollup graph and the unit tests run the TypeScript directly, so a game part needs
that import line (a generated list would need a build plugin);
`every-companion-part-is-registered.test.ts` names a missing line. The order of the parts does
not matter.

A part that owns memory (a certified stage with its own region, as Reminders' chat print) also
takes a place in `COMPANION_HEAP_LAYOUT` (`app/renderer/tools-companion-part.ts`): add its id at
the end, so the memory that already works never moves. The installer refuses a part that
allocates, names a region or frees memory without a place, and
`tests/unit/the-companion-heap-layout-stays-fixed.test.ts` pins the layout. A group A Feature
owns no memory and never touches it.

Tests and fixtures that list every Feature keep literal values for the Features they name and
take a newer Feature's rows from its manifest, so a new Feature adds nothing to them:

| File | A Feature it does not name |
| --- | --- |
| `tests/unit/player-data-fixtures.test.ts` | Its stored switch comes from `settings`, or from the Features it `requires`. Once a release stores the switch, add the Feature's line to `STORED_SWITCHES`. |
| `tests/unit/settings.test.ts` | Its settings join the literal defaults and the saved key list. A Core setting, or one of a Feature the lists name, still needs its line. |
| `tests/helpers/packaged-enhancement-scenarios.ts` | Its Tools settings take their defaults in each probe. |
| `app/ui/launcher/src/fixtures.ts` | Its tool takes its switch's default in `tools.features`. |
| `tests/unit/feature-selection.test.ts` | Its rows come from the rules in `tests/certification/feature-region-gating.test.ts`. Add literal values only to pin a case the rules do not decide. |

One file still takes a line by hand:

| File | Add |
| --- | --- |
| `app/ui/launcher/src/feature-icon.ts` | Only for an icon no Feature uses yet: its import and its line. The launcher bundles only the icons Features name. |

Do not run the Electron or Playwright suites locally; CI runs them
([AGENTS.md](../AGENTS.md#commands)).
