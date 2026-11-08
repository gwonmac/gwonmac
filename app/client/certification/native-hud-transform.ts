/**
 * Attaches bounded skill and effect labels to native icon draw batches. The
 * original UI owns clipping and order; retained meshes avoid per-frame uploads.
 */
import { ProofRefusal } from "./stage-refusal.js";
import { concat, encodeCode, encodeIndexVector, encodeSection, parseCode, parseExports,
  parseIndexVector, sectionById, sleb, splitSections, uleb, vectorPayload, WASM_HEADER } from "../../main/core/wasm-binary.js";
import { call, encodeName, f32Const, f32Load, f32Store, globalGet, globalSet, i32Const, i32Load, i32Store, localGet, localSet, op } from "./wasm-emit.js";
import { NATIVE_RENDER_REFERENCE_FUNCTIONS, nativeGraphicsBusy, nativeModelBusy,
  resolveNativeRenderBindings, type NativeRenderFunctionBodies } from "./native-render-reference.js";
import { isDigest } from "../../shared/digest.js";
import { isDeepStrictEqual } from "node:util";
import { wasmEvidence } from "./wasm-evidence.js";
import { NATIVE_PUBLISH_BUSY } from "../../shared/native-publish.js";
import { NATIVE_HUD_MAGIC, NATIVE_HUD_ATLAS_SIZE, NATIVE_HUD_LABELS, NATIVE_HUD_QUADS,
  NATIVE_HUD_HEADER, NATIVE_HUD_KEYCAP, NATIVE_HUD_SKILLS } from "../../shared/native-hud.js";

const CHECKED = [
  [13162, "8ab5e3b4ad9aadcd7e51245322cabda16c3c1882254c90284961c3068ceaa4e1"],
  [13125, "21369b96acf8fd04e0c4e50c23b45028425e3b56a73c7161f9fc150061737f55"],
  [6584, "7c47c6284394a67b717010e709f60ed59bbf8707af023c3780b9e8f59ed0de43"],
  [6450, "098f5fa1ea2dc1e2a877db032dd20e423ee2ce86d33ff57974390ee04e0d2771"],
  [6598, "91f5cf516b125fd6181e4e003e4b6d7acc841c37052438bf9d213ff71e27bf87"],
  [6585, "3aee7481e1f32029de64d17a77323e41d5855d72b9cfc9f16081c184092ed579"],
  [14063, "fcb416a75de2054ce9f3b1fe2224a76e0bbd4bb0e426097d6e14ffa6e7011268"],
  [1554, "6a1b82f3d27e1077795392f733b2acd6b34f8be321dbc7ed65a7af8c07e80ac5"],
  [1572, "e34024b6fb2fc72d0c598285a60f3f204fa8cfb865d7fffaad2fd7c1fa7061c3"],
  [6446, "6884ee6ff0dc70791dfd9b591ced34ee462cab445c27d20967abdbd196e87213"],
  [6447, "1100a0920546b1e2b692658952b696a0de6efc01ae7ffb28c3ec27f5d2d3f23b"],
  [1563, "af1d5ab4f32141617c6be2b747144161eedcff5c5ed5e276d220ec2f28f495e5"],
  [6488, "386a60a3578c3650aeaa6b6ee7fdc840e4b8cc6b791d242ca20e31b7652bfc85"],
  [
    6492,
    "fa27fbb7e7dc27b59a962adab6142cdc494c230ed5fef602411ccbca7b08f217"
  ],
  [
    6490,
    "30d0f1d66769f1393c111cd0534200e03d36b408ec3be7ab1572550aba8c785c"
  ],
  [
    6593,
    "7c2c5556e6546a9059f7f3c654c1d214ae7bf06ce4fabeefbadc2b8d6691f153"
  ],
  [
    5595,
    "2d9c21a01d2ea73b47cba5da45fd09648fc01c49d0bd3e7957a2b8f4952a778a"
  ],
  [
    1569,
    "46b25139552a8d66a0b519d735755346f9be5d37ab2d1e9b02bca1d79bee20fc"
  ],
  [
    1579,
    "c46a846084eb5292db3d41d901724d9e2330cf1bb9f7fb1dec371fa642e4cc48"
  ],
  [
    1559,
    "d047b1ee5ed993986e60def91a371b46aef13ef04e6e83d2c72827d98376d24a"
  ],
  [
    1444,
    "88b977ad123c93c1926a67efe32721398cafb0f86fa2b3f5a57f3bd1493fb842"
  ],
  [
    1445,
    "a883926f470e716e59f62bec0b03adc8721112e78e859477bcab028de2ab311b"
  ],
  [
    1446,
    "3cfe5e2ff85ca8c472ad41c7a3ce4db7eb66c4dcb86b6fdfc69530067fecb650"
  ],
  [
    1448,
    "79c87cd0bab2c93f9718d557a7bd552ee2c37a70ec7f6d0f82224aa8c45e438d"
  ],
  [
    1449,
    "3e750376bbc2a51393c0ba169355550ba48a1b7fdea3fff8e1d0b1b5be2d6581"
  ],
  [
    2249,
    "149d95966e67f554da12f46c064ee366a9d531b167842e6ea0a201ca730b474e"
  ],
  [
    3137,
    "3f4d7e18ad91c20147e2053ee1e42f8eb60c97937fefba142d37c93f2d672e36"
  ],
  [
    748,
    "150d8921520d98fbfa28dc4faf5e2fe488a65c69832b13d7dcf489b2f07d7b60"
  ],
  [
    1333,
    "8799e3b4032b03c0c01c88236d3283d17c362ce3b300edf58bce919395fba064"
  ],
  [
    1334,
    "d0061147c7a6987af15a15663703b726f9bbc015fb5f3e6fa44b28df41dc1905"
  ],
  [
    1357,
    "ac2e8c49bb67981447c9f66c39b364f90c292c86efa3fe98456743608453f4f5"
  ],
  [
    264,
    "0265ff024218606f270c9dcca6166d3a5d4bc28809071377662ab1ce0f13e562"
  ],
  ...NATIVE_RENDER_REFERENCE_FUNCTIONS,
] as const;
/** Exact native draw owners and resource operations bound by local verification. */
export const NATIVE_HUD_RENDERING_PROOF: Readonly<{ functionBodies: NativeRenderFunctionBodies }> =
  Object.freeze({ functionBodies: CHECKED });

