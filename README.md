<p align="center">
  <img src="assets/guild-wars-reforged.png" width="350" alt="gwonmac application icon">
</p>

<h1 align="center">gwonmac</h1>

<p align="center">
  <strong>Guild Wars Reforged for macOS</strong><br>
  Play ArenaNet's official Guild Wars client on an Apple Silicon Mac in high resolution and FPS.
</p>

<p align="center">
  <a href="https://www.gwonmac.com/">Website</a> ·
  <a href="https://www.gwonmac.com/download">Download</a> ·
  <a href="https://www.gwonmac.com/docs">Guide</a> ·
  <a href="https://discord.gg/Z9ft52RBD3">Discord</a> ·
  <a href="https://github.com/gwonmac/gwonmac/issues/new?template=bug-report.yml">Report a bug</a> ·
  <a href="https://github.com/gwonmac/gwonmac/issues/new?template=feature-request.yml">Suggest a feature</a>
</p>

> [!CAUTION]
> **This is an unofficial client host.**
> ArenaNet and NCSOFT do not make, sponsor, endorse, or support gwonmac.

## What gwonmac does

gwonmac hosts ArenaNet's official WebAssembly client (the one the mobile app
uses) in a sandboxed macOS app. You do not need Windows, Wine, VMware, or
CrossOver.

- Native Apple Silicon app, signed and notarized by Apple.
- High FPS at full Retina resolution.
- Verified downloads from ArenaNet; the untouched official client is always the
  fallback.
- ArenaNet and Steam sign-in, with saved login in the macOS Keychain.
- Build and team management, plus optional Tools.

You need an Apple Silicon Mac, a Guild Wars account
([official store](https://store.guildwars.com/en-us)), and an internet
connection.

## Install and play

Download the app from https://www.gwonmac.com/download or the
[Releases page](https://github.com/gwonmac/gwonmac/releases), open the `.dmg`,
and move **Guild Wars Reforged.app** to **Applications**. The
[guide](https://www.gwonmac.com/docs) explains sign-in, updates, Tools, and
troubleshooting.

## Privacy

The app sends no gwonmac telemetry. Feedback you write in **Help** goes to the
gwonmac team only when you send it. Diagnostics stay on your Mac until you
attach an export to a report, and they never contain credentials, packet
contents, cookies, request bodies, or local paths. ArenaNet and login providers
still receive the traffic the game needs. See [SECURITY.md](SECURITY.md).

## Build from source

You need macOS on Apple Silicon, Xcode Command Line Tools, Node.js 22.19 or
newer, pnpm 11, and Rust through rustup.

```bash
xcode-select --install
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.
Maintainer docs are in [docs/](docs/); agent instructions are in
[AGENTS.md](AGENTS.md).

## Credits and license

gwonmac descends from
[gwdevhub/gw_in_browser](https://github.com/gwdevhub/gw_in_browser), which
proved that an external host can run ArenaNet's official WebAssembly client.
The project also uses work or knowledge from
[GWToolbox++](https://gwtoolbox.com),
[GuildWarsMapBrowser](https://github.com/Jonathan-Greve/GuildWarsMapBrowser),
and [gwnative](https://github.com/jean-humann/gwnative).

The source code is licensed under [GPL-3.0-only](LICENSE). Guild Wars names,
logos, screenshots, game content, and other third-party material keep their
original rights. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
