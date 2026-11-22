# Settings

This document owns how settings behave: where each setting lives, what it is
called, when a change takes effect, and how a player reaches a setting from the
launcher or from a game window.

## The decision

gwonmac has one Settings page. The launcher draws it. Inside a game window, the
same page opens as a Hub page, with the same labels and controls.

A Feature's switch, options and shortcuts are on its **Feature page**, drawn by
one component (`FeatureSettings.vue`) wherever the page shows: the launcher's
Features tab, and the **Features** section of the Hub's Settings page. The
launcher's own Settings page has no Features section, because Features is a tab
of its own; the simple launcher, which has no tabs, keeps the section.

The Hub page shows three in-game sections: **Features**, **Appearance** and
**Game**. You change them there, and the game updates at once. Five other
sections need the launcher: **Texture packs**, **Game files**, **Updates**,
**Home screen** and **Advanced**. In the Hub they show ↗. Choosing one opens the
launcher at that section.

Hub search (⌘R) finds sections and single settings by their words. Choosing a
result opens the Hub Settings page at that control, on its Feature page for a
Feature's option. The control takes focus and is briefly highlighted. Hub search
does not change a setting in place.

## Rules

1. **One setting, one name, one control.** `app/shared/settings-catalogue.ts`
   lists the sections and the settings that search can open, with their stable
   IDs, labels and keywords. Each control carries `data-setting="<id>"`.
2. **Every setting says when it applies**, in the same words everywhere:
   no note when it applies now, "Applies when you next open or reload a game
   window.", or "Applies at the next login screen."
3. **Changes save right away.** A change applies in every open game window. The
   status line names the saved setting and when it applies. A failed save keeps
   the change on screen and offers **Retry** and **Revert**. In the launcher's
   Features tab, a Feature page's own note says what was saved, or that a change
   could not be saved; its controls keep showing the saved value.
4. **Settings are found by their words.** Search on the Settings page (⌘F) and Hub
   search both use the catalogue.
5. **A game window cannot reach launcher-only actions.** Updates, game files,
   texture packs, reset, logs, and copy and paste of settings run only from the
   launcher. The Hub page never
   offers them.
6. **The plain game is the launch mode.** **Play the plain game** (stored as
   `gwonmacTools` off) stops every Feature, Character Switch included, at once,
   and the next launch is a Core launch. It writes only `gwonmacTools`, so turning
   it off brings back every Feature switch as it was. Loading or unloading
   Features needs a restart of the launcher: the plain-game strip at the top of
   Features says "Restart the launcher" and only the launcher offers the button. Restarting only a game
   window does not load or unload them. `resolve` (`app/shared/feature-resolve.ts`)
   reports `plain-game` for every Feature; nothing else reads the mode.

## Moving settings to another Mac

The launcher's **Advanced** section has **Copy settings** and **Paste settings**.
`app/main/core/settings-transfer.ts` owns the text form: a JSON object with a
`kind`, a format `version`, the stored settings and the launcher's Home
choices. Copy puts it on the clipboard. Paste reads the clipboard in main,
checks it before it asks anything, confirms with a native dialog, then writes
the settings through the one settings write and the Home choices through the
launcher state.

- **Strict shape.** Text that is not copied settings, has another `version`, or
  holds a malformed value is refused whole. The launcher says why
  (`LauncherSettingsPasteRefusal`). Every kept value passes the settings file's
  own validation.
- **Lenient age.** A setting or Home choice this build does not know, from a
  newer or older app, is left out; the launcher reports how many.
