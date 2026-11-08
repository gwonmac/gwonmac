/**
 * Every feature's main-process part, in FEATURES order.
 *
 * Main only, and Tools only: app/main/tools-runtime.ts is the one importer,
 * behind main's dynamic import (tests/policy/core-tools-launch-boundary).
 * Every Tools channel (app/shared/ipc/tools.ts) must have exactly one owner
 * here, or this file does not compile.
 */
import type { ChannelTable, InvokeKey } from "../shared/ipc/channel-table.js";
import type { ToolsChannels } from "../shared/ipc/tools.js";
import type { OwnershipError } from "../main/ipc-channel-registry.js";
import type { AnyToolsMainPart } from "../main/tools-main-part.js";
import buildLibrary from "./build-library/main.js";
import cartography from "./cartography/main.js";
import tradeChat from "./trade-chat/main.js";
import travel from "./travel/main.js";
import scratchPad from "./scratch-pad/main.js";

type ContractKeys<Parts extends readonly unknown[]> = {
  [Index in keyof Parts]: Parts[Index] extends Readonly<{ contract: Readonly<{ channels: infer Table extends ChannelTable }> }>
    ? InvokeKey<Table>
    : never
};

/** Accepts the list only when its parts answer every Tools channel exactly once. */
const everyChannelOwnedOnce = <const Parts extends readonly AnyToolsMainPart[]>(
  parts: Parts & OwnershipError<InvokeKey<ToolsChannels>, ContractKeys<Parts>>,
): Parts => parts;

export const MAIN_PARTS = everyChannelOwnedOnce([buildLibrary, travel, tradeChat, cartography, scratchPad]);
