/**
 * Every feature's main-process part, in FEATURES order.
 *
 * Main only, and Tools only: app/main/tools-runtime.ts is the one importer,
 * behind main's dynamic import (tests/policy/core-tools-launch-boundary).
 * Every Tools channel must have an owner here, or this file does not compile.
 */
import type { ToolsMainInput, ToolsMainPart } from "../main/tools-main-part.js";
import type { ToolsInvokeChannel } from "../shared/contracts.js";
import buildLibrary from "./build-library/main.js";
import cartography from "./cartography/main.js";
import tradeChat from "./trade-chat/main.js";
import travel from "./travel/main.js";

type ChannelsOf<Part> = Part extends Readonly<{ create(input: ToolsMainInput): { channels: infer Channels } }>
  ? keyof Channels : never;

/** Accepts the list only when its parts register every Tools channel. */
const everyChannelOwned = <const Parts extends readonly ToolsMainPart[]>(
  parts: Parts & ([Exclude<ToolsInvokeChannel, ChannelsOf<Parts[number]>>] extends [never]
    ? unknown : { unownedChannels: Exclude<ToolsInvokeChannel, ChannelsOf<Parts[number]>> }),
): Parts => parts;

export const MAIN_PARTS = everyChannelOwned([buildLibrary, travel, tradeChat, cartography]);
