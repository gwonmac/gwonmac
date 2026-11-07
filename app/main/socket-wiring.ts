/**
 * Connects the game socket owner to the renderer event channel and to the
 * diagnostics recorder of the account that opened each socket.
 */
import { app } from "electron";
import { SocketManager } from "./core/sockets.js";
import {
  count,
  gauge,
  logEvent,
  observe,
  peakGauge,
} from "./diagnostics.js";
import { emitSocketEvent } from "./ipc.js";
import { windowRegistry } from "./window-registry.js";

export function createSocketManager(): SocketManager {
  return new SocketManager(
    (ownerId, event) => {
      const diagnosticOwnerId =
        windowRegistry.diagnosticOwnerForWebContents(ownerId);
      if (event.type === "open") {
        if (diagnosticOwnerId !== null) logEvent(
          { k: "socket.open", socketId: event.socketId, port: event.port },
          diagnosticOwnerId,
        );
      } else if (event.type === "close") {
        if (diagnosticOwnerId !== null) logEvent({
          k: "socket.close",
          socketId: event.socketId,
          reason: event.reason,
        }, diagnosticOwnerId);
      } else if (event.type === "error") {
        if (diagnosticOwnerId !== null) logEvent({
          k: "socket.error",
          socketId: event.socketId,
          code: event.code,
        }, diagnosticOwnerId);
      }
      emitSocketEvent(ownerId, event);
    },
    {
      count: (name, delta, ownerId) => {
        const diagnosticOwnerId = ownerId === undefined
          ? null
          : windowRegistry.diagnosticOwnerForWebContents(ownerId);
        if (diagnosticOwnerId !== null) count(name, delta, diagnosticOwnerId);
      },
      observe: (name, durationUs, ownerId) => {
        const diagnosticOwnerId = ownerId === undefined
          ? null
          : windowRegistry.diagnosticOwnerForWebContents(ownerId);
        if (diagnosticOwnerId !== null) {
          observe(name, durationUs, diagnosticOwnerId);
        }
      },
      gauge,
      peakGauge,
    },
    // An unpackaged Electron test may replace the production destination
    // validator with one that admits exactly its loopback fixture. Production
    // still uses the public-ArenaNet allowlist and grants no such exception.
    !app.isPackaged && process.env.GW_TEST_SOCKET_LOOPBACK === "1"
      ? (destination) => {
          if (destination !== "127.0.0.1:6112") {
            throw new Error(
              "test socket fixture permits only 127.0.0.1:6112",
            );
          }
          return { host: "127.0.0.1", port: 6112, family: 4 };
        }
      : undefined,
  );
}
