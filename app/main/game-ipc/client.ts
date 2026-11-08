/**
 * The game client's channels: snapshot metadata, the health proof, the
 * window's client session, runtime feature failures, and first presentation.
 */
import {
  ENHANCEMENT_RUNTIME_FEATURES,
  type ClientHealthToken,
  type EnhancementRuntimeFeature,
} from "../../shared/contracts.js";
import { isDigest } from "../../shared/digest.js";
import { ValidationError } from "../../shared/errors.js";
import { channel } from "../ipc-channel-registry.js";
import { nothing, one } from "../ipc-values.js";
import { gameReadyToPresent } from "../window.js";
import type { GameHandlers, GameIpcInput } from "./part.js";

const asClientHealthToken = one((value: unknown): ClientHealthToken => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("invalid client health token");
  }
  const token = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(token.generation) ||
    (token.generation as number) <= 0 ||
    !isDigest(token.fingerprint) ||
    Object.keys(token).some(
      (key) => key !== "generation" && key !== "fingerprint",
    )
  ) {
    throw new ValidationError("invalid client health token");
  }
  return {
    generation: token.generation as number,
    fingerprint: token.fingerprint,
  };
});

const asEnhancementRuntimeFeatures = one(
  (value: unknown): readonly EnhancementRuntimeFeature[] => {
    if (
      !Array.isArray(value)
      || value.length === 0
      || value.length > ENHANCEMENT_RUNTIME_FEATURES.length
      || value.some((feature) =>
        typeof feature !== "string"
        || !ENHANCEMENT_RUNTIME_FEATURES.includes(
          feature as EnhancementRuntimeFeature,
        ))
      || new Set(value).size !== value.length
    ) throw new ValidationError("invalid enhancement feature failure");
    return value as EnhancementRuntimeFeature[];
  },
);

export default ({ client }: GameIpcInput) => {
  const runtime = client.runtime;
  return {
    channels: {
      snapshotMetadata: channel(nothing, () => runtime.snapshotMetadata()),
      clientHealthy: channel(asClientHealthToken, (_win, token) =>
        runtime.confirmCandidateHealthy(token)),
      gameReadyToPresent: channel(nothing, (win) => {
        gameReadyToPresent(win);
      }),
      clientSession: channel(nothing, (win) => client.clientSession(win)),
      clientFeatureFailure: channel(asEnhancementRuntimeFeatures, (win, features) =>
        client.recordFeatureFailure(win, features)),
    } satisfies GameHandlers,
  };
};
