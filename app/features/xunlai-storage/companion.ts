/**
 * Xunlai Storage in the game host. The installation owns the command's exports,
 * memory and teardown; this part follows the shared game snapshot and provides
 * the storage controller's link (shared/link.ts) while the controller is mounted.
 */
import { provideLink } from "../../renderer/feature-links.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "xunlaiStorage",
  async prepare({ exports, capabilities, substrates: { observation } }) {
    const storage = capabilities.xunlaiAction
      ? (await import("./renderer/enhancement-storage-installation.js"))
          .createStorageInstallation(exports, true, window.gwNative.init.development)
      : null;
    return {
      allocate: (malloc) => storage?.allocate(malloc),
      allocated: () => storage === null || Boolean(storage.region().pointer),
      initialize: (memory) => storage?.initialize(memory),
      ownedRegions: () => storage === null ? [] : [storage.region()],
      rollback: [(free) => storage?.dispose(free)],
      activate(context) {
        const sync = () => storage?.update({
          enabled: context.on("xunlaiStorage"), playRegion: context.playRegion(), state: observation.state,
        });
        observation.observeStateWhen(() => context.on("xunlaiStorage"));
        observation.onState(() => sync());
        let stopLink = () => {};
        return {
          mount() {
            storage?.mount();
            const link = storage?.link();
            if (link) stopLink = provideLink("xunlaiStorage", link);
          },
          sync,
          disposePresentation: [() => stopLink()],
          releaseCallbackResources: [(free) => storage?.dispose(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
