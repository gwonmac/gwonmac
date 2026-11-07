// A WASM abort is the one failure the flight recorder used to see only as a
// timestamp: the Emscripten abort argument is prose, and prose may not cross
// IPC or enter the export. What crosses instead is a closed reason kind plus
// an FNV-1a fingerprint. These tests pin the two halves of that bargain:
// every reason collapses into the declared vocabulary, and every fingerprint
// the renderer can produce is one the boundary validator accepts.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyWasmAbortReason,
  wasmAbortFingerprint,
} from "../../app/renderer/wasm-abort-reason.ts";
import { WASM_ABORT_REASON_KINDS, type RendererMilestone } from "../../app/shared/diagnostics.ts";
import { diagnosticEventRecord, diagnosticEventSpec } from "../../app/main/diagnostics/schema.ts";
import { asRendererFingerprint } from "../../app/main/diagnostics/schema-fields.ts";
import { parseRendererMilestoneArgs } from "../../app/main/ipc-values.ts";

describe("wasm abort reasons collapse into the closed vocabulary", () => {
  it("names the failure class of each known Emscripten abort shape", () => {
    const cases: [unknown, string][] = [
      ["Aborted(Assertion failed: agent->type == kAgentLiving)", "assertion"],
      ["RuntimeError: null function or function signature mismatch", "indirectCall"],
      ["RuntimeError: table index is out of bounds", "indirectCall"],
      ["RuntimeError: memory access out of bounds", "memoryBounds"],
      ["RuntimeError: unreachable", "unreachable"],
      ["RangeError: Maximum call stack size exceeded", "stackOverflow"],
      ["Aborted(OOM)", "oom"],
      ["Cannot enlarge memory arrays to size 2147483648", "oom"],
      ["Aborted(native code called abort())", "nativeAbort"],
      [undefined, "unspecified"],
      [null, "unspecified"],
      ["", "unspecified"],
      ["something entirely new", "other"],
    ];
    for (const [reason, expected] of cases) {
      assert.equal(classifyWasmAbortReason(reason), expected, String(reason));
    }
  });

  it("classifies an Error by its name and message", () => {
    const trap = new WebAssembly.RuntimeError("unreachable");
    assert.equal(classifyWasmAbortReason(trap), "unreachable");
  });

  it("never invents a kind outside the declared union", () => {
    const inputs = [
      undefined,
      42,
      {},
      new Error("x"),
      "ASSERTION FAILED IN UPPERCASE",
    ];
    const declared: readonly string[] = WASM_ABORT_REASON_KINDS;
    for (const input of inputs) {
      assert.equal(declared.includes(classifyWasmAbortReason(input)), true);
    }
  });
});

describe("wasm abort fingerprints", () => {
  it("always satisfy the boundary validator, whatever the reason was", () => {
    const inputs = [
      undefined,
      "",
      "Aborted(Assertion failed)",
      new Error("boom"),
      "☃".repeat(10_000),
    ];
    for (const input of inputs) {
      // Throws if the shape ever drifts from the declared 8-hex form.
      asRendererFingerprint(wasmAbortFingerprint(input));
    }
  });

  it("cluster identical causes and separate different ones", () => {
    const a = wasmAbortFingerprint("Aborted(Assertion failed: x)");
    assert.equal(a, wasmAbortFingerprint("Aborted(Assertion failed: x)"));
    assert.notEqual(a, wasmAbortFingerprint("Aborted(Assertion failed: y)"));
  });
});

describe("the recorded abort event", () => {
  it("is an error-level renderer event carrying kind, fingerprint, and heap", () => {
    assert.deepEqual(
      diagnosticEventRecord({
        k: "wasm.abort",
        clockSynchronized: true,
        reasonKind: "indirectCall",
        fingerprint: asRendererFingerprint(wasmAbortFingerprint("x")),
        heapBytes: 2_147_483_648,
      }),
      {
        subsystem: "renderer",
        level: "error",
        name: "wasm.abort",
        fields: {
          clockSynchronized: true,
          reasonKind: "indirectCall",
          fingerprint: wasmAbortFingerprint("x"),
          heapBytes: 2_147_483_648,
        },
      },
    );
  });
});