/**
 * The process boundary has no client bytes, and a relinked client's owners are
 * derived by relocation identity, so it checks the proof's shape: one distinct
 * owner and digest per checked reference. `appendNativeHud` derives the owners
 * again from the bytes it rewrites and refuses any other value.
 */
export function isNativeHudRenderingProof(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("functionBodies" in value)) return false;
  const bodies = value.functionBodies;
  return Array.isArray(bodies) && bodies.length === CHECKED.length
    && bodies.every((entry) => Array.isArray(entry) && entry.length === 2
      && Number.isSafeInteger(entry[0]) && entry[0] >= 0 && isDigest(entry[1]))
    && new Set(bodies.map((entry: readonly unknown[]) => entry[0])).size === bodies.length;
}

export function deriveNativeHudRendering(evidence: NonNullable<ReturnType<typeof wasmEvidence>>) {
  const module = evidence.moduleView();
  const bindings = resolveNativeRenderBindings(module, CHECKED);
  return bindings && ["malloc", "free"].every(name =>
    module.exports.some(entry => entry.kind === 0 && entry.name === name))
    ? Object.freeze({ functionBodies: bindings.functionBodies }) : null;
}
export function provesNativeHudRendering(evidence: NonNullable<ReturnType<typeof wasmEvidence>>): boolean {
  return deriveNativeHudRendering(evidence) !== null;
}

const add = (a: Uint8Array, b: number) => concat(a, i32Const(b), op(0x6a));
const stack = (n: number, bytes: number) => concat(globalGet(0), i32Const(bytes), op(0x6b), localSet(n), localGet(n), globalSet(0));
const unstack = (n: number, bytes: number) => concat(localGet(n), i32Const(bytes), op(0x6a), globalSet(0));
// Private records: owner, mesh, draw, parent ID, child ID, quad count, keycap flag, 8 quads.
const STRIDE = 316;

