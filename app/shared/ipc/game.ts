/**
 * The Core game window's channels: every channel string, argument tuple and
 * result the Core game preload and main share, declared once. Both game
 * preloads expose these; a Tools launch adds app/shared/ipc/tools.ts.
 *
 * `CoreGwNativeApiBase` (contracts.ts) types its methods from these entries,
 * the preload calls them through a typed invoker, and main's handlers must
 * answer them with the declared result (app/main/game-ipc/).
 */
import type {
  AccountTemplateLibrary,
  HubAccountRequest,
  HubAccountsSnapshot,
} from "../accounts-contracts.js";
import type {
  ClientHealthToken,
  ClientSession,
  ClockSyncResponse,
  DiagnosticProfile,
  EnhancementRuntimeFeature,
  ExternalLinkKind,
  GameReloadCause,
  GameTextEditRequest,
  GraphicsDiagnostics,
  RendererCommand,
  RendererCommandCompletion,
  RendererSettingsPatch,
  RevealKind,
  SnapshotMetadata,
  SocketEvent,
  SteamTokenResult,
  StoredCredentials,
  TemplateExportResult,
} from "../contracts.js";
import type {
  DiagnosticSummary,
  RendererFrameBatch,
  RendererMetrics,
  RendererMilestone,
  RendererMilestoneFields,
} from "../diagnostics.js";
import type { HubSettingsChange, HubSettingsSnapshot } from "../hub-settings.js";
import type { MainInputTraceEntry } from "../input-trace.js";
import type { ShortcutAction } from "../keyboard-shortcuts.js";
import type { LauncherShortcutCaptureResult } from "../launcher-contracts.js";
import type { SettingsTarget } from "../settings-catalogue.js";
import type { AppSettings } from "../settings/index.js";
import type { TemplateExportEntry } from "../template-contracts.js";
import type { VisualCaptureSubmission } from "../visual-capture.js";
import { event, invoke, invokeKeys, send } from "./channel-table.js";

