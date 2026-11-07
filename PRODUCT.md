# Product brief

This document defines the product scope. The
[website guide](https://www.gwonmac.com/docs) describes player behavior, and
[docs/](docs/) holds the implementation boundaries.

## Product

gwonmac is a sandboxed macOS host for ArenaNet's official Guild Wars
WebAssembly client. It downloads and verifies the official client, supplies the
macOS platform services the client needs, and includes no game binaries.

When the official client needs a macOS repair, gwonmac creates a separate
derived copy and verifies the exact output before use. If verification fails,
gwonmac uses the untouched official client.

## Users

The primary user is a Guild Wars player with an Apple Silicon Mac who wants the
official game without Windows, Wine, or a browser tab. Some returning players
also want a small set of familiar tools; they do not need a plugin platform.
Some players use more than one account: every installation has at least one
account profile, and each profile opens in its own game window.

## Product promise

- Keep the official game playable after an unknown ArenaNet update.
- Make ArenaNet patch-day certification fast and safe.
- Let optional Tools fail without blocking the game.
- Keep host-owned Builds and Teams available without live Tools.
- Keep local data and diagnostics under the player's control.
- Keep player data when a new version installs over an old one; never
  downgrade automatically.
- Let players use local legacy TexMod UI texture packs without running mod code.
- Keep the project understandable for one new contributor.

## Tools

Required template compatibility and Core cursor support run when their exact
client proofs permit them. Optional **gwonmac Tools Beta** is off by default,
and every tool has its own switch beneath that master opt-in. Turning the
master off disables all tool surfaces, shortcuts, and chat aliases without
deleting saved tool data. A Core launch does not load optional Tools code at
all; Settings offers a restart to unload Tools completely.

Tools provides Build and Team authoring, party capture, team-code exchange,
read-only Trade Chat discovery with observed Kamadan NPC trader prices, Target
Distance, Xunlai storage opening, Travel, and explicit Team Apply. Players still
publish trade listings in Guild Wars. The Trader prices view does not estimate
player-market prices, and Trade never sends or automates game chat or executes
trades. Team Apply is a
bounded configuration action that checks fresh game state after each step.
**Tools Beta** describes feature maturity.

Texture packs: players import legacy 32-bit TexMod `.tpf` interface packs and
choose one appearance for newly opened game windows. Packs replace matching
textures only and cannot run code or read game state. See
[Texture packs](docs/texture-packs.md).

## Non-goals

- No Windows or Linux version.
- No redistribution of ArenaNet game binaries.
- No autonomous gameplay.
- No bots, macros, input broadcasting, synchronized control, automated trading,
  listing publication, trade execution, pricing manipulation, inventory
  automation, or chat automation.
- No cloned app installations or duplicated game downloads for extra accounts.
- No generic memory, packet, command, or plugin API, and no port of the Windows
  plugin ABI.
- No general mod loader, executable TPF content, texture stacking, or pack editor.
- No gwonmac telemetry. Feedback is sent only when the player submits it.
- No silent eviction policy or fixed disk-usage promise.
- No forced mid-session restart.
- No compatibility layer that keeps an obsolete internal design alive.

## Bounded input the app may send

These actions restore a session or carry out an explicit player command. They
do not permit autonomous play.

- After a trusted click that produced no Guild Wars cursor event, the app may
  replay one bounded pointer hit-test. It cannot originate a click.
- Team Apply acts only after an explicit player command. Travel and invite
  sends one named party invite after the requested arrival and never retries.
- After an explicit Reload, the app may send one Return after saved login is
  restored, one while the certified native Play control is visible, and a third
  only while the certified reconnect dialog is visible. It expires after 30
  seconds, cannot change the selected character, cannot repeat a step, and is
  off when the exact client build is not certified.

## Evidence standard

Consequential privacy, data, release, update, and performance claims need
executable evidence; [Diagnostics](docs/diagnostics.md) maps them to their proof
boundary. Do not defend an unsupported promise with more prose: narrow it or
delete it.

Three rules take priority:

1. Preserve the official ArenaNet artifact.
2. Do not upload account data, game traffic, or diagnostics to a gwonmac
   service.
3. Do not choose or trigger gameplay for the player.
