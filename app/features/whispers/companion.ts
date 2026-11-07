/**
 * Whispers in the game host: the private chat region, the whisper session and
 * its surface. The session reads friends from the shared friends substrate and
 * lends itself to Hub people.
 */
import { COMPANION_FEATURE_BITS } from "../../shared/companion-abi.js";
import { createWhisperSession } from "../../shared/whisper-session.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import { createWhisperInstallation } from "../../renderer/whisper-installation.js";
import { createWhisperSurface } from "./renderer/whisper-surface.js";

export default {
  id: "whispers",
  prepare({ exports, capabilities, substrates: { friends } }) {
    const whispers = createWhisperInstallation(exports, capabilities.whisperChat);
    return {
      featureFlags: capabilities.whisperChat ? COMPANION_FEATURE_BITS.whisperObservation : 0,
      allocate: (malloc) => whispers.allocate(malloc),
      initialize: (memory) => whispers.initialize(memory),
      ownedRegions: () => whispers.region === null ? [] : [whispers.region],
      kernelRegions: () => ({ whispers: { pointer: whispers.pointer, bytes: whispers.bytes } }),
      rollback: [(free) => whispers.dispose(free)],
      activate(context) {
        const session = createWhisperSession(whispers.send);
        const unsubscribe = whispers.subscribe((messages, missed) => session.observe(messages, missed));
        let surface: ReturnType<typeof createWhisperSurface> | null = null;
        let character: string | null = null;
        friends.connect({
          observing: () => context.policy().whispers
            && (window.gwHub?.visible || (session.state.visible && session.state.selected === null)),
          update: (list) => session.updateFriends(list),
        });
        friends.attachWhispers(whispers, session);
        return {
          pollers: [{ poll: () => whispers.poll(), enabled: () => true }],
          activeFeatures: () => context.policy().whispers && capabilities.whisperChat
            ? COMPANION_FEATURE_BITS.whisperObservation : 0,
          sync() {
            const region = context.snapshot().playRegionState;
            if (region.status === "ready" && region.characterKey !== null) {
              if (character !== null && character !== region.characterKey) {
                whispers.setEnabled(false); whispers.poll(); session.reset(); friends.withdraw();
              }
              character = region.characterKey;
            } else if (region.status === "waiting" && region.reason === "game") {
              whispers.setEnabled(false); whispers.poll(); session.reset(); friends.withdraw(); character = null;
            }
            whispers.setEnabled(context.policy().whispers);
            session.setAvailable(whispers.enabled);
            if (context.policy().whispers && capabilities.whisperChat) {
              surface ??= createWhisperSurface(document.body, session);
              surface.setEnabled(true);
              session.setAvailable(true);
            } else {
              surface?.setEnabled(false);
              if (!context.snapshot().settings.whispersEnabled || !context.snapshot().settings.gwonmacTools) {
                surface?.dispose(); surface = null; session.reset();
              }
            }
          },
          disposePresentation: [() => {
            whispers.setEnabled(false); unsubscribe(); surface?.dispose(); surface = null; session.dispose();
          }],
          releaseCallbackResources: [(free) => whispers.dispose(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
