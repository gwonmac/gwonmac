import assert from "node:assert/strict";
import test from "node:test";
import {
  runtimeFeatureVerdicts,
  servedReasons,
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

test("attributes later-stage refusals to the stage that failed or to the fallback", () => {
  // Catches a stage crash or a Main-side Enhancement fallback reported as
  // "Guild Wars update", which tells players their build is unsupported.
  const updated: OptionalFeatureStatus = { status: "unavailable", reason: "game-update" };
  const compatibility: ClientCompatibility = {
    clientSha256: "a".repeat(64),
    features: {
      gameFileSaving: { status: "available" },
      nativeDoubleClick: updated,
      ...capabilityRecord((): OptionalFeatureStatus => ({ status: "off" })),
      travelAction: updated,
    },
  };
  const memory = {
    requestedAtLaunch: true,
    status: "unavailable",
    effectiveCapBytes: WASM_HEAP_CAP_BYTES,
    fallbackReason: "unsupported-client",
  } as const;
  const cases: [string, Parameters<typeof servedReasons>[2], boolean, string, string, string][] = [
    ["double-click crashed", ["nativeDoubleClick"], false, "check-failed", "game-update", "unsupported-client"],
    ["4 GB crashed", ["extendedMemory"], false, "game-update", "game-update", "check-failed"],
    ["Enhancement crashed", ["enhancement"], false, "check-failed", "check-failed", "check-failed"],
    ["friends crashed", ["friendObserver"], false, "check-failed", "check-failed", "check-failed"],
    ["Main fell back", [], true, "preparation-failed", "game-update", "preparation-failed"],
    ["clean verdict", [], false, "game-update", "game-update", "unsupported-client"],
  ];
  for (const [name, stages, fellBack, doubleClick, travel, fourGb] of cases) {
    const served = servedReasons(compatibility, memory, stages, fellBack);
    const reason = (status: OptionalFeatureStatus) =>
      status.status === "unavailable" ? status.reason : status.status;
    assert.equal(reason(served.compatibility.features.nativeDoubleClick), doubleClick, name);
    assert.equal(reason(served.compatibility.features.travelAction), travel, name);
    assert.equal(served.extendedMemory.fallbackReason, fourGb, name);
  }
});
