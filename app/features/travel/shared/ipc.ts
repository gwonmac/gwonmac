/**
 * Travel's channels and its `window.gwNative.travelPreferences` and
 * `travelHistory` namespaces: the saved preferences and each character's
 * history. Main answers them in ../main.ts.
 */
import { invoke, toolContract, type Invoke } from "../../../shared/ipc/channel-table.js";
import type { TravelUserPreferences, TravelUserPreferencesUpdate } from "../../../shared/travel.js";

const channels = {
  travelPreferencesGet: invoke<[], TravelUserPreferences>("gw:travelPreferences:get"),
  travelPreferencesSet: invoke<[value: TravelUserPreferencesUpdate], TravelUserPreferences>("gw:travelPreferences:set"),
  travelHistoryGet: invoke<[value: { characterKey: string }], readonly number[]>("gw:travelHistory:get"),
  travelHistoryRecord: invoke<[value: { characterKey: string; mapId: number }], readonly number[]>("gw:travelHistory:record"),
} as const;

export interface TravelNativeApi {
  travelPreferences: {
    get: Invoke<typeof channels.travelPreferencesGet>;
    set: Invoke<typeof channels.travelPreferencesSet>;
  };
  travelHistory: {
    get: Invoke<typeof channels.travelHistoryGet>;
    record: Invoke<typeof channels.travelHistoryRecord>;
  };
}

export default toolContract(channels, (invoke): TravelNativeApi => ({
  travelPreferences: {
    get: () => invoke("travelPreferencesGet"),
    set: (value) => invoke("travelPreferencesSet", value),
  },
  travelHistory: {
    get: (value) => invoke("travelHistoryGet", value),
    record: (value) => invoke("travelHistoryRecord", value),
  },
}));
