// Every app/client/certification/reviewed-client-*.ts file is reviewed data:
// one client's facts, read by proofs that re-derive them from the bytes. Code
// in such a file would be reviewed as data and could compute a fact instead of
// stating it. So a generation file holds only type imports and `const`
// declarations whose values are literals: strings, numbers, booleans, null,
// arrays, objects, `Object.freeze(...)`, `as const`, and the names of earlier
// constants in the same file.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/client/certification");

// Files that break the rule, with every violation. Each entry must still match
// exactly, so a fixed file fails until its entry goes.
const KNOWN: Readonly<Record<string, readonly string[]>> = {
  // The October 22 rebuild reuses the October 22 build record.
  "reviewed-client-2026-10-22-5f149ad09879.ts": [
    '9: value import "./reviewed-client-2026-10-22-ce3192033b14.js"',
    "11: NonNullExpression OCTOBER_22_FACTS.builds[0]!",
    "17: SpreadAssignment ...OCTOBER_22_BUILD",
  ],
};

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
    assert.deepEqual(violations(file, readFileSync(path.join(directory, file), "utf8")), KNOWN[file] ?? [], file);
  }
  assert.deepEqual(Object.keys(KNOWN).filter((file) => !files.includes(file)), [], "KNOWN names a deleted file");
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
