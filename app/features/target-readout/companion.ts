/**
 * The Target Readout over the shared game snapshot.
 */
import { createTargetReadout } from "./renderer/enhancement-readout.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "targetReadout",
  prepare({ substrates: { observation } }) {
    return {
      activate(context) {
        let readout: ReturnType<typeof createTargetReadout> | null = null;
        const sync = () => {
          if (!observation.observeState) return;
          if (context.policy().targetReadout) {
            // Every game window reads the place back from settings, so all of them follow a drag.
            readout ??= createTargetReadout(document.body, {
              savePosition: targetReadoutPosition => { void window.gwNative.settings.set({ targetReadoutPosition }).catch(() => undefined); },
            });
            readout.setPosition(context.snapshot().settings.targetReadoutPosition);
          } else { readout?.dispose(); readout = null; }
        };
        const wanted = () => context.policy().targetReadout;
        observation.observeStateWhen(wanted);
        observation.observeTargetWhen(wanted);
        observation.onState((state) => readout?.update(state));
        return {
          mount: sync,
          syncFeeds: sync,
          runtime: { readout: () => readout?.state ?? null },
          disposePresentation: [() => { readout?.dispose(); readout = null; }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
