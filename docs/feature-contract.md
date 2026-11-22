# Feature contract

A Feature is one thing a player can turn on: a card in the launcher's Features tab, a
switch in Settings › Tools, and a page on www.gwonmac.com. Each Feature is one folder,
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
- List in `uses` every verifier capability the Feature needs. Without proof of each one, it
  does not start; the untouched official client stays playable.
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
game part that does nothing visible, adds the Feature to `FEATURES` and its part to
`FEATURE_PARTS`, and passes every contract check as written. It refuses an id that exists.
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
| `region` | `any`, `non-pvp` or `pve` | TypeScript; `resolve` applies it |
| `uses` | Verifier capabilities it cannot work without | contract: each one is in `ENHANCEMENT_CAPABILITY_FIELDS` |
| `requires` | Features that must be on for this one to run | contract: ids exist, no cycles |
| `tool` | `{ id: "<folder>" }`: its row in Settings › Tools | TypeScript; contract: the Feature has a switch of its own |
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

The CHANGELOG keeps a `## Unreleased` heading. Add one `- ` bullet per player-facing change
under it; `pnpm release:notes` stamps the version and builds the release notes from it
([releasing](releasing.md#feature-notes)).

## What the verifier gates

[`resolve`](../app/shared/feature-resolve.ts) is the only on/off decision. It turns a Feature
on only when its switch (or the Features it `requires`) is on, the player is not playing the
plain game, the area fits `region`, and the verifier proved, for this exact client build,
every capability in `uses`. What a capability must prove is in
[ArenaNet compatibility](arenanet-compatibility.md). A Feature cannot grant itself a
capability, and a product setting cannot either.

## Checks

`pnpm check` runs typecheck, lint, the unit and policy tests and the UI tests. For a Feature:

- the contract on every folder (`tests/policy/feature-contract.test.ts`), each message naming
  the file and what to change;
- `tests/unit/every-companion-part-is-registered.test.ts`: a `companion.ts` not in
  `FEATURE_PARTS`, or with another Feature's id;
- `tests/policy/feature-docs.test.ts`: the website page and `$docs.<page>` links;
- ESLint import boundaries: renderer code outside the folder reaches only `feature.ts`,
  `renderer/host.ts` and `shared/`;
- the metric ceilings in `scripts/feature-metrics-ceilings.json` (never raise one).

### Shared files a new Feature touches

The scaffold writes both registry lines: the Feature in `FEATURES` and its game part in
`FEATURE_PARTS` (`app/features/companion-parts.ts`). The renderer is one static Rollup graph,
so a game part needs its import there; `every-companion-part-is-registered.test.ts` names a
missing line.

Tests and fixtures that list every Feature keep literal values for the Features they name and
take a newer Feature's rows from its manifest, so a new Feature adds nothing to them:

| File | A Feature it does not name |
| --- | --- |
| `tests/unit/player-data-fixtures.test.ts` | Its stored switch comes from `settings`, or from the Features it `requires`. Once a release stores the switch, add the Feature's line to `STORED_SWITCHES`. |
| `tests/unit/settings.test.ts` | Its settings join the literal defaults and the saved key list. A Core setting, or one of a Feature the lists name, still needs its line. |
| `tests/helpers/packaged-enhancement-scenarios.ts` | Its Tools settings take their defaults in each probe. |
| `app/ui/launcher/src/fixtures.ts` | Its tool takes its switch's default in `tools.features`. |

Two files still take a line by hand:

| File | Add |
| --- | --- |
| `tests/unit/enhancement-runtime-policy.test.ts` | `<id>Enabled: false` to `off`, `<id>: false` to every expected record (typecheck names them). On the AGENTS.md Must stay list: only add, never change a line. |
| `app/ui/launcher/src/feature-icon.ts` | Only for an icon no Feature uses yet: its import and its line. The launcher bundles only the icons Features name. |

Do not run the Electron or Playwright suites locally; CI runs them
([AGENTS.md](../AGENTS.md#commands)).
