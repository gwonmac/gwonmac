/**
 * The Build Library's channels and its `window.gwNative.buildLibrary` namespace:
 * each account's saved library. Main answers them in ../main.ts.
 */
import type { BuildLibrary } from "../../../shared/builds/library.js";
import { invoke, toolContract, type Invoke } from "../../../shared/ipc/channel-table.js";

const channels = {
  buildLibraryGet: invoke<[], { library: BuildLibrary; recovered: boolean }>("gw:buildLibrary:get"),
  buildLibrarySet: invoke<[value: BuildLibrary], BuildLibrary>("gw:buildLibrary:set"),
} as const;

export interface BuildLibraryNativeApi {
  buildLibrary: {
    get: Invoke<typeof channels.buildLibraryGet>;
    set: Invoke<typeof channels.buildLibrarySet>;
  };
}

export default toolContract(channels, (invoke): BuildLibraryNativeApi => ({
  buildLibrary: {
    get: () => invoke("buildLibraryGet"),
    set: (value) => invoke("buildLibrarySet", value),
  },
}));
