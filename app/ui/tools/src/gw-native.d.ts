import type {
  AppSettings,
  GwNativeApi,
} from "../../../shared/contracts";
import type { CustomUiTheme } from "../../../shared/ui-theme";
import type { FixtureCanvasEvent } from "./hub-fixture";

export type StandaloneAppearanceFixture = Readonly<{
  uiStyle: AppSettings["uiStyle"];
  uiPanelOpacity: AppSettings["uiPanelOpacity"];
  uiTextSize?: AppSettings["uiTextSize"];
  uiFont?: AppSettings["uiFont"];
  uiCustomTheme?: CustomUiTheme;
}>;

declare global {
  interface Window {
    gwNative: GwNativeApi;
    /** Bounded, session-only evidence from the most recent failed Team Apply. */
    gwTeamApplyProbe?: unknown;
    /*
     * The standalone workbench's test hooks. They are required, so a spec that drives a renamed
     * hook fails to type-check instead of silently doing nothing; only the standalone workbench
     * and its fixtures (standalone.ts, hub-fixture.ts) set and read them, never the embedded app.
     */
    /** Applies an appearance through the production boundary (standalone.ts). */
    gwApplyFixtureAppearance: (fixture: StandaloneAppearanceFixture) => void;
    /** Hub fixture only: every input event that reached the synthetic game canvas. */
    gwFixtureCanvas: Readonly<{ events: readonly FixtureCanvasEvent[]; clear(): void }>;
    /** Hub fixture only: every recorded game or account action, oldest first. */
    gwFixtureActions: readonly string[];
    /** Hub fixture only: renames the saved account "Second" for every later read. */
    gwFixtureAccounts: Readonly<{ renameSecond(name: string): void }>;
    /** Hub fixture only: the named seller re-posts, replacing their newest Trade message. */
    gwTradeFixture: Readonly<{ repost(sender: string, message: string): void }>;
  }
}

export {};
