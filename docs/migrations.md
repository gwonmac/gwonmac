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

## Removed 4 GB mode caches

- Why: 4 GB mode wrote derived modules to `game/extended-memory` and
  `game/core/extended-memory`. Nothing reads them after its removal, so
  startup deletes both folders (`ensureDirs` in `app/main/startup-state.ts`).
- Introduced: 2026-11-21 with the removal of 4 GB mode.
- Depends on it: installations that turned 4 GB mode on before its removal.
- Remove when: two Stable releases after the removal have shipped. Delete the
  two paths from `ensureDirs` and this entry.

## Whispers icon place from localStorage

- Why: the Whispers unread icon's place moved from the game window's
  localStorage (`gwonmac.whispers-icon-placement`) into the
  `whispersIconPosition` setting. While the setting is unset, Whispers reads
  the old entry once as its first value, saves it in settings and removes the
  entry (`app/features/whispers/renderer/icon-placement.ts`).
- Introduced: 2026-11-22 with plan step 5.3 (Whispers on the Feature platform).
- Depends on it: players who moved the icon before this change.
- Remove when: two Stable releases after the change have shipped. Delete
  `takeStoredPlace` and its call, its exemption in
  `tests/policy/source-saved-login-surface.test.ts`, and this entry; an
  unmoved icon simply starts at its default place.

## Trade window place from localStorage

- Why: the Trade window's place and size moved from the game window's
  localStorage (`gwonmac.trade-window-placement`) into the
  `tradeChatWindowPosition` setting. While the setting is unset, Trade Chat
  reads the old entry once as its first value, saves it in settings and
  removes the entry (`app/features/trade-chat/renderer/window-placement.ts`).
- Introduced: 2026-11-22 with plan step 5.4 (Trade Chat on the Feature platform).
- Depends on it: players who moved or resized the Trade window before this change.
- Remove when: two Stable releases after the change have shipped. Delete
  `takeStoredPlace`, `moved` and their calls, the file's entry in
  `PLACEMENT_MOVES` in `tests/policy/source-saved-login-surface.test.ts`, and
  this entry; an unmoved window simply opens at its default place.

## Read aliases for old player data

These are permanent readers, not migrations. Keep them.

- Travel reads Piken Square (pre-Searing) map ID 778, which Stable releases
  v2026.8.9 to v2026.8.12 wrote, as the official ID 779
  (`app/shared/travel-map-id.ts`).
- The settings parser reads the legacy `teamManagement` shape into
  `buildLibrary`. `AppSettings` must stay free of `teamManagement`.
- Feature switches keep the keys released apps store (`whispersEnabled`,
  `travelPalette`, `skillCooldownOverlayEnabled`, …): each manifest marks its
  switch with `featureSwitch`, so no key was converted and nothing needs a
  migration ([Feature switches](settings.md#feature-switches)).
