// The Tools game preload: the Core bridge plus each Tool's namespaces, built
// by that Tool's channel contract (app/features/<id>/shared/ipc.ts). Built to
// build/preload/preload-tools.cjs. The Core preload (core.ts) never imports
// this file, so its bundle neither contains nor evaluates this source.
import { TOOL_CONTRACTS } from "../shared/ipc/tools.js";
import { exposeGameBridge } from "./game-bridge.js";
import { ipcBridge } from "./ipc-bridge.js";

// A namespace that is already on `window.gwNative` (Core's, or an earlier
// Tool's) is never replaced: the preload fails instead. Core names are also a
// type error (tests/unit/ipc-channel-types.test.ts).
exposeGameBridge((api) => {
  for (const contract of TOOL_CONTRACTS) {
    const namespaces = contract.expose(ipcBridge);
    const taken = Object.keys(namespaces).find((name) => name in api);
    if (taken !== undefined) throw new Error(`gwNative.${taken} is exposed twice`);
    Object.assign(api, namespaces);
  }
});
