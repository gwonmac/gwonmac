import assert from "node:assert/strict";
import test from "node:test";
import {
  createStorageController,
  type StorageGameState,
} from "../../app/features/xunlai-storage/renderer/enhancement-storage-controller.js";

const accessible = {
  status: "ready",
  xunlaiAccess: true,
} satisfies StorageGameState;

test("the storage controller owns policy, its link, deduplication, and teardown", () => {
  const configurations: number[][] = [];
  let opens = 0;
  const controller = createStorageController(
    () => { opens += 1; return 1; },
    (pointer, enabled) => {
      configurations.push([pointer, enabled]);
      return 1;
    },
    256,
  );
  assert.deepEqual(configurations, [[256, 0]]);

  controller.update({
    enabled: true,
    playRegion: "pve",
    state: accessible,
  });
  controller.update({
    enabled: true,
    playRegion: "pve",
    state: accessible,
  });
  assert.deepEqual(configurations, [[256, 0], [256, 1]]);

  assert.equal(controller.link.blocked(), null);
  assert.equal(controller.link.toggle("toggle"), "shown");
  assert.equal(opens, 1);

  controller.update({
    enabled: false,
    playRegion: "pve",
    state: accessible,
  });
  // Switched off, the controller stays mounted: its link refuses and says why.
  assert.equal(controller.link.toggle("show"), "unavailable");
  assert.match(String(controller.link.blocked()), /turned off/);
  assert.equal(opens, 1);

  controller.dispose();
  assert.deepEqual(configurations.at(-1), [0, 0]);
  assert.equal(controller.link.toggle("show"), "unavailable");
  assert.equal(opens, 1);
});

test("storage fails closed without a confirmed character access proof", () => {
  const configurations: number[][] = [];
  const controller = createStorageController(
    () => 1,
    (pointer, enabled) => { configurations.push([pointer, enabled]); return 1; },
    512,
  );
  for (const state of [
    null,
    { status: "waiting" as const },
    { status: "ready" as const, xunlaiAccess: null },
    { status: "ready" as const, xunlaiAccess: false },
  ]) controller.update({ enabled: true, playRegion: "pve", state });
  assert.deepEqual(configurations, [[512, 0]]);

  controller.update({ enabled: true, playRegion: "pve", state: accessible });
  controller.update({
    enabled: true,
    playRegion: "unknown",
    state: accessible,
  });
  controller.update({
    enabled: true,
    playRegion: "pvp",
    state: accessible,
  });
  assert.equal(controller.link.toggle("show"), "unavailable");
  assert.match(String(controller.link.blocked()), /during PvP play/);
  controller.update({
    enabled: true,
    playRegion: "pve",
    state: { ...accessible, xunlaiAccess: false },
  });
  assert.deepEqual(configurations, [
    [512, 0],
    [512, 1],
    [512, 0],
  ]);
  controller.dispose();
});

test("storage development traces identify the live refusal without account data", () => {
  const previousDebug = console.debug;
  const messages: string[] = [];
  console.debug = (message?: unknown) => { messages.push(String(message)); };
  try {
    const controller = createStorageController(
      () => 1,
      () => 1,
      512,
      true,
    );
    controller.update({
      enabled: true,
      playRegion: "pve",
      state: { status: "ready", xunlaiAccess: false },
    });
    controller.update({
      enabled: true,
      playRegion: "pve",
      state: { status: "ready", xunlaiAccess: false },
    });
    controller.link.toggle("show");
    assert.ok(messages.some((message) =>
      message.includes("storage.refused")
      && message.includes('"request":1')
      && message.includes('"sincePreviousMs":null')
      && message.includes('"state":"ready"')
      && message.includes('"access":false')
      && message.includes("cannot access Xunlai storage")
    ));
    assert.equal(
      messages.filter((message) => message.includes("storage.availability")).length,
      1,
    );
    controller.dispose();
  } finally {
    console.debug = previousDebug;
  }
});
