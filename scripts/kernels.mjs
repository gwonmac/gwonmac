// Seals and verifies the two Rust kernels that one `cargo build` compiles.
//
//   node scripts/kernels.mjs seal    (a build step, after the renderer bundle)
//   node scripts/kernels.mjs verify  (before packaging)
//
// Sealing validates each kernel's fixed ABI, writes its SHA-256 into the
// loader the renderer bundle emitted, checked before the bytes are compiled,
// and only then publishes the kernel beside it. A kernel that fails
// validation never reaches the served path.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CARGO_ARGS } from "./build.mjs";
import {
  COMPANION_KERNEL_EXPORT_VALUES,
  validateCompanionKernelContract,
} from "./companion-kernel-contract.mjs";
import { validateCartographyReachabilityKernelContract } from
  "./cartography-reachability-kernel-contract.mjs";

/** Where `cargo build --release` writes for the target .cargo/config.toml sets. */
const CARGO_OUTPUT = "wasm32-unknown-unknown/release";

/** The statement each loader must check the seal before. */
export const COMPILE_MARKER =
  "const kernelModule = await WebAssembly.compile(kernelBytes);";

/**
 * @typedef {object} Kernel
 * @property {string} label   the name in errors, and in the sealed loader's own
 * @property {string} source  the crate root
 * @property {string} candidate  what cargo writes, under its target directory
 * @property {string} artifact   the served kernel
 * @property {string} loader     the bundled loader that receives the seal
 * @property {string} binding    the sealed constant's name in that loader
 * @property {(bytes: Uint8Array) => WebAssembly.Module} validate  the ABI contract
 */

/** @type {Readonly<Record<"companion" | "reachability", Kernel>>} */
export const KERNELS = Object.freeze({
  companion: {
    label: "Companion kernel",
    source: "kernels/companion/lib.rs",
    candidate: `${CARGO_OUTPUT}/lib.wasm`,
    artifact: "build/renderer/companion-kernel.wasm",
    loader: "build/renderer/companion-kernel-loader.js",
    binding: "COMPANION_KERNEL_SEALED_SHA256",
    validate: validateCompanionKernelContract,
  },
  reachability: {
    label: "Cartography reachability kernel",
    source: "kernels/reachability/lib.rs",
    candidate: `${CARGO_OUTPUT}/reachability_kernel.wasm`,
    artifact: "build/renderer/cartography-reachability-kernel.wasm",
    loader: "build/renderer/cartography-spike/reachability-kernel.js",
    binding: "CARTOGRAPHY_REACHABILITY_SEALED_SHA256",
    validate: validateCartographyReachabilityKernelContract,
  },
});

/** @param {Uint8Array} bytes */
export function kernelSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** @param {Kernel} kernel @param {string} source @param {string} expectedSha256 */
export function verifySealedLoader(kernel, source, expectedSha256) {
  const declaration = new RegExp(`const ${kernel.binding} = "([a-f0-9]{64})";`, "g");
  const matches = [...source.matchAll(declaration)];
  if (matches.length !== 1 || matches[0]?.[1] !== expectedSha256) {
    throw new Error(`${kernel.label} seal is missing or does not match`);
  }
  const comparisonAt = source.indexOf(`kernelSha256 !== ${kernel.binding}`);
  const compileAt = source.indexOf(COMPILE_MARKER);
  if (comparisonAt < 0 || compileAt < 0 || comparisonAt > compileAt) {
    throw new Error(`${kernel.label} seal is not checked before compilation`);
  }
}

/** @param {Kernel} kernel @param {string} source @param {string} sha256 */
export function sealLoaderSource(kernel, source, sha256) {
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error(`${kernel.label} seal is not a SHA-256 digest`);
  }
  if (source.includes(kernel.binding)) {
    throw new Error(`${kernel.label} loader already contains a seal`);
  }
  if (source.split(COMPILE_MARKER).length !== 2) {
    throw new Error(`${kernel.label} loader compile boundary is not unique`);
  }
  const sealed = source.replace(
    COMPILE_MARKER,
    `const ${kernel.binding} = "${sha256}"; `
      + `if (kernelSha256 !== ${kernel.binding}) { `
      + `throw new Error("${kernel.label} integrity check failed"); } `
      + COMPILE_MARKER,
  );
  verifySealedLoader(kernel, sealed, sha256);
  return sealed;
}

