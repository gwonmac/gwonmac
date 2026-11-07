import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enhancementCapabilitiesForProfile,
  enhancementCapabilityProfile,
  ENHANCEMENT_CAPABILITY_CONTRACTS,
  ENHANCEMENT_CAPABILITY_FIELDS,
  ENHANCEMENT_CAPABILITY_PRESETS,
  type EnhancementCapabilities,
  type EnhancementCapabilityProfile,
} from "../../src/shared/enhancement-contracts.js";
import {
  enhancementOutputSha256,
  enhancementProfilesForBuild,
  ENHANCEMENT_BUILDS,
  hasValidEnhancementProfileHashes,
  supportedEnhancementCapabilities,
  type KnownEnhancementBuild,
} from "../../src/main/certification/enhancement-builds.js";
import { TEMPLATE_SAVE_BUILDS } from "../../src/main/certification/template-save-compat.js";

const NO_CAPABILITIES = Object.freeze({
  nativeCursor: false,
  playRegionObservation: false,
    preGameControls: false,
    characterSwitchAction: false,
    quickItemMove: false,
  targetObservation: false,
  partyObservation: false,
  teamApply: false,
  travelAction: false,
  xunlaiAction: false,
  chatAliases: false,
  chatFiltering: false,
  skillSlotGeometry: false,
  skillCooldownObservation: false,
  playerEffectObservation: false,
    effectIconGeometry: false,
    alcoholObservation: false,
    nativeHudRendering: false,
    resignAction: false,
    whisperChat: false,
    chatPrint: false,
    progressObservation: false,
});
const FULL_MASK = (1 << ENHANCEMENT_CAPABILITY_FIELDS.length) - 1;
const bit = (field: string) => 1 << ENHANCEMENT_CAPABILITY_FIELDS.indexOf(
  field as (typeof ENHANCEMENT_CAPABILITY_FIELDS)[number],
);
const maskOf = (profile: string) => Number.parseInt(profile.slice("features-".length), 16);

/** Every mask that names a dependency chain: a capability with each way to satisfy it. */
function dependencyClosures(field: string): number[] {
  const contract = ENHANCEMENT_CAPABILITY_CONTRACTS.find(({ id }) => id === field)!;
  let closures = [bit(field)];
  for (const required of contract.requiresAll) {
    closures = closures.flatMap((mask) => dependencyClosures(required).map((dep) => mask | dep));
  }
  if (contract.requiresAny.length > 0) {
    closures = closures.flatMap((mask) => contract.requiresAny.flatMap((option) =>
      dependencyClosures(option).map((dep) => mask | dep)));
  }
  return closures;
}

/** mulberry32: a fixed seed keeps the sample identical on every run. */
function seededMasks(seed: number, count: number): number[] {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) & FULL_MASK) || 1;
  });
}

/**
 * The masks that matter, instead of all 2^N: each capability alone, each
 * capability with every way to satisfy its dependencies, the full set minus
 * one capability, the named presets, every profile a known build ships, and
 * a fixed-seed random sample for everything in between.
 */
const CHECKED_MASKS = [...new Set([
  FULL_MASK,
  ...ENHANCEMENT_CAPABILITY_FIELDS.map((field) => bit(field)),
  ...ENHANCEMENT_CAPABILITY_FIELDS.flatMap((field) => dependencyClosures(field)),
  ...ENHANCEMENT_CAPABILITY_FIELDS.map((field) => FULL_MASK ^ bit(field)),
  ...Object.values(ENHANCEMENT_CAPABILITY_PRESETS).map((preset) =>
    maskOf(enhancementCapabilityProfile(preset)!)),
  ...ENHANCEMENT_BUILDS.flatMap((build) => enhancementProfilesForBuild(build).map(maskOf)),
  ...seededMasks(0x9e3779b9, 20_000),
])].sort((a, b) => a - b);

