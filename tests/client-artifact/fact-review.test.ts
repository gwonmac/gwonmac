/**
 * The review packet for a client whose one reviewed body changed: it names the
 * features that lost it and their invariant, its draft makes them prove, and a
 * draft that points at another body grants nothing. A changed player-effect
 * body, which its proof compares by digest per generation, gets a
 * `playerEffectBodies` draft.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveResignAction } from "../../app/client/certification/enhancement-resign-proof.js";
import { verifyLocalClientBytes } from "../../app/client/certification/local-client-verifier.js";
import { REVIEWED_GENERATIONS } from "../../app/client/certification/reviewed-facts.js";
import { functionBodySha256, wasmEvidence } from "../../app/client/certification/wasm-evidence.js";
import { instructionStarts } from "../../app/client/certification/wasm-instruction-evidence.js";
import { concat, encodeCode, encodeSection, parseCode, sectionById, splitSections, WASM_HEADER } from "../../app/main/core/wasm-binary.js";
import { ENHANCEMENT_CAPABILITY_PRESETS } from "../../app/shared/enhancement-contracts.js";
import { draftGeneration, formatReviewPacket, reviewClient } from "../../app/tools-cli/fact-review.js";

const ID = "2099-01-01-000000000000";

/** `client` with the body of `functionIndex` replaced by `edit` of it. */
function withBody(client: Uint8Array, functionIndex: number, edit: (body: Uint8Array) => void): Uint8Array {
  const module = wasmEvidence(client)!.moduleView();
  const sections = splitSections(client);
  const bodies = parseCode(sectionById(sections, 10));
  const local = functionIndex - module.functionImportCount;
  const body = Uint8Array.from(bodies[local]!);
  edit(body);
  bodies[local] = body;
  return concat(WASM_HEADER, ...sections.map((section) =>
    encodeSection(section.id === 10 ? { id: 10, body: encodeCode(bodies) } : section)));
}

test("a changed native chat sender yields a packet whose draft proves it and only it", { timeout: 300_000 }, async () => {
  assert.ok(process.env.GW_CLIENT_WASM, "GW_CLIENT_WASM must name the real official artifact");
  const previous = new Uint8Array(await readFile(process.env.GW_CLIENT_WASM));
  const module = wasmEvidence(previous)?.moduleView();
  assert.ok(module);
  const sender = deriveResignAction(module);
  assert.ok(sender);

  // ArenaNet changes one constant in the sender: a real change, not a relink.
  const candidate = withBody(previous, sender.functionIndex, (body) => {
    const constant = body.findIndex((value, index) => value === 0x41 && body[index + 1] === 0xe4 && body[index + 2] === 0);
    assert.ok(constant >= 0);
    body[constant + 1] = 0xe5;
  });

  const packet = reviewClient({ candidate, previous, generations: REVIEWED_GENERATIONS, id: ID });
  const chat = packet.features.filter(({ feature }) => feature === "resignAction" || feature === "whisperChat");
  assert.deepEqual(chat.map(({ feature, invariant, provesWithDraft }) => ({ feature, invariant, provesWithDraft })), [
    { feature: "resignAction", invariant: "resign.native-chat-path", provesWithDraft: true },
    { feature: "whisperChat", invariant: "whisper.native-chat-path", provesWithDraft: true },
  ]);
  const drafted = chat[0]!.missing.filter(({ draft }) => draft !== null);
  assert.deepEqual(drafted.map(({ literal, previous: old, pairedBy, candidates, draft }) => ({
    literal, previous: old.functionIndex, pairedBy, candidates: candidates.map(({ functionIndex }) => functionIndex), draft,
  })), [{
    literal: sender.bodySha256,
    previous: sender.functionIndex,
    pairedBy: "callers",
    candidates: [sender.functionIndex],
    draft: functionBodySha256(wasmEvidence(candidate)!.moduleView(), sender.functionIndex),
  }]);
  assert.match(formatReviewPacket(packet, ID), /^! i32\.const e4 00 +│ i32\.const e5 00$/mu,
    "the side-by-side listing marks the changed constant");

  const withDraft = verifyLocalClientBytes(candidate, ENHANCEMENT_CAPABILITY_PRESETS.all,
    [...REVIEWED_GENERATIONS, draftGeneration(ID, packet.alternatives)]);
  assert.equal(withDraft.featureVerdicts?.resignAction.status, "proved");
  assert.equal(withDraft.featureVerdicts?.whisperChat.status, "proved");

  // A draft that names another body for the same literal still refuses: the
  // verifier proves the path's calls, not the draft.
  const unrelated = functionBodySha256(module, sender.functionIndex + 1);
  const wrong = verifyLocalClientBytes(candidate, ENHANCEMENT_CAPABILITY_PRESETS.all,
    [...REVIEWED_GENERATIONS, draftGeneration(ID, { [sender.bodySha256]: [unrelated] })]);
  assert.equal(wrong.featureVerdicts?.resignAction.status, "changed");
  assert.equal(wrong.featureVerdicts?.whisperChat.status, "changed");
});

test("a changed player-effect body yields a playerEffectBodies draft that proves", { timeout: 300_000 }, async () => {
  assert.ok(process.env.GW_CLIENT_WASM, "GW_CLIENT_WASM must name the real official artifact");
  const previous = new Uint8Array(await readFile(process.env.GW_CLIENT_WASM));
  const module = wasmEvidence(previous)!.moduleView();
  const family = REVIEWED_GENERATIONS.at(-1)?.playerEffectBodies;
  assert.ok(family, "the newest generation names its player-effect bodies");
  // The August reference digest of the add-timed mutation.
  const reference = "fe97a736b61e83cc5ea5a84f38aecedd384476339c5b02594fcefeebc5ce5203";
  const addTimed = Array.from({ length: module.bodies.length }, (_, local) => module.functionImportCount + local)
    .find((functionIndex) => functionBodySha256(module, functionIndex) === family[reference]);
  assert.ok(addTimed !== undefined);

  // One small constant changes; the body keeps its length.
  const candidate = withBody(previous, addTimed, (body) => {
    const constant = instructionStarts(body).find((start) => body[start] === 0x41 && body[start + 1]! > 0 && body[start + 1]! < 0x3e);
    assert.ok(constant !== undefined);
    body[constant + 1] = body[constant + 1]! + 1;
  });
  const changedDigest = functionBodySha256(wasmEvidence(candidate)!.moduleView(), addTimed);

  const packet = reviewClient({ candidate, previous, generations: REVIEWED_GENERATIONS, id: ID });
  const effects = packet.features.find(({ feature }) => feature === "playerEffectObservation");
  assert.ok(effects);
  assert.equal(effects.provesWithDraft, true);
  assert.deepEqual(effects.missing.map(({ kind, reference: key, literal, draft }) => ({ kind, key, literal, draft })), [
    { kind: "effect", key: reference, literal: family[reference], draft: changedDigest },
  ]);
  assert.deepEqual(packet.playerEffectBodies, { ...family, [reference]: changedDigest });
  assert.match(formatReviewPacket(packet, ID), new RegExp(`playerEffectBodies\\["${reference}"\\]`, "u"));
});
