/**
 * Progress in the game host: the certified progress region and its feed.
 * The Hub's Progress page lives in the Travel app, which already owns the trip,
 * so the feed reports to Travel's palette. Maps' walking route can lead to the
 * active quest, so the feed also hands Maps the quest marker, and runs while
 * that route wants it even with Travel off.
 */
import { COMPANION_FEATURE_BITS } from "../../shared/companion-abi.js";
import {
  createCompanionProgressReader,
  createProgressObservationInstallation,
} from "./renderer/companion-progress-snapshot.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import travel from "../travel/companion.js";
import { updateCartographyQuest } from "../cartography/renderer/cartography-player-state.js";

export default {
  id: "progress",
  prepare({ capabilities }) {
    const progress = createProgressObservationInstallation(capabilities.progressObservation);
    return {
      featureFlags: capabilities.progressObservation ? COMPANION_FEATURE_BITS.progressObservation : 0,
      allocate: (malloc) => progress.allocate(malloc),
      allocated: () => progress.allocated,
      ownedRegions: () => progress.region == null ? [] : [progress.region],
      kernelRegions: () => ({
        ...(progress.region === null
          ? {} : { progress: { pointer: progress.pointer, bytes: progress.bytes } }),
      }),
      rollback: [(free) => progress.release(free)],
      activate(context) {
        const read = createCompanionProgressReader();
        const questRoute = () => {
          const { settings } = context.snapshot();
          return context.policy().cartography && settings.cartographyRouteEnabled && settings.cartographyQuestRouteEnabled;
        };
        const wanted = () => capabilities.progressObservation && (context.policy().progress || questRoute());
        const trip = context.prepared(travel)?.installation ?? null;
        const unsubscribe = progress.subscribe(state => {
          trip?.updateProgress(state);
          updateCartographyQuest(state);
        });
        return {
          feedPollers: [{
            poll: () => { if (progress.active) progress.sink?.update(read(context.memory.buffer, progress.pointer)); },
            enabled: () => progress.active,
          }],
          syncFeeds() { progress.setActive(wanted()); },
          activeFeatures: () => wanted() ? COMPANION_FEATURE_BITS.progressObservation : 0,
          disposePresentation: [() => { unsubscribe(); }],
          releaseObserverMemory: [(free) => { progress.release(free); progress.dispose(); }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
