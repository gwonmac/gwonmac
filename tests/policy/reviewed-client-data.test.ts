// Every app/client/certification/reviewed-client-*.ts file is reviewed data:
// one client's facts, read by proofs that re-derive them from the bytes. Code
// in such a file would be reviewed as data and could compute a fact instead of
// stating it. So a generation file holds only type imports and `const`
// declarations whose values are literals: strings, numbers, booleans, null,
// arrays, objects, `Object.freeze(...)`, `as const`, and the names of earlier
// constants in the same file. Each file is self-contained, so editing or
// deleting one generation never changes another one's facts.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  newGenerationSource,
  withDraftedAlternatives,
  withDraftedEffectBodies,
} from "../../app/tools-cli/generation-file.js";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/client/certification");

function violations(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const declared = new Set<string>();
  const report = (node: ts.Node, what: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    found.push(`${line}: ${what}`);
  };
  const describe = (node: ts.Node) => `${ts.SyntaxKind[node.kind]} ${node.getText(source).replace(/\s+/gu, " ").slice(0, 60)}`;
  const literal = (node: ts.Expression): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)
      || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword
      || node.kind === ts.SyntaxKind.NullKeyword) return;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return;
    if (ts.isParenthesizedExpression(node)) return literal(node.expression);
    if (ts.isAsExpression(node) && ts.isTypeReferenceNode(node.type) && node.type.typeName.getText(source) === "const") {
      return literal(node.expression);
    }
    if (ts.isIdentifier(node) && declared.has(node.text)) return;
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        if (ts.isSpreadElement(element)) report(element, describe(element));
        else literal(element);
      }
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name)) literal(property.initializer);
        else report(property, describe(property));
      }
      return;
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === "Object.freeze" && node.arguments.length === 1) {
      return literal(node.arguments[0]!);
    }
    report(node, describe(node));
  };
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!statement.importClause?.isTypeOnly) report(statement, `value import ${statement.moduleSpecifier.getText(source)}`);
    } else if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          report(declaration, describe(declaration));
          continue;
        }
        literal(declaration.initializer);
        declared.add(declaration.name.text);
      }
    } else {
      report(statement, describe(statement));
    }
  }
  return found;
}

test("every reviewed-client generation file is data only", () => {
  const files = readdirSync(directory).filter((file) => /^reviewed-client-.+\.ts$/u.test(file));
  assert.ok(files.length > 0);
  for (const file of files) {
    assert.deepEqual(violations(file, readFileSync(path.join(directory, file), "utf8")), [], file);
  }
});

test("the data rule refuses code in a generation file", () => {
  assert.deepEqual(violations("good.ts", [
    'import type { ClientGeneration } from "./reviewed-facts.js";',
    'const BUILD = Object.freeze({ sha256: "ab", hookParams: Object.freeze(["i32"] as const), offset: -4, last: null });',
    'export const FACTS: ClientGeneration = Object.freeze<ClientGeneration>({ id: "x", builds: [BUILD], on: true });',
  ].join("\n")), []);
  assert.deepEqual(violations("bad.ts", [
    'import { sha256 } from "./hash.js";',
    "let mutable = 1;",
    'const DIGEST = sha256("bytes");',
    "const SHIFTED = 1 << 4;",
    "const COPY = { ...LATER };",
    "export function derive() { return 1; }",
    "const LATER = {};",
  ].join("\n")), [
    '1: value import "./hash.js"',
    "2: FirstStatement let mutable = 1;",
    '3: CallExpression sha256("bytes")',
    "4: BinaryExpression 1 << 4",
    "5: SpreadAssignment ...LATER",
    "6: FunctionDeclaration export function derive() { return 1; }",
  ]);
});

test("review --apply writes a generation file that stays data only", () => {
  // Catches a writer change that would put code into a generation file, which
  // this rule then refuses only after a maintainer applied a review.
  const literal = "1".repeat(64);
  const alternatives = { [literal]: ["2".repeat(64), { bodyLength: 40, fingerprint: "3".repeat(64) }] };
  const effects = { [literal]: "4".repeat(64) };
  const note = "Review 2099-01-01-000000000000 (quickItemMove): the same function in the same role.";
  const read = (file: string) => readFileSync(path.join(directory, file), "utf8");
  const written: Record<string, string> = {
    created: newGenerationSource("2099-01-01-000000000000", alternatives, note, effects),
    "created, effects only": newGenerationSource("2099-01-01-000000000000", {}, note, effects),
    "alternatives added to a facts block": withDraftedAlternatives(
      read("reviewed-client-2026-11-03-f2a2b07c9c56.ts"), alternatives, note),
    "a facts block added to a generation without one": withDraftedAlternatives(
      read("reviewed-client-2026-10-01-7b4c3548d670.ts"), alternatives, note),
    "effect bodies added": withDraftedEffectBodies(read("reviewed-client-2026-08-build-1eb07e32.ts"), effects, note),
  };
  for (const [name, source] of Object.entries(written)) assert.deepEqual(violations(`${name}.ts`, source), [], name);
});
