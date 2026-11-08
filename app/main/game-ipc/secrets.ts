/**
 * The game window's secret channels: the saved login and the Steam token, both
 * per profile. Quit waits for every secret operation in flight (`drain`), and
 * none starts once the app is quitting.
 */
import type { BrowserWindow } from "electron";
import type { SteamTokenResult } from "../../shared/contracts.js";
import { errorCode, ValidationError } from "../../shared/errors.js";
import type { GameChannels } from "../../shared/ipc/game.js";
import { parseCredentials } from "../core/credentials.js";
import { STEAM_OAUTH } from "../core/steam-oauth.js";
import {
  MAX_TOKEN_LENGTH,
  SteamSessionCoordinator,
  type SteamSessionStore,
  type SteamTokenAcquisition,
  steamTokenOutcome,
} from "../core/steam-session.js";
import { logEvent } from "../diagnostics.js";
import { channel, type HandlersPart } from "../ipc-channel-registry.js";
import { args, nothing, one } from "../ipc-values.js";
import { isQuitting } from "../lifecycle.js";
import {
  acquireSteamToken,
  type SteamAcquireEvent,
  type SteamAcquireResult,
} from "../steam-acquire.js";
import type { WindowRegistry } from "../window-registry.js";
import type { GameIpcInput } from "./part.js";

const asSilentFlag = one((value: unknown): boolean => {
  if (typeof value !== "boolean") throw new ValidationError("silent must be a boolean");
  return value;
});

/**
 * The client's storeback. An empty or wrong-shaped token is *not* refused here:
 * `refreshSteamExpiry` ignores anything that is not the token already held, and
 * ignoring is the documented outcome rather than an error the client has
 * to handle. Only genuinely malformed arguments are rejected.
 */
const asSteamStoreback = args(2, ([token, expiry]): [token: string, expiry: number | null] => {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) {
    throw new ValidationError("steam token must be a string");
  }
  if (expiry !== null && (typeof expiry !== "number" || !Number.isFinite(expiry))) {
    throw new ValidationError("steam token expiry must be a finite number or null");
  }
  return [token, expiry];
});

export type AcquireSteamToken = (
  parent: BrowserWindow,
  record: (event: SteamAcquireEvent) => void,
) => Promise<SteamAcquireResult>;

/**
 * The Steam token channels over one store resolver. Exported apart from the
 * part so tests/electron can answer them with a fixture sign-in and store.
 */
