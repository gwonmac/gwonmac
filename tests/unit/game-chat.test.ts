// game.chat (app/renderer/game-blocks.ts): the whispers the game shows and its one
// chat send slot, which the chat substrate owns. Party invites go through it, so they
// need no Whispers. This runs the real Whispers part (which hosts the chat region's
// memory), the real friends substrate and Hub people over a fake certified export set
// and a real memory.
// What would go wrong without these tests: an invite from Hub is missing or says
// "chat is not ready" while Whispers is off, the kernel never gets the chat bit and
// refuses the line, the chat slot stays open (reading the player's whispers) when
// nobody needs it, or a listener hears whispers from before it listened.
import assert from "node:assert/strict";
import test from "node:test";
import whispers from "../../app/features/whispers/companion.ts";
import { createGameBlocks, createUiBlocks } from "../../app/renderer/game-blocks.ts";
import { createPlayRegionObservationInstallation } from "../../app/renderer/play-region-state-installation.ts";
import type { PreparedToolsPart, ToolsActivation, ToolsPartSession, ToolsPrepareInput } from "../../app/renderer/tools-companion-part.ts";
import { createToolsSubstrates } from "../../app/renderer/tools-companion-substrates.ts";
import { COMPANION_ABI, COMPANION_FEATURE_BITS } from "../../app/shared/companion-abi.ts";
import { capabilityRecord } from "../../app/shared/enhancement-contracts.ts";
import type { HubRow, HubSource, HubTask } from "../../app/shared/hub.ts";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.ts";
import { WHISPER_MAILBOX } from "../../app/shared/whispers.ts";

const EMPTY_MODULE = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
const CHAT = 4096;
const MAILBOX = CHAT + COMPANION_ABI.whispers.snapshotBytes;

function start(t: test.TestContext) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  // The kernel's empty chat ring: magic, ABI, size, an even sequence, no records.
  view.setUint32(CHAT, 0x4857_5747, true);
  view.setUint16(CHAT + 4, COMPANION_ABI.whispers.abi, true);
  view.setUint16(CHAT + 6, COMPANION_ABI.whispers.bytes, true);
  const lines: string[] = [];
  const exports = {
    enhancement_configure_whispers: () => 1,
    enhancement_send_whisper: () => 1,
    enhancement_send_party_invite: () => {
      const length = view.getUint32(MAILBOX + WHISPER_MAILBOX.length, true);
      lines.push(String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint16(MAILBOX + WHISPER_MAILBOX.source + i * 2, true))));
      view.setUint32(MAILBOX + WHISPER_MAILBOX.status, 1, true);
      return 1;
    },
  } as unknown as WebAssembly.Exports;

  // Whispers is off; Travel on keeps Hub people (and with it the invite) on.
  const settings = { ...DEFAULT_SETTINGS, gwonmacTools: true, whispersEnabled: false, travelPalette: true };
  let source: HubSource | null = null;
  let page: () => readonly HubRow[] = () => [];
  const receipts: string[] = [];
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(new EventTarget(), {
    gwToolsSettings: () => settings,
    gwHub: { visible: false, showRows(_title: string, rows: () => readonly HubRow[]) { page = rows; },
      attach(next: HubSource) { source = next; return () => { source = null; }; }, notify(message: string) { receipts.push(message); } },
  }) });

  const capabilities = capabilityRecord(() => true);
  const substrates = createToolsSubstrates(EMPTY_MODULE, capabilities, "none");
  const playRegions = createPlayRegionObservationInstallation(true);
  playRegions.setActive(true);

  const prepared = whispers.prepare({ exports, capabilities, substrates } as unknown as ToolsPrepareInput) as PreparedToolsPart;
  prepared.allocate!(() => CHAT);
  prepared.initialize!(memory);
  const sessions: ToolsPartSession[] = [];
  const bits: number[] = [];
  const syncObservers = () => { bits.push(sessions.reduce((all, session) => all | (session.activeFeatures?.() ?? 0), 0)); };
  const context = {
    memory, playRegions, syncObservers,
    snapshot: () => ({ settings, playRegionState: playRegions.state }),
    policy: () => ({ whispers: false, travel: true }),
    game: createGameBlocks({ capabilities, substrates, playRegions, syncObservers }),
    ui: createUiBlocks({ capabilities, hud: null, substrates, document: {} as Document, syncObservers }),
  } as unknown as ToolsActivation;
  sessions.push(prepared.activate!(context), substrates.friends.prepared.activate(context));
  for (const session of sessions) session.mount?.();
  for (const session of sessions) session.sync?.();
  t.after(() => {
    for (const session of sessions) for (const step of session.disposePresentation ?? []) step();
    substrates.skills.geometry.dispose(); substrates.skills.cooldowns.dispose(); playRegions.dispose();
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  });

  playRegions.sink?.update(Object.freeze({
    status: "ready", sequence: 2, mapId: 248, instanceType: 0, playRegion: "pve", travelContext: "world",
    characterKey: "000000010000000a", unlockedMapWords: null, guildHall: false, hasGuildHall: false,
  } as const));
  const chatBit = () => (bits.at(-1) ?? 0) & COMPANION_FEATURE_BITS.whisperObservation;
  const poll = () => { for (const session of sessions) for (const poller of session.pollers ?? []) poller.poll(); };
  let written = 0;
  return {
    lines, receipts, chatBit, poll,
    game: context.game,
    /** The kernel appends one incoming whisper to the ring. */
    whisper(sender: string, message: string) {
      written += 1;
      const slot = CHAT + 20 + (written - 1) * 288;
      view.setUint32(slot, written, true);
      view.setUint32(slot + 4, sender.length | (message.length << 16), true);
      [...sender].forEach((unit, i) => view.setUint16(slot + 8 + i * 2, unit.charCodeAt(0), true));
      [...message].forEach((unit, i) => view.setUint16(slot + 8 + COMPANION_ABI.whispers.nameUnits * 2 + i * 2, unit.charCodeAt(0), true));
      view.setUint32(CHAT + 12, written, true);
    },
    source: () => source,
    page: () => page(),
    /** The game drains the mailbox, and the next frame's poll reads it. */
    drain(status: 2 | 3) {
      view.setUint32(MAILBOX + WHISPER_MAILBOX.status, status, true);
      poll();
    },
  };
}