/**
 * Validate cargo's output, publish the sealed loader, then the kernel, each
 * through an atomic rename. The candidate stays where cargo wrote it, so an
 * unchanged kernel is not recompiled. If any step fails, the kernel is
 * removed and the original loader restored.
 *
 * @param {Kernel} kernel
 * @param {{candidatePath?: string, artifactPath?: string, loaderPath?: string}} [paths]
 */
export function sealKernel(kernel, paths = {}) {
  const candidatePath = paths.candidatePath ?? path.join(cargoTargetDir(), kernel.candidate);
  const artifactPath = paths.artifactPath ?? kernel.artifact;
  const loaderPath = paths.loaderPath ?? kernel.loader;
  const loaderTemp = `${loaderPath}.seal-${process.pid}.tmp`;
  const artifactTemp = `${artifactPath}.seal-${process.pid}.tmp`;
  const restoreTemp = `${loaderPath}.restore-${process.pid}.tmp`;
  let loader;
  let loaderMode;
  let loaderPublished = false;
  try {
    const candidate = readFileSync(candidatePath);
    kernel.validate(candidate);
    const sha256 = kernelSha256(candidate);
    loader = readFileSync(loaderPath, "utf8");
    loaderMode = statSync(loaderPath).mode & 0o777;
    writeFileSync(loaderTemp, sealLoaderSource(kernel, loader, sha256), { mode: loaderMode });
    renameSync(loaderTemp, loaderPath);
    loaderPublished = true;
    writeFileSync(artifactTemp, candidate);
    renameSync(artifactTemp, artifactPath);
    verifySealedLoader(kernel, readFileSync(loaderPath, "utf8"), sha256);
    if (kernelSha256(readFileSync(artifactPath)) !== sha256) {
      throw new Error(`published ${kernel.label} changed during sealing`);
    }
    return sha256;
  } catch (error) {
    // The artifact is the activation boundary. Never leave one behind from a
    // failed seal, and restore the original loader after a later failure.
    rmSync(artifactPath, { force: true });
    if (loaderPublished && loader !== undefined && loaderMode !== undefined) {
      try {
        writeFileSync(restoreTemp, loader, { mode: loaderMode });
        renameSync(restoreTemp, loaderPath);
      } catch {
        rmSync(restoreTemp, { force: true });
      }
    }
    throw error;
  } finally {
    rmSync(loaderTemp, { force: true });
    rmSync(artifactTemp, { force: true });
    rmSync(restoreTemp, { force: true });
  }
}

/** Cargo's target directory, as cargo resolves it from the repository root. */
function cargoTargetDir() {
  return process.env.CARGO_TARGET_DIR ?? "target";
}

/**
 * The companion kernel's behaviour at its boundary: a panic is a bounded trap,
 * instantiation writes nothing into game memory, every size export answers the
 * contract, and dispatch returns safely before initialisation.
 *
 * @param {WebAssembly.Module} module
 */
