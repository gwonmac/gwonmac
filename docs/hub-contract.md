# Hub interaction contract

The Hub presents commands over Guild Wars. Its navigation and keys belong to the
pure engine in `app/renderer/hub-engine.ts`, tested in Node by
`tests/unit/hub-engine.test.ts`: the page stack, the query, the selection and
menu, the page session, the row or view action running on it (one at a
time: Enter, the footer and Actions name it while it runs, also after a blur
when the page resumes still mounted) and a failure carried across a close. What a list shows and which row it selects (its ranking with
pins, phrases and commands, ties, the initial row and a selection handed on by
a loading row) are pure functions in `app/renderer/hub-results.ts`, tested by
`tests/unit/hub-results.test.ts`. Three more pure modules beside them hold
what the status line says between reports, progress and receipts
(`hub-status.ts`), the session's form drafts (`hub-drafts.ts`) and what the
footer names, its primary and key legend (`hub-footer.ts`), each with its Node
test. `app/renderer/hub.ts` owns the sources, search, the closed-Hub receipt and
the modal, and applies the engine's effects. It names no source: each source says what it adds through the optional
`HubSource` fields in `app/shared/hub.ts`. The built-in sources (accounts, the
calculator, commands, Hub preferences and Settings) attach from the one Core
list in `app/renderer/hub-builtins.ts`, the way a feature attaches its own. A
tool's Tools row, its open event and its place among the Tools rows live in its
manifest's `tool.hub` (`app/features/define.ts`); `app/shared/hub-tools.ts`
derives, from one entry per tool, the rows Core draws, their order, the Commands
page's shortcut rows, the shortcut each row shows and the event each tool
command fires.
Each entry point of `hub.ts` (a DOM event, a presenter call, a timer or a
frame) writes the view model and paints it once when it ends; before it hands
the DOM to a row's action or a page, it paints the finished model first. It
never measures the DOM: the Vue view places the currency art, the Actions menu
and the closed-Hub receipt, scrolls the results, and reports the geometry a page
records. Where the keyboard goes is a focus target in the view model
(`app/shared/ui/hub-view.ts`); the Vue focus kit
(`app/ui/tools/src/hub/hub-focus.ts`, `focus-zone.ts`) applies it after the
paint and owns arrows inside each zone and the fallback when a focused control
goes away. Every Hub view names its controls with `data-focus-key`, so the
keyboard can return to the same control and a form's session draft returns to
the same field (`app/ui/tools/src/hub/drafts.ts`); only the launcher's Settings page,
which the Hub hosts, keeps its own names. The Hub's own pages (preferences, the
phrase form, rates, price details, Build details, confirmations, Leave this
area, the Settings host) are Vue components in `app/ui/tools/src/hub/views`; their controllers in
`app/renderer` keep state, validation and saves. A view mounts a page by its
name in `HubPageProps` (`app/shared/ui/hub-pages.ts`). Each page folder names
its pages in an `index.ts`, and the kit's registry collects those folders and
every feature's `app/features/<id>/hub-views/`, so a feature adds a page from
its own folder; Characters (`app/features/character-switch/hub-views/`) is one.
`app/ui/tools/src/hub/views/registry.test.ts` holds the registry total: its
page list must name every `HubPageProps` key, and every name must resolve.
A feature page imports its props contract into its controller, so the
renderer program checks the controller and the Tools program checks the page. This document records intent
and links to current owners. Code and tests own exact values and accepted
states.

## Keyboard and actions

