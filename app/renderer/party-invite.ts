/**
 * Owns the player-requested party invite and the Travel-then-invite sequence.
 * The certified chat mailbox sends the invite; this owner only decides when a
 * request is allowed and waits for a fresh outpost arrival of the same
 * character (`game.session`) before inviting.
 */
import type { TravelFriend } from '../shared/friends.js';
import { isPvpTravelDestination, travelDestination } from '../shared/travel.js';
import type { CompanionPlayRegionState } from './companion-play-region-snapshot.js';
import type { Block, GameSession } from './game-blocks.js';

type PartyInviteInput = Readonly<{
  region(): CompanionPlayRegionState;
  subscribeRegion(listener: () => void): () => void;
  /** The character in the game (`game.session`); the invite after Travel goes only from the same one. */
  session: Block<GameSession | null>;
  /** The whisper tool owns the chat mailbox that also carries invites. */
  chatReady(): boolean;
  invite(name: string): Promise<void>;
  /** Starts the trip; `failed` hears if it fails after it started, with Travel's message. */
  travel: ((friend: TravelFriend, generation: number, failed: (message: string) => void) => Promise<void>) | null;
  /** Guild Wars refuses an invite sent while the arriving party is still forming. */
  settleMs?: number;
  arrivalTimeoutMs?: number;
}>;

export type PartyInvite = ReturnType<typeof createPartyInvite>;

const inOutpost = (region: CompanionPlayRegionState) =>
  region.status === 'ready' && region.playRegion === 'pve' && region.instanceType === 0;
const NEEDS_PVE = 'Invites from Hub need a PvE outpost';