export function steamChannels(
  acquire: AcquireSteamToken,
  storeFor: (win: BrowserWindow) => SteamSessionStore,
  windows: WindowRegistry,
) {
  const coordinators = new Map<SteamSessionStore, SteamSessionCoordinator>();
  const coordinatorFor = (win: BrowserWindow): SteamSessionCoordinator => {
    const store = storeFor(win);
    let coordinator = coordinators.get(store);
    if (!coordinator) {
      coordinator = new SteamSessionCoordinator(store);
      coordinators.set(store, coordinator);
    }
    return coordinator;
  };

  const runSteamSignIn = async (
    win: BrowserWindow,
    ownerId: number,
  ): Promise<SteamTokenAcquisition> => {
    const result = await acquire(win, (event) => {
      if (event.k === "opened") {
        logEvent({ k: "steam.signInOpened" }, ownerId);
      }
      if (event.k === "blocked") {
        logEvent(
          { k: "steam.signInBlocked", what: event.what },
          ownerId,
        );
      }
      if (event.k === "settled") {
        logEvent(
          { k: "steam.signInResult", outcome: event.outcome },
          ownerId,
        );
      }
    });
    // The reason survives to the renderer: a player whose sign-in failed used
    // to land back on the login screen with no explanation at all.
    return result.ok
      ? { token: result.token }
      : { token: null, refusal: result.reason };
  };

  return {
    channels: {
      // The seam that may open a Steam window — and only for a non-silent
      // request. It answers `null` rather than throwing, because the client
      // rebuilds its own login screen from a refused credential and a rejection
      // here would only turn "no token" into a launch failure.
      steamToken: channel(asSilentFlag, async (win, silent): Promise<SteamTokenResult> => {
        const steam = coordinatorFor(win);
        const ownerId = windows.requireDiagnosticOwnerForWindow(win);
        if (isQuitting()) throw new ValidationError("application is quitting");
        const resolution = await steam.resolve({
          silent,
          acquire: () => runSteamSignIn(win, ownerId),
        });
        for (const note of resolution.notes) {
          if (note.note === "loadFailed") {
            logEvent(
              { k: "steam.tokenLoadFailed", code: note.code },
              ownerId,
            );
          }
          if (note.note === "expired") {
            logEvent({ k: "steam.tokenExpired" }, ownerId);
          }
          if (note.note === "storeFailed") {
            logEvent(
              { k: "steam.tokenStoreFailed", code: note.code },
              ownerId,
            );
          }
          if (note.note === "acquireFailed") {
            logEvent(
              { k: "steam.signInResult", outcome: "failed" },
              ownerId,
            );
          }
        }
        logEvent({ k: "steam.tokenRequested",
          outcome: steamTokenOutcome(resolution),
          silent,
        }, ownerId);
        if (resolution.token) return { token: resolution.token };
        if (resolution.refusal) return { token: null, reason: resolution.refusal };
        return { token: null };
      }),

      steamStore: channel(asSteamStoreback, async (win, token, expiry) => {
        if (isQuitting()) throw new ValidationError("application is quitting");
        const steam = coordinatorFor(win);
        const ownerId = windows.requireDiagnosticOwnerForWindow(win);
        const outcome = await steam.refresh(token, expiry);
        logEvent({ k: "steam.storeback", outcome }, ownerId);
      }),

      steamClear: channel(nothing, async (win) => {
        if (isQuitting()) throw new ValidationError("application is quitting");
        const steam = coordinatorFor(win);
        const ownerId = windows.requireDiagnosticOwnerForWindow(win);
        try {
          await steam.clear();
          logEvent({ k: "steam.tokenCleared" }, ownerId);
        } catch (error) {
          logEvent(
            { k: "steam.tokenClearFailed", code: errorCode(error) },
            ownerId,
          );
          throw error;
        }
      }),
    } satisfies HandlersPart<GameChannels>,
    /** Waits until no Steam operation is in flight. */
    settled: async (): Promise<void> => {
      await Promise.all([...coordinators.values()].map((steam) => steam.settled()));
    },
  };
}

export default ({ accounts, windows }: GameIpcInput) => {
  const operations = new Set<Promise<unknown>>();
  const secretOperation = <T>(operation: () => Promise<T>): Promise<T> => {
    if (isQuitting()) {
      return Promise.reject(new ValidationError("application is quitting"));
    }
    const pending = operation();
    operations.add(pending);
    void pending.then(
      () => operations.delete(pending),
      () => operations.delete(pending),
    );
    return pending;
  };
  const steam = steamChannels(
    (parent, record) => acquireSteamToken(STEAM_OAUTH, { parent, record }),
    (win) => accounts.steamSessionStoreFor(win),
    windows,
  );
  return {
    channels: {
      credentialsLoad: channel(nothing, async (win) => {
        const ownerId = windows.requireDiagnosticOwnerForWindow(win);
        try {
          return await secretOperation(() => accounts.credentialsStoreFor(win).load());
        } catch (error) {
          logEvent({ k: "credentials.loadFailed", code: errorCode(error) }, ownerId);
          throw error;
        }
      }),

      // The store checks the same rule again on its own file; `parseCredentials`
      // is that rule, so the boundary is validated without a second opinion.
      credentialsSave: channel(one(parseCredentials), async (win, value) => {
        const ownerId = windows.requireDiagnosticOwnerForWindow(win);
        try {
          await secretOperation(() => accounts.credentialsStoreFor(win).save(value));
        } catch (error) {
          logEvent({ k: "credentials.saveFailed", code: errorCode(error) }, ownerId);
          throw error;
        }
      }),

      credentialsClear: channel(nothing, async (win) => {
        const ownerId = windows.requireDiagnosticOwnerForWindow(win);
        try {
          await secretOperation(() => accounts.credentialsStoreFor(win).clear());
        } catch (error) {
          logEvent({ k: "credentials.clearFailed", code: errorCode(error) }, ownerId);
          throw error;
        }
      }),
      ...steam.channels,
    } satisfies HandlersPart<GameChannels>,
    /** Quit waits here until no saved-login or Steam operation is in flight. */
    async drain(): Promise<void> {
      await steam.settled();
      while (operations.size > 0) {
        await Promise.allSettled([...operations]);
      }
    },
  };
};
