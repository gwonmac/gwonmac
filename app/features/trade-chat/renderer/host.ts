/**
 * Trade Chat's window view, which its window part (./window.ts) starts lazily: loads the
 * read-only Trade window from the Tools bundle into the host the Tools window gives it, with the
 * Whispers link its manifest names and its place kept in settings.
 */
import type { EmbeddedToolsBundle } from "../../../shared/tools-bundle-contracts.js";
import type { WindowContext, WindowRunning } from "../../../renderer/window-part.js";
import { ensureToolsStylesheet } from "../../../renderer/tools-stylesheet.js";
import { requireToolsApi } from "../../../renderer/tools-native-api.js";
import { tradeWindowPlacement } from "./window-placement.js";

/** The running Trade window: what every window does, and the search its link hands it. */
export type TradeWindowRunning = WindowRunning & Readonly<{ search(query: string): void }>;

export async function startTradeWindow({ host, onVisibilityChange, links, onLinksChange }: WindowContext<"tradeChat">): Promise<TradeWindowRunning | null> {
  const native = requireToolsApi();
  ensureToolsStylesheet(host.ownerDocument);
  const specifier = "../../../tools/tools-app.js";
  try {
    const bundle = await import(specifier) as EmbeddedToolsBundle<HTMLElement>;
    const app = bundle.mountTradeChat(host, {
      nativeApi: native,
      links,
      onLinksChange,
      placement: tradeWindowPlacement(),
      initiallyVisible: false,
      onVisibilityChange,
      mode: "embedded",
      development: native.init.development,
    });
    return {
      setVisible: (visible: boolean) => visible ? app.show() : app.hide(),
      requestClose: app.hide,
      stepBack: app.stepBack,
      search: app.search,
      stop: app.dispose,
    };
  } catch (cause: unknown) {
    console.error("[tools] Trade Chat failed to load", cause);
    host.textContent = "Trade Chat could not be loaded — see the console.";
    return null;
  }
}
