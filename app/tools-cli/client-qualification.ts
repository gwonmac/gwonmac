/**
 * The release battery for one exact ArenaNet client: does the chain this
 * source ships prove on these bytes?
 *
 * It owns the list of checks that release qualification and the client watch
 * both run: the runtime verifier, native double-click and Cartography against
 * every servable predecessor, the 4 GB allocator proof, and the production
 * `prepareClientModule` chain for every release profile. Each check yields one
 * evidence record; a refused check never stops the others, so the watch still
 * collects every verdict. The real-client regression suite in
 * `tests/client-artifact/` is a separate job: it tests the verifier, not the
 * shipped chain.
 *
 * Evidence, never launch authority.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveCartographySpikeBuild } from
  "../client/certification/cartography-spike-verifier.js";
import { certificationFromLocalVerification } from
  "../client/certification/client-certification.js";
import { prepareClientModule } from "../client/certification/client-module.js";
import { supportedEnhancementCapabilities } from
  "../client/certification/enhancement-builds.js";
import { transformEnhancementWasm } from "../client/certification/enhancement-transform.js";
import {
  deriveExtendedMemoryStructuralProof,
  EXTENDED_MEMORY_JS_PROOF,
  EXTENDED_MEMORY_MAX_BYTES,
  prepareExtendedMemoryArtifacts,
  rewriteExtendedMemoryJs,
  rewriteExtendedMemoryWasm,
} from "../client/certification/extended-memory.js";
import { deriveFriendObserverBuild } from
  "../client/certification/friend-observer-transform.js";
import {
  isLocalClientVerification,
  type LocalClientVerification,
  verifyLocalClientBytes,
} from "../client/certification/local-client-verifier.js";
import {
  deriveNativeDoubleClickBuild,
  rewriteWithBuild,
} from "../client/certification/native-double-click.js";
import { rewriteTemplateSaveWasm } from
  "../client/certification/template-save-compat.js";
import {
  ENHANCEMENT_CAPABILITY_FIELDS,
  ENHANCEMENT_CAPABILITY_PRESETS,
  enhancementCapabilityProfile,
  NO_ENHANCEMENT_CAPABILITIES,
  RELEASE_ENHANCEMENT_CAPABILITIES,
  type EnhancementCapabilities,
} from "../shared/enhancement-contracts.js";

/** The WebAssembly members the allocator proof uses; `lib` is ES2022 only. */
interface WasmMemory {
  readonly buffer: ArrayBuffer;
  grow(pages: number): number;
}
declare const WebAssembly: {
  validate(bytes: Uint8Array): boolean;
  Module: {
    new (bytes: Uint8Array): object;
    imports(module: object): Array<{ module: string; name: string; kind: string }>;
  };
  instantiate(
    module: object,
    imports: Record<string, Record<string, unknown>>,
  ): Promise<{ exports: unknown }>;
};

const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

export const QUALIFICATION_CHECKS = [
  "runtime",
  "double-click",
  "cartography",
  "extended-memory",
  "chain",
] as const;

export type QualificationCheck = (typeof QUALIFICATION_CHECKS)[number];

/**
 * One check's evidence record: its report plus `status` and `exitCode`, the
 * shape `scripts/client-recertification-evidence.ts` reads. A check that threw
 * carries no report.
 */
export type QualificationRecord = Readonly<Record<string, unknown> & {
  status: "proved" | "refused";
  exitCode: 0 | 1;
}>;

/**
 * The runtime verifier for one official module, run once per capability set.
 * The verifier is a pure function of the bytes, the requested capabilities and
 * the reviewed generations, and one call costs seconds, so a battery that
 * reads the same verdict in several checks asks this instead of re-running it.
 */
export type ClientVerifier = (capabilities?: EnhancementCapabilities) => LocalClientVerification;

