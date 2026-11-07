# Hub interaction contract

The Hub presents commands over Guild Wars. Its navigation and keys belong to the
pure engine in `app/renderer/hub-engine.ts`, tested in Node by
`tests/unit/hub-engine.test.ts`: the page stack, the query, the selection and
menu, the page session, the row action running on it and a failure carried
across a close. `app/renderer/hub.ts` owns search, rows,
pins and phrases, receipts and the modal, and applies the engine's effects. It
names no source: each source says what it adds through the optional
`HubSource` fields in `app/shared/hub.ts`. The built-in sources (accounts, the
calculator, commands, Hub preferences and Settings) attach from the one Core
list in `app/renderer/hub-builtins.ts`, the way a feature attaches its own.
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
phrase form, rates, price details, confirmations, the Settings host) are Vue
components in `app/ui/tools/src/hub/views`; their controllers in
`app/renderer` keep state, validation and saves. This document records intent
and links to current owners. Code and tests own exact values and accepted
states.

## Keyboard and actions

List movement uses `app/shared/ui/list-keys.ts` and never wraps. Enter runs the
named footer primary. Modified Enter does not run it. Right opens a result page;
text fields keep their caret keys. Command-J opens the existing Actions menu.
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
