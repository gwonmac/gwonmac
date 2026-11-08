/**
 * The utility process the local client proof runs inside: read the official
 * WebAssembly and JavaScript once, confirm they are the ones that were asked
 * for, run one verifier pass over every launch profile, and report after each
 * profile.
 *
 * Isolation is the whole point. The verifier walks a multi-megabyte module this
 * project did not produce, so it runs where a crash or a runaway loop costs the
 * launch nothing. The host owns the time budget; this process holds no state
 * and writes no files.
 *
 * The first profile is the one this launch is waiting for. After reporting it,
 * the process lowers its own priority so the rest of the pass does not compete
 * with the game starting. Every refusal posts `null` and sets its own exit
 * code, which closes the parent's wait at once; the parent still validates
 * every non-null message.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { constants, setPriority } from "node:os";
import {
  runClientVerificationPass,
  type ClientVerificationLaunch,
} from "./client-verification-pass.js";

interface ParentPort {
  postMessage(value: unknown): void;
}

const parentPort = (
  process as NodeJS.Process & { parentPort?: ParentPort }
).parentPort;

const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

function parseLaunches(value: string): ClientVerificationLaunch[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 8) return null;
    const launches: ClientVerificationLaunch[] = [];
    const items: readonly unknown[] = parsed;
    for (const item of items) {
      if (
        !item || typeof item !== "object"
        || !("requestedProfile" in item) || typeof item.requestedProfile !== "string"
        || !("cartography" in item) || typeof item.cartography !== "boolean"
      ) return null;
      launches.push({ requestedProfile: item.requestedProfile, cartography: item.cartography });
    }
    return launches;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const [mode, wasmPath, wasmSha256, jsPath, jsSha256, launchesJson, memory] =
    process.argv.slice(2);
  const launches = launchesJson ? parseLaunches(launchesJson) : null;
  if (
    !parentPort || mode !== "pass"
    || !wasmPath || !wasmSha256 || !jsPath || !jsSha256 || !launches
    || (memory !== "memory-first" && memory !== "memory-later")
  ) {
    parentPort?.postMessage(null);
    process.exitCode = 2;
    return;
  }
  const [wasm, js] = await Promise.all([readFile(wasmPath), readFile(jsPath, "utf8")]);
  if (sha256(wasm) !== wasmSha256 || sha256(js) !== jsSha256) {
    parentPort.postMessage(null);
    process.exitCode = 3;
    return;
  }
  const port = parentPort;
  let reported = false;
  await runClientVerificationPass(wasm, js, launches, (result, complete) => {
    port.postMessage({ complete, result });
    if (reported) return;
    reported = true;
    try {
      setPriority(constants.priority.PRIORITY_BELOW_NORMAL);
    } catch {
      // Priority is a courtesy to the starting game, not a requirement.
    }
  }, { extendedMemoryFirst: memory === "memory-first" });
}

await main().catch(() => {
  parentPort?.postMessage(null);
  process.exitCode = 1;
});
