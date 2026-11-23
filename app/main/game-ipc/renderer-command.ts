/**
 * The one send channel the game window has: the renderer's completion of a
 * command main sent it (renderer-commands.ts). It is registered with
 * `registerSend`, so it gets the same sender proof as every invoke; the
 * pending-command bookkeeping stays in renderer-commands.ts.
 */
import {
  RENDERER_COMMAND_COMPLETIONS,
  type RendererCommandCompletion,
} from "../../shared/contracts.js";
import { channel } from "../ipc-channel-registry.js";
import { args, type Parser } from "../ipc-values.js";
import { completeRendererCommand } from "../renderer-commands.js";

const parseCompletion: Parser<[id: number, outcome: RendererCommandCompletion]> = args(2, ([id, outcome]) => {
  if (
    typeof id !== "number"
    || !RENDERER_COMMAND_COMPLETIONS.includes(outcome as RendererCommandCompletion)
  ) {
    throw new Error("invalid renderer command completion");
  }
  return [id, outcome as RendererCommandCompletion];
});

export default {
  rendererCommandDone: channel(parseCompletion, (win, id, outcome) => {
    completeRendererCommand(win.webContents.id, id, outcome);
  }),
};
