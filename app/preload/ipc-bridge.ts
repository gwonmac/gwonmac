/**
 * The preloads' one typed transport over a channel table (app/shared/ipc/).
 * `ipcRenderer.invoke` answers `Promise<any>`; this is the single place that
 * untyped boundary is narrowed, to the result the table declares for the
 * channel. Main's handler for the same entry must produce that result
 * (app/main/ipc-channel-registry.ts), so the two sides cannot disagree.
 */
import { ipcRenderer, type IpcRendererEvent } from "electron";
import type { ChannelTable, IpcBridge } from "../shared/ipc/channel-table.js";

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, handler);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    ipcRenderer.removeListener(channel, handler);
  };
}

function channelOf(table: ChannelTable, key: string): string {
  const spec = table[key];
  if (!spec) throw new TypeError(`${key} is not a channel of this table`);
  return spec.channel;
}

export const ipcBridge: IpcBridge = {
  invoker: (table) => (key, ...args) => ipcRenderer.invoke(channelOf(table, key), ...args),
  listener: (table) => (key, callback) => subscribe(channelOf(table, key), callback),
};