describe("Enhancement client chain", () => {
  it("source-pins every executable capability profile", () => {
    // The registry rejects masks whose declared dependencies are absent.
    const profiles = CHECKED_MASKS.map((mask) => {
      const profile = `features-${mask.toString(16).padStart(mask < 0x100 ? 2 : 3, "0")}` as
        EnhancementCapabilityProfile;
      const capabilities = enhancementCapabilitiesForProfile(profile);
      return capabilities
        ? [[profile, capabilities] as const satisfies readonly [
            EnhancementCapabilityProfile,
            EnhancementCapabilities,
          ]]
        : [];
    }).flat();
    assert.equal(
      new Set(profiles.map(([, value]) => JSON.stringify(value))).size,
      profiles.length,
    );
    const teamProfiles = profiles.filter(([, capabilities]) => capabilities.teamApply);
    assert.ok(teamProfiles.length > 0);
    assert.ok(teamProfiles.every(([, capabilities]) => capabilities.partyObservation));
    for (const [profile, capabilities] of profiles) {
      assert.equal(enhancementCapabilityProfile(capabilities), profile);
      for (const build of ENHANCEMENT_BUILDS) {
        const output = enhancementOutputSha256(build, capabilities);
        assert.equal(
          output !== null,
          enhancementProfilesForBuild(build).includes(profile),
        );
        if (output !== null) assert.match(output, /^[0-9a-f]{64}$/);
      }
    }
    for (const unsupported of [
      NO_CAPABILITIES,
      // Commands without the Toolbox that would drive them are refused.
      {
        nativeCursor: false,
        playRegionObservation: false,
    preGameControls: false,
    characterSwitchAction: false,
    quickItemMove: false,
        targetObservation: false,
        partyObservation: false,
        teamApply: true,
        travelAction: false,
        xunlaiAction: false,
        chatAliases: false,
        chatFiltering: false,
        skillSlotGeometry: false,
        skillCooldownObservation: false,
        playerEffectObservation: false,
    effectIconGeometry: false,
    alcoholObservation: false,
    nativeHudRendering: false,
    resignAction: false,
    whisperChat: false,
    chatPrint: false,
    progressObservation: false,
      },
    ]) {
      assert.equal(enhancementCapabilityProfile(unsupported), null);
    }
  });

  it("certifies the Enhancement transform against the template-save output", () => {
    // The Enhancement transform is layered on the template-save client so opting
    // into the game cursor never costs template save/load. If either manifest
    // is recertified without the other, this pairing is what breaks first.
    for (const build of ENHANCEMENT_BUILDS) {
      const source = TEMPLATE_SAVE_BUILDS.find(
        (candidate) => candidate.outputSha256 === build.sha256,
      );
      assert.ok(
        source,
        `Enhancement build ${build.buildId} does not consume any template-save output`,
      );
    }
  });

  it("requires all and only the hashes implied by optional capability facts", () => {
    const full = ENHANCEMENT_BUILDS[0]!;
    assert.equal(hasValidEnhancementProfileHashes(full), true);

    const cursorOnly: KnownEnhancementBuild = {
      ...full,
      outputSha256: Object.freeze({
        "features-01": "a".repeat(64),
      }),
    };
    delete cursorOnly.targetObservation;
    delete cursorOnly.partyObservation;
    delete cursorOnly.teamApply;
    delete cursorOnly.gameThread;
    delete cursorOnly.xunlaiAction;
    delete cursorOnly.travelAction;
    delete cursorOnly.chatAliases;
    delete cursorOnly.quickItemMove;
    assert.deepEqual(enhancementProfilesForBuild(cursorOnly), ["features-01"]);
    assert.equal(hasValidEnhancementProfileHashes(cursorOnly), true);

    const orphanSkillbar = { ...cursorOnly };
    delete orphanSkillbar.playRegionObservation;
    delete orphanSkillbar.observationBase;
    assert.equal(
      hasValidEnhancementProfileHashes(orphanSkillbar),
      false,
      "player-skillbar facts cannot carry unactionable memory authority",
    );

    const partyOnly: KnownEnhancementBuild = {
      ...full,
      outputSha256: Object.freeze({
        "features-204": "b".repeat(64),
      }),
    };
    delete partyOnly.cursorEvent;
    delete partyOnly.targetObservation;
    delete partyOnly.teamApply;
    delete partyOnly.gameThread;
    delete partyOnly.xunlaiAction;
    delete partyOnly.travelAction;
    delete partyOnly.chatAliases;
    delete partyOnly.quickItemMove;
    assert.deepEqual(enhancementProfilesForBuild(partyOnly), ["features-204"]);
    assert.equal(hasValidEnhancementProfileHashes(partyOnly), true);

    const missingObservationBase = { ...partyOnly };
    delete missingObservationBase.observationBase;
    assert.equal(
      hasValidEnhancementProfileHashes(missingObservationBase),
      false,
      "party facts require their shared observation base",
    );

    const missingPartyDispatcher = { ...partyOnly };
    delete missingPartyDispatcher.uiDispatcher;
    assert.equal(
      hasValidEnhancementProfileHashes(missingPartyDispatcher),
      false,
      "party facts require their shared UI dispatcher",
    );

    const storageWithoutTarget = { ...full };
    delete storageWithoutTarget.targetObservation;
    assert.equal(
      supportedEnhancementCapabilities(storageWithoutTarget).xunlaiAction,
      true,
      "storage and Travel do not require target observation",
    );

    const prooflessXunlai = {
      openExport: full.xunlaiAction!.openExport,
      configureExport: full.xunlaiAction!.configureExport,
      handler: full.xunlaiAction!.handler,
    };
    const storageWithoutAccessProof: KnownEnhancementBuild = {
      ...full,
      xunlaiAction: prooflessXunlai,
    };
    assert.equal(
      hasValidEnhancementProfileHashes(storageWithoutAccessProof),
      false,
      "a legacy bundled output cannot claim the missing Xunlai proof",
    );
    assert.equal(
      supportedEnhancementCapabilities(storageWithoutAccessProof).travelAction,
      true,
      "Travel authority remains independent from Xunlai access proof",
    );
    assert.equal(
      supportedEnhancementCapabilities(storageWithoutAccessProof).xunlaiAction,
      false,
    );
    const storageWithDuplicateReaders: KnownEnhancementBuild = {
      ...full,
      xunlaiAction: {
        ...full.xunlaiAction!,
        accessProof: {
          ...full.xunlaiAction!.accessProof!,
          readers: {
            ...full.xunlaiAction!.accessProof!.readers,
            "access-flags": {
              ...full.xunlaiAction!.accessProof!.readers["access-flags"],
              functionIndex:
                full.xunlaiAction!.accessProof!.readers["agent-id"].functionIndex,
            },
          },
        },
      },
    };
    assert.equal(
      hasValidEnhancementProfileHashes(storageWithDuplicateReaders),
      false,
      "storage requires three independent player-record readers",
    );

    assert.equal(
      hasValidEnhancementProfileHashes({
        ...cursorOnly,
        outputSha256: Object.freeze({}),
      }),
      false,
      "a supported profile cannot omit its output hash",
    );
    assert.equal(
      hasValidEnhancementProfileHashes({
        ...cursorOnly,
        outputSha256: Object.freeze({
          "features-01": "a".repeat(64),
          "features-202": "c".repeat(64),
        }),
      }),
      false,
      "an unsupported profile cannot retain an output hash",
    );
    assert.equal(
      hasValidEnhancementProfileHashes({
        ...cursorOnly,
        outputSha256: Object.freeze({ "features-01": "not-a-digest" }),
      }),
      false,
      "every implied profile hash must be a digest",
    );
    const commonOnly = { ...cursorOnly };
    delete commonOnly.cursorEvent;
    assert.equal(
      hasValidEnhancementProfileHashes({
        ...commonOnly,
        outputSha256: Object.freeze({}),
      }),
      false,
      "a certificate with no supported profile is not executable",
    );
  });
});
