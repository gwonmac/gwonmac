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

/** Catches that may decide without the helper, by file and a snippet of their block. */
const KEPT: readonly Readonly<{ file: string; snippet: string; reason: string }>[] = [
  { file: "wasm-evidence.ts", snippet: "error instanceof TypeError",
    reason: "a fatal TextDecoder reports invalid UTF-8 as a TypeError, a fact about the bytes" },
  { file: "enhancement-transform.ts", snippet: "WebAssembly.CompileError",
    reason: "only the compiler's reason is a refusal; any other error propagates" },
  { file: "pathing-spike-transform.ts", snippet: "WebAssembly.CompileError",
    reason: "only the compiler's reason is a refusal; any other error propagates" },
];

/** Whole files whose catches are not proof verdicts. */
const KEPT_FILES: Readonly<Record<string, string>> = {
  "client-module.ts": "launch preparation after the verdict: it carries the error to the launch, "
    + "which serves the official module, and stores no verdict",
  "cartography-spike-client.ts": "launch preparation after the verdict, as client-module.ts",
  // W-launch's branch owns these files and converts their catches; remove
  // each entry when that branch is merged here.
  "enhancement-structural-report.ts": "pending: W-launch's branch converts it",
  "extended-memory.ts": "pending: W-launch's branch converts it",
  "friend-observer-transform.ts": "pending: W-launch's branch converts it",
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
      const kept = KEPT.find((entry) => entry.file === file && block.includes(entry.snippet));
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
