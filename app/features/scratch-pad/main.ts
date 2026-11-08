/** Scratch feature's main-process part. */
import { channel } from "../../main/ipc-channel-registry.js";
import { one } from "../../main/ipc-values.js";
import type { ToolsMainPart } from "../../main/tools-main-part.js";
import { ValidationError } from "../../shared/errors.js";
import contract from "./shared/ipc.js";

export default {
  feature: "scratchPad",
  label: "scratch pad",
  contract,
  create({ run }) {
    return {
      channels: {
        scratchPadEcho: channel(one((value): string => {
          if (typeof value !== "string") throw new ValidationError("text must be a string");
          return value;
        }), (_win, text) => run(async () => text)),
      },
    };
  },
} satisfies ToolsMainPart<typeof contract>;
