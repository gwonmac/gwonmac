# Active migrations

This file tracks temporary compatibility code: why it exists, what depends on
it, and when to remove it. Remove the code and its entry together.

From 1.0.0 there is no way back to older versions. Code that only serves a
rollback or downgrade is not tracked here; delete it. Code that reads data an
older app wrote stays, because players install 1.0.0 over the old app and keep
their data.

## Adopted Main account storage

- Why: the launcher presents Single Account data from older releases as a
  profile without copying or moving the default Electron session, the fixed
  Keychain items, root builds, templates, reset marker, or window state. An
  additive v1 workspace marker identifies that virtual profile.
- Introduced: 2026-08-29 with the unified launcher.
- Depends on it: installations created before the unified launcher.
- Remove when: a migration has copied and verified the default session and
  the fixed Keychain items into a normal profile partition. Remove the storage
  adapter, the additive marker, and their tests.

## Read aliases for old player data

These are permanent readers, not migrations. Keep them.

- Travel reads Piken Square (pre-Searing) map ID 778, which Stable releases
  v2026.8.9 to v2026.8.12 wrote, as the official ID 779
  (`app/shared/travel-map-id.ts`).
- The settings parser reads the legacy `teamManagement` shape into
  `buildLibrary`. `AppSettings` must stay free of `teamManagement`.
