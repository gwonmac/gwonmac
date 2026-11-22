/**
 * The one place a failure becomes a sentence.
 *
 * The main process sends codes and never prose: it cannot see the UI, its
 * strings cannot be tested against what the player actually reads, and free
 * text on a channel is what let an error message reach the diagnostics export
 * in the first place. So every failure sentence the game window shows is
 * written here, beside the surface that shows it, and a unit test executes
 * this file.
 *
 * The maps are deliberately partial. Most of the catalogue names a fault in
 * something the player cannot act on, and inventing fifty sentences to say
 * "it broke" fifty ways would be worse than one honest default. A code earns
 * an entry only when it changes what the player should *do*.
 */

import type { SteamRefusalReason } from '../shared/contracts.js';
import type { ErrorCode } from '../shared/errors.js';

/**
 * A fatal snapshot read: the running client asked for game data that could
 * not be produced. The code arrives as a string tagged by the gw://app
 * response, so the lookup tolerates any value and lands on the default.
 */
const SNAPSHOT_READ: Partial<Record<ErrorCode, string>> = {
  chunk_offline:
    'No cached copy of the required game data is available while offline. Reconnect, then choose Retry.',
  net_offline:
    'This Mac appears to be offline, and this area of the game is not downloaded yet. Reconnect, then choose Retry.',
  http_status:
    'ArenaNet answered with a server error while fetching game data. This is usually temporary — choose Retry in a few minutes.',
  disk_full:
    'There is not enough free disk space to store game data. Free some space, then choose Retry.',
};

const SNAPSHOT_DEFAULT =
  'No cached copy of the required game data is available.';

export function describeSnapshotReadFailure(code: string | null): string {
  return (code && SNAPSHOT_READ[code as ErrorCode]) || SNAPSHOT_DEFAULT;
}

/**
 * A build template export that reached a folder and could not finish writing
 * into it. Nothing was taken away from the game, so every sentence here ends at
 * trying again rather than at recovering anything.
 */
const TEMPLATE_EXPORT_FAILURE: Partial<Record<ErrorCode, string>> = {
  disk_full:
    'There is not enough free disk space to write the build templates. Free some space, then choose Export Templates again.',
};

const TEMPLATE_EXPORT_DEFAULT =
  'The build templates could not be written to that folder. Your saved templates are unchanged — try a different folder.';

export function describeTemplateExportFailure(code: ErrorCode): string {
  return TEMPLATE_EXPORT_FAILURE[code] ?? TEMPLATE_EXPORT_DEFAULT;
}

/**
 * Why a Steam sign-in produced no login, shown as a transient line over the
 * client's own login screen. `null` for a plain cancel: the player closed the
 * window themselves and needs no explanation of their own action. One
 * sentence set for every other reason — the host cannot see inside ArenaNet's
 * flow, so pretending to distinguish them would be guessing.
 */
export function describeSteamRefusal(
  reason: SteamRefusalReason,
): string | null {
  if (reason === 'cancelled') return null;
  return (
    "Steam sign-in didn't complete — you can try again or use your " +
    'Guild Wars account. Steam sign-in needs a Steam account that is ' +
    'already linked to a Guild Wars account.'
  );
}

/**
 * Whether the failure is worth a bug report. Network and disk conditions are
 * the player's to fix — suggesting "Report a Bug" for them blames the app
 * for the Wi-Fi. Anything else might genuinely be ours.
 *
 * A locked Keychain belongs here for the same reason and `keychain_unentitled`
 * deliberately does not: that one says the installed application is signed
 * wrongly, which no player can fix and we want to hear about.
 */
const PLAYER_SIDE: ReadonlySet<string> = new Set<ErrorCode>([
  'net_offline',
  'http_status',
  'disk_full',
  'not_ready',
  'keychain_locked',
  'chunk_offline',
  'dns_failed',
  'dns_timeout',
  'dns_truncated',
  'dns_rcode',
  'dns_no_a',
  'dns_bad_reply',
]);

export function suggestReport(code: string): boolean {
  return !PLAYER_SIDE.has(code);
}

const REPORT_HINT = 'You can retry, or choose Help → Report a Bug.';

