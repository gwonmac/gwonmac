import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type GwNativeApi,
} from "../../../shared/contracts";
import type { TravelCommand } from "../../../shared/travel-command";
import { DEFAULT_TRAVEL_SHORTCUTS, replaceTravelShortcut } from "../../../shared/travel";
import { travelCharacterKey } from "../../../shared/travel-history";
import {
  createNativeTravelHost,
  type TravelHost,
  type TravelPreferences,
} from "./travel-host";

function fixture() {
  let travel: TravelPreferences = Object.freeze({
    shortcuts: DEFAULT_TRAVEL_SHORTCUTS,
    synonyms: Object.freeze([]),
  });
  const save = (patch: Parameters<TravelHost["savePreferences"]>[0]) => {
    travel = Object.freeze({
      shortcuts: patch.shortcuts ?? travel.shortcuts,
      synonyms: patch.synonyms ?? travel.synonyms,
    });
    return travel;
  };
  const setTravel = vi.fn(async ({ expected, patch }: Parameters<
    GwNativeApi["travelPreferences"]["set"]
  >[0]) => {
    expect(expected).toEqual(travel);
    return save(patch);
  });
  const histories = new Map<string, readonly number[]>();
  let nextHistoryFailure: Error | null = null;
  const recordHistory = vi.fn(async ({ characterKey, mapId }: {
    characterKey: string; mapId: number;
  }) => {
    if (nextHistoryFailure !== null) {
      const failure = nextHistoryFailure;
      nextHistoryFailure = null;
      throw failure;
    }
    const current = histories.get(characterKey) ?? [];
    const next = [mapId, ...current.filter((candidate) => candidate !== mapId)].slice(0, 10);
    histories.set(characterKey, next);
    return next;
  });
  const getHistory = vi.fn(async ({ characterKey }: { characterKey: string }) =>
    histories.get(characterKey) ?? []);
  const api = {
    travelPreferences: {
      async get() { return travel; },
      set: setTravel,
    },
    travelHistory: {
      get: getHistory,
      record: recordHistory,
    },
  } as unknown as GwNativeApi;
  const command: TravelCommand = {
    travel: vi.fn(),
    guildHall: vi.fn(),
    guildHallUnavailable: () => null,
    unavailable: () => null,
  };
  return {
    host: createNativeTravelHost(api, command),
    command,
    setTravel,
    recordHistory,
    getHistory,
    failNextHistoryWrite(error = new Error("history unavailable")) {
      nextHistoryFailure = error;
    },
  };
}

type ReadyGameState = Extract<Parameters<TravelHost["updateGameState"]>[0], { status: "ready" }>;
const ready = (overrides: Partial<ReadyGameState> = {}): ReadyGameState => ({
  status: "ready", mapId: 55, travelContext: "world", characterKey: null, unlockedMapWords: null,
  guildHall: false, hasGuildHall: false, explorable: false, ...overrides,
});

afterEach(() => vi.useRealTimers());

