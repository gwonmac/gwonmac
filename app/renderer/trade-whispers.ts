/**
 * Owns the Whispers port the renderer gives Trade: whether Whispers is on
 * (feature-on.ts), and a conversation request that Whispers accepts by cancelling it.
 */
import { featureOn } from "./feature-on.js";
import type { TradeWhispersPort } from "../shared/tools-bundle-contracts.js";

export function createTradeWhispers(): TradeWhispersPort {
  return Object.freeze({
    available: () => featureOn("whispers"),
    onChange(listener: () => void) {
      const changed = () => listener();
      window.addEventListener("gw:tools-settings", changed);
      return () => window.removeEventListener("gw:tools-settings", changed);
    },
    open(sender: string) {
      const request = new CustomEvent("gw:whisper-person", { detail: sender, cancelable: true });
      return window.dispatchEvent(request) ? "unavailable" : "opened";
    },
  });
}
