/**
 * Chat Filters in the game host. The filter itself is its certified stage, which hides the
 * chosen notices inside the client; this part only hands that stage the mask of the saved
 * choices while resolve has Chat Filters on, and clears it when resolve turns it off.
 *
 * The line is written by hand because the mask goes to a certified export, which the blocks do
 * not carry; it checks the export and hands the rest to the feature's `featurePart`.
 */
import type { AppSettings } from "../../shared/settings/index.js";
import { ENHANCEMENT_CHAT_FILTER_MASKS } from "../../shared/enhancement-contracts.js";
import { featurePart, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export function configuredChatFilterMask(
  settings: Pick<AppSettings,
    "chatFilterAllyDrops" | "chatFilterHallOfHeroes" | "chatFilterTitleAchievements">,
  enabled: boolean,
): number {
  if (!enabled) return 0;
  return (settings.chatFilterAllyDrops ? ENHANCEMENT_CHAT_FILTER_MASKS.allyDrops : 0)
    | (settings.chatFilterHallOfHeroes ? ENHANCEMENT_CHAT_FILTER_MASKS.hallOfHeroes : 0)
    | (settings.chatFilterTitleAchievements
      ? ENHANCEMENT_CHAT_FILTER_MASKS.titleAchievements
      : 0);
}

export default {
  id: "chatFilters",
  prepare(input) {
    const { exports, capabilities } = input;
    if (!capabilities.chatFiltering) return {};
    const configure = exports.enhancement_configure_chat_filters;
    if (typeof configure !== "function") {
      throw new Error("the chat filtering profile derived a module with no filter configuration");
    }
    return featurePart("chatFilters", ({ settings }) => {
      let mask: number | null = null;
      const stopSettings = settings.subscribe((next) => {
        const wanted = configuredChatFilterMask(next, true);
        if (wanted === mask) return;
        if (configure(wanted) !== 1) throw new Error("the chat filter rejected its configuration");
        mask = wanted;
      });
      return { stop() { stopSettings(); configure(0); } };
    }).prepare(input);
  },
} satisfies ToolsCompanionPart;
