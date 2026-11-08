import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  runClientVerificationPass,
  type ClientVerificationLaunch,
  type ClientVerificationPassResult,
} from "../../app/client/certification/client-verification-pass.js";
import { isStageRefusal } from "../../app/client/certification/stage-refusal.js";
import {
  failedStagesField,
  isFailedStagesField,
} from "../../app/client/certification/client-verification-pass.js";
import { ProofLimitError } from "../../app/client/certification/semantic-proof.js";
import { EvidenceError } from "../../app/client/certification/wasm-evidence-error.js";
import {
  acceptLaunchVerdict,
  createVerifierPassSlot,
  obtainClientVerdict,
  readPassResult,
  type RunVerifierPass,
  type VerifierPass,
  type VerifierPassSlot,
} from "../../app/client/client-verdict.js";
import { clientVerdictKey } from "../../app/main/core/client-verdict-key.js";
import { VolatileNativeKeychain } from "../../app/main/core/native-keychain.js";
import {
  enhancementCapabilityProfile,
  RELEASE_ENHANCEMENT_CAPABILITIES,
} from "../../app/shared/enhancement-contracts.js";

const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

// The smallest valid module: the real verifier refuses every stage of it, which
// is still a complete verifier answer that passes the acceptance boundary.
const WASM = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0);
// Another build: the same module with one empty custom section.
const WASM_NEXT = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 0, 2, 1, 97);
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A pass whose answers the test controls. `finishesAfterCancel` models a pass
 * whose answer was already on its way when it was cancelled.
 */
function controlledPass(options: { finishesAfterCancel?: boolean } = {}) {
  let requested!: (value: unknown) => void;
  let complete!: (value: unknown) => void;
  const state = { backgrounded: false, cancelled: false };
  const pass: VerifierPass = {
    requested: new Promise<unknown>((resolve) => { requested = resolve; }),
    complete: new Promise<unknown>((resolve) => { complete = resolve; }),
    background: () => { state.backgrounded = true; },
    cancel: () => {
      state.cancelled = true;
      if (options.finishesAfterCancel) return;
      requested(null);
      complete(null);
    },
  };
  return {
    pass,
    state,
    answerRequested: (value: unknown) => requested(value),
    answerComplete: (value: unknown) => complete(value),
  };
}

/** The real pass's full answer for `bytes`, through a structured-clone copy. */
async function passResult(
  bytes: Uint8Array,
  launches: readonly ClientVerificationLaunch[],
): Promise<ClientVerificationPassResult> {
  const reports: ClientVerificationPassResult[] = [];
  await runClientVerificationPass(bytes, JS, launches, (result) => {
    reports.push(structuredClone(result));
  });
  const last = reports.at(-1);
  assert.ok(last);
  return last;
}

/** The real pass, in this process, answering through a structured-clone copy. */
function realPass(bytes: Uint8Array = WASM) {
  const calls: (readonly ClientVerificationLaunch[])[] = [];
  const run: RunVerifierPass = ({ launches, extendedMemoryFirst }) => {
    calls.push(launches);
    const control = controlledPass();
    void runClientVerificationPass(bytes, JS, launches, (result, done) => {
      control.answerRequested(structuredClone(result));
      if (done) control.answerComplete(structuredClone(result));
    }, { extendedMemoryFirst });
    return control.pass;
  };
  return { run, calls };
}

