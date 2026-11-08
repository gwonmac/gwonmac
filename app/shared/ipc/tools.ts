/**
 * The game window's optional Tools channels, composed from each Tool's own
 * contract (app/features/<id>/shared/ipc.ts) the way settings/index.ts
 * composes feature settings. A Tool with channels adds one line here; the
 * Tools preload exposes every contract's namespaces and
 * app/features/main-parts.ts proves each contract has exactly one main owner.
 *
 * Only the Tools preload and main import this; the Core preload never does,
 * so its bundle holds no Tools channel.
 */
import buildLibrary from "../../features/build-library/shared/ipc.js";
import cartography from "../../features/cartography/shared/ipc.js";
import tradeChat from "../../features/trade-chat/shared/ipc.js";
import travel from "../../features/travel/shared/ipc.js";
import { invokeKeys, type UnionToIntersection } from "./channel-table.js";

export const TOOL_CONTRACTS = [buildLibrary, travel, tradeChat, cartography] as const;

export type ToolContracts = typeof TOOL_CONTRACTS;

/** Every Tools channel, keyed like the contracts. */
export type ToolsChannels = UnionToIntersection<ToolContracts[number]["channels"]>;

/** The namespaces only the Tools preload adds to `window.gwNative`. */
export type ToolsNativeApiExtension = UnionToIntersection<ReturnType<ToolContracts[number]["expose"]>>;

/** The Tools channels main answers. */
export const TOOLS_INVOKE_KEYS = TOOL_CONTRACTS.flatMap((contract) => invokeKeys(contract.channels));
