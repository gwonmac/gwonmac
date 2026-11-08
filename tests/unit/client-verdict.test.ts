import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  runClientVerificationPass,
  type ClientVerificationLaunch,
} from "../../app/client/certification/client-verification-pass.js";
import {
  obtainClientVerdict,
  type RunVerifierPass,
} from "../../app/client/client-verdict.js";
import {
  enhancementCapabilityProfile,
  RELEASE_ENHANCEMENT_CAPABILITIES,
} from "../../app/shared/enhancement-contracts.js";

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

// The smallest valid module: the real verifier refuses every stage of it, which
// is still a complete verifier answer that passes the acceptance boundary.
const WASM = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0);
const JS = "var getHeapMax = () => 2147483648;";
const CORE: ClientVerificationLaunch = {
  requestedProfile: enhancementCapabilityProfile(RELEASE_ENHANCEMENT_CAPABILITIES.core)!,
  cartography: false,
};
const TOOLS: ClientVerificationLaunch = {
  requestedProfile: enhancementCapabilityProfile(RELEASE_ENHANCEMENT_CAPABILITIES.tools)!,
  cartography: true,
};
const INSTALL_KEY = Buffer.alloc(32, 1);

/** The real pass, in this process, answering through a structured-clone copy. */
function realPass() {
  const calls: (readonly ClientVerificationLaunch[])[] = [];
  const run: RunVerifierPass = ({ launches }) => {
    calls.push(launches);
    let requested!: (value: unknown) => void;
    let complete!: (value: unknown) => void;
    const answers = {
      requested: new Promise<unknown>((resolve) => { requested = resolve; }),
      complete: new Promise<unknown>((resolve) => { complete = resolve; }),
    };
    void runClientVerificationPass(WASM, JS, launches, (result, done) => {
      requested(structuredClone(result));
      if (done) complete(structuredClone(result));
    });
    return answers;
  };
  return { run, calls };
}

const failedPass: RunVerifierPass = () => ({
  requested: Promise.resolve(null),
  complete: Promise.resolve(null),
});

