/**
 * Owns the Whispers port the renderer gives Trade: the Whispers switch read from
 * its manifest, and a conversation request that Whispers accepts by cancelling it.
 */
import { featureActivationRequested } from "../shared/feature-contracts.js";
import type { TradeWhispersPort } from "../shared/tools-bundle-contracts.js";

export function createTradeWhispers(): TradeWhispersPort {
  return Object.freeze({
    available: () => featureActivationRequested("whispers", window.gwToolsSettings()),
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