- **Stays on this Mac.** The launch mode (`gwonmacTools`, Play the plain game), the
  last update check, the client compatibility notice and the stored Travel
  shortcuts (`NOT_TRANSFERRED`) are neither copied nor applied. The text carries
  choices, not the mode. Travel shortcuts change only through Travel's own compare-and-refuse
  write. Credentials, accounts, game files and texture packs are not settings,
  so the text never holds them.

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
| In game | Features (each Feature's page; in the launcher, the Features tab) | Yes |
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
| Hub search: a Feature's option or shortcut | Hub Settings › Features, on that Feature's page, the control focused |
| Launcher Settings search: a Feature's option | The Features tab, that Feature's page, the control focused |
| Hub search: a ↗ section | Launcher Settings, that section |

## Add a setting

1. **Declare it once.** A core setting goes in `app/shared/settings/core.ts`, a
   feature's setting in `app/features/<id>/feature.ts`, with the helpers in
   `app/shared/settings/define.ts`. The declaration owns the default, how a
   stored or sent value is read, and the scope flags (`hub`, `launcher`,
   `tools`, `rendererWritable`). `app/shared/settings/index.ts` derives the
   `AppSettings` type, the defaults, the file reader, the launcher patch parser
   and every scope list from it. Never write a second list by hand.
2. **Name it.** A feature setting names itself in its declaration with `label`
   and `help`; the contract check fails without them, and setting-copy and the
   catalogue read both through `featureSettingText`, so a Settings row, its
   search result and the Feature page use the same words. A Feature's switch
   names nothing (see [Feature switches](#feature-switches)). A core setting gets
   its label, detail and "when it applies" note in
   `app/shared/setting-copy.ts`. For an enum, the option labels are a record
   keyed by the enum's values, so a value without a label does not compile.
3. **Make it findable.** A core setting gets one entry in
   `app/shared/settings-catalogue.ts` with its section and keywords. A feature
   setting needs none: the catalogue lists every option a Feature declares with
   the `launcher` or `hub` scope, on that Feature's page, with its label and help
   from the manifest. Extra search words go in `OPTION_KEYWORDS`.
4. **Draw the control.** A core setting's control goes in its section's
   component under `app/ui/launcher/src/components/`, with
   `data-setting="<id>"`, using the copy from step 2. A feature setting draws
   itself on its Feature page by its type (switch, number, choice, position);
   give it `choices`, `unit` or `dependsOn` in the declaration. A value no type
   fits gets a control of its own in `components/feature-controls/`, listed in
   `FeatureSettings.vue`.

## Feature switches

Each Feature has one switch, and one rule finds it: the setting its manifest
declares with `featureSwitch` (`app/features/define.ts`). The switch keeps the
key released apps already store (`whispersEnabled`, `tradeChat`, `travelPalette`,
…), so no player file needs a migration. A Feature with no switch of its own
(Progress, Team Apply) runs while the Features it `requires` run; its card moves
their switch. `resolve` reads only these switches and the launch mode
(`gwonmacTools`).

Players see a card's switch under the Feature's `name` and `summary`, so the
switch names nothing itself and the contract check refuses a `label` or `help`
on it. The launch mode's switch names itself, **Play the plain game**, because
players see it inverted: the control is on while `gwonmacTools` is off.

Never rename a switch key. `tests/unit/player-data-fixtures.test.ts` lists the
key each Feature reads, and fails when a Feature reads another one or a stored
choice no longer reaches it.

## Player data

A setting that a released app already wrote must keep reading every value that
app stored: `tests/unit/player-data-fixtures.test.ts` loads files written by
tagged releases and fails when a narrower reader would reset them.

If a player's file still holds a value the reader refuses, loading costs only
that setting: it takes its default, every other value is kept, the original
file is preserved beside it as `settings.json.corrupt-*`, the repaired file is
written, and the player sees one "Some settings went back to their defaults"
notice (`settings.fieldsReset` in diagnostics, with a count and no names or
values). If the backup or the repair cannot be written, the repaired values
still apply for that run and the next launch tries again. Only a file that is
not a JSON object, or has an unknown `formatVersion`, falls back to defaults as
a whole. Renderer and launcher patches stay strict: a bad
value in a patch is refused, never repaired.

## Calculator estimates

Hub › Conversion rates saves the selected source and optional currency estimates
through the existing settings file. Rates apply in every game window. They do
not change the game or replace observed prices. Automatic keeps the saved
estimates for a later switch to Your rates.
