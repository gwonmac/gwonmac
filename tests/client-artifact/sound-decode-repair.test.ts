/** Qualification of the sound decode repair on retained clients. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  concat,
  encodeCode,
  encodeSection,
  parseCode,
  sectionById,
  splitSections,
  WASM_HEADER,
} from "../../app/main/core/wasm-binary.js";
import {
  DECODE_TASK_INDEX_FRAMES_OFFSET,
  deriveSoundDecodeRepairStage,
  isSoundDecodeRepairBuild,
  rewriteWithBuild,
} from "../../app/client/certification/sound-decode-repair.js";
import { functionBody, wasmEvidence } from "../../app/client/certification/wasm-evidence.js";
import { call, i32Const, i32Load, i32Store, localGet } from "../../app/client/certification/wasm-emit.js";

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const paths = [process.env.GW_CLIENT_WASM_PREVIOUS, process.env.GW_CLIENT_WASM]
  .filter((value): value is string => Boolean(value));

const startsWith = (body: Uint8Array, statement: Uint8Array): boolean =>
  sha256(body.subarray(1, 1 + statement.byteLength)) === sha256(statement);

for (const path of paths) {
  test(`the sound decode repair proves and frees the seek index: ${path}`, async () => {
    const official = new Uint8Array(await readFile(path));
    const stage = deriveSoundDecodeRepairStage(official);
    assert.ok(stage, "the retained client must prove the decode task");
    const { build, output } = stage;
    assert.equal(isSoundDecodeRepairBuild(build, sha256(official)), true);
    assert.equal(isSoundDecodeRepairBuild(build, sha256(output)), false, "a record proves only its own input");
    assert.equal(sha256(rewriteWithBuild(official, build)), build.derivations[sha256(official)]);

    const module = wasmEvidence(output)!.moduleView();
    const release = concat(localGet(0), i32Load(DECODE_TASK_INDEX_FRAMES_OFFSET), call(build.freeFunctionIndex));
    assert.ok(startsWith(functionBody(module, build.destructorFunctionIndex), release));
    assert.ok(startsWith(functionBody(module, build.deletingDestructorFunctionIndex), release));
    assert.ok(startsWith(
      functionBody(module, build.constructorFunctionIndex),
      concat(localGet(0), i32Const(0), i32Store(DECODE_TASK_INDEX_FRAMES_OFFSET)),
    ));
    assert.equal(deriveSoundDecodeRepairStage(output), null, "a repaired module is not repaired twice");
  });

  test(`a client whose decode task moved its decoder is refused: ${path}`, async () => {
    const official = new Uint8Array(await readFile(path));
    const build = deriveSoundDecodeRepairStage(official)!.build;
    const sections = splitSections(official);
    const imports = wasmEvidence(official)!.moduleView().functionImportCount;
    const bodies = parseCode(sectionById(sections, 10));
    const constructor = bodies[build.constructorFunctionIndex - imports]!.slice();
    // `local.get 0; i32.const 88; i32.add` before the open: the decoder now sits at +92.
    const at = constructor.findIndex((byte, index) =>
      byte === 0x20 && constructor[index + 1] === 0x00 && constructor[index + 2] === 0x41
      && constructor[index + 3] === 0xd8 && constructor[index + 4] === 0x00 && constructor[index + 5] === 0x6a);
    assert.ok(at > 0);
    constructor[at + 3] = 0xdc;
    bodies[build.constructorFunctionIndex - imports] = constructor;
    const moved = concat(
      WASM_HEADER,
      ...sections.map((section) => encodeSection(section.id === 10 ? { id: 10, body: encodeCode(bodies) } : section)),
    );
    assert.equal(deriveSoundDecodeRepairStage(moved), null);
    assert.throws(() => rewriteWithBuild(moved, build), /not the certified body/);
  });
}
