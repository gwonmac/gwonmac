/**
 * Registers the optional Tools renderer-to-main channels. Main imports this
 * module only for a Tools-capable launch, so Core registers no tool
 * implementation. Each feature's part owns its channels (tools-main-part.ts);
 * ipc-channel-registry.ts proves every sender.
 */
import { registerChannelDefinitions } from "./ipc-channel-registry.js";
import type { ToolsMainSession } from "./tools-main-part.js";
import type { WindowRegistry } from "./window-registry.js";

export function registerToolsIpcHandlers(
  windows: WindowRegistry,
  sessions: readonly ToolsMainSession[],
): void {
  for (const session of sessions) registerChannelDefinitions(windows, session.channels);
}