describe("native Travel host", () => {
  it("enters and leaves a Guild Hall through one confirmed native action", async () => {
    vi.useFakeTimers();
    const { host, command } = fixture();
    host.updateGameState(ready({ hasGuildHall: true }));

    await host.guildHall();
    expect(command.guildHall).toHaveBeenCalledOnce();
    expect(host.attempt.value).toEqual({
      status: "queued", kind: "guild-hall", target: "inside",
    });
    host.updateGameState({ status: "waiting", reason: "loading" });
    host.updateGameState(ready({ mapId: 4, guildHall: true, hasGuildHall: true }));
    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toBeNull();

    await host.guildHall();
    expect(command.guildHall).toHaveBeenCalledTimes(2);
    host.updateGameState({ status: "waiting", reason: "loading" });
    host.updateGameState(ready({ hasGuildHall: true }));
    expect(host.attempt.value).toEqual({ status: "idle" });
  });

  it("refuses Guild Hall travel when the character has no hall", async () => {
    const { host, command } = fixture();
    host.updateGameState(ready());
    await expect(host.guildHall()).rejects.toThrow("does not have a Guild Hall");
    expect(command.guildHall).not.toHaveBeenCalled();
  });

  it("keeps one Guild Hall arrival deadline across repeated loading snapshots", async () => {
    vi.useFakeTimers();
    const { host } = fixture();
    host.updateGameState(ready({ hasGuildHall: true }));
    await host.guildHall();
    host.updateGameState({ status: "waiting", reason: "loading" });
    await vi.advanceTimersByTimeAsync(20_000);
    host.updateGameState({ status: "waiting", reason: "loading" });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value?.message).toContain("did not confirm Guild Hall travel");
  });

  // Wrong behavior: a Guild Hall trip that starts after 3 s is not followed, so "has not started
  // yet" stays on screen after the character arrived.
  it("follows a Guild Hall trip that the game starts late", async () => {
    vi.useFakeTimers();
    const { host } = fixture();
    host.updateGameState(ready({ hasGuildHall: true }));
    await host.guildHall();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toMatchObject({ level: "info" });
    expect(host.notice.value?.message).toContain("has not started Guild Hall travel yet");

    host.updateGameState({ status: "waiting", reason: "loading" });
    expect(host.attempt.value).toEqual({ status: "loading", kind: "guild-hall", target: "inside" });
    expect(host.notice.value).toMatchObject({ level: "success" });

    host.updateGameState(ready({ mapId: 4, guildHall: true, hasGuildHall: true }));
    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toBeNull();
  });

  it("delegates shortcut mutations to Main", async () => {
    const { host, setTravel } = fixture();
    await host.loadPreferences();
    const edited = replaceTravelShortcut(DEFAULT_TRAVEL_SHORTCUTS, 8, { mapId: 642 });

    await host.savePreferences({ shortcuts: edited });
    expect(setTravel.mock.calls[0]?.[0].patch.shortcuts?.[8]).toEqual({ mapId: 642 });
  });

  it("releases a queued travel attempt when Guild Wars confirms arrival directly", async () => {
    vi.useFakeTimers();
    const { host } = fixture();

    await host.travel({ mapId: 449 });
    host.updateGameState(ready({ mapId: 449 }));
    await vi.runAllTimersAsync();

    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toBeNull();
  });

  // Wrong behavior: a trip that a game prompt or a party countdown delays past 3 s is reported
  // as failed, which sends a Hub receipt and withdraws the pending arrival invite.
  it("says a queued trip has not started yet, without a failure, until another attempt replaces it", async () => {
    vi.useFakeTimers();
    const { host } = fixture();
    const failures = vi.fn();

    await host.travel({ mapId: 449 }, failures);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(failures).not.toHaveBeenCalled();
    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toMatchObject({ level: "info" });
    expect(host.notice.value?.message).toContain("has not started this trip yet");

    await host.travel({ mapId: 55 });
    expect(host.notice.value).toMatchObject({ level: "info" });
    expect(host.notice.value?.message).toContain("Travelling to");

    host.updateGameState(ready({ mapId: 449 }));
    expect(host.attempt.value).toEqual({ status: "queued", kind: "map", mapId: 55 });
    expect(host.notice.value?.message).toContain("Travelling to");
  });

  it("clears a queued timeout when the same attempt starts late", async () => {
    vi.useFakeTimers();
    const { host } = fixture();

    await host.travel({ mapId: 449 });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(host.notice.value?.message).toContain("has not started this trip yet");

    host.updateGameState({ status: "waiting", reason: "loading" });

    expect(host.attempt.value).toEqual({ status: "loading", kind: "map", mapId: 449 });
    expect(host.notice.value).toMatchObject({ level: "success" });
    expect(host.notice.value?.message).not.toContain("has not started");
  });

  it("publishes immediate refusal and clears command feedback on disposal", async () => {
    const { host, command } = fixture();
    vi.mocked(command.travel).mockImplementationOnce(() => {
      throw new Error("private refusal");
    });

    await expect(host.travel({ mapId: 449 })).rejects.toThrow("private refusal");
    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toMatchObject({ level: "danger" });

    host.dispose();
    expect(host.notice.value).toBeNull();
  });

  it("always releases a loading attempt after interruption or its arrival deadline", async () => {
    vi.useFakeTimers();
    const interrupted = fixture().host;
    await interrupted.travel({ mapId: 449 });
    interrupted.updateGameState({ status: "waiting", reason: "loading" });
    interrupted.updateGameState({ status: "waiting", reason: "game" });
    expect(interrupted.attempt.value).toEqual({ status: "idle" });
    expect(interrupted.notice.value?.message).toContain("interrupted");
    interrupted.updateGameState(ready({ mapId: 449 }));
    expect(interrupted.notice.value).toBeNull();

    const expired = fixture().host;
    await expired.travel({ mapId: 449 });
    expired.updateGameState({ status: "waiting", reason: "loading" });
    await vi.advanceTimersByTimeAsync(20_000);
    expired.updateGameState({ status: "waiting", reason: "loading" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(expired.attempt.value).toEqual({ status: "idle" });
    expect(expired.notice.value?.message).toContain("ready to try again");
  });

  // Wrong behavior: the trip's caller (a party invite waiting to invite on arrival) is not told
  // and keeps waiting for its own 60 s timeout, or hears of it more than once.
  it("reports an unconfirmed arrival when loading ends on another map, to the trip's caller too", async () => {
    vi.useFakeTimers();
    const { host } = fixture();
    const failed = vi.fn();
    await host.travel({ mapId: 449 }, failed);
    host.updateGameState({ status: "waiting", reason: "loading" });

    host.updateGameState(ready());

    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toMatchObject({ level: "warning" });
    expect(host.notice.value?.message).toContain("did not confirm arrival");
    expect(failed).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledWith(host.notice.value?.message);
    await vi.runAllTimersAsync();
    expect(host.notice.value?.message).toContain("did not confirm arrival");

    host.updateGameState(ready({ mapId: 449 }));
    expect(host.notice.value).toBeNull();
  });

  it("clears an arrival timeout when the same attempt arrives late", async () => {
    vi.useFakeTimers();
    const { host } = fixture();
    await host.travel({ mapId: 449 });
    host.updateGameState({ status: "waiting", reason: "loading" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(host.notice.value?.message).toContain("did not confirm arrival");

    host.updateGameState(ready({ mapId: 449 }));

    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toBeNull();
  });

  it("records observed destinations independently for each character", async () => {
    const { host, recordHistory, getHistory } = fixture();
    const unlockedMapWords = Array.from({ length: 28 }, () => 0xffff_ffff);
    const characterA = travelCharacterKey("0123456789abcdef");
    const characterB = travelCharacterKey("fedcba9876543210");
    host.updateGameState(ready({ characterKey: characterA, unlockedMapWords }));
    host.updateGameState(ready({ mapId: 449, characterKey: characterA, unlockedMapWords }));
    host.updateGameState(ready({ mapId: 81, characterKey: characterB, unlockedMapWords }));

    await vi.waitFor(() => expect(recordHistory).toHaveBeenCalledTimes(3));
    expect(recordHistory.mock.calls.map(([value]) => value)).toEqual([
      { characterKey: "0123456789abcdef", mapId: 55 },
      { characterKey: "0123456789abcdef", mapId: 449 },
      { characterKey: "fedcba9876543210", mapId: 81 },
    ]);
    expect(host.history.value).toEqual([81]);
    expect(getHistory).not.toHaveBeenCalled();
  });

  it("records the unidentified starting map after the first confirmed travel", async () => {
    const { host, recordHistory } = fixture();
    const characterKey = travelCharacterKey("0123456789abcdef");
    const unlockedMapWords = Array.from({ length: 28 }, () => 0xffff_ffff);
    host.updateGameState(ready({ unlockedMapWords }));

    await host.travel({ mapId: 449 });
    host.updateGameState(ready({ mapId: 449, characterKey, unlockedMapWords }));

    await vi.waitFor(() => expect(recordHistory).toHaveBeenCalledTimes(2));
    expect(recordHistory.mock.calls.map(([value]) => value)).toEqual([
      { characterKey, mapId: 55 },
      { characterKey, mapId: 449 },
    ]);
    expect(host.history.value).toEqual([449, 55]);
  });

  it("switches histories when characters share the same map and hides unidentified history", async () => {
    const { host, recordHistory } = fixture();
    const characterA = travelCharacterKey("0123456789abcdef");
    const characterB = travelCharacterKey("fedcba9876543210");
    const unlockedMapWords = Array.from({ length: 28 }, () => 0xffff_ffff);
    host.updateGameState(ready({ characterKey: characterA, unlockedMapWords }));
    await vi.waitFor(() => expect(host.history.value).toEqual([55]));

    host.updateGameState({ status: "waiting", reason: "loading" });
    expect(host.history.value).toEqual([]);
    host.updateGameState(ready({ unlockedMapWords }));
    expect(host.history.value).toEqual([]);
    host.updateGameState(ready({ characterKey: characterB, unlockedMapWords }));

    await vi.waitFor(() => expect(host.history.value).toEqual([55]));
    expect(recordHistory.mock.calls.map(([value]) => value.characterKey)).toEqual([
      characterA,
      characterB,
    ]);
  });

  it("contains background history failures and retries when history is requested", async () => {
    const test = fixture();
    const characterKey = travelCharacterKey("0123456789abcdef");
    test.failNextHistoryWrite();
    test.host.updateGameState(ready({ characterKey, unlockedMapWords: Array.from({ length: 28 }, () => 0xffff_ffff) }));
    await vi.waitFor(() => expect(test.recordHistory).toHaveBeenCalledTimes(1));

    await expect(test.host.loadHistory()).resolves.toEqual([55]);
    expect(test.recordHistory).toHaveBeenCalledTimes(2);
  });

  it("refuses travel outside the active context before enqueueing", async () => {
    vi.useFakeTimers();
    const { host, command } = fixture();
    host.updateGameState(ready({ mapId: 148, travelContext: "pre-searing", unlockedMapWords: Array.from({ length: 28 }, () => 0xffff_ffff) }));

    await expect(host.travel({ mapId: 330 })).rejects.toThrow("Only Pre-Searing");
    expect(command.travel).not.toHaveBeenCalled();
    expect(host.attempt.value).toEqual({ status: "idle" });
    expect(host.notice.value).toEqual({
      message: "Only Pre-Searing destinations are available to this character.",
      level: "warning",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