export function appendNativeHud(input: Uint8Array, skillBarGlobal: number,
  accepted?: Readonly<{ functionBodies: NativeRenderFunctionBodies }>): Uint8Array {
  const evidence = wasmEvidence(input); if (!evidence) throw new ProofRefusal("invalid native HUD input");
  const module = evidence.moduleView();
  const bindings = resolveNativeRenderBindings(module, CHECKED);
  const derived = deriveNativeHudRendering(evidence);
  if (!bindings || !derived || (accepted !== undefined && !isDeepStrictEqual(derived, accepted))) {
    throw new ProofRefusal("native HUD rendering proof changed");
  }
  const sections = splitSections(input);
  const globals = vectorPayload(sectionById(sections, 6));
  const signatures = vectorPayload(sectionById(sections, 1));
  const exports = vectorPayload(sectionById(sections, 7));
  const names = parseExports(sectionById(sections, 7));
  const malloc = names.find((entry) => entry.name === "malloc")?.index;
  const free = names.find((entry) => entry.name === "free")?.index;
  if (malloc === undefined || free === undefined) throw new ProofRefusal("native HUD allocators missing");
  const bodies = parseCode(sectionById(sections, 10));
  const types = parseIndexVector(sectionById(sections, 3));
  const base = globals.count;
  const read = (n: number) => globalGet(base + n);
  const put = (n: number) => globalSet(base + n);
  const increment = (n: number) => concat(read(n), i32Const(1), op(0x6a), put(n));
  // Globals: records, material, uploads, updates, created, destroyed, collections, matched, published, next visible frame, reset pending, cleanup pending.
  const first = module.functionImportCount + bodies.length;
  const originalCollect = first, originalDestroy = first + 1, releaseIndex = first + 2;
  const hideStockKeyIndex = first + 9, reapIndex = first + 10, cleanupIndex = first + 11;
  const resetIndex = first + 3, meshIndex = first + 4, collectIndex = first + 5;
  const destroyIndex = first + 6, atlasIndex = first + 7, labelIndex = first + 8;
  const each = (n: number, body: Uint8Array) => concat(read(0), op(0x04, 0x40), i32Const(0), localSet(n), op(0x03, 0x40),
    body, localGet(n), i32Const(1), op(0x6a), localSet(n), localGet(n), i32Const(NATIVE_HUD_LABELS), op(0x49, 0x0d, 0, 0x0b, 0x0b));
  const record = (n: number) => concat(read(0), localGet(n), i32Const(STRIDE), op(0x6c, 0x6a));
  // A retired owner (-1) cannot collect again until its queued draw is safe.
  // Keep handles in the bounded record instead of freeing a referenced model.
  const reap = concat(op(1, 1, 0x7f), localGet(0), i32Load(8), op(0x04, 0x40),
    nativeGraphicsBusy(1, bindings), op(0x04, 0x40, 0x0f, 0x0b),
    nativeModelBusy(concat(localGet(0), i32Load(8)), 1, bindings), op(0x04, 0x40, 0x0f, 0x0b),
    localGet(0), i32Load(8), call(bindings.functionIndex(748)), localGet(0), i32Load(4), call(bindings.functionIndex(748)), increment(5), op(0x0b),
    ...[0, 4, 8].map((at) => concat(localGet(0), i32Const(0), i32Store(at))), op(0x0b));
  const release = concat(op(0), localGet(0), i32Const(-1), i32Store(0), call(bindings.functionIndex(6593)),
    localGet(0), call(reapIndex), i32Const(1), put(11), op(0x0b));
  // The cleanup flag avoids scanning every native icon when nothing retired.
  // Native collection also reaps after host presentation has been disposed.
  // A reset keeps the shared material and storage until every draw is released.
  const cleanup = concat(op(1, 2, 0x7f), read(11), op(0x45, 0x04, 0x40, 0x0f, 0x0b), i32Const(0), localSet(1), each(0, concat(
    record(0), i32Load(0), i32Const(-1), op(0x46, 0x04, 0x40), record(0), call(reapIndex), op(0x0b),
    localGet(1), record(0), i32Load(0), i32Const(-1), op(0x46, 0x72), localSet(1))),
    localGet(1), put(11),
    read(10), localGet(1), op(0x45, 0x71, 0x04, 0x40),
    read(0), op(0x04, 0x40), read(0), call(free), i32Const(0), put(0), op(0x0b),
    read(1), op(0x04, 0x40), read(1), call(bindings.functionIndex(748)), i32Const(0), put(1), op(0x0b),
    i32Const(0), put(10), op(0x0b, 0x0b));
  const reset = concat(op(1, 1, 0x7f), i32Const(1), put(10), i32Const(1), put(11), each(0, concat(
    record(0), i32Const(0), i32Store(20), record(0), call(releaseIndex))), call(cleanupIndex), op(0x0b));
  // Native bitmap vertices are UI coordinates relative to the frame's origin.
  // Native UI projection is captured independently; our model is identity like 6118.
  const vertex: Uint8Array[] = [];
  for (let v = 0; v < 4; v++) {
    const right = v === 1 || v === 2, bottom = v >= 2;
    vertex.push(
      localGet(3), localGet(1), f32Load(268), localGet(1), f32Load(236), op(0x93),
      localGet(4), f32Load(0), ...(right ? [localGet(4), f32Load(8), op(0x92)] : []), localGet(7), op(0x94, 0x92), f32Store(v * 24),
      localGet(3), localGet(1), f32Load(280), localGet(1), f32Load(240), op(0x93),
      localGet(4), f32Load(4), ...(bottom ? [localGet(4), f32Load(12), op(0x92)] : []), localGet(8), op(0x94, 0x93), f32Store(v * 24 + 4),
      localGet(3), f32Const(0), f32Store(v * 24 + 8), localGet(3), i32Const(-1), i32Store(v * 24 + 12),
      localGet(3), localGet(4), f32Load(right ? 24 : 16), f32Store(v * 24 + 16),
      localGet(3), localGet(4), f32Load(bottom ? 28 : 20), f32Store(v * 24 + 20));
  }
  const mesh = concat(op(2, 6, 0x7f, 2, 0x7d), // record0; frame1, scratch2, vertices3, quad4, indices5, n6; width7,height8
    localGet(0), i32Load(8), op(0x45, 0x04, 0x40, 0x0f, 0x0b), localGet(0), i32Load(0), localSet(1),
    localGet(1), f32Load(276), localGet(1), f32Load(268), op(0x93), localSet(7),
    localGet(1), f32Load(280), localGet(1), f32Load(272), op(0x93), localSet(8),
    localGet(0), i32Load(4), localGet(0), i32Load(20), i32Const(4), op(0x6c), call(bindings.functionIndex(1446)), localSet(3),
    localGet(0), i32Load(4), localGet(0), i32Load(20), i32Const(6), op(0x6c), call(bindings.functionIndex(1445)), localSet(5),
    localGet(0), i32Load(20), op(0x04, 0x40), i32Const(0), localSet(6), add(localGet(0), NATIVE_HUD_HEADER), localSet(4), op(0x03, 0x40), ...vertex,
    ...[0, 2, 1, 0, 3, 2].map((v, at) => concat(localGet(5), localGet(6), i32Const(4), op(0x6c), i32Const(v), op(0x6a, 0x3b, 1), uleb(at * 2))),
    add(localGet(3), 96), localSet(3), add(localGet(5), 12), localSet(5), add(localGet(4), 32), localSet(4), add(localGet(6), 1), localSet(6),
    localGet(6), localGet(0), i32Load(20), op(0x49, 0x0d, 0, 0x0b, 0x0b),
    stack(2, 32), ...[0, 4, 8].map((at) => concat(localGet(2), f32Const(-32768), f32Store(at))),
    ...[12, 16, 20].map((at) => concat(localGet(2), f32Const(32768), f32Store(at))),
    localGet(0), i32Load(4), localGet(2), add(localGet(2), 12), call(bindings.functionIndex(1449)), localGet(0), i32Load(4), call(bindings.functionIndex(1448)),
    ...([268, 272, 276, 280, 236, 240, 260, 264] as const).map((at, n) => concat(localGet(0), localGet(1), f32Load(at), f32Store(284 + n * 4))),
    increment(3), unstack(2, 32), op(0x0b));
  // 13162 creates the stock hotkey at child 6 of the bitmap. Suppress only
  // that exact player's keycap while its replacement is published. The frame,
  // game binding and original drawing resources remain owned by the game.
  const hideStockKey = concat(op(1, 4, 0x7f), op(0x02, 0x40),
    read(0), op(0x45), read(1), op(0x45, 0x72, 0x0d, 0),
    add(localGet(0), -4), localSet(1), localGet(1), i32Load(184), i32Const(6), op(0x47, 0x0d, 0),
    localGet(1), i32Load(296), localSet(2), localGet(2), op(0x45, 0x0d, 0), add(localGet(2), -296), localSet(2),
    localGet(2), i32Load(184), i32Const(2), op(0x47, 0x0d, 0),
    localGet(2), i32Load(296), localSet(3), localGet(3), op(0x45, 0x0d, 0), add(localGet(3), -296), localSet(3),
    localGet(3), i32Load(184), i32Const(8), op(0x4f, 0x0d, 0),
    localGet(3), i32Load(296), localSet(4), localGet(4), op(0x45, 0x0d, 0), add(localGet(4), -296), i32Load(188),
    ...(skillBarGlobal ? [op(0x23), uleb(skillBarGlobal)] : [i32Const(-1)]), op(0x47, 0x0d, 0),
    localGet(3), i32Load(184), localSet(4),
    record(4), i32Load(0), i32Const(-1), op(0x47), record(4), i32Load(12), ...(skillBarGlobal ? [op(0x23), uleb(skillBarGlobal)] : [i32Const(-1)]), op(0x46),
    record(4), i32Load(16), localGet(3), i32Load(184), op(0x46, 0x71), record(4), i32Load(20), i32Const(0), op(0x4b, 0x71), record(4), i32Load(24), i32Const(NATIVE_HUD_KEYCAP), op(0x71, 0x71, 0x71, 0x0f, 0x0b),
    i32Const(0), op(0x0b));
  // Slot 9 is the native final outer-clip category for this frame. The original
  // collector runs first; no native list is overwritten or given duplicate refs.
  // 6585 stops at the first absent stock slot. A matched HUD owner must report
  // its intervening empty slots so the cache reaches our final category.
  const collect = concat(op(2, 9, 0x7f, 1, 0x7d), // args0..2; result3,n4,r5,frame6,relation7,depth8,source9,scratch10,tmp11,alpha12
    call(cleanupIndex), localGet(0), call(hideStockKeyIndex), op(0x04, 0x7f), i32Const(0), op(0x05), localGet(0), localGet(1), localGet(2), call(originalCollect), op(0x0b), localSet(3),
    localGet(1), i32Const(9), op(0x4b), localGet(1), i32Const(9), op(0x47), localGet(3), op(0x71, 0x72), read(1), op(0x45, 0x72), read(0), op(0x45, 0x72), read(10), op(0x72, 0x04, 0x40), localGet(3), op(0x0f, 0x0b),
    increment(6), localGet(0), i32Const(4), op(0x6b), localSet(6),
    each(4, concat(record(4), localSet(5), op(0x02, 0x40),
      localGet(5), i32Load(0), i32Const(-1), op(0x46, 0x0d, 0), localGet(5), i32Load(20), op(0x45, 0x0d, 0),
      // Locate this icon through the collected frame's ancestors. Its final
      // visible descendant must draw first, including recharge/effect veils.
      localGet(0), i32Const(4), op(0x6b), localSet(6), i32Const(0), localSet(8), op(0x02, 0x40, 0x03, 0x40),
        localGet(6), op(0x45, 0x0d, 1),
        localGet(4), i32Const(NATIVE_HUD_SKILLS), op(0x49, 0x04, 0x7f),
          localGet(6), i32Load(184), i32Const(2), op(0x46), localGet(6), i32Load(296), i32Const(0), op(0x47, 0x71, 0x04, 0x7f),
            localGet(6), i32Load(296), i32Const(296), op(0x6b), i32Load(184), localGet(5), i32Load(16), op(0x46),
          op(0x05), i32Const(0), op(0x0b),
        op(0x05), localGet(5), i32Load(16), localGet(6), i32Load(184), op(0x46, 0x0b, 0x0d, 1),
        localGet(6), i32Load(296), localSet(7), i32Const(0), localSet(6), localGet(7), op(0x04, 0x40), localGet(7), i32Const(296), op(0x6b), localSet(6), op(0x0b),
        add(localGet(8), 1), localSet(8), localGet(8), i32Const(16), op(0x49, 0x0d, 0), i32Const(0), localSet(6), op(0x0b, 0x0b),
      localGet(6), op(0x45, 0x0d, 0),
      // Match the validated parent, then verify the native parent identity too.
      localGet(6), i32Load(296), localSet(7), i32Const(0), localSet(8), op(0x02, 0x40, 0x03, 0x40),
        localGet(7), op(0x45, 0x0d, 1), localGet(7), i32Const(296), op(0x6b), i32Load(188), localGet(5), i32Load(12), op(0x46, 0x0d, 1),
        localGet(7), i32Load(0), localSet(7), add(localGet(8), 1), localSet(8), localGet(8), i32Const(16), op(0x49, 0x0d, 0), i32Const(0), localSet(7), op(0x0b, 0x0b),
      localGet(7), op(0x45, 0x0d, 0),
      localGet(4), i32Const(NATIVE_HUD_SKILLS), op(0x49, 0x04, 0x40),
        localGet(5), i32Load(12), ...(skillBarGlobal ? [op(0x23), uleb(skillBarGlobal)] : [i32Const(-1)]), op(0x47, 0x0d, 1),
      op(0x05), localGet(7), i32Load(12), i32Const(1726357791), op(0x47, 0x0d, 1, 0x0b),
      // Defer while the next visible native frame still belongs to this icon.
      // The exact cache call site supplies the next frame; no per-frame scan.
      read(9), localSet(9), i32Const(0), localSet(8), i32Const(0), localSet(11), op(0x02, 0x40, 0x03, 0x40),
        localGet(9), op(0x45, 0x0d, 1),
        localGet(9), localGet(6), op(0x46, 0x04, 0x40), i32Const(1), localSet(11), op(0x0c, 2, 0x0b),
        localGet(9), i32Load(296), localSet(7), i32Const(0), localSet(9), localGet(7), op(0x04, 0x40), localGet(7), i32Const(296), op(0x6b), localSet(9), op(0x0b),
        add(localGet(8), 1), localSet(8), localGet(8), i32Const(16), op(0x49, 0x0d, 0, 0x0b, 0x0b), localGet(11), op(0x0d, 0),
      localGet(5), i32Load(0), i32Const(0), op(0x47), localGet(5), i32Load(0), localGet(6), op(0x47, 0x71, 0x0d, 0),
      localGet(1), i32Const(9), op(0x49, 0x04, 0x40), i32Const(1), op(0x0f, 0x0b),
      increment(7),
      // A cache rebuild can reuse an already queued draw, but must not recapture
      // its matrices or rewrite geometry until the native reference drains.
      nativeGraphicsBusy(11, bindings), localGet(5), i32Load(8), op(0x04, 0x7f),
        nativeModelBusy(concat(localGet(5), i32Load(8)), 11, bindings),
      op(0x05), i32Const(0), op(0x0b, 0x72, 0x45, 0x04, 0x40),
      // Logical skill/effect icon frames need not own a retained bitmap draw.
      // Build our own draw and capture the same native UI matrices as 6488.
      localGet(5), i32Load(8), op(0x45, 0x04, 0x40),
        localGet(5), localGet(6), i32Store(0), localGet(5), i32Const(265), i32Const(0), call(bindings.functionIndex(1444)), i32Store(4),
        stack(10, 176), localGet(10), localGet(5), i32Load(4), i32Store(160), localGet(10), read(1), i32Store(164),
        localGet(5), i32Const(1), add(localGet(10), 160), add(localGet(10), 164), i32Const(0), i32Const(0), call(bindings.functionIndex(1554)), i32Store(8),
        localGet(5), i32Load(8), i32Const(6), call(bindings.functionIndex(1572)), unstack(10, 176), increment(4),
        // A recreated mesh is empty even when this icon's cached bounds still
        // match. Populate it now instead of waiting for the next timer digit.
        localGet(5), call(meshIndex),
      op(0x0b),
      stack(10, 160),
      ...[0, 1, 2].map((matrix) => concat(add(localGet(10), matrix * 52), i32Const(matrix), call(bindings.functionIndex(1333)), i32Const(52), call(bindings.functionIndex(264)))),
      add(localGet(6), 208), call(bindings.functionIndex(6446)), localGet(5), i32Load(8), call(bindings.functionIndex(1563)),
      i32Const(2), call(bindings.functionIndex(1357)), localGet(5), i32Load(8), i32Const(0), call(bindings.functionIndex(1579)),
      ...[0, 1, 2].map((matrix) => concat(i32Const(matrix), add(localGet(10), matrix * 52), call(bindings.functionIndex(1334)))),
      unstack(10, 160),
      ...([268, 272, 276, 280, 236, 240, 260, 264] as const).flatMap((at, n) => [localGet(5), f32Load(284 + n * 4), localGet(6), f32Load(at), op(0x5c), ...(n ? [op(0x72)] : [])]),
      op(0x04, 0x40), localGet(5), call(meshIndex), op(0x0b),
      f32Const(1), localSet(12), localGet(6), localSet(7), i32Const(0), localSet(8), op(0x03, 0x40),
        localGet(12), localGet(7), f32Load(48), op(0x94), localSet(12), localGet(7), i32Load(296), localSet(7),
        localGet(7), op(0x04, 0x40), localGet(7), i32Const(296), op(0x6b), localSet(7), op(0x0b),
        add(localGet(8), 1), localSet(8), localGet(7), i32Const(0), op(0x47), localGet(8), i32Const(16), op(0x49, 0x71, 0x0d, 0, 0x0b),
      localGet(5), i32Load(8), localGet(12), f32Const(255), op(0x94, 0xa8), call(bindings.functionIndex(1559)), op(0x0b),
      localGet(5), i32Load(8), op(0x45, 0x0d, 0),
      localGet(2), localGet(2), i32Load(8), i32Const(1), op(0x6a), localGet(2), i32Load(8), call(bindings.functionIndex(5595)),
      localGet(2), i32Load(0), localGet(2), i32Load(8), i32Const(4), op(0x6c, 0x6a), localGet(5), i32Load(8), i32Store(0),
      localGet(2), localGet(2), i32Load(8), i32Const(1), op(0x6a), i32Store(8), i32Const(1), localSet(3), op(0x0b))),
    localGet(3), op(0x0b));
  const destroy = concat(op(1, 1, 0x7f), each(1, concat(record(1), i32Load(0), add(localGet(0), -4), op(0x46, 0x04, 0x40), record(1), call(releaseIndex), op(0x0b))),
    localGet(0), call(originalDestroy), op(0x0b));
  const validMemory = (bytes: Uint8Array) => concat(localGet(0), i32Const(0), op(0x4b), localGet(0), i32Const(3), op(0x71, 0x45, 0x71),
    localGet(0), op(0xad), bytes, op(0xad, 0x7c), op(0x3f, 0, 0xad, 0x42), sleb(65536), op(0x7e, 0x58, 0x71));
  const atlasBytes = 8 + NATIVE_HUD_ATLAS_SIZE ** 2 * 4;
  // Retexturing a record's retained model asserts while the renderer holds it;
  // this runs from the host's frame, so report busy before changing any record.
  const atlas = concat(op(1, 5, 0x7f), call(cleanupIndex),
    read(10), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b),
    nativeGraphicsBusy(6, bindings), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b),
    each(5, concat(record(5), i32Load(8), op(0x04, 0x40),
      nativeModelBusy(concat(record(5), i32Load(8)), 6, bindings), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b), op(0x0b))),
    validMemory(i32Const(atlasBytes)), localGet(1), i32Const(atlasBytes), op(0x46, 0x71, 0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
    localGet(0), i32Load(0), i32Const(NATIVE_HUD_MAGIC), op(0x47), localGet(0), i32Load(4), i32Const(NATIVE_HUD_ATLAS_SIZE), op(0x47, 0x72, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
    stack(2, 48), localGet(2), add(localGet(0), 8), i32Store(0), localGet(2), i32Const(NATIVE_HUD_ATLAS_SIZE), i32Store(8), localGet(2), i32Const(NATIVE_HUD_ATLAS_SIZE), i32Store(12),
    localGet(2), i32Const(0), add(localGet(2), 8), i32Const(1), i32Const(112), call(bindings.functionIndex(2249)), localSet(3),
    localGet(2), localGet(3), i32Store(16), localGet(2), i32Const(7), i32Store(20), localGet(2), i32Const(482), i32Store(24),
    i32Const(1), add(localGet(2), 16), add(localGet(2), 20), add(localGet(2), 24), i32Const(0), i32Const(0), i32Const(33555424), i32Const(11), call(bindings.functionIndex(3137)), localSet(4),
    each(5, concat(record(5), i32Load(8), op(0x04, 0x40), record(5), i32Load(8), i32Const(0), localGet(4), call(bindings.functionIndex(1569)), op(0x0b))),
    read(1), op(0x04, 0x40), read(1), call(bindings.functionIndex(748)), op(0x0b), localGet(4), put(1), localGet(3), call(bindings.functionIndex(748)), increment(2),
    unstack(2, 48), i32Const(1), op(0x0b));
  const label = concat(op(1, 4, 0x7f), validMemory(i32Const(NATIVE_HUD_HEADER)), localGet(1), i32Const(NATIVE_HUD_HEADER), op(0x4f, 0x71, 0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
    localGet(0), i32Load(8), localSet(2), localGet(0), i32Load(20), localSet(3),
    localGet(0), i32Load(0), i32Const(NATIVE_HUD_MAGIC), op(0x46), localGet(0), i32Load(4), localGet(1), op(0x46, 0x71),
    localGet(2), i32Const(NATIVE_HUD_LABELS), op(0x49, 0x71), localGet(3), i32Const(NATIVE_HUD_QUADS), op(0x4d, 0x71),
    localGet(1), localGet(3), i32Const(32), op(0x6c), i32Const(NATIVE_HUD_HEADER), op(0x6a, 0x46, 0x71), validMemory(localGet(1)), op(0x71, 0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
    // Only player skill records can suppress a stock keycap. The flag is
    // metadata; key and timer triangles share this record's single draw.
    localGet(0), i32Load(24), i32Const(NATIVE_HUD_KEYCAP), op(0x4b),
    localGet(2), i32Const(NATIVE_HUD_SKILLS), op(0x4f), localGet(0), i32Load(24), i32Const(0), op(0x47, 0x71, 0x72),
    op(0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
    // All coordinates and UVs are normalized, finite, and inside this icon/atlas.
    i32Const(NATIVE_HUD_HEADER), localSet(4), op(0x02, 0x40, 0x03, 0x40), localGet(4), localGet(1), op(0x4f, 0x0d, 1),
      localGet(0), localGet(4), op(0x6a), f32Load(0), f32Const(0), op(0x60), localGet(0), localGet(4), op(0x6a), f32Load(0), f32Const(1), op(0x5f, 0x71, 0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
      add(localGet(4), 4), localSet(4), op(0x0c, 0, 0x0b, 0x0b),
    // Component bounds alone permit a quad to spill into a neighboring icon.
    // Validate complete extents and ordered UVs; zero-area clipping is valid.
    i32Const(NATIVE_HUD_HEADER), localSet(4), op(0x02, 0x40, 0x03, 0x40), localGet(4), localGet(1), op(0x4f, 0x0d, 1),
      localGet(0), localGet(4), op(0x6a), f32Load(0), localGet(0), localGet(4), op(0x6a), f32Load(8), op(0x92), f32Const(1), op(0x5f),
      localGet(0), localGet(4), op(0x6a), f32Load(4), localGet(0), localGet(4), op(0x6a), f32Load(12), op(0x92), f32Const(1), op(0x5f, 0x71),
      localGet(0), localGet(4), op(0x6a), f32Load(24), localGet(0), localGet(4), op(0x6a), f32Load(16), op(0x60, 0x71),
      localGet(0), localGet(4), op(0x6a), f32Load(28), localGet(0), localGet(4), op(0x6a), f32Load(20), op(0x60, 0x71),
      op(0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b), add(localGet(4), 32), localSet(4), op(0x0c, 0, 0x0b, 0x0b),
    call(cleanupIndex), read(10), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b),
    read(0), op(0x45, 0x04, 0x40), i32Const(STRIDE * NATIVE_HUD_LABELS), call(malloc), put(0), read(0), op(0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
      i32Const(0), localSet(4), op(0x03, 0x40), read(0), localGet(4), op(0x6a), i32Const(0), i32Store(0), add(localGet(4), 4), localSet(4), localGet(4), i32Const(STRIDE * NATIVE_HUD_LABELS), op(0x49, 0x0d, 0, 0x0b, 0x0b),
    increment(8), record(2), localSet(5),
    localGet(5), i32Load(12), localGet(0), i32Load(12), op(0x47), localGet(5), i32Load(16), localGet(0), i32Load(16), op(0x47, 0x72, 0x04, 0x40), localGet(5), i32Const(0), i32Store(20), localGet(5), call(releaseIndex), op(0x0b),
    // Withdrawal hides now; updates retry before touching retained geometry.
    localGet(3), op(0x45, 0x04, 0x40), localGet(5), i32Const(0), i32Store(20), localGet(5), call(releaseIndex), i32Const(1), op(0x0f, 0x0b),
    localGet(5), i32Load(8), op(0x04, 0x40),
      nativeGraphicsBusy(4, bindings), nativeModelBusy(concat(localGet(5), i32Load(8)), 4, bindings), op(0x72),
      localGet(5), i32Load(0), i32Const(-1), op(0x46, 0x72, 0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b, 0x0b),
    localGet(5), i32Load(24), localGet(0), i32Load(24), op(0x47, 0x04, 0x40), call(bindings.functionIndex(6593)), op(0x0b),
    add(localGet(5), 12), add(localGet(0), 12), localGet(1), i32Const(12), op(0x6b), call(bindings.functionIndex(264)),
    localGet(5), i32Load(8), op(0x04, 0x40), localGet(5), call(meshIndex), op(0x05), call(bindings.functionIndex(6593)), op(0x0b), i32Const(1), op(0x0b));
  // 6585 owns visible frame order. Pass its next frame privately to the
  // collector so labels finish an icon subtree before later panels/tooltips.
  const cacheBody = bodies[bindings.functionIndex(6585) - module.functionImportCount]!;
  const cacheSite = evidence.decodeFunctions([]).find((row) => row.functionIndex === bindings.functionIndex(6585))?.callSites.get(bindings.functionIndex(6492));
  if (cacheSite?.length !== 1) throw new ProofRefusal("native HUD collection site changed");
  const site = cacheSite[0]!;
  bodies[bindings.functionIndex(6585) - module.functionImportCount] = concat(cacheBody.slice(0, site.offset),
    add(localGet(2), 4), localGet(3), op(0x49, 0x04, 0x7f), localGet(2), i32Load(4), op(0x05), i32Const(0), op(0x0b), put(9),
    cacheBody.slice(site.offset));
  const extraBodies = [bodies[bindings.functionIndex(6492) - module.functionImportCount]!, bodies[bindings.functionIndex(6490) - module.functionImportCount]!, release, reset, mesh, collect, destroy, atlas, label, hideStockKey, reap, cleanup];
  bodies[bindings.functionIndex(6492) - module.functionImportCount] = concat(op(0), localGet(0), localGet(1), localGet(2), call(collectIndex), op(0x0b));
  bodies[bindings.functionIndex(6490) - module.functionImportCount] = concat(op(0), localGet(0), call(destroyIndex), op(0x0b));
  const extraTypes = [op(0x60, 1, 0x7f, 0), op(0x60, 0, 0), op(0x60, 2, 0x7f, 0x7f, 1, 0x7f)];
  const functionTypes = [module.functionTypeIndices[bindings.functionIndex(6492)]!, module.functionTypeIndices[bindings.functionIndex(6490)]!, signatures.count,
    signatures.count + 1, signatures.count, module.functionTypeIndices[bindings.functionIndex(6492)]!, module.functionTypeIndices[bindings.functionIndex(6490)]!, signatures.count + 2, signatures.count + 2, module.functionTypeIndices[bindings.functionIndex(6490)]!, signatures.count, signatures.count + 1];
  const extraExports = [["reset", resetIndex], ["atlas", atlasIndex], ["label", labelIndex]].map(([name, index]) => concat(encodeName(`gwonmac_hud_${name}`), op(0), uleb(Number(index))));
  for (const [index, name] of ["records", "material", "uploads", "updates", "created", "destroyed", "collections", "matched", "published"].entries()) {
    if (index >= 2) extraExports.push(concat(encodeName(`gwonmac_hud_${name}`), op(3), uleb(base + index)));
  }
  return concat(WASM_HEADER, ...sections.map((section) => encodeSection({id: section.id,
    body: section.id === 1 ? concat(uleb(signatures.count + extraTypes.length), signatures.entries, ...extraTypes)
      : section.id === 3 ? encodeIndexVector([...types, ...functionTypes])
      : section.id === 6 ? concat(uleb(globals.count + 12), globals.entries, ...Array.from({length: 12}, () => concat(op(0x7f, 1), i32Const(0), op(0x0b))))
      : section.id === 7 ? concat(uleb(exports.count + extraExports.length), exports.entries, ...extraExports)
      : section.id === 10 ? encodeCode([...bodies, ...extraBodies]) : section.body,
  })));
}
