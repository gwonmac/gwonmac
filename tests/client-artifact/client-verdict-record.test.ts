/**
 * The stored verifier pass on the real client: a proved build survives the
 * record round trip (JSON, HMAC, acceptance boundary, stage guards) and the
 * next launch serves the same module from it without running a pass.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { certificationFromLocalVerification } from
  "../../app/client/certification/client-certification.js";
import { prepareClientModule } from "../../app/client/certification/client-module.js";
import {
  runClientVerificationPass,
  type ClientVerificationLaunch,
} from "../../app/client/certification/client-verification-pass.js";
import {
  createVerifierPassSlot,
  obtainClientVerdict,
  type ClientVerdict,
  type RunVerifierPass,
} from "../../app/client/client-verdict.js";
import {
  enhancementCapabilityProfile,
  RELEASE_ENHANCEMENT_CAPABILITIES,
} from "../../app/shared/enhancement-contracts.js";

const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

const CORE: ClientVerificationLaunch = {
  requestedProfile: enhancementCapabilityProfile(RELEASE_ENHANCEMENT_CAPABILITIES.core)!,
  cartography: false,
};
const TOOLS: ClientVerificationLaunch = {
  requestedProfile: enhancementCapabilityProfile(RELEASE_ENHANCEMENT_CAPABILITIES.tools)!,
  cartography: true,
};

test("a proved real client is served from its signed record with no pass", {
  timeout: 900_000,
}, async () => {
  const artifact = process.env.GW_CLIENT_WASM;
  const glue = process.env.GW_CLIENT_JS;
  assert.ok(artifact, "GW_CLIENT_WASM must name the real Gw.jspi.wasm artifact");
  assert.ok(glue, "GW_CLIENT_JS must name the matching real Gw.jspi.js artifact");
  const official = new Uint8Array(await readFile(artifact));
  const officialJs = await readFile(glue, "utf8");
  const root = await mkdtemp(join(tmpdir(), "gw-client-verdict-record-"));
  const installKey = Buffer.alloc(32, 7);
  const slot = createVerifierPassSlot();
  let passes = 0;
  // The real pass in this process. Each answer crosses a structured clone, as
  // it does over the utility-process channel.
  const runPass: RunVerifierPass = ({ launches, extendedMemoryFirst }) => {
    passes += 1;
    let requested!: (value: unknown) => void;
    let complete!: (value: unknown) => void;
    const pass = {
      requested: new Promise<unknown>((resolve) => { requested = resolve; }),
      complete: new Promise<unknown>((resolve) => { complete = resolve; }),
      background: () => {},
      cancel: () => complete(null),
    };
    void runClientVerificationPass(official, officialJs, launches, (result, done) => {
      requested(structuredClone(result));
      if (done) complete(structuredClone(result));
    }, { extendedMemoryFirst }).catch(() => complete(null));
    return pass;
  };
  const launch = (requested: ClientVerificationLaunch) => obtainClientVerdict({
    recordPath: join(root, "client-verdict.json"),
    appVersion: "1.0.0",
    installKey: async () => installKey,
    wasmPath: artifact,
    wasmSha256: sha256(official),
    jsPath: glue,
    jsSha256: sha256(officialJs),
    launch: requested,
    releaseLaunches: [CORE, TOOLS],
    extendedMemoryRequested: false,
    runPass,
    slot,
    launchBudgetMs: 900_000,
  });
  const prepare = (verdict: ClientVerdict, extendedMemoryEnabled: boolean, cache: string) => {
    const lookup = <Build>(find: (inputSha256: string) => Build | null) =>
      async ({ inputSha256 }: { inputSha256: string }) => find(inputSha256);
    const caches = join(root, cache);
    return prepareClientModule({
      officialWasmPath: artifact,
      officialJsPath: glue,
      officialSha256: sha256(official),
      certification: certificationFromLocalVerification(verdict.verification),
      enhancementCapabilities: RELEASE_ENHANCEMENT_CAPABILITIES.tools,
      compatibilityCacheRoot: join(caches, "file"),
      enhancementCacheRoot: join(caches, "enhancement"),
      friendObserver: { cacheRoot: join(caches, "friends"), verifyLocally: lookup(verdict.friendObserver) },
      cartographySpike: { cacheRoot: join(caches, "cartography"), verifyLocally: lookup(verdict.cartography) },
      nativeDoubleClickCacheRoot: join(caches, "double-click"),
      extendedMemoryCacheRoot: join(caches, "memory"),
      extendedMemoryEnabled,
    }, lookup(verdict.nativeDoubleClick), async ({ jsInputSha256, wasmInputSha256 }) =>
      verdict.extendedMemory(jsInputSha256, wasmInputSha256));
  };
  const served = (module: Awaited<ReturnType<typeof prepare>>) => ({
    wasmSha256: module.wasmSha256,
    failure: module.failure,
    effective: module.effectiveCapabilities,
    nativeDoubleClick: module.nativeDoubleClick,
    friendObserver: module.friendObserver.status,
    cartography: module.cartography.status,
    extendedMemory: module.extendedMemory.status,
  });
  try {
    const first = await launch(TOOLS);
    assert.equal(first.source, "pass");
    assert.ok(first.verdict, "the real client must pass the acceptance boundary");
    assert.deepEqual(first.verdict.failedStages, []);
    assert.equal(await first.stored, "stored");

    const again = await launch(TOOLS);
    const toggled = await launch(CORE);
    assert.equal(passes, 1, "a stored build must not run the verifier again");
    assert.equal(again.source, "record");
    assert.equal(toggled.source, "record");
    assert.ok(again.verdict);
    assert.ok(toggled.verdict, "the record must hold the other release launch too");
    assert.deepEqual(again.verdict.failedStages, []);

    const fromPass = served(await prepare(first.verdict, false, "pass"));
    const fromRecord = served(await prepare(again.verdict, false, "record"));
    assert.equal(fromPass.failure, null);
    assert.equal(fromPass.cartography, "active");
    assert.deepEqual(fromRecord, fromPass);
    // The 4 GB proof came after the requested report, and the record holds it.
    const withMemory = served(await prepare(again.verdict, true, "record-memory"));
    assert.equal(withMemory.failure, null);
    assert.equal(withMemory.extendedMemory, "active");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
