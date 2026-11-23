# UI sweep

The UI sweep lets a maintainer, or an agent, see the whole interface without starting the app or
the game. It opens every launcher scene, Hub view and in-game panel in a headless browser at three
window sizes, checks the layout rules below, and saves one screenshot per scene.

```bash
pnpm ui:sweep                    # everything, about 3 minutes
pnpm ui:sweep overlays hub       # only some surfaces: launcher, hub, overlays
```

Open `test-results/ui-sweep/index.html` for the contact sheet: every screenshot with its findings.
`report.json` beside it holds the same data. CI runs the sweep in `ci.yml` (job `ui-sweep`) and
uploads the folder as the `ui-sweep-<attempt>` artifact on every run.

The sweep is headless: it opens no window and takes no focus, so unlike the Electron and Hub
Playwright suites it may run on a Mac someone is using.

## What it covers

| Surface | Scenes | Smallest size |
| --- | --- | --- |
| Launcher (`app/ui/launcher`, Vite fixture) | every `?fixture=` scene, and each tab | 900×640, the launcher window's minimum |
| Hub (`app/ui/tools`, Vite fixture) | Home, Travel, Build Library, a team review against the party, a search with no matches, Trade, and the Build Library (a team and a build) and Whispers windows | 800×600, the game window's minimum |
| In-game panels (`tests/ui-sweep/overlays.ts`) | memory warning (low, critical), Quit or reload, Compass dock | 800×600 |

The in-game panels run the production modules on the production markup from
`app/renderer/index.html`, not a copy, so a change to either shows up here.

## Rules

`tests/ui-sweep/audit.ts` owns the rules. Each is a defect a player reported:

| Rule | Catches | Example it caught |
| --- | --- | --- |
| `sideways-scroll` | a box that hides part of itself behind a sideways scrollbar | Quit or reload panel; the old Hub Recent carousel |
| `control-cut-off` | a button, link or field cut by a frame or the window | "Reload Guild Wars" cut off by 93 px at 800×600 |
| `text-spill` | text running out of its box without an ellipsis | |
| `offscreen` | a panel reaching past the window edge | |
| `overlap` | text or controls drawn over each other | |
| `truncated` | a label ending in an ellipsis (a note, never a failure) | |
| `selection-stripe` | a selected row, option or tile marked with an edge bar | the 2 px gold stripe on Hub, Trade and Build Library rows |
| `selection-style` | a selected item not drawn with the shared selection tokens | Hub, Trade and Build Library rows, each with its own shadow |
| `header-tile` | a decorative icon tile beside a window title | the "GW" and market tiles in the Build Library and Trade headers |
| `search-glyph` | a search field with no search glyph at its left | the Library's text "⌕" and the Trade and Whispers searches with no glyph |
| `footer-order` | an action bar with a button right of its primary, other than an Actions menu | Build Detail's Export after Save; Trade's Show listings after Whisper |

The last five check the pattern rules in [DESIGN.md](../DESIGN.md#one-pattern-per-job); each
failed on `main` before the change that fixed it.

A list that scrolls up and down is normal: rows half scrolled out of it are not findings. While a
modal is open, only the modal is checked. Each rule was proved to fail, on a page broken on purpose
and, for the first two, on `main` before the Quit panel fix (#159).

## When a finding is right

Fix the interface. When the layout is intended, add an entry to `tests/ui-sweep/allowed.json` with
the surface, rule, part of the target, and the reason. An entry that waits on a product decision
says so and says when to remove it; delete it in the change that makes the decision.

## What it cannot show

| Claim | Who checks it |
| --- | --- |
| The pattern rules without a sweep rule (group labels, footers, search fields, empty states) | Opus reads the contact sheet for every interface change; no rule judges taste |
| Keyboard, focus and pointer behaviour | the Hub Playwright suite and vitest (`docs/hub-contract.md`) |
| Panels over the real game: game art, the real Compass position, input feel | a person, in the play check |
| The loading screen, character switch, Whispers pop-out, Settings dialogs, the Classic theme and larger text | not yet in the sweep; add a scene when one of them changes |
