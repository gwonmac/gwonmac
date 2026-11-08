# Player data written by released apps

Each folder holds the player files one released tag wrote, at the paths it uses
under the app's userData folder, in two variants: `defaults` (what the release
writes before the player changes anything) and `custom` (one realistic
non-default value per field family). `tests/unit/player-data-fixtures.test.ts`
has one row per file. It loads the file through the current loader and fails if
the file is quarantined, reset, moved or deleted, or loses a value. This is the
check for the "Must stay" rule in AGENTS.md: players install the new app over
the old one and keep everything.

| Folder | Release | Files |
| --- | --- | --- |
| `v2026.8.12/` | last 2026.8 Stable | settings, diagnostic profile, window placement, Travel preferences and history, saved trades, build library, account mode, account workspace, first-account template snapshot, shared and per-account libraries |
| `v2026.11.0/` | first launcher release | the same without `launcher-mode.json`, plus launcher state and window placement, map knowledge, elite tracking, texture pack selection |

## How they are made

`generate.ts` extracts the tag's `src/` (or `app/`) with `git archive`, imports
that release's own writers (`saveSettings`, `updateTravelPreferences`,
`TravelHistoryStore`, `TradeSavedStore`, `saveBuildLibrary`, `saveWindowState`,
`saveAccountMode`, `saveMultiWorkspace`, `saveAccountTemplateLibrary`,
`LauncherStateStore`, `CartographyMapKnowledgeStore`, `EliteTrackingStore`,
`TexturePackManager` and others) and writes invented values through them.
`custom` flips every setting boolean and sets a non-default enum, range, list
and position for the rest. A setting value the tag refuses stops the run. The tag
must read its own `settings.json` back without recovery.

```bash
node --import ./scripts/ts-hook.mjs tests/fixtures/player-data/generate.ts v2026.11.0
```

Never put credentials, real account or character names, local paths, or files
from a real install here. Keychain items are not files and are not covered. A
file with no row in the test is not covered either: the test lists the files it
skips and why.

## When to add a folder

After each release, run the generator for its tag, commit the new folder, and
add a row for each file to the test. Keep the old folders: the test proves that
every version players may still have is readable. Delete a folder only when the
app stops supporting an upgrade from that release, and say so in
[docs/migrations.md](../../../docs/migrations.md).
