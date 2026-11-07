# Recover certification after an ArenaNet client update

Maintainer runbook. Use it when the bounded certification tools refuse a new
ArenaNet client. Runtime rules live in [ArenaNet compatibility](arenanet-compatibility.md)
and the code under `app/client/certification/`. Exact values live in code and
tests.

## Safe result

An unknown client must remain playable as the untouched official module.
Template repair and Enhancement features can continue only when the isolated
verifier proves their complete feature-local semantics. A CI report, exact
hash row, shared address, or function-index delta is not proof.

Main publishes the effective status of each feature to both diagnostics and
player-facing code. Do not reconstruct a second whole-build state:

| Feature status | Meaning |
| --- | --- |
| `available` | The served module contains the proven feature. |
| `off` | The player did not select the optional feature. |
| `unavailable: game-update` | This exact Guild Wars build does not prove it. |
| `unavailable: preparation-failed` | Proof exists, but the feature did not start. |

Check this value first when a player reports a regression after an ArenaNet
update.

## Preserve the evidence before investigating

ArenaNet may replace the public pair again at any time. Before changing a
locator, copy the exact official JS/WASM pair and its available manifest/version
metadata to the maintainer evidence store outside the repository and CI
artifacts. On macOS, its working location is
`~/Library/Application Support/gwonmac-maintainer/client-evidence/`. Matthias
owns access and backup. Use bundle reference `YYYY-MM-DD-<generation-first-12>`.
Do not rely on a runner temporary directory as the only retained copy.

The private bundle must contain:

- the code-generation SHA-256 from `pnpm client:official`;
- JS and WASM SHA-256 values and byte lengths;
- manifest/version metadata as received, when available;
- verifier ABI, source commit, command lines, and complete unredacted verifier
  outputs;
- transform inputs and outputs needed to reproduce exact digest checks;
- the preceding retained pair used for comparison; and
- dated live-QA notes, macOS version, input device type, and the exact feature
  behavior observed.

Keep credentials, account identifiers, chat, character names, and unrelated
diagnostics out of the bundle. Encrypt and access-control the private store.
Never commit or publicly upload ArenaNet binaries, raw addresses, local paths,
or unredacted locator reports.

Keep every refused generation and every release-baseline generation until the
last client transform that can use its comparison evidence is removed. Back up
the store encrypted, and restore-check one bundle before each release. A local
working copy without a restore-checked backup does not satisfy the release
gate.

Put the opaque private bundle reference on the canonical open refusal issue.
The signed `generation.json` contains hashes, sizes, and closed outcomes. The
private bundle and the signed record are evidence; neither grants runtime
authority.

## Step 1: try to delete the workaround

Install the official candidate and test the affected official behavior. If
ArenaNet fixed the defect, delete the local transform instead of certifying it
again. The purpose of each transform is to disappear when the official client
no longer needs it.

## Step 2: use the bounded tools

First reproduce the current certified template entry:

```bash
pnpm certification template --expect-certified
```

Then inspect the new official module:

```bash
pnpm certification template "/absolute/path/Gw.jspi.wasm"
pnpm certification template "/absolute/path/Gw.jspi.wasm" --emit-ts
pnpm certification recertify "/absolute/path/Gw.jspi.wasm"
pnpm certification double-click "/absolute/path/Gw.jspi.wasm"
```

Read the template report status first:

| Status | Action |
| --- | --- |
| `certified` or matching `derived` | The runtime predicate accepted this input. No table change is needed. |
| `derived` | Review the evidence. Do not treat formatting or a generated row as proof. |
| `not-applicable` | Test whether ArenaNet fixed the defect. Prefer deletion. |
| `failed` | Use the manual procedure below. Do not weaken the locator to force a result. |

The template command uses the same production locator as the launcher. It
derives candidates from body shape, signatures, and caller intersections. The
runtime verifier also compares complete affected caller bodies while
normalizing only selected call-index operands, a complete feature-local static
occurrence ledger, and immutable pointers whose uniquely referenced content
matches. Matching offsets or a common address delta alone are not enough.

The Enhancement report is review evidence only. `candidate`, `ambiguous`, and
`unavailable` cannot create runtime authority. CI never writes its findings
into launch-authority tables.

## Manual template recovery

Use this procedure only after an automated refusal.

### 1. Record the artifact

Confirm that the private bundle above is complete. Record the build ID,
function import count, and WASM validity. Do not assume the old import count of
219.

### 2. Generate investigation symbols

```bash
python3 tools/gensyms.py "/absolute/path/Gw.jspi.wasm" build/
```

This produces a named investigation module plus function and string-reference
reports. Generated client artifacts stay untracked.

### 3. Locate the template routines by meaning

Do not search for old indices. Use these measured shapes and call contexts:

