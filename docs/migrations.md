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

## Unhead 3.x family pin

- Why: a fresh Nuxt dependency resolution can mix Unhead 2.x and 3.x APIs. That
  breaks the website build and server before a page renders.
- Introduced: 2026-08-04 in commit `b93839ff`.
- Depends on it: the Nuxt website build, server bundle, and head metadata.
- Remove when: with both `unhead` overrides deleted and the lockfile
  regenerated, a clean `pnpm install --frozen-lockfile` and the website build
  pass without a mixed Unhead family.

## Ginko sidebar padding override

- Why: Ginko Docs 0.2.3 always gives the sidebar scroll viewport `pt-2`, even
  when no section switcher renders above it.
- Introduced: 2026-08-02 in commit `b929e496`.
- Depends on it: the top spacing of the grouped desktop docs navigation.
- Remove when: with the CSS rule deleted, `/docs/guides/install` at 1280 × 900
  keeps 32 px between the sidebar scroll viewport and its first row.

## Website package metadata repairs

- Why: `@nuxt/scripts` 0.13.4 imports `estree-walker` and `nuxt-define` 1.0.0
  imports `@nuxt/kit`, but neither manifest declares it. Nuxt I18n 10.6.0 asks
  Nuxt Kit to resolve its Intlify runtime from outside the I18n package, which
  needs a narrow public hoist under pnpm's isolated linker.
- Introduced: 2026-08-21 with dependency isolation.
- Depends on it: fresh website installs without wildcard hoisting.
- Remove when: the pinned packages declare or resolve these imports
  themselves. Delete both `packageExtensions` and the six-entry
  `publicHoistPattern`, regenerate the lockfile, and require a clean install
  and website build.

## Ginko consumer icon compatibility

- Why: Ginko Docs 0.2.3 gives Nuxt Icon a pruned Lucide collection before it
  discovers the website's own icons. Those icons otherwise render without CSS.
- Introduced: 2026-08-21 with the website icon fix.
- Depends on it: the website's app and content Lucide icons.
- Remove when: Ginko Docs 0.2.5 or later, with its required Ginko Content
  version, passes the strict website typecheck and build. Remove the
  `modules:before` hook and the direct `@iconify-json/lucide` dependency.
