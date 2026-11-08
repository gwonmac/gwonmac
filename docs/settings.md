# Settings

This document owns how settings behave: where each setting lives, what it is
called, when a change takes effect, and how a player reaches a setting from the
launcher or from a game window.

## The decision

gwonmac has one Settings page. The launcher draws it. Inside a game window, the
same page opens as a Hub page, with the same labels and controls.

The Hub page shows four in-game sections: **Tools**, **Maps**, **Appearance**
and **Game**. You change them there, and the game updates at once. Five other
sections need the launcher: **Texture packs**, **Game files**, **Updates**,
**Home screen** and **Advanced**. In the Hub they show ↗. Choosing one opens the
launcher at that section.

Hub search (⌘R) finds sections and single settings by their words. Choosing a
result opens the Hub Settings page at that control. The control takes focus and
is briefly highlighted. Hub search does not change a setting in place.

## Rules

1. **One setting, one name, one control.** `app/shared/settings-catalogue.ts`
   lists the sections and the settings that search can open, with their stable
   IDs, labels and keywords. Each control carries `data-setting="<id>"`.
2. **Every setting says when it applies**, in the same words everywhere:
   no note when it applies now; "Applies when you next open or reload a game
   window."; "Applies after you restart GWonMac." A saved choice that is not
   active yet shows its state next to the control ("Restart required. This
   session still uses 2 GB.").
3. **Changes save right away.** A change applies in every open game window. The
   status line names the saved setting and when it applies. A failed save keeps
   the change on screen and offers **Retry** and **Revert**.
4. **Settings are found by their words.** Search on the Settings page (⌘F) and Hub
   search both use the catalogue.
5. **A game window cannot reach launcher-only actions.** Updates, game files,
   texture packs, reset and logs run only from the launcher. The Hub page never
   offers them.
6. **Tools on or off needs a restart of the launcher.** The Tools section says
   "Restart the launcher". Only the launcher offers the restart button.
   Restarting only a game window does not load or unload Tools.

## Build and trust

- `app/ui/launcher/src/components/SettingsView.vue` draws the page for both the
  launcher and the Hub.
- The launcher builds the page a second time as a module for the game window:
  `vite build --mode hub` writes `build/renderer/settings/settings-app.js` and
  `.css` from `app/ui/launcher/src/hub-entry.ts`. `app/renderer/hub-settings-page.ts`
  loads it when Settings first opens, into a host the Hub's Vue kit draws, and
  owns the Settings rows Hub search finds. It is not part of the optional Tools
  bundle: Settings must work in a Core launch, because that is where Tools are
  turned on.
- A game window gets a bounded `hubSettings` API: `get`, `update`, `capture` and
  `cancelCapture`. The main process checks each change with
  `parseHubSettingsChange` against `HUB_SETTINGS_FIELDS` in
  `app/shared/hub-settings.ts`. It refuses unknown or launcher-only controls, a
  value of the wrong kind, and extra fields. A checked change is a
  `SettingsWrite` (`app/shared/launcher-contracts.ts`), the same vocabulary as
  the launcher's settings, Tools and shortcut channels. Game-window settings,
  menu toggles and main's own bookkeeping use it too:
  `PreferencesCoordinator.write` is the only way to change settings. The Hub sections come from
  `HUB_SECTIONS` in `app/shared/settings-catalogue.ts`.

## The tree

Settings has two groups. The launcher shows both. The Hub lists every
section but edits only the in-game ones; the others (↗) open the launcher.

| Group | Section | In the Hub |
|---|---|---|
| In game | Tools | Yes |
| In game | Maps | Yes |
| In game | Appearance | Yes |
| In game | Game | Yes |
| In game | Texture packs, Game files | ↗ (launcher) |
| GWonMac | Updates, Home screen, Advanced | ↗ (launcher) |

## Entry points

| From | Opens |
|---|---|
| **Settings…** in a focused game window | Hub Settings page |
| **Settings…** with no game window focused | Launcher Settings |
| **Check for Updates…** (macOS app menu) | Launcher, Updates |
| Hub search: a setting | Hub Settings page, that control focused and highlighted |
| Hub search: a ↗ section | Launcher Settings, that section |
| Memory warning › "Memory settings" | Hub Settings page, Game, Extended memory focused |

## Add a setting

1. **Declare it once.** A core setting goes in `app/shared/settings/core.ts`, a
   feature's setting in `app/features/<id>/feature.ts`, with the helpers in
   `app/shared/settings/define.ts`. The declaration owns the default, how a
   stored or sent value is read, and the scope flags (`hub`, `launcher`,
   `tools`, `rendererWritable`). `app/shared/settings/index.ts` derives the
   `AppSettings` type, the defaults, the file reader, the launcher patch parser
   and every scope list from it. Never write a second list by hand.
2. **Name it.** Add its label, detail and "when it applies" note to
   `app/shared/setting-copy.ts`. For an enum, the option labels are a record
   keyed by the enum's values, so a value without a label does not compile.
3. **Make it findable.** Add one entry to `app/shared/settings-catalogue.ts`
   with its section and keywords.
4. **Draw the control** in the section's component under
   `app/ui/launcher/src/components/`, with `data-setting="<id>"`, using the
   copy from step 2.

A setting that a released app already wrote must keep reading every value that
app stored: `tests/unit/player-data-fixtures.test.ts` loads files written by
tagged releases and fails when a narrower reader would reset them.

If a player's file still holds a value the reader refuses, loading costs only
that setting: it takes its default, every other value is kept, the original
file is preserved beside it as `settings.json.corrupt-*`, the repaired file is
written, and the player sees one "Some settings were reset" notice
(`settings.fieldsReset` in diagnostics, with a count and no names or values).
Only a file that is not a JSON object, or has an unknown `formatVersion`, falls
back to defaults as a whole. Renderer and launcher patches stay strict: a bad
value in a patch is refused, never repaired.

## Calculator estimates

Hub › Conversion rates saves the selected source and optional currency estimates
through the existing settings file. Rates apply in every game window. They do
not change the game or replace observed prices. Automatic keeps the saved
estimates for a later switch to Your rates.
