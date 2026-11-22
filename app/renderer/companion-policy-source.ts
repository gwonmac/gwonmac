/**
 * Canonical renderer source for the saved settings, main's Feature facts and the
 * certified play region. It resolves every Feature (app/shared/feature-resolve.ts)
 * from main's facts and the live region, so presentation and command modules
 * consume one immutable snapshot instead of wiring the same listeners or deciding
 * on their own.
 */
import type { EnhancementProgram } from "../shared/enhancement-contracts.js";
import { FEATURES, type FeatureId } from "../shared/feature-contracts.js";
import { resolve, type FeatureFacts, type FeatureResolution, type FeatureState } from "../shared/feature-resolve.js";
import type { CompanionPlayRegionState } from "./companion-play-region-snapshot.js";
import type { OptionalToolSettings, RuntimePlayRegion } from "./enhancement-runtime-policy.js";

type CompanionPolicyReason = "launch" | "region" | "settings";

type CompanionPolicySnapshot<
  Settings extends OptionalToolSettings = OptionalToolSettings,
> = Readonly<{
  settings: Settings;
  /** Main's facts for this window (app/main/feature-decision.ts). */
  facts: FeatureFacts;
  playRegion: RuntimePlayRegion;
  playRegionState: CompanionPlayRegionState;
  /** resolve's answer for every Feature, with the live region. */
  features: Readonly<Record<FeatureId, FeatureResolution>>;
}>;

type PolicyUpdate<Settings extends OptionalToolSettings> = Readonly<{
  reason: CompanionPolicyReason;
  snapshot: CompanionPolicySnapshot<Settings>;
}>;

function projectPlayRegion(state: CompanionPlayRegionState): string {
  if (state.status !== "ready") return `waiting:${state.reason}`;
  return [
    "ready",
    state.playRegion,
    state.mapId,
    state.instanceType,
    state.travelContext,
    state.characterKey ?? "unknown-character",
    state.unlockedMapWords?.join(",") ?? "unknown-unlocks",
    state.guildHall ? "guild-hall" : "outside-guild-hall",
    state.hasGuildHall ? "has-guild-hall" : "no-guild-hall",
  ].join(":");
}

export function createCompanionPolicySource<Settings extends OptionalToolSettings>(
  input: Readonly<{
    program: EnhancementProgram;
    readSettings(): Settings;
    /** Main's facts; null until they arrive, when every Feature reads off. */
    readFacts(): FeatureFacts | null;
    settingsEvents: Pick<EventTarget, "addEventListener" | "removeEventListener">;
    readPlayRegion(): CompanionPlayRegionState;
    subscribePlayRegion(
      listener: (state: CompanionPlayRegionState) => void,
    ): () => void;
  }>,
) {
  const listeners = new Set<(update: PolicyUpdate<Settings>) => void>();
  let disposed = false;
  // Before main's facts arrive nothing is loaded, so every Feature reads off.
  const readFacts = (): FeatureFacts => input.readFacts()
    ?? { toolsAtLaunch: false, settings: {}, program: input.program, features: null };
  let settings = input.readSettings();
  let facts = readFacts();
  let playRegionState = input.readPlayRegion();
  let playRegionProjection = projectPlayRegion(playRegionState);
  const makeSnapshot = (): CompanionPolicySnapshot<Settings> => {
    const playRegion: RuntimePlayRegion = playRegionState.status === "ready"
      ? playRegionState.playRegion
      : "unknown";
    const state: FeatureState = { ...facts, playRegion };
    return Object.freeze({
      settings,
      facts,
      playRegion,
      playRegionState,
      features: Object.freeze(Object.fromEntries(FEATURES.map((feature) => [feature.id, resolve(feature, state)]))) as
        Readonly<Record<FeatureId, FeatureResolution>>,
    });
  };
  let snapshot = makeSnapshot();
  const publish = (reason: Exclude<CompanionPolicyReason, "launch">) => {
    snapshot = makeSnapshot();
    const update = Object.freeze({ reason, snapshot });
    for (const listener of listeners) listener(update);
  };
  const onSettings = () => {
    if (disposed) return;
    // The event is only a notification (of new settings or new facts). The
    // validated bridge remains the source of truth even if page code
    // dispatches a forged event payload.
    settings = input.readSettings();
    facts = readFacts();
    publish("settings");
  };
  input.settingsEvents.addEventListener("gw:tools-settings", onSettings);
  let unsubscribePlayRegion: () => void;
  try {
    unsubscribePlayRegion = input.subscribePlayRegion((state) => {
      if (disposed) return;
      const projection = projectPlayRegion(state);
      if (projection === playRegionProjection) return;
      playRegionState = state;
      playRegionProjection = projection;
      publish("region");
    });
  } catch (cause) {
    input.settingsEvents.removeEventListener("gw:tools-settings", onSettings);
    throw cause;
  }

  return Object.freeze({
    get snapshot() { return snapshot; },
    subscribe(listener: (update: PolicyUpdate<Settings>) => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      try {
        listener(Object.freeze({ reason: "launch", snapshot }));
      } catch (cause) {
        listeners.delete(listener);
        throw cause;
      }
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const failures: unknown[] = [];
      try {
        input.settingsEvents.removeEventListener("gw:tools-settings", onSettings);
      } catch (cause) {
        failures.push(cause);
      }
      try {
        unsubscribePlayRegion();
      } catch (cause) {
        failures.push(cause);
      }
      listeners.clear();
      if (failures.length > 0) {
        throw new AggregateError(failures, "Companion policy source disposal failed");
      }
    },
  });
}
