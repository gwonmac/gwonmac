/**
 * Whispers in the game host. The whisper session keeps the conversation for one character's
 * time in the game (`game.session`): it clears when the account or character changes, or when
 * resolve turns Whispers off for any reason but the area, and it stays through map loads and
 * PvP. While resolve has Whispers on, its `featurePart` listens to `game.chat` and shows the
 * surface. The session reads friends through `game.friends` while its people picker shows; other
 * Features, the Hub and its shortcut reach it through its link. The part is written by hand
 * because the session outlives the `featurePart` it prepares; the chat region is the chat
 * substrate's (tools-companion-substrates.ts).
 */
import { NO_FRIENDS } from "../../shared/friends.js";
import { createWhisperSession, type WhisperSession } from "../../shared/whisper-session.js";
import { provideLink } from "../../renderer/feature-links.js";
import { subscribeWhile } from "../../renderer/game-blocks.js";
import { featurePart, type FeatureBlocks, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";
import type { ToolIntent } from "../links.js";
import { whisperIconPlacement } from "./renderer/icon-placement.js";
import { whispersLink } from "./renderer/link.js";
import { createWhisperSurface } from "./renderer/whisper-surface.js";

type Surface = ReturnType<typeof createWhisperSurface>;

function startWhispers({ game, settings }: FeatureBlocks<"whispers">, session: WhisperSession, shown: (surface: Surface | null) => void) {
  const stopListening = game.chat.messages.subscribe((batch) => {
    if (batch !== null) session.observe(batch.messages, batch.missed);
  });
  session.setAvailable(true);
  const surface = createWhisperSurface(document.body, session, whisperIconPlacement(settings));
  const stopIcon = settings.subscribe(({ whispersIcon }) => surface.setIconShown(whispersIcon));
  shown(surface);
  return {
    stop() { shown(null); stopIcon(); surface.dispose(); stopListening(); session.setAvailable(false); },
  };
}

export default {
  id: "whispers",
  prepare(input) {
    return {
      activate(context) {
        const { chat: gameChat, friends } = context.game;
        const session = createWhisperSession((to, text) => gameChat.send({ kind: "whisper", to, text }));
        let surface: Surface | null = null;
        const feature = featurePart("whispers", (blocks) => startWhispers(blocks, session, (next) => { surface = next; }))
          .prepare(input).activate(context);
        // A different character, or another account, starts a new session; a map load keeps it.
        // The block keeps one session only while someone listens, so this listens for the part's whole life.
        let current: number | null | undefined;
        const stopSession = context.game.session.subscribe((next) => {
          const id = next?.id ?? null;
          if (current !== undefined && id !== current) {
            const available = session.state.available;
            session.reset();
            session.setAvailable(available);
          }
          current = id;
        });
        // The people picker shows friends; the list is read only then (Hub people reads its own).
        const followFriends = subscribeWhile(friends, null, (list) => session.updateFriends(list ?? NO_FRIENDS));
        const stopLink = provideLink("whispers", whispersLink(session, (intent: ToolIntent) => surface?.toggle(intent) ?? "unavailable"));
        return {
          ...feature,
          pollers: [{
            poll: () => followFriends(context.on("whispers") && session.state.visible && session.state.selected === null),
          }],
          sync() {
            // Only the area is missing: keep the conversation for when the character returns.
            const resolution = context.snapshot().features.whispers;
            if (!resolution.on && resolution.reason !== "wrong-area") session.reset();
          },
          disposePresentation: [...feature.disposePresentation ?? [], () => {
            stopLink(); stopSession(); followFriends(false); session.dispose();
          }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
