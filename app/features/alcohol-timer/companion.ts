/**
 * The Alcohol Timer overlay. It reads the shared alcohol feed and asks the
 * shared effect feeds for the icon geometry it sits beside.
 */
import { createAlcoholTimerOverlay } from "./renderer/alcohol-timer-overlay.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "alcoholTimer",
  prepare({ capabilities, substrates: { alcohol, effects } }) {
    return {
      activate(context) {
        const requested = () => capabilities.alcoholObservation
          && context.snapshot().settings.gwonmacTools && context.snapshot().settings.alcoholTimerEnabled;
        const shown = () => requested() && context.policy().alcoholTimer;
        alcohol.observeWhen(requested);
        effects.observePlayerEffectsWhen(() => shown() && capabilities.effectIconGeometry);
        effects.observeEffectIconsWhen(shown);
        let overlay: ReturnType<typeof createAlcoholTimerOverlay> | null = null;
        let unsubscribe: (() => void) | null = null;
        return {
          mount() {
            if (!capabilities.effectIconGeometry) return;
            const canvas = document.getElementById("canvas");
            if (!(canvas instanceof HTMLCanvasElement)) {
              throw new Error("Enhancement effect overlay target is missing");
            }
            if (!capabilities.alcoholObservation) return;
            overlay = createAlcoholTimerOverlay(document.body, canvas,
              alcoholTimerPosition => window.gwNative.settings.set({ alcoholTimerPosition }));
            unsubscribe = alcohol.installation.subscribe(overlay.setAlcohol);
          },
          syncFeeds() {
            overlay?.setSettings(context.snapshot().settings.alcoholTimerPosition,
              context.policy().alcoholTimer && requested());
          },
          disposePresentation: [() => { unsubscribe?.(); overlay?.dispose(); overlay = null; }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