export function clientVerifier(official: Uint8Array): ClientVerifier {
  const verdicts = new Map<string, LocalClientVerification>();
  return (capabilities = ENHANCEMENT_CAPABILITY_PRESETS.all) => {
    const key = JSON.stringify(ENHANCEMENT_CAPABILITY_FIELDS.map((field) => capabilities[field]));
    let verdict = verdicts.get(key);
    if (!verdict) verdicts.set(key, verdict = verifyLocalClientBytes(official, capabilities));
    return verdict;
  };
}

interface RuntimePredecessor {
  readonly profile: string;
  readonly bytes: Uint8Array;
  readonly enhancementInputSha256?: string;
}

/** One canonical enumeration of every module the runtime can serve. */
export function runtimePredecessors(
  official: Uint8Array,
  verify: ClientVerifier = clientVerifier(official),
): Readonly<{
  officialSha256: string;
  predecessors: readonly RuntimePredecessor[];
}> {
  const officialSha256 = sha256(official);
  const verification = verify();
  const templateBuild = verification.templateSaveBuild;
  const selectedInput = templateBuild
    ? rewriteTemplateSaveWasm(official, templateBuild)
    : official;
  const enhancementInputSha256 = sha256(selectedInput);
  const predecessors: RuntimePredecessor[] = [
    { profile: templateBuild ? "file-compatible" : "official", bytes: selectedInput },
  ];
  for (const [launch, capabilities] of Object.entries(
    RELEASE_ENHANCEMENT_CAPABILITIES,
  )) {
    const profile = enhancementCapabilityProfile(capabilities);
    if (!profile) throw new Error(`invalid ${launch} release capability set`);
    const profileBuild = verify(capabilities).enhancementBuild;
    if (!profileBuild) throw new Error(`semantic verification refused profile ${profile}`);
    predecessors.push({
      profile,
      bytes: transformEnhancementWasm(selectedInput, profileBuild, capabilities),
      enhancementInputSha256,
    });
  }
  return Object.freeze({ officialSha256, predecessors: Object.freeze(predecessors) });
}

/** Every feature verdict of the runtime verifier; proved only when all prove. */
export function runtimeReport(
  official: Uint8Array,
  verify: ClientVerifier = clientVerifier(official),
): Readonly<{
  report: Readonly<Record<string, unknown>>;
  proved: boolean;
}> {
  const result = verify();
  if (!isLocalClientVerification(result, result.officialSha256)) {
    throw new Error("runtime feature verifier produced an invalid boundary result");
  }
  const featureVerdicts = result.featureVerdicts;
  const features = featureVerdicts === null
    ? null
    : Object.fromEntries(ENHANCEMENT_CAPABILITY_FIELDS.map((feature) => {
        const verdict = featureVerdicts[feature];
        return [feature, verdict.status === "ambiguous"
          ? {
              status: verdict.status,
              invariant: verdict.invariant,
              candidates: verdict.candidates,
            }
          : verdict.status === "changed"
            ? { status: verdict.status, invariant: verdict.invariant }
            : { status: verdict.status }];
      }));
  return Object.freeze({
    report: Object.freeze({
      officialSha256: result.officialSha256,
      fileVerdict: result.fileVerdict,
      templateSaving: result.templateSaveBuild !== null,
      verifierAbi: result.verifierAbi,
      features,
      capabilities: result.enhancementBuild
        ? supportedEnhancementCapabilities(result.enhancementBuild)
        : null,
      reasons: result.reasons,
    }),
    proved: result.templateSaveBuild !== null
      && features !== null
      && Object.values(features).every(({ status }) => status === "proved"),
  });
}

/**
 * Proves the native double-click route against each output of the whole chain.
 * Each result is one exact input/output transaction; there is no Cartesian
 * predecessor table to update when an unrelated capability profile changes.
 */
