/**
 * Whispers in the game host: the whisper session and its surface over
 * `game.chat`. The session reads friends from the shared friends substrate and
 * lends itself to Hub people; other Features reach it through its link.
 *
 * This line also hosts the chat region's memory phases (the chat substrate in
 * tools-companion-substrates.ts): the region keeps the place in COMPANION_PARTS
 * it had when Whispers owned it, and that place is the heap layout.
 */
import { createWhisperSession } from "../../shared/whisper-session.js";
import { provideLink } from "../../renderer/feature-links.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import { whispersLink } from "./renderer/link.js";
import { createWhisperSurface } from "./renderer/whisper-surface.js";

export default {
  id: "whispers",
  prepare({ exports, capabilities, substrates: { chat, friends } }) {
    return {
      ...chat.prepare(exports),
      activate(context) {
        const { chat: gameChat } = context.game;
        const session = createWhisperSession((to, text) => gameChat.send({ kind: "whisper", to, text }));
        let stopListening: (() => void) | null = null;
        const listen = (on: boolean) => {
          if (!on) {
            stopListening?.();
            stopListening = null;
          } else {
            stopListening ??= gameChat.messages.subscribe((batch) => {
              if (batch !== null) session.observe(batch.messages, batch.missed);
            });
          }
        };
        let surface: ReturnType<typeof createWhisperSurface> | null = null;
        let character: string | null = null;
        friends.connect({
          observing: () => context.on("whispers")
            && (window.gwHub?.visible || (session.state.visible && session.state.selected === null)),
          update: (list) => session.updateFriends(list),
        });
        friends.attachWhispers(session);
        const stopLink = provideLink("whispers", whispersLink(session));
        return {
          ...chat.session,
          sync() {
            const region = context.snapshot().playRegionState;
            if (region.status === "ready" && region.characterKey !== null) {
              if (character !== null && character !== region.characterKey) {
                listen(false); session.reset(); friends.withdraw();
              }
              character = region.characterKey;
            } else if (region.status === "waiting" && region.reason === "game") {
              listen(false); session.reset(); friends.withdraw(); character = null;
            }
            const resolution = context.snapshot().features.whispers;
            const on = resolution.on && capabilities.whisperChat;
            listen(on);
            session.setAvailable(on);
            if (on) {
              surface ??= createWhisperSurface(document.body, session);
              surface.setEnabled(true);
              surface.setIconShown(context.snapshot().settings.whispersIcon);
            } else {
              surface?.setEnabled(false);
              // Only the area is missing: keep the conversation for when the character returns.
              if (resolution.on || resolution.reason !== "wrong-area") {
                surface?.dispose(); surface = null; session.reset();
              }
            }
          },
          disposePresentation: [() => {
            stopLink(); listen(false); surface?.dispose(); surface = null; session.dispose();
          }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
