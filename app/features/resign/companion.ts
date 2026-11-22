/**
 * Resign in the game host. While resolve has Resign on, its `featurePart` runs the certified
 * command: the confirmation, its Hub row and the link its shortcut and menu item call.
 *
 * The line is written by hand because the command is a certified export, which the blocks do not
 * carry; it checks the exports and hands the rest to the feature's `featurePart`.
 */
import { resignCommand } from "./renderer/resign-command.js";
import { featurePart, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "resign",
  prepare(input) {
    if (!input.capabilities.resignAction) return {};
    const command = resignCommand(input.exports);
    return featurePart("resign", () => command.start()).prepare(input);
  },
} satisfies ToolsCompanionPart;