export interface MemoryPressurePresentation {
  label: string;
  detail: string;
  reloadButton: string;
  dismissButton: string;
  explanation: string;
}

/**
 * The game client's WASM heap is approaching this session's certified cap;
 * once it gets there the next big allocation kills the client wherever the
 * player happens to be standing. These sentences exist so the player spends
 * that death at a moment of their choosing.
 *
 * They state a condition and not a deadline, which is where they ended up
 * rather than where they started. "Running low" meant half an hour in the open
 * world and about two minutes in a mission, and a player could not tell which —
 * so the *thresholds* count in time now, and that is the fix. It is only the
 * printed figure that is gone, and a real crash bundle is why.
 *
 * Replayed against the Eye of the North session of 2026-08-04 — the player's
 * own `wasm.heapGrew` staircase, ending at exactly 2 GiB — the levels arrived
 * where they should: `low` with 31 minutes of real play left against the
 * shipped rule's 11, `critical` with 7. The figure did not. It read
 * 10 → 15 → 20 → 75 → 40 → 20 → 15 → 10 → 3, and at one point offered "about
 * 75 minutes" to a player with 18 left, because a quiet stretch sat in the
 * measurement window just before they went back into heavy loading.
 *
 * No rate can see a player about to zone into a dungeon. The estimate still
 * exists — the thresholds are computed from it and the log records it — but
 * it is a diagnostic, and a diagnostic printed on a
 * banner is a promise. The level is the part that survived contact with a
 * real session, so the level is the part the player is told.
 *
 * They state the reconnect rather than hedging it, which they did not always.
 * The uncertainty was never whether Guild Wars gives a player their instance
 * back after a dropped connection — it does — but whether *our* reload looks
 * like a dropped connection to its server. Tested 2026-08-05 across all five
 * reload paths this app can take, from inside an instance: every one came back
 * with progress intact, in under thirty seconds. That is the specific question
 * the hedge existed for, so the hedge is gone.
 *
 * The cap appears only in the inline details, where it is effective runtime
 * state rather than an inference from the saved opt-in.
 */
const MEMORY_RELOAD = 'Reload Guild Wars';
const MEMORY_DISMISS = 'Later';
const MEMORY_CLOSE = 'Close';

/** "1.4 of 2 GB used": what the game has reserved of this session's limit. */
export function memoryUsageCopy(usedBytes: number, capBytes: number): string {
  const gb = (bytes: number) => bytes / 1_073_741_824;
  const used = Math.max(0, gb(usedBytes));
  return `${used.toFixed(1)} of ${Math.max(1, Math.round(gb(capBytes)))} GB used`;
}

/**
 * The panel a player opens with Command-Q while memory is fine: the same surface and
 * actions as the warning, without the warning.
 */
export function memoryPanelCopy(capBytes: number): MemoryPressurePresentation {
  return {
    ...memoryWarningCopy('low', capBytes),
    label: 'Quit or reload Guild Wars?',
    detail: 'Reload restarts this account with fresh memory. Other accounts stay open.',
    dismissButton: MEMORY_CLOSE,
  };
}

export function memoryWarningCopy(
  level: 'low' | 'critical',
  capBytes: number,
): MemoryPressurePresentation {
  const critical = level === 'critical';
  const capGb = Math.max(1, Math.round(capBytes / 1_073_741_824));
  return {
    label: critical
      ? 'Guild Wars is almost out of memory.'
      : 'Guild Wars is running low on memory.',
    detail: critical
      ? 'Reload soon.'
      : 'Reload when convenient.',
    reloadButton: MEMORY_RELOAD,
    dismissButton: MEMORY_DISMISS,
    explanation:
      `This session can use up to ${capGb} GB. Reloading starts Guild Wars `
      + 'with fresh memory. With automatic return enabled, gwonmac signs in '
      + 'and returns to the selected character.',
  };
}

/**
 * The quiet second line under a failure: the report hint when the fault may
 * be ours, and always the raw code — it costs the player nothing and makes
 * every bug report specific.
 */
export function failureDetail(code?: string | null): string {
  if (!code) return REPORT_HINT;
  const footer = `Error code: ${code}`;
  return suggestReport(code) ? `${REPORT_HINT} · ${footer}` : footer;
}
