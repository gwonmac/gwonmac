# ArenaNet client compatibility

This document defines how `gwonmac` proves that its client-side repairs and
Tools remain safe after ArenaNet rebuilds the official WebAssembly client.

This document owns proof authority, feature refusal boundaries, retained
evidence, and the patch-day playbook. Code and tests own exact signatures,
message identifiers, offsets, hashes, ABI numbers, and time limits.

Read [WASM host and client certification](wasm-host.md) for the wider hosting
architecture and [Core and Tools development](enhancement-development.md) for
feature-development rules.

## Product guarantee

An ArenaNet rebuild can change file hashes, function indices, table positions,
and static addresses without changing game behavior. `gwonmac` must recover
from those routine changes locally and keep every independently proved feature
available. This must not require a source change, pull request, or application
release.

No verifier can safely promise compatibility with an arbitrary future semantic
change. When a protected behavior genuinely changes, only the feature whose
proof fails must refuse. The untouched official client remains playable. If the
4 GB transform cannot be proved, the normal 2 GB mode remains playable.

Synthetic touch input is not a fallback for native double-click. Exact historic
hashes are regression fixtures, not launch authority.

## One runtime authority

The isolated local semantic verifier is the only component that can grant a
client capability. It runs in the existing bounded utility process and receives
the exact official bytes selected for one immutable client generation.

These inputs can provide evidence but cannot grant authority:

