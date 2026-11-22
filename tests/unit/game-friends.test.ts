// game.friends (app/renderer/game-blocks.ts): the friend list over the friends substrate, which
// Whispers and Travel read through the block instead of being attached to the substrate. This
// runs the real friends substrate, the real Whispers and Travel parts and Whispers' link over a
// fake certified export set and a real memory.
// What would go wrong without these tests: on a build whose friend observation the verifier
// refused, Whispers or Travel shows a friend list anyway (or the kernel is asked to read the
// friend table); the kernel reads the friend table with nobody listening; an unchanged list
// reaches the parts again on every frame; or a different character keeps the old one's list.
import assert from "node:assert/strict";
import test from "node:test";
import travel from "../../app/features/travel/companion.ts";
import whispers from "../../app/features/whispers/companion.ts";
import { hubLinks } from "../../app/renderer/feature-links.ts";
import { createGameBlocks, createUiBlocks, type GameFriends } from "../../app/renderer/game-blocks.ts";
import type { CompanionPlayRegionState } from "../../app/renderer/companion-play-region-snapshot.ts";
import { createPlayRegionObservationInstallation } from "../../app/renderer/play-region-state-installation.ts";
import type { PreparedToolsPart, ToolsActivation, ToolsPartSession, ToolsPrepareInput } from "../../app/renderer/tools-companion-part.ts";
import { createToolsSubstrates } from "../../app/renderer/tools-companion-substrates.ts";
import { COMPANION_ABI, COMPANION_FEATURE_BITS } from "../../app/shared/companion-abi.ts";
import { capabilityRecord } from "../../app/shared/enhancement-contracts.ts";
import { FRIEND_OBSERVER_MANIFEST_SECTION, FRIEND_OBSERVER_SEMANTIC_SHA256, FRIEND_OBSERVER_TRANSFORM_ABI } from "../../app/shared/friend-observer-contract.ts";
import { NO_FRIENDS, type TravelFriends } from "../../app/shared/friends.ts";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.ts";
import { provenFacts } from "../helpers/feature-facts.ts";

const EMPTY_MODULE = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));

/** An empty module that carries one friend observer manifest, as a build with proven friend observation does. */
function moduleWithFriendManifest(): WebAssembly.Module {
  const encoder = new TextEncoder();
  const name = encoder.encode(FRIEND_OBSERVER_MANIFEST_SECTION);
  const payload = encoder.encode(JSON.stringify({
    transformAbi: FRIEND_OBSERVER_TRANSFORM_ABI, inputSha256: "0".repeat(64), semanticSha256: FRIEND_OBSERVER_SEMANTIC_SHA256, root: 4096,
  }));
  const leb = (value: number) => {
    const bytes: number[] = [];
    do { let byte = value & 0x7f; value >>>= 7; if (value !== 0) byte |= 0x80; bytes.push(byte); } while (value !== 0);
    return bytes;
  };
  const body = [...leb(name.length), ...name, ...payload];
  return new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 0, ...leb(body.length), ...body]));
}

const inOutpost = (characterKey: string): CompanionPlayRegionState => Object.freeze({
  status: "ready", sequence: 2, mapId: 248, instanceType: 0, playRegion: "pve", travelContext: "world",
  characterKey, unlockedMapWords: null, guildHall: false, hasGuildHall: false,
});

