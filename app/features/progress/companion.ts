/**
 * Progress in the game host: the feed from the shared progress substrate
 * (`game.progress`). The Hub's Progress page lives in the Travel app, which
 * already owns the trip, so the feed reports to Travel's palette. Maps' walking
 * route can lead to the active quest, so the feed also hands Maps the quest
 * marker, and runs while that route wants it even with Travel off.
 *
 * This line also hosts the progress region's memory phases: the region keeps
 * the place in COMPANION_PARTS it had when Progress owned it (the heap layout).
 */
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import travel from "../travel/companion.js";
import { updateCartographyQuest } from "../cartography/renderer/cartography-player-state.js";

export default {
  id: "progress",
  prepare({ substrates: { progress } }) {
    return {
      ...progress.prepared,
      activate(context) {
        const questRoute = () => {
          const { settings } = context.snapshot();
          return context.policy().cartography && settings.cartographyRouteEnabled && settings.cartographyQuestRouteEnabled;
        };
        progress.observeWhen(() => context.policy().progress || questRoute());
        const trip = context.prepared(travel)?.installation ?? null;
        const unsubscribe = progress.installation.subscribe(state => {
          trip?.updateProgress(state);
          updateCartographyQuest(state);
        });
        return {
          ...progress.session(context),
          disposePresentation: [() => { unsubscribe(); }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