describe("the recorded heap staircase", () => {
  it("records whether heap-growth observation is active", () => {
    assert.deepEqual(
      diagnosticEventRecord({
        k: "wasm.memoryProbe",
        clockSynchronized: true,
        status: "installed",
      }),
      {
        subsystem: "wasm",
        level: "info",
        name: "wasm.memoryProbe",
        fields: { clockSynchronized: true, status: "installed" },
      },
    );
  });

  it("is an info-level renderer event carrying both sides of a growth step", () => {
    assert.deepEqual(
      diagnosticEventRecord({
        k: "wasm.heapGrew",
        fromBytes: 1_879_048_192,
        toBytes: 1_979_711_488,
      }),
      {
        subsystem: "renderer",
        level: "info",
        name: "wasm.heapGrew",
        fields: { fromBytes: 1_879_048_192, toBytes: 1_979_711_488 },
      },
    );
  });

  it("records the growth trigger as a separate closed event", () => {
    const fields = {
      clockSynchronized: true,
      requestedBytes: 2_147_483_648,
      beforeBytes: 2_013_265_920,
      afterBytes: 2_013_265_920,
      outcome: "refused" as const,
      stackFingerprint: asRendererFingerprint("211ffc96"),
      stackDepth: 2,
      frame0Function: 17_792,
      frame0Offset: 0x643e6f,
      frame1Function: 17_784,
      frame1Offset: 0x641dc5,
      frame2Function: 0,
      frame2Offset: 0,
      frame3Function: 0,
      frame3Offset: 0,
      generatedTextures: 9_000,
      deletedTextures: 8_750,
      liveTextures: 250,
      trackedTextures: 250,
      knownTextureBytes: 268_435_456,
      textureUploadBytes: 4_294_967_296,
      unknownTextureAllocations: 0,
      textureTrackingSaturated: false,
    };
    assert.deepEqual(
      diagnosticEventRecord({ k: "wasm.growthRequested", ...fields }),
      {
        subsystem: "wasm",
        level: "info",
        name: "wasm.growthRequested",
        fields,
      },
    );
  });
});

describe("renderer milestone bounds", () => {
  // The boundary and the export validator read one set of guards, so a value
  // the boundary refuses can never be a declared value in an export either.
  const growth = {
    requestedBytes: 2_147_483_648, beforeBytes: 2_013_265_920, afterBytes: 2_013_265_920,
    outcome: "refused", stackFingerprint: "211ffc96", stackDepth: 2,
    frame0Function: 1, frame0Offset: 1, frame1Function: 0, frame1Offset: 0,
    frame2Function: 0, frame2Offset: 0, frame3Function: 0, frame3Offset: 0,
    generatedTextures: 3, deletedTextures: 1, liveTextures: 2, trackedTextures: 2,
    knownTextureBytes: 0, textureUploadBytes: 0, unknownTextureAllocations: 0,
    textureTrackingSaturated: false,
  };
  const cases: readonly [string, RendererMilestone, Record<string, unknown>, string][] = [
    ["more than four stack frames", "wasm.growthRequested", { ...growth, stackDepth: 5 }, "stackDepth"],
    ["more tracked textures than the probe keeps", "wasm.growthRequested", { ...growth, trackedTextures: 4_097 }, "trackedTextures"],
    ["a fractional byte count", "wasm.growthRequested", { ...growth, requestedBytes: 1.5 }, "requestedBytes"],
    ["a negative heap size", "wasm.exit", { code: 1, heapBytes: -1 }, "heapBytes"],
    ["an unknown capability profile", "enhancement.installed", { companionAbi: 1, installation: 1, capabilityProfile: "invented" }, "capabilityProfile"],
  ];
  for (const [label, name, fields, field] of cases) {
    it(`refuses ${label} at the boundary and in the export schema`, () => {
      assert.throws(() => parseRendererMilestoneArgs([name, 12_000, fields]), /invalid renderer milestone/);
      const guards: Readonly<Record<string, (value: unknown) => boolean>> = diagnosticEventSpec(name).fields;
      assert.equal(guards[field]?.(fields[field]), false);
    });
  }
  it("accepts the in-bounds record", () => {
    assert.equal(parseRendererMilestoneArgs(["wasm.growthRequested", 12_000, growth]).name, "wasm.growthRequested");
  });
});

