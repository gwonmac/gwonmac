/**
 * Progress in the game host: the certified progress region and its feed.
 * The Hub's Progress page lives in the Travel app, which already owns the trip,
 * so the feed reports to Travel's palette.
 */
import { COMPANION_FEATURE_BITS } from "../../shared/companion-abi.js";
import {
  createCompanionProgressReader,
  createProgressObservationInstallation,
} from "./renderer/companion-progress-snapshot.js";
import { EMPTY_REGION, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import travel from "../travel/companion.js";

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
        progress: progress.region === null ? EMPTY_REGION : { pointer: progress.pointer, bytes: progress.bytes },
      }),
      rollback: [(free) => progress.release(free)],
      activate(context) {
        const read = createCompanionProgressReader();
        const wanted = () => capabilities.progressObservation && context.policy().progress;
        const trip = context.prepared(travel)?.installation ?? null;
        const unsubscribe = progress.subscribe(state => trip?.updateProgress(state));
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