| Routine | Locator evidence |
| --- | --- |
| Create directory | Body is one `i32.const 2`; callers include account templates, screenshots, chat logs, and login. |
| Find files | Empty body; signature `(i32, i32, i32) -> ()`; called by both template scans. |
| Derive entry name | Body is one `i32.const 0`; six `i32` inputs and one `i32` result; called by both scans. |
| Delete file | Short `assert("not implemented")` body with a live file-delete caller. |
| `File::Open` | In the template writer, one `(i32, i32, i32) -> i32` callee is called first with mode 1 and later with mode 2. |

The mode value is the second-to-last argument. Decode instructions instead of
matching raw bytes. Only the mode-1 existence probe is repointed. Keep the
mode-2 writer and the template loader on the original function.

### 4. Record exact call sites

For each approved caller, record the local function index and the decoded byte
offset of the call. Confirm that the call instruction uses the expected padded
encoding. If the new toolchain changes the width, the in-place repoint is no
longer valid. Change the transform design; do not overwrite a different number
of bytes.

### 5. Measure the client contract

Append temporary export entries to an untracked copy of the official module.
Instantiate it with zero-returning stub functions and call only pure helpers.
Appending exports changes only the export section.

Re-measure at least these facts:

- whether `Path::GetDirectory` keeps the trailing separator;
- which separator `_wmakepath` inserts;
- whether `Path::RemoveExtension("\\Test.txt")` still drops the last name
  character;
- the file and directory enumeration patterns;
- the meaning of the enumeration flags; and
- the mode-1 `File::Open` behavior.

`memory` and `malloc` are exported by the examined official module. Use the
client allocator when a client caller will free the result. Run the same pure
probes on the derived module to confirm marker arguments and return polarity.

Do not call stateful UI or text functions in a cold instance. Use one bounded
live instrument for those functions.

### 6. Update and verify

Add a template table entry only after the evidence matches. Start with an empty
derived output hash, run the production transform, and pin the resulting hash.
Increase `TEMPLATE_SAVE_TRANSFORM_ABI` if the derived bytes or bridge contract
changed.

Certify transforms in this order:

1. official module;
2. template-save output;
3. optional Enhancement output; and
4. native double-click output.

Later stages certify the bytes produced by earlier stages. They are not
alternative transforms.

Run the fast check defined in [AGENTS.md](../AGENTS.md). Then use one live
check for the behavior that offline proof cannot establish.

## Offline bridge check

Instantiate the derived module with the real renderer bridge and an offline fake
filesystem. Drive the forwarders with the path shapes that the client really
produces, including:

```text
Templates/Skills/\Test.txt
```

A clean fixture such as `Templates/Skills/Test.txt` previously hid a delete and
rename failure.

## Minimum live template check

Use one account and complete this sequence in one run:

1. Save a skill template and confirm the complete name.
2. List and load it.
3. Rename it and confirm that no old or empty duplicate remains.
4. Delete it and confirm that the client does not abort.
5. Restart and confirm that the remaining templates persist.
6. Repeat the save, list, load, rename, and delete sequence for equipment.
7. Confirm screenshot creation because it uses the same directory and listing
   routines.

The official client does not recursively scan template subdirectories. Do not
use a nested template as a success criterion for the bridge.

## Do not repeat these mistakes

- Do not bypass a failing create-directory guard. The later null-handle path can
  abort.
- Do not use a cleaner path in a fixture than the client supplies.
- Do not ignore an argument because its meaning is unknown.
- Do not read a filtered trace as proof that no call occurred.
- Do not certify a static address without a live invariant.
- Do not weaken a locator until it returns one result.
- Do not make optional Tools a requirement for the official client.

- Do not treat broad operand normalization as proof. It is a research lead.
- Do not identify a generic getter by its raw body. Equal bodies can belong to
  unrelated cloned functions; use callers and field roles.
- Do not extrapolate an index or address shift across features. Derive each
  device, frame, message, and table value from its own owner.
- Do not remap a record by literal substitution. An unchanged field can share
  a value with a moved index.

## Recover a relocation rebuild

Most ArenaNet rebuilds are the same code with renumbered functions and moved
static data. The October 22 and November 3, 2026 clients refused almost every
feature for that reason; only a few changes were real.

1. Map each refused role or exact body hash from the preceding retained client
   to the new client. Compare bodies with call indices, static operands, and
   constants erased. Require one unique match, and confirm it by its relations,
   not by its hash alone: a one-call wrapper and its neighbour can collide when
   both shift by one index.
2. Diff each matched pair instruction by instruction. Accept call-index and
   static-address changes. Read every changed constant: string pointers must
   reach the same text, small integers must be explained (assertion lines,
   content counts). Read every control-flow change in full.
3. Add the reviewed result as a variant next to the existing one
   (`reviewedVariants` on a semantic role, a reviewed table digest, or a
   reviewed static-content digest). Keep the previous client proving.
4. Trace each remaining refusal to its first failing check before you read
   code. Shared checks, such as the area table, can disable many features.
