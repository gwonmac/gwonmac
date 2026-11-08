/**
 * A diagnostic event the schema declares but nothing writes is dead contract:
 * the export would accept it, docs and readers may expect it, and nothing
 * ever produces it. An event counts as produced only in a producer form:
 *
 * - main passes `{ k: "<name>", ... }` to one of PRODUCERS, where `k` is a
 *   string literal or a conditional between string literals; a span producer
 *   may return that record from its `finish` arrow;
 * - the renderer sends it from one of the closed vocabularies below, which
 *   main records under the same name.
 *
 * A name that only appears in a type, an interface, a comment or another list
 * does not count. The source is parsed, not searched as text.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { DIAGNOSTIC_EVENT_SCHEMA } from "../../app/main/diagnostics/schema.ts";
import { RENDERER_EVENT_NAMES, RENDERER_MILESTONES } from "../../app/shared/diagnostics.ts";

/** The calls that write a diagnostic record, by their callee as written. */
const PRODUCERS: ReadonlySet<string> = new Set([
  "logEvent",
  "recordEvent",
  "closedAppSpan",
  "closedOwnerSpan",
  // GameReloader receives logEvent as an injected dependency.
  "this.dependencies.record",
]);

/** Event names the renderer produces and main records verbatim. */
const RENDERER_VOCABULARIES: ReadonlySet<string> = new Set([
  ...RENDERER_EVENT_NAMES,
  ...RENDERER_MILESTONES,
]);

const SCHEMA_SOURCES = /^app\/main\/diagnostics\/schema(?:-[a-z-]+)?\.ts$/u;

function unwrap(node: ts.Expression): ts.Expression {
  return ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
}

/** The string literals a `k` value can take. */
function literalNames(value: ts.Expression): string[] {
  const node = unwrap(value);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) {
    return [...literalNames(node.whenTrue), ...literalNames(node.whenFalse)];
  }
  return [];
}

/** Event names of the records an argument of a producer call writes. */
function recordNames(argument: ts.Expression): string[] {
  const node = unwrap(argument);
  if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) return recordNames(node.body);
  if (ts.isConditionalExpression(node)) {
    return [...recordNames(node.whenTrue), ...recordNames(node.whenFalse)];
  }
  if (!ts.isObjectLiteralExpression(node)) return [];
  return node.properties.flatMap((property) =>
    ts.isPropertyAssignment(property)
      && ts.isIdentifier(property.name)
      && property.name.text === "k"
      ? literalNames(property.initializer)
      : []);
}

/** Every event name a producer call in `sourceText` writes. */
function producedNames(sourceText: string, file = "source.ts"): Set<string> {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && PRODUCERS.has(node.expression.getText(source))) {
      for (const argument of node.arguments) {
        for (const name of recordNames(argument)) names.add(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

function sourcesOutsideTheSchema(): string[] {
  return readdirSync("app", { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.includes("node_modules") && !SCHEMA_SOURCES.test(file));
}

test("every diagnostic event in the schema has a producer", () => {
  const produced = new Set(RENDERER_VOCABULARIES);
  for (const file of sourcesOutsideTheSchema()) {
    for (const name of producedNames(readFileSync(file, "utf8"), file)) produced.add(name);
  }
  const unproduced = Object.keys(DIAGNOSTIC_EVENT_SCHEMA).filter((name) => !produced.has(name));
  assert.deepEqual(unproduced, []);
});

test("an event named only in a type or a comment is not produced", () => {
  const source = `
    type ResetEvent = { k: "settings.reset" };
    interface Reset { readonly k: "settings.reset" }
    // logEvent({ k: "settings.reset" });
    const names = ["settings.reset"];
    record({ k: "settings.reset" });
  `;
  assert.deepEqual([...producedNames(source)], []);
  assert.deepEqual(
    [...producedNames(`logEvent({ k: ready ? "settings.reset" : "settings.loadFailed" });`)],
    ["settings.reset", "settings.loadFailed"],
  );
});
