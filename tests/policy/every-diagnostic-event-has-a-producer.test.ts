/**
 * A diagnostic event the schema declares but nothing writes is dead contract:
 * the export would accept it, docs and readers may expect it, and nothing
 * ever produces it. An event counts as produced only in a producer form:
 *
 * - main writes it as the `k` of a `logEvent` record, directly
 *   (`k: "settings.reset"`) or as one branch of a conditional `k`;
 * - the renderer sends it from one of the closed vocabularies below, which
 *   main records under the same name.
 *
 * A name that only appears in a type, a comment or another list does not count.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DIAGNOSTIC_EVENT_SCHEMA } from "../../app/main/diagnostics/schema.ts";
import { RENDERER_EVENT_NAMES, RENDERER_MILESTONES } from "../../app/shared/diagnostics.ts";

/** Event names the renderer produces and main records verbatim. */
const RENDERER_VOCABULARIES: ReadonlySet<string> = new Set([
  ...RENDERER_EVENT_NAMES,
  ...RENDERER_MILESTONES,
]);

const SCHEMA_SOURCES = /^app\/main\/diagnostics\/schema(?:-[a-z-]+)?\.ts$/u;

async function sourcesOutsideTheSchema(): Promise<string> {
  const entries = await readdir("app", { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.includes("node_modules") && !SCHEMA_SOURCES.test(file));
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

/** `k:` up to the end of its value, with `name` as one of the value's literals. */
function writtenAsK(source: string, name: string): boolean {
  const literal = name.replaceAll(".", "\\.");
  return new RegExp(`\\bk:[^,;{}]*?["']${literal}["']`, "u").test(source);
}

test("every diagnostic event in the schema has a producer", async () => {
  const source = await sourcesOutsideTheSchema();
  const unproduced = Object.keys(DIAGNOSTIC_EVENT_SCHEMA).filter(
    (name) => !RENDERER_VOCABULARIES.has(name) && !writtenAsK(source, name),
  );
  assert.deepEqual(unproduced, []);
});
