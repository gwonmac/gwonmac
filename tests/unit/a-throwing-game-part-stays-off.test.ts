// The installer mounts every part together, and a mount that throws withdraws all of them
// (ToolsPartSession.mount). So one Feature whose `start` throws would take every other Feature
// down with it. featurePart catches it: that Feature stays off, says so once, and never retries.
import assert from "node:assert/strict";
import test from "node:test";
import { featurePart, type ToolsActivation } from "../../app/renderer/tools-companion-part.ts";
import { RELEASE_ENHANCEMENT_CAPABILITIES } from "../../app/shared/enhancement-contracts.ts";

test("a game part whose start throws stays off without throwing, and logs one line without the error", () => {
  let starts = 0;
  const part = featurePart("callTarget", () => { starts += 1; throw new Error("/Users/someone/secret"); });
  const context = { snapshot: () => ({ settings: {} }), on: () => true } as unknown as ToolsActivation;
  const session = part.prepare({ capabilities: RELEASE_ENHANCEMENT_CAPABILITIES } as never).activate(context);
  const logged: unknown[][] = [];
  const error = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    session.mount?.();
    session.syncFeeds?.();
  } finally {
    console.error = error;
  }
  assert.deepEqual({ starts, logged }, { starts: 1, logged: [["[err] the callTarget game part could not start; it stays off"]] });
});
