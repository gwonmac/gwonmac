/**
 * The Effect Timers overlay on the native HUD layer. It reads the shared
 * player-effect and effect-icon feeds and adds its demand to them.
 */
import { createEffectTimerOverlayConsumer } from "../../renderer/effect-timer-overlay-consumer.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "effectTimers",
  prepare({ capabilities, substrates: { effects } }) {
    return {
      activate(context) {
        const wanted = () => capabilities.nativeHudRendering && context.policy().effectTimers;
        effects.observePlayerEffectsWhen(() => wanted() && capabilities.effectIconGeometry);
        effects.observeEffectIconsWhen(wanted);
        let overlay: ReturnType<typeof createEffectTimerOverlayConsumer> | null = null;
        let unsubscribeEffects: (() => void) | null = null;
        let unsubscribeIcons: (() => void) | null = null;
        return {
          mount() {
            if (!capabilities.effectIconGeometry) return;
            const canvas = document.getElementById("canvas");
            if (!(canvas instanceof HTMLCanvasElement)) {
              throw new Error("Enhancement effect overlay target is missing");
            }
            if (!context.hud) return;
            overlay = createEffectTimerOverlayConsumer(document.body, canvas, context.hud);
            unsubscribeEffects = effects.playerEffects.subscribe(overlay.setEffects);
            unsubscribeIcons = effects.effectIcons.subscribe(overlay.setGeometry);
          },
          syncFeeds() { overlay?.setEnabled(context.policy().effectTimers && effects.effectIconsActive()); },
          disposePresentation: [
            () => { unsubscribeEffects?.(); unsubscribeEffects = null; },
            () => { unsubscribeIcons?.(); unsubscribeIcons = null; },
            () => { overlay?.dispose(); overlay = null; },
          ],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