List movement uses `app/shared/ui/list-keys.ts` and never wraps. Enter runs the
named footer primary. Modified Enter does not run it. Right opens a result page;
text fields keep their caret keys. Command-J opens the existing Actions menu:
the primary, then the row's own `actions()` in its source's order (Build
details, the rates, a person's actions), then Pin and the sources'
`personalize` entries. Each action runs as a Hub task, as the primary does.
Escape closes the innermost menu, disclosure, prompt, query, page, then Hub.
Command-Backspace goes back from any focus. Plain Backspace edits text.

Consequential rows require explicit activation. A click selects; Enter, the
footer primary, or a double-click on the same row runs the action. Destructive
actions ask for confirmation. No transition leaves focus on a removed node.

## Presentation and ownership

Every page keeps the same footer. Disabled slots stay visible. The primary names
its action and target on one line, with the complete accessible name and title.
Views use `HubViewFooter`; they do not add another footer or Actions menu.
Team review opens with focus on the review surface at its top. Its refusal
appears before the roster. The footer keeps the named Apply action.
A running primary shows progress without an Enter keycap.
Search uses the shared grammar and ranking (`rankHubRows`) in `app/shared/hub.ts`.
An owned list refreshes from its own source. Other observations update navigation
facts without rebuilding that list. Home searches all enabled sources.

Conflicting stored exact phrases require a choice. Both stores remain intact.
A row without its own art draws the icon its source names (`iconKind`, from the
family in `app/shared/ui/hub-icon.ts`); a Core Tools row's comes from its manifest,
and a tool's shortcut row on the Commands page draws its Tools row's icon.
Tool labels come from `app/shared/tool-presentation.ts`. Settings copy comes from
`app/shared/setting-copy.ts`. Neither surface owns another copy of those labels.

[Settings](settings.md) owns preferences and durable writes.
[Whispers](whispers.md) owns the floating conversation window.
[Trade discovery](trade-discovery.md) owns the floating Trade Chat window.
[The website Hub page](https://www.gwonmac.com/docs) describes the player workflow.

Currency icons use the native search input and an inert measuring overlay.
The overlay never rewrites text or owns editing, selection, composition, or undo.
Progress belongs to the page session that started it. Late outcomes show receipts
and cannot navigate a newer session. A closed-Hub failure expires with the resume window.
An observer clears only its matching resolved failure, never another outcome.
Reduced motion keeps progress static.

## Tests

Each Hub rule is tested at the cheapest level that can fail when it breaks. A
new Hub test starts in Node or vitest; it goes to Playwright only when no
cheaper test fails if the rule breaks (try one product mutation to see).

- **Node** (`pnpm test`): the engine's keys, pages, sessions, resume and
  selection (`tests/unit/hub-engine.test.ts`), and the pure modules: ranking
  (`tests/unit/hub.test.ts`, `hub-results.test.ts`), the status line, drafts,
  the footer and its legend, the calculator and people.
- **vitest with the real controller** (`pnpm --filter @gwonmac/tools-ui test`,
  part of `pnpm check`), in happy-dom. `app/ui/tools/src/hub/hub-shell.dom.test.ts`
  mounts `createHub` with hand-made rows and holds the accessibility contract:
  the dialog's name, the search combobox and its listbox, options in named
  groups, `aria-activedescendant`, the Actions menu, Back, the live regions and
  where each page puts the keyboard. `app/ui/tools/src/hub-fixture-harness.ts`
  mounts the fixture page that Playwright drives and presses keys as Playwright
  does; the keyboard contract's DOM cells (`hub-keyboard-contract.*.dom.test.ts`),
  the owned press and the other Hub behaviours that read only DOM, focus and the
  fixture's game hooks run there (`app/ui/tools/src/hub-*.dom.test.ts`).
- **Playwright** (`app/ui/tools/tests`, CI only): what only a real browser
  answers. That is the browser's Tab traversal, PageDown's page size, layout and
  geometry (the 340×380 minimum, no scrim), computed styles and contrast, native
  text editing and composition, popovers in the top layer, and the `@macos`
  timing budgets.

The keyboard contract is one golden table,
`app/ui/tools/tests/keyboard-contract.golden.json`: every key in every view.
`app/ui/tools/tests/keyboard-contract-keys.ts` says which runner owns each cell,
and a vitest test checks that the table holds every cell exactly once. A change
to keyboard behaviour regenerates both halves and commits the table diff:
`KEYBOARD_GOLDEN=update pnpm --filter @gwonmac/tools-ui exec vitest run --no-file-parallelism hub-keyboard-contract`
for the DOM cells, and the same variable on `hub-keyboard-contract.spec.ts` for
the browser cells.
