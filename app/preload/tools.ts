// The Tools game preload: the Core bridge plus each Tool's namespaces, built
// by that Tool's channel contract (app/features/<id>/shared/ipc.ts). Built to
// build/preload/preload-tools.cjs. The Core preload (core.ts) never imports
// this file, so its bundle neither contains nor evaluates this source.
import { TOOL_CONTRACTS } from "../shared/ipc/tools.js";
import { exposeGameBridge } from "./game-bridge.js";
import { ipcBridge } from "./ipc-bridge.js";

exposeGameBridge((api) => {
  for (const contract of TOOL_CONTRACTS) Object.assign(api, contract.expose(ipcBridge));
});
