/**
 * Strict process-boundary validation for ABI- and input-bound feature verdicts.
 * It rejects stale, malformed, and cross-input proof messages.
 *
 * Template saving and Enhancement are separate verdicts. A message whose
 * Enhancement part fails here keeps its independently valid template verdict;
 * the Enhancement build is withdrawn whole, because its pinned output hash
 * covers every feature it carries.
 */
import { isDeepStrictEqual } from "node:util";
import { isDigest } from "../../shared/digest.js";
import {
  enhancementCapabilityProfile,
  enhancementCapabilitiesForProfile,
  enhancementCapabilitiesCover,
  enhancementCapabilitiesRequested,
  ENHANCEMENT_CAPABILITY_FIELDS,
  ENHANCEMENT_CAPABILITY_PRESETS,
  intersectEnhancementCapabilities,
  type EnhancementCapabilities,
} from "../../shared/enhancement-contracts.js";
import {
  supportedEnhancementCapabilities,
  type KnownEnhancementBuild,
} from "./enhancement-builds.js";
import { acceptsEnhancementBuild } from "./enhancement-feature-acceptance.js";
import {
  LOCAL_FEATURE_INVARIANTS,
  LOCAL_VERIFICATION_REASONS,
  localFeatureVerdictsForBuild,
  type EnhancementVerificationReason,
  type LocalClientFeature,
  type LocalClientVerification,
  type LocalFileVerdict,
  type LocalFeatureFailure,
  type LocalFeatureFailures,
  type LocalFeatureInvariant,
  type LocalFeatureVerdicts,
  type LocalVerificationReason,
  type TemplateVerificationReason,
} from "./local-client-verification-contract.js";
import { SEMANTIC_VERIFIER_ABI } from "./semantic-proof.js";
import {
  BRIDGE_KINDS,
  TEMPLATE_SAVE_BUILDS,
  type BridgeKind,
  type KnownTemplateSaveBuild,
} from "./template-save-compat.js";

