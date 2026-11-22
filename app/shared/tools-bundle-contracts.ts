/**
 * Type-only boundary between the classic renderer and the independently built
 * Tools bundle. The runtime import uses a generated file name, so both builds
 * import these shapes directly instead of restating them on either side.
 */
import type { EliteMapHandle, EliteMapHost } from "./elite-map.js";
import type { HubPresenter, HubSource, HubViewMount } from "./hub.js";
import type { WhisperSession } from "./whisper-session.js";
import type { TravelFriends } from "./friends.js";
import type { GameProgressState } from "./game-progress.js";
import type { ToolboxObservation } from "./builds/live-party.js";
import type { TeamApplyCommands } from "./builds/team-apply-runner.js";
import type { StorageCommand } from "./storage-command.js";
import type { TravelCommand, TravelGameState } from "./travel-command.js";
import type { ToolsGwNativeApi } from "./contracts.js";
import type { FeatureLinks, ToolLink } from "../features/links.js";
import type { CornerPosition } from "./corner-position.js";

export type PublishedTemplate = Readonly<{
  fileName: string;
  location: string;
}>;

/** A build the Tools bundle has already encoded for the renderer to publish. */
export type PublishableTemplate = Readonly<{ name: string; code: string }>;

/** What to do when an imported template's name is already used by a different build. */
export type TemplateCollisionPolicy = "skip" | "replace";

export type TemplateFilesState =
  | Readonly<{ available: false; reason: string }>
  | Readonly<{ available: true; stored: string; count: number; stranded: string | null }>;

/** Picked files, read once; nothing is written until `apply`. */
export interface TemplateSelection {
  preview(policy: TemplateCollisionPolicy): Readonly<{ summary: string; skipped: string; count: number }>;
  /** The sentence that reports the import; rejects with one when nothing could be saved. */
  apply(policy: TemplateCollisionPolicy): Promise<string>;
}

/**
 * The game's saved template files, moved in and out as .txt files. Only the
 * renderer can reach the mount, so it implements this and the Build Library
 * draws it; every string it returns is ready to show.
 */
export interface TemplateFiles {
  state(): TemplateFilesState;
  read(files: readonly File[]): Promise<TemplateSelection>;
  /** The outcome sentence, or null when the player cancelled the folder picker. */
  exportAll(): Promise<string | null>;
  /** Moves templates out of folders Guild Wars cannot list; returns the outcome sentence. */
  rescue(): Promise<string>;
}

export type ToolsAppHandle = Readonly<{
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setActive: (active: boolean) => void;
  requestClose: () => void;
  /** The companion's latest game projection; the Tools domain interprets it. */
  update: (observation: ToolboxObservation) => void;
  dispose: () => void;
}>;

export type ToolsAppMountOptions = Readonly<{
  readTemplates?: () => Promise<readonly { path: string; contents: string }[]>;
  initiallyVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  publishTemplate:
    | ((template: PublishableTemplate) => Promise<PublishedTemplate>)
    | null;
  templateFiles: TemplateFiles | null;
  commands: TeamApplyCommands | null;
  storage: StorageCommand | null;
  /** Why `storage` is null, in the player's words; null when it is not. */
  storageUnavailable: string | null;
  /** Why `publishTemplate` is null, in the player's words; null when it is not. */
  publishUnavailable: string | null;
  applyUnavailable: string | null;
  observationUnavailable: string | null;
  development: boolean;
}>;

export type TravelPaletteHandle = Readonly<{
  show: () => void;
  hide: () => void;
  toggle: () => void;
  update: (state: TravelGameState) => void;
  updateFriends: (friends: TravelFriends) => void;
  dispose: () => void;
}>;

export type TradeChatHandle = Readonly<{
  search: (query: string) => void;
  /** Escape's step out of one Trade level (menu, Saved drawer, sub-view, then a typed search); false at the empty listings. */
  stepBack: () => boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  dispose: () => void;
}>;

/**
 * The links Trade's manifest names (Whispers owns the conversation with a seller), read live
 * from the game window's registry (app/renderer/feature-links.ts), and when they may change.
 */
export type TradeLinks = Readonly<{
  links: FeatureLinks<"tradeChat">;
  /** Calls back when a link may have turned on or off; returns the unsubscribe. */
  onLinksChange(listener: () => void): () => void;
}>;

/**
 * Where the player put Whispers' unread icon: the `whispersIconPosition` setting, given at once and
 * after every change (null is its default place), and saved when the player moves it.
 */
export type WhisperIconPlacement = Readonly<{
  subscribe(listener: (position: CornerPosition | null) => void): () => void;
  save(position: CornerPosition): void;
}>;

export type WhispersMountOptions = Readonly<{
  session: WhisperSession;
  /** What the icon does when clicked: Whispers' own `toggle` (its link). Absent, the icon shows or hides the panel. */
  toggle?: ToolLink["toggle"];
  /** Absent, the icon starts at its default place and a move lasts until the view goes. */
  iconPlacement?: WhisperIconPlacement;
}>;

export type TradeChatMountOptions = Readonly<{
  initiallyVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  mode: "standalone" | "embedded";
  development: boolean;
}>;

/** The exact named exports of the generated Tools module. */
export type EmbeddedToolsBundle<Target> = Readonly<{
  mountEliteSkills: (target: Target, options: Readonly<{ nativeApi: ToolsGwNativeApi; onOpenChange(open: boolean): void } & EliteMapHost>) => EliteMapHandle;
  mountWhispers: (target: Target, options: WhispersMountOptions) => { dispose(): void };
  mountToolsApp: (
    target: Target,
    options: ToolsAppMountOptions & Readonly<{ nativeApi: ToolsGwNativeApi; hub?: HubPresenter<Target> }>,
  ) => ToolsAppHandle;
  /** `leaveArea` asks "Leave this area?" before a trip out of an explorable area and rejects with an AbortError when the player stays. */
  createHubTravel: (options: { nativeApi: ToolsGwNativeApi; command: TravelCommand; development: boolean; hub: HubPresenter<Target>; leaveArea(place: string, leave: () => Promise<void>): Promise<void>; /** Whether the Travel tool is switched on. */ toolOn(): boolean }) => {
    source: HubSource;
    readonly active: boolean;
    open(): void;
    /** A new Travel page's content, for a page that was shown before the bundle loaded. */
    page(): HubViewMount<Target>;
    travel(mapId: number): Promise<void>;
    update(state: TravelGameState): void;
    updateFriends(friends: TravelFriends): void;
    /** The character's mission, vanquish and title progress for the Progress page. */
    updateProgress(progress: GameProgressState): void;
    dispose(): void;
  };
  mountTradeChat: (
    target: Target,
    options: TradeChatMountOptions & TradeLinks & Readonly<{ nativeApi: ToolsGwNativeApi }>,
  ) => TradeChatHandle;
}>;
