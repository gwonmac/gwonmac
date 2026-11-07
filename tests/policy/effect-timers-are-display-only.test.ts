/** Effect timer presentation cannot reach gameplay input or command paths. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rendererSources = [
  "app/renderer/native-hud-layer.ts",
  "app/features/effect-timers/renderer/effect-timer-overlay-consumer.ts",
  "app/renderer/player-effect-state-installation.ts",
] as const;

test("effect timer presentation has no gameplay input or command dependency", async () => {
  const source = (await Promise.all(rendererSources.map((path) => readFile(path, "utf8"))))
    .join("\n");
  assert.doesNotMatch(source, /(?:\.\/|\.\.\/)input(?:\.js)?["']/u);
  assert.doesNotMatch(source, /commandEnqueue|sendInput|postMessage|dispatchKey|useSkill/u);
  assert.doesNotMatch(source, /gwNative\.(?:input|skillKeys)/u);
});
