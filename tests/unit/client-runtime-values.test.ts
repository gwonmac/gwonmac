import assert from "node:assert/strict";
import test from "node:test";
import {
  runtimeFeatureVerdicts,
  withFailedCheck,
} from "../../app/client/client-runtime-values.js";
import type { LocalFeatureVerdicts } from
  "../../app/client/certification/local-client-verification-contract.js";
import {
  capabilityRecord,
  ENHANCEMENT_CAPABILITY_FIELDS,
} from "../../app/shared/enhancement-contracts.js";
import {
  WASM_HEAP_CAP_BYTES,
  type ClientCompatibility,
  type OptionalFeatureStatus,
} from "../../app/shared/contracts.js";

test("runtime verdicts retain only closed per-feature debugging facts", () => {
  const verdicts = Object.fromEntries(ENHANCEMENT_CAPABILITY_FIELDS.map(
    (feature) => [feature, { status: "not-requested" }],
  )) as unknown as LocalFeatureVerdicts;
  const input = {
    ...verdicts,
    nativeCursor: { status: "proved" },
    targetObservation: {
      status: "changed",
      invariant: "target.observation-selection-anchors",
    },
    partyObservation: {
      status: "ambiguous",
      invariant: "party.observation-anchors",
      candidates: 2,
    },
  } as unknown as LocalFeatureVerdicts;

  const retained = runtimeFeatureVerdicts(input);
  assert.equal(retained?.nativeCursor.status, "proved");
  assert.deepEqual(retained?.targetObservation, {
    status: "changed",
    invariant: "target.observation-selection-anchors",
    candidates: null,
  });
  assert.deepEqual(retained?.partyObservation, {
    status: "ambiguous",
    invariant: "party.observation-anchors",
    candidates: 2,
  });
  assert.deepEqual(retained?.travelAction, {
    status: "off",
    invariant: null,
    candidates: null,
  });
});

test("reports a failed check as its own reason, never as a game update", () => {
  // Catches the original defect: a verifier timeout told players their Guild
  // Wars update was unsupported.
  const updated: OptionalFeatureStatus = { status: "unavailable", reason: "game-update" };
  const compatibility: ClientCompatibility = {
    clientSha256: "a".repeat(64),
    features: {
      gameFileSaving: updated,
      nativeDoubleClick: { status: "unavailable", reason: "preparation-failed" },
      ...capabilityRecord((): OptionalFeatureStatus => ({ status: "off" })),
      travelAction: updated,
      nativeCursor: { status: "available" },
    },
  };
  const projected = withFailedCheck(compatibility, {
    requestedAtLaunch: true,
    status: "unavailable",
    effectiveCapBytes: WASM_HEAP_CAP_BYTES,
    fallbackReason: "unsupported-client",
  });
  assert.deepEqual(projected.compatibility.features.gameFileSaving,
    { status: "unavailable", reason: "check-failed" });
  assert.deepEqual(projected.compatibility.features.travelAction,
    { status: "unavailable", reason: "check-failed" });
  assert.deepEqual(projected.compatibility.features.nativeDoubleClick,
    { status: "unavailable", reason: "preparation-failed" });
  assert.deepEqual(projected.compatibility.features.nativeCursor, { status: "available" });
  assert.deepEqual(projected.compatibility.features.teamApply, { status: "off" });
  assert.equal(projected.extendedMemory.fallbackReason, "check-failed");
});