describe("the recorded visual problem", () => {
  it("contains only bounded graphics and texture state", () => {
    const fields = {
      clockSynchronized: true,
      textureProbeInstalled: true,
      wasmHeapBytes: 556_793_856,
      webglContextAvailable: true,
      contextLost: false,
      canvasWidth: 4_482,
      canvasHeight: 2_468,
      offscreenWidth: 4_482,
      offscreenHeight: 2_468,
      drawingBufferWidth: 4_482,
      drawingBufferHeight: 2_468,
      generatedTextures: 1_025,
      deletedTextures: 638,
      liveTextures: 387,
      trackedTextures: 387,
      knownTextureBytes: 260_111_733,
      textureUploadBytes: 497_203_201,
      unknownTextureAllocations: 0,
      textureTrackingSaturated: false,
      programProbeInstalled: true,
      livePrograms: 0,
      programPassThroughQueries: 0,
    };
    assert.deepEqual(
      diagnosticEventRecord({ k: "graphics.visualProblem", ...fields }),
      {
        subsystem: "graphics",
        level: "info",
        name: "graphics.visualProblem",
        fields,
      },
    );
  });

  it("preserves unavailable WebGL and program probes at the IPC boundary", () => {
    const fields = {
      textureProbeInstalled: false,
      wasmHeapBytes: 0,
      webglContextAvailable: false,
      contextLost: false,
      canvasWidth: 0,
      canvasHeight: 0,
      offscreenWidth: 0,
      offscreenHeight: 0,
      drawingBufferWidth: 0,
      drawingBufferHeight: 0,
      generatedTextures: 0,
      deletedTextures: 0,
      liveTextures: 0,
      trackedTextures: 0,
      knownTextureBytes: 0,
      textureUploadBytes: 0,
      unknownTextureAllocations: 0,
      textureTrackingSaturated: false,
      programProbeInstalled: false,
      livePrograms: 0,
      programPassThroughQueries: 0,
    };
    assert.deepEqual(
      parseRendererMilestoneArgs([
        "graphics.visualProblem",
        12_000,
        fields,
      ]),
      {
        name: "graphics.visualProblem",
        rendererTimestampUs: 12_000,
        fields,
      },
    );
    const incomplete = { ...fields };
    Reflect.deleteProperty(incomplete, "programProbeInstalled");
    assert.throws(
      () => parseRendererMilestoneArgs([
        "graphics.visualProblem",
        12_000,
        incomplete,
      ]),
      /invalid renderer milestone/,
    );
  });
});

describe("the relog pre-game probe", () => {
  it("preserves the complete uint32 diagnostic mask", () => {
    const fields = { state: "reconnect", mask: 0xff00_4242 } as const;
    assert.deepEqual(
      parseRendererMilestoneArgs(["relog.preGameProbe", 12_000, fields]),
      {
        name: "relog.preGameProbe",
        rendererTimestampUs: 12_000,
        fields,
      },
    );
    assert.throws(
      () => parseRendererMilestoneArgs([
        "relog.preGameProbe",
        12_000,
        { state: "reconnect", mask: 0x1_0000_0000 },
      ]),
      /invalid renderer milestone/,
    );
  });
});

describe("the skill geometry diagnostic", () => {
  it("accepts only closed, internally consistent states", () => {
    const waiting = {
      state: "waiting",
      reason: "slot-ambiguous",
      candidates: 2,
    } as const;
    assert.deepEqual(
      parseRendererMilestoneArgs([
        "enhancement.skillGeometryState",
        12_000,
        waiting,
      ]),
      {
        name: "enhancement.skillGeometryState",
        rendererTimestampUs: 12_000,
        fields: waiting,
      },
    );
    assert.throws(
      () => parseRendererMilestoneArgs([
        "enhancement.skillGeometryState",
        12_000,
        { state: "ready", reason: "slot-missing", candidates: 8 },
      ]),
      /invalid renderer milestone/,
    );
    assert.throws(
      () => parseRendererMilestoneArgs([
        "enhancement.skillGeometryState",
        12_000,
        { state: "waiting", reason: "slot-missing", candidates: 7 },
      ]),
      /invalid renderer milestone/,
    );
    assert.deepEqual(
      parseRendererMilestoneArgs([
        "enhancement.skillGeometryState",
        12_000,
        { state: "ready", reason: null, candidates: null },
      ]),
      {
        name: "enhancement.skillGeometryState",
        rendererTimestampUs: 12_000,
        fields: { state: "ready", reason: null, candidates: null },
      },
    );
    assert.throws(
      () => parseRendererMilestoneArgs([
        "enhancement.skillGeometryState",
        12_000,
        { state: "waiting", reason: "raw-pointer", candidates: 1 },
      ]),
      /invalid renderer milestone/,
    );
  });
});
