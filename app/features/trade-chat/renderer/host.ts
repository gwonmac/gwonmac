/**
 * Trade Chat's window part, its one entry for the game host: loads the read-only Trade
 * window from the Tools bundle into the host the Tools window gives it, with the Whispers
 * link its manifest names and its place kept in settings.
 */
import type { EmbeddedToolsBundle } from "../../../shared/tools-bundle-contracts.js";
import { definePart } from "../../parts.js";
import type { MountedTool, WindowContext } from "../../../renderer/toolbox-foundation.js";
import { ensureToolsStylesheet } from "../../../renderer/tools-stylesheet.js";
import { requireToolsApi } from "../../../renderer/tools-native-api.js";
import { tradeWindowPlacement } from "./window-placement.js";

export default definePart("window", "tradeChat", async ({ host, onVisibilityChange, links, onLinksChange }: WindowContext<"tradeChat">): Promise<MountedTool | null> => {
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
      update: () => {},
      stop: app.dispose,
    };
  } catch (cause: unknown) {
    console.error("[tools] Trade Chat failed to load", cause);
    host.textContent = "Trade Chat could not be loaded — see the console.";
    return null;
  }
});
