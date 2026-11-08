/** Proves fixed native Resign authority and its refusal on a changed sender. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyLocalClientBytes, isLocalClientVerification } from "../../app/client/certification/local-client-verifier.js";
import { NO_ENHANCEMENT_CAPABILITIES } from "../../app/shared/enhancement-contracts.js";
import { supportedEnhancementCapabilities, type KnownEnhancementBuild } from "../../app/client/certification/enhancement-builds.js";
import { deriveResignAction } from "../../app/client/certification/enhancement-resign-proof.js";
import { transformEnhancementWasm } from "../../app/client/certification/enhancement-transform.js";
import { rewriteTemplateSaveWasm } from "../../app/client/certification/template-save-compat.js";
import { enhancementProofContext } from "../../app/client/certification/wasm-evidence.js";

test("the real client proves Resign and refuses a changed native sender", { timeout: 60_000 }, async () => {
  const filename = process.env.GW_CLIENT_WASM;
  assert.ok(filename, "GW_CLIENT_WASM must name the real official artifact");
  const bytes = new Uint8Array(await readFile(filename));
  const result = verifyLocalClientBytes(bytes);
  assert.equal(result.featureVerdicts?.resignAction.status, "proved");
  assert.equal(isLocalClientVerification(result, result.officialSha256), true);
  const requested = { ...NO_ENHANCEMENT_CAPABILITIES, playRegionObservation: true, resignAction: true };
  const isolated = verifyLocalClientBytes(bytes, requested);
  assert.equal(isolated.featureVerdicts?.resignAction.status, "proved");
  assert.equal(isLocalClientVerification(isolated, isolated.officialSha256, requested), true);
  assert.ok(result.enhancementBuild?.resignAction);
  assert.ok(result.templateSaveBuild);
  const context = enhancementProofContext(bytes);
  assert.ok(context);
  const original = context.moduleView();
  const proof = deriveResignAction(original);
  assert.ok(proof);

  // The boundary message has no client bytes and checks only the shape; the
  // transform derives the path from the bytes and refuses a substituted target
  // even when it has the sender's signature.
  const senderType = original.functionTypeIndices[proof.functionIndex];
  const substitute = original.functionTypeIndices.findIndex((type, index) =>
    index >= original.functionImportCount && index !== proof.functionIndex && type === senderType);
  assert.ok(substitute > 0);
  const template = rewriteTemplateSaveWasm(bytes, result.templateSaveBuild);
  const refusesSubstitutedTarget = (feature: "resignAction" | "whisperChat", message: RegExp) => {
    assert.ok(result.enhancementBuild);
    const sender = result.enhancementBuild[feature];
    const verdict = result.featureVerdicts?.[feature];
    assert.ok(sender && verdict?.status === "proved");
    const forged = { ...sender, functionIndex: substitute };
    const substituted: KnownEnhancementBuild = { ...result.enhancementBuild, [feature]: forged };
    const featureVerdicts = { ...result.featureVerdicts,
      [feature]: { ...verdict, value: { ...verdict.value, [feature]: forged } } };
    assert.equal(isLocalClientVerification({ ...result, enhancementBuild: substituted, featureVerdicts },
      result.officialSha256), true, `the boundary checks only the shape of ${feature}`);
    assert.throws(() => transformEnhancementWasm(template, substituted,
      supportedEnhancementCapabilities(substituted)), message, `the transform refuses a substituted ${feature} target`);
  };
  refusesSubstitutedTarget("resignAction", /Resign native chat path changed/u);
  refusesSubstitutedTarget("whisperChat", /Whisper native chat path changed/u);
  const bodies = original.bodies.map(body => Uint8Array.from(body));
  const sender = bodies[proof.functionIndex - original.functionImportCount]!;
  const opcode = sender.findIndex((value, index) => value === 0x41 && sender[index + 1] === 0xe4 && sender[index + 2] === 0);
  assert.ok(opcode >= 0);
  sender[opcode + 1] = 0xe5;
  assert.equal(deriveResignAction({ ...original, bodies }), null);
});
