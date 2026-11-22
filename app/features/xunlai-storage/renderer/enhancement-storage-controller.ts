/**
 * Lifecycle owner for storage availability, policy synchronization, and disposal.
 * The installer forwards settings and the certified game snapshot here instead
 * of duplicating state. It also owns Xunlai Storage's link (shared/link.ts): its
 * `toggle` is the one way to open the chest, and it says why it refused.
 */
import type { XunlaiStorageLink } from "../shared/link.js";
import type { CompanionSnapshot } from "../../../renderer/companion-snapshot.js";
import type { RuntimePlayRegion } from "../../../renderer/enhancement-runtime-policy.js";
import {
  createStorageCommand,
  initializeStorageDataWindow,
  STORAGE_DATA_WINDOW_BYTES,
  type EnhancementStorageConfigure,
  type EnhancementStorageOpen,
} from "./enhancement-storage-command.js";

export { initializeStorageDataWindow, STORAGE_DATA_WINDOW_BYTES };

type ReadyStorageGameState = Pick<
  Extract<CompanionSnapshot, { status: "ready" }>,
  "status" | "xunlaiAccess"
>;
type PendingStorageGameState = Pick<
  Exclude<CompanionSnapshot, { status: "ready" }>,
  "status"
>;
export type StorageGameState = ReadyStorageGameState | PendingStorageGameState;

export interface StorageAvailability {
  readonly enabled: boolean;
  readonly playRegion: RuntimePlayRegion;
  readonly state: StorageGameState | null;
}

export interface StorageController {
  /** Xunlai Storage's link; it stays valid after `dispose` and then refuses. */
  readonly link: XunlaiStorageLink;
  update(availability: StorageAvailability): void;
  dispose(): void;
}

function unavailableReason(
  active: boolean,
  availability: StorageAvailability,
): string | null {
  if (!active) return "Enhancement installation is no longer active";
  if (availability.playRegion === "pvp") {
    return "Xunlai storage is unavailable during PvP play";
  }
  if (!availability.enabled) return "Xunlai storage is turned off in Settings";
  if (availability.playRegion === "unknown") {
    return "Storage is waiting to confirm the current region";
  }
  const state = availability.state;
  if (state?.status !== "ready" || typeof state.xunlaiAccess !== "boolean") {
    return "Storage is waiting to confirm access for this character";
  }
  if (state.xunlaiAccess !== true) {
    return "This character cannot access Xunlai storage here";
  }
  return null;
}

/** Owns the complete storage command policy, link, and Wasm configuration lifecycle. */
export function createStorageController(
  open: EnhancementStorageOpen,
  configure: EnhancementStorageConfigure,
  payloadPointer: number,
  development = false,
): StorageController {
  let active = true;
  let availability: StorageAvailability = {
    enabled: false,
    playRegion: "unknown",
    state: null,
  };
  let configuredEnabled: boolean | null = null;
  let availabilityTraceKey: string | null = null;
  let request = 0;
  let previousRequestAt: number | null = null;
  const unavailable = () => unavailableReason(active, availability);
  const trace = (event: string, fields: Readonly<Record<string, unknown>>) => {
    if (!development) return;
    console.debug(`[tools:dev] storage.${event} ${JSON.stringify(fields)}`);
  };
  const command = createStorageCommand(open, unavailable);
  const sync = () => {
    const enabled = unavailable() === null;
    if (enabled === configuredEnabled) return;
    const result = configure(payloadPointer, enabled ? 1 : 0);
    configuredEnabled = enabled;
    trace("configured", {
        enabled,
        playRegion: availability.playRegion,
        accepted: result === 1,
      state: availability.state?.status ?? "missing",
      access: availability.state?.status === "ready"
        ? availability.state.xunlaiAccess
        : "unknown",
    });
  };
  /** Opens the chest: the game opens it, so there is nothing to hide, and a refusal answers "unavailable". */
  const toggle = (): "shown" | "unavailable" => {
    const requestedAt = performance.now();
    const fields = {
      request: ++request,
      sincePreviousMs: previousRequestAt === null
        ? null
        : Math.round(requestedAt - previousRequestAt),
      state: availability.state?.status ?? "missing",
      access: availability.state?.status === "ready"
        ? availability.state.xunlaiAccess
        : "unknown",
    } as const;
    previousRequestAt = requestedAt;
    try {
      command.open();
      trace("queued", { ...fields, accepted: true });
      return "shown";
    } catch (error) {
      trace("refused", {
        ...fields,
        reason: error instanceof Error ? error.message : "unknown storage error",
        enabled: availability.enabled,
        playRegion: availability.playRegion,
      });
      return "unavailable";
    }
  };
  const link: XunlaiStorageLink = Object.freeze({ toggle, blocked: unavailable });
  sync();

  return Object.freeze({
    link,
    update(next: StorageAvailability) {
      availability = next;
      const fields = {
        enabled: next.enabled,
        playRegion: next.playRegion,
        state: next.state?.status ?? "missing",
        access: next.state?.status === "ready" ? next.state.xunlaiAccess : "unknown",
      } as const;
      const traceKey = JSON.stringify(fields);
      if (traceKey !== availabilityTraceKey) {
        availabilityTraceKey = traceKey;
        trace("availability", fields);
      }
      sync();
    },
    dispose() {
      if (!active) return;
      active = false;
      configure(0, 0);
    },
  });
}
