/**
 * The review packet for a client whose one reviewed body changed: it names the
 * features that lost it and their invariant, its draft makes them prove, and a
 * draft that points at another body grants nothing.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveResignAction } from "../../app/client/certification/enhancement-resign-proof.js";
import { verifyLocalClientBytes } from "../../app/client/certification/local-client-verifier.js";
import { REVIEWED_GENERATIONS } from "../../app/client/certification/reviewed-facts.js";
import { functionBodySha256, wasmEvidence } from "../../app/client/certification/wasm-evidence.js";
import { concat, encodeCode, encodeSection, parseCode, sectionById, splitSections, WASM_HEADER } from "../../app/main/core/wasm-binary.js";
import { ENHANCEMENT_CAPABILITY_PRESETS } from "../../app/shared/enhancement-contracts.js";
import { draftGeneration, formatReviewPacket, reviewClient } from "../../app/tools-cli/fact-review.js";

const ID = "2099-01-01-000000000000";

test("a changed native chat sender yields a packet whose draft proves it and only it", { timeout: 300_000 }, async () => {
  assert.ok(process.env.GW_CLIENT_WASM, "GW_CLIENT_WASM must name the real official artifact");
  const previous = new Uint8Array(await readFile(process.env.GW_CLIENT_WASM));
  const module = wasmEvidence(previous)?.moduleView();
  assert.ok(module);
  const sender = deriveResignAction(module);
  assert.ok(sender);

  // ArenaNet changes one constant in the sender: a real change, not a relink.
  const sections = splitSections(previous);
  const bodies = parseCode(sectionById(sections, 10));
  const local = sender.functionIndex - module.functionImportCount;
  const body = Uint8Array.from(bodies[local]!);
  const constant = body.findIndex((value, index) => value === 0x41 && body[index + 1] === 0xe4 && body[index + 2] === 0);
  assert.ok(constant >= 0);
  body[constant + 1] = 0xe5;
  bodies[local] = body;
  const candidate = concat(WASM_HEADER, ...sections.map((section) =>
    encodeSection(section.id === 10 ? { id: 10, body: encodeCode(bodies) } : section)));

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
