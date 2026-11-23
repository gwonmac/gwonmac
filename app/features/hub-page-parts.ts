/**
 * Every feature's hubPage part (the `hubPage` kind, `hubPagePart` in app/renderer/hub.ts): one
 * line per feature whose manifest lists "hubPage", sorted by folder, and the one way the game
 * host (app/renderer/harness.ts) starts them with the Hub and stops them at teardown. The game
 * host names none of them.
 *
 * Renderer only, and Core: Character Switch keeps Command-E owned by Core in every launch, so
 * the game host loads this list in Core launches too.
 */
import characterSwitch from "./character-switch/renderer/host.js";
import { safely } from "../renderer/contained.js";
import type { HubPageContext, HubPagePart } from "../renderer/hub.js";
import type { RunningPart } from "./parts.js";

export const HUB_PAGE_PARTS: readonly HubPagePart[] = Object.freeze([characterSwitch]);

/**
 * Starts every part and answers the stop for all of them. A part whose `start` throws stays off
 * and logs one line; the others run on, and one part's failing stop skips no other.
 */
export function startHubPageParts(context: HubPageContext, parts: readonly HubPagePart[] = HUB_PAGE_PARTS): () => void {
  const running: (readonly [HubPagePart["id"], RunningPart])[] = [];
  for (const part of parts) safely(`the ${part.id} Hub page part start`, () => { running.push([part.id, part.start(context)]); });
  return () => {
    for (const [id, part] of running.splice(0)) safely(`the ${id} Hub page part stop`, () => part.stop());
  };
}