function verifyCompanionBehaviour(module) {
  const source = readFileSync(KERNELS.companion.source, "utf8");
  const panicStart = source.indexOf("fn panic(");
  const panicEnd = source.indexOf("\n}", panicStart);
  assert.notEqual(panicStart, -1, "kernel panic handler is missing");
  assert.notEqual(panicEnd, -1, "kernel panic handler is malformed");
  const panicSource = source.slice(panicStart, panicEnd + 2);
  assert.match(
    panicSource,
    /wasm32::unreachable\(\)/u,
    "kernel panic handler must terminate as a bounded Wasm trap",
  );
  assert.doesNotMatch(
    panicSource,
    /loop\s*\{/u,
    "kernel panic handler must never spin on the game callback stack",
  );

  const memory = new WebAssembly.Memory({ initial: 256 });
  const lowGameMemory = new Uint8Array(memory.buffer, 0x10_0000, 512);
  lowGameMemory.fill(0xa5);
  const beforeInstantiation = lowGameMemory.slice();
  /** @param {number} value */
  const immutableI32 = (value) => new WebAssembly.Global(
    { value: "i32", mutable: false },
    value,
  );
  const instance = new WebAssembly.Instance(module, {
    env: {
      memory,
      __indirect_function_table: new WebAssembly.Table({
        initial: 0,
        maximum: 0,
        element: "anyfunc",
      }),
      __memory_base: immutableI32(0x20_0000),
      __stack_pointer: new WebAssembly.Global(
        { value: "i32", mutable: true },
        0x21_0000,
      ),
      __table_base: immutableI32(0),
    },
  });
  assert.deepEqual(
    lowGameMemory,
    beforeInstantiation,
    "kernel instantiation wrote through its old fixed game-memory addresses",
  );
  /** @param {string} name */
  function exportedFunction(name) {
    const value = instance.exports[name];
    if (typeof value !== "function") throw new Error(`missing function ${name}`);
    return value;
  }
  // From the contract module rather than written out here, so the numbers a
  // human changes live where the unit suite already reads them.
  for (const [name, expected] of Object.entries(COMPANION_KERNEL_EXPORT_VALUES)) {
    assert.equal(exportedFunction(name)(), expected, name);
  }
  assert.equal(exportedFunction("companion_cursor_event_count")(), 0);
  assert.equal(
    exportedFunction("companion_dispatch")(0xffff_ffff, 0, 0, 0, 0, 0),
    undefined,
    "companion dispatch must return void for the game table signature",
  );
  for (const kind of [0, 1, 2, 3, 0x7fff_ffff, 0xffff_ffff]) {
    assert.doesNotThrow(
      () => exportedFunction("companion_dispatch")(
        kind,
        0xffff_ffff,
        0x8000_0000,
        0x7fff_ffff,
        0xffff_ffff,
        0x8000_0000,
      ),
      `uninitialised dispatch kind ${kind} did not return safely`,
    );
  }
}

/**
 * Re-checks a finished build: each served kernel still meets its contract and
 * matches its loader's seal, and a clean cargo build reproduces it byte for byte.
 */
function verifyKernels() {
  /** @type {Map<Kernel, Buffer>} */
  const served = new Map();
  for (const kernel of Object.values(KERNELS)) {
    const bytes = readFileSync(kernel.artifact);
    const module = kernel.validate(bytes);
    verifySealedLoader(kernel, readFileSync(kernel.loader, "utf8"), kernelSha256(bytes));
    if (kernel === KERNELS.companion) verifyCompanionBehaviour(module);
    served.set(kernel, bytes);
  }

  const scratch = mkdtempSync(path.join(tmpdir(), "gw-kernels-"));
  try {
    const result = spawnSync("cargo", [...CARGO_ARGS, "--target-dir", scratch], {
      stdio: "inherit",
    });
    assert.equal(result.status, 0, "kernel reproducibility build failed");
    for (const [kernel, bytes] of served) {
      assert.deepEqual(
        readFileSync(path.join(scratch, kernel.candidate)),
        bytes,
        `${kernel.label} build is not reproducible`,
      );
      console.log(`verified ${kernel.label} ${kernelSha256(bytes)}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const command = process.argv[2];
  if (command === "seal") {
    for (const kernel of Object.values(KERNELS)) {
      console.log(`sealed ${kernel.label} ${sealKernel(kernel)}`);
    }
  } else if (command === "verify") {
    verifyKernels();
  } else {
    console.error("usage: node scripts/kernels.mjs seal|verify");
    process.exit(2);
  }
}
