/**
 * Gives the exact native Compass Canvas one retained terrain texture and mesh.
 * Native frame attachment, resource references and camera projection own drawing.
 */
import {
  concat, encodeCode, encodeIndexVector, encodeSection, parseCode, parseExports,
  parseIndexVector, sectionById, sleb, splitSections, uleb, vectorPayload, WASM_HEADER,
} from "../../main/core/wasm-binary.js";
import { call, encodeName, f32Const, f32Load, f32Store, globalGet, globalSet, i32Const, i32Load, i32Store, localGet, localSet, op } from "./wasm-emit.js";
import { NATIVE_RENDER_REFERENCE_FUNCTIONS, nativeGraphicsBusy, nativeModelBusy,
  resolveNativeRenderBindings, type NativeRenderBindings } from "./native-render-reference.js";
import { wasmEvidence } from "./wasm-evidence.js";
import { NATIVE_PUBLISH_BUSY } from "../../shared/native-publish.js";
import {
  NATIVE_COMPASS_CLIP_RADIUS, NATIVE_COMPASS_TERRAIN_HEADER_BYTES,
  NATIVE_COMPASS_TERRAIN_MAGIC, NATIVE_COMPASS_TERRAIN_MAX_SIZE,
  NATIVE_COMPASS_TERRAIN_WORLD_SPAN, NATIVE_COMPASS_WORLD_SCALE,
} from "../../shared/native-compass-terrain.js";

const CHECKED = [
  [14112, "40b8dfac2eb2e4c861e2daa4d3e775de33d15194c64765ddb53025bcb73fb74f"],
  [14116, "ee5ae8fd4eecae9bccac822d7ae7f3614286a2c395af6b348f6b2082c6c23aee"],
  [14126, "256397ed0536d44ea656323cddb51bc29fb2b87b6af98a5793ff8ee9292a7c6a"],
  [14137, "019d8124a7e7ebcc6691a5d7adc87cef503d3eca5789ab2c6667bce2afad495f"],
  [14132, "1f9a028cc7edb1245971483bce34905c5121b85b305a8b3eed34987ca9a8f966"],
  [14147, "b47aa2a9b0df83431a59ccf6754b9435af7f2f4b9e35be532930ce89323854ae"],
  [1444, "88b977ad123c93c1926a67efe32721398cafb0f86fa2b3f5a57f3bd1493fb842"],
  [1445, "a883926f470e716e59f62bec0b03adc8721112e78e859477bcab028de2ab311b"],
  [1446, "3cfe5e2ff85ca8c472ad41c7a3ce4db7eb66c4dcb86b6fdfc69530067fecb650"],
  [1448, "79c87cd0bab2c93f9718d557a7bd552ee2c37a70ec7f6d0f82224aa8c45e438d"],
  [1449, "3e750376bbc2a51393c0ba169355550ba48a1b7fdea3fff8e1d0b1b5be2d6581"],
  [1556, "25b4a1cbaf249c4dab4842fd7c90ef0e2f7d28a9184c81c1167ced06d1ee45ca"],
  [1522, "75b99afc7b3b9e6208aba50ea70618e84b3171a550788211e2587c551ab2f041"],
  [1565, "c7e2cc16116757011dfecf14eff0220469221cb200b109b650461eb5c750ceba"],
  [1530, "e890ea8a31e26749317404120c8d07354743fcd31a603921416875723683e783"],
  [1569, "46b25139552a8d66a0b519d735755346f9be5d37ab2d1e9b02bca1d79bee20fc"],
  [1579, "c46a846084eb5292db3d41d901724d9e2330cf1bb9f7fb1dec371fa642e4cc48"],
  [3137, "3f4d7e18ad91c20147e2053ee1e42f8eb60c97937fefba142d37c93f2d672e36"],
  [2249, "149d95966e67f554da12f46c064ee366a9d531b167842e6ea0a201ca730b474e"],
  [2187, "fe75a199add4d8ffb71a03e694144b903e3e82a7c165558b7593a8e5f9495415"],
  [748, "150d8921520d98fbfa28dc4faf5e2fe488a65c69832b13d7dcf489b2f07d7b60"],
  [6827, "f8adede1f8a366bdce292461977643bb760e8e846bc30689312781dcab0630c7"],
  [6593, "7c2c5556e6546a9059f7f3c654c1d214ae7bf06ce4fabeefbadc2b8d6691f153"],
  ...NATIVE_RENDER_REFERENCE_FUNCTIONS,
] as const;
const SEGMENTS = 64;
const stack = (index: number, bytes: number) => concat(globalGet(0), i32Const(bytes), op(0x6b), localSet(index), localGet(index), globalSet(0));
const unstack = (index: number, bytes: number) => concat(localGet(index), i32Const(bytes), op(0x6a), globalSet(0));

