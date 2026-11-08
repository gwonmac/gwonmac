/**
 * A certification catch turns only a refusal into "no proof". The launch
 * stores each build's verdict until the next app update, so a catch that also
 * swallowed a fault (a bug's TypeError, a failed allocation's RangeError)
 * would switch a Tool off for good on a client the next start would prove.
 * Every catch under app/client/certification/ must decide through
 * `refusedOrRethrow`, except the ones named here with their reason.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const DIRECTORY = "app/client/certification";

/** Catches that may decide without the helper, by file and a snippet of the code up to their end. */
const KEPT: readonly Readonly<{ file: string; snippet: string; reason: string }>[] = [
  { file: "wasm-evidence.ts", snippet: "error instanceof TypeError",
    reason: "a fatal TextDecoder reports invalid UTF-8 as a TypeError, a fact about the bytes" },
  { file: "enhancement-transform.ts", snippet: "WebAssembly.CompileError",
    reason: "only the compiler's reason is a refusal; any other error propagates" },
  { file: "pathing-spike-transform.ts", snippet: "WebAssembly.CompileError",
    reason: "only the compiler's reason is a refusal; any other error propagates" },
  { file: "client-verification-pass.ts", snippet: "if (!isStageRefusal(error)) failedStages.add(stage);",
    reason: "the pass records a fault as a stage it could not check instead of rethrowing it" },
  { file: "extended-memory.ts", snippet: "wasmHash === proof.wasmOutputSha256",
    reason: "a cached 4 GB module that cannot be read is rebuilt; no verdict" },
  { file: "extended-memory.ts", snippet: "verifyPublishedClientArtifacts(artifactsDir, manifest)",
    reason: "an unreadable published client is not used; no verdict" },
  { file: "extended-memory.ts", snippet: "verifyChunkHash(hash",
    reason: "an unreadable chunk is not used; no verdict" },
  { file: "extended-memory.ts", snippet: "wasmOutput = rewriteExtendedMemoryWasm(wasmInput);",
    reason: "launch preparation: the launch serves the official module and stores nothing" },
];

/** Whole files whose catches are not proof verdicts. */
const KEPT_FILES: Readonly<Record<string, string>> = {
  "client-module.ts": "launch preparation after the verdict: it carries the error to the launch, "
    + "which serves the official module, and stores no verdict",
  "cartography-spike-client.ts": "launch preparation after the verdict, as client-module.ts",
  "local-client-verifier-host.ts": "supervises the verifier process; a failed start reports no verdict",
  "local-client-verifier-process.ts": "reads its launch arguments and lowers its own priority",
  "verifier-child-stop.ts": "a kill signal to a child that already exited",
};

/** The block that starts at `open`, by brace depth. */
function blockAt(source: string, open: number): string {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(open, index + 1);
  }
  return source.slice(open);
}

test("every certification catch rethrows what is not a refusal", async () => {
  const files = (await readdir(DIRECTORY)).filter((file) => file.endsWith(".ts"));
  const violations: string[] = [];
  const used = new Set<(typeof KEPT)[number]>();
  for (const file of files) {
    if (file in KEPT_FILES) continue;
    const source = await readFile(path.join(DIRECTORY, file), "utf8");
    for (const match of source.matchAll(/\bcatch\s*(?:\(\s*(\w+)\s*\))?\s*\{/gu)) {
      const line = source.slice(0, match.index).split("\n").length;
      const block = blockAt(source, match.index + match[0].length - 1);
      const name = match[1];
      const upToEnd = source.slice(Math.max(0, match.index - 300), match.index + match[0].length - 1 + block.length);
      const kept = KEPT.find((entry) => entry.file === file && upToEnd.includes(entry.snippet));
      if (kept) {
        used.add(kept);
      } else if (!name || !block.includes(`refusedOrRethrow(${name})`)) {
        violations.push(`${file}:${line}`);
      }
    }
  }
  assert.deepEqual(violations, []);
  // A kept entry whose catch is gone must leave the list too.
  assert.deepEqual(KEPT.filter((entry) => !used.has(entry)), []);
});
