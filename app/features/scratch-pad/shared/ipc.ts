/** Scratch feature's channel and `window.gwNative.scratchPad` namespace. */
import { invoke, toolContract, type Invoke } from "../../../shared/ipc/channel-table.js";

const channels = {
  scratchPadEcho: invoke<[text: string], string>("gw:scratchPad:echo"),
} as const;

export interface ScratchPadNativeApi {
  scratchPad: { echo: Invoke<typeof channels.scratchPadEcho> };
}

export default toolContract(channels, (invoke): ScratchPadNativeApi => ({
  scratchPad: { echo: (text) => invoke("scratchPadEcho", text) },
}));