- compiled exact-build tables;
- CI results and workflow summaries;
- generated reports, attestations, caches, or diagnostics (the stored verifier
  pass below is the verifier's own answer, replayed under the rule there);
- GitHub issues and pull requests;
- a successful result from an older client generation.

The verifier binds every verdict to the official input SHA-256 and verifier ABI.
Main validates that boundary before it accepts a result. Whenever Main builds
or rebuilds a derived module, it runs that transform again, checks every
transform invariant, validates the resulting WASM, and requires the locally
computed output hash. A cached derived module is used only when its bytes hash
to the output hash the accepted verdict names; it is not transformed again.

Main stores this install's last complete verifier pass so a proved build is
not proved again at every launch. Stored state grants nothing by itself. The
exact rule: a stored pass is used only when its HMAC-SHA256 verifies with this
install's Keychain key, and its key equals the current official WASM SHA-256,
official JS SHA-256, verifier ABI, pass ABI, every stage ABI and app version.
It then passes the same acceptance boundary and per-stage guards as a fresh
answer. A stored pass that fails any of this is not used, and the build is
proved again. A timeout, crash, malformed answer, or a stage that failed to
check (it threw something other than a refusal) is never stored.

The runtime chain is:

```text
official JS/WASM generation
  -> isolated template semantic proof and transform
  -> isolated per-feature semantic proofs
  -> typed manifest containing only proved capabilities
  -> isolated Cartography layout and transform proof
  -> Main repeats transforms and checks output hashes
  -> renderer validates the instantiated manifest
```

Derived modules and reports are rebuildable caches. Corruption or an ABI change
discards them without changing player settings, saved files, accounts, Builds,
or Teams.

## Per-feature verdicts

Each requested feature returns one of these results:

- `proved`: one unique candidate satisfies every required invariant;
- `changed`: no candidate satisfies the required semantics;
- `ambiguous`: more than one candidate satisfies the locator, so selection is
  unsafe.

A refusal includes the feature-local invariant and, for ambiguity, the candidate
count. A top-level successful verification means that at least one safe module
can be built. It does not mean every requested feature proved.

Only a proof's own answer about the bytes is a refusal: a `ProofRefusal`
(every proof's `fail()`, `EvidenceError`, `ProofLimitError`) or the WASM
codec's `WasmFormatError`. A verdict is stored per build, so anything else a
proof throws (a `TypeError` from a defect, a `RangeError` from a failed
allocation) is not a refusal: it propagates, the check reports
`check-failed`, and the next start checks again. Every catch under
`app/client/certification/` decides through `refusedOrRethrow`; the policy
test `certification-catches-only-refusals` names the exceptions.

Capability manifests compare every field in both directions. A requested
capability that is missing from an otherwise valid exact regression record must
still trigger local proof.

## Evidence rules

Relocation is accepted only when the new value is independently derived:

- A function index can move when one unique signature, call relation, or table
  role identifies it.
- An immutable-data pointer can move when the uniquely referenced content is
  unchanged.
- A mutable or static address needs a complete feature-local occurrence ledger
  with one consistent derived value.
- A structure offset must be extracted from an independently identified reader
  or writer. It is never ignored or copied from a baseline.

Proof normalization must preserve control flow, branches, signatures, call
order, cardinality, table relationships, message semantics, packet opcodes,
payload order, pointer expressions, structure offsets, and unexplained
constants. A common relocation delta is not evidence by itself.

Every memory-layout word in a certificate needs a typed witness. Adding an
unwitnessed field must fail TypeScript compilation or boundary validation.

## Feature boundaries

| Feature | Required proof | Refusal behavior |
| --- | --- | --- |
| Template saving | Unique bridge stubs, all 11 call sites, signatures, argument modes, control flow, and independently derived static storage | Serve the untouched official module; do not claim persistent template repair |
| Native double-click | Named browser mousedown registration of the unique callback, complete producer/consumer queue-storage ledgers, the exact translator dispatch role, mouse-message table binding, click consumer, and flag-lift route, followed by the exact frame insertion and output | Keep ordinary client input; report it unavailable; never synthesize touch events |
| Guild Wars cursor | Unique loop/callback/table/neighbour graph, both producers, and independently derived globals, buffer, and layout | Use the normal macOS pointer |
| Target Distance | Complete observation base, target-field ledger, precedence, and bounded finite snapshot behavior | Disable Target Distance only |
| Party capture | Complete roster, ownership, profession, unlock, flag, skill, attribute, dirty-message, and transition lifecycle | Disable party observation and dependent Team Apply |
| Travel | Exact four-field producer, unique current-region resolver with complete call/content witnesses, Travel message role, dispatcher, reviewed-map allowlist, bounded mailbox/drain, and transition confirmation | Disable Travel; aliases may retain only independently available Xunlai commands |
| Friend locations | Complete friend-table layout, login request/completion correlation, queue acceptance and processing, all invalidation paths, bounded pointer-free snapshot, and fresh sequence feed | Disable friend results only; ordinary destination Travel remains available |
| Xunlai | Three readers, player/area layouts, fixed DataWindow action, handler, bounded drain, and fresh tri-state lifecycle | Disable Xunlai; aliases may retain only independently available Travel commands |
| Chat aliases | Exact parser relation, bounded comparisons, handled result, original-parser preservation, and at least one proved local action | Rewrite only aliases for proved actions; otherwise preserve the original parser |
| Chat Filters | Exact write-to-log producer and UI dispatcher relation, packet offsets, encoded templates, bounded UTF-16 scan, and certified local player-number layout | Disable Chat Filters only and pass every message to the original game handler |
| Chat print (Reminders) | The Chat Filters producer plus its `chat.valid-message` validator by exact body, a bounded printable-ASCII mailbox, and a drain that validates before it prints | Disable Reminders only |
| Team Apply | Seven named builders, exact opcodes/payloads, sender, bounded drain, fresh complete Party proof, and runtime confirmations | Disable Team Apply only; Builds and Teams remain editable |
| Cartography | Exact frame, game-context, area-table, agent-array, pathing-function, call-site, and surface-dispatch relationships, followed by an independently reproduced output hash | Disable Cartography observers only; the official client and independently proved Tools remain available |
| 4 GB mode | Manifest-bound JS/WASM pair, normalized Emscripten glue, every audited pointer-conversion site, one memory shape, and memory-only rewrite | Retain safe 2 GB mode |

Chat aliases never own a dispatcher or mailbox. The transform specializes the
parser to the effective Travel and Xunlai capabilities. It must not read or
write an official client global when an action is absent.

Chat Filters runs as a small pre-handler inside the transformed game module.
The renderer can set only a three-bit category mask. Chat text, pointers, and
patterns never cross into Electron. Invalid or unknown data always continues
to the original handler, and disposing Tools clears the mask.

Team Apply depends on complete fresh Party proof. Travel and Xunlai do not
depend on Party. Host-owned authoring, accounts, settings, updater behavior, and
other non-memory features remain available regardless of client verdicts.

Raw function-body digests bind a derived transform to the candidate bytes; they
are not compared with a historic digest at the process boundary. The isolated
verifier must first prove the signature, normalized role, call relationships,
and field witnesses. The boundary then checks the derived digest shape and the
typed evidence, while production rechecks that exact digest against the
candidate function before rewriting it. This distinction permits routine
function-index and static-data relocation without weakening input binding.

## Current implementation limits

The rules above are the required design, not a promise that every existing
locator already meets the final relocation-resistant bar. At verifier ABI 10:

- Template-saving proof binds relocated helper calls to their decoded sites,
  signatures, and reviewed complete callee bodies. Other instruction spans and
  static-role baselines remain exact;
- parts of Core and Tools certification still use raw body digests or common
  relocation checks while selecting a candidate; and
- native double-click verifies the complete known route, but exact body binding
  can still refuse after a harmless call-index change; and
- Cartography no longer uses a whole-client hash, but its pathing and surface
  roles still contain exact function-index and body bindings. Unrelated client
  changes recover locally; a reindex or equivalent body rewrite can still
  require a stronger semantic locator; and
- Quick Item Move accepts its reviewed item and trade fields on the exact
  post-template input, or on a module whose memory-code digest equals that of
  the input's reviewed generation. The digest covers the relocation identity
  of every function that reads or writes memory, so equal digests mean the
  structure offsets did not move. Its native move-message identifier belongs
  to that certificate, not to a shared constant; and
- friend observation accepts relocated functions and static addresses when all
  semantic relationships still reproduce, but its exact role shapes can refuse
  after an equivalent compiler rewrite; and
- a reviewed body digest or role fingerprint matches a relocated body only
  through a generation's identity table. The relocation identity names each
  callee by its body up to the callee's own call targets, and each padded
  static operand by its class (text, data, other). A role identity names each
  callee by its signature only and erases the role's own spans: the role proof
  checks its own relations, so a changed callee refuses only the features
  that own it. Generations
  from October 22, 2026 on carry tables; older facts match exactly; and
- player-effect observation, effect-icon geometry, and alcohol observation
  accept a reviewed effect body exactly, or on a relink a body with a reviewed
  body's relocation identity: the same opcodes, constants, branches and call
  order, with only callees and static addresses renumbered. A changed opcode
  or constant refuses. Several reviewed families may match a relink only when
  they locate the same functions. The boundary checks the proof against the
  reviewed digests; the transform rechecks each body it hooks by the same
  identity and refuses others. An effect body that really changed needs a
  `playerEffectBodies` entry in its generation file; and
- every per-client fact lives in that client's generation file
  (`reviewed-client-<id>.ts`): its records, its identity table, and its
  `facts` (alternatives to reviewed literals and the per-proof slots). Proof
  files hold only the August and October 1 references. Some facts stay pinned
  to one client's layout, so a relink that moves them refuses until a release
  adds them:
  - resign and whisper chat paths are located by their reviewed bodies (exact,
    or by relocation identity on a relink), and the editor must call the
    history owner, which must call the sender. The process boundary checks
    the sender's shape; the transform derives the path again from the bytes it
    rewrites and refuses any other sender. A cached module skips that
    transform, so it is served only when its bytes hash to the output the
    verifier derived from the same bytes. A path whose body really changed
    still needs a review;
  - native draw owners (HUD, map graphics, Compass terrain) match a reviewed
    family exactly. On a relink they are derived instead: each owner is the
    one function with a reviewed owner's relocation identity, an owner with
    identical clones is the callee its reviewed caller calls at the same
    position, and each address is read from the owners' corresponding static
    operands. The process boundary checks the HUD proof's shape; the transform
    derives it again from the bytes it rewrites and refuses any other value.
    An owner whose body really changed still needs a new family;
  - pathing families bind function indices. Nothing in production consumes
    that shape proof, so it does not decide any feature on patch day;
  - the Cartography layout is derived from the bytes: the roots come from the
    play-region, observation and pre-game proofs, each surface owner is the
    one function whose body a review accepted (exactly, or by relocation
    identity on a relink), and each callback slot comes from the active table.
    The derived client publishes its context root and agent array in its
    manifest, and the kernel installs them from there. The process boundary
    checks only the roots' shape; the transform derives them again and refuses
    others. A surface owner whose body really changed still needs a review;
  - a friend lifecycle family whose role bodies changed needs a review. The
    renderer pins `FRIEND_OBSERVER_SEMANTIC_SHA256`, which covers only what
    the certificate means (role names, signatures and the checked relations),
    so a new family changes the pin only when a role's meaning changes;
  - template saving normalizes every call to a reviewed helper (signature and
    complete body, or its relocation identity) to that helper, wherever it is
    called. A call to a helper that is not reviewed keeps its callee index, so
    a relink that moves it refuses until the helper is reviewed.

These checks fail closed. They can therefore disable a feature after an
equivalent ArenaNet rebuild even when game behavior did not change. A refusal
must remain local to that feature and its declared dependants, but restoring it
can still require a source change until the remaining locators are migrated to
independent semantic witnesses. Do not describe the current implementation as
automatically surviving every routine rebuild.

Compiled feature records can be partial. Compose independently derived values
per feature. An absent historic field must not erase a proved current feature.
Conflicting non-null values refuse that feature and its declared dependants.
The verifier and the process boundary share one acceptance rule: a feature is
accepted when every fact it needs matches one retained record, and different
features may match different records. The verifier withdraws a refused feature
with invariant `enhancement.retained-acceptance` before it pins the output hash.
Template saving is a separate verdict: when the boundary refuses the
Enhancement part of a message, it withdraws the whole Enhancement build (its
pinned output hash covers every feature it carries) with invariant
`enhancement.process-boundary` and keeps a valid template verdict.
Guild Hall has a separate proof inside Travel: a changed Guild Hall producer
withdraws Guild Hall while ordinary Travel stays available.

## Patch day

Automation detects a changed ArenaNet code generation and runs the same
non-authoritative evidence tools as a maintainer. It never uploads ArenaNet
binaries and cannot grant runtime authority.

- Equivalent rebuild: every feature whose locator survives relocation proves
  locally, and players use it at once without a source change, pull request,
  or release. Until the limits above are removed, the other features refuse
  like a semantic change.
- Offline replay: `tests/client-artifact/patch-day-replay.test.ts` verifies
  each retained client that a reviewed record names with only the generations
  older than it, as on its patch day. The replayed client loses every fact of
  its own generation file, pinned ones included. The test asserts that:
  - with every generation, each client proves all features its own record
    supports, with the record's outputs;
  - a relink of the previous generation (equal memory-code digest) needs no
    fact of its own: the same template verdict, every feature with the
    record's outputs, and native double-click, Cartography, and friend
    observation on its file-compatible module;
  - any other client gets the patch-day template verdict the test states for
    it. October 1 and October 22 refuse (`template-shape-changed`: each
    changed a reviewed helper body). November 3 proves every feature except
    Quick Item Move, whose memory-code digest changed; native double-click
    and Cartography prove, and friend observation refuses until its moved
    assertion lines are reviewed.

  It prints each client's refused features and module stages, and skips
  without the maintainer evidence store. Retained clients without a reviewed
  record, which includes every client before October 2026, are out of scope.
- Review: `pnpm certification review` writes a local review packet for a
  changed client (see [recertify.md](recertify.md#recover-a-relocation-rebuild))
  into its bundle in the evidence store. It covers template saving and every
  Enhancement feature, and drafts generation-file alternatives and
  player-effect bodies. The module stages (Cartography, native double-click,
  friend observation) are reviewed through the patch-day replay instead. An
  unapplied draft grants nothing. An applied alternative is a reviewed fact:
  the verifier accepts that body for that literal in every client, so review
  each pair. A fact-only release ships the approved facts, and the verifier
  still proves every feature from the bytes with them. There is no remote
  facts feed, and the packet's ArenaNet code never leaves the maintainer's
  Mac.
- Refusal: the official client stays playable and only the refusing feature
  and its declared dependants turn off. Automation opens one issue with one
  row per verdict: template saving, every Enhancement feature, native
  double-click, Cartography, 4 GB mode, and the real-client regression suite,
  each with its first failing invariant and, for ambiguity, the candidate
  count. A maintainer then follows [Recover certification](recertify.md).

`pnpm certification qualify WASM JS OUT` is the one release battery. It writes
one record per check: runtime verdicts, native double-click, Cartography, 4 GB
mode, and the shipped chain. The chain check prepares every release profile
through template, Enhancement, Friends, Cartography, double-click, and memory
selection, corrupts the cached output, and requires a rebuild to the same hash.
The release `qualify` job runs this battery on the current client. Client watch
runs the same battery and the real-client regression suite in
`tests/client-artifact/`. A certification pull request dispatches client watch
on its branch with `regression` (`pnpm release:facts` does it for a fact-only
release); that run fails when either refuses. A `hotfix/*` release gets no
draft until that run passed on its exact commit.

A verifier change needs positive equivalent-relocation tests and adversarial
change, duplicate, ambiguity, timeout, malformed-boundary, and output-mismatch
tests.

## Lessons that shaped these rules

- Whole-body hashes fail safe but cannot survive routine relocation.
  Relocatable operands need explicit relationships.
- A shared movement of mutable addresses is not ownership proof.
- A locator that collapses zero and multiple candidates hides the difference
  between `changed` and `ambiguous`. Candidate counts belong in reports.
- A capability can be proved yet ineffective because a dependency refused.
  Status, manifest, parser generation, and runtime exports must use the same
  effective capability set.
- Disable exact shortcuts on exact-known clients too; otherwise regression
  fixtures hide a missing structural witness.
- Preparation and production are separate trust boundaries. Production repeats
  the transform and validates the exact output.

Publishing a release stays a human decision. Automation cannot decide whether
the game looks and behaves correctly.
