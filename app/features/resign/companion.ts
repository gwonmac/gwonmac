/**
 * The certified Resign command and its Hub row.
 */
import { installResignCommand } from "./renderer/resign-command.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "resign",
  prepare({ exports, capabilities }) {
    return {
      activate(context) {
        const resign = capabilities.resignAction ? installResignCommand(exports) : null;
        return {
          sync() { resign?.update(context.policy().resign); },
          disposePresentation: [() => { resign?.dispose(); }],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
