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

## Phase 0 · Baseline and decisions (S)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 0.1 | Metrics script `scripts/feature-metrics.mjs` that prints the table above from the repo | – | – | Output matches the baseline column on 8618d115; runs in < 10 s | done (1.3 s; corrected two hand counts) | 1 |
| 0.2 | Take over PR #24: rebuild its good parts as our own small PRs (travel fix, Hub size/resize/stay-open, character search Enter, settings transfer, simple launcher, Steam-login option, small hide/drag options), crediting Foo as co-author; keep Foo's memory panel as he built it (decided 2026-11-21: memory warning and ⌘Q share one in-game panel with the memory figure, Reload, Quit; native dialog stays the fallback); ⌘R always opens Home (decided 2026-11-21), so the page-resume test changes on purpose; regenerate the keyboard golden on purpose | Tell Foo; play travel + Hub | – | Each PR green in CI incl. hub-e2e; ⌘R rule written in `docs/hub-contract.md`; `kind` and plain game wait for 4.3/4.6 | in progress: 4 PRs from parallel sessions (travel fix, memory panel, Hub size + ⌘R Home, settings/launcher/overlay options); plain game and `kind` excluded | 0 |
| 0.3 | Record the decisions: Character Switch is a Feature; plain game replaces Tools Beta; ⌘R always Home; memory panel stays; player word **Features**; grouping settled later by 6.4 | – | – | Written in "Decisions" above | done | 0 |
| 0.4 | Keep this plan safe: commit it as `docs/feature-platform-plan.md` (same PR as 0.1) | Approve the merge | 0.3 | Plan lives on main | in review | 1 |

## Phase 1 · Proofs: survive ArenaNet updates (L, runs alongside everything)

Bottom layer. Each capability's proof finds its code by meaning, not exact bytes, so a harmless
ArenaNet rebuild needs no release. Highest risk area: changes here touch Must-stay files only by
adding, never by changing proved outputs.

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 1.1 | Inventory: per capability, which proof still binds exact bytes/indexes (from `docs/arenanet-compatibility.md` "Current implementation limits") | – | – | Table capability → binding type → planned locator, added to that doc | todo | 0 |
| 1.2 | One capability per PR: replace exact bindings with semantic locators (start with party/target observation, skill slots, chat) | – | 1.1 | `patch-day-replay.test.ts` proves that capability on every retained client it should; "limits" list shrinks by that item; verifier outputs for proved clients unchanged | todo | 0 |
| 1.3 | Quick Item Move and Maps locators (hardest) | Decide if they stay exact | 1.2 | Same as 1.2, or a written decision why they stay exact (shown as "may need an update" on their Feature page) | todo | 0 |

## Phase 2 · Readers: one layout source (S–M)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 2.1 | Research: are Rust snapshot layouts (`kernels/companion/abi.rs`) and TS decoders (`companion-abi.ts`, `*-snapshot.ts`) checked against each other today? | – | – | Answer with file:line; if a test already fails on drift, skip 2.2 | todo | 0 |
| 2.2 | If not: one test (or generation) that fails when a Rust and TS layout differ | – | 2.1 | Test fails on a planted offset change, passes on main | todo | 0 |

## Phase 3 · Building blocks: typed `game.*` and `ui.*` (M–L)

Wrap the existing substrates; do not move memory. Heap layout and proofs stay identical.

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 3.1 | Block interface: `subscribe(cb) → stop`, `available` + reason; first blocks `game.target`, `game.region` | Review the API shape | 0.3 | Companion memory regions and part order identical before/after (test compares the list); all existing tests unchanged | todo | 0 |
| 3.2 | `game.session`: character changed / left game, once for everyone | – | 3.1 | Table test of login, relog, character select, zone change; Whispers and party-invite tracking deletable in 5.x | todo | 0 |
| 3.3 | `game.chat.messages` + `game.chat.send(line)`: the chat send slot moves out of Whispers into a block | Play: invite with Whispers off | 3.1 | Party invite works with Whispers off (unit test + you play); send slot memory layout unchanged | todo | 0 |
| 3.4 | `game.friends` without `attachWhispers` / `attachTravel`; links become typed feature links (4.5) | – | 3.1, 4.5 | 0 feature names in `tools-companion-substrates.ts` | todo | 0 |
| 3.5 | Remaining blocks: `skillbar`, `effects`, `party`, `alcohol`, `progress`; `ui.overlay`, `ui.hudLayer`, `ui.position`, `hub.row`, `commands` | – | 3.1 | Every group A feature's needs covered (list in this file); no block exposes memory, pointers or untyped calls | todo | 0 |

**G1 (after 3.1 + 5.1):** Target Distance and Skill Cooldowns on blocks are ≤ 15 lines of logic each,
touch 0 shared files, 4.2 passes, and you see no frame-time change in a busy fight. If a small helper
over today's substrates gives ~80% of this, take the helper and simplify Phase 3.

