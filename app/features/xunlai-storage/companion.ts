/**
 * Xunlai Storage in the game host. The installation owns the command's exports,
 * memory and teardown; this part follows the shared game snapshot and lends its
 * command to the Tools window.
 */
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "xunlaiStorage",
  async prepare({ exports, capabilities, substrates: { observation } }) {
    const storage = capabilities.xunlaiAction
      ? (await import("../../renderer/enhancement-storage-installation.js"))
          .createStorageInstallation(exports, true, window.gwNative.init.development)
      : null;
    return {
      /** The installation whose command the Tools window offers. */
      installation: storage,
      allocate: (malloc) => storage?.allocate(malloc),
      allocated: () => storage === null || Boolean(storage.region().pointer),
      initialize: (memory) => storage?.initialize(memory),
      ownedRegions: () => storage === null ? [] : [storage.region()],
      rollback: [(free) => storage?.dispose(free)],
      activate(context) {
        const sync = () => storage?.update({
          enabled: context.policy().xunlaiStorage, playRegion: context.playRegion(), state: observation.state,
        });
        observation.observeStateWhen(() => context.policy().xunlaiStorage);
        observation.onState(() => sync());
        return {
          mount() { storage?.mount(); },
          sync,
          releaseCallbackResources: [(free) => storage?.dispose(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
