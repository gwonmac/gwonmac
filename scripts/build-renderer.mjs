// Everything a window loads that is not Vue: the renderer's static assets, the
// game renderer's ES modules, and the three sandboxed preloads.
//
// A sandboxed preload may `require` only `electron`, so each preload entry is
// bundled with the shared modules it imports into one CommonJS file. That is
// what lets app/preload import the canonical channels from app/shared instead
// of carrying a copy of them.
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { rollup } from "rollup";
import { copyRendererAssets } from "./copy-renderer.mjs";

const rendererInputs = [
  "diagnostics",
  "commands",
  "loading",
  "harness",
].map((name) => path.resolve(`app/renderer/${name}.ts`));

/** One sandboxed preload entry per window type, and the file it is built to. */
export const PRELOADS = Object.freeze({
  core: { entry: "app/preload/core.ts", output: "build/preload/preload-core.cjs" },
  tools: { entry: "app/preload/tools.ts", output: "build/preload/preload-tools.cjs" },
  launcher: { entry: "app/preload/launcher.ts", output: "build/preload/preload-launcher.cjs" },
});

/** @type {import("rollup").Plugin} */
const typescript = {
  name: "app-typescript",
  resolveId(source, importer) {
    if (importer === undefined || !source.startsWith(".")) return null;
    const resolved = path.resolve(path.dirname(importer), source);
    const typescriptSource = resolved.replace(/\.js$/u, ".ts");
    return existsSync(typescriptSource) ? typescriptSource : null;
  },
  transform(code, id) {
    if (!id.endsWith(".ts")) return null;
    const result = ts.transpileModule(code, {
      fileName: id,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        sourceMap: true,
      },
    });
    return { code: result.outputText, map: result.sourceMapText };
  },
};

/**
 * app/shared freezes its tables where it declares them. Rollup cannot tell
 * that freezing a fresh value has no other effect, so it keeps every table a
 * preload's modules declare. Marking only those declaration-time freezes pure
 * lets an unused table leave the bundle; the Core preload must not contain the
 * Tools channels at all. A freeze whose result is unused, like the bridge's
 * own, is untouched: a pure call with an unused result would be dropped.
 *
 * @param {string} root repository root
 * @returns {import("rollup").Plugin}
 */
function sharedTablesArePure(root) {
  const shared = path.resolve(root, "app/shared") + path.sep;
  return {
    name: "shared-tables-are-pure",
    transform(code, id) {
      if (!id.startsWith(shared)) return null;
      return {
        code: code.replace(/(=\s*)Object\.freeze\(/gu, "$1/* @__PURE__ */ Object.freeze("),
        map: null,
      };
    },
  };
}

/** @param {string} entry @param {string} [root] repository root */
function preloadBuild(entry, root = process.cwd()) {
  return rollup({
    input: path.resolve(root, entry),
    plugins: [typescript, sharedTablesArePure(root)],
    // The one module the sandbox loader provides. Anything else unresolved is
    // a module the sandbox cannot load, so it fails the build here.
    external: ["electron"],
    // A preload carries only what it uses: no app/shared module is imported
    // for its side effects, so one whose exports a preload does not use leaves
    // the bundle. Do not declare `Object.freeze` pure here: Rollup would then
    // drop every freeze whose result is unused, the bridge's own included.
    treeshake: { moduleSideEffects: false },
    onwarn(warning) {
      throw new Error(`preload bundle ${entry}: ${warning.message}`);
    },
  });
}

/** @type {import("rollup").OutputOptions} */
const preloadOutput = { format: "cjs", sourcemap: false };

/**
 * One preload as the source it ships, without writing it. For tests that
 * execute the real bridge without a build.
 *
 * @param {keyof typeof PRELOADS} name
 * @param {string} [root] repository root
 */
export async function preloadSource(name, root) {
  const bundle = await preloadBuild(PRELOADS[name].entry, root);
  try {
    const { output } = await bundle.generate(preloadOutput);
    return output[0].code;
  } finally {
    await bundle.close();
  }
}

/** @param {keyof typeof PRELOADS} name */
async function writePreload(name) {
  const bundle = await preloadBuild(PRELOADS[name].entry);
  try {
    await bundle.write({ ...preloadOutput, file: path.resolve(PRELOADS[name].output) });
  } finally {
    await bundle.close();
  }
}

async function writeRenderer() {
  const bundle = await rollup({ input: rendererInputs, plugins: [typescript] });
  try {
    await bundle.write({
      dir: path.resolve("build/renderer"),
      format: "es",
      preserveModules: true,
      preserveModulesRoot: path.resolve("app/renderer"),
      entryFileNames: "[name].js",
      sourcemap: true,
    });
  } finally {
    await bundle.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // The assets and every bundle write disjoint files, so they run together.
  copyRendererAssets();
  await Promise.all([
    writeRenderer(),
    ...Object.keys(PRELOADS).map((name) =>
      writePreload(/** @type {keyof typeof PRELOADS} */ (name))
    ),
  ]);
  console.log("bundled renderer and preloads -> build/renderer, build/preload");
}
