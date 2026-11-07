// scripts/build.mjs is the single build producer. copy-renderer.mjs runs
// to completion without a Rust toolchain, copies assets and no code, and emits
// no kernel; the build step list compiles both kernels in exactly one cargo
// step and seals them only after the renderer bundle that holds their loaders.
// Rollup is the only renderer runtime producer; the main compiler is the only
// producer of build/shared.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { BUILD_STEPS, CARGO_ARGS } from "../../scripts/build.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Every artwork URL used by the unbundled calculator must survive static copying.
const currencyImages = [...readFileSync(path.join(repoRoot, "app/shared/currency-assets.ts"), "utf8")
  .matchAll(/new URL\('\.\/(images\/[^']+)'/gu)].map(match => match[1]!);

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function rendererCheckout(): string {
  const root = mkdtempSync(path.join(tmpdir(), "gw-renderer-"));
  roots.push(root);
  const write = (relative: string, contents: string) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };
  write("app/renderer/index.html", "<!doctype html>\n");
  write("app/renderer/loading.js", "export {};\n");
  write("app/renderer/gw-native.d.ts", "export {};\n");
  write("app/renderer/favicon.ico", "ico");
  write("app/renderer/favicon.png", "png");
  write("app/renderer/harness.css", "css");
  write("app/renderer/cartography-overlay-controls.css", "controls-css");
  write("app/renderer/character-switch.css", "character-css");
  write("app/renderer/hub.css", "hub-css");
  write("app/renderer/loading.css", "css");
  write("app/renderer/fonts.css", "font-css");
  write("app/renderer/fonts/COPYING-QUALITYPE", "licence");
  write("app/renderer/fonts/QTFrizQuad.otf", "font");
  write("app/renderer/images/logo.webp", "webp");
  write("app/renderer/images/playstation-controller-prompts.png", "controller-png");
  write("website/public/bg-reforged.jpg", "landscape");
  write("app/renderer/.DS_Store", "local metadata");
  write("app/renderer/images/local-note.txt", "untracked");
  // The design system is a package input that does not live under app/renderer:
  // the Tools application reads it too, and app/ui/tools/** may only reach app/shared.
  write("app/shared/ui/tokens.css", "tokens");
  write("app/shared/ui/components.css", "components");
  write("app/shared/ui/frame/body.png", "frame-body");
  write("app/shared/ui/frame/header.png", "frame-header");
  for (let profession = 1; profession <= 10; profession += 1) {
    write(`app/shared/images/professions/${profession}.png`, `profession-${profession}`);
  }
  for (const image of currencyImages) write(`app/shared/${image}`, image);
  write("node_modules/@fontsource-variable/inter/wght.css", "inter-css");
  write("node_modules/@fontsource-variable/inter/LICENSE", "inter-licence");
  for (const subset of [
    "cyrillic-ext",
    "cyrillic",
    "greek-ext",
    "greek",
    "latin-ext",
    "latin",
    "vietnamese",
  ]) {
    write(
      `node_modules/@fontsource-variable/inter/files/inter-${subset}-wght-normal.woff2`,
      `inter-${subset}`,
    );
  }
  return root;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

describe("scripts/copy-renderer.mjs only copies assets", () => {
  const root = rendererCheckout();
  // PATH empty: rustc — and every other command — is unreachable.
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "copy-renderer.mjs")],
    { cwd: root, encoding: "utf8", env: { ...process.env, PATH: "" } },
  );

  it("succeeds without a Rust toolchain", () => {
    assert.equal(result.status, 0, result.stderr);
  });

  it("still produces the renderer tree and its static media", () => {
    assert.equal(
      readFileSync(path.join(root, "build/renderer/index.html"), "utf8"),
      "<!doctype html>\n",
    );
    assert.equal(
      readFileSync(path.join(root, "build/renderer/fonts/COPYING-QUALITYPE"), "utf8"),
      "licence",
    );
    assert.equal(
      readFileSync(
        path.join(root, "build/renderer/images/playstation-controller-prompts.png"),
        "utf8",
      ),
      "controller-png",
    );
    assert.equal(
      readFileSync(path.join(root, "build/renderer/images/bg-reforged.jpg"), "utf8"),
      "landscape",
    );
    // Not the preloads: build-renderer.mjs bundles those.
    assert.equal(existsSync(path.join(root, "build/preload")), false);
  });

  it("copies no code, because Rollup emits build/renderer's JavaScript", () => {
    const code = filesUnder(path.join(root, "build")).filter(
      (file) => file.endsWith(".js") || file.endsWith(".ts"),
    );
    assert.deepEqual(code, []);
  });

  it("copies only declared package inputs", () => {
    const relative = filesUnder(path.join(root, "build/renderer"))
      .map((file) => path.relative(path.join(root, "build/renderer"), file))
      .sort();
    assert.deepEqual(relative, [
      "cartography-overlay-controls.css",
      "character-switch.css",
      "favicon.ico",
      "favicon.png",
      "fonts.css",
      "fonts/COPYING-INTER",
      "fonts/COPYING-QUALITYPE",
      "fonts/QTFrizQuad.otf",
      "fonts/files/inter-cyrillic-ext-wght-normal.woff2",
      "fonts/files/inter-cyrillic-wght-normal.woff2",
      "fonts/files/inter-greek-ext-wght-normal.woff2",
      "fonts/files/inter-greek-wght-normal.woff2",
      "fonts/files/inter-latin-ext-wght-normal.woff2",
      "fonts/files/inter-latin-wght-normal.woff2",
      "fonts/files/inter-vietnamese-wght-normal.woff2",
      "fonts/inter.css",
      "harness.css",
      "hub.css",
      "images/bg-reforged.jpg",
      "images/logo.webp",
      "images/playstation-controller-prompts.png",
      "index.html",
      "loading.css",
      ...currencyImages.map(image => `shared/${image}`).sort(),
      "shared/images/professions/1.png",
      "shared/images/professions/10.png",
      "shared/images/professions/2.png",
      "shared/images/professions/3.png",
      "shared/images/professions/4.png",
      "shared/images/professions/5.png",
      "shared/images/professions/6.png",
      "shared/images/professions/7.png",
      "shared/images/professions/8.png",
      "shared/images/professions/9.png",
      // Copied out of app/shared, and flattened to `ui/` so the renderer and
      // the Tools bundle load the one design system by the same href.
      "shared/ui/frame/body.png",
      "shared/ui/frame/header.png",
      "ui/components.css",
      "ui/tokens.css",
    ]);
  });

  it("emits no WebAssembly", () => {
    const emitted = filesUnder(path.join(root, "build")).filter((file) =>
      file.endsWith(".wasm"),
    );
    assert.deepEqual(emitted, []);
  });
});

