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
- The launcher names every colour, radius, and type size once, in the `:root`
  tokens of `apps/launcher/src/style.css`. Shell rules and components use only
  those names; a policy test rejects raw colours and undefined tokens. Settings
  keeps its own `--settings-*` set because the game's Hub draws it too.
- The launcher has one button vocabulary: `.primary` (gold, one per view),
  `.secondary`, `.quiet`, `.icon-button`, and `.small` for rows. Labels and
  statuses use `.chip`. No eyebrows: no small uppercase label above a heading;
  put the source and date in a plain line under the title. Support is a quiet pill
  in the title bar, never a banner or a progress counter.
- Reading happens on pages, not in modals. A news article opens as a full page
  in **News** with a way back to the list; Help pages are the Guide. Modals are
  for short decisions and forms only.
- Prefer native hierarchy: system-sized controls, semantic checkboxes, sheets,
  menus, concise labels, and visible keyboard focus.
- Use translucent material only where it improves separation from key art.
  Reduced-transparency mode replaces it with an opaque warm-dark surface.
- Keep motion short and functional. Reduced-motion mode removes nonessential
  transitions and animation.

## Accounts in the launcher

There is no Single or Multiple Accounts mode. The launcher always opens first
and answers one question: which accounts should open? Account administration
uses progressive disclosure:

1. Compact rows show selection checkboxes, launch state, **Play** or **Show**,
   and **Try again** or **Cancel** where they apply. The main launch button opens
   the checked group. The list scrolls inside the picker, so many accounts never
   move the primary action off-screen.
2. **Edit** changes an account's name, icon, and color.
3. Modal sheets handle creation and editing.

Player text says **account**. Internal code may keep **profile** for stable
IDs, paths, partitions, and existing domain types. The in-game command palette
is the **Hub**; do not use that name for the account picker.
[Account profiles](docs/multiple-accounts.md) owns the behavior.
