/**
 * Compile-time proofs for the channel tables (app/shared/ipc/). `pnpm
 * typecheck` checks this file through tsconfig.tests.json; every
 * `@ts-expect-error` below is a mismatch between main and a preload that must
 * stay a type error, and an unused one fails the check. Nothing here runs:
 * main's registry imports Electron, so the proofs take its builders as types.
 */
import type { channel, HandlersPart, ownedOnce } from "../../app/main/ipc-channel-registry.ts";
import type { Parser } from "../../app/main/ipc-values.ts";
import type { AppSettings } from "../../app/shared/settings/index.ts";
import type { Invoker } from "../../app/shared/ipc/channel-table.ts";
import type { GameChannels } from "../../app/shared/ipc/game.ts";
import type { LauncherChannels } from "../../app/shared/ipc/launcher.ts";

export function _channelTableProofs(
  define: typeof channel,
  owned: typeof ownedOnce,
  invokeGame: Invoker<GameChannels>,
  invokeLauncher: Invoker<LauncherChannels>,
  storeback: Parser<[token: string, expiry: number | null]>,
  swapped: Parser<[expiry: number | null, token: string]>,
  silent: Parser<[silent: boolean]>,
  none: Parser<[]>,
): void {
  // Main: a handler is checked against its table entry, both ways.
  void ({ steamStore: define(storeback, async () => undefined) } satisfies HandlersPart<GameChannels>);
  // @ts-expect-error a parser that produces the arguments swapped cannot answer steamStore.
  void ({ steamStore: define(swapped, async () => undefined) } satisfies HandlersPart<GameChannels>);
  // @ts-expect-error steamToken answers a SteamTokenResult, not a bare token.
  void ({ steamToken: define(silent, async () => "token") } satisfies HandlersPart<GameChannels>);
  // @ts-expect-error the handler receives what the parser produced, in its order.
  void define(storeback, async (win, expiry: number | null, token: string) => void [win, expiry, token]);

  // Main: every invoke channel of a table has exactly one owner.
  const store = { channels: { steamStore: define(storeback, async () => undefined) } };
  const clear = { channels: { steamClear: define(none, async () => undefined) } };
  void owned<"steamStore" | "steamClear">()([store, clear]);
  // @ts-expect-error steamClear has no owner.
  void owned<"steamStore" | "steamClear">()([store]);
  // @ts-expect-error steamStore has two owners.
  void owned<"steamStore" | "steamClear">()([store, clear, store]);

  // Preload: the typed invoke takes the declared arguments and answers the declared result.
  void invokeGame("steamStore", "token", null);
  // @ts-expect-error steamStore takes (token, expiry), not (expiry, token).
  void invokeGame("steamStore", null, "token");
  const settings: Promise<AppSettings> = invokeGame("settingsGet");
  // @ts-expect-error settingsGet answers AppSettings, not a string.
  const wrongResult: Promise<string> = invokeGame("settingsGet");
  // @ts-expect-error the launcher window has no game channels.
  void invokeLauncher("steamStore", "token", null);
  void [settings, wrongResult];
}