const failedPass: RunVerifierPass = () => {
  const control = controlledPass();
  control.pass.cancel();
  return control.pass;
};

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
    wasm: Uint8Array;
    slot: VerifierPassSlot;
    launchBudgetMs: number;
  }> = {},
) {
  return obtainClientVerdict({
    recordPath,
    appVersion: overrides.appVersion ?? "1.0.0",
    installKey: async () => overrides.installKey === undefined ? INSTALL_KEY : overrides.installKey,
    wasmPath: "/official/Gw.jspi.wasm",
    wasmSha256: sha256(overrides.wasm ?? WASM),
    jsPath: "/official/Gw.jspi.js",
    jsSha256: sha256(JS),
    launch: overrides.launch ?? TOOLS,
    releaseLaunches: [CORE, TOOLS],
    extendedMemoryRequested: false,
    runPass,
    slot: overrides.slot ?? createVerifierPassSlot(),
    ...(overrides.launchBudgetMs === undefined ? {} : { launchBudgetMs: overrides.launchBudgetMs }),
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
      const partial: RunVerifierPass = (options) => {
        const answers = pass.run(options);
        return { ...answers, complete: Promise.resolve(null) };
      };
      const launch = await launchOn(recordPath, partial);
      assert.ok(launch.verdict);
      assert.equal(await launch.stored, "not-stored");
      await assert.rejects(readFile(recordPath), { code: "ENOENT" });
    });
  });

  it("keeps a slow pass running past the launch budget and stores it for the next launch", async () => {
    // Catches the slow-Mac loop: a pass that misses the launch budget used to
    // be killed, so it failed on every launch and never stored a record.
    await withRecordDir(async (recordPath) => {
      const answer = await passResult(WASM, [TOOLS, CORE]);
      const slow = controlledPass();
      let spawns = 0;
      const runSlow: RunVerifierPass = () => {
        spawns += 1;
        return slow.pass;
      };
      const first = await launchOn(recordPath, runSlow, { launchBudgetMs: 10 });
      assert.equal(first.verdict, null);
      assert.equal(slow.state.backgrounded, true);
      assert.equal(slow.state.cancelled, false);
      await delay(20);
      slow.answerRequested(answer);
      slow.answerComplete(answer);
      assert.equal(await first.stored, "stored");

      const next = await launchOn(recordPath, runSlow);
      assert.equal(next.source, "record");
      assert.ok(next.verdict);
      assert.equal(spawns, 1);
    });
  });

  it("never stores a pass in which a stage failed to check", async () => {
    // Catches a crash inside a stage stored as that stage's permanent refusal.
    await withRecordDir(async (recordPath) => {
      const answer = await passResult(WASM, [TOOLS, CORE]);
      const crashed = {
        ...answer,
        launches: answer.launches.map((launch, index) =>
          index === 0 ? { ...launch, failedStages: ["nativeDoubleClick"] } : launch),
      };
      const once = controlledPass();
      once.answerRequested(crashed);
      once.answerComplete(crashed);
      const first = await launchOn(recordPath, () => once.pass);
      assert.deepEqual(first.verdict?.failedStages, ["nativeDoubleClick"]);
      assert.equal(await first.stored, "not-stored");
      await assert.rejects(readFile(recordPath), { code: "ENOENT" });

      const pass = realPass();
      const next = await launchOn(recordPath, pass.run);
      assert.equal(next.source, "pass");
      assert.deepEqual(next.verdict?.failedStages, []);
      assert.equal(await next.stored, "stored");
    });
  });

  it("runs one pass per build and never lets an older build's pass store", async () => {
    // Catches two verifiers for one build, and a superseded pass overwriting
    // the record of the build that replaced it.
    await withRecordDir(async (recordPath) => {
      const slot = createVerifierPassSlot();
      const older = controlledPass({ finishesAfterCancel: true });
      const olderLaunch = await launchOn(recordPath, () => older.pass, { slot, launchBudgetMs: 10 });
      assert.equal(olderLaunch.verdict, null);

      let spawns = 0;
      const again = await launchOn(recordPath, () => {
        spawns += 1;
        return controlledPass().pass;
      }, { slot, launchBudgetMs: 10 });
      assert.equal(spawns, 0, "the same build reuses its running pass");
      assert.equal(again.verdict, null);

      const newer = realPass(WASM_NEXT);
      const next = await launchOn(recordPath, newer.run, { slot, wasm: WASM_NEXT });
      assert.equal(older.state.cancelled, true);
      assert.equal(await next.stored, "stored");
      // The replaced pass still delivers a valid complete answer for its build.
      older.answerComplete(await passResult(WASM, [TOOLS, CORE]));
      assert.equal(await olderLaunch.stored, "not-stored");
      const served = await launchOn(recordPath, failedPass, { slot, wasm: WASM_NEXT });
      assert.equal(served.source, "record", "the record must still hold the newer build");
    });
  });

  it("cancels another build's pass when this build is served from its record", async () => {
    // Catches a rollback to a stored build while an update's pass runs: that
    // pass must not finish later and overwrite the record of the build in use.
    await withRecordDir(async (recordPath) => {
      const slot = createVerifierPassSlot();
      assert.equal(await (await launchOn(recordPath, realPass().run, { slot })).stored, "stored");
      const update = controlledPass({ finishesAfterCancel: true });
      const updateLaunch = await launchOn(recordPath, () => update.pass, {
        slot, wasm: WASM_NEXT, launchBudgetMs: 10,
      });
      assert.equal(updateLaunch.verdict, null);

      const rollback = await launchOn(recordPath, failedPass, { slot });
      assert.equal(rollback.source, "record");
      assert.equal(update.state.cancelled, true);
      update.answerComplete(await passResult(WASM_NEXT, [TOOLS, CORE]));
      assert.equal(await updateLaunch.stored, "not-stored");
      const again = await launchOn(recordPath, failedPass, { slot });
      assert.equal(again.source, "record", "the record must still hold the build in use");
    });
  });

  it("plays at once when a fresh pass's report holds no verdict", async () => {
    // Catches a launch that waits its whole budget for a complete report that
    // cannot hold a verdict its own first report lacked.
    await withRecordDir(async (recordPath) => {
      const fresh = controlledPass();
      const outcome = launchOn(recordPath, () => fresh.pass, { launchBudgetMs: 60_000 });
      const report = await passResult(WASM, [TOOLS, CORE]);
      fresh.answerRequested({
        ...report,
        launches: report.launches.map((launch) => ({ ...launch, verification: {} })),
      });
      const settled = await Promise.race([
        outcome.then(() => "answered"),
        delay(1_000).then(() => "waiting"),
      ]);
      assert.equal(settled, "answered");
      assert.equal((await outcome).verdict, null);
      assert.equal(fresh.state.backgrounded, true);
      fresh.answerComplete(null);
    });
  });

  it("turns a guard that throws on malformed output into a failed check", async () => {
    // Catches a malformed answer that throws through activation instead of
    // serving the official module.
    const result = readPassResult(await passResult(WASM, [TOOLS, CORE]));
    assert.ok(result);
    const throws = () => { throw new TypeError("hostile"); };
    const hostile = new Proxy({}, { get: throws, ownKeys: throws });
    const throwingStage = acceptLaunchVerdict(
      { ...result, nativeDoubleClick: [hostile] },
      TOOLS,
      sha256(WASM),
    );
    assert.ok(throwingStage);
    assert.equal(throwingStage.nativeDoubleClick(sha256(WASM)), null);
    assert.equal(throwingStage.guardFailed(), true);
    const throwingVerification = acceptLaunchVerdict({
      ...result,
      launches: result.launches.map((launch) => ({ ...launch, verification: hostile })),
    }, TOOLS, sha256(WASM));
    assert.equal(throwingVerification, null);
  });

  it("tries the Keychain again after it failed instead of remembering the failure", async () => {
    // Catches one Keychain hiccup disabling the record until the app quits.
    const keychain = new VolatileNativeKeychain();
    let failures = 1;
    const key = clientVerdictKey({
      load: (slot) => failures-- > 0 ? Promise.reject(new Error("locked")) : keychain.load(slot),
      save: (slot, value) => keychain.save(slot, value),
      clear: (slot) => keychain.clear(slot),
    });
    assert.equal(await key(), null);
    const loaded = await key();
    assert.equal(loaded?.byteLength, 32);
    assert.deepEqual(await key(), loaded);
  });

  it("tells a refusal from a stage that failed to check", () => {
    // Catches a crash classified as a refusal (stored forever) or a refusal
    // classified as a crash (re-proved on every launch).
    const cases: [string, unknown, boolean][] = [
      ["fail() refusal", new Error("extended-memory transform: glue changed"), true],
      ["evidence refusal", new EvidenceError("invalid-wasm"), true],
      ["proof limit", new ProofLimitError("call"), true],
      ["defect", new TypeError("x is undefined"), false],
      ["stack overflow", new RangeError("Maximum call stack size exceeded"), false],
      ["not an Error", "boom", false],
    ];
    for (const [name, error, refusal] of cases) assert.equal(isStageRefusal(error), refusal, name);
  });
  it("logs failed stages only as closed names in chain order", () => {
    // Catches a diagnostics field that could carry a path or free text, and a
    // producer whose value the export validator would refuse.
    assert.equal(failedStagesField(["extendedMemory", "friendObserver"]), "friendObserver,extendedMemory");
    assert.equal(failedStagesField([]), "");
    for (const value of ["", "enhancement", "friendObserver,extendedMemory"]) {
      assert.equal(isFailedStagesField(value), true, value);
    }
    for (const value of ["/Users/x/Gw.jspi.wasm", "extendedMemory,friendObserver", "enhancement,enhancement", "enhancement,", null]) {
      assert.equal(isFailedStagesField(value), false, String(value));
    }
  });
});