5. Compare all members of one function family. A matching sender alone does not
   prove its editor, history, packet, lifecycle, or dispatcher.

Anchor only the bytes a feature owns. A screenshot anchor that also covered
neighbouring storage once refused template saving after an unrelated change.

A relocation can reach code that never moved before. Template saving then needs
a source change, not only a variant: `MOVED_CALLEES` in
`template-save-callee-proof.ts` binds each moved helper call to its reviewed
callee bodies.

## Per-client records to update

A new client can need all of these:

- the template-save record (`pnpm certification template --write`) and the
  Tools record in `enhancement-builds.ts`;
- the friend lifecycle family, which changes `FRIEND_OBSERVER_SEMANTIC_SHA256`;
- a Cartography memory layout with its Compass, Mission Map, and World Map
  certificates. The reachability kernel in
  `kernels/reachability/lib.rs` holds the context root and agent
  array per layout, so a new layout also changes the kernel. Run the compiled
  kernel for each accepted layout: checked arithmetic keeps it free of static
  panic formatting;
- the World Map display owner, Compass owner, pathing hashes, Guild Hall
  producer, area-type accessor, and the native render family;
- `tests/fixtures/retained-client.ts`, which maps retained function indices and
  static addresses for the real-client tests; and
- `tests/fixtures/native-friend-queue.ts`, which lists the friend queue roles
  (allocator, context, pending, request) and the moved native owners per
  client hash. The friend observer, queue, and records evidence tests in
  `tests/client-artifact/` refuse a client it does not list, so they turn red
  on every new client until its roles are reinspected and added.

Compose partial records per feature: a missing historical field must not make
current actions disappear. After accepting facts, verify the complete shipped
chain and the refusal cases. Enhancement verdicts alone do not prove Friends or
Maps. No offline result establishes live gameplay acceptance.

## Feature requirements during recovery

`recertify` must report per-feature ABI/input-hash-bound verdicts, and
`double-click` must prove one unique callback and the complete enqueue, pump,
translator, mouse-dispatch, click-consumer, and flag-lift route before it
checks the insertion and output. It derives one exact input/output transaction;
there is no capability-profile predecessor table.

Each recovered fact needs an independent semantic anchor. A common movement is
not enough. Automated candidates are review evidence and cannot create runtime
authority.

Do not make the IPC boundary compare a candidate-derived raw body digest with a
preceding generation. Call immediates and data operands legitimately change
when ArenaNet relinks an equivalent client. The locator proves their typed
relationships; the boundary accepts the resulting digest as an input-bound
fact; the production transform verifies that digest against the same candidate
bytes. Add a positive coherent-relocation fixture as well as refusal mutations.

Recertification requires semantic identities, signatures, caller relationships,
original-call preservation, complete address occurrence ledgers, table and
allocation invariants, positive and negative layout evidence, lifecycle
clearing, offline tests, clean teardown, and one bounded live semantic check per
changed domain.

For Xunlai storage, independently recover the player-record array, record
stride, agent identifier, player number, access flags, and area type. External
projects such as GWCA can explain semantics, but they are never runtime
authority. Prove reader and handler roles, signatures, field offsets, and the
game-thread drain from the current bytes. Do not copy them from a preceding
build.
The three player-record readers form one optional, all-or-nothing access proof.
If that proof cannot be certified, omit it: the generated configuration then
contains zero access words, Xunlai stays disabled, and the independently
certified Travel action remains available. Never substitute party state or a
guessed offset.

Run `pnpm enhancements:live xunlai-storage` from a supported PvE outpost. The
scenario records only the tri-state access result and two complete action
cycles from the same named action used by the button and shortcut. Each cycle
opens storage, closes it with Escape, and proves that bounded two-button
movement changes the certified player position. A queued command is not a
semantic success. Also enter `/chest`,
`/xunlai`, and one near miss such as `/storage`; the first two must be consumed
locally only after access is confirmed and the near miss must remain a normal
Guild Wars command. Check one eligible character and the known restricted
character, then switch accounts or characters without restarting and confirm
that access is revoked and restored. A one-gold deposit and withdrawal requires
explicit confirmation from the person operating the client.

STOP if closing storage does not immediately restore click-to-walk, two-button
movement, and merchant interaction. The DataWindow handler consumes two account
pane flags in addition to the character/outpost access proof. Do not infer
those flags from access, hard-code a different payload, or call the action safe
because the mailbox drained. A release claim needs independent proof of those
flags and the native storage open/close lifecycle, plus the recovery cycle
above on accounts with and without each pane.

Party certification must prove the complete owned roster, player and hero
professions, hero unlocks, behaviour, skill bars, and attributes. Proving only
the hero count or first hero is not enough for Apply team. Each optional party
detail table is an independent observation: a rejected detail table must erase
only its own facts and must never erase the verified roster or another valid
detail group.
