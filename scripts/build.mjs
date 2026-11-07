// The single producer of everything under build/.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

// package.json's `engines` is the one declaration of the floor, and this is
// where it stops a build. Every entry point reaches the compiler through this
// file, and an older Node fails somewhere further in — on a flag it does not
// have, or on syntax it cannot strip — as a defect in the step rather than as
// an unmet requirement.
/** @type {{ engines?: { node?: string } }} */
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const declaredNode = manifest.engines?.node;
const nodeFloor = /^>=(\d+)\.(\d+)$/u.exec(declaredNode ?? "");
if (nodeFloor === null) {
  throw new Error(
    `package.json engines.node must be a >=<major>.<minor> floor, not ${declaredNode}`,
  );
}
const [floor, floorMajor = "0", floorMinor = "0"] = nodeFloor;
const [runningMajor = 0, runningMinor = 0] = process.versions.node
  .split(".")
  .map(Number);
if (
  runningMajor < Number(floorMajor)
  || (runningMajor === Number(floorMajor) && runningMinor < Number(floorMinor))
) {
  throw new Error(
    `Node ${floor} is required; this is ${process.versions.node}. `
      + "See the Requirements in README.md.",
  );
}

const nativeArchitecture =
  process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x86_64" : null;
if (nativeArchitecture === null) {
  throw new Error(`unsupported native build architecture: ${process.arch}`);
}

/** What `cargo` runs for both kernels; .cargo/config.toml holds the flags. */
export const CARGO_ARGS = ["build", "--release", "--locked"];

/**
 * @typedef {object} Step
 * @property {string} name     what the log calls it
 * @property {string} command  the executable
 * @property {readonly string[]} args
 */

/**
 * Every command that produces a package input, as phases. The steps in one
 * phase write disjoint paths under build/ and run at the same time; a phase
 * starts when the one before it has finished. Exported so the plan itself is
 * assertable: each kernel is compiled by exactly one step and sealed after the
 * renderer bundle that holds its loader.
 *
 * @type {ReadonlyArray<ReadonlyArray<Step>>}
 */
export const BUILD_PHASES = [
  [
    // The renderer's static assets, its ES modules, and the three sandboxed
    // preloads, which Rollup bundles with the app/shared modules they import.
    // TypeScript checks the same sources without emitting; only the main
    // compiler below writes build/shared.
    { name: "renderer", command: process.execPath, args: ["scripts/build-renderer.mjs"] },
    // The main program, and the owner of build/shared.
    { name: "main", command: process.execPath, args: ["node_modules/typescript/bin/tsc"] },
    // The launcher is a standalone Vue document. Vite owns only
    // build/renderer/launcher/, and build/renderer/settings/: the same Settings
    // page as a module for the Hub.
    { name: "launcher", command: "pnpm", args: ["--filter", "@gwonmac/launcher-ui", "build"] },
    // The Tools application and the Hub's view (hub-app.js, which Core loads
    // too), bundled once for the renderer. Vite writes and empties only
    // build/renderer/tools/.
    { name: "tools", command: "pnpm", args: ["--filter", "@gwonmac/tools-ui", "build:embedded"] },
    // The only native addon. It uses raw Node-API version 8, whose ABI remains
    // stable across the Node and Electron upgrades this project takes. The
    // framework APIs resolve at runtime from the Electron host, so the bundle
    // deliberately leaves Node-API symbols undefined here.
    {
      name: "host.node",
      command: "xcrun",
      args: [
        "clang++",
        "-std=c++20",
        "-fobjc-arc",
        "-bundle",
        "-undefined",
        "dynamic_lookup",
        "-DNAPI_VERSION=8",
        "-I",
        "node_modules/node-api-headers/include",
        "-mmacosx-version-min=12.0",
        "-arch",
        nativeArchitecture,
        "-O2",
        "-Wall",
        "-Wextra",
        "-Werror",
        "-fvisibility=hidden",
        "app/native/host/host.mm",
        "-framework",
        "AppKit",
        "-framework",
        "Foundation",
        "-framework",
        "LocalAuthentication",
        "-framework",
        "Security",
        "-o",
        "build/native/host.node",
      ],
    },
    // The Guild Wars archive decoder. A separate executable rather than a second
    // addon: it is hand-transcribed x86 (see app/native/gw-dat/vendor/README.md)
    // parsing the player's own game files, and a malformed record should fail one
    // decode rather than take the application down with it. It is spawned once
    // per asset and the result is cached on disk, so the process boundary costs
    // about four milliseconds, once, per icon that is ever looked at.
    //
    // -Wall/-Wextra/-Werror are deliberately not applied: this is vendored source
    // carried unmodified, and the -D/-Wno flags stand in for MSVC builtins clang
    // lacks rather than patching it. The third silences a warning about an `&&`
    // that reads like a typo and is not one — app/native/gw-dat/vendor/README.md
    // records why changing it would break the decode.
    {
      name: "gw-dat-decode",
      command: "xcrun",
      args: [
        "clang++",
        "-std=c++20",
        "-mmacosx-version-min=12.0",
        "-arch",
        nativeArchitecture,
        "-O2",
        "-D__int64=long long",
        "-Wno-multichar",
        "-Wno-constant-logical-operand",
        "-Iapp/native/gw-dat",
        "app/native/gw-dat/decoder-main.cpp",
        "app/native/gw-dat/vendor/gwdat/xentax.cpp",
        "app/native/gw-dat/vendor/gwdat/AtexReader.cpp",
        "app/native/gw-dat/vendor/gwdat/AtexDecompress.cpp",
        "app/native/gw-dat/vendor/gwdat/AtexAsm.cpp",
        "-o",
        "build/native/gw-dat-decode",
      ],
    },
    // Both Rust kernels, from the Cargo workspace at the repository root;
    // rust-toolchain.toml pins the compiler. Cargo writes only target/, so an
    // unchanged kernel is not recompiled, and nothing is served until sealed.
    { name: "kernels", command: "cargo", args: CARGO_ARGS },
  ],
  [
    // Validates each kernel's fixed ABI, seals its digest into the loader the
    // renderer step emitted, and only then publishes it beside that loader.
    { name: "seal", command: process.execPath, args: ["scripts/kernels.mjs", "seal"] },
  ],
];

/**
 * Runs one step with its output held back, so steps that run together print
 * whole logs rather than interleaved lines.
 *
 * @param {Step} step
 * @returns {Promise<void>}
 */
function run({ name, command, args }) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    /** @type {Buffer[]} */
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => output.push(chunk));
    child.on("error", (error) => {
      // The `code` that says the executable is missing is only on the Node
      // runtime's `SystemError` shape, so ask whether it is there.
      reject("code" in error && error.code === "ENOENT"
        ? new Error(`${command} is not installed. See the Requirements in README.md.`)
        : error);
    });
    child.on("close", (status) => {
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      const log = Buffer.concat(output).toString("utf8").trimEnd();
      console.log(`== ${name} (${seconds} s)${log ? `\n${log}` : ""}`);
      if (status === 0) resolve();
      else reject(new Error(`build step ${name} failed with status ${status}`));
    });
  });
}

async function build() {
  const started = performance.now();
  rmSync("build", { recursive: true, force: true });
  mkdirSync("build/native", { recursive: true });
  for (const phase of BUILD_PHASES) {
    const failed = (await Promise.allSettled(phase.map(run)))
      .find((result) => result.status === "rejected");
    if (failed) {
      console.error(failed.reason instanceof Error ? failed.reason.message : failed.reason);
      process.exit(1);
    }
  }
  console.log(`built in ${((performance.now() - started) / 1000).toFixed(1)} s`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await build();
}
