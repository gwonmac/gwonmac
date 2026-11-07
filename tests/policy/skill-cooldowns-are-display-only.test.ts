import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rendererSources = [
  "app/renderer/native-hud-layer.ts",
  "app/renderer/skill-cooldown-overlay-consumer.ts",
  "app/renderer/skill-cooldown-state-installation.ts",
  "app/renderer/skill-overlays-installation.ts",
  "app/renderer/skill-slot-projection.ts",
] as const;

test("cooldown presentation has no gameplay input or command dependency", async () => {
  const source = (await Promise.all(rendererSources.map((path) => readFile(path, "utf8"))))
    .join("\n");
  assert.doesNotMatch(source, /(?:\.\/|\.\.\/)input(?:\.js)?["']/u);
  assert.doesNotMatch(source, /commandEnqueue|sendInput|postMessage|dispatchKey|useSkill/u);
  assert.doesNotMatch(source, /gwNative\.(?:input|skillKeys)/u);
});
