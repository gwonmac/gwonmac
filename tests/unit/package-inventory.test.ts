import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { ignorePackageFile, SHIPPED_PATHS } from "../../scripts/package-ignore.ts";
import { relativeEsmClosure } from "../helpers/package-inventory.ts";

const root = path.resolve(import.meta.dirname, "../..");
// tsc compiles app/<path>.ts to build/<path>.js (tsconfig.json rootDir/outDir).
const source = (built: string) => path.join(root, "app", built.replace(/^\/build\//u, "").replace(/\.js$/u, ".ts"));

/** Forge copies a file only when the filter admits it and every directory above it. */
function ships(file: string): boolean {
  const parts = file.split("/").slice(1);
  return parts.every((_, index) => !ignorePackageFile(`/${parts.slice(0, index + 1).join("/")}`));
}

// The packaged inventory proof needs a macOS build; this catches a shipped
// tree missing from the filter (build/features, dfd4b927) in `pnpm test`.
test("every module the main process imports at run time ships", () => {
  const closure = relativeEsmClosure({
    entryPoints: ["/build/main/main.js"],
    inventory: { has: (file) => existsSync(source(file)) },
    // Transpiled like the build, so type-only imports are no runtime edges.
    readText: (file) => ts.transpileModule(readFileSync(source(file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  });
  assert.ok([...closure].some((file) => file.startsWith("/build/features/")), "the walk reached the feature folders");
  assert.deepEqual([...closure].filter((file) => !ships(file)), []);
});

test("the filter admits the shipped paths and refuses developer files", () => {
  for (const file of [...SHIPPED_PATHS.files, "/build/main/main.js", "/node_modules/ws/lib/websocket.js"]) {
    assert.equal(ships(file), true, file);
  }
  for (const file of ["/build/main/main.js.map", "/build/shared/x.d.ts", "/build/tools-cli/certification.js", "/node_modules/pngjs/browser.js", "/scripts/release.ts"]) {
    assert.equal(ships(file), false, file);
  }
});
