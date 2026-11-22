# Feature platform plan (bottom up)

<!-- Owns: the step-by-step plan that turns optional extras into Features, with each step's check
and status. Code and tests own exact values; update Status and Rounds here as steps move. -->

Goal: every optional feature is one folder on typed building blocks, switched by one decision
function, shown in one Features tab, and keeps working through ArenaNet updates without a release
wherever its proofs allow. Core (fixes and required behaviour) stays separate and is out of scope.

Baseline: main `8618d115` (2026-11-21). Players see the word **Features** (agreed with Foo,
2026-11-21); code keeps "feature". "Tools" below means today's code names (Tools mode,
`gwonmacTools`), not the player word.

## Decisions (2026-11-21)

- Players see **Features**, not plugins, mods or Tools. First-party only; "install" means turn on.
- **Character Switch is a Feature**, not Core: it relies on a proven capability
  (`characterSwitchAction`), so it must turn off when an update breaks the proof.
- **Plain game replaces the Tools Beta master switch**: one switch plays with nothing optional
  loaded; turning it off restores every Feature as it was.
- **Hub ⌘R always opens Home** (Foo's rule from PR #24).
- **Foo's memory panel stays as he built it**: the memory warning and ⌘Q share one in-game panel
  with the memory figure, Reload and Quit; the native dialog stays the fallback.
- No plugin loader, raw memory API, generic hooks or second game model (the product safety rule
  in AGENTS.md).

## Who does what

All work happens on this Mac, by us.

- **Claude** builds, tests, measures, writes docs, and opens every PR.
- **You (Matthias)** make the product decisions, play the game for every "you play" check, and
  approve each merge. The **You** column below lists only what a step needs from you beyond the
  merge approval.
- Foo is informed, not assigned: you tell him what we take from PR #24 and where the plan stands.

## How to follow this plan

- One step = one PR (Conventional Commits, squash-merged, merged only after your OK).
  Steps in the same phase with no dependency can run at the same time as separate sessions in
  their own worktrees on this Mac. Update **Status** and **Rounds** here when a step moves.
- A step is done only when every line of its **Done when** is true and CI is green. "You play"
  checks need you in the real game; nobody claims feel or frame time from tests.
- PR CI runs only the Electron tests tagged `@journey`; main runs the whole suite. Before a PR
  that touches app or test code merges, dispatch the whole suite on its branch
  (`gh workflow run macos.yml --ref <branch>`) and link the green run in the PR. (Learned
  2026-11-21: #26, #30 and #31 merged green and turned main red.)
- Never run Electron or Playwright UI suites locally; CI runs them. Client-artifact tests and
  proof work use the official client on this Mac; no ArenaNet bytes leave it.
- The "Must stay" list in AGENTS.md is never touched: bundle ID, data files, `news-v1.json`,
  the certification proofs and verifier and their tests. Every step's check includes
  `tests/unit/client-certification*`, `tests/unit/enhancement-*` passing unchanged.
- Stall rule: two rounds on one step without progress → stop, run `step-back`, try one named
  mechanism with a numeric check. Count rounds per step below.
- Gates (G1–G3) are your decisions: if a gate fails, change the plan here before continuing.

## Metrics

Run `node scripts/feature-metrics.mjs [revision]` after each phase and record the result here.
`pnpm check` fails when a metric is above its ceiling in `scripts/feature-metrics-ceilings.json`; when a change lowers a metric, lower that ceiling to the new value in the same PR.

| Metric | Baseline (8618d115) | Target |
|---|---|---|
| `featureActivationRequested(` calls in app (no tests) | 38 | 1 (inside `resolve`) |
| `policy().` reads in app/features | 30 | 0 |
| `plainGame` reads in app (no tests) | 0 (26 in PR #24) | only the launch decision |
| Distinct `gw:*` window event names in app | 89 | only input/menu plumbing; 0 between features |
| Feature names in shared substrates (`attachWhispers`, `attachTravel`) | 2 | 0 |
| Feature-domain files under `app/renderer/` (skill, whisper, trade, people, party, alcohol, effect, cartography) | 14 | 0 feature logic (blocks only) |
| Files outside a feature's folder that name its id (no tests) | travel 17, cartography 9, quick-item-move 9, whispers 9, progress 8, team-apply 8, xunlai-storage 8, build-library 7, skill-cooldowns 6, trade-chat 5, 9 more ≤ 3 | registry + tests only |
| `localStorage` uses in Tools UI (positions etc.) | 21 | only true per-viewer conveniences; positions in settings |
| Per-feature `v-if="tool === …"` in launcher and Tools UI | 7 (9 in PR #24) | 0 |
| Files touched to add a group A feature | not measured | 1 folder + 1 line |

After Phase 0 (`7b9bc471`): same as the baseline except `gw:*` events 91 and `v-if` cases 9;
the two new events and two new `v-if` cases came with the PR #24 options (#26–#32) and go away in Phases 4–6.

After 5.2: `featureActivationRequested(` 39 → 38, `policy().` reads 27 → 19, feature-domain renderer files 13 → 12;
the rest unchanged. The group A ids still named outside their folders are certification and shared contracts
(Must stay), the settings catalogue, the launcher (4.4) and Travel's Hub page (5.4).

## Phase 0 · Baseline and decisions (S)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 0.1 | Metrics script `scripts/feature-metrics.mjs` that prints the table above from the repo | – | – | Output matches the baseline column on 8618d115; runs in < 10 s | done (1.3 s; corrected two hand counts) | 1 |
| 0.2 | Take over PR #24: rebuild its good parts as our own small PRs (travel fix, Hub size/resize/stay-open, character search Enter, settings transfer, simple launcher, Steam-login option, small hide/drag options), crediting Foo as co-author; keep Foo's memory panel as he built it (decided 2026-11-21: memory warning and ⌘Q share one in-game panel with the memory figure, Reload, Quit; native dialog stays the fallback); ⌘R always opens Home (decided 2026-11-21), so the page-resume test changes on purpose; regenerate the keyboard golden on purpose | Tell Foo; play travel + Hub | – | Each PR green in CI incl. hub-e2e; ⌘R rule written in `docs/hub-contract.md`; `kind` and plain game wait for 4.3/4.6 | merged 2026-11-21: #26 Hub, #27 travel, #28 memory panel, #29 settings transfer, #30 simple launcher + Steam login, #31 overlay placement, #32 toggles; Matthias play check pending; close #24 | 1 |
| 0.3 | Record the decisions: Character Switch is a Feature; plain game replaces Tools Beta; ⌘R always Home; memory panel stays; player word **Features**; grouping settled later by 6.4 | – | – | Written in "Decisions" above | done | 0 |
| 0.4 | Keep this plan safe: commit it as `docs/feature-platform-plan.md` (same PR as 0.1) | Approve the merge | 0.3 | Plan lives on main | done (#25) | 1 |

## Phase 1 · Proofs: close the two patch-day gaps (S–M, runs alongside everything)

Most of this already exists: since the October 22 client, reviewed bodies match a relink by their
relocation identity, and `tests/client-artifact/patch-day-replay.test.ts` replays real patch days.
On November 3 every feature proved except Quick Item Move, and friend observation refused until its
moved assertion lines were reviewed (`docs/arenanet-compatibility.md`, "Current implementation
limits" and "Patch day"). Decided 2026-11-21: fix only those two now. The other exact bindings
(native double-click bodies, Cartography pathing indices, raw digests in Core/Tools candidate
selection) never refused a real patch day; take each on when one does. A body ArenaNet truly
changes still needs a review and a fact-only release by design. Changes here touch Must-stay files
only by adding, never by changing proved outputs.

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 1.1 | Quick Item Move: accept a relink whose memory-code digest changed when its reviewed item and trade fields still reproduce semantically | Decide if it stays exact, if the locator is not sound | – | Replay: November 3 proves Quick Item Move (or a written decision why it stays exact); proved outputs of every other retained client unchanged; adversarial tests (changed field, duplicate, ambiguity) refuse; "limits" entry updated | decided: stays exact (1-day spike 2026-11-21, no-go). No native code witnesses that the context root the transform uses holds the native context table's game context; moving the transform to that table changes every retained client's proved output; the trade item list, count and UI constants have no relocatable native reader. Nov 3 refuses until a fact-only release; Feature page: "may need an update" | 2 |
| 1.2 | Friend observation: role shapes survive an equivalent compiler rewrite (relations checked, not exact shapes) | – | – | Replay: November 3 friend observation proves without its own facts; `FRIEND_OBSERVER_SEMANTIC_SHA256` unchanged unless a role's meaning changed; adversarial tests refuse; "limits" entry updated | merged (#41): roles also match with assertion source lines erased; Nov 3 proves, pin and outputs unchanged | 1 |

## Phase 2 · Readers: one layout source (S–M)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 2.1 | Research: are Rust snapshot layouts (`kernels/companion/abi.rs`) and TS decoders (`companion-abi.ts`, `*-snapshot.ts`) checked against each other today? | – | – | Answer with file:line; if a test already fails on drift, skip 2.2 | done: no check in `pnpm check` tied snapshot offsets. `the-companion-abi-is-exact-across-typescript-and-rust.test.ts` covers only the config `Layout` order, feature bits, dispatch kinds, `companion_init` and two ABI numbers; Rust pins its own sizes (`abi.rs:817-836`); size exports meet `COMPANION_ABI` only in `kernels.mjs verify` (`scripts/kernels.mjs:236`, macOS CI) and the loader at runtime (`companion-kernel-loader.ts:155`); decoders use literal offsets (e.g. `companion-alcohol-snapshot.ts:21`). A planted same-size swap in `AlcoholSnapshot` passed all 2211 unit tests; only the macOS integration test caught it, because it asserts that field | 1 |
| 2.2 | If not: one test (or generation) that fails when a Rust and TS layout differ | – | 2.1 | Test fails on a planted offset change, passes on main | done: `companion-snapshots-decode-at-rust-offsets.test.ts` computes repr(C) offsets from `abi.rs` and runs every decoder on a publication written by Rust field name; 10 planted drifts (Rust swaps, magic, size; TS offset, stride, swap, ABI) each fail it | 1 |

## Phase 3 · Building blocks: typed `game.*` and `ui.*` (M–L)

Wrap the existing substrates; do not move memory. Heap layout and proofs stay identical.

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 3.1 | Block interface: `subscribe(cb) → stop`, `available` + reason; first blocks `game.target`, `game.region` | Review the API shape | 0.3 | Companion memory regions and part order identical before/after (test compares the list); all existing tests unchanged | merged (#40): `app/renderer/game-blocks.ts` on `context.game`; layout pinned by `the-companion-heap-layout-stays-fixed.test.ts` (unchanged before/after; catches a planted part swap); no feature moved yet (5.1) | 1 |
| 3.2 | `game.session`: character changed / left game, once for everyone | – | 3.1 | Table test of login, relog, character select, zone change; Whispers and party-invite tracking deletable in 5.x | in review: `game.session` in `game-blocks.ts` (rules at `followSession`, taken from party invite's played rules); table test in `game-blocks.test.ts`. 5.x deletes: Whispers' `character` tracking in its `companion.ts` `sync` (5.3), party invite's `known`/`left` key tracking in `arrival` (`party-invite.ts`, with 5.3). Whispers today also clears on the moment of unavailable game in a zone change; on the block it keeps the session (decision for 5.3) | 1 |
| 3.3 | `game.chat.messages` + `game.chat.send(line)`: the chat send slot moves out of Whispers into a block | Play: invite with Whispers off | 3.1 | Party invite works with Whispers off (unit test + you play); send slot memory layout unchanged | in review: `game.chat` in `game-blocks.ts` (`messages`, and `send(line)` for one whisper or one invite); the region and send slot moved to the chat substrate (`chat-installation.ts`); its memory phases stay on the Whispers line, so the pinned layout is unchanged; Whispers and party invites use the block; Hub offers Invite with Whispers off (`game-chat.test.ts`); Matthias play check pending | 1 |
| 3.4 | `game.friends` without `attachWhispers` / `attachTravel`; links become typed feature links (4.5) | – | 3.1, 4.5 | 0 feature names in `tools-companion-substrates.ts` | todo | 0 |
| 3.5 | Remaining blocks: `skillbar`, `effects`, `party`, `alcohol`, `progress`; `ui.overlay`, `ui.hudLayer`, `ui.position`, `hub.row`, `commands` | – | 3.1 | Every group A feature's needs covered (list in this file); no block exposes memory, pointers or untyped calls | merged (#49): only what 5.2 needs (list below): `game.effects`, `game.alcohol`, `game.progress`, `ui.skillKeys`, `ui.effectLabels`; the progress region moved to a substrate with its memory phases on the Progress line (pinned layout unchanged); the rest left out for lack of a user (`skillbar` and `ui.skillLabels` came with 5.1, `session` with 3.2, `chat` with 3.3) | 1 |

What the 5.2 features need (3.5, 2026-11-22). Each reads and draws only through these; what stays in the feature is named.

| Feature | Reads | Draws or does | Stays in the feature |
|---|---|---|---|
| Skill Key Labels | settings (`skillKeyBindings`) | `ui.skillKeys` | the default `1`–`8` label for a slot without a binding; 5.2 deleted the key consumer in the skill HUD substrate |
| Effect Timers | `game.effects` | `ui.effectLabels` | the longest remaining time per skill, the 1-hour placeholder cut-off, the three urgency colours |
| Alcohol Timer | `game.alcohol`, settings (`alcoholTimerPosition`) | its DOM readout, saving the position in settings as Target Distance does | it asked for the player-effect and effect-icon feeds, but the readout never read them: 5.2 confirmed that and dropped the demand |
| Reminders | `game.effects`, `game.alcohol`, settings | prints through chat print, its own certified stage (it is the only user); the chat-print memory stays on its line | the reminder rules in `reminders.ts` |
| Progress | `game.progress` | hands the state to Travel's Progress page | the link to Travel (typed link, 4.5); Maps' quest route subscribes to `game.progress` itself (5.5) |

Left out, because no 5.2 feature uses them: `game.party` (Team Apply, Maps and the Tools window, 5.5); `ui.overlay` and `ui.hudLayer` (the drawing blocks own the HUD channels, a DOM readout stays in its feature folder, and a generic HUD layer would be an untyped drawing surface); `ui.position` (positions already live in settings, and the settings block plus `gwNative.settings.set` covers them); `hub.row` (Progress's page lives in Travel's Hub app, which 4.5 `hubPage` and 5.4 move); `commands` (no 5.2 feature has one).

For 5.2: Reminders and Progress host memory on pinned `COMPANION_PARTS` lines (as Whispers does for the chat region), so `featurePart` alone cannot build them. Decided in 5.2: those lines stay thin hand-written parts that write their memory phases and hand the session to the `featurePart` they prepare (about 28 lines in all; a memory option on `featurePart` would cost more and serve only these two).

**G1 (after 3.1 + 5.1):** Target Distance and Skill Cooldowns on blocks are ≤ 15 lines of logic each,
touch 0 shared files, 4.2 passes, and you see no frame-time change in a busy fight. If a small helper
over today's substrates gives ~80% of this, take the helper and simplify Phase 3.

G1 evidence (5.1, 2026-11-21; your play check and decision still open):

| Check | Result |
|---|---|
| Logic lines (non-blank, non-comment, non-import) | Target Distance 10 (was 29 in `companion.ts`); Skill Cooldowns 11 (was 73 in the overlay consumer plus its wiring in `skill-overlays-installation.ts`, all in `app/renderer/`) |
| Shared files | The feature folders hold all feature logic. A one-time platform change came with it: `game-blocks.ts` (+`game.skillbar`, +`ui.skillLabels`), `tools-companion-part.ts` (+`featurePart`, the start → stop adapter that 4.5 formalises), the installer (passes the skill feeds and `context.ui`, runs `FEATURE_PARTS`), the skill substrate (feeds run on demand; the cooldown consumer is deleted), `skill-slot-projection.ts` (takes any element with a rect). The next block-only feature needs none of these when its blocks exist |
| Why `FEATURE_PARTS` | The heap-layout test pins the exact `COMPANION_PARTS` id list; a block-only part owns no memory, so it goes in a second list that runs after it. Target Distance keeps its pinned line |
| 4.2 (PR #42, run against this branch) | passes; a planted missing stop in either feature fails it |
| Heap layout | `the-companion-heap-layout-stays-fixed.test.ts` unchanged and green |
| Metrics (main `3d2916bc` → branch) | `policy().` reads in app/features 30 → 28; feature-domain files under `app/renderer/` 14 → 13; the rest unchanged. Files outside the folder naming the id: skill-cooldowns 6, target-readout 3, unchanged: settings catalogue and launcher UI (4.3–6.3), and the kernel region named `skillCooldowns` (a name clash, not a feature reference) |
| Helper instead of blocks? | Target Distance: yes. `game.target` already existed, so `featurePart` alone gives all of it. Skill Cooldowns: no. A helper over the existing feeds leaves the projection, the frame ids and the repaint check in the feature, about 70 lines, so it fails the 15-line bar. The blocks cost about 105 new platform lines (`skillbar` 15, `skillLabels` 54, `featurePart` 37; app/ is +305 −217 in total). They pay back only if 5.2 reuses `featurePart` (all five features) and a sibling of `skillLabels` (Skill Key Labels, Effect Timers) |
| Frame time | Not measured; needs your busy-fight check with each feature on |

## Phase 4 · Feature contract and decision (M)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 4.1 | `resolve(feature, state) → on \| reason` (pure, `app/shared`) | – | 0.3 | Table test: every feature × state equals today's activation, or each difference is filed as a bug; reasons cover plain game, off, needs X, not proven, needs update, wrong area | merged (#39): `app/shared/feature-resolve.ts`; one difference (Call Target before restart) listed in the PR | 1 |
| 4.2 | Generic "stop leaves nothing" test (listeners, timers, DOM, subscriptions) | – | – | Catches a planted leak; runs for every feature part; failures fixed or listed | merged (#42): `tests/unit/feature-main-parts-stop-leaves-nothing.test.ts`, `app/ui/tools/src/feature-parts-stop-leaves-nothing.dom.test.ts`; three leftovers listed in the PR | 1 |
| 4.3 | Manifest v2: one id (folder = id = key), `name`, `summary`, `kind`, `icon`, `uses`, `requires`, `network`, typed `settings` with label/help (incl. `position`), `shortcuts`, `hub`, `shots`, `parts`; README.md, CHANGELOG.md, media/ | Review names and copy | 4.1 | Contract checks in `pnpm check` (labels, shots per caption, README subset, no `requires` cycles, known `uses`, `## Unreleased`) each catch a planted error with a clear message | merged (#48): manifest v2 in all 20 features with README, CHANGELOG and media/; checks in `app/features/contract.ts`, run by `tests/policy/feature-contract.test.ts` (17 planted errors) plus a launcher test for Lucide icons; follow-up 2026-11-22: `capabilities` is renamed `uses`; ids stay camelCase with folder = kebab of id, because the id keys the runtime policy that `tests/unit/enhancement-runtime-policy.test.ts` pins (a Must-stay test; folder ids would change 41 files and that test); `activation` stays for 4.4 and `tool.id` for 6.3; `shots` empty until the captures question is settled | 1 |
| 4.4 | Settings keys: convert (`whispersEnabled` → `features.whispers`) vs keep by rule (`<id>Enabled`); pick the one that passes with less code | – | 4.3 | Player-data fixture test loads every old file identically; any conversion listed in `docs/migrations.md` with removal condition | todo | 0 |
| 4.5 | Part kinds `game`, `hubPage`, `window`, `main` (each start → stop) and typed feature links (`whispers?.open(name)`) | – | 4.1, 3.1 | Trade → Whispers uses a typed link; 0 `gw:whisper-person`; `main-parts.ts` "every channel owned once" check kept | todo | 0 |
| 4.6 | Plain game as a launch mode (Core launch, nothing optional loaded); `gwonmacTools` stays the launch-mode source | Play: plain on, off | 0.2, 4.1 | 0 `plainGame` checks outside the launch decision; turning it off restores every switch; settings transfer carries choices, not the mode | merged (#44): **Play the plain game** writes only `gwonmacTools`; Character Switch now follows it; first-run step offers Features or the plain game; Matthias play check pending | 1 |
| 4.7 | `docs/feature-contract.md` + `pnpm new-feature <id>` scaffold; rewrite "Add or change a feature" in `docs/enhancement-development.md` | – | 4.3, 4.5 | A fresh agent given only the doc + scaffold builds a new group A feature: 1 folder + 1 line, 0 shared files, every mistake caught by a check | todo | 0 |

**G2:** 4.1–4.3 pass and G1 passed → contract is fixed; start the rest of Phase 5.

## Phase 5 · Move every feature (one PR each)

Per-feature checklist (the **Done when** of every 5.x row):
1. Manifest v2 + README + CHANGELOG + card/shots captions.
2. Logic lives in its folder; files outside naming its id = registry + tests only.
3. Uses only `game.*` / `ui.*` blocks or its certified stage; no `policy()`, no `featureActivationRequested`.
4. 4.2 passes; existing behaviour tests pass unchanged (or changed on purpose, stated in the PR).
5. Positions and options in settings (Copy settings carries them).
6. You play: turn it on, use it, turn it off in the real game.

| ID | Group | Features (in order) | Status | Rounds |
|---|---|---|---|---|
| 5.1 | A (proof of concept, feeds G1) | Target Distance, Skill Cooldowns (pull out of `app/renderer/skill-cooldown-overlay-consumer.ts`) | merged (#43): both are one `featurePart(id, start)` in their folder (10 and 11 logic lines), no `policy()` or `featureActivationRequested`; new blocks `game.skillbar`, `ui.skillLabels`; block-only parts listed in `FEATURE_PARTS` so the pinned heap layout is unchanged; manifest v2 and settings stay for 4.3/4.4; Matthias play check pending (G1 evidence under Phase 3) | 1 |
| 5.2 | A | Skill Key Labels (out of `skill-key-overlay-consumer.ts`), Effect Timers, Alcohol Timer, Reminders, Progress | in review: each runs through `featurePart` in its folder with no `policy()` or `featureActivationRequested`; the key consumer is deleted; Reminders and Progress keep their pinned lines through a thin hand-written part; Alcohol Timer drops the effect feeds it never read and is `non-pvp` so a map load does not clear its estimate; Maps reads `game.progress` itself; manifest v2 and settings stay for 4.3/4.4; Matthias play check pending | 1 |
| 5.3 | B (proof of concept, feeds G3) | Whispers: session + window parts, typed `open` link, drop own session tracking, placement in settings | todo | 0 |
| 5.4 | B | Trade Chat (declares `network`), Travel (hub page + main + action), Build Library (window + files) | todo | 0 |
| 5.5 | C (shell only; behaviour stays in its stage) | Chat Filters, Quick Item Move, Resign, Call Target (out of `input.ts` if the input layer allows), Xunlai, Team Apply, Maps | todo | 0 |

**G3 (after 5.1 + 5.3):** if a feature needs a special case in the platform, fix the contract
(Phase 4) before continuing, not the feature.

## Phase 6 · Player experience (can start with test data after 4.1)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 6.1 | Update canvas to the final contract (plain game strip, reasons from `resolve`, grouping options) | Sign off the look | 0.3 | Canvas v12 published; every state shown maps to a `resolve` reason | done: canvas v12 published 2026-11-22 (Features word, plain game strip, 9 `resolve` states on card, row and page, Group by Kind · Purpose, manifest v2); Matthias sign-off of the look pending | 1 |
| 6.2 | Features tab in the launcher: catalog Large/Compact, Feature page (README, What's new, What it uses, Needs, options from manifest), status strip | Look at it | 4.1, 4.3 | Launcher UI tests (vitest) for each state; screenshots per state in the PR match the canvas; keyboard and focus rules pass | in review (#53): catalog, plain-game strip and Feature page from manifest v2, README, CHANGELOG and `resolve`; optional typed `purpose` with a contract check; capability words in `app/shared/feature-uses.ts`; the launcher has no build checks yet, so checked features read `checking` with a working switch until 7.1; `wrong-area` reads as on in the launcher; review round: a player can always turn a Feature off (only the plain game holds switches), rebased on #51; screenshots per state next to canvas v12 in the PR | 2 |
| 6.3 | Move Settings › Tools and › Maps into the Features tab; delete the old sections | – | 6.2 | Old components deleted; Settings search still finds every option; Electron journey test green in CI | todo | 0 |
| 6.4 | Player test (3–5 players from Discord): find cooldown numbers, why is X off, play plain, change route colour; half see kind, half purpose | Find players, run sessions | 6.2 | ≥ 4/5 finish each task without help; grouping decided by first-correct-click time and recorded | todo | 0 |
| 6.5 | Hub shows the same status reasons for feature rows | – | 4.1 | Hub keyboard golden regenerated on purpose; dom tests for an unavailable row with reason | todo | 0 |
| 6.6 | Website feature docs come from each README (one source) | – | 4.3 | Every feature page on gwonmac.com rendered from its README; `website` CI green | todo | 0 |

## Phase 7 · Delivery and patch day (S–M)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 7.1 | Effective feature status → `resolve` reasons → Features tab ("Needs a GWonMac update", "Checking…") | – | 4.1, 6.2 | Replaying a retained client generation produces the per-feature statuses the replay test expects (e.g. Nov 3: Quick Item Move needs an update) | todo | 0 |
| 7.2 | Release script stamps each feature's `## Unreleased` and builds release notes from them | – | 4.3 | Dry run on a branch produces correct notes; `news-v1.json` format unchanged | in review (#50): `pnpm release:notes <version> [--dry-run]` in `scripts/release.ts` writes a `## Features` section (bullets led by the manifest `name`) into the draft release post and stamps non-empty `## Unreleased` (Stable only; a Beta or RC writes only the post); refuses a post `parseNewsStory` would refuse; `news-v1.json` untouched; tests in `tests/unit/release-feature-notes.test.ts` | 1 |
| 7.3 | Patch-day drill | Walk through it once | 7.1 | Written run-through in `docs/releasing.md`: what players see, what we do | todo | 0 |

## Phase 8 · Clean up (S)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 8.1 | Delete old paths: `FeatureActivation` kinds, `tool.id`, per-feature enabled keys (if converted), `attach*`, feature `gw:*` events, old settings sections | – | Phase 5 | Metrics script shows every target met | todo | 0 |
| 8.2 | Remove temporary compatibility code whose condition is met; `docs/migrations.md` current | – | 8.1 | Every remaining entry has a dependent and a removal condition | todo | 0 |
| 8.3 | Docs pass: `process-model.md`, `wasm-host.md`, `enhancement-development.md`, `settings.md`, `whispers.md` match the code | – | 8.1 | Each doc's examples compile or match current file names | todo | 0 |

## Order at a glance

```
Phase 0 ──► 4.1, 4.2 ─────┐
        └─► 3.1 ──────────┼─► 5.1 ─► G1 ─► 4.3–4.7 ─► G2 ─► 5.2–5.5 ─► G3 ─► 8
Phase 1 (2 steps, alongside) 6.1 ─► 6.2 ─► 6.3, 6.4, 6.5 ─► 7
Phase 2 (small)
```

Parallel sessions that never touch the same files: Phase 1 · Phase 2 · 4.1 + 4.2 · 3.1 · 6.1.

## Open questions (yours to decide)

- Kind or purpose grouping? (6.4)
- Can `uses` replace `programs` in the verifier vocabulary, or do both stay? (research before 4.3; verifier is Must stay)
  Facts from 4.3, not a decision: `uses` (named `capabilities` until the 4.3 follow-up) are verifier proofs that gate a
  feature; `programs` are developer launch programs (`ENHANCEMENT_PROGRAMS`: `toolbox-foundation`,
  `target-observer`, …) that select a feature regardless of its switch. Manifest v2 keeps both fields.
- Captures with ArenaNet art: repo or website only? (before 6.2)
