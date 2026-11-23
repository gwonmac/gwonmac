import type { CornerPosition } from "../../shared/corner-position.js";
import { readFloatingWindowPlacement, type FloatingWindowPlacement } from "../../shared/ui/window-placement.js";
import { readCornerPlacement } from "../../shared/overlay-placement.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "whispers",
  name: "Whispers",
  summary: "A movable whisper panel beside the game chat. Conversations last for this session only.",
  kind: "chat",
  presence: "tool",
  icon: "message-circle",
  version: "1.0",
  settings: {
    whispersEnabled: featureSwitch(false, { tools: true }),
    /** Draw the small unread icon; the panel still opens from its shortcut and the Hub. */
    whispersIcon: setting.boolean(true, {
      hub: true,
      tools: true,
      label: "Show the Whispers icon",
      help: "Draws the small unread icon. The shortcut and the Hub still open Whispers.",
      keywords: "hide whisper button icon unread",
    }),
    /** Where the player dragged the unread icon, as a distance from the nearest corner; null is its default place. */
    whispersIconPosition: setting.position(
      null,
      (value): CornerPosition | null | undefined => value === null ? null : readCornerPlacement(value),
      {
        hub: true,
        rendererWritable: true,
        tools: true,
        error: "Whispers icon position is invalid",
        launcherError: "Whispers icon position is invalid",
        label: "Whispers icon position",
        help: "Drag the icon in a game window to move it. Put back returns it to the top left.",
        keywords: "move drag reset whisper icon position",
      },
    ),
    /** Where the player moved and sized the Whispers panel, normalized to the game window; null is its default place. */
    whispersWindowPosition: setting.position(
      null,
      (value): FloatingWindowPlacement | null | undefined => value === null ? null : readFloatingWindowPlacement(value),
      {
        hub: true,
        rendererWritable: true,
        tools: true,
        error: "Whispers window position is invalid",
        launcherError: "Whispers window position is invalid",
        label: "Whispers window position",
        help: "Drag or resize the Whispers panel in a game window. Put back returns it to its default place and size.",
      },
    ),
  },
  region: "pve",
  uses: ["whisperChat"],
  tool: {
    id: "whispers",
    keywords: "chat friends messages pm people message",
  },
  hub: {
    command: "whispers", order: 2, keyOrder: 4,
    row: { detail: "Conversations, friends and drafts", iconKind: "whispers", open: {} },
  },
  shortcuts: [{ action: "whispers.toggle", binding: { key: "d", shift: false, option: false }, menuItem: "open-whispers" }],
  /**
   * Trade Chat opens a conversation with a seller; Hub people also reads who Whispers knows; its
   * shortcut, menu item and Hub row show the panel through `toggle` (shared/link.ts).
   */
  offers: ["open", "people", "toggle"],
  shots: [],
  parts: ["game"],
});
