/**
 * The Trade Chat alias in the game host: the certified toggle that opens the
 * Trade window from chat.
 */
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "tradeChat",
  prepare({ exports, capabilities }) {
    const configure = capabilities.chatAliases
      && typeof exports.enhancement_configure_trade_toggle === "function"
      ? exports.enhancement_configure_trade_toggle as (enabled: number) => number : null;
    const take = capabilities.chatAliases
      && typeof exports.enhancement_take_trade_toggle === "function"
      ? exports.enhancement_take_trade_toggle as () => number : null;
    if (capabilities.chatAliases && (!configure || !take)) {
      throw new Error("the aliases profile derived a module with no Trade Chat toggle");
    }
    return {
      activate(context) {
        let enabled: boolean | null = null;
        return {
          pollers: take === null ? [] : [{
            poll: () => {
              if (context.policy().tradeChat && take() === 1) {
                window.dispatchEvent(new CustomEvent("gw:trade-toggle"));
              }
            },
            enabled: () => context.policy().tradeChat,
          }],
          sync() {
            const next = context.policy().tradeChat;
            if (next === enabled) return;
            configure?.(next ? 1 : 0);
            // A region/settings transition can withdraw Trade after the native hook
            // has already published one toggle. Consume that stale edge while closing
            // the gate so it cannot reopen Trade if the feature becomes available
            // again before another hook dispatch.
            if (!next) take?.();
            enabled = next;
          },
          disposePresentation: [() => { configure?.(0); }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
