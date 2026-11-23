# Guild Wars Reforged Interface

The interface has one visual contract: Guild Wars supplies atmosphere and
macOS supplies interaction.

## Visual system

- Use the reviewed static Reforged landscape as environmental key art. Do not
  load the launcher video in utility windows.
- The launcher title bar shows the gwonmac icon and name, not the Reforged logo.
  Guild Wars artwork stays in the key art and the Guild Wars news mark.
- Keep visual style and typeface independent in in-game GWonMac panels. The
  locally converted Guild Wars body font is the default; Inter/system type is
  the modern option, and Palatino is the fail-safe when the game asset is not
  available. Utility windows keep macOS
  system type.
- Use one gold accent (`#e8b75c`) for selection and primary action. Reserve red
  for destructive actions and green for an already-open account.
- The launcher names every colour once, in `app/ui/launcher/src/tokens.css`,
  beside its radius and type scales. Shell rules and components use only those
  names. The game's Hub draws the Settings page too and loads the same file,
  whose names apply only on the launcher's `<html data-launcher>` and on
  `.settings-view`, never on the game's `:root`. In the Hub,
  `hub-settings.css` points every launcher colour the page reads at the Hub
  token for the same role, so the page and its dialogs follow the player's Hub
  theme and accent; radii and the small type sizes stay the launcher's; fonts
  and body size follow the Hub. The Settings stylesheet declares no colour of
  its own. Everything else drawn in the game reads `app/shared/ui/tokens.css`.
  Settings sets each property of a selector in one rule.
  `tests/unit/the-ui-system-has-one-place-to-change-a-colour.test.ts` checks
  every stylesheet and `.vue` style block, found by glob: it rejects raw
  colours (hex, colour functions and named colours), tokens the file's system
  does not declare, and corners or stacking orders that are not tokens. Files that cannot meet a rule yet are listed there with the reason.
- The launcher has one button set, in `controls.css`: `.primary` (gold, one
  per view), `.secondary`, `.quiet`, `.danger-button`, `.icon-button`,
  `.text-link`, and `.small` for dense rows. The Hub's Settings page loads the
  same file. Settings rows use `.small`; dialogs use the full size. Labels and
  statuses use `.chip`. No eyebrows: no small uppercase label above a heading;
  put the source and date in a plain line under the title. Support is a quiet pill
  in the title bar, never a banner or a progress counter.
- Reading happens on pages, not in modals. A news article opens as a full page
  in **News** with a way back to the list; Help pages are the Guide. Modals are
  for short decisions and forms only. Launcher and Settings dialogs (`BaseModal`)
  are `min(420px, 100% - 32px)` wide; Hub tool dialogs keep their own widths.
- Prefer native hierarchy: system-sized controls, semantic checkboxes, sheets,
  menus, concise labels, and visible keyboard focus.
- Use translucent material only where it improves separation from key art.
  Reduced-transparency mode replaces it with an opaque warm-dark surface.
- Keep motion short and functional. Reduced-motion mode removes nonessential
  transitions and animation.

## One pattern per job

Each job below has one look in the game's panels, the Hub and the Tools
windows. `app/shared/ui/components.css` and `app/shared/ui/tokens.css` own each
pattern, so a surface follows by using the class, not by copying values. The
launcher keeps its own token set (above) but follows the same rules where it
has the job. `pnpm ui:sweep` checks the rules marked *swept*
([UI sweep](docs/ui-sweep.md)); Opus reads the contact sheet for the rest.

- **Selection.** A selected row, option, tile or card is the selection fill
  inside a faint gold hairline all the way round: `--ui-selection-fill`,
  `--ui-selection-shadow`, `--ui-selection-ink`. Never an edge stripe, a
  border-only mark, or a feature's own fill. A current place or character is
  named in text ("Current"), not drawn as a second outline. Focus stays the
  separate focus ring. In the launcher, selection is `--gold-tint` without a
  stripe. *Swept:* `selection-stripe`, `selection-style`.
- **Window header.** The title (`.ui-panel-title`), at most one supporting line
  (`.ui-field-hint`), then the window controls (lock, close). No icon tile
  beside the title, and no button that opens a different tool: each tool opens
  from its own shortcut, menu item and Hub row. *Swept:* `header-tile`.
- **Close.** Every window, dialog and drawer closes with `.ui-window-close`, a
  bare ×. Launcher modals use `.icon-button` with the X icon.
- **One choice from a short set** (switch a view, filter by two to five
  values): `.ui-segment`, with `role=tablist` when it switches panels. No
  underline tabs. The launcher uses `.segmented`.
- **Group labels.** In the Hub every group of results or tiles has the
  `.hub-group` label: display type, accent colour, body size; a count or key
  hint sits at the right in muted caption text. In a Tools window a section
  heading is `.ui-section-heading`: interface type at body size, semibold and
  bright; a count sits at its right, a sentence of help below it. A pane's own
  title is one step up, at `--ui-font-size-lg`. No uppercase labels, no
  eyebrows.
- **Rows and tiles.** A Hub row is icon, title, detail, then type or keys at
  the right (`.hub-row`); a Tools list row is `.ui-row`. A set of places or
  favourites is compact tiles that wrap (the Travel tile), and ↑ ↓ move by
  painted row. Nothing scrolls sideways. *Swept:* `sideways-scroll`.
- **Footer action bar.** Status or key hints at the left, actions at the right;
  Cancel sits left of the action it cancels, and the completion action is the
  primary, the rightmost button. In game windows the primary shows its ↵ key;
  where a bar has an Actions menu (⌘J: the Hub, the Trade inspector), it sits
  right of the primary. *Swept:* `footer-order`.
- **Search field.** The search glyph at the left, the input, then at most one
  control inside the field at the right: a `/` key hint, a clear button, or the
  view's settings gear. The Hub uses `.ui-hub-search` with the Hub's diamond;
  Tools use `.ui-input-group` with the magnifier (`.ui-search-glyph`). Both
  glyphs live in `app/shared/ui/hub-search.ts`. *Swept:* `search-glyph`; a
  control inside a field is not an `overlap`.
- **Empty and loading.** Empty is `.ui-empty`: a short title ("No saved teams
  yet", "No matching prices"), one sentence that says what to do, and an
  action when one helps. Loading is a `.ui-empty` too: pulsing `.ui-skeleton`
  bars above a line that names what loads ("Loading trader prices…"). The Hub
  shows loading as a result row and the bar under its search.

## Accounts in the launcher

There is no Single or Multiple Accounts mode. The launcher always opens first
and answers one question: which accounts should open? Account administration
uses progressive disclosure:

1. Compact rows show selection checkboxes, launch state, **Play** or **Show**,
   and **Retry** or **Cancel** where they apply. The main launch button opens
   the checked group. The list scrolls inside the picker, so many accounts never
   move the primary action off-screen.
2. **Edit** changes an account's name, icon, and color.
3. Modal sheets handle creation and editing.

Player text says **account**. Internal code may keep **profile** for stable
IDs, paths, partitions, and existing domain types. The in-game command palette
is the **Hub**; do not use that name for the account picker.
[Account profiles](docs/multiple-accounts.md) owns the behavior.