export function doubleClickReport(
  officialSha256: string,
  predecessors: readonly RuntimePredecessor[],
): Readonly<{ report: Readonly<Record<string, unknown>>; proved: boolean }> {
  const chains = predecessors.flatMap((predecessor) => {
    const inputSha256 = sha256(predecessor.bytes);
    const outputSha256 = deriveNativeDoubleClickBuild(predecessor.bytes)
      ?.derivations[inputSha256];
    return outputSha256 ? [Object.freeze({
      profile: predecessor.profile,
      inputSha256,
      outputSha256,
      ...(predecessor.enhancementInputSha256 === undefined
        ? {}
        : { enhancementInputSha256: predecessor.enhancementInputSha256 }),
    })] : [];
  });
  const completeRouteProved = chains.length === predecessors.length;
  return Object.freeze({
    report: Object.freeze({ officialSha256, chains, completeRouteProved }),
    proved: completeRouteProved,
  });
}

/** Proves Cartography against every predecessor the release can serve. */
export function cartographyReport(
  officialSha256: string,
  predecessors: readonly RuntimePredecessor[],
): Readonly<{ report: Readonly<Record<string, unknown>>; proved: boolean }> {
  const chains = predecessors.flatMap(({ profile, bytes }) => {
    const build = deriveCartographySpikeBuild(bytes);
    return build ? [{
      profile,
      inputSha256: build.inputSha256,
      outputSha256: build.outputSha256,
    }] : [];
  });
  const completeProof = chains.length === predecessors.length;
  return Object.freeze({
    report: Object.freeze({ officialSha256, chains, completeProof }),
    proved: completeProof,
  });
}

const verifyExtendedMemory = async (options: {
  jsPath: string;
  wasmPath: string;
}) => deriveExtendedMemoryStructuralProof(
  await readFile(options.jsPath, "utf8"),
  await readFile(options.wasmPath),
);

function withNativeDoubleClick(input: Uint8Array): Uint8Array {
  const build = deriveNativeDoubleClickBuild(input);
  if (!build) throw new Error("native double-click proof failed");
  return rewriteWithBuild(input, build);
}

/**
 * The 4 GB proof: the paired JS/WASM cache, production selection for every
 * release profile, and a real allocator that crosses 3 GiB and reuses a
 * freed block without growing.
 */
