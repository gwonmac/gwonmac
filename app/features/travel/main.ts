/**
 * Travel's main-process channels: the saved preferences and each character's history.
 */
import { channel } from "../../main/ipc-channel-registry.js";
import { TravelHistoryStore } from "../../main/core/travel-history.js";
import { nothing, one, type ToolsMainPart } from "../../main/tools-main-part.js";
import { parseTravelUserPreferencesUpdate } from "../../shared/travel.js";
import { parseTravelHistoryCharacter, parseTravelHistoryRecord } from "../../shared/travel-history.js";

export default {
  feature: "travel",
  label: "travel",
  create({ paths, preferences, run }) {
    const history = new TravelHistoryStore(paths.travelHistory);
    return {
      channels: {
        travelPreferencesGet: channel(nothing, () => run(() => preferences.getTravelPreferences())),
        travelPreferencesSet: channel(one(parseTravelUserPreferencesUpdate), (_win, update) =>
          run(() => preferences.updateTravelPreferences(update))),
        travelHistoryGet: channel(one(parseTravelHistoryCharacter), (_win, value) =>
          run(() => history.get(value.characterKey))),
        travelHistoryRecord: channel(one(parseTravelHistoryRecord), (_win, value) =>
          run(() => history.record(value.characterKey, value.mapId))),
      },
    };
  },
} satisfies ToolsMainPart;
