/**
 * Chat Filters in the game host: the certified filter mask for the saved choices.
 */
import type { AppSettings } from "../../shared/contracts.js";
import { ENHANCEMENT_CHAT_FILTER_MASKS } from "../../shared/enhancement-contracts.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

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
  prepare({ exports, capabilities }) {
    const configure = capabilities.chatFiltering
      && typeof exports.enhancement_configure_chat_filters === "function"
      ? exports.enhancement_configure_chat_filters as (mask: number) => number
      : null;
    if (capabilities.chatFiltering && configure === null) {
      throw new Error("the chat filtering profile derived a module with no filter configuration");
    }
    return {
      activate(context) {
        let mask: number | null = null;
        return {
          sync() {
            if (configure === null) return;
            const next = configuredChatFilterMask(context.snapshot().settings, context.policy().chatFilters);
            if (next === mask) return;
            if (configure(next) !== 1) {
              throw new Error("the chat filter rejected its configuration");
            }
            mask = next;
          },
          disposePresentation: [() => { configure?.(0); }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
