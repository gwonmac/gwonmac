/**
 * The game client's network channels: DNS lookups, its TCP sockets, and the
 * socket events main pushes back to the window that owns the socket.
 */
import { errorCode, ValidationError } from "../../shared/errors.js";
import type { SocketEvent } from "../../shared/contracts.js";
import { GAME_CHANNELS } from "../../shared/ipc/game.js";
import { resolveDns } from "../core/dns.js";
import { MAX_QUEUED_BYTES_PER_SOCKET } from "../core/sockets.js";
import { count, startDnsResolveSpan } from "../diagnostics.js";
import { channel, emit } from "../ipc-channel-registry.js";
import { args, one, toWireSocketEvent } from "../ipc-values.js";
import { windowRegistry } from "../window-registry.js";
import type { GameHandlers, GameIpcInput } from "./part.js";

const asString = (what: string) =>
  one((value: unknown): string => {
    if (typeof value !== "string") throw new ValidationError(`${what} must be a string`);
    return value;
  });

const parseSocketId = (value: unknown): number => {
  if (!Number.isInteger(value)) throw new ValidationError("socketId must be an integer");
  return value as number;
};

const asSocketPayload = args(2, ([id, data]): [socketId: number, bytes: Uint8Array] => {
  const socketId = parseSocketId(id);
  if (!(data instanceof Uint8Array) && !ArrayBuffer.isView(data)) {
    throw new ValidationError("data must be a Uint8Array");
  }
  if (data.byteLength > MAX_QUEUED_BYTES_PER_SOCKET) {
    throw new ValidationError(
      `socket payload exceeds ${MAX_QUEUED_BYTES_PER_SOCKET} bytes`,
    );
  }
  return [
    socketId,
    data instanceof Uint8Array
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  ];
});

export default ({ sockets, windows }: GameIpcInput) => ({
  channels: {
    dnsResolve: channel(asString("dns name"), async (win, name) => {
      const lookup = startDnsResolveSpan(windows.requireDiagnosticOwnerForWindow(win));
      try {
        const address = await resolveDns(name);
        lookup.end({ status: "ok", code: null });
        return address;
      } catch (err) {
        lookup.end({ status: "error", code: errorCode(err) });
        throw err;
      }
    }),

    socketConnect: channel(asString("destination"), (win, destination) =>
      sockets.connect(win.webContents.id, destination)),

    socketSend: channel(asSocketPayload, async (win, socketId, bytes) => {
      const ownerId = windows.requireDiagnosticOwnerForWindow(win);
      count("socket.ipcReceiveCalls", 1, ownerId);
      count("socket.ipcPayloadBytes", bytes.byteLength, ownerId);
      count("socket.ipcBackingBytes", bytes.buffer.byteLength, ownerId);
      await sockets.send(socketId, bytes, win.webContents.id);
    }),

    socketClose: channel(one(parseSocketId), async (win, socketId) => {
      await sockets.close(socketId, win.webContents.id);
    }),
  } satisfies GameHandlers,
});

export function emitSocketEvent(ownerId: number, event: SocketEvent): void {
  const win = windowRegistry.windowForWebContents(ownerId);
  if (win) emit(win, GAME_CHANNELS.socketEvent, toWireSocketEvent(event));
}
