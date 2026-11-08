/**
 * Owns what a player reads when a Tools capability is missing from this
 * session, chosen by the reason Main reports for it. One table per capability,
 * so a failed build check never reads as a Guild Wars update and a failed
 * start never reads as either.
 *
 * The copy is a value, not only a thrown message: the panel has to say it
 * *before* the click. A button that looks ready and then refuses has already
 * cost the player the decision to press it, and it reads as a bug in the panel
 * rather than as a capability this session does not have.
 */
import {
  BUILD_CHECK_FAILED,
  type ClientCompatibility,
  type OptionalFeatureStatus,
  type UnavailableReason,
} from "./contracts.js";

type ReasonCopy = Readonly<Record<UnavailableReason, string | null>>;

const APPLY: ReasonCopy = {
  "game-update": "Apply team is unavailable after this Guild Wars update. Your saved team is unchanged.",
  "preparation-failed": "Apply team didn’t start. Your saved team is unchanged. Restart GWonMac to try again.",
  "check-failed": `${BUILD_CHECK_FAILED} Your saved team is unchanged.`,
};
const APPLY_OFF = "Apply team is off. Your saved team is unchanged.";

const OBSERVATION: ReasonCopy = {
  "game-update": "Live game information is temporarily unavailable. Saved builds and teams still work.",
  "preparation-failed":
    "Live game information didn’t start. Saved builds and teams still work. Restart GWonMac to try again.",
  "check-failed": `${BUILD_CHECK_FAILED} Saved builds and teams still work.`,
};

const STORAGE: ReasonCopy = {
  "game-update": "Storage is unavailable after this Guild Wars update.",
  "preparation-failed": "Storage didn’t start. Restart GWonMac to try again.",
  "check-failed": `Storage is unavailable. ${BUILD_CHECK_FAILED}`,
};

// Null keeps the Tools bundle's own copy for an update.
const PUBLISH: ReasonCopy = {
  "game-update": null,
  "preparation-failed":
    "Adding builds to Guild Wars didn’t start. Restart GWonMac to try again. The build is still saved in your library.",
  "check-failed": `GWonMac can’t add builds to Guild Wars. ${BUILD_CHECK_FAILED} The build is still saved in your library.`,
};

function byReason(status: OptionalFeatureStatus | undefined, copy: ReasonCopy): string | null {
  return status?.status === "unavailable" ? copy[status.reason] : null;
}

/** The statuses this copy reads, from the session's compatibility. */
export type ToolsCopyFeatures = Pick<
  ClientCompatibility["features"],
  "teamApply" | "partyObservation" | "xunlaiAction" | "gameFileSaving"
>;

export type ToolsUnavailableCopy = Readonly<{
  apply: string | null;
  observation: string | null;
  storage: string | null;
  publish: string | null;
}>;

/**
 * The copy for each capability this session lacks; null where it has it or
 * the bundle's own copy applies. `present` says which commands the renderer
 * actually holds: only a missing one needs words.
 */
export function toolsUnavailableCopy(
  features: ToolsCopyFeatures | undefined,
  present: Readonly<{ teamApply: boolean; storage: boolean; publish: boolean }>,
): ToolsUnavailableCopy {
  return {
    apply: present.teamApply ? null : byReason(features?.teamApply, APPLY) ?? APPLY_OFF,
    observation: byReason(features?.partyObservation, OBSERVATION),
    storage: present.storage ? null : byReason(features?.xunlaiAction, STORAGE),
    publish: present.publish ? null : byReason(features?.gameFileSaving, PUBLISH),
  };
}