async function start(t: test.TestContext, module: WebAssembly.Module) {
  const memory = new WebAssembly.Memory({ initial: 4 });
  const view = new DataView(memory.buffer);
  const exports = {
    enhancement_configure_whispers: () => 1, enhancement_send_whisper: () => 1, enhancement_send_party_invite: () => 1,
    enhancement_travel: () => 1, enhancement_configure_travel: () => 1, enhancement_take_travel_toggle: () => 0,
  } as unknown as WebAssembly.Exports;
  const settings = { ...DEFAULT_SETTINGS, gwonmacTools: true, whispersEnabled: true, travelPalette: true };
  const previousWindow = globalThis.window;
  // The Hub shows, so Travel wants the friend list; Whispers reads it only for its own picker.
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(new EventTarget(), {
    gwToolsSettings: () => settings, gwFeatureFacts: () => provenFacts(settings),
    gwHub: { visible: true, attach: () => () => {}, showRows() {}, notify() {} },
  }) });

  const capabilities = capabilityRecord(() => true);
  const substrates = createToolsSubstrates(module, capabilities, "none");
  const playRegions = createPlayRegionObservationInstallation(true);
  playRegions.setActive(true);
  let region: CompanionPlayRegionState = inOutpost("000000010000000a");
  const input = { exports, module, capabilities, program: "none", substrates } as unknown as ToolsPrepareInput;
  const parts: PreparedToolsPart[] = [substrates.friends.prepared, await whispers.prepare(input), await travel.prepare(input)];
  const travelPrepared = parts[2] as Awaited<ReturnType<typeof travel.prepare>>;
  // What Travel's palette is handed, and when it wants the list (the palette shows in the Hub).
  const travelSaw: TravelFriends[] = [];
  Object.assign(travelPrepared.installation!, {
    updateFriends: (list: TravelFriends) => { travelSaw.push(list); },
    observingFriends: () => true,
  });
  let next = 4096;
  const regions: Record<string, number> = {};
  for (const part of parts) part.allocate?.((bytes) => { const pointer = next; next += Math.ceil(bytes / 16) * 16; return pointer; });
  for (const part of parts) part.initialize?.(memory);
  for (const owned of parts.flatMap((part) => part.ownedRegions?.() ?? [])) regions[owned.name] = owned.pointer;

  const sessions: ToolsPartSession[] = [];
  const syncObservers = () => {};
  const context = {
    memory, playRegions, syncObservers,
    snapshot: () => ({ settings, playRegionState: region }),
    on: () => true,
    game: createGameBlocks({ capabilities, substrates, playRegions, syncObservers }),
    ui: createUiBlocks({ capabilities, hud: null, substrates, document: {} as Document, syncObservers }),
  } as unknown as ToolsActivation;
  for (const part of parts) sessions.push(part.activate!(context));
  // The friends line mounts Hub people and applies the launch region, as the installer does.
  sessions[0]!.mount?.();
  sessions[0]!.sync?.();
  t.after(() => {
    for (const session of sessions) for (const step of session.disposePresentation ?? []) step();
    substrates.skills.geometry.dispose(); substrates.skills.cooldowns.dispose(); playRegions.dispose();
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });
  return {
    game: context.game,
    travelSaw,
    friendSnapshot: regions["friend snapshot"],
    /** One frame: the feed reads, then each part checks whether it still wants the list. */
    frame() { for (const session of sessions) for (const poller of [...session.feedPollers ?? [], ...session.pollers ?? []]) if (poller.enabled?.() !== false) poller.poll(); },
    /** What the kernel is asked to observe. */
    observing: () => sessions.some((session) => ((session.activeFeatures?.() ?? 0) & COMPANION_FEATURE_BITS.friendObservation) !== 0),
    /** Whispers' session, as Hub people reads it through Whispers' link. */
    whispersFriends() { const people = hubLinks().whispers?.people(); return people === undefined || people === "unavailable" ? null : people.state.friends; },
    /** The character in the game changes, and the friends line applies it. */
    enter(characterKey: string) { region = inOutpost(characterKey); sessions[0]!.sync?.(); },
    /** The kernel publishes one friend at sequence `sequence`. */
    publish(sequence: number, mapId = 449) {
      const at = regions["friend snapshot"]!;
      view.setUint32(at, 0x5246_5747, true);
      view.setUint16(at + 4, COMPANION_ABI.friends.abi, true);
      view.setUint16(at + 6, COMPANION_ABI.friends.bytes, true);
      view.setUint32(at + 8, sequence, true);
      view.setUint32(at + 12, 1, true); // the list is ready
      view.setUint32(at + 16, 7, true);
      view.setUint32(at + 20, 1, true);
      view.setUint32(at + 24, 1, true); view.setUint32(at + 28, 2, true); view.setUint32(at + 32, 1, true);
      view.setUint32(at + 36, mapId, true);
      [..."Romi"].forEach((unit, i) => view.setUint16(at + 40 + i * 2, unit.charCodeAt(0), true));
      [..."Example Ranger"].forEach((unit, i) => view.setUint16(at + 80 + i * 2, unit.charCodeAt(0), true));
    },
  };
}

test("on a build without the friend proof Whispers and Travel get no friend list and nothing is read", async (t) => {
  const run = await start(t, EMPTY_MODULE);
  const { friends } = run.game;
  assert.deepEqual({ available: friends.available, reason: friends.available ? null : friends.reason },
    { available: false, reason: "not-proven" });
  assert.equal(run.friendSnapshot, undefined, "no friend snapshot is allocated");
  for (let frame = 0; frame < 3; frame += 1) run.frame();
  assert.deepEqual(run.whispersFriends(), NO_FRIENDS);
  assert.deepEqual(run.travelSaw, [NO_FRIENDS]);
  assert.equal(run.observing(), false);
});

test("game.friends reads only while someone listens, gives each change once and drops a character's list", async (t) => {
  const run = await start(t, moduleWithFriendManifest());
  const seen: (GameFriends | null)[] = [];
  const keys = () => seen.map((list) => list === null ? null : list.friends.map((friend) => `${friend.character}@${friend.mapId}`).join());
  assert.equal(run.observing(), false, "nobody listens yet");

  const stop = run.game.friends.subscribe((list) => seen.push(list));
  assert.equal(run.observing(), true);
  run.publish(2);
  run.frame(); run.frame();
  run.publish(4); // republished with nothing visible changed
  run.frame();
  run.publish(6, 81);
  run.frame();
  assert.deepEqual(keys(), [null, "Example Ranger@449", "Example Ranger@81"]);

  run.enter("000000020000000b");
  run.frame();
  assert.deepEqual(keys().slice(3), [null], "another character's list is withdrawn until the game publishes again");
  run.publish(8, 81);
  run.frame();
  assert.deepEqual(keys().slice(3), [null, "Example Ranger@81"]);
  assert.deepEqual(run.whispersFriends(), NO_FRIENDS, "Whispers, whose picker is closed, does not read the list for the Hub (Hub people reads its own)");
  assert.equal(run.travelSaw.at(-1)?.status, "ready", "so does Travel's palette");

  stop();
  run.enter("000000020000000b");
  assert.equal(run.observing(), true, "Travel still listens while the Hub shows");
});
