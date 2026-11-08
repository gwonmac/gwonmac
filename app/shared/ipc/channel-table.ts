/**
 * The kernel every IPC channel table is declared with. One table entry names a
 * channel string once, together with its argument tuple and result (or event
 * payload); the preload's typed `invoke` and main's handler record both derive
 * their types from that entry, so an argument-order or result-shape mismatch
 * between the two sides is a type error.
 *
 * The argument and result types are phantom: they exist only for the checker,
 * and at run time an entry is `{ kind, channel }`: the `~`-prefixed fields are
 * never set. Values only, no Electron.
 */

/** Renderer to main, answered with a result (`ipcRenderer.invoke`). */
export type InvokeSpec<Args extends readonly unknown[], Result> = Readonly<{
  kind: "invoke";
  channel: string;
  "~args"?: Args;
  "~result"?: Result;
}>;

/** Main to renderer (`webContents.send`), carrying `Payload` as its arguments. */
export type EventSpec<Payload extends readonly unknown[]> = Readonly<{
  kind: "event";
  channel: string;
  "~payload"?: Payload;
}>;

/** Renderer to main without an answer (`ipcRenderer.send`). */
export type SendSpec<Args extends readonly unknown[]> = Readonly<{
  kind: "send";
  channel: string;
  "~args"?: Args;
}>;

type AnyInvokeSpec = InvokeSpec<readonly unknown[], unknown>;
type AnySpec = AnyInvokeSpec | EventSpec<readonly unknown[]> | SendSpec<readonly unknown[]>;

/** A table of channels keyed by the name both sides use in code. */
export type ChannelTable = Readonly<Record<string, AnySpec>>;

export const invoke = <Args extends readonly unknown[], Result>(
  channel: string,
): InvokeSpec<Args, Result> => ({ kind: "invoke", channel });

export const event = <Payload extends readonly unknown[]>(
  channel: string,
): EventSpec<Payload> => ({ kind: "event", channel });

export const send = <Args extends readonly unknown[]>(
  channel: string,
): SendSpec<Args> => ({ kind: "send", channel });

type KeysOfKind<Table extends ChannelTable, Kind extends AnySpec["kind"]> = {
  [Key in keyof Table]: Table[Key]["kind"] extends Kind ? Key : never
}[keyof Table] & string;

/** The channels main answers with `ipcMain.handle`. */
export type InvokeKey<Table extends ChannelTable> = KeysOfKind<Table, "invoke">;
export type EventKey<Table extends ChannelTable> = KeysOfKind<Table, "event">;

export type ArgsOf<Spec> = Spec extends InvokeSpec<infer Args, unknown> ? Args : never;
export type ResultOf<Spec> = Spec extends InvokeSpec<readonly unknown[], infer Result> ? Result : never;
export type PayloadOf<Spec> = Spec extends EventSpec<infer Payload> ? Payload : never;

/** The renderer-facing method a preload exposes for one invoke entry. */
export type Invoke<Spec extends AnyInvokeSpec> = (...args: ArgsOf<Spec>) => Promise<ResultOf<Spec>>;

/** The renderer-facing subscription for a one-value event entry. */
export type Subscribe<Spec extends EventSpec<readonly [unknown]>> = (
  callback: (value: PayloadOf<Spec>[0]) => void,
) => () => void;

/** The preload's typed `ipcRenderer.invoke` over one table. */
export type Invoker<Table extends ChannelTable> = <Key extends InvokeKey<Table>>(
  key: Key,
  ...args: ArgsOf<Table[Key]>
) => Promise<ResultOf<Table[Key]>>;

/** The preload's typed `ipcRenderer.on` for one-value events of one table. */
export type Listener<Table extends ChannelTable> = <Key extends EventKey<Table>>(
  key: Key,
  callback: (value: PayloadOf<Table[Key]>[0]) => void,
) => () => void;

/**
 * What a preload hands a channel contract so it can build its namespace
 * without importing Electron: a typed invoker and listener for any table.
 */
export interface IpcBridge {
  invoker<Table extends ChannelTable>(table: Table): Invoker<Table>;
  listener<Table extends ChannelTable>(table: Table): Listener<Table>;
}

/**
 * A Tool's slice of the game window's IPC: its channel table and the
 * `window.gwNative` namespaces the Tools preload builds from it. Declared in
 * the feature's own `shared/ipc.ts`; app/shared/ipc/tools.ts composes them.
 */
export type ToolContract<Table extends ChannelTable, Api extends object> = Readonly<{
  channels: Table;
  expose(bridge: IpcBridge): Api;
}>;

export const toolContract = <const Table extends ChannelTable, Api extends object>(
  channels: Table,
  expose: (invoke: Invoker<Table>, listen: Listener<Table>) => Api,
): ToolContract<Table, Api> => ({
  channels,
  expose: (bridge) => expose(bridge.invoker(channels), bridge.listener(channels)),
});

/** The keys of the `invoke` entries of a table. */
export const invokeKeys = <Table extends ChannelTable>(table: Table): readonly InvokeKey<Table>[] =>
  Object.keys(table).filter((key): key is InvokeKey<Table> => table[key]?.kind === "invoke");
