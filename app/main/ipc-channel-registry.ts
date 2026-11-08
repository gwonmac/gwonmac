/**
 * Owns typed, authorized registration for every renderer-to-main invoke.
 *
 * A handler pairs the parser that turns one invoke's arguments into the
 * declared argument tuple with the function that answers it. `Handlers<Table>`
 * ties both to a channel table (app/shared/ipc/), so a parser that produces
 * other arguments, or a handler that answers another result shape, is a type
 * error. Owners return their channels as parts; `ownedOnce` proves at compile
 * time that every channel of a table has exactly one owner. `BOUNDARIES` binds
 * each boundary to its window role and tables once, so a part registers by
 * boundary name and cannot pair a role with another role's table. This
 * boundary proves the sender once, for every channel, and reports refused
 * arguments.
 */
import { ipcMain, type BrowserWindow } from "electron";
import type {
  ArgsOf,
  ChannelTable,
  EventSpec,
  InvokeKey,
  ResultOf,
  UnionToIntersection,
} from "../shared/ipc/channel-table.js";
import { GAME_CHANNELS } from "../shared/ipc/game.js";
import { LAUNCHER_CHANNELS } from "../shared/ipc/launcher.js";
import { TOOL_CONTRACTS } from "../shared/ipc/tools.js";
import { AllowlistError, errorCode } from "../shared/errors.js";
import { logEvent } from "./diagnostics.js";
import { invokeChannel } from "./diagnostics/schema-fields.js";
import {
  isLauncherRendererUrl,
  isCanonicalRendererUrl,
} from "./core/renderer-trust.js";
import type { Parser } from "./ipc-values.js";
import type { WindowRegistry } from "./window-registry.js";

/** One channel's parser and answer; built only by `channel()`. */
export interface ChannelDef<Args extends readonly unknown[], Result> {
  readonly parse: Parser<Args>;
  /** Parses `values`, reports a refusal through `refused`, then answers. */
  readonly answer: (
    win: BrowserWindow,
    values: readonly unknown[],
    refused: (error: unknown) => void,
  ) => Result | Promise<Result>;
}

// Not an inference site, so `channel()` takes its argument tuple from the
// parser alone; a handler that ignores its arguments cannot widen it.
type FromParser<Args> = Args extends unknown ? Args : never;

/**
 * Pairs a parser with the handler that receives exactly what it produced. The
 * parser may produce a narrower tuple than the table declares; the handler
 * then sees the narrower one.
 */
export function channel<Args extends readonly unknown[], Result>(
  parse: Parser<Args>,
  run: (win: BrowserWindow, ...args: FromParser<Args>) => Result | Promise<Result>,
): ChannelDef<Args, Result> {
  return {
    parse,
    answer: (win, values, refused) => {
      let args: Args;
      try {
        args = parse(values);
      } catch (error) {
        refused(error);
        throw error;
      }
      return run(win, ...args);
    },
  };
}

/** What answers one table entry: its declared arguments in, its declared result out. */
export type HandlerFor<Spec> = ChannelDef<ArgsOf<Spec>, ResultOf<Spec>>;

/** One handler per channel main answers in `Table`. */
export type Handlers<Table extends ChannelTable> = {
  readonly [Key in InvokeKey<Table>]: HandlerFor<Table[Key]>;
};

/** The channels one owner answers: any subset of a table, each correctly typed. */
export type HandlersPart<Table extends ChannelTable> = Readonly<Partial<Handlers<Table>>>;

type KeysOf<Part> = Part extends Readonly<{ channels: infer Channels }> ? keyof Channels & string : never;

/** The keys two or more of the key sets name. */
type Overlap<KeySets extends readonly unknown[], Seen extends string = never> =
  KeySets extends readonly [infer Head extends string, ...infer Tail]
    ? (Head & Seen) | Overlap<Tail, Seen | Head>
    : never;

/**
 * `unknown` when the key sets cover every `Key` exactly once; otherwise an
 * object type naming the unowned or doubly owned channels, which the call
 * that receives the parts cannot satisfy.
 */
