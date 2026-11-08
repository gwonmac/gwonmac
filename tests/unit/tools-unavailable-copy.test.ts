import assert from "node:assert/strict";
import test from "node:test";
import type { OptionalFeatureStatus, RequiredFeatureStatus } from "../../app/shared/contracts.js";
import {
  toolsUnavailableCopy,
  type ToolsCopyFeatures,
} from "../../app/shared/tools-unavailable-copy.js";

const unavailable = (reason: "game-update" | "preparation-failed" | "check-failed"): OptionalFeatureStatus =>
  ({ status: "unavailable", reason });

function features(status: OptionalFeatureStatus): ToolsCopyFeatures {
  // File saving is required, so it is never "off": it is available then.
  const saving: RequiredFeatureStatus = status.status === "off" ? { status: "available" } : status;
  return { teamApply: status, partyObservation: status, xunlaiAction: status, gameFileSaving: saving };
}

const MISSING = { teamApply: false, storage: false, publish: false };

test("Tools copy names the reason a capability is missing, never an update for a failed check", () => {
  // Catches a failed build check or a failed start shown as a Guild Wars
  // update, and a present command shown as refused.
  const cases: [string, ToolsCopyFeatures | undefined, typeof MISSING, Record<string, string | null>][] = [
    ["update", features(unavailable("game-update")), MISSING, {
      apply: "Apply team is unavailable after this Guild Wars update. Your saved team is unchanged.",
      observation: "Live game information is temporarily unavailable. Saved builds and teams still work.",
      storage: "Storage is unavailable after this Guild Wars update.",
      publish: null,
    }],
    ["check failed", features(unavailable("check-failed")), MISSING, {
      apply: "Couldn’t check this Guild Wars build. Trying again at next start. Your saved team is unchanged.",
      observation: "Couldn’t check this Guild Wars build. Trying again at next start. Saved builds and teams still work.",
      storage: "Storage is unavailable. Couldn’t check this Guild Wars build. Trying again at next start.",
      publish: "GWonMac can’t add builds to Guild Wars. Couldn’t check this Guild Wars build. Trying again at next start. The build is still saved in your library.",
    }],
    ["start failed", features(unavailable("preparation-failed")), MISSING, {
      apply: "Apply team didn’t start. Your saved team is unchanged. Restart GWonMac to try again.",
      observation: "Live game information didn’t start. Saved builds and teams still work. Restart GWonMac to try again.",
      storage: "Storage didn’t start. Restart GWonMac to try again.",
      publish: "Adding builds to Guild Wars didn’t start. Restart GWonMac to try again. The build is still saved in your library.",
    }],
    ["switched off", features({ status: "off" }), MISSING, {
      apply: "Apply team is off. Your saved team is unchanged.",
      observation: null,
      storage: null,
      publish: null,
    }],
    ["present despite a refusal", features(unavailable("check-failed")), { teamApply: true, storage: true, publish: true }, {
      apply: null,
      observation: "Couldn’t check this Guild Wars build. Trying again at next start. Saved builds and teams still work.",
      storage: null,
      publish: null,
    }],
    ["no session yet", undefined, MISSING, {
      apply: "Apply team is off. Your saved team is unchanged.",
      observation: null,
      storage: null,
      publish: null,
    }],
  ];
  for (const [name, statuses, present, expected] of cases) {
    assert.deepEqual(toolsUnavailableCopy(statuses, present), expected, name);
  }
});
