/**
 * Owns which login providers the official client is told exist.
 *
 * The client asks once per provider each time it builds its login screen. A yes
 * for Steam makes it build that screen around a provider chooser. A player who
 * never signs in through Steam can turn **Disable Steam login** on: every
 * provider is then answered no, and the client shows only the ArenaNet email and
 * password form.
 */
import type { AppSettings } from "../shared/settings/index.js";

/**
 * The one federated provider this host can sign in with. The client probes Apple
 * and Google too; neither has an acquisition surface here, so both are answered
 * no rather than advertised and then failed.
 */
const STEAM_PROVIDER = "steam";

/** Whether the client is told that `name` is a login provider and may ask it for a token. */
export function offersLoginProvider(
  name: unknown,
  settings: Pick<AppSettings, "disableSteamLogin"> | null,
): boolean {
  return settings?.disableSteamLogin !== true
    && typeof name === "string" && name.toLowerCase() === STEAM_PROVIDER;
}