const task = (receipts: string[]): HubTask => ({ live: () => true, progress() {}, done(receipt) { if (receipt) receipts.push(receipt); } });

test("Hub invites a player with Whispers off, and the chat slot is open only while the invite is on its way", async (t) => {
  const run = start(t);
  assert.notEqual(run.source(), null, "Hub people is on with Travel alone");
  assert.equal(run.chatBit(), 0, "nothing reads the player's chat before the invite");

  const row = run.source()!.search("invite Mo Kai")[0]!;
  assert.equal(row.unavailable, undefined);
  const invited = Promise.resolve(row.run(task(run.receipts)));
  assert.deepEqual(run.lines, ["/invite Mo Kai"]);
  assert.notEqual(run.chatBit(), 0, "the kernel has the chat bit, so it accepts the line");

  run.drain(2);
  await invited;
  assert.equal(run.chatBit(), 0, "the slot closes once Guild Wars took the invite");
  assert.deepEqual(run.receipts, ["Sent /invite Mo Kai. Guild Wars answers in chat."]);
});

test("an invite the game refuses at its drain reports it and closes the slot", async (t) => {
  const run = start(t);
  const invited = Promise.resolve(run.source()!.search("invite Mo Kai")[0]!.run(task(run.receipts)));
  run.drain(3);
  await assert.rejects(invited, /The invite was not sent/);
  assert.equal(run.chatBit(), 0);
});

test("game.chat.messages reads whispers only while someone listens, and never hands out older ones", (t) => {
  const run = start(t);
  run.whisper("Mo Kai", "before anyone listened");
  run.poll();
  const seen: unknown[] = [];
  const stop = run.game.chat.messages.subscribe((batch) => seen.push(batch));
  assert.notEqual(run.chatBit(), 0);
  run.whisper("Mo Kai", "hello");
  run.poll();
  run.poll();
  // Written after the last frame's read: closing the slot drops it.
  run.whisper("Mo Kai", "as the last listener left");
  stop();
  assert.equal(run.chatBit(), 0, "the slot closes with the last listener");
  const later: unknown[] = [];
  run.game.chat.messages.subscribe((batch) => later.push(batch));
  run.poll();
  assert.deepEqual(seen, [null, { messages: [{ id: 2, sender: "Mo Kai", message: "hello", direction: "incoming" }], missed: 0 }]);
  assert.deepEqual(later, [null], "a whisper from before this listener is dropped");
});
