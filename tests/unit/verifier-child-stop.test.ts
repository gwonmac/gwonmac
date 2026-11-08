import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import test from "node:test";
import { stoppableVerifierChild } from "../../app/client/certification/verifier-child-stop.js";

test("a verifier child that ignores the stop is killed after the grace period", async () => {
  // Catches a child stuck past SIGTERM that keeps a core busy after its pass
  // was given up.
  const child = spawn(process.execPath, [
    "-e",
    "process.on('SIGTERM', () => {}); process.send?.('ready'); setInterval(() => {}, 1000);",
  ], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  try {
    await once(child, "message");
    const exited = once(child, "exit").then(([code, signal]) => ({ code, signal }));
    stoppableVerifierChild(child, 200)();
    const outcome = await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(() => resolve("still running"), 3_000)),
    ]);
    assert.deepEqual(outcome, { code: null, signal: "SIGKILL" });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
});

test("a verifier child that already exited is never signalled", () => {
  // Catches a late kill that could reach a reused process id.
  const child = Object.assign(new EventEmitter(), {
    pid: 1,
    kills: 0,
    kill() { this.kills += 1; return true; },
  });
  const stop = stoppableVerifierChild(child, 0);
  child.emit("exit");
  stop();
  assert.equal(child.kills, 0);
});
