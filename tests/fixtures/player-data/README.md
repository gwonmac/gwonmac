# Player data written by released apps

Each folder holds the player files one released tag wrote, at the paths it uses
under the app's userData folder. `tests/unit/player-data-fixtures.test.ts` loads
every file through the current loaders and fails if one is quarantined, reset or
loses a value. This is the check for the "Must stay" rule in AGENTS.md: players
install the new app over the old one and keep everything.

| Folder | Release | Files |
| --- | --- | --- |
| `v2026.8.12/` | last 2026.8 Stable | settings, Travel preferences and history, build library, account mode, account workspace, shared templates |
| `v2026.11.0/` | first launcher release | the same, plus `launcher-state.json` |

## How they are made

`generate.ts` extracts the tag's `src/` with `git archive`, imports that
release's own writers (`saveSettings`, `updateTravelPreferences`,
`TravelHistoryStore`, `saveBuildLibrary`, `saveAccountMode`,
`saveMultiWorkspace`, `saveAccountTemplateLibrary`, `LauncherStateStore`), and
writes invented values through them: every setting boolean flipped from its
default, a non-default value for each enum and range, one build with a variant
and a team, one added account, and one template. It then checks that the tag
reads its own `settings.json` back without recovery.

```bash
node --import ./scripts/ts-hook.mjs tests/fixtures/player-data/generate.ts v2026.11.0
```

Never put credentials, real account or character names, or files from a real
install here. Keychain items are not files and are not covered.

## When to add a folder

After each release, run the generator for its tag, commit the new folder, and
add the tag to the list the test expects. Keep the old folders: the test proves
that every version players may still have is readable. Delete a folder only
when the app stops supporting an upgrade from that release, and say so in
[docs/migrations.md](../../../docs/migrations.md).