async function extendedMemoryReport(
  jsPath: string,
  wasmPath: string,
  officialWasm: Uint8Array,
  verify: ClientVerifier,
): Promise<Readonly<Record<string, unknown>>> {
  const officialJs = await readFile(jsPath, "utf8");
  const transformedJs = rewriteExtendedMemoryJs(officialJs);
  const jsInputSha256 = sha256(officialJs);
  const jsOutputSha256 = sha256(transformedJs);
  new Function(transformedJs);

  const verification = verify();
  if (!verification.templateSaveBuild || !verification.enhancementBuild) {
    throw new Error("official WASM did not pass the local semantic verifier");
  }
  const templateWasm = rewriteTemplateSaveWasm(officialWasm, verification.templateSaveBuild);

  const predecessors = new Map<string, Uint8Array>();
  predecessors.set("off", withNativeDoubleClick(templateWasm));
  for (const [launch, capabilities] of Object.entries(
    RELEASE_ENHANCEMENT_CAPABILITIES,
  )) {
    const profile = enhancementCapabilityProfile(capabilities);
    if (!profile) throw new Error(`invalid ${launch} release capability set`);
    const profileBuild = verify(capabilities).enhancementBuild;
    if (!profileBuild) {
      throw new Error(`semantic verification refused profile ${profile}`);
    }
    predecessors.set(
      profile,
      withNativeDoubleClick(
        transformEnhancementWasm(templateWasm, profileBuild, capabilities),
      ),
    );
  }

  const scratch = await mkdtemp(join(tmpdir(), "gwonmac-4gb-qualification-"));
  try {
    const predecessorPath = join(scratch, "Gw.jspi.wasm");
    const cacheRoot = join(scratch, "cache");
    const predecessor = predecessors.get("off");
    if (!predecessor) throw new Error("Enhancements-off predecessor is missing");
    await writeFile(predecessorPath, predecessor);
    const prepare = (predecessorSha256: string) => prepareExtendedMemoryArtifacts(
      jsPath, wasmPath, predecessorPath, predecessorSha256, "off", cacheRoot,
      verifyExtendedMemory,
    );
    const first = await prepare(sha256(predecessor));
    const cached = await prepare(sha256(predecessor));
    if (
      first?.profile !== "off"
      || cached?.jsPath !== first.jsPath
      || cached?.wasmPath !== first.wasmPath
    ) throw new Error("paired artifact cache did not reproduce its exact output");

    await writeFile(first.jsPath, "corrupt");
    const repaired = await prepare(sha256(predecessor));
    if (!repaired || sha256(await readFile(repaired.jsPath)) !== jsOutputSha256) {
      throw new Error("corrupt paired cache was not rebuilt from proof");
    }
    if (await prepare("0".repeat(64)) !== null) {
      throw new Error("4 GB preparation accepted a predecessor with the wrong chain hash");
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  const variants = [];
  let allocatorModule: Uint8Array | null = null;
  for (const [profile, predecessor] of predecessors) {
    const output = rewriteExtendedMemoryWasm(predecessor);
    if (!WebAssembly.validate(Uint8Array.from(output))) {
      throw new Error(`${profile} output does not validate`);
    }
    if (profile !== "off" && allocatorModule === null) allocatorModule = output;
    variants.push({ profile, inputSha256: sha256(predecessor), outputSha256: sha256(output) });
  }
  if (!allocatorModule) throw new Error("required qualification variant is missing");

  const selectionScratch = await mkdtemp(join(tmpdir(), "gwonmac-4gb-selection-"));
  try {
    const selections: Array<readonly [string, EnhancementCapabilities]> = [
      ["off", NO_ENHANCEMENT_CAPABILITIES],
    ];
    for (const [launch, capabilities] of Object.entries(
      RELEASE_ENHANCEMENT_CAPABILITIES,
    )) {
      const profile = enhancementCapabilityProfile(capabilities);
      if (!profile) throw new Error(`invalid ${launch} release capability set`);
      selections.push([profile, capabilities]);
    }
    for (const [profile, capabilities] of selections) {
      const profileRoot = join(selectionScratch, profile);
      const selected = await prepareClientModule({
        officialJsPath: jsPath,
        officialWasmPath: wasmPath,
        officialSha256: sha256(officialWasm),
        certification: certificationFromLocalVerification(verify(capabilities)),
        enhancementCapabilities: capabilities,
        compatibilityCacheRoot: join(profileRoot, "compatibility"),
        enhancementCacheRoot: join(profileRoot, "enhancements"),
        nativeDoubleClickCacheRoot: join(profileRoot, "double-click"),
        extendedMemoryCacheRoot: join(profileRoot, "extended-memory"),
        extendedMemoryEnabled: true,
      }, async ({ wasmPath: candidatePath }) =>
        deriveNativeDoubleClickBuild(await readFile(candidatePath)), verifyExtendedMemory);
      const predecessor = predecessors.get(profile);
      if (
        !predecessor
        || selected.extendedMemory.status !== "active"
        || selected.extendedMemory.profile !== profile
        || JSON.stringify(selected.effectiveCapabilities) !== JSON.stringify(capabilities)
        || !selected.nativeDoubleClick
        || sha256(await readFile(selected.jsPath)) !== jsOutputSha256
        || sha256(await readFile(selected.wasmPath))
          !== sha256(rewriteExtendedMemoryWasm(predecessor))
      ) throw new Error(`production client selection refused profile ${profile}`);
    }
  } finally {
    await rm(selectionScratch, { recursive: true, force: true });
  }

  const module = new WebAssembly.Module(Uint8Array.from(allocatorModule));
  const state: { memory?: WasmMemory } = {};
  const imports: Record<string, Record<string, unknown>> = {};
  for (const entry of WebAssembly.Module.imports(module)) {
    const namespace = (imports[entry.module] ??= {});
    if (entry.kind !== "function") {
      throw new Error(`unsupported ${entry.kind} import ${entry.module}.${entry.name}`);
    }
    namespace[entry.name] = entry.name === "emscripten_resize_heap"
      ? (requested: number) => {
          const memory = state.memory;
          if (!memory) throw new Error("heap growth requested during instantiation");
          const target = requested >>> 0;
          if (target > EXTENDED_MEMORY_MAX_BYTES) return 0;
          const current = memory.buffer.byteLength;
          if (target <= current) return 1;
          memory.grow(Math.ceil((target - current) / 65_536));
          return 1;
        }
      : () => 0;
  }
  const instance = await WebAssembly.instantiate(module, imports);
  // The allocator's exports, as the 4 GB transform's own proof names them.
  const exports = instance.exports as {
    memory: WasmMemory;
    malloc(bytes: number): number;
    free(pointer: number): void;
  };
  const memory = exports.memory;
  state.memory = memory;

  const allocationBytes = 480 * 1_024 * 1_024;
  const pointers: number[] = [];
  let highPointer: number | undefined;
  for (let index = 0; index < 7; index += 1) {
    const raw = exports.malloc(allocationBytes);
    if (raw === 0) throw new Error(`allocation ${index + 1} failed`);
    pointers.push(raw);
    if ((raw >>> 0) >= 0x8000_0000) highPointer ??= raw;
  }
  if (highPointer === undefined || memory.buffer.byteLength <= 0xc000_0000) {
    throw new Error("allocator did not grow above 3 GiB");
  }

  const highAddress = highPointer >>> 0;
  const view = new DataView(memory.buffer);
  view.setUint32(highAddress, 0x4757_3447, true);
  if (view.getUint32(highAddress, true) !== 0x4757_3447) {
    throw new Error("high-address read/write failed");
  }
  const capacityBeforeFree = memory.buffer.byteLength;
  for (const pointer of pointers) exports.free(pointer);
  const reused = exports.malloc(allocationBytes);
  if (reused === 0 || memory.buffer.byteLength !== capacityBeforeFree) {
    throw new Error("freed allocation was not reused without heap growth");
  }
  exports.free(reused);

  return Object.freeze({
    jsInputSha256,
    jsOutputSha256,
    normalizedJsSha256: EXTENDED_MEMORY_JS_PROOF.normalizedSha256,
    variants,
    heapBytes: capacityBeforeFree,
    highPointerUnsigned: highAddress,
    crossed3GiB: true,
    freedBlockReusedWithoutGrowth: true,
  });
}

/**
 * The production chain for each release profile, exactly as a launch serves
 * it: template, Enhancement, Friends, Cartography (Tools only), double-click
 * and 4 GB, then a corrupted final derivative that the cache must reproduce.
 */
async function shippedChainReport(
  jsPath: string,
  wasmPath: string,
  official: Uint8Array,
  verify: ClientVerifier,
): Promise<Readonly<Record<string, unknown>>> {
  const officialSha256 = sha256(official);
  const profiles = [];
  for (const [launch, capabilities] of Object.entries(RELEASE_ENHANCEMENT_CAPABILITIES)) {
    const cacheRoot = await mkdtemp(join(tmpdir(), `gwonmac-${launch}-chain-`));
    const fromFile = async (path: string, expectedSha256: string) => {
      const input = new Uint8Array(await readFile(path));
      if (sha256(input) !== expectedSha256) throw new Error(`${launch} input changed`);
      return input;
    };
    const prepare = () => prepareClientModule({
      officialWasmPath: wasmPath,
      officialJsPath: jsPath,
      officialSha256,
      certification: certificationFromLocalVerification(verify(capabilities)),
      enhancementCapabilities: capabilities,
      compatibilityCacheRoot: join(cacheRoot, "file"),
      enhancementCacheRoot: join(cacheRoot, "enhancement"),
      friendObserver: {
        cacheRoot: join(cacheRoot, "friends"),
        verifyLocally: async ({ wasmPath: input, inputSha256 }) =>
          deriveFriendObserverBuild(await fromFile(input, inputSha256)),
      },
      ...(launch === "tools" ? {
        cartographySpike: {
          cacheRoot: join(cacheRoot, "cartography"),
          verifyLocally: async ({ wasmPath: input, inputSha256 }) =>
            deriveCartographySpikeBuild(await fromFile(input, inputSha256)),
        },
      } : {}),
      nativeDoubleClickCacheRoot: join(cacheRoot, "double-click"),
      extendedMemoryCacheRoot: join(cacheRoot, "memory"),
      extendedMemoryEnabled: true,
    }, async ({ wasmPath: input, inputSha256 }) =>
      deriveNativeDoubleClickBuild(await fromFile(input, inputSha256)),
    verifyExtendedMemory);
    try {
      const served = async () => {
        const prepared = await prepare();
        if (
          prepared.failure !== null
          || JSON.stringify(prepared.effectiveCapabilities) !== JSON.stringify(capabilities)
          || prepared.friendObserver.status !== (capabilities.travelAction ? "active" : "disabled")
          || prepared.cartography.status !== (launch === "tools" ? "active" : "disabled")
          || !prepared.nativeDoubleClick
          || prepared.extendedMemory.status !== "active"
          || sha256(await readFile(prepared.wasmPath)) !== prepared.wasmSha256
        ) throw new Error(`the ${launch} launch did not serve its complete chain`);
        return prepared;
      };
      const prepared = await served();
      // A matching cache directory is not authority: a corrupted final
      // derivative must be rebuilt to the same hash from its exact input.
      await writeFile(prepared.wasmPath, "stale release qualification cache");
      const rebuilt = await served();
      if (rebuilt.wasmSha256 !== prepared.wasmSha256) {
        throw new Error(`the ${launch} launch did not reproduce its output`);
      }
      profiles.push({
        profile: enhancementCapabilityProfile(capabilities),
        outputSha256: prepared.wasmSha256,
      });
    } finally {
      await rm(cacheRoot, { recursive: true, force: true });
    }
  }
  return Object.freeze({ officialSha256, profiles });
}

type Check = () =>
  | Readonly<{ report: Readonly<Record<string, unknown>>; proved: boolean }>
  | Promise<Readonly<{ report: Readonly<Record<string, unknown>>; proved: boolean }>>;

async function record(name: string, check: Check): Promise<QualificationRecord> {
  try {
    const { report, proved } = await check();
    return proved
      ? Object.freeze({ ...report, status: "proved", exitCode: 0 })
      : Object.freeze({ ...report, status: "refused", exitCode: 1 });
  } catch (error) {
    // Stderr only: the record may be published, a message is not reviewed.
    process.stderr.write(`qualify ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
    return Object.freeze({ status: "refused", exitCode: 1 });
  }
}

const proved = async (report: Promise<Readonly<Record<string, unknown>>>) =>
  ({ report: await report, proved: true });

/**
 * Runs every check once, in one process, against one exact client. The checks
 * share one verifier run per capability set: three runs instead of fourteen.
 */
export async function qualifyClient(
  wasmPath: string,
  jsPath: string,
): Promise<Readonly<Record<QualificationCheck, QualificationRecord>>> {
  const official = new Uint8Array(await readFile(wasmPath));
  const verify = clientVerifier(official);
  let servable: ReturnType<typeof runtimePredecessors> | undefined;
  const predecessors = () => (servable ??= runtimePredecessors(official, verify));
  return Object.freeze({
    runtime: await record("runtime", () => runtimeReport(official, verify)),
    "double-click": await record("double-click", () =>
      doubleClickReport(predecessors().officialSha256, predecessors().predecessors)),
    cartography: await record("cartography", () =>
      cartographyReport(predecessors().officialSha256, predecessors().predecessors)),
    "extended-memory": await record("extended-memory", () =>
      proved(extendedMemoryReport(jsPath, wasmPath, official, verify))),
    chain: await record("chain", () => proved(shippedChainReport(jsPath, wasmPath, official, verify))),
  });
}