function isIndex(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function hasExactOwnKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function isTemplateReason(value: unknown): value is TemplateVerificationReason {
  return value === "invalid-wasm"
    || value === "template-shape-changed"
    || value === "template-transform-failed";
}

function isEnhancementReason(value: unknown): value is EnhancementVerificationReason {
  return value === "enhancement-layout-changed"
    || value === "enhancement-transform-failed";
}

function isLocalFileVerdict(
  value: unknown,
  officialSha256: string,
  templateSaveBuild: KnownTemplateSaveBuild | null,
): value is LocalFileVerdict {
  if (!value || typeof value !== "object") return false;
  const verdict = value as Partial<LocalFileVerdict>;
  if (
    verdict.inputSha256 !== officialSha256
    || verdict.verifierAbi !== SEMANTIC_VERIFIER_ABI
  ) return false;
  if (verdict.status === "proved") {
    return hasExactOwnKeys(value as Readonly<Record<string, unknown>>, [
      "status", "inputSha256", "outputSha256", "verifierAbi",
    ])
      && templateSaveBuild !== null
      && verdict.outputSha256 === templateSaveBuild.outputSha256;
  }
  return verdict.status === "refused"
    && hasExactOwnKeys(value as Readonly<Record<string, unknown>>, [
      "status", "inputSha256", "verifierAbi", "reason",
    ])
    && templateSaveBuild === null
    && (verdict.reason === "template-shape-changed"
      || verdict.reason === "template-transform-failed");
}

function isLocalFeatureInvariant<Feature extends LocalClientFeature>(
  feature: Feature,
  value: unknown,
): value is LocalFeatureInvariant<Feature> {
  return typeof value === "string"
    && (LOCAL_FEATURE_INVARIANTS[feature] as readonly string[]).includes(value);
}

function refusalForFeature<Feature extends LocalClientFeature>(
  feature: Feature,
  verdict: LocalFeatureVerdicts[Feature],
): LocalFeatureFailure<Feature> | null | undefined {
  if (verdict.status !== "changed" && verdict.status !== "ambiguous") {
    return undefined;
  }
  if (!isLocalFeatureInvariant(feature, verdict.invariant)) return null;
  if (verdict.status === "ambiguous") {
    return Number.isSafeInteger(verdict.candidates) && verdict.candidates >= 2
      ? Object.freeze({
          status: verdict.status,
          invariant: verdict.invariant,
          candidates: verdict.candidates,
        })
      : null;
  }
  return Object.freeze({ status: verdict.status, invariant: verdict.invariant });
}

function featureFailuresFromVerdicts(
  verdicts: LocalFeatureVerdicts,
): LocalFeatureFailures | null {
  if (!hasExactOwnKeys(
    verdicts as unknown as Readonly<Record<string, unknown>>,
    ENHANCEMENT_CAPABILITY_FIELDS,
  )) return null;
  const nativeCursor = refusalForFeature("nativeCursor", verdicts.nativeCursor);
  const playRegionObservation = refusalForFeature(
    "playRegionObservation",
    verdicts.playRegionObservation,
  );
  const targetObservation = refusalForFeature(
    "targetObservation",
    verdicts.targetObservation,
  );
  const partyObservation = refusalForFeature(
    "partyObservation",
    verdicts.partyObservation,
  );
  const teamApply = refusalForFeature("teamApply", verdicts.teamApply);
  const travelAction = refusalForFeature("travelAction", verdicts.travelAction);
  const xunlaiAction = refusalForFeature("xunlaiAction", verdicts.xunlaiAction);
  const alcoholObservation = refusalForFeature("alcoholObservation", verdicts.alcoholObservation);
  const whisperChat = refusalForFeature("whisperChat", verdicts.whisperChat);
  const resignAction = refusalForFeature("resignAction", verdicts.resignAction);
  const chatPrint = refusalForFeature("chatPrint", verdicts.chatPrint);
  const progressObservation = refusalForFeature("progressObservation", verdicts.progressObservation);
  const chatAliases = refusalForFeature("chatAliases", verdicts.chatAliases);
  const chatFiltering = refusalForFeature(
    "chatFiltering",
    verdicts.chatFiltering,
  );
  const skillSlotGeometry = refusalForFeature(
    "skillSlotGeometry",
    verdicts.skillSlotGeometry,
  );
  const skillCooldownObservation = refusalForFeature(
    "skillCooldownObservation",
    verdicts.skillCooldownObservation,
  );
  const preGameControls = refusalForFeature(
    "preGameControls",
    verdicts.preGameControls,
  );
  const characterSwitchAction = refusalForFeature(
    "characterSwitchAction",
    verdicts.characterSwitchAction,
  );
  const quickItemMove = refusalForFeature(
    "quickItemMove",
    verdicts.quickItemMove,
  );
  const playerEffectObservation = refusalForFeature(
    "playerEffectObservation",
    verdicts.playerEffectObservation,
  );
  const nativeHudRendering = refusalForFeature("nativeHudRendering", verdicts.nativeHudRendering);
  const effectIconGeometry = refusalForFeature(
    "effectIconGeometry",
    verdicts.effectIconGeometry,
  );
  if (
    nativeCursor === null
    || playRegionObservation === null
    || targetObservation === null
    || partyObservation === null
    || teamApply === null
    || travelAction === null
    || xunlaiAction === null
    || chatAliases === null
    || chatFiltering === null
    || skillSlotGeometry === null
    || skillCooldownObservation === null
    || preGameControls === null
    || characterSwitchAction === null
    || quickItemMove === null
    || playerEffectObservation === null
    || effectIconGeometry === null
    || alcoholObservation === null
    || nativeHudRendering === null
    || whisperChat === null
    || resignAction === null
    || chatPrint === null
    || progressObservation === null
  ) return null;
  return Object.freeze({
    ...(nativeCursor ? { nativeCursor } : {}),
    ...(playRegionObservation ? { playRegionObservation } : {}),
    ...(targetObservation ? { targetObservation } : {}),
    ...(partyObservation ? { partyObservation } : {}),
    ...(teamApply ? { teamApply } : {}),
    ...(travelAction ? { travelAction } : {}),
    ...(xunlaiAction ? { xunlaiAction } : {}),
    ...(chatAliases ? { chatAliases } : {}),
    ...(chatFiltering ? { chatFiltering } : {}),
    ...(skillSlotGeometry ? { skillSlotGeometry } : {}),
    ...(skillCooldownObservation ? { skillCooldownObservation } : {}),
    ...(preGameControls ? { preGameControls } : {}),
    ...(characterSwitchAction ? { characterSwitchAction } : {}),
    ...(quickItemMove ? { quickItemMove } : {}),
    ...(playerEffectObservation ? { playerEffectObservation } : {}),
    ...(effectIconGeometry ? { effectIconGeometry } : {}),
    ...(nativeHudRendering ? { nativeHudRendering } : {}),
    ...(whisperChat ? { whisperChat } : {}),
    ...(alcoholObservation ? { alcoholObservation } : {}),
    ...(resignAction ? { resignAction } : {}),
    ...(chatPrint ? { chatPrint } : {}),
    ...(progressObservation ? { progressObservation } : {}),
  });
}

function isTemplateSaveBuild(
  value: unknown,
  officialSha256: string,
): value is KnownTemplateSaveBuild {
  if (!value || typeof value !== "object") return false;
  const build = value as Partial<KnownTemplateSaveBuild>;
  if (
    build.sha256 !== officialSha256
    || !isDigest(build.outputSha256)
    || !isIndex(build.importCount)
    || !isIndex(build.carrierImport)
    || !Array.isArray(build.bridges)
    || build.bridges.length
      !== TEMPLATE_SAVE_BUILDS[TEMPLATE_SAVE_BUILDS.length - 1]?.bridges.length
  ) {
    return false;
  }
  const kinds = new Set<BridgeKind>();
  for (const bridge of build.bridges) {
    if (
      !bridge
      || !BRIDGE_KINDS.includes(bridge.kind)
      || kinds.has(bridge.kind)
      || !isIndex(bridge.stubFunction)
      || !Array.isArray(bridge.callSites)
      || bridge.callSites.length === 0
      || !bridge.callSites.every(
        (site: unknown) => {
          if (!site || typeof site !== "object") return false;
          const callSite = site as {
            localFunction?: unknown;
            bodyOffset?: unknown;
          };
          return isIndex(callSite.localFunction) && isIndex(callSite.bodyOffset);
        },
      )
      || (
        bridge.stubBody !== undefined
        && (
          !Array.isArray(bridge.stubBody)
          || !bridge.stubBody.every(
            (byte: unknown) =>
              typeof byte === "number"
              && Number.isInteger(byte)
              && byte >= 0
              && byte <= 0xff,
          )
        )
      )
    ) {
      return false;
    }
    kinds.add(bridge.kind);
  }
  return kinds.size === BRIDGE_KINDS.length;
}

function isAutomaticSemanticBuild(
  value: unknown,
  inputSha256: string,
  requestedCapabilities: EnhancementCapabilities,
): value is KnownEnhancementBuild {
  if (!value || typeof value !== "object") return false;
  const build = value as Partial<KnownEnhancementBuild>;
  if (
    build.sha256 !== inputSha256
    || !build.outputSha256
    || !isIndex(build.programId)
    || !isIndex(build.buildId)
    || !isIndex(build.hookFunction)
    || !isIndex(build.tableSlot)
    || !isDigest(build.hookBodySha256)
  ) return false;
  // Fact dependencies the transform relies on; each fact's own evidence is the
  // shared acceptance rule's job.
  if (build.whisperChat !== undefined && (build.gameThread === undefined
    || build.uiDispatcher === undefined || build.chatFiltering === undefined)) return false;
  if (build.resignAction !== undefined && (
    !build.playRegionObservation || !build.gameThread
  )) return false;
  if (build.chatPrint !== undefined && (build.gameThread === undefined
    || build.chatFiltering === undefined)) return false;
  if (build.progressObservation !== undefined && (
    !build.playRegionObservation || !build.observationBase
  )) return false;
  const hasCursor = build.cursorEvent !== undefined;
  const hasPlayRegion = build.playRegionObservation !== undefined;
  const hasObservation = build.observationBase !== undefined;
  const hasTarget = build.targetObservation !== undefined;
  const hasTravel = build.travelAction !== undefined;
  const hasXunlai = build.xunlaiAction !== undefined;
  const hasAliases = build.chatAliases !== undefined;
  const hasChatFiltering = build.chatFiltering !== undefined;
  const hasParty = build.partyObservation !== undefined;
  const hasTeam = build.teamApply !== undefined;
  const hasSkillSlotGeometry = build.skillSlotGeometry !== undefined;
  const hasPlayerSkillbar = build.playerSkillbarObservation !== undefined;
  const hasSkillCooldown = build.skillCooldownObservation !== undefined;
  const hasPreGameControls = build.preGameControls !== undefined;
  const hasPlayerEffects = build.playerEffectObservation !== undefined;
  const hasEffectIcons = build.effectIconGeometry !== undefined;
  if (!hasCursor && !hasPlayRegion && !hasObservation && !hasTarget
    && !hasTravel && !hasXunlai && !hasAliases && !hasChatFiltering
    && !hasParty && !hasTeam && !hasSkillSlotGeometry
    && !hasPlayerSkillbar && !hasSkillCooldown && !hasPreGameControls
    && !hasPlayerEffects && !hasEffectIcons) {
    return false;
  }
  if (
    Object.keys(build.outputSha256).length === 0
    || !Object.values(build.outputSha256).every(isDigest)
    || (hasTarget && !hasObservation)
    || (hasTravel && !hasObservation)
    || (hasXunlai && !hasObservation)
    || (hasPlayerSkillbar && !hasObservation)
    || (hasParty && (!hasObservation || !hasPlayerSkillbar
      || build.uiDispatcher === undefined))
    || (hasSkillCooldown && (!hasObservation || !hasPlayerSkillbar))
    || (hasPlayerEffects && (!hasObservation || !hasPlayRegion
      || build.uiDispatcher === undefined))
    || (hasEffectIcons && (!hasPlayRegion || !hasPlayerEffects))
    || (hasTeam && (!hasParty || build.gameThread === undefined))
    || ((hasTravel || hasXunlai) && build.gameThread === undefined)
    || ((hasTravel || hasXunlai || hasAliases) && build.uiDispatcher === undefined)
    || (hasChatFiltering
      && (!hasObservation || build.uiDispatcher === undefined))
  ) return false;
  const supported = supportedEnhancementCapabilities(build as KnownEnhancementBuild);
  const effective = intersectEnhancementCapabilities(
    requestedCapabilities,
    supported,
  );
  const expectedProfile = enhancementCapabilityProfile(effective);
  if (
    expectedProfile === null
    || Object.keys(build.outputSha256).length !== 1
    || !Object.hasOwn(build.outputSha256, expectedProfile)
  ) return false;
  if (!Object.keys(build.outputSha256).every((profile) => {
    const capabilities = enhancementCapabilitiesForProfile(profile);
    return capabilities !== null
      && enhancementCapabilitiesCover(supported, capabilities);
  })) return false;
  return acceptsEnhancementBuild(build as KnownEnhancementBuild, requestedCapabilities);
}

/** Boundary check for utility-process messages. */
export function isLocalClientVerification(
  value: unknown,
  officialSha256: string,
  requestedCapabilities: EnhancementCapabilities = ENHANCEMENT_CAPABILITY_PRESETS.all,
): value is LocalClientVerification {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<LocalClientVerification>;
  if (
    !hasExactOwnKeys(value as Readonly<Record<string, unknown>>, [
      "status",
      "officialSha256",
      "verifierAbi",
      "fileVerdict",
      "templateSaveBuild",
      "enhancementBuild",
      "featureVerdicts",
      "reasons",
    ])
    || result.officialSha256 !== officialSha256
    || !isDigest(result.officialSha256)
    || result.verifierAbi !== SEMANTIC_VERIFIER_ABI
    || !Array.isArray(result.reasons)
    || !result.reasons.every((reason): reason is LocalVerificationReason =>
      typeof reason === "string"
      && (LOCAL_VERIFICATION_REASONS as readonly string[]).includes(reason)
    )
  ) {
    return false;
  }
  if (result.templateSaveBuild === null) {
    const featureVerdicts = result.featureVerdicts;
    if (featureVerdicts === null || featureVerdicts === undefined) {
      return result.status === "template-refused"
        && result.fileVerdict === null
        && result.enhancementBuild === null
        && result.reasons.length === 1
        && result.reasons[0] === "invalid-wasm";
    }
    if (!isLocalFileVerdict(result.fileVerdict, officialSha256, null)) {
      return false;
    }
    const enhancementBuild = result.enhancementBuild;
    if (
      enhancementBuild !== null
      && !isAutomaticSemanticBuild(
        enhancementBuild,
        officialSha256,
        requestedCapabilities,
      )
    ) return false;
    const featureFailures = featureFailuresFromVerdicts(featureVerdicts);
    if (
      featureFailures === null
      || !isDeepStrictEqual(
        featureVerdicts,
        localFeatureVerdictsForBuild(
          officialSha256,
          requestedCapabilities,
          enhancementBuild,
          featureFailures,
        ),
      )
    ) return false;
    if (!enhancementCapabilitiesRequested(requestedCapabilities)) {
      return result.status === "template-refused"
        && enhancementBuild === null
        && result.reasons.length === 1
        && isTemplateReason(result.reasons[0]);
    }
    return enhancementBuild === null
      ? result.status === "enhancement-refused"
        && result.reasons.length === 1
        && isEnhancementReason(result.reasons[0])
      : result.status === "proved" && result.reasons.length === 0;
  }
  if (!isTemplateSaveBuild(result.templateSaveBuild, officialSha256)) {
    return false;
  }
  if (!isLocalFileVerdict(
    result.fileVerdict,
    officialSha256,
    result.templateSaveBuild,
  )) return false;
  const inputSha256 = result.templateSaveBuild.outputSha256;
  const enhancementBuild = result.enhancementBuild;
  if (
    enhancementBuild !== null
    && !isAutomaticSemanticBuild(
      enhancementBuild,
      inputSha256,
      requestedCapabilities,
    )
  ) {
    return false;
  }
  const featureFailures = result.featureVerdicts
    ? featureFailuresFromVerdicts(result.featureVerdicts)
    : null;
  if (
    !result.featureVerdicts
    || featureFailures === null
    || !isDeepStrictEqual(
      result.featureVerdicts,
      localFeatureVerdictsForBuild(
        inputSha256,
        requestedCapabilities,
        enhancementBuild,
        featureFailures,
      ),
    )
  ) {
    return false;
  }
  if (!enhancementCapabilitiesRequested(requestedCapabilities)) {
    return result.status === "template-proved"
      && enhancementBuild === null
      && result.reasons.length === 0;
  }
  if (enhancementBuild === null) {
    return result.status === "enhancement-refused"
      && result.reasons.length === 1
      && isEnhancementReason(result.reasons[0]);
  }
  return result.status === "proved" && result.reasons.length === 0;
}

/**
 * Accepts a utility-process message, or its template verdict alone when only
 * its Enhancement part is refused. Returns null when neither survives.
 */
export function acceptLocalClientVerification(
  value: unknown,
  officialSha256: string,
  requestedCapabilities: EnhancementCapabilities = ENHANCEMENT_CAPABILITY_PRESETS.all,
): LocalClientVerification | null {
  if (isLocalClientVerification(value, officialSha256, requestedCapabilities)) {
    return value;
  }
  if (
    !value
    || typeof value !== "object"
    || !enhancementCapabilitiesRequested(requestedCapabilities)
  ) return null;
  const { fileVerdict, templateSaveBuild = null } = value as Partial<LocalClientVerification>;
  if (!fileVerdict) return null;
  const refused = Object.freeze({
    status: "changed",
    invariant: "enhancement.process-boundary",
  } as const);
  const withdrawn: LocalClientVerification = {
    status: "enhancement-refused",
    officialSha256,
    verifierAbi: SEMANTIC_VERIFIER_ABI,
    fileVerdict,
    templateSaveBuild,
    enhancementBuild: null,
    featureVerdicts: localFeatureVerdictsForBuild(
      templateSaveBuild?.outputSha256 ?? officialSha256,
      requestedCapabilities,
      null,
      Object.freeze(Object.fromEntries(ENHANCEMENT_CAPABILITY_FIELDS
        .filter((feature) => requestedCapabilities[feature])
        .map((feature) => [feature, refused]))),
    ),
    reasons: ["enhancement-layout-changed"],
  };
  // Every kept field is validated again, now independently of Enhancement.
  return isLocalClientVerification(withdrawn, officialSha256, requestedCapabilities)
    ? withdrawn
    : null;
}