/**
 * One step's argument list. `scripts/build.mjs` is JavaScript, so its step list
 * infers as arrays of `string | string[]` and cannot say that position 1 is
 * always the arguments. Asserting the shape rather than assuming it means a
 * step list that stopped being command-and-arguments pairs fails here, instead
 * of every `includes` below quietly answering about a command string.
 */
function stepArgs(step: (typeof BUILD_STEPS)[number]): string[] {
  const args = step[1];
  assert.ok(
    Array.isArray(args),
    `build step ${String(step[0])} carries no argument list`,
  );
  return args;
}

/**
 * Where the one step whose arguments mention `needle` sits in the list.
 * Positions are read from the step list rather than written down here, so the
 * assertions below stay about the ordering that matters and survive a step
 * being inserted anywhere in it.
 */
function stepPosition(needle: string): number {
  const found = BUILD_STEPS.map((step, index) => ({ step, index })).filter(
    ({ step }) => stepArgs(step).includes(needle),
  );
  assert.equal(found.length, 1, `${needle} is not run by exactly one build step`);
  return found[0]!.index;
}

describe("scripts/build.mjs owns both sealed kernel builds", () => {
  it("compiles both kernels in exactly one cargo step and never with raw rustc", () => {
    assert.deepEqual(
      BUILD_STEPS.filter(([command]) => command === "cargo").map(stepArgs),
      [[...CARGO_ARGS]],
    );
    assert.equal(BUILD_STEPS.some(([command]) => command === "rustc"), false);
  });

  it("seals only after the kernels and the renderer bundle holding their loaders", () => {
    const sealer = stepPosition("scripts/kernels.mjs");
    const kernels = BUILD_STEPS.findIndex(([command]) => command === "cargo");
    assert.ok(sealer > kernels && sealer > stepPosition("scripts/build-renderer.mjs"));
  });
});

/**
 * A project as `tsc` resolves it, read through the compiler rather than
 * `JSON.parse` so the `//` comments in these files stay legal and the paths are
 * the absolute ones the compiler will emit to.
 */
function projectOptions(file: string): ts.CompilerOptions {
  const configPath = path.join(repoRoot, file);
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(error, undefined, `${file} could not be read`);
  const parsed = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    repoRoot,
    undefined,
    configPath,
  );
  assert.deepEqual(parsed.errors, [], `${file} does not parse`);
  return parsed.options;
}

describe("renderer typechecking does not emit runtime files", () => {
  const main = projectOptions("tsconfig.json");
  const renderer = projectOptions("tsconfig.renderer.json");

  it("leaves build/shared to the main compiler", () => {
    assert.equal(renderer.noEmit, true);
    assert.equal(renderer.outDir, undefined);
    assert.equal(main.noEmit, undefined);
    assert.equal(main.outDir, path.join(repoRoot, "build"));
  });

  it("has one explicit renderer runtime producer", () => {
    assert.equal(stepPosition("scripts/build-renderer.mjs") >= 0, true);
    assert.equal(
      BUILD_STEPS.some((step) => stepArgs(step).includes("tsconfig.renderer.json")),
      false,
    );
  });
});
