/**
 * Owns bounded map textures drawn by the native Mission and World Map, and the
 * read-only answer to whether the game routes the pointer to one of those maps.
 * Exact draw events retain the game's clipping, ordering and graphics context.
 */
import {
  concat, encodeCode, encodeIndexVector, encodeSection, parseCode, parseExports,
  parseIndexVector, sectionById, sleb, splitSections, uleb, vectorPayload, WASM_HEADER,
} from "../../main/core/wasm-binary.js";
import { call, encodeName, f32Const, f32Load, f32Store, globalGet, globalSet, i32Const, i32Load, i32Store, localGet, localSet, op } from "./wasm-emit.js";
import { NATIVE_RENDER_REFERENCE_FUNCTIONS, nativeGraphicsBusy, nativeModelBusy,
  resolveNativeRenderBindings } from "./native-render-reference.js";
import { wasmEvidence } from "./wasm-evidence.js";
import { NATIVE_PUBLISH_BUSY } from "../../shared/native-publish.js";
import { NATIVE_MAP_GRAPHICS_HEADER_BYTES, NATIVE_MAP_GRAPHICS_MAGIC, NATIVE_MAP_GRAPHICS_MAX_SIZE,
  NATIVE_MAP_GRAPHICS_SURFACES, NATIVE_MAP_QUAD_BYTES, NATIVE_MAP_QUADS_MAGIC, NATIVE_MAP_QUADS_MAX,
  NATIVE_MAP_QUAD_SURFACES } from "../../shared/native-map-graphics.js";

