# Core and Tools development

This document gives the change procedure for certified Core features and
optional Tools.

This document owns the feature-development procedure. The local semantic
verifier owns runtime proof. Exact build records are regression expectations.
Tests own exact acceptance thresholds.

Read [WASM host and client certification](wasm-host.md) before you change the
architecture.

## Current product boundary

Core is required and has no player switch: file compatibility, the Guild Wars
cursor, native double-click, Scry (Command-R), Character Switch (Command-E), and
pre-game reload. Optional Tools are off by default. The first enable selects a
Tools-capable module and needs a restart; after that, every tool has its own
live switch. `app/shared/settings-catalogue.ts` lists the shipped tools, and the
[website feature pages](https://www.gwonmac.com/docs) describe them for players.

Rules every feature keeps:

- Display-only features (Skill Key Labels, Skill Cooldowns, Effect Timers,
  Target distance) never change or forward game input.
- A command (Travel, Xunlai, Team Apply, Resign, Quick Item Move, party invite)
  is a named action through a certified sender or drain. Resign confirms in an
  in-game dialog and never types into chat. Quick Item Move never changes a
  partner's trade offer.
- Chat Filters runs inside the game module; Electron receives no chat text.
- Live observers and commands stop when disabled, in PvP, or when map policy
  refuses them. Host-only authoring (Build Library) stays available without
  observation or command authority.
- Scry owns Command-K while it is open. A saved Command-R override wins. Do not
  serialize a new default shortcut key: older settings readers reject unknown
  keys.

## Launch boundary invariant

Core and Tools are launch modes, not two saved settings. `gwonmacTools` is the
requested next-launch mode; `RendererInit.enhancementSelection.tools` is the
single source of truth for the current process. Do not add another runtime flag.

A Core static import graph must not reach optional snapshot readers, overlays,
commands, aliases, Tools UI, tool stores, tool IPC, or Trade networking. Core
uses the Core preload, whose bridge contains no tool namespace or channel.
Required cursor and input behavior, play-region observation, automatic relog,
Settings metadata, disabled menu labels, validation, and fixed ABI sizes remain
Core. The optional renderer entry and `ToolsRuntime` are dynamic imports that
run only for a Tools-capable launch.

Within Tools mode, child switches are live policy. Every new tool must enter the
Tools IPC subset, the dynamic renderer entry, and `ToolsRuntime` ownership as
applicable. Disabling it must stop its listeners, observers, timers, requests,
sockets, commands, surfaces, and storage work. Disabling the master applies the
same shutdown to every child while preserving settings and saved data. Complete
module unloading happens on the next Core launch.

Quick Item Move wraps two exact item-slot callbacks, the native quantity-move
helper, and the UI dispatcher already certified for Tools. Its certificate binds
those bodies, item lookup, the storage-page reader, frame hierarchy, and clock
to the client build. The certificate also binds the native move-message
identifier used for quantity prompts and prompt cancellation. Do not reuse an
identifier from another client family. A changed or ambiguous anchor disables
only this capability. The trade and item structure offsets are reviewed facts
for the exact post-template client build, so an ArenaNet client update disables
Quick Item Move until those facts are recertified. Ordinary storage transfers
fill compatible stacks before using empty cells. Deposits stay in the visible
pane. Withdrawals search the backpack, belt pouch, and both bags for stacks
before selecting empty cells. Excess items remain at the source when no more
space is available. Material storage uses the same quantity and claim handling,
with fixed slots and the account's upgraded capacity. As in Toolbox, birthday
presents are refused by this shortcut.

Stack matching follows Toolbox's model-file, dye, and encoded-name checks and
requires stackable items. Name reads are bounded. Control-Shift-click opens one
native quantity prompt at the source, as in Toolbox. Its selected amount enters
the same stack-first transfer path at the deferred game-thread boundary. Another
native move cancels prompt ownership. Unrelated native moves pass through.

Trade edits require the exact initiated state, as in GWCA's Wasm TradeMgr.
Submitted, accepted, and unknown trade states consume inventory and cart
shortcuts without adding, removing, or depositing items. Partner offers never
move. Storage withdrawals remain available while an offer is locked.
The deferred command retains its action and target cart in its existing
mailbox. Execution rechecks the source, trade state, and cart. A changed route
or cart cancels the click instead of selecting another destination. Selecting
Change Offer permits new clicks; rejected clicks are never replayed.

The trade tests execute the generated slot wrapper, handler, and drain together.
They distinguish storage and trade frames, check refusal without native
fallthrough, and exercise offer/window changes between capture and execution.
The real-client artifact test validates certification separately. Before release,
confirm submitted-offer clicks and Change Offer recovery in a developer build,
with storage open and closed. Automated fixtures do not establish live gameplay.

The renderer sends two modifier bits and owns the scratch region defined by
[the shared contract](../app/shared/quick-item-move-contract.ts). Its 64 temporary
move claims record source locations, source remainders, expected destination
quantities, and the native start time.
Claims prevent repeated source moves and overfilled destinations before the
client observes the result. Observed destination quantities and claims are not
added together. Claims are reclaimed after both endpoints reflect the move, or
after Toolbox's three-second retry timeout. Key release does not acknowledge a
move. A full claim buffer refuses additional moves until claims are reclaimed.
Claims are temporary; canonical inventory state remains in the game.

The quantity-aware function is the current client's `GmItemHelpers.cpp` move
helper identified by `ItemCliValidate(sourceItemId)`, also used by GWCA. It takes
an item ID, quantity, destination bag index, and zero-based slot. Its exact body
is checked before the transform calls it. Synthetic WebAssembly tests prove
selection, overflow, identity, and pending-click behavior. The real-client test
proves certification and bytecode validation; live transfer behavior still
requires Matthias's in-game check. Material-slot bounds follow this client's
42-entry table, and capacity follows GWCA's account-unlock `0x83` rule. These
layout facts remain restricted to the exact reviewed client.

## Use the cheapest proof

Choose the boundary needed to verify the change; this is not a sequence every
task must complete:

```text
pure unit or transform test
  -> synthetic companion memory
  -> deterministic presentation fixture
  -> local Electron fixture
  -> one bounded live scenario
```

Presentation using supplied observations can be checked without a playable
client. The [offline Electron fixture](../tests/electron/fixtures.mts) and
[alcohol positioning tests](../tests/electron/alcohol-timer.spec.ts) show that
boundary. Use the playable fixture when client readiness itself matters, and a
live scenario when actual native behavior cannot be established offline.

For changing overlay layout, preview populated and empty states, the longest
valid label, and relevant small geometry. Passing text assertions does not prove
that labels fit or that appearing icons leave a saved position stable.

Start with the owning tests and build-free discovery as needed:

```bash
pnpm certification doctor
pnpm enhancements:live --list
```

Run `pnpm check` for the final change. Build before verifying changed
compiled behavior; run integration or live checks for the affected boundary.
See [Research a new client fact](#research-a-new-client-fact) for inspection and source lookup.

`certification doctor` reads the local profile and published client. It does not
start Electron. It does not contact ArenaNet. It cannot inspect provisioned
Keychain data.

## Live Tools feedback loop

Use an unpackaged development launch when a named action behaves differently
in the real client. Open the renderer console and keep only lines beginning
with `[tools:dev]`. These events are bounded scalar evidence; they do not log
character names, account data, chat, packet bytes, or Travel search text.

- Xunlai emits `storage.availability`, `storage.configured`, and then either
  `storage.queued` or `storage.refused`. A refusal includes the policy state and
  the tri-state access result that caused the Controls fallback. The certified
  player-record readers index their array by the live login/player number;
  record zero is not a valid shortcut for a real character. Each request also
  has a session-local sequence and elapsed time since the preceding request, so
  an accidental double-open is visible without logging an account identifier.
- Team Apply first emits `command` when the renderer queues an opcode. The
  `team command trace` then reports `drain.count` and `drain.opcode` when the
  certified game-thread boundary consumes it. Builder and sender counters show
  the next boundary reached. This separates queue, drain, builder, sender, and
  observer-confirmation failures.
  Ordinary live publications have been observed just beyond one second, so
  their confirmation window is two seconds. Profession and skill transitions
  retain their feature-specific stability and retry windows.
- Travel emits `travel.search` with query length, token count, catalogue size,
  result count, and bounded result map IDs. It never includes the query itself.
  `travel.queued` or `travel.refused` then identifies the named command result.
  Search covers the reviewed 199-destination direct-travel catalogue and omits
  destinations outside the current Pre-Searing or world context and positively
  locked results. A zero result can mean no match, only locked matches, or only
  destinations outside the current context. Passage-scroll locations
  such as Urgoz's Warren and The Deep intentionally use their original UI.
  The terms `guild`, `guild hall`, and `gh` add the separately certified
  Guild Hall action. Its trace and UI contain no Guild Hall key.

For a report, reproduce one operation at a time and copy the lines from its
first request through its final success, refusal, or timeout. Also record the
visible map/outpost and whether the character should have Xunlai access. Do not
paste the complete console or account/login screens.

### Reconnect UI discovery

Production reload uses the closed `preGameControls` capability. Its exact-build
proof pins five internal label addresses, Guild Wars' label-hash function, and
the live frame layout. The observer follows the same lookup boundary as
GWCA `GetFrameByLabel`. Certification derives the five hashes from the exact
client hash body. Runtime scans `frame_hash_id` in the bounded live frame table
without calling back into game code. The renderer can read only `unknown`,
`character-select`, `reconnect`, or `loading`; it cannot read frame pointers,
hashes, arbitrary labels, or invoke a generic UI action.
Character switching does not widen this reader. Its separate
`characterSwitchAction` capability depends on `preGameControls`, adds only the
fixed logout/Selector/Play state machine, and is absent from the reconnect
profile. A read-only pre-game observer therefore cannot enqueue a native
action.

The account character array does not follow the Selector carousel, and the
player can sort that carousel. The same capability adds the read-only
`enhancement_character_selector_slot` export. For one account index, it
repeats the certified Selector traversal, compares names inside the module, and
returns only the carousel slot or -1. It makes no call, store, or UI message.
The renderer samples it on the character-selection screen and keeps the order
in memory for that game window. It never persists character identities.
Characters not seen on the selector follow in account order.

Character Switch requires focus when a request or explorable confirmation is
accepted. That one window-local transaction then owns the native action channel
through Logout, Selector, and Play, including while the window is unfocused or
hidden. Completion, failure, timeout, and disposal disable the channel and clear
pending native work. Focus alone never enables it. The existing context, target
identity, selection proof, and deadline checks still apply. The game-thread
executor rechecks the Selector target immediately before Play. It refuses a
changed selection without another click. Automatic return
after reload retains its separate focus policy.

Run the unpackaged developer probe with:

```sh
GW_LIVE_SMOKE=1 pnpm enhancements:live -- --scenario reconnect-discovery --leave-open
```

The `reconnect-probe` program selects the same bounded pre-game controls,
play-region readers, and native cursor that required Core uses in production.
It exposes no raw UI messages, frame pointers, labels, or generic input surface.
A packaged build always refuses this developer program.

Run the outpost and explorable procedures under [Reload feedback
loop](diagnostics.md#reload-feedback-loop) separately. With automatic return
enabled, add no input: the scenario now requires a certified terminal
`outpost` or `restored` row. It gives an operator checkpoint, includes exact
client/build evidence in its structured result, and writes the copied redacted transcript to
`test-results/enhancements-live/reconnect-discovery.txt`. It takes no screenshot
on failure and requires `--allow-update` before client data may be updated.

For an input or Xunlai interaction failure, also open
**Help → Diagnostics → Show Input Trace**. Clear it, then open Xunlai once,
close the native storage window with Escape, click empty ground, hold both
mouse buttons briefly, and interact with one merchant. Pause and copy the
trace. The pause row names any physical canvas keys that remain held. A
normalized release reports `released` when it found the matching held key and
`missing` when it did not. Pointer rows name only `canvas`, `surface`, `text`,
`secret`, or `other`.
`canvas` proves the event reached Guild Wars; it does not prove the client
accepted the world action. This distinction separates a hidden GWonMac surface
from a stuck native game UI state without copying coordinates or UI text.
For a keyboard shortcut, every `modifier down` must have either a matching
`modifier up` or an `input released (command)` row before the named action.
Command-Shift-C deliberately resets held game input before it opens Xunlai,
because macOS can consume a physical modifier release while Command is held.

## Add or change a feature

Establish the requested behavior and its failure behavior, then extend the
existing domain owner. Reusing accepted observations or changing host-only UI
does not require new native facts, a snapshot region, or a live scenario.

For new native behavior, find candidate facts through static analysis or bounded
typed observation. Use the extension contract below for production integration.
Exercise valid and relevant loading, absent, corrupt, torn, and non-finite input
cases. Verify real value changes in a bounded live scenario where fixtures cannot
establish semantics; retain any remaining gap in the domain's evidence file.

An investigation can first run a small, reversible control that resolves the
deciding uncertainty. Keep memory bounds, artifact identity and session ownership
intact, but do not require complete production integration before testing
feasibility. Distinguish what the experiment demonstrated from the remaining
shipping requirements. Record a useful rejected hypothesis or next unresolved
question when it will prevent repeated work; no fixed report template is needed.

Do not add a renderer pointer chain, parallel JavaScript probe, general memory
write, arbitrary game call, raw packet export, or renderer-side copy of the
configuration order.

## Research a new client fact

Extend the closest owner first; do not create another reader for an accepted
fact.

| Need | Start here |
| --- | --- |
| Format or position an effect observation, or a persistent overlay | [Effect timers](effect-timers.md), `tests/unit/companion-effect-snapshot.test.ts`, `tests/electron/alcohol-timer.spec.ts` |
| Extend map presentation | [Cartography](cartography.md), `tests/unit/compass-range-indicators.test.ts` |
| Read a new native collection | `tests/client-artifact/friend-table-evidence.test.ts` |
| Change a named command | Search `tests/` for `quick-item-move`, `travel`, or `character-switch` |

Inspect without building or starting the game:

```sh
pnpm certification doctor
pnpm certification inspect /path/to/Gw.jspi.wasm
pnpm enhancements:live --list
pnpm enhancements:live --describe effect-observer
```

`inspect` inventories imports, exports, memory, and tables without running game
code. It reports a hash with unverified provenance and no runtime authority.
It is not a semantic function map: for string, assertion, and message-builder
candidates, use the [WASM tools](../tools/README.md). Decode LEB128 constants;
do not assume a canonical byte encoding.

Reference sources sit next to this checkout when present: `../GWToolboxpp`
(C++ features, newer GWCA declarations, a WASM experiment) and `../GWCA`
(historical native implementation). Use their algorithms, assertions, and call
relationships as leads. Re-derive every WASM layout and signature: native
addresses, function indices, and offsets are not cross-build identity, and
generated `func_N` names are search aids, not proof. Record the source revision
with a finding.

Record an expensive finding where the next person looks: the domain document
when behavior becomes current, otherwise the pull request or issue. Keep
generated analysis and private traces out of tracked source. A decompilation or
matching assertion is candidate evidence; neither proves live behavior.

## Internal feature extension contract

Tools has a compile-time extension contract. It is plugin-shaped for
contributors, but it is not a runtime plugin API. Features compose from small
owners in this repository. GWonMac does not load third-party code, expose game
memory, or let a feature register an arbitrary callback or command.

Use only the layers the feature needs:

| Concern | One owner | Reusable contract |
| --- | --- | --- |
| Saved player choice | [`AppSettings` and `DEFAULT_SETTINGS`](../app/shared/contracts.ts), plus [`parseSettings` and `parseSettingsPatch`](../app/main/core/settings.ts) | Add one shape, durable default, and strict full/patch parser only when the feature needs player configuration. |
| Product activation and coarse region rule | [`FEATURE_SELECTION_POLICIES`](../app/shared/feature-contracts.ts) | Add one stable `FeatureId`. The runtime policy must project that exact ID. |
| Certified client support | [`enhancement-contracts.ts`](../app/shared/enhancement-contracts.ts) and `app/client/certification/` | Add an independently provable capability. Keep defaults, validators and verifier consumers aligned; the [typed verifier fixture](../tests/electron/fixtures/local-verifier-app/main.mjs) uses canonical defaults instead of a second complete capability list. A product setting cannot grant native authority. |
| Fixed native publication | [`createCompanionRegionInstallation`](../app/renderer/companion-region-installation.ts) | Own allocation, activation withdrawal, freshness, and disposal for one bounded region. |
| Live settings and map policy | [`createCompanionPolicySource`](../app/renderer/companion-policy-source.ts) | Consume one immutable snapshot. Do not subscribe to Settings or classify play regions again. |
| Domain behavior | A named renderer or command module | Own decoding, formatting, state transitions, and user-facing refusal in the feature domain. |
| Game-host code of a feature | `app/features/<id>/companion.ts` and one line in [`COMPANION_PARTS`](../app/features/companion-parts.ts) | A part says what it does in each installer phase ([contract](../app/renderer/tools-companion-part.ts)). Feeds that several features read stay in the [shared substrates](../app/renderer/tools-companion-substrates.ts); a part adds its demand to them. A part that allocates keeps its registry place, which is the heap layout. |
| Main-process channels and files of a feature | `app/features/<id>/main.ts` and one line in [`MAIN_PARTS`](../app/features/main-parts.ts) | The part owns its stores and channels ([contract](../app/main/tools-main-part.ts)); the runtime gives it a file gate. A Tools channel without an owner fails to compile. |
| Composition and safety order | [`installCertifiedCompanion`](../app/renderer/certified-companion-installation.ts) | Allocate and validate first, enable the game hook last, disable it first, and tear down in explicit dependency-safe phases. |

The feature registry and the live policy use the same IDs. Type checking and a
runtime contract test fail when one side changes without the other. Derived
shared substrates stay at their consumer boundary. For example, skill-slot
geometry is active when either `skillKeyLabels` or `skillCooldowns` is active;
it is not a second product feature or setting.

Region selection has three explicit strengths: `any`, `non-pvp`, and `pve`.
`non-pvp` keeps unknown or loading state eligible. A positively identified PvP
map, including a PvP outpost, withdraws the feature. Guild Halls are the one
explicit exception. Developer programs can replace saved selection, never the
registered region rule.

Choose the smallest path:

- A host-only feature needs Settings and a domain owner. It does not need a
  native capability, companion region, or live play-region gate.
- A display-only native feature adds a certified bounded observation and a
  pointer-transparent presentation owner. It never needs a command surface.
- A named command adds a separate certified action, fresh runtime preconditions,
  bounded arguments, explicit refusal, and observed confirmation.
- A feature that reuses an existing certified fact subscribes to that domain's
  accepted state. It does not add another memory reader or snapshot.

For a new bounded observation, keep this ownership sequence:

1. Define one fixed ABI and strict decoder in the domain.
2. Certify the exact current-client facts independently.
3. Collect only bounded fields in the companion kernel.
4. Allocate the region through a domain installation.
5. Add its descriptor to the complete overlap check before initialization.
6. Publish accepted state through one sequence/freshness feed.
7. Join data with geometry or Settings only at the presentation boundary.
8. Withdraw the complete feature on malformed, partial, stale, loading, or
   policy-denied state.

For lifecycle code, use these rules:

- Construction installs cleanup ownership before later side effects. On
  failure, it attempts every cleanup allowed by the current safety barriers,
  reports combined failures, and never frees memory still reachable by a live
  observer or callback.
- Initialization must happen only after the complete owned-region layout is
  valid.
- `subscribe` gives the current accepted state synchronously and returns an
  idempotent disposer.
- `dispose` first makes callbacks and subscriptions inert. A memory-owning
  installation exposes a separate `release` phase; the transaction root calls
  it only after the matching observer or callback barrier. Each phase attempts
  all cleanup it can safely reach and reports combined failures.
- Policy inputs detach before surfaces. Observers stop before observer-owned
  memory is freed. The game hook is disabled before callback-owned memory is
  freed.
- A capability absent from the certified profile allocates no domain memory and
  exposes no sink. A certified capability can keep an inactive session region
  while its player setting is off so it can activate without a restart.

Do not create a common interface only because two modules use verbs such as
`mount`, `update`, or `dispose`. Extract a shared primitive only when two real
features have the same invariant and the extraction deletes duplicated safety
logic. Keep domain-specific preconditions in the domain.

Before adding a new registry, adapter, bridge method, cache, event bus, or
state machine, state which acceptance criterion cannot be met by the contracts
above. If there is none, do not add it.

### Pull request boundary

Split a large feature at proof and ownership boundaries:

1. Product setting and static feature selection.
2. Exact-client certification and bounded observation, inspectable without UI.
3. Domain presentation or named command and its focused Settings UI.
4. Cleanup or shared extraction only when the completed feature proves the
   duplication is real.

Each layer must build and fail closed on its own. Do not mix unrelated native
proof, presentation polish, and architectural cleanup in one pull request.

## Snapshot and ABI rules

Keep snapshots small and domain-specific. Add a region only when the first real
feature needs it.

Each region needs these properties:

- fixed magic and ABI version;
- fixed byte size;
- sequence value for torn-read detection;
- bounded count and capacity;
- explicit invalid and overflow states;
- no game pointer in published output.

The official WASM remains canonical. Feature certificates and transformed
outputs are derived from those bytes and the verifier ABI and must be
rebuildable.

Do not build a speculative global game model. Use a tick snapshot for current
state. Add an event ring only when a proven user feature cannot be represented
by current state.

Keep build facts in `app/client/certification/`, capability order in `app/shared/`,
bounded reads in `kernels/companion/`, presentation in its renderer domain,
and Team Apply policy in `app/shared/builds/`. The installer owns installation,
not domain rules. Do not move rules into preload, IPC, or a generic bridge.

## Live scenarios

Live scenarios use the normal Guild Wars profile. They are opt-in because they
can contact ArenaNet and can use a real account.

Run one named scenario with:

```bash
GW_LIVE_SMOKE=1 pnpm enhancements:live -- --scenario <name>
```

The scenario registry in `scripts/enhancements-live/scenarios.ts` is the source
of valid names and their acceptance rules.

Use the narrowest scenario. Examples include boot, target readout, movement,
reload, map transition, cursor capture, Tools foundation, and the paired
performance run.

The default live run is cached-only. It cannot fetch a missing ArenaNet chunk
or update the official client. Add `--allow-update` only when you deliberately
want the run to update game data.

Use `--leave-open` only for human inspection. A failure or timeout already
leaves Electron open and writes bounded output under
`test-results/enhancements-live/`.

Use `pnpm graphics:live` for an operator-driven visual investigation. It uses
the observation tier with no developer Enhancement program. Press Enter to
save a screenshot and its bounded numeric state. The diagnostics document owns
the [privacy boundary and procedure](diagnostics.md#live-graphics-investigation).

The harness uses the normal profile and reads structured renderer state through
a random loopback endpoint. An observation scenario gets only a fixed typed
projection. An automation scenario can get trusted input and the bounded parent
channel in an unpackaged build.

Automation permission does not select a feature. A fixed developer program does.
Packaged builds refuse every developer program.

Do not change account or product controls to make a scenario pass. A two-factor,
legal, captcha, or unexpected login screen remains a human boundary.

Ordinary Enhancement live evidence must not contain game-memory addresses, raw
pixels, raw packets, account fields, or chat. Store the typed scalar result
only. The sole exception is the local, operator-consented graphics probe. Its
screenshot is stored separately under `test-results/` and follows the
[graphics investigation privacy rules](diagnostics.md#live-graphics-investigation).

## Performance changes

Use the mirrored Level 1 benchmark for a new hook, observer, snapshot, or render
path. It must prove zero off-arm hooks and expected on-arm cadence. The scenario
definition owns duration, samples, and limits.

Follow the measurement rules in [Diagnostics and performance](diagnostics.md).
Use a clean Level 1 capture for acceptance. Use Level 2 only to locate a cause.

## Cursor changes

The cursor path is shipped Core. Treat it as product code.

The official client already decodes the cursor. The host must convert BGRA to
RGBA, and an art pointer is not a stable identity. The implementation uses
bounded pixel content and a Retina cursor candidate.

Do not reintroduce an artwork bundle, remote cursor download, user size setting,
or parallel JavaScript decoder.

## Command changes

A command must be a named domain action with typed arguments. It must run at a
certified game-owned safe point.

Every command needs:

- positive map and lifecycle preconditions;
- explicit rate and sequence limits;
- cancellation when policy changes;
- confirmation against observed state;
- an explicit refusal or failure result;
- a live account scenario for the claimed semantic effect.

Never expose `writeMemory`, `callFunction`, `sendPacket`, a generic opcode, or a
general address courier.

The companion kernel stays read-only. Command construction stays in the named
domain outside the kernel.

## Recertify an ArenaNet client

Follow [Recover certification](recertify.md). Start from the exact official
artifact that triggered the refusal and do not clear downloaded game data: the
refused artifact and the retained preceding one are the best evidence. Routine
equivalent rebuilds must pass locally without a source change. When evidence
is incomplete, grant no capability; the official client must stay playable.

## Done criteria

A Core or Tools change is done when all applicable statements are true:

- every client-local fact has one typed semantic witness;
- invalid and loading state cannot publish stale data;
- disabled behavior stops its observer or command path;
- Core static import graphs and the Core preload contain no optional Tools implementation;
- no raw pointer, packet, secret, or memory view crosses IPC;
- cached startup performs no transform or network request;
- the required offline layers pass;
- one bounded live scenario proves the real semantic change;
- performance remains within the code-owned budget;
- shutdown has no trap, rejection, unknown socket, or orphan process;
- the unsupported-build path remains playable;
- a costly fact that a future contributor must not rediscover is written in
  the domain document.

Stop when these criteria pass. Do not add a framework for a future feature.
