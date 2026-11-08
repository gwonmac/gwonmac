/**
 * The game window's clipboard channels: copying out of the game's text proxy,
 * reading the pasteboard for build-code imports, and applying an Edit command
 * to the game's active text field.
 */
import { clipboard } from "electron";
import { CLIPBOARD_TEXT_CEILING, type GameTextEditRequest } from "../../shared/contracts.js";
import { ValidationError } from "../../shared/errors.js";
import { editGameText } from "../game-text-editing.js";
import { channel } from "../ipc-channel-registry.js";
import { nothing, one } from "../ipc-values.js";
import type { GameHandlers } from "./part.js";

const asClipboardText = one((value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > CLIPBOARD_TEXT_CEILING
  ) {
    throw new ValidationError("invalid clipboard text");
  }
  return value;
});

const asGameTextEditRequest = one((value: unknown): GameTextEditRequest => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("invalid game text edit request");
  }
  const request = value as Record<string, unknown>;
  if (request.command === "copy" || request.command === "cut") {
    if (
      Object.keys(request).some((key) => key !== "command" && key !== "text")
      || typeof request.text !== "string"
      || request.text.length === 0
      || request.text.length > CLIPBOARD_TEXT_CEILING
    ) {
      throw new ValidationError("invalid game text export request");
    }
    return { command: request.command, text: request.text };
  }
  if (
    request.command === "paste"
    && Object.keys(request).length === 2
    && (request.field === "text" || request.field === "secret")
  ) {
    return { command: "paste", field: request.field };
  }
  if (request.command === "selectAll" && Object.keys(request).length === 1) {
    return { command: "selectAll" };
  }
  throw new ValidationError("invalid game text edit request");
});

export default () => ({
  channels: {
    clipboardWriteText: channel(asClipboardText, (_win, text) => {
      clipboard.writeText(text);
    }),
    clipboardEdit: channel(asGameTextEditRequest, async (win, request) => {
      await editGameText(win.webContents, request);
    }),
    // Truncated rather than refused: a player who copied something large before
    // reaching for Import from Clipboard should see "no build templates in
    // that", not a failure about a size they never chose.
    clipboardReadText: channel(nothing, () =>
      clipboard.readText().slice(0, CLIPBOARD_TEXT_CEILING)),
  } satisfies GameHandlers,
});