export type OwnershipError<Key extends string, KeySets extends readonly string[]> =
  [Exclude<Key, KeySets[number]>] extends [never]
    ? [Overlap<KeySets>] extends [never]
      ? unknown
      : { channelsOwnedTwice: Overlap<KeySets> }
    : { unownedChannels: Exclude<Key, KeySets[number]> };

/**
 * Accepts a list of parts only when every channel in `Key` is answered by
 * exactly one of them; otherwise the call names the unowned or doubly owned
 * channels in its type error.
 */
export const ownedOnce = <Key extends string>() =>
  <const Parts extends readonly Readonly<{ channels: object }>[]>(
    parts: Parts & OwnershipError<Key, { [Index in keyof Parts]: KeysOf<Parts[Index]> }>,
  ): Parts => parts;

/** The window role that may call a boundary's channels. */
export type ChannelRole = "game" | "launcher";

/**
 * Each boundary's window role and channel tables, declared once. Tools
 * channels answer the game window; their table is the composition of every
 * Tool's contract.
 */
const BOUNDARIES = {
  game: { role: "game", tables: [GAME_CHANNELS] },
  launcher: { role: "launcher", tables: [LAUNCHER_CHANNELS] },
  tools: { role: "game", tables: TOOL_CONTRACTS.map((contract) => contract.channels) },
} as const satisfies Readonly<Record<string, Readonly<{ role: ChannelRole; tables: readonly ChannelTable[] }>>>;

export type ChannelBoundary = keyof typeof BOUNDARIES;
/** The one table a boundary answers. */
export type BoundaryTable<Boundary extends ChannelBoundary> =
  Extract<UnionToIntersection<(typeof BOUNDARIES)[Boundary]["tables"][number]>, ChannelTable>;

// The launcher window has no diagnostic owner; a rejection reaches its renderer.
const REJECTED: Readonly<Record<ChannelRole, (windows: WindowRegistry, win: BrowserWindow, key: string, error: unknown) => void>> = {
  game: (windows, win, key, error) => {
    if (!invokeChannel(key)) return;
    logEvent(
      { k: "ipc.rejected", channel: key, code: errorCode(error) },
      windows.requireDiagnosticOwnerForWindow(win),
    );
  },
  launcher: () => undefined,
};

/** A handler with its types already checked against its table entry. */
type RegisteredHandler = Readonly<{
  answer: (win: BrowserWindow, values: readonly unknown[], refused: (error: unknown) => void) => unknown;
}>;

/** A part's keys that its boundary's table does not answer; each must be absent. */
type OnlyBoundaryKeys<Part, Table extends ChannelTable> = {
  readonly [Key in Exclude<keyof Part, InvokeKey<Table>>]: never;
};

/**
 * Registers the handlers one part returned, for the windows of its boundary's
 * role. The table comes from the boundary, so a handler for a channel the
 * boundary does not answer is a type error.
 */
export function register<Boundary extends ChannelBoundary, Part extends object>(
  windows: WindowRegistry,
  boundary: Boundary,
  // `Part` is inferred unconstrained so a part built elsewhere keeps its own
  // keys; a constrained one would fall back to the table and hide them.
  handlers: Part & HandlersPart<BoundaryTable<Boundary>> & OnlyBoundaryKeys<Part, BoundaryTable<Boundary>>,
): void {
  const { role, tables } = BOUNDARIES[boundary];
  const specs: readonly ChannelTable[] = tables;
  const answers: Readonly<Record<string, RegisteredHandler | undefined>> = handlers;
  for (const [key, handler] of Object.entries(answers)) {
    const spec = specs.map((table) => table[key]).find((entry) => entry !== undefined);
    if (!handler || spec?.kind !== "invoke") throw new Error(`${key} is not an invoke channel of ${boundary}`);
    ipcMain.handle(spec.channel, async (event, ...args: unknown[]) => {
      const win = assertSender(windows, event, role);
      return handler.answer(win, args, (error) => REJECTED[role](windows, win, key, error));
    });
  }
}

/** Sends one table event to a window that is still alive; false when it is gone. */
export function emit<Payload extends readonly unknown[]>(
  win: BrowserWindow,
  spec: EventSpec<Payload>,
  ...payload: Payload
): boolean {
  if (win.isDestroyed() || win.webContents.isDestroyed()) return false;
  try {
    win.webContents.send(spec.channel, ...payload);
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
