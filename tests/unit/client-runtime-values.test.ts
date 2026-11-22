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
import type {
  ClientCompatibility,
  OptionalFeatureStatus,
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
      cartography: { status: "available" },
      ...capabilityRecord((): OptionalFeatureStatus => ({ status: "off" })),
      travelAction: updated,
      nativeCursor: { status: "available" },
    },
  };
  const projected = withFailedCheck(compatibility);
  assert.deepEqual(projected.features.gameFileSaving,
    { status: "unavailable", reason: "check-failed" });
  assert.deepEqual(projected.features.travelAction,
    { status: "unavailable", reason: "check-failed" });
  assert.deepEqual(projected.features.nativeDoubleClick,
    { status: "unavailable", reason: "preparation-failed" });
  assert.deepEqual(projected.features.nativeCursor, { status: "available" });
  assert.deepEqual(projected.features.teamApply, { status: "off" });
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
      cartography: updated,
      ...capabilityRecord((): OptionalFeatureStatus => ({ status: "off" })),
      travelAction: updated,
    },
  };
  const cases: [string, Parameters<typeof servedReasons>[1], boolean, string, string, string][] = [
    ["double-click crashed", ["nativeDoubleClick"], false, "check-failed", "game-update", "game-update"],
    ["Cartography crashed", ["cartography"], false, "game-update", "game-update", "check-failed"],
    ["sound decode repair crashed", ["soundDecodeRepair"], false, "game-update", "game-update", "game-update"],
    ["Enhancement crashed", ["enhancement"], false, "check-failed", "check-failed", "check-failed"],
    ["friends crashed", ["friendObserver"], false, "check-failed", "check-failed", "check-failed"],
    ["Main served another candidate", [], true, "preparation-failed", "game-update", "preparation-failed"],
    ["clean verdict", [], false, "game-update", "game-update", "game-update"],
  ];
  for (const [name, stages, fellBack, doubleClick, travel, cartography] of cases) {
    const served = servedReasons(compatibility, stages, fellBack);
    const reason = (status: OptionalFeatureStatus) =>
      status.status === "unavailable" ? status.reason : status.status;
    assert.equal(reason(served.features.nativeDoubleClick), doubleClick, name);
    assert.equal(reason(served.features.travelAction), travel, name);
    assert.equal(reason(served.features.cartography), cartography, name);
  }
});