## Phase 4 · Feature contract and decision (M)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 4.1 | `resolve(feature, state) → on \| reason` (pure, `app/shared`) | – | 0.3 | Table test: every feature × state equals today's activation, or each difference is filed as a bug; reasons cover plain game, off, needs X, not proven, needs update, wrong area | todo | 0 |
| 4.2 | Generic "stop leaves nothing" test (listeners, timers, DOM, subscriptions) | – | – | Catches a planted leak; runs for every feature part; failures fixed or listed | todo | 0 |
| 4.3 | Manifest v2: one id (folder = id = key), `name`, `summary`, `kind`, `icon`, `uses`, `requires`, `network`, typed `settings` with label/help (incl. `position`), `shortcuts`, `hub`, `shots`, `parts`; README.md, CHANGELOG.md, media/ | Review names and copy | 4.1 | Contract checks in `pnpm check` (labels, shots per caption, README subset, no `requires` cycles, known `uses`, `## Unreleased`) each catch a planted error with a clear message | todo | 0 |
| 4.4 | Settings keys: convert (`whispersEnabled` → `features.whispers`) vs keep by rule (`<id>Enabled`); pick the one that passes with less code | – | 4.3 | Player-data fixture test loads every old file identically; any conversion listed in `docs/migrations.md` with removal condition | todo | 0 |
| 4.5 | Part kinds `game`, `hubPage`, `window`, `main` (each start → stop) and typed feature links (`whispers?.open(name)`) | – | 4.1, 3.1 | Trade → Whispers uses a typed link; 0 `gw:whisper-person`; `main-parts.ts` "every channel owned once" check kept | todo | 0 |
| 4.6 | Plain game as a launch mode (Core launch, nothing optional loaded); `gwonmacTools` stays the launch-mode source | Play: plain on, off | 0.2, 4.1 | 0 `plainGame` checks outside the launch decision; turning it off restores every switch; settings transfer carries choices, not the mode | todo | 0 |
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
| 5.1 | A (proof of concept, feeds G1) | Target Distance, Skill Cooldowns (pull out of `app/renderer/skill-cooldown-overlay-consumer.ts`) | todo | 0 |
| 5.2 | A | Skill Key Labels (out of `skill-key-overlay-consumer.ts`), Effect Timers, Alcohol Timer, Reminders, Progress | todo | 0 |
| 5.3 | B (proof of concept, feeds G3) | Whispers: session + window parts, typed `open` link, drop own session tracking, placement in settings | todo | 0 |
| 5.4 | B | Trade Chat (declares `network`), Travel (hub page + main + action), Build Library (window + files) | todo | 0 |
| 5.5 | C (shell only; behaviour stays in its stage) | Chat Filters, Quick Item Move, Resign, Call Target (out of `input.ts` if the input layer allows), Xunlai, Team Apply, Maps | todo | 0 |

**G3 (after 5.1 + 5.3):** if a feature needs a special case in the platform, fix the contract
(Phase 4) before continuing, not the feature.

## Phase 6 · Player experience (can start with test data after 4.1)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 6.1 | Update canvas to the final contract (plain game strip, reasons from `resolve`, grouping options) | Sign off the look | 0.3 | Canvas v12 published; every state shown maps to a `resolve` reason | todo | 0 |
| 6.2 | Features tab in the launcher: catalog Large/Compact, Feature page (README, What's new, What it uses, Needs, options from manifest), status strip | Look at it | 4.1, 4.3 | Launcher UI tests (vitest) for each state; screenshots per state in the PR match the canvas; keyboard and focus rules pass | todo | 0 |
| 6.3 | Move Settings › Tools and › Maps into the Features tab; delete the old sections | – | 6.2 | Old components deleted; Settings search still finds every option; Electron journey test green in CI | todo | 0 |
| 6.4 | Player test (3–5 players from Discord): find cooldown numbers, why is X off, play plain, change route colour; half see kind, half purpose | Find players, run sessions | 6.2 | ≥ 4/5 finish each task without help; grouping decided by first-correct-click time and recorded | todo | 0 |
| 6.5 | Hub shows the same status reasons for feature rows | – | 4.1 | Hub keyboard golden regenerated on purpose; dom tests for an unavailable row with reason | todo | 0 |
| 6.6 | Website feature docs come from each README (one source) | – | 4.3 | Every feature page on gwonmac.com rendered from its README; `website` CI green | todo | 0 |

## Phase 7 · Delivery and patch day (S–M)

| ID | Step | You | Depends | Done when | Status | Rounds |
|---|---|---|---|---|---|---|
| 7.1 | Effective feature status → `resolve` reasons → Features tab ("Needs a GWonMac update", "Checking…") | – | 4.1, 6.2 | Replaying a retained client generation produces the per-feature statuses the replay test expects (e.g. Nov 3: Quick Item Move needs an update) | todo | 0 |
| 7.2 | Release script stamps each feature's `## Unreleased` and builds release notes from them | – | 4.3 | Dry run on a branch produces correct notes; `news-v1.json` format unchanged | todo | 0 |
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
Phase 1 (alongside)        6.1 ─► 6.2 ─► 6.3, 6.4, 6.5 ─► 7
Phase 2 (small)
```

Parallel sessions that never touch the same files: Phase 1 · Phase 2 · 4.1 + 4.2 · 3.1 · 6.1.

## Open questions (yours to decide)

- Kind or purpose grouping? (6.4)
- Can `uses` replace `programs` in the verifier vocabulary, or do both stay? (research before 4.3; verifier is Must stay)
- Captures with ArenaNet art: repo or website only? (before 6.2)