export const GAME_CHANNELS = {
  snapshotMetadata: invoke<[], SnapshotMetadata>("gw:snapshot:metadata"),
  dnsResolve: invoke<[name: string], string>("gw:dns:resolve"),
  socketConnect: invoke<[destination: string], number>("gw:socket:connect"),
  socketSend: invoke<[socketId: number, data: Uint8Array], void>("gw:socket:send"),
  socketClose: invoke<[socketId: number], void>("gw:socket:close"),
  socketEvent: event<[event: SocketEvent]>("gw:socket:event"),
  settingsGet: invoke<[], AppSettings>("gw:settings:get"),
  settingsSet: invoke<[value: RendererSettingsPatch], AppSettings>("gw:settings:set"),
  settingsEvent: event<[settings: AppSettings]>("gw:settings:event"),
  credentialsLoad: invoke<[], StoredCredentials | null>("gw:credentials:load"),
  credentialsSave: invoke<[value: StoredCredentials], void>("gw:credentials:save"),
  credentialsClear: invoke<[], void>("gw:credentials:clear"),
  steamToken: invoke<[silent: boolean], SteamTokenResult>("gw:steam:token"),
  steamStore: invoke<[token: string, expiry: number | null], void>("gw:steam:store"),
  steamClear: invoke<[], void>("gw:steam:clear"),
  diagnosticsGraphics: invoke<[value: GraphicsDiagnostics], void>("gw:diagnostics:graphics"),
  diagnosticsClockSync: invoke<[rendererNowUs: number], ClockSyncResponse>("gw:diagnostics:clockSync"),
  diagnosticsClockResult: invoke<[offsetUs: number, rttUs: number], void>("gw:diagnostics:clockResult"),
  diagnosticsRendererMetrics: invoke<[value: RendererMetrics], void>("gw:diagnostics:rendererMetrics"),
  diagnosticsRendererFrames: invoke<[value: RendererFrameBatch], void>("gw:diagnostics:rendererFrames"),
  diagnosticsRendererMilestone: invoke<[
    name: RendererMilestone,
    rendererTimestampUs: number,
    fields?: RendererMilestoneFields | undefined,
  ], void>("gw:diagnostics:rendererMilestone"),
  diagnosticsVisualSubmit: invoke<[value: VisualCaptureSubmission], void>("gw:diagnostics:visualSubmit"),
  diagnosticsProfileSet: invoke<[value: DiagnosticProfile], DiagnosticProfile>("gw:diagnostics:profileSet"),
  diagnosticsCurrent: invoke<[], DiagnosticSummary>("gw:diagnostics:current"),
  appOpenExternal: invoke<[kind: ExternalLinkKind], void>("gw:app:openExternal"),
  appRevealPath: invoke<[kind: RevealKind], void>("gw:app:revealPath"),
  hubAccountsGet: invoke<[], HubAccountsSnapshot>("gw:hub:accounts:get"),
  hubAccountOpen: invoke<[request: HubAccountRequest], void>("gw:hub:account:open"),
  appOpenSettings: invoke<[target?: SettingsTarget], void>("gw:app:openSettings"),
  hubSettingsGet: invoke<[], HubSettingsSnapshot>("gw:hub:settings:get"),
  hubSettingsUpdate: invoke<[change: HubSettingsChange], void>("gw:hub:settings:update"),
  hubShortcutCapture: invoke<[action: ShortcutAction], LauncherShortcutCaptureResult>("gw:hub:shortcut:capture"),
  hubShortcutCaptureCancel: invoke<[], void>("gw:hub:shortcut:captureCancel"),
  appShowLauncher: invoke<[], void>("gw:app:showLauncher"),
  appRequestQuit: invoke<[], void>("gw:app:requestQuit"),
  appShowQuitOrReload: invoke<[], "stayed" | "left" | undefined>("gw:app:showQuitOrReload"),
  appReloadGame: invoke<[cause: GameReloadCause], void>("gw:app:reloadGame"),
  appClaimRelogIntent: invoke<[], boolean>("gw:app:claimRelogIntent"),
  clipboardWriteText: invoke<[text: string], void>("gw:clipboard:writeText"),
  clipboardReadText: invoke<[], string>("gw:clipboard:readText"),
  clipboardEdit: invoke<[request: GameTextEditRequest], void>("gw:clipboard:edit"),
  templatesExport: invoke<[entries: readonly TemplateExportEntry[]], TemplateExportResult>("gw:templates:export"),
  clientHealthy: invoke<[token: ClientHealthToken], void>("gw:client:healthy"),
  gameReadyToPresent: invoke<[], void>("gw:game:readyToPresent"),
  clientSession: invoke<[], ClientSession>("gw:client:session"),
  clientFeatureFailure: invoke<[features: readonly EnhancementRuntimeFeature[]], void>("gw:client:featureFailure"),
  // Main→renderer, and the renderer's acknowledgement. Main waits on the
  // acknowledgement because a capture flush has to finish inside the capture
  // window, which `executeJavaScript`'s awaited result used to guarantee.
  rendererCommand: event<[id: number, command: RendererCommand]>("gw:renderer:command"),
  rendererCommandDone: send<[id: number, outcome: RendererCommandCompletion]>("gw:renderer:commandDone"),
  inputTraceEvent: event<[entry: MainInputTraceEntry]>("gw:inputTrace:event"),
  profileTemplatesLoad: invoke<[], AccountTemplateLibrary | null>("gw:profileTemplates:load"),
  profileTemplatesSave: invoke<[entries: readonly TemplateExportEntry[]], void>("gw:profileTemplates:save"),
} as const;

export type GameChannels = typeof GAME_CHANNELS;

/** The Core channels main answers. */
export const GAME_INVOKE_KEYS = invokeKeys(GAME_CHANNELS);
