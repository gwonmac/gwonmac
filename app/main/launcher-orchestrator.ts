/**
 * Builds the launcher's revisioned read model and decides when the accounts
 * owner's launch queue may drain. The queue itself, its order, and every
 * profile's launch state live in MultipleAccountsController; this module only
 * projects them and never moves launch decisions into the renderer.
 */
import type {
  AccountsState,
  AppSettings,
  AppUpdateState,
  DownloadProgress,
  ExtendedMemoryRuntimeStatus,
} from "../shared/contracts.js";
import {
  launcherSettings,
  launcherToolSettings,
  type LauncherPreferencesPatch,
  type LauncherSnapshot,
} from "../shared/launcher-contracts.js";
import type { ProfileId } from "../shared/multiple-accounts.js";
import type { TexturePackSnapshot } from "../shared/texture-packs.js";
import type { LauncherStateStore } from "./core/launcher-state.js";
import { resolveShortcuts } from "../shared/keyboard-shortcuts.js";

interface LauncherAccountsOwner {
  state(): AccountsState;
  validateOpenable(ids: readonly ProfileId[]): void;
  queue(ids: readonly ProfileId[]): void;
  releaseQueued(ids: readonly ProfileId[]): void;
  releaseAllQueued(): void;
  drain(): Promise<void>;
  isOpen(id: ProfileId): boolean;
  show(id: ProfileId): boolean;
}

export interface LauncherOrchestratorOptions {
  readonly accounts: LauncherAccountsOwner;
  readonly state: LauncherStateStore;
  readonly hasActiveClient: () => boolean;
  readonly getProgress: () => DownloadProgress;
  readonly getAppUpdate: () => AppUpdateState;
  readonly getSettings: () => AppSettings;
  readonly getNews: (preferences: LauncherSnapshot["preferences"]) => LauncherSnapshot["news"];
  readonly toolsLoaded: () => boolean;
  readonly getTexturePacks?: () => TexturePackSnapshot;
  readonly getExtendedMemory?: () => ExtendedMemoryRuntimeStatus | null;
  /** Unpackaged Electron tests only: lets renderer-focused suites bypass client preparation. */
  readonly allowUnreadyLaunch?: boolean;
  readonly publish: (snapshot: LauncherSnapshot) => void;
}

export class LauncherOrchestrator {
  private readonly options: LauncherOrchestratorOptions;
  private revision = 0;

  constructor(options: LauncherOrchestratorOptions) {
    this.options = options;
  }

