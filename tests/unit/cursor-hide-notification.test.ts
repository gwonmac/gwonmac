// The input controller takes the mouse-look pointer lock from the cursor
// consumer's hide notification, so the notification must fire exactly once per
// shown-to-hidden change, on the poll that reads it.
import assert from "node:assert/strict";
import test from "node:test";
import { COMPANION_ABI } from "../../app/shared/companion-abi.ts";

const style = () => ({ cssText: "", width: "", cursor: "" });
const context = {
  createImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
  putImageData() {},
  clearRect() {},
  drawImage() {},
  imageSmoothingEnabled: true,
};
Object.assign(globalThis, {
  document: {
    createElement: () => ({
      style: style(),
      offsetWidth: 0,
      getContext: () => context,
      toDataURL: () => "data:image/png;base64,",
      remove() {},
    }),
    body: { append() {} },
    addEventListener() {},
    removeEventListener() {},
  },
  window: { addEventListener() {}, removeEventListener() {} },
});

const { createCursorConsumer } = await import("../../app/renderer/enhancement-cursor.ts");

const VALID = 1, HIDDEN = 2;
const memory = { buffer: new ArrayBuffer(COMPANION_ABI.cursor.bytes) } as WebAssembly.Memory;
const view = new DataView(memory.buffer);
let generation = 0;
const publish = (flags: number) => {
  view.setUint32(0, 0x43545747, true);
  view.setUint16(4, COMPANION_ABI.cursor.abi, true);
  view.setUint16(6, COMPANION_ABI.cursor.bytes, true);
  view.setUint32(12, flags, true);
  view.setUint32(16, ++generation, true);
  view.setUint32(20, 32, true);
  view.setUint32(24, 32, true);
};

test("the consumer reports each change from shown to hidden once", () => {
  let hides = 0;
  let held = false;
  const consumer = createCursorConsumer({
    element: { style: style() } as unknown as HTMLElement,
    memory,
    cursorPointer: 0,
    transitionHold: () => held,
    onHide: () => { hides += 1; },
  });

  publish(VALID);
  consumer.poll();
  assert.equal(consumer.state.valid, true);
  assert.equal(hides, 0);

  publish(VALID | HIDDEN);
  consumer.poll();
  consumer.poll();
  assert.equal(hides, 1);

  // Still hidden under a new generation: not a new hide.
  publish(VALID | HIDDEN);
  consumer.poll();
  assert.equal(hides, 1);

  // A held hide keeps the old art on screen but is still reported.
  publish(VALID);
  consumer.poll();
  held = true;
  publish(VALID | HIDDEN);
  consumer.poll();
  assert.equal(hides, 2);
  consumer.dispose();
});
