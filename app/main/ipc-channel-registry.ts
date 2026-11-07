/**
 * Owns typed, authorized registration for every renderer-to-main invoke.
 * Channel handlers provide validation and behavior; this boundary proves the
 * sender and reports refused arguments.
 */
import { ipcMain, type BrowserWindow } from "electron";
import { IPC, type InvokeChannel } from "../shared/contracts.js";
import { AllowlistError, errorCode } from "../shared/errors.js";
import { LAUNCHER_IPC, type LauncherInvokeChannel } from "../shared/launcher-contracts.js";
import { logEvent } from "./diagnostics.js";
import {
  isLauncherRendererUrl,
  isCanonicalRendererUrl,
} from "./core/renderer-trust.js";
import type { Parser } from "./ipc-values.js";
import type { WindowRegistry } from "./window-registry.js";

type Run<In, Out> = (win: BrowserWindow, input: In) => Out | Promise<Out>;

export interface ChannelDef<In, Out> {
  readonly parse: Parser<In>;
  readonly run: Run<In, Out>;
}

/** Erases the invariant input type only after `channel()` checked the pair. */
export interface AnyChannelDef {
  readonly parse: Parser<unknown>;
  readonly run: Run<never, unknown>;
}

export function channel<In, Out>(
  parse: Parser<In>,
  run: Run<In, Out>,
): ChannelDef<In, Out> {
  return { parse, run };
}

/** The window role that may call a boundary's channels. */
export type ChannelRole = "game" | "launcher";

interface RoleChannel {
  readonly game: InvokeChannel;
  readonly launcher: LauncherInvokeChannel;
}

interface Boundary<Key extends string> {
  readonly names: Readonly<Record<Key, string>>;
  readonly rejected: (windows: WindowRegistry, win: BrowserWindow, channel: Key, error: unknown) => void;
}

const BOUNDARIES: { readonly [Role in ChannelRole]: Boundary<RoleChannel[Role]> } = {
  game: {
    names: IPC,
    rejected: (windows, win, channelName, error) => logEvent(
      { k: "ipc.rejected", channel: channelName, code: errorCode(error) },
      windows.requireDiagnosticOwnerForWindow(win),
    ),
  },
  // The launcher window has no diagnostic owner; the rejection reaches its renderer.
  launcher: { names: LAUNCHER_IPC, rejected: () => undefined },
};

/**
 * Registers handlers for one window role. A boundary that owns every channel
 * of its role states that with `satisfies Record<…InvokeChannel, AnyChannelDef>`
 * at the call site, so a missing handler is a build error.
 */
export function register<Role extends ChannelRole>(
  windows: WindowRegistry,
  role: Role,
  handlers: Readonly<Partial<Record<RoleChannel[Role], AnyChannelDef>>>,
): void {
  const boundary = BOUNDARIES[role];
  for (const [key, definition] of Object.entries(handlers) as [RoleChannel[Role], AnyChannelDef][]) {
    const def = definition as ChannelDef<unknown, unknown>;
    ipcMain.handle(boundary.names[key], async (event, ...args: unknown[]) => {
      const win = assertSender(windows, event, role);
      let input: unknown;
      try {
        input = def.parse(args);
      } catch (error) {
        boundary.rejected(windows, win, key, error);
        throw error;
      }
      return def.run(win, input);
    });
  }
}

export function sendIfLive(
  win: BrowserWindow,
  channelName: string,
  value: unknown,
): boolean {
  if (win.isDestroyed() || win.webContents.isDestroyed()) return false;
  try {
    win.webContents.send(channelName, value);
    return true;
  } catch {
    return false;
  }
}

function assertSender(
  registry: WindowRegistry,
  event: Electron.IpcMainInvokeEvent,
  role: ChannelRole,
): BrowserWindow {
  const win = registry.windowForWebContents(event.sender.id);
  const context = registry.contextForWebContents(event.sender.id);
  if (!win || !context || context.role !== role) {
    throw new AllowlistError("unowned ipc sender");
  }
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new AllowlistError("ipc sender is not the main frame");
  }
  const trusted = context.role === "launcher"
    ? isLauncherRendererUrl(event.senderFrame.url)
    : isCanonicalRendererUrl(event.senderFrame.url);
  if (!trusted) throw new AllowlistError("invalid ipc origin");
  return win;
}
