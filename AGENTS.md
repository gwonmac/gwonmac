# AGENTS.md

gwonmac (player name: **Guild Wars Reforged for macOS**) is an Electron app that
hosts ArenaNet's official Guild Wars WebAssembly client on Apple Silicon Macs.
It downloads and verifies the official client, ships no game binaries, and adds
optional Tools. Repository: `gwonmac/gwonmac`. Website: https://www.gwonmac.com.

## The product safety rule

Tools run only on ArenaNet client builds that gwonmac has verified. The isolated
local verifier proves each feature from the exact official bytes. Anything it
cannot prove stays off, and the untouched official client stays playable.

- Never edit the downloaded official artifact. Derived modules are separate and
  verified before use.
- No raw memory, packets, pointers, generic calls, or generic writes. Commands
  are named, typed, bounded, confirmed, and region-gated.
- No autonomous gameplay, bots, macros, input broadcasting, or chat or trade
  automation.
- Never load-test ArenaNet services. Keep the shared ArenaNet request ceiling.
- Credentials live only in the Keychain. Never log or export credentials,
  account identifiers, packet contents, cookies, or local paths.

[ArenaNet compatibility](docs/arenanet-compatibility.md) owns the proof rules.

## Commands

```bash
pnpm install --frozen-lockfile   # Apple Silicon, Node >= 22.19, pnpm 11, Rust via rustup
pnpm dev                         # build and open the real launcher
pnpm check                       # fast check: typecheck, lint, links, unit, policy, Tools and launcher UI tests
pnpm typecheck                   # all TypeScript projects
```

Never run Electron or Playwright UI suites locally (`pnpm test:electron`,
`pnpm tools:test:e2e`, `pnpm verify*`, packaged tests). They take focus from
the person working on this Mac. CI runs them.

## Must stay

Players install 1.0.0 over the old app and keep everything. Do not change:

- bundle ID `io.github.mat4m0.gwonmac`, Apple Team ID `9NN976MFZ4`, the
  Developer ID identity, the app name "Guild Wars Reforged", the userData
  folder, Keychain service and item names, Electron fuses, and entitlements;
- the ability to read every player data file the current app writes (settings,
  builds, templates, accounts, launcher state, game files and chunk store).
  Delete only code that serves going back to older versions;
- the format of `apps/website/public/launcher/news-v1.json` (old installed apps
  read it);
- the certification proofs and verifier in `src/main/certification/` and their
  tests: `tests/unit/client-certification*`, `tests/unit/enhancement-*`,
  `tests/client-artifact/`.

## Source map

| Path | Owns |
| --- | --- |
| `src/main/` | native resources, files, network policy, credentials, windows, updates, client lifecycle |
| `src/main/certification/` | client certification and deterministic WASM transforms |
| `src/preload/` | the small validated capability bridge; no domain policy |
| `src/renderer/` | game host, input, in-game presentation; no Node.js |
| `src/shared/` | contracts and validation used by two or more processes |
| `src/companion-kernel/`, `src/cartography-reachability-kernel/` | read-only Rust kernels |
| `apps/launcher/`, `apps/tools/` | Vue launcher and Tools UI |
| `apps/website/` | www.gwonmac.com and all player docs |
| `tests/` | `unit`, `policy`, `client-artifact`, `integration`, `electron` (CI only) |
| `docs/` | maintainer docs (below) |

A move to `app/ client/ features/ kernels/ website/` is coming; update this map
when it lands.

## Working rules

- Prefer `delete > simplify > replace > add`. Do not add a second path when one
  direct path can own the behavior.
- Code and tests own exact values. Docs own intent, boundaries, and procedures.
  Fix the owning doc in the same change.
- Validate the sender and the value at every IPC boundary. Keep domain decisions
  out of transport handlers.
- Every module under `src/` starts with a block comment that says what it owns.
- Use offline fixtures in tests. Do not commit client files, game data,
  credentials, diagnostics, or private traffic.
- Do not claim that gameplay, graphics, or input feel passed unless a person
  checked it in the real game.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, ...); keep commits
  atomic. PRs target `main` and are squash-merged.

## Where docs live

- Players: https://www.gwonmac.com/docs (source in `apps/website/content`).
- Maintainers: `docs/`. Start with [process-model.md](docs/process-model.md),
  [wasm-host.md](docs/wasm-host.md),
  [enhancement-development.md](docs/enhancement-development.md),
  [diagnostics.md](docs/diagnostics.md), [releasing.md](docs/releasing.md),
  [recertify.md](docs/recertify.md), and [migrations.md](docs/migrations.md).
  Feature contracts sit beside them (accounts, settings, Hub, trade, whispers,
  maps, timers, texture packs).
- Product scope: [PRODUCT.md](PRODUCT.md). Interface rules: [DESIGN.md](DESIGN.md).
