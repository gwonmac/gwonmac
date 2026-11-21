/**
 * Decides which login providers the official client is told exist.
 *
 * The client asks the host once per provider each time it builds its login screen. Answering
 * yes for Steam makes the client build that screen around a provider chooser, and the password
 * field then has browser focus without the game drawing its caret. A player who does not use
 * Steam can therefore turn **Disable Steam login** on: every provider is then answered no and
 * the client shows only the ArenaNet email and password form.
 */
import type { AppSettings } from "./settings/index.js";

/**
 * The one federated provider the host can sign in with. The client probes Apple and Google
 * too; neither has an acquisition surface here, so both are answered no.
 */
const STEAM_PROVIDER = "steam";

/** Whether the client is told that `name` is a login provider, and may ask it for a token. */
export function offersLoginProvider(
  name: unknown,
  settings: Pick<AppSettings, "disableSteamLogin"> | null,
): boolean {
  return settings?.disableSteamLogin !== true && typeof name === "string" && name.toLowerCase() === STEAM_PROVIDER;
}
