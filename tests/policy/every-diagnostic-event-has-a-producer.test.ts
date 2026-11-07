/**
 * A diagnostic event the schema declares but no code names is dead contract:
 * the export would accept it, docs and readers may expect it, and nothing
 * ever writes it. Every producer names its event as a string literal, either
 * directly (`k: "settings.reset"`) or in a closed list such as
 * `RENDERER_MILESTONES`, so an event no source outside the schema names has
 * no producer.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DIAGNOSTIC_EVENT_SCHEMA } from "../../app/main/diagnostics/schema.ts";

const SCHEMA_SOURCES = /^app\/main\/diagnostics\/schema(?:-[a-z-]+)?\.ts$/u;

async function sourcesOutsideTheSchema(): Promise<string> {
  const entries = await readdir("app", { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.includes("node_modules") && !SCHEMA_SOURCES.test(file));
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

test("every diagnostic event in the schema is named by code outside the schema", async () => {
  const source = await sourcesOutsideTheSchema();
  const unnamed = Object.keys(DIAGNOSTIC_EVENT_SCHEMA).filter(
    (name) => !source.includes(`"${name}"`) && !source.includes(`'${name}'`),
  );
  assert.deepEqual(unnamed, []);
});