async function withRecordDir<T>(body: (recordPath: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(tmpdir(), "gw-client-verdict-"));
  try {
    return await body(path.join(root, "client-verdict.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function launchOn(
  recordPath: string,
  runPass: RunVerifierPass,
  overrides: Partial<{
    launch: ClientVerificationLaunch;
    appVersion: string;
    installKey: Uint8Array | null;
  }> = {},
) {
  return obtainClientVerdict({
    recordPath,
    appVersion: overrides.appVersion ?? "1.0.0",
    installKey: async () => overrides.installKey === undefined ? INSTALL_KEY : overrides.installKey,
    wasmPath: "/official/Gw.jspi.wasm",
    wasmSha256: sha256(WASM),
    jsPath: "/official/Gw.jspi.js",
    jsSha256: sha256(JS),
    launch: overrides.launch ?? TOOLS,
    releaseLaunches: [CORE, TOOLS],
    runPass,
  });
}

/** The parts of a stored record payload these tests edit. */
interface RecordPayload {
  key: { verifierAbi: number; officialWasmSha256: string; stageAbis: { cartography: number } };
  result: { launches: { verification: { fileVerdict: { verifierAbi: number } } }[] };
}

/** Re-sign an edited payload with the right key, as an older app would have. */
async function resign(recordPath: string, edit: (payload: RecordPayload) => void) {
  const stored: { payload: string } = JSON.parse(await readFile(recordPath, "utf8"));
  const payload: RecordPayload = JSON.parse(stored.payload);
  edit(payload);
  const text = JSON.stringify(payload);
  await writeFile(recordPath, JSON.stringify({
    payload: text,
    mac: createHmac("sha256", INSTALL_KEY).update(text).digest("hex"),
  }));
}

describe("client verdict", () => {
  it("proves a new build once and serves every later launch from the record", async () => {
    // Catches a launch that spawns the verifier again on a build it proved, and
    // a Tools switch that needs a new proof because only one profile was kept.
    await withRecordDir(async (recordPath) => {
      const pass = realPass();
      const first = await launchOn(recordPath, pass.run);
      assert.equal(first.source, "pass");
      assert.ok(first.verdict);
      assert.equal(await first.stored, "stored");
      assert.deepEqual(pass.calls, [[TOOLS, CORE]]);

      const repeat = await launchOn(recordPath, pass.run);
      assert.equal(repeat.source, "record");
      assert.equal(repeat.passMs, null);
      assert.deepEqual(repeat.verdict?.verification, first.verdict.verification);
      // Switching Tools off selects the other release profile from the same record.
      const toggled = await launchOn(recordPath, pass.run, { launch: CORE });
      assert.equal(toggled.source, "record");
      assert.ok(toggled.verdict);
      assert.equal(pass.calls.length, 1);
    });
  });

  it("ignores any record it cannot authenticate or that was made for something else", async () => {
    // Catches a record that grants a verdict without the install key, or after
    // the build, the app or the verifier changed.
    const cases: [string, (recordPath: string) => Promise<void>, Parameters<typeof launchOn>[2]][] = [
      ["tampered payload", async (recordPath) => {
        const stored: { payload: string } = JSON.parse(await readFile(recordPath, "utf8"));
        stored.payload = stored.payload.replace("\"officialWasmSha256\":\"", "\"officialWasmSha256\":\"0");
        await writeFile(recordPath, JSON.stringify(stored));
      }, {}],
      ["foreign key", async () => undefined, { installKey: Buffer.alloc(32, 2) }],
      ["no Keychain key", async () => undefined, { installKey: null }],
      ["not JSON", async (recordPath) => writeFile(recordPath, "{"), {}],
      ["app update", async () => undefined, { appVersion: "1.0.1" }],
      ["verifier ABI change", (recordPath) => resign(recordPath, (payload) => {
        payload.key.verifierAbi -= 1;
      }), {}],
      ["stage ABI change", (recordPath) => resign(recordPath, (payload) => {
        payload.key.stageAbis.cartography -= 1;
      }), {}],
      ["another build", (recordPath) => resign(recordPath, (payload) => {
        payload.key.officialWasmSha256 = "0".repeat(64);
      }), {}],
    ];
    for (const [name, damage, overrides] of cases) {
      await withRecordDir(async (recordPath) => {
        const pass = realPass();
        await (await launchOn(recordPath, pass.run)).stored;
        await damage(recordPath);
        const next = await launchOn(recordPath, pass.run, overrides);
        assert.equal(next.source, "pass", name);
        assert.ok(next.verdict, name);
        assert.equal(pass.calls.length, 2, name);
        await next.stored;
      });
    }
  });

  it("puts an authenticated record through the same boundary as a fresh answer", async () => {
    // Catches a signed record that is trusted for being signed: a record whose
    // verification the boundary refuses is dropped, and the build proves again.
    await withRecordDir(async (recordPath) => {
      const pass = realPass();
      await (await launchOn(recordPath, pass.run)).stored;
      await resign(recordPath, (payload) => {
        for (const launch of payload.result.launches) launch.verification.fileVerdict.verifierAbi -= 1;
      });
      const next = await launchOn(recordPath, pass.run);
      assert.equal(next.source, "pass");
      assert.ok(next.verdict);
      assert.equal(pass.calls.length, 2);
      await next.stored;
    });
  });

  it("never stores a failed check and checks again at the next start", async () => {
    // Catches a timeout or crash that is cached as if it were a verdict.
    await withRecordDir(async (recordPath) => {
      const failed = await launchOn(recordPath, failedPass);
      assert.equal(failed.verdict, null);
      assert.equal(await failed.stored, "not-stored");
      await assert.rejects(readFile(recordPath), { code: "ENOENT" });

      const pass = realPass();
      const retried = await launchOn(recordPath, pass.run);
      assert.equal(retried.source, "pass");
      assert.ok(retried.verdict);
      assert.equal(pass.calls.length, 1);
      await retried.stored;
    });
  });

  it("uses but does not store a pass that stops after the requested launch", async () => {
    // Catches a record holding only part of a pass, which would make the next
    // Tools switch run on a profile nobody proved.
    await withRecordDir(async (recordPath) => {
      const pass = realPass();
      const partial: RunVerifierPass = (options) => ({
        requested: pass.run(options).requested,
        complete: Promise.resolve(null),
      });
      const launch = await launchOn(recordPath, partial);
      assert.ok(launch.verdict);
      assert.equal(await launch.stored, "not-stored");
      await assert.rejects(readFile(recordPath), { code: "ENOENT" });
    });
  });
});
