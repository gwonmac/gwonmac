/**
 * A certification catch turns only a refusal into "no proof". The launch
 * stores each build's verdict until the next app update, so a catch that also
 * swallowed a fault (a bug's TypeError, a failed allocation's RangeError)
 * would switch a Tool off for good on a client the next start would prove.
 * Every catch under app/client/certification/ must start by deciding through
 * `refusedOrRethrow`, except the ones named here with their reason. Files
 * exempt as a whole hold launch preparation, so no checked file may import
 * them at run time.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const DIRECTORY = "app/client/certification";

type Kept = Readonly<{ file: string; snippet: string; reason: string }>;

/** Catches that may decide without the helper, by file and a snippet of their own try/catch. */
const KEPT: readonly Kept[] = [
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

/** The index of the brace that closes the block opening at `open`. */
function closeOf(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return index;
  }
  return source.length - 1;
}

/** The index of the brace that opens the block closing at `close`. */
function openOf(source: string, close: number): number {
  let depth = 0;
  for (let index = close; index >= 0; index -= 1) {
    if (source[index] === "}") depth += 1;
    if (source[index] === "{" && --depth === 0) return index;
  }
  return 0;
}

/** Each catch in `source` that neither starts with the helper nor is a kept entry, as `file:line`. */
function violationsIn(file: string, source: string, used: Map<Kept, number>): string[] {
  const violations: string[] = [];
  const at = (index: number) => `${file}:${source.slice(0, index).split("\n").length}`;
  for (const match of source.matchAll(/\bcatch\s*(?:\(\s*(\w+)\s*(?::\s*\w+\s*)?\))?\s*\{/gu)) {
    const open = match.index + match[0].length - 1;
    const close = closeOf(source, open);
    const tryClose = source.slice(0, match.index).trimEnd().length - 1;
    const tryCatch = source[tryClose] === "}" ? source.slice(openOf(source, tryClose), close + 1) : "";
    const kept = KEPT.find((entry) => entry.file === file && tryCatch.includes(entry.snippet));
    if (kept) {
      used.set(kept, (used.get(kept) ?? 0) + 1);
      continue;
    }
    const name = match[1];
    const body = source.slice(open + 1, close).replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/u, "");
    if (!name || !new RegExp(`^(?:return\\s+)?refusedOrRethrow\\(${name}\\);`, "u").test(body)) {
      violations.push(at(match.index));
    }
  }
  for (const match of source.matchAll(/\.catch\(/gu)) violations.push(at(match.index));
  return violations;
}

/** Run-time imports of whole-file exemptions from `source`. */
function exemptImportsIn(file: string, source: string): string[] {
  return [...source.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+"\.\/([\w.-]+)\.js";/gmu)]
    .map((match) => `${match[1]}.ts`)
    .filter((imported) => imported in KEPT_FILES)
    .map((imported) => `${file} imports ${imported}`);
}

test("every certification catch rethrows what is not a refusal", async () => {
  const files = (await readdir(DIRECTORY)).filter((file) => file.endsWith(".ts"));
  const violations: string[] = [];
  const used = new Map<Kept, number>();
  for (const file of files) {
    if (file in KEPT_FILES) continue;
    const source = await readFile(path.join(DIRECTORY, file), "utf8");
    violations.push(...violationsIn(file, source, used), ...exemptImportsIn(file, source));
  }
  assert.deepEqual(violations, []);
  // Each kept entry names exactly one catch; one whose catch is gone leaves the list.
  assert.deepEqual(KEPT.filter((entry) => used.get(entry) !== 1), []);
});

// Each form would let a fault through as a refusal while the scan above stayed green.
for (const [name, file, source, expected] of [
  ["a typed binding that swallows", "proof.ts",
    "try { f(); } catch (error: unknown) { return null; }", ["proof.ts:1"]],
  ["a helper call behind a condition", "proof.ts",
    "try { f(); } catch (error) { if (x) refusedOrRethrow(error); return null; }", ["proof.ts:1"]],
  ["a bare catch right after a kept one", "extended-memory.ts",
    "try { verifyChunkHash(hash, bytes); } catch { return false; }\ntry { g(); } catch { return null; }",
    ["extended-memory.ts:2"]],
  ["a promise handler that swallows", "proof.ts", "await f().catch(() => null);", ["proof.ts:1"]],
  ["a typed binding that decides first", "proof.ts",
    "try { f(); } catch (error: unknown) {\n  // a refusal is no proof\n  return refusedOrRethrow(error);\n}", []],
] as const) {
  test(`catch scan flags ${name}`, () => {
    assert.deepEqual(violationsIn(file, source, new Map()), expected);
  });
}

test("a checked file may import a whole-file exemption only for its types", () => {
  assert.deepEqual(exemptImportsIn("pass.ts", [
    'import { enhancementCandidates } from "./client-module.js";',
    'import type { ClientCertification } from "./client-module.js";',
    'export type { ClientCertification } from "./client-module.js";',
  ].join("\n")), ["pass.ts imports client-module.ts"]);
});