export function createPartyInvite(input: PartyInviteInput) {
  const settleMs = input.settleMs ?? 2_000;
  const arrivalTimeoutMs = input.arrivalTimeoutMs ?? 60_000;
  /** Withdraws the one pending arrival; null while nothing waits. */
  let pending: { details: Readonly<{ name: string; place: string }>; cancelled: boolean; cancel(): void } | null = null;
  const listeners = new Set<() => void>();
  const refresh = () => { for (const listener of listeners) listener(); };
  const travelling = () => pending ? `Travelling to ${pending.details.place}. The invite to ${pending.details.name} follows on arrival.` : null;
  function cancel(expected?: Readonly<{ name: string; place: string }>) {
    const request = pending;
    if (expected && request?.details !== expected) throw new Error('This pending invite changed. Select it again.');
    if (!request) return;
    request.cancelled = true; request.cancel(); pending = null; refresh();
  }
  /**
   * Why an invite cannot be sent now. A friend elsewhere cannot receive it from here;
   * the reason points to Travel and invite only when the caller offers that action.
   */
  function unavailable(friend?: TravelFriend, travelOffered = false): string | null {
    const region = input.region();
    if (pending) return travelling();
    if (!inOutpost(region)) return 'Invite players from an outpost';
    if (!input.chatReady()) return 'Guild Wars chat is not ready';
    if (friend && region.status === 'ready' && friend.mapId !== region.mapId) {
      const place = travelDestination(friend.mapId)?.name ?? 'another map';
      return `${friend.character || friend.alias} is in ${place}.${travelOffered ? ' Use Travel and invite.' : ''}`;
    }
    return null;
  }
  function travelUnavailable(friend: TravelFriend): string | null {
    const region = input.region();
    if (!input.travel) return 'Travel is unavailable';
    if (isPvpTravelDestination(friend.mapId)) return NEEDS_PVE;
    if (region.status === 'ready' && region.mapId === friend.mapId) return 'You are already in this outpost';
    return travelling();
  }

  /**
   * Resolves on a settled, ready PvE outpost of `mapId` for the same character:
   * `game.session` says when the account or character changed, and a session
   * that ends refuses. While a known character key reads as none (a relogged
   * character before its key arrives) the arrival waits, so a relog never sends
   * the invite.
   */
  function arrival(mapId: number, characterKey: string | null) {
    let cancel = () => {};
    let fail = (_error: Error) => {};
    const promise = new Promise<void>((resolve, reject) => {
      let keyed = characterKey !== null;
      let started: number | null | undefined;
      let finished = false;
      let settle: ReturnType<typeof setTimeout> | null = null;
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        stopSession(); unsubscribe(); clearTimeout(timeout); if (settle) clearTimeout(settle);
        if (error) reject(error); else resolve();
      };
      fail = finish;
      cancel = () => finish(new Error('Travel and invite stopped. The invite was not sent.'));
      // A session that starts while none was known yet is this character's first one.
      const stopSession = input.session.subscribe(next => {
        const id = next?.id ?? null;
        if (started !== undefined && started !== null && id !== started) finish(new Error('The character changed. The invite was not sent.'));
        else started = id;
      });
      const check = () => {
        const region = input.region();
        if (region.status === 'ready') keyed ||= region.characterKey !== null;
        if (region.status === 'ready' && region.mapId === mapId && !inOutpost(region)) {
          finish(new Error(`${NEEDS_PVE}. The invite was not sent.`)); return;
        }
        const arrived = region.status === 'ready' && region.mapId === mapId && (region.characterKey !== null || !keyed)
          && input.chatReady();
        if (arrived && !settle) settle = setTimeout(() => finish(), settleMs);
        else if (!arrived && settle) { clearTimeout(settle); settle = null; }
      };
      const unsubscribe = input.subscribeRegion(check);
      const timeout = setTimeout(() => finish(new Error('Travel did not finish. The invite was not sent.')), arrivalTimeoutMs);
    });
    promise.catch(() => {});
    return { promise, cancel, fail };
  }
  function invite(name: string, friend?: TravelFriend): Promise<void> {
    const reason = unavailable(friend);
    return reason ? Promise.reject(new Error(reason)) : input.invite(name);
  }

  return {
    get pending() { return pending?.details ?? null; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancel,
    unavailable,
    /** Why Travel and invite cannot start now, or null. */
    travelUnavailable,
    invite,
    /**
     * Starts Travel to the friend's outpost (any district). Refusals before
     * departure throw; `invited` settles once the arrival invite was sent or
     * withdrawn. The invite is sent once and never retried.
     */
    async travelAndInvite(friend: TravelFriend, generation: number): Promise<{ invited: Promise<void> }> {
      const travel = input.travel;
      const refusal = travelUnavailable(friend);
      if (refusal || !travel) throw new Error(refusal ?? 'Travel is unavailable');
      const region = input.region();
      if (region.status !== 'ready') throw new Error('Wait for Guild Wars to finish loading');
      const name = friend.character;
      if (!name) throw new Error('This friend is offline');
      const arrived = arrival(friend.mapId, region.characterKey);
      const request = { details: Object.freeze({ name, place: travelDestination(friend.mapId)?.name ?? 'the outpost' }), cancelled: false, cancel: arrived.cancel };
      pending = request; refresh();
      const clear = () => { if (pending === request) { pending = null; refresh(); } };
      // Travel owns trip failure and its message; a failure of this trip withdraws its arrival.
      try { await travel(friend, generation, (message) => arrived.fail(new Error(message))); } catch (error) {
        clear(); arrived.cancel(); throw error;
      }
      const invited = arrived.promise.finally(clear).then(() => {
        // Cancellation can follow the settle timer before its promise continuation runs.
        if (request.cancelled) throw new Error('Travel and invite stopped. The invite was not sent.');
        // The player reads this after arriving, away from the row: it says the invite was not sent.
        return invite(name).catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : '';
          throw new Error(/not sent\.$/u.test(reason) ? reason : `${reason ? `${reason} ` : ''}The invite was not sent.`, { cause: error });
        });
      });
      invited.catch(() => {});
      return { invited };
    },
    /** Tools are leaving: a pending arrival never invites later. */
    dispose() { cancel(); listeners.clear(); },
  };
}