  snapshot(): LauncherSnapshot {
    const document = this.options.state.get();
    const accounts = this.options.accounts.state();
    const knownIds = new Set(accounts.profiles.filter((profile) => !profile.archived).map((profile) => profile.id));
    const selected = document.selectedProfileIds.filter((id) => knownIds.has(id));
    const selectedProfileIds = selected.length > 0
      ? selected
      : accounts.profiles.filter((profile) => !profile.archived).slice(0, 1).map((profile) => profile.id);
    const progress = this.options.getProgress();
    const readiness = this.readiness(progress);
    const settings = this.options.getSettings();
    return {
      revision: this.revision,
      experience: {
        installationKind: document.installationKind,
        setup: document.setupVersion > 0 ? "complete" : "pending",
        showMigrationNotice:
          document.installationKind !== "fresh" && !document.migrationNoticeDismissed,
        preferencesReset: document.preferencesResetPending,
      },
      readiness,
      appUpdate: this.options.getAppUpdate(),
      tools: {
        configured: settings.gwonmacTools,
        loaded: this.options.toolsLoaded(),
        restartRequired: settings.gwonmacTools !== this.options.toolsLoaded(),
        features: launcherToolSettings(settings),
      },
      settings: launcherSettings(settings),
      shortcuts: resolveShortcuts(settings.shortcutOverrides),
      texturePacks: this.options.getTexturePacks?.() ?? {
        selectedPackId: null,
        packs: [],
      },
      extendedMemory: this.options.getExtendedMemory?.() ?? null,
      profiles: accounts.profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        archived: profile.archived,
        state: profile.state,
        appearance: this.options.state.appearance(profile.id),
        ...(profile.launchIssue ? { failure: profile.launchIssue } : {}),
      })),
      selectedProfileIds,
      preferences: document.preferences,
      news: this.options.getNews(document.preferences),
    };
  }

  publish(): LauncherSnapshot {
    this.revision += 1;
    const snapshot = this.snapshot();
    this.options.publish(snapshot);
    return snapshot;
  }

  async setSelection(ids: readonly ProfileId[]): Promise<void> {
    this.options.accounts.validateOpenable(ids);
    await this.options.state.setSelection(ids);
    this.publish();
  }

  async play(ids: readonly ProfileId[]): Promise<void> {
    this.options.accounts.validateOpenable(ids);
    // Launch intent is independent of the remembered batch selection.
    const runtime = new Map(
      this.options.accounts.state().profiles.map((profile) => [profile.id, profile]),
    );
    const launchable = ids.filter((id) => {
      const profile = runtime.get(id);
      if (!profile || profile.archived) return false;
      if (profile.state === "failed") return true;
      return profile.state === "ready" && !this.options.accounts.isOpen(id);
    });
    if (launchable.length === 0) {
      this.publish();
      return;
    }
    const playable = this.options.hasActiveClient() || this.options.allowUnreadyLaunch === true;
    if (!playable && this.options.getProgress().phase === "error") {
      // Repair is one global launcher state, not a profile launch failure.
      // Keep the command idempotent so a stale renderer action cannot turn
      // that already-presented state into an unhandled IPC rejection.
      this.publish();
      return;
    }
    this.options.accounts.queue(launchable);
    // Without a playable client the queue waits until clientChanged drains it.
    if (playable) await this.options.accounts.drain();
    this.publish();
  }

  async show(id: ProfileId): Promise<void> {
    if (!this.options.accounts.show(id)) throw new Error("This account is not open");
    this.publish();
  }

  cancel(ids: readonly ProfileId[]): void {
    this.options.accounts.validateOpenable(ids);
    this.options.accounts.releaseQueued(ids);
    this.publish();
  }

  clientChanged(): void {
    const waiting = this.options.accounts.state().profiles.some((profile) => profile.state === "queued");
    if (this.options.hasActiveClient()) {
      if (waiting) {
        // Per-profile failures are already on each row; the launcher shows them.
        void this.options.accounts.drain().catch(() => undefined).finally(() => this.publish());
      }
      this.publish();
      return;
    }
    if (this.options.getProgress().phase === "error" && waiting) {
      this.options.accounts.releaseAllQueued();
      this.publish();
    }
  }

  async dismissMigrationNotice(): Promise<void> {
    await this.options.state.dismissMigrationNotice();
    this.publish();
  }

  async dismissPreferencesReset(): Promise<void> {
    await this.options.state.dismissPreferencesReset();
    this.publish();
  }

  async completeSetup(): Promise<void> {
    await this.options.state.completeSetup();
    this.publish();
  }

  async updateAppearance(profileId: ProfileId, appearance: LauncherSnapshot["profiles"][number]["appearance"]): Promise<void> {
    this.options.accounts.validateOpenable([profileId]);
    await this.options.state.updateAppearance(profileId, appearance);
    this.publish();
  }

  async updatePreferences(patch: LauncherPreferencesPatch): Promise<void> {
    await this.options.state.updatePreferences(patch);
    this.publish();
  }

  private readiness(progress: DownloadProgress): LauncherSnapshot["readiness"] {
    if (this.options.hasActiveClient()) {
      if (progress.phase !== "error" && progress.noticeCode === "offline-using-cached-client") {
        return { state: "offline-playable" };
      }
      return {
        state: "playable",
        backgroundDownload: progress.phase === "error"
          ? null
          : progress.fullDownload?.status === "running"
            ? {
                ...progress.fullDownload,
                received: progress.received,
                total: progress.total,
                bytesPerSecond: progress.bytesPerSecond,
                secondsRemaining: progress.secondsRemaining,
              }
            : progress.fullDownload ?? null,
        ...(progress.phase !== "error" && progress.noticeCode
          ? { notice: progress.noticeCode }
          : {}),
      };
    }
    if (progress.phase === "error") return { state: "repair-required", reason: progress.errorCode };
    return { state: "preparing", progress };
  }
}