const CHECKED = [
  [
    16136,
    "34712a34dc14537a423cedb253e07f1ed042edc3a989937bf51d47ca5e69e08f"
  ],
  [
    16125,
    "59c2c2556eeb11939ddfca127f48e9147c954fda6644dfc100bcacbbbb78561c"
  ],
  [
    16224,
    "7fd419cd211b2d8cc343e626d799a9de508ad8120d700ccc6a7cf63d051501e6"
  ],
  [
    16170,
    "563f4f1eecdf6b1909dd4adf3bf2f5c48ad29d91ae8f188bba0f2e43b725b897"
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
    1554,
    "6a1b82f3d27e1077795392f733b2acd6b34f8be321dbc7ed65a7af8c07e80ac5"
  ],
  [
    1564,
    "2ec191d64613c3e4b68f69b0975c716bb4685d4d71dff1a0b1c423d3cc5b9bde"
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
  [
    2956,
    "f0368e490c0c24a79a9c667c1e815b4a66f28b495af15efe37c202aefb9406d9"
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
  ...NATIVE_RENDER_REFERENCE_FUNCTIONS,
  // FrMouse owns the frame under the pointer: 6271 sets a state slot, 6285
  // moves hover into UNDER_MOUSE, and 6284/6295 clear it on destroy or mode change.
  [
    6271,
    "892ddf5dea9cc02118524bbba718a4ab13c4fd8a87b11ac06b812a0042b428e4"
  ],
  [
    6284,
    "0accbe055da29e2795b2863459de19c822cf60b8b4571c5c6d6d650ba5057209"
  ],
  [
    6285,
    "9af865306eea824efa28b02ad0a0b763a6d3a4b0004ec695004d0c7dbfe0d038"
  ],
  [
    6295,
    "5012cf591c2b1edee0fd41b642a3ce2407b3385d6f776ae6d3357b5b22a329f8"
  ]
] as const;
/** FrMouse's hovered frame pointer; frames keep their ID at 0xbc and parent relation at 0x128. */
const FRAME_ID = 0xbc;
const FRAME_RELATION = 0x128;
const MAX_POINTER_DEPTH = 16;
const stack = (index: number, bytes: number) => concat(globalGet(0), i32Const(bytes), op(0x6b), localSet(index), localGet(index), globalSet(0));
const unstack = (index: number, bytes: number) => concat(localGet(index), i32Const(bytes), op(0x6a), globalSet(0));

export function appendNativeMapGraphics(input: Uint8Array): Uint8Array {
  const evidence = wasmEvidence(input);
  if (!evidence) throw new Error("invalid native map graphics input");
  const module = evidence.moduleView();
  const bindings = resolveNativeRenderBindings(module, CHECKED);
  if (!bindings) return input;
  const sections = splitSections(input);
  const globals = vectorPayload(sectionById(sections, 6));
  const exported = parseExports(sectionById(sections, 7));
  const exportVector = vectorPayload(sectionById(sections, 7));
  const signatures = vectorPayload(sectionById(sections, 1));
  const types = parseIndexVector(sectionById(sections, 3));
  const bodies = parseCode(sectionById(sections, 10));
  const epoch = exported.find((entry) => entry.name === "gwonmac_cartography_context_area_epoch")?.index;
  const status = exported.find((entry) => entry.name === "gwonmac_cartography_context_status")?.index;
  if (epoch === undefined || status === undefined) return input;
  const extraBodies: Uint8Array[] = []; const extraExports: Uint8Array[] = [];
  const scalarNames = ["owner", "buffer", "draw", "area", "serial", "uploads", "draws", "created", "destroyed", "continent", "retired"];
  const first = module.functionImportCount + bodies.length;
  // Later surfaces draw after earlier ones on the same map: each hook lands
  // after the calls already inserted at that original offset.
  const inserted = new Map<number, number>();
  for (const [surfaceIndex, surface] of NATIVE_MAP_GRAPHICS_SURFACES.entries()) {
    const base = globals.count + surfaceIndex * scalarNames.length;
    const isWorld = surface.startsWith("world");
    // Quad surfaces draw many world rectangles from one atlas: each marker stays
    // at screen resolution instead of sharing one view-sized bitmap.
    const quads = (NATIVE_MAP_QUAD_SURFACES as readonly string[]).includes(surface);
    const read = (index: number) => globalGet(base + index);
    const put = (index: number) => globalSet(base + index);
    const increment = (index: number) => concat(read(index), i32Const(1), op(0x6a), put(index));
    const hideIndex = first + extraBodies.length; const destroyIndex = hideIndex + 1;
    const renderIndex = hideIndex + 2; const publishIndex = hideIndex + 3, reapIndex = hideIndex + 4;
    // One bounded mesh/draw pair survives retirement until the queue releases it.
    const reap = concat(op(1, 1, 0x7f), read(10), op(0x45, 0x04, 0x40, 0x0f, 0x0b),
      nativeGraphicsBusy(0, bindings), op(0x04, 0x40, 0x0f, 0x0b),
      read(2), op(0x04, 0x40), nativeModelBusy(read(2), 0, bindings), op(0x04, 0x40, 0x0f, 0x0b),
      read(2), call(bindings.functionIndex(748)), read(1), call(bindings.functionIndex(748)), increment(8), op(0x0b),
      ...[1, 2, 10].map((index) => concat(i32Const(0), put(index))), op(0x0b));
    const hide = concat(op(0), i32Const(0), put(3), i32Const(0), put(4), call(reapIndex), op(0x0b));
    const destroy = concat(op(0), localGet(0), read(0), op(0x46, 0x04, 0x40), call(hideIndex),
      i32Const(0), put(0), i32Const(1), put(10), op(0x0b), call(reapIndex), op(0x0b));
    // The draw event provides trusted ownership. Native matrices 0/1 already
    // project world-map units; only our model matrix is identity, then restored.
    const render = concat(op(1, 1, 0x7f), call(reapIndex),
      read(10), op(0x04, 0x40, 0x0f, 0x0b), localGet(0), read(0), op(0x47, 0x04, 0x40), read(0), call(destroyIndex), read(10), op(0x04, 0x40, 0x0f, 0x0b), localGet(0), put(0), op(0x0b),
      ...(isWorld ? [localGet(0), i32Load(4), read(9), op(0x47, 0x04, 0x40), call(hideIndex), op(0x0b), localGet(0), i32Load(4), put(9)] : []),
      read(3), i32Const(0), op(0x4a), read(3), op(0x23), uleb(epoch), op(0x46, 0x71),
      op(0x23), uleb(status), i32Const(1), op(0x46, 0x71), read(2), i32Const(0), op(0x47, 0x71),
      op(0x45, 0x04, 0x40), call(hideIndex), op(0x0f, 0x0b),
      // Capturing native view/model state also asserts while this model is queued.
      nativeGraphicsBusy(1, bindings), nativeModelBusy(read(2), 1, bindings), op(0x72, 0x04, 0x40, 0x0f, 0x0b),
      stack(1, 80), localGet(1), i32Const(2), call(bindings.functionIndex(1333)), i32Const(52), call(bindings.functionIndex(264)),
      i32Const(2), call(bindings.functionIndex(1357)), read(2), i32Const(0), call(bindings.functionIndex(1579)),
      localGet(1), read(2), i32Store(64), i32Const(1), localGet(1), i32Const(64), op(0x6a), call(bindings.functionIndex(1564)),
      i32Const(0), i32Const(1), localGet(1), i32Const(64), op(0x6a), i32Const(0), call(bindings.functionIndex(2956)),
      i32Const(2), localGet(1), call(bindings.functionIndex(1334)), increment(6), unstack(1, 80), op(0x0b));
    const memoryEnd = (bytes: Uint8Array) => concat(localGet(0), op(0xad), bytes, op(0xad, 0x7c),
      op(0x3f, 0, 0xad), op(0x42), sleb(65536), op(0x7e, 0x58));
    const finite = (offset: number) => concat(localGet(0), f32Load(offset), op(0x8b), f32Const(1000000), op(0x5f));
    const dimension = (local: number) => concat(localGet(local), i32Const(64), op(0x4f), localGet(local), i32Const(NATIVE_MAP_GRAPHICS_MAX_SIZE), op(0x4d, 0x71),
      localGet(local), localGet(local), i32Const(1), op(0x6b, 0x71, 0x45, 0x71));
    // Native bitmap layers (14205) use alpha stage 7 / translucent order 11.
    // The Compass ring's additive stage 4 cannot darken the terrain outside.
    const quadLoop = (body: Uint8Array) => concat(i32Const(0), localSet(10), op(0x02, 0x40, 0x03, 0x40),
      localGet(10), localGet(9), op(0x4f, 0x0d, 1), body, localGet(10), i32Const(1), op(0x6a), localSet(10), op(0x0c, 0, 0x0b, 0x0b));
    const bitmapMesh = concat(
      read(1), i32Const(4), call(bindings.functionIndex(1446)), localSet(8),
      ...Array.from({length: 4}, (_, vertex) => concat(
        localGet(8), localGet(0), f32Load(32 + vertex * 8), f32Store(vertex * 24),
        localGet(8), localGet(0), f32Load(36 + vertex * 8), op(0x8c), f32Store(vertex * 24 + 4),
        localGet(8), f32Const(0), f32Store(vertex * 24 + 8), localGet(8), i32Const(-1), i32Store(vertex * 24 + 12),
        localGet(8), f32Const(vertex === 1 || vertex === 2 ? 1 : 0), f32Store(vertex * 24 + 16),
        localGet(8), f32Const(vertex >= 2 ? 1 : 0), f32Store(vertex * 24 + 20))),
      read(1), i32Const(6), call(bindings.functionIndex(1445)), localSet(8),
      ...[0, 1, 2, 0, 2, 3].map((vertex, index) => concat(localGet(8), i32Const(vertex), op(0x3b, 1), uleb(index * 2))));
    // Each quad record is x0, y0, x1, y1 in world units, then u0, v0, u1, v1.
    const quadMesh = concat(
      read(1), localGet(9), i32Const(4), op(0x6c), call(bindings.functionIndex(1446)), localSet(8),
      localGet(0), i32Const(NATIVE_MAP_GRAPHICS_HEADER_BYTES), op(0x6a), localSet(12),
      quadLoop(concat(
        ...Array.from({length: 4}, (_, vertex) => concat(
          localGet(8), localGet(12), f32Load(vertex === 1 || vertex === 2 ? 8 : 0), f32Store(vertex * 24),
          localGet(8), localGet(12), f32Load(vertex >= 2 ? 12 : 4), op(0x8c), f32Store(vertex * 24 + 4),
          localGet(8), f32Const(0), f32Store(vertex * 24 + 8), localGet(8), i32Const(-1), i32Store(vertex * 24 + 12),
          localGet(8), localGet(12), f32Load(vertex === 1 || vertex === 2 ? 24 : 16), f32Store(vertex * 24 + 16),
          localGet(8), localGet(12), f32Load(vertex >= 2 ? 28 : 20), f32Store(vertex * 24 + 20))),
        localGet(8), i32Const(96), op(0x6a), localSet(8), localGet(12), i32Const(NATIVE_MAP_QUAD_BYTES), op(0x6a), localSet(12))),
      read(1), localGet(9), i32Const(6), op(0x6c), call(bindings.functionIndex(1445)), localSet(11),
      quadLoop(concat(
        ...[0, 1, 2, 0, 2, 3].map((vertex, index) => concat(localGet(11), localGet(10), i32Const(4), op(0x6c), i32Const(vertex), op(0x6a), op(0x3b, 1), uleb(index * 2))),
        localGet(11), i32Const(12), op(0x6a), localSet(11))));
    // Every quad float must be finite and bounded before any native call.
    const quadFloats = concat(i32Const(0), localSet(10), op(0x02, 0x40, 0x03, 0x40),
      localGet(10), localGet(9), i32Const(8), op(0x6c), op(0x4f, 0x0d, 1),
      localGet(0), localGet(10), i32Const(4), op(0x6c), op(0x6a), f32Load(NATIVE_MAP_GRAPHICS_HEADER_BYTES), op(0x8b), f32Const(1000000), op(0x5f, 0x45),
      op(0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
      localGet(10), i32Const(1), op(0x6a), localSet(10), op(0x0c, 0, 0x0b, 0x0b));
    const pixelOffset = quads ? concat(i32Const(NATIVE_MAP_GRAPHICS_HEADER_BYTES), localGet(9), i32Const(NATIVE_MAP_QUAD_BYTES), op(0x6c, 0x6a)) : i32Const(NATIVE_MAP_GRAPHICS_HEADER_BYTES);
    // A retained model's texture swap asserts while the renderer holds it; this
    // runs from the host's frame, so report busy before hiding or allocating.
    const busyScratch = quads ? 13 : 9;
    const publish = concat(op(1, quads ? 12 : 8, 0x7f), call(reapIndex),
      read(10), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b),
      nativeGraphicsBusy(busyScratch, bindings), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b),
      read(2), op(0x04, 0x40), nativeModelBusy(read(2), busyScratch, bindings), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b, 0x0b),
      call(hideIndex),
      localGet(0), i32Const(0), op(0x4b), localGet(0), i32Const(3), op(0x71, 0x45, 0x71),
      localGet(1), i32Const(NATIVE_MAP_GRAPHICS_HEADER_BYTES), op(0x4f, 0x71), memoryEnd(i32Const(NATIVE_MAP_GRAPHICS_HEADER_BYTES)), op(0x71),
      op(0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
      localGet(0), i32Load(12), localSet(5), localGet(0), i32Load(16), localSet(6), localGet(0), i32Load(8), localSet(7), ...(quads ? [localGet(0), i32Load(28), localSet(9)] : []),
      localGet(0), i32Load(0), i32Const(quads ? NATIVE_MAP_QUADS_MAGIC : NATIVE_MAP_GRAPHICS_MAGIC), op(0x46), localGet(0), i32Load(4), localGet(1), op(0x46, 0x71),
      dimension(5), op(0x71), dimension(6), op(0x71),
      ...(quads ? [localGet(9), i32Const(1), op(0x4f, 0x71), localGet(9), i32Const(NATIVE_MAP_QUADS_MAX), op(0x4d, 0x71)] : []),
      localGet(1), localGet(5), localGet(6), op(0x6c), i32Const(4), op(0x6c), pixelOffset, op(0x6a, 0x46, 0x71),
      memoryEnd(localGet(1)), op(0x71), localGet(7), i32Const(0), op(0x4a, 0x71), localGet(7), op(0x23), uleb(epoch), op(0x46, 0x71),
      op(0x23), uleb(status), i32Const(1), op(0x46, 0x71), read(0), i32Const(0), op(0x47, 0x71),
      localGet(0), i32Load(20), i32Const(0), op(0x4a, 0x71),
      ...(isWorld ? [localGet(0), i32Load(24), read(9), op(0x46, 0x71)] : []),
      ...(quads ? [] : Array.from({length: 8}, (_, index) => concat(finite(32 + index * 4), op(0x71)))),
      op(0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b), ...(quads ? [quadFloats] : []), stack(4, 64),
      localGet(4), localGet(0), pixelOffset, op(0x6a), i32Store(0),
      localGet(4), localGet(5), i32Store(8), localGet(4), localGet(6), i32Store(12),
      localGet(4), i32Const(0), localGet(4), i32Const(8), op(0x6a), i32Const(1), i32Const(112), call(bindings.functionIndex(2249)), localSet(2),
      localGet(4), localGet(2), i32Store(16), localGet(4), i32Const(7), i32Store(20), localGet(4), i32Const(482), i32Store(24),
      i32Const(1), localGet(4), i32Const(16), op(0x6a), localGet(4), i32Const(20), op(0x6a), localGet(4), i32Const(24), op(0x6a), i32Const(0), i32Const(0), i32Const(33555424), i32Const(11), call(bindings.functionIndex(3137)), localSet(3),
      read(2), op(0x45, 0x04, 0x40),
        i32Const(265), i32Const(0), call(bindings.functionIndex(1444)), put(1), localGet(4), read(1), i32Store(28), localGet(4), localGet(3), i32Store(32),
        i32Const(1), localGet(4), i32Const(28), op(0x6a), localGet(4), i32Const(32), op(0x6a), i32Const(0), i32Const(0), call(bindings.functionIndex(1554)), put(2), increment(7),
      op(0x05), read(2), i32Const(0), localGet(3), call(bindings.functionIndex(1569)), op(0x0b),
      localGet(3), call(bindings.functionIndex(748)), localGet(2), call(bindings.functionIndex(748)),
      quads ? quadMesh : bitmapMesh,
      ...[36, 40, 44].map((offset) => concat(localGet(4), f32Const(-1000000), f32Store(offset))),
      ...[48, 52, 56].map((offset) => concat(localGet(4), f32Const(1000000), f32Store(offset))),
      read(1), localGet(4), i32Const(36), op(0x6a), localGet(4), i32Const(48), op(0x6a), call(bindings.functionIndex(1449)), read(1), call(bindings.functionIndex(1448)),
      localGet(7), put(3), localGet(0), i32Load(20), put(4), increment(5), unstack(4, 64), i32Const(1), op(0x0b));
    extraBodies.push(hide, destroy, render, publish, reap);
    const hooks = !isWorld
      ? [[16136, 939, concat(localGet(0), call(renderIndex))], [16125, 3, concat(localGet(0), call(destroyIndex))]] as const
      : [[16224, 830, concat(localGet(4), i32Load(0), call(renderIndex))], [16170, 3, concat(localGet(0), call(destroyIndex))]] as const;
    for (const [index, originalOffset, bytes] of hooks) {
      const offset = originalOffset + (inserted.get(index) ?? 0);
      const local = bindings.functionIndex(index) - module.functionImportCount; const body = bodies[local]!;
      bodies[local] = concat(body.slice(0, offset), bytes, body.slice(offset));
      inserted.set(index, (inserted.get(index) ?? 0) + bytes.length);
    }
    for (const [name, index] of [["hide", hideIndex], ["publish", publishIndex]] as const) {
      extraExports.push(concat(encodeName(`gwonmac_${surface}_graphics_${name}`), op(0), uleb(index)));
    }
    for (const index of [3, 4, 5, 6, 7, 8]) {
      extraExports.push(concat(encodeName(`gwonmac_${surface}_graphics_${scalarNames[index]}`), op(3), uleb(base + index)));
    }
  }
  // Answers 1 only when the hovered frame or one of its ancestors has the map's
  // frame ID. Every frame read is bounded by memory; no game state is written.
  const pointerIndex = first + extraBodies.length;
  extraBodies.push(concat(op(1, 2, 0x7f),
    localGet(0), i32Const(0), op(0x4c, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
    i32Const(0), i32Load(bindings.underMouse), localSet(1),
    op(0x03, 0x40),
      localGet(1), op(0x45), localGet(1), op(0xad), i32Const(FRAME_RELATION + 4), op(0xad, 0x7c),
      op(0x3f, 0, 0xad), op(0x42), sleb(65536), op(0x7e, 0x58, 0x45, 0x72, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
      localGet(1), i32Load(FRAME_ID), localGet(0), op(0x46, 0x04, 0x40), i32Const(1), op(0x0f, 0x0b),
      localGet(1), i32Load(FRAME_RELATION), localSet(1), localGet(1), op(0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
      localGet(1), i32Const(FRAME_RELATION), op(0x6b), localSet(1),
      localGet(2), i32Const(1), op(0x6a), localSet(2), localGet(2), i32Const(MAX_POINTER_DEPTH), op(0x49, 0x0d, 0),
    op(0x0b), i32Const(0), op(0x0b)));
  extraExports.push(concat(encodeName("gwonmac_map_pointer_within"), op(0), uleb(pointerIndex)));
  const extraTypes = [op(0x60, 0, 0), op(0x60, 1, 0x7f, 0), op(0x60, 2, 0x7f, 0x7f, 1, 0x7f), op(0x60, 1, 0x7f, 1, 0x7f)];
  return concat(WASM_HEADER, ...sections.map((section) => encodeSection({id: section.id,
    body: section.id === 1 ? concat(uleb(signatures.count + extraTypes.length), signatures.entries, ...extraTypes)
      : section.id === 3 ? encodeIndexVector([...types, ...NATIVE_MAP_GRAPHICS_SURFACES.flatMap(() => [0, 1, 1, 2, 0].map((type) => signatures.count + type)), signatures.count + 3])
      : section.id === 6 ? concat(uleb(globals.count + scalarNames.length * NATIVE_MAP_GRAPHICS_SURFACES.length), globals.entries, ...Array.from({length: scalarNames.length * NATIVE_MAP_GRAPHICS_SURFACES.length}, () => concat(op(0x7f, 1), i32Const(0), op(0x0b))))
      : section.id === 7 ? concat(uleb(exportVector.count + extraExports.length), exportVector.entries, ...extraExports)
      : section.id === 10 ? encodeCode([...bodies, ...extraBodies]) : section.body,
  })));
}