export function appendNativeCompassTerrain(input: Uint8Array): Uint8Array {
  const evidence = wasmEvidence(input);
  if (!evidence) throw new Error("invalid native Compass terrain input");
  const module = evidence.moduleView();
  const bindings = resolveNativeRenderBindings(module, CHECKED);
  if (!bindings) return input;
  return appendCompassSurface(appendCompassSurface(input, false, bindings), true, bindings);
}

/** Both Compass consumers share exact Canvas lifetime and bitmap ownership. */
function appendCompassSurface(input: Uint8Array, screenSpace: boolean, bindings: NativeRenderBindings): Uint8Array {
  const evidence = wasmEvidence(input);
  if (!evidence) throw new Error("invalid Compass surface input");
  const module = evidence.moduleView();
  const prefix = screenSpace ? "gwonmac_compass_ranges" : "gwonmac_compass_terrain";
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
  const base = globals.count;
  const read = (index: number) => globalGet(base + index);
  const put = (index: number) => globalSet(base + index);
  const first = module.functionImportCount + bodies.length;
  const hideIndex = first; const destroyIndex = first + 1; const initIndex = first + 2;
  const attachIndex = first + 3; const updateIndex = first + 4; const publishIndex = first + 5;
  const reapIndex = first + 6, ensureIndex = first + 7;
  // Private flags 20/21 retain retirement and one deferred index clear.
  const increment = (index: number) => concat(read(index), i32Const(1), op(0x6a), put(index));
  const contextValid = () => concat(read(3), i32Const(0), op(0x4a), read(3), op(0x23), uleb(epoch), op(0x46, 0x71), op(0x23), uleb(status), i32Const(1), op(0x46, 0x71));
  const finite = (value: Uint8Array, limit: number) => concat(value, op(0x8b), f32Const(limit), op(0x5f));
  const reap = concat(op(1, 1, 0x7f), read(20), op(0x45, 0x04, 0x40, 0x0f, 0x0b),
    read(2), op(0x04, 0x40), nativeGraphicsBusy(0, bindings), op(0x04, 0x40, 0x0f, 0x0b),
    nativeModelBusy(read(2), 0, bindings), op(0x04, 0x40, 0x0f, 0x0b),
    read(2), call(bindings.functionIndex(748)), read(1), call(bindings.functionIndex(748)),
    increment(8), op(0x0b), ...[1, 2, 20, 21].map((index) => concat(i32Const(0), put(index))), op(0x0b));
  // Host withdrawal must not rewrite indices in a queue-held mesh. Native
  // update retries the hidden geometry after the render reference drains.
  const hide = concat(op(1, 1, 0x7f), read(3), op(0x04, 0x40), call(bindings.functionIndex(6593)), i32Const(1), put(21), op(0x0b), i32Const(0), put(3), call(reapIndex),
    read(21), op(0x45, 0x04, 0x40, 0x0f, 0x0b),
    read(1), op(0x04, 0x40),
    nativeGraphicsBusy(0, bindings), op(0x04, 0x40, 0x0f, 0x0b),
    nativeModelBusy(read(2), 0, bindings), op(0x04, 0x40, 0x0f, 0x0b),
    read(1), i32Const(0), call(bindings.functionIndex(1445)), op(0x1a), read(1), call(bindings.functionIndex(1448)), i32Const(0), put(21), op(0x0b, 0x0b));
  const destroy = concat(op(0), localGet(0), read(0), op(0x46), read(0), i32Const(0), op(0x47, 0x71, 0x04, 0x40),
    call(bindings.functionIndex(6593)), i32Const(0), put(0), i32Const(0), put(3), i32Const(0), put(4), i32Const(0), put(9), i32Const(1), put(20),
    op(0x0b), call(reapIndex), op(0x0b));
  // Lazy creation avoids overwriting a pending pair when another Canvas opens.
  // Only a live native callback dereferences the current Canvas after a retry.
  const ensure = concat(op(1, 1, 0x7f), call(reapIndex),
    read(20), read(2), op(0x72, 0x04, 0x40, 0x0f, 0x0b),
    nativeGraphicsBusy(0, bindings), op(0x04, 0x40, 0x0f, 0x0b),
    i32Const(265), i32Const(0), call(bindings.functionIndex(1444)), put(1), read(0), i32Load(144), call(bindings.functionIndex(1556)), put(2),
    read(2), i32Const(0), read(1), call(bindings.functionIndex(1565)), read(2), i32Const(0), call(bindings.functionIndex(1579)), increment(7), op(0x0b));
  const init = concat(op(0), read(0), call(destroyIndex), localGet(0), put(0), call(ensureIndex), op(0x0b));
  const attach = concat(op(1, 1, 0x7f),
    localGet(0), read(0), op(0x46, 0x04, 0x40), call(ensureIndex), op(0x0b),
    localGet(0), read(0), op(0x46), read(20), op(0x45, 0x71), read(2), i32Const(0), op(0x47, 0x71, 0x04, 0x40), stack(2, 16),
    localGet(2), read(2), i32Store(0), localGet(1), i32Const(1), localGet(2), i32Const(4), call(bindings.functionIndex(6827)), unstack(2, 16), op(0x0b, 0x0b));

  const vertexStores: Uint8Array[] = [];
  const points: Readonly<{ x: number; y: number; edge: boolean }>[] = [{x: 0, y: 0, edge: false}];
  for (const edge of [false, true]) for (let n = 0; n < SEGMENTS; n += 1) {
    const angle = n * 2 * Math.PI / SEGMENTS;
    points.push({x: Math.cos(angle), y: Math.sin(angle), edge});
  }
  points.forEach((point, vertex) => {
    const offset = vertex * 24;
    const radius = (dimension: number) => point.edge || vertex === 0 ? f32Const(NATIVE_COMPASS_CLIP_RADIUS)
      : concat(f32Const(NATIVE_COMPASS_CLIP_RADIUS), f32Const(1), localGet(dimension), op(0x95, 0x93));
    vertexStores.push(
      f32Const(0.5), f32Const(point.x), radius(6), op(0x94, 0x92), localSet(12),
      f32Const(0.5), f32Const(point.y), radius(7), op(0x94, 0x92), localSet(13),
      // Invert the Canvas's rotation for texture coordinates. The frame itself
      // applies the retained transform, so geometry remains Canvas-local.
      localGet(9), localGet(12), f32Const(0.5), op(0x93, 0x94), localGet(8), localGet(13), f32Const(0.5), op(0x93, 0x94, 0x92), f32Const(NATIVE_COMPASS_WORLD_SCALE), op(0x95), localSet(14),
      localGet(9), localGet(13), f32Const(0.5), op(0x93, 0x94), localGet(8), localGet(12), f32Const(0.5), op(0x93, 0x94, 0x93), f32Const(NATIVE_COMPASS_WORLD_SCALE), op(0x95), localSet(15),
      localGet(4), localGet(6), localGet(12), op(0x94), f32Store(offset),
      localGet(4), localGet(7), localGet(13), op(0x94), f32Store(offset + 4),
      localGet(4), f32Const(0), f32Store(offset + 8),
      localGet(4), i32Const(point.edge ? 0x00ffffff : -1), i32Store(offset + 12),
      localGet(4), ...(screenSpace ? [localGet(12)] : [localGet(10), localGet(14), op(0x92), read(10), op(0x93), read(12), op(0x95)]), f32Store(offset + 16),
      localGet(4), ...(screenSpace ? [localGet(13)] : [read(11), localGet(11), localGet(15), op(0x92, 0x93), read(12), op(0x95)]), f32Store(offset + 20));
  });
  const indexStores: Uint8Array[] = [];
  for (let n = 0; n < SEGMENTS; n += 1) {
    const a = 1 + n; const b = 1 + (n + 1) % SEGMENTS;
    // Clockwise winding matches the native Canvas triangles.
    [0, b, a, a, b, a + SEGMENTS, a + SEGMENTS, b, b + SEGMENTS].forEach((vertex, at) => {
      indexStores.push(concat(localGet(5), i32Const(vertex), op(0x3b, 1), uleb((n * 9 + at) * 2)));
    });
  }
  const update = concat(op(2, 3, 0x7f, 10, 0x7d),
    call(reapIndex), localGet(0), read(0), op(0x47, 0x04, 0x40, 0x0f, 0x0b), call(ensureIndex),
    read(20), read(2), op(0x45, 0x72, 0x04, 0x40, 0x0f, 0x0b),
    localGet(0), f32Load(180), localGet(0), f32Load(172), op(0x93), localSet(6),
    localGet(0), f32Load(184), localGet(0), f32Load(176), op(0x93), localSet(7),
    localGet(2), f32Load(0), localSet(8), localGet(2), f32Load(4), localSet(9),
    localGet(1), f32Load(0), localSet(10), localGet(1), f32Load(4), localSet(11),
    // An unchanged native camera and rectangle need no buffer rewrite. The
    // serial invalidates UVs after a tile upload or indices after withdrawal.
    contextValid(), read(4), read(19), op(0x46, 0x71),
    localGet(6), read(15), op(0x5b, 0x71), localGet(7), read(16), op(0x5b, 0x71),
    ...(screenSpace ? [] : [localGet(10), read(13), op(0x5b, 0x71), localGet(11), read(14), op(0x5b, 0x71),
      localGet(8), read(17), op(0x5b, 0x71), localGet(9), read(18), op(0x5b, 0x71)]),
    op(0x04, 0x40, 0x0f, 0x0b),
    localGet(8), put(17), localGet(9), put(18),
    localGet(10), put(13), localGet(11), put(14), localGet(6), put(15), localGet(7), put(16),
    // The host sizes its first terrain tile from the camera and rectangle
    // above, so they are published before any context check. Without a
    // published area the hidden mesh stays withdrawn; while the renderer holds
    // the model, geometry waits and the cleared serial forces the next rewrite.
    contextValid(), op(0x45, 0x04, 0x40), call(hideIndex), op(0x0f, 0x0b),
    nativeGraphicsBusy(3, bindings), nativeModelBusy(read(2), 3, bindings), op(0x72, 0x04, 0x40), i32Const(-1), put(19), op(0x0f, 0x0b),
    contextValid(), finite(localGet(6), 16384), op(0x71), localGet(6), f32Const(2), op(0x5e, 0x71),
    finite(localGet(7), 16384), op(0x71), localGet(7), f32Const(2), op(0x5e, 0x71),
    finite(localGet(10), 1000000), op(0x71), finite(localGet(11), 1000000), op(0x71),
    localGet(8), localGet(8), op(0x94), localGet(9), localGet(9), op(0x94, 0x92), f32Const(1), op(0x93, 0x8b), f32Const(0.02), op(0x5f, 0x71),
    ...(screenSpace ? [] : [
    localGet(10), read(10), f32Const(4500), op(0x92, 0x60, 0x71), localGet(10), read(10), read(12), op(0x92), f32Const(4500), op(0x93, 0x5f, 0x71),
    localGet(11), read(11), f32Const(4500), op(0x93, 0x5f, 0x71), localGet(11), read(11), read(12), op(0x93), f32Const(4500), op(0x92, 0x60, 0x71),
    ]),
    op(0x45, 0x04, 0x40), call(hideIndex), op(0x0f, 0x0b),
    stack(3, 32), read(1), i32Const(points.length), call(bindings.functionIndex(1446)), localSet(4), read(1), i32Const(SEGMENTS * 9), call(bindings.functionIndex(1445)), localSet(5),
    ...vertexStores, ...indexStores,
    ...[0, 4, 8].map((offset) => concat(localGet(3), f32Const(0), f32Store(offset))),
    ...[12, 16, 20].map((offset) => concat(localGet(3), localGet(6), localGet(7), op(0x97), f32Store(offset))),
    read(1), localGet(3), localGet(3), i32Const(12), op(0x6a), call(bindings.functionIndex(1449)), read(1), call(bindings.functionIndex(1448)),
    read(4), put(19), increment(5), unstack(3, 32), op(0x0b));

  // A copied bitmap is the only write capability. Validate its complete region
  // before reading pixels; GrTex copies the input with flags & 1 == 0.
  const memoryEnd = (bytes: Uint8Array) => concat(localGet(0), op(0xad), bytes, op(0xad, 0x7c), op(0x3f, 0, 0xad), op(0x42), sleb(65536), op(0x7e, 0x58));
  // The texture swap below asserts while the renderer holds the model; this
  // runs from the host's frame, so report busy before hiding or allocating.
  const publish = concat(op(1, 6, 0x7f), call(reapIndex),
    read(20), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b),
    nativeGraphicsBusy(7, bindings), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b),
    read(2), op(0x04, 0x40), nativeModelBusy(read(2), 7, bindings), op(0x04, 0x40), i32Const(NATIVE_PUBLISH_BUSY), op(0x0f, 0x0b, 0x0b),
    call(hideIndex),
    localGet(0), i32Const(0), op(0x4b), localGet(0), i32Const(3), op(0x71, 0x45, 0x71),
    localGet(1), i32Const(NATIVE_COMPASS_TERRAIN_HEADER_BYTES), op(0x4f, 0x71), memoryEnd(i32Const(NATIVE_COMPASS_TERRAIN_HEADER_BYTES)), op(0x71),
    op(0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b),
    localGet(0), i32Load(12), localSet(5), localGet(0), i32Load(8), localSet(6),
    localGet(0), i32Load(0), i32Const(NATIVE_COMPASS_TERRAIN_MAGIC), op(0x46), localGet(0), i32Load(4), localGet(1), op(0x46, 0x71),
    localGet(5), i32Const(64), op(0x4f, 0x71), localGet(5), i32Const(NATIVE_COMPASS_TERRAIN_MAX_SIZE), op(0x4d, 0x71),
    localGet(5), localGet(5), i32Const(1), op(0x6b, 0x71, 0x45, 0x71),
    localGet(1), localGet(5), localGet(5), op(0x6c), i32Const(4), op(0x6c), i32Const(NATIVE_COMPASS_TERRAIN_HEADER_BYTES), op(0x6a, 0x46, 0x71),
    memoryEnd(localGet(1)), op(0x71), localGet(6), i32Const(0), op(0x4a, 0x71), localGet(6), op(0x23), uleb(epoch), op(0x46, 0x71),
    op(0x23), uleb(status), i32Const(1), op(0x46, 0x71), read(2), i32Const(0), op(0x47, 0x71),
    finite(concat(localGet(0), f32Load(16)), 1000000), op(0x71), finite(concat(localGet(0), f32Load(20)), 1000000), op(0x71),
    localGet(0), f32Load(24), f32Const(NATIVE_COMPASS_TERRAIN_WORLD_SPAN), op(0x5b, 0x71),
    localGet(0), i32Load(28), i32Const(0), op(0x4a, 0x71),
    op(0x45, 0x04, 0x40), i32Const(0), op(0x0f, 0x0b), stack(4, 32),
    localGet(4), localGet(0), i32Const(NATIVE_COMPASS_TERRAIN_HEADER_BYTES), op(0x6a), i32Store(0),
    localGet(4), localGet(5), i32Store(8), localGet(4), localGet(5), i32Store(12),
    localGet(4), i32Const(0), localGet(4), i32Const(8), op(0x6a), i32Const(1), i32Const(112), call(bindings.functionIndex(2249)), localSet(2),
    localGet(4), localGet(2), i32Store(16), localGet(4), i32Const(screenSpace ? 4 : 7), i32Store(20), localGet(4), i32Const(482), i32Store(24),
    i32Const(1), localGet(4), i32Const(16), op(0x6a), localGet(4), i32Const(20), op(0x6a), localGet(4), i32Const(24), op(0x6a), i32Const(0), i32Const(0), i32Const(33555424), i32Const(screenSpace ? 4 : 11), call(bindings.functionIndex(3137)), localSet(3),
    read(2), i32Const(0), localGet(3), call(bindings.functionIndex(1569)), localGet(3), call(bindings.functionIndex(748)), localGet(2), call(bindings.functionIndex(748)),
    localGet(0), f32Load(16), put(10), localGet(0), f32Load(20), put(11), localGet(0), f32Load(24), put(12),
    localGet(5), put(9), localGet(0), i32Load(28), put(4), localGet(6), put(3), increment(6), unstack(4, 32), i32Const(1), op(0x0b));

  for (const [index, offset, bytes] of [
    [14112, 530, concat(localGet(0), call(initIndex))],
    [14116, 3, concat(localGet(0), call(destroyIndex))],
    [14126, 3, concat(localGet(0), localGet(1), call(attachIndex))],
    [14137, 17, concat(localGet(0), localGet(1), localGet(2), call(updateIndex))],
  ] as const) {
    const local = bindings.functionIndex(index) - module.functionImportCount; const body = bodies[local]!;
    let insertion = offset;
    if (screenSpace && index === 14126) {
      const terrainPublish = exported.find((entry) => entry.name === "gwonmac_compass_terrain_publish")?.index;
      if (terrainPublish === undefined) throw new Error("missing native terrain attachment");
      const earlier = concat(localGet(0), localGet(1), call(terrainPublish - 2));
      if (!earlier.every((byte, at) => body[offset + at] === byte)) throw new Error("native Compass attachment changed");
      insertion += earlier.length;
    }
    bodies[local] = concat(body.slice(0, insertion), bytes, body.slice(insertion));
  }
  const extraTypes = [
    op(0x60, 0, 0), op(0x60, 1, 0x7f, 0), op(0x60, 2, 0x7f, 0x7f, 0),
    op(0x60, 3, 0x7f, 0x7f, 0x7f, 0), op(0x60, 2, 0x7f, 0x7f, 1, 0x7f),
  ];
  bodies.push(hide, destroy, init, attach, update, publish, reap, ensure);
  const globalTypes = [...Array.from({length: 10}, () => 0x7f), ...Array.from({length: 9}, () => 0x7d), 0x7f, 0x7f, 0x7f];
  const scalarExports = [["area", 3], ["serial", 4], ["updates", 5], ["uploads", 6], ["created", 7], ["destroyed", 8], ["size", 9], ["camera_x", 13], ["camera_y", 14], ["width", 15], ["height", 16]] as const;
  return concat(WASM_HEADER, ...sections.map((section) => encodeSection({id: section.id,
    body: section.id === 1 ? concat(uleb(signatures.count + extraTypes.length), signatures.entries, ...extraTypes)
      : section.id === 3 ? encodeIndexVector([...types, ...[0, 1, 1, 2, 3, 4, 0, 0].map((type) => signatures.count + type)])
      : section.id === 6 ? concat(uleb(base + globalTypes.length), globals.entries, ...globalTypes.map((type) => concat(op(type, 1), type === 0x7f ? i32Const(0) : f32Const(0), op(0x0b))))
      : section.id === 7 ? concat(uleb(exportVector.count + scalarExports.length + 2), exportVector.entries,
        encodeName(`${prefix}_publish`), op(0), uleb(publishIndex),
        encodeName(`${prefix}_hide`), op(0), uleb(hideIndex),
        ...scalarExports.map(([name, index]) => concat(encodeName(`${prefix}_${name}`), op(3), uleb(base + index))))
      : section.id === 10 ? encodeCode(bodies) : section.body,
  })));
}
