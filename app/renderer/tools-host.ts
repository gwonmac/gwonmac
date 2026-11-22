/**
 * Starts the Tools window's window parts (the Build Library's and Trade Chat's) with what each
 * one's context needs, and mounts the saved-library-only Tools window for a client with no
 * usable companion. The game host imports it lazily, so the parts load only with Tools.
 *
 * The Tools window already owns the boundary — the toggle, the event stops, pointer-lock
 * release, the cursor mirror, focus transfer and teardown — so a window part needs none of that
 * again. Two boundaries around one panel is how a held movement key ends up stuck when only one
 * of them is torn down.
 */
import type { TeamApplyCommands } from "../shared/builds/team-apply-runner.js";
import type { StorageCommand } from "../shared/storage-command.js";
import { createToolboxLifecycle, type MountedTool } from "./toolbox-foundation.js";
import { featureLinks, onLinksChange } from "./feature-links.js";
import buildLibraryWindow from "../features/build-library/renderer/host.js";
import tradeWindow from "../features/trade-chat/renderer/host.js";
import { featureOn } from "./feature-on.js";

/**
 * Starts the Build Library's window part. `commands` and `storage` are the certified Team Apply
 * and Xunlai Storage commands, or null for a module derived without them: only the complete Tools
 * profile carries a call to a packet builder, so null is an absence in the bytes rather than a
 * disabled JavaScript switch. They are handed straight through.
 */
export function mountBuildsInto(
  host: HTMLElement,
  onVisibilityChange: (visible: boolean) => void,
  show: () => void,
  commands: TeamApplyCommands | null,
  storage: StorageCommand | null,
  /** Whether this session's client can discover templates written to IDBFS. */
  templatePublishing: boolean,
): Promise<MountedTool | null> {
  return buildLibraryWindow.start({
    host, onVisibilityChange, show, links: featureLinks("buildLibrary"), onLinksChange, commands, storage, templatePublishing,
  });
}

/** Starts Trade Chat's window part with the links its manifest names. */
export function mountTradeInto(
  host: HTMLElement,
  onVisibilityChange: (visible: boolean) => void,
  show: () => void,
): Promise<MountedTool | null> {
  return tradeWindow.start({ host, onVisibilityChange, show, links: featureLinks("tradeChat"), onLinksChange });
}

/**
 * Mounts the saved-library-only Tools experience for an official client that
 * has no usable companion. This module already owns the Tools bundle boundary,
 * so it also owns the matching settings listener and teardown; the Emscripten
 * bootstrap only decides when this fallback is needed.
 */
export function mountHostOnlyTools(
  parent: HTMLElement,
  templatePublishingAvailable: boolean,
): () => void {
  const lifecycle = createToolboxLifecycle(parent, {
    buildsLink: buildLibraryWindow.id,
    mountTool: (host, onVisibilityChange, show) =>
      mountBuildsInto(host, onVisibilityChange, show, null, null, templatePublishingAvailable),
    mountTrade: mountTradeInto,
  });
  const syncEnabled = () => {
    lifecycle.setEnabled(featureOn("tools"));
    lifecycle.setAvailable({
      builds: featureOn("buildLibrary"),
      trade: featureOn("tradeChat"),
    });
  };
  window.addEventListener("gw:tools-settings", syncEnabled);
  syncEnabled();
  return () => {
    window.removeEventListener("gw:tools-settings", syncEnabled);
    lifecycle.dispose();
  };
}
