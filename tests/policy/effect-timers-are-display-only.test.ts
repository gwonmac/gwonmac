/** Effect timer and skill cooldown presentation cannot reach gameplay input or command paths. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const presentation = {
  "effect timer": [
    "app/renderer/native-hud-layer.ts",
    "app/features/effect-timers/companion.ts",
    "app/features/effect-timers/renderer/effect-timer-labels.ts",
    "app/renderer/player-effect-state-installation.ts",
  ],
  "cooldown": [
    "app/renderer/native-hud-layer.ts",
    "app/features/skill-cooldowns/companion.ts",
    "app/renderer/game-blocks.ts",
    "app/renderer/skill-cooldown-state-installation.ts",
    "app/renderer/skill-overlays-installation.ts",
    "app/renderer/skill-slot-projection.ts",
  ],
} as const;

for (const [name, files] of Object.entries(presentation)) {
  test(`${name} presentation has no gameplay input or command dependency`, async () => {
    const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
    assert.doesNotMatch(source, /(?:\.\/|\.\.\/)input(?:\.js)?["']/u, name);
    assert.doesNotMatch(source, /commandEnqueue|sendInput|postMessage|dispatchKey|useSkill/u, name);
    assert.doesNotMatch(source, /gwNative\.(?:input|skillKeys)/u, name);
  });
}
